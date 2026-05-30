const express = require('express');
const path = require('path');
const multer = require('multer');
const nodemailer = require('nodemailer');
const fs = require('fs');
require('dotenv').config();

const db = require('./db');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT || 3000;

// Body parsing middleware
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// Cache active journals (refresh every 60s)
let _activeJournalsCache = [];
let _activeJournalsCacheAt = 0;
async function getActiveJournals() {
  if (Date.now() - _activeJournalsCacheAt < 5000 && _activeJournalsCache.length > 0) return _activeJournalsCache;
  try {
    const apiUrl = process.env.SCRIPTHIVE_API_URL || 'http://localhost:3001';
    const r = await fetch(`${apiUrl}/api/journals`, { signal: AbortSignal.timeout(3000) });
    if (r.ok) {
      const data = await r.json();
      const list = Array.isArray(data) ? data : (data.data || []);
      if (list.length > 0) {
        _activeJournalsCache = list;
        _activeJournalsCacheAt = Date.now();
      }
    }
  } catch { /* non-blocking */ }
  // Fallback: if API unreachable, show all from JOURNAL_META
  if (_activeJournalsCache.length === 0) {
    return Object.values(JOURNAL_META);
  }
  return _activeJournalsCache;
}

// Inject carousel slides + active journals into every rendered page
app.use(async (req, res, next) => {
  res.locals.carouselSlides = [];
  try {
    const apiUrl = process.env.SCRIPTHIVE_API_URL || 'http://localhost:3001';
    const r = await fetch(`${apiUrl}/api/carousel/public`);
    if (r.ok) res.locals.carouselSlides = await r.json();
  } catch { /* non-blocking */ }
  const active = await getActiveJournals();
  // Backend uses j.id as the abbr (e.g. "SGJVSR"). Normalize to abbr field.
  res.locals.activeJournals = active.map(j => {
    const abbr = j.abbr || j.id;
    const meta = JOURNAL_META[abbr] || {};
    return Object.assign({}, j, {
      abbr: abbr,
      shortDesc: meta.shortDesc || abbr,
      name: j.name || meta.name || abbr
    });
  });
  next();
});

// Setup multer for in-memory file uploads (for contact form attachments)
const upload = multer({ storage: multer.memoryStorage() });

// Setup Nodemailer transporter using .env credentials
const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT,
    secure: process.env.SMTP_PORT == 465, // true for 465, false for other ports
    auth: {
        user: process.env.SENDER_EMAIL,
        pass: process.env.SENDER_PASSWORD
    }
});

// Setup dedicated Nodemailer transporter for Editorial Board Applications
const editorialTransporter = nodemailer.createTransport({
    host: process.env.EDITORIAL_SMTP_HOST || process.env.SMTP_HOST,
    port: process.env.EDITORIAL_SMTP_PORT || process.env.SMTP_PORT,
    secure: (process.env.EDITORIAL_SMTP_PORT || process.env.SMTP_PORT) == 465,
    auth: {
        user: process.env.EDITORIAL_SENDER_EMAIL || process.env.SENDER_EMAIL,
        pass: process.env.EDITORIAL_SENDER_PASSWORD || process.env.SENDER_PASSWORD
    }
});

// Set EJS as the view engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// Routes
app.get('/', (req, res) => {
    res.render('index');
});

// Pages Routes
app.get('/about', (req, res) => res.render('pages/about'));
app.get('/contact', (req, res) => res.render('pages/contact'));
app.get('/archives', (req, res) => res.render('pages/archives'));
app.get('/guidelines', (req, res) => res.render('pages/guidelines'));
app.get('/issn', (req, res) => res.render('pages/issn'));
app.get('/journals', (req, res) => res.render('pages/journals'));
app.get('/policies', (req, res) => res.render('pages/policies'));
app.get('/services', (req, res) => res.render('pages/services'));
app.get('/submit', async (req, res) => {
  let addonServices = [];
  try {
    const apiUrl = process.env.SCRIPTHIVE_API_URL || 'http://localhost:3001';
    const r = await fetch(`${apiUrl}/api/settings/public/addons`);
    if (r.ok) addonServices = await r.json();
  } catch { /* non-blocking */ }
  res.render('pages/submit', {
    preselectedJournal: req.query.journal || '',
    addonServices
  });
});
app.get('/subscription', (req, res) => res.render('pages/subscription'));

// Journal metadata
const JOURNAL_META = {
  SGJVSR: { abbr: 'SGJVSR', issn: '3048-6114', issnOnline: 'XXXX-XXXX', name: 'ScriptHive Global Journal of Vedic and Sanskrit Research', shortDesc: 'Vedic & Sanskrit Research', cover: '/images/SGJVSR - Cover Page.png' },
  SGMRJ:  { abbr: 'SGMRJ',  issn: '3048-6122', issnOnline: 'XXXX-XXXX', name: 'ScriptHive Global Multidisciplinary Research Journal', shortDesc: 'Multidisciplinary Research', cover: '/images/SGMRJ - Cover Page.png' },
  SGJPLS: { abbr: 'SGJPLS', issn: '3048-6130', issnOnline: 'XXXX-XXXX', name: 'ScriptHive Global Journal of Physical and Life Sciences', shortDesc: 'Physical & Life Sciences', cover: '/images/SGJPLS Cover Page.png' },
  SGJETR: { abbr: 'SGJETR', issn: '3048-6149', issnOnline: 'XXXX-XXXX', name: 'ScriptHive Global Journal of Engineering and Technology Research', shortDesc: 'Engineering & Technology', cover: '/images/SGJETR - Cover Page.png' },
  SGJSSH: { abbr: 'SGJSSH', issn: '3048-6157', issnOnline: 'XXXX-XXXX', name: 'ScriptHive Global Journal of Social Sciences and Humanities', shortDesc: 'Social Sciences & Humanities', cover: '/images/SGJSSH - Cover Page.png' },
  SGJASH: { abbr: 'SGJASH', issn: '3048-6165', issnOnline: 'XXXX-XXXX', name: 'ScriptHive Global Journal of Applied Science and Health', shortDesc: 'Applied Science & Health', cover: '/images/SGJASH Cover Page.png' }
};

// Journals Routes — pass archive data + journalId for #archives section
const JOURNAL_IDS_LIST = ['SGJASH','SGJETR','SGJPLS','SGJSSH','SGJVSR','SGMRJ'];
JOURNAL_IDS_LIST.forEach(jid => {
  app.get(`/${jid}`, async (req, res) => {
    if (!(res.locals.activeJournals || []).some(j => (j.abbr || j.id) === jid)) { res.status(404).render('pages/404'); return; }
    const archive = await fetchArchive(jid);
    res.render(`journals/${jid}`, { archive, journalId: jid });
  });

  app.get(`/${jid}/archives`, async (req, res) => {
    if (!(res.locals.activeJournals || []).some(j => (j.abbr || j.id) === jid)) { res.status(404).render('pages/404'); return; }
    const archive = await fetchArchive(jid);
    res.render('journals/journal_archives', { archive, journalId: jid, journal: JOURNAL_META[jid] });
  });

  app.get(`/${jid}/archives/:slug`, async (req, res) => {
    if (!(res.locals.activeJournals || []).some(j => (j.abbr || j.id) === jid)) { res.status(404).render('pages/404'); return; }
    const archive = await fetchArchive(jid);
    res.render('journals/journal_archives', { archive, journalId: jid, journal: JOURNAL_META[jid], activeSlug: req.params.slug });
  });
});

// Journal archive data helper
async function fetchArchive(journalId) {
  try {
    const apiUrl = process.env.SCRIPTHIVE_API_URL || 'http://localhost:3001';
    const resp = await fetch(`${apiUrl}/api/archive/${journalId}`);
    if (!resp.ok) return [];
    return await resp.json();
  } catch { return []; }
}


// Invoice Route
app.get('/invoice', (req, res) => res.render('invoice'));

// Public article page
app.get('/article/:slug', async (req, res) => {
  const slug = req.params.slug;
  try {
    const apiUrl = process.env.SCRIPTHIVE_API_URL || 'http://localhost:3001';
    const resp = await fetch(`${apiUrl}/api/archive/article/${encodeURIComponent(slug)}`);
    if (!resp.ok) { res.status(404).render('pages/404'); return; }
    const article = await resp.json();
    res.render('article', { article });
  } catch {
    res.status(500).send('Server error');
  }
});

// ==========================================
// MANUSCRIPT SUBMISSION SETUP & ENDPOINTS
// ==========================================

// Rate limiting for manuscript submission
const submissionLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // Limit each IP to 10 submissions per window
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
    message: { status: 'error', message: 'Too many submissions from this IP. Please try again after 15 minutes.' }
});

// Ensure uploads folder for manuscripts exists
const manuscriptDir = path.join(__dirname, 'uploads/manuscripts');
if (!fs.existsSync(manuscriptDir)){
    fs.mkdirSync(manuscriptDir, { recursive: true });
}

// Multer Storage for Manuscript Uploads
const manuscriptStorage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, manuscriptDir);
    },
    filename: function (req, file, cb) {
        const timestamp = Date.now();
        // Sanitize original file name to prevent injection attacks
        const sanitized = file.originalname.replace(/[^a-zA-Z0-9.\-_]/g, '');
        cb(null, `${timestamp}-${sanitized}`);
    }
});

const manuscriptUpload = multer({
    storage: manuscriptStorage,
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB file size limit
    },
    fileFilter: function (req, file, cb) {
        const filetypes = /pdf|doc|docx/i;
        const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
        
        if (extname) {
            return cb(null, true);
        }
        cb(new Error('File upload failed: Only PDF, DOC, and DOCX files are allowed!'));
    }
});

// Dedicated SMTP transporter for Paper Submissions
const submitTransporter = nodemailer.createTransport({
    host: process.env.SUBMIT_SMTP_HOST || process.env.SMTP_HOST,
    port: parseInt(process.env.SUBMIT_SMTP_PORT || process.env.SMTP_PORT || '587'),
    secure: (process.env.SUBMIT_SMTP_PORT || process.env.SMTP_PORT) == 465,
    auth: {
        user: process.env.SUBMIT_SENDER_EMAIL || process.env.SENDER_EMAIL,
        pass: process.env.SUBMIT_SENDER_PASSWORD || process.env.SENDER_PASSWORD
    }
});

// Verify connection configuration
submitTransporter.verify(function (error, success) {
    if (error) {
        console.error('SMTP Connection Verification Error (submitTransporter):', error.message);
    } else {
        console.log('SMTP Server is ready to take our submit-paper messages.');
    }
});

// POST Route for Manuscript Submission
app.post('/submit-paper', submissionLimiter, (req, res) => {
    manuscriptUpload.single('manuscript')(req, res, async function (err) {
        if (err instanceof multer.MulterError) {
            return res.status(400).json({ status: 'error', message: `Upload error: ${err.message}` });
        } else if (err) {
            return res.status(400).json({ status: 'error', message: err.message });
        }

        try {
            const { author_name, author_email, author_phone, journal, paper_title, abstract, keywords, author_names } = req.body;
            const file = req.file;

            // Basic Field Validations
            if (!author_name || !author_email || !journal || !paper_title || !abstract || !keywords) {
                return res.status(400).json({ status: 'error', message: 'All marked fields (*) are required.' });
            }

            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(author_email)) {
                return res.status(400).json({ status: 'error', message: 'Please provide a valid email address.' });
            }

            if (!file) {
                return res.status(400).json({ status: 'error', message: 'Please upload your manuscript file (.pdf, .doc, or .docx).' });
            }

            // Generate unique Submission ID — Format: SH-YYYY-XXXX
            const year = new Date().getFullYear();
            const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
            let randomChars = '';
            for (let i = 0; i < 4; i++) randomChars += CHARS[Math.floor(Math.random() * CHARS.length)];
            const submissionId = `SH-${year}-${randomChars}`;
            const timestamp = new Date().toLocaleString();
            const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'Unknown';

            // Resolve list of authors
            let authorsList = [author_name];
            if (Array.isArray(author_names)) {
                author_names.forEach(name => {
                    const cleaned = name.trim();
                    if (cleaned && !authorsList.includes(cleaned)) {
                        authorsList.push(cleaned);
                    }
                });
            } else if (typeof author_names === 'string' && author_names.trim()) {
                authorsList.push(author_names.trim());
            }

            // Create record
            const record = {
                id: submissionId,
                author_name,
                email: author_email,
                phone: author_phone || '',
                journal,
                title: paper_title,
                abstract,
                keywords,
                filename: file.filename,
                status: 'Submitted',
                submitted_at: timestamp
            };

            // Save to local SQLite (fallback/backup)
            await db.saveSubmission(record);

            // Forward to ScriptHive backend (PostgreSQL + media storage)
            try {
                const apiUrl = process.env.SCRIPTHIVE_API_URL || 'http://localhost:3001';
                const fd = new FormData();
                fd.append('journalId', journal);
                fd.append('title', paper_title);
                fd.append('authorName', authorsList[0]);
                fd.append('authorEmail', author_email);
                if (author_phone) fd.append('authorPhone', author_phone);
                if (authorsList.length > 1) fd.append('coAuthors', authorsList.slice(1).join('; '));
                fd.append('abstract', abstract);
                fd.append('keywords', keywords);
                fd.append('articleType', 'Research');
                // attach file as Blob from disk
                const fileBuffer = fs.readFileSync(file.path);
                const blob = new Blob([fileBuffer], { type: file.mimetype });
                fd.append('manuscript', blob, file.originalname);

                const apiRes = await fetch(`${apiUrl}/api/submissions`, {
                    method: 'POST',
                    body: fd
                });
                if (!apiRes.ok) {
                    const errBody = await apiRes.json().catch(() => ({}));
                    console.warn('[ScriptHive API] Forward failed:', errBody.message || apiRes.status);
                } else {
                    console.log('[ScriptHive API] Submission forwarded successfully');
                }
            } catch (fwdErr) {
                // non-blocking — local save already done
                console.warn('[ScriptHive API] Forward error (non-fatal):', fwdErr.message);
            }

            // Construct journal title mapping
            const journalTitles = {
                'SGJVSR': 'ScriptHive Global Journal of Vedic and Sanskrit Research (SGJVSR)',
                'SGMRJ': 'ScriptHive Global Multidisciplinary Research Journal (SGMRJ)',
                'SGJPLS': 'ScriptHive Global Journal of Physical and Life Sciences (SGJPLS)',
                'SGJETR': 'ScriptHive Global Journal of Engineering and Technology Research (SGJETR)',
                'SGJSSH': 'ScriptHive Global Journal of Social Sciences and Humanities (SGJSSH)',
                'SGJASH': 'ScriptHive Global Journal of Applied Science and Health (SGJASH)'
            };
            const pickedJournalTitle = journalTitles[journal] || journal;

            // 1. Send Author Confirmation Email
            const mailOptionsAuthor = {
                from: `"ScriptHive Publication" <${process.env.SUBMIT_SENDER_EMAIL || process.env.SENDER_EMAIL}>`,
                replyTo: 'info@scripthive.org',
                to: author_email,
                subject: `Manuscript Submission Received – ScriptHive Publication [ID: ${submissionId}]`,
                html: `
                    <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 650px; margin: 0 auto; color: #1e293b; line-height: 1.6; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.03);">
                        <div style="background: linear-gradient(135deg, #2563eb 0%, #1e40af 100%); padding: 30px 40px; text-align: center;">
                            <h1 style="color: #ffffff; margin: 0; font-size: 26px; font-weight: 800; letter-spacing: -0.01em;">ScriptHive Publication</h1>
                            <span style="display: inline-block; background: rgba(251, 191, 36, 0.2); border: 1px solid rgba(251, 191, 36, 0.4); color: #fbbf24; font-size: 11px; font-weight: 700; padding: 4px 12px; border-radius: 20px; margin-top: 10px; text-transform: uppercase; letter-spacing: 0.05em;">Manuscript Submission System</span>
                        </div>
                        
                        <div style="padding: 40px; background-color: #ffffff;">
                            <p style="font-size: 16px; margin-top: 0; color: #0f172a; font-weight: 600;">Dear ${author_name},</p>
                            
                            <p style="font-size: 15px; color: #475569;">Thank you for submitting your research manuscript for publication consideration in <strong>${pickedJournalTitle}</strong>.</p>
                            
                            <p style="font-size: 15px; color: #475569;">We have successfully received your manuscript file and registered your submission. Your manuscript will now proceed to our Editorial Board for pre-screening followed by a rigorous double-blind peer review.</p>
                            
                            <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px 25px; margin: 25px 0;">
                                <h3 style="color: #2563eb; margin: 0 0 15px 0; font-size: 15px; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px; font-weight: 700;">Submission Details:</h3>
                                <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
                                    <tr>
                                        <td style="padding: 6px 0; color: #64748b; font-weight: 600; width: 160px;">• Submission ID:</td>
                                        <td style="padding: 6px 0; color: #2563eb; font-weight: bold; font-family: monospace;">${submissionId}</td>
                                    </tr>
                                    <tr>
                                        <td style="padding: 6px 0; color: #64748b; font-weight: 600;">• Date & Time:</td>
                                        <td style="padding: 6px 0; color: #0f172a; font-weight: 500;">${timestamp}</td>
                                    </tr>
                                    <tr>
                                        <td style="padding: 6px 0; color: #64748b; font-weight: 600;">• Paper Title:</td>
                                        <td style="padding: 6px 0; color: #0f172a; font-weight: bold; line-height: 1.4;">${paper_title}</td>
                                    </tr>
                                    <tr>
                                        <td style="padding: 6px 0; color: #64748b; font-weight: 600;">• Authors:</td>
                                        <td style="padding: 6px 0; color: #0f172a; font-weight: 500;">${authorsList.join(', ')}</td>
                                    </tr>
                                    <tr>
                                        <td style="padding: 6px 0; color: #64748b; font-weight: 600;">• Review Timeline:</td>
                                        <td style="padding: 6px 0; color: #10b981; font-weight: bold;">7–15 Working Days</td>
                                    </tr>
                                </table>
                            </div>
                            
                            <p style="font-size: 15px; color: #475569;">Our review process takes approximately <strong>7 to 15 working days</strong>. In the meantime, you can track the status of your manuscript or submit updates by replying to this email with your submission ID.</p>
                            
                            <p style="font-size: 15px; color: #475569; margin-bottom: 0;">Should you have any immediate questions or require assistance, please contact us at <a href="mailto:info@scripthive.org" style="color: #2563eb; text-decoration: none;">info@scripthive.org</a>.</p>
                            
                            <div style="margin-top: 35px; border-top: 1px solid #e2e8f0; padding-top: 20px; font-size: 14px;">
                                <p style="margin: 0; color: #64748b;">Regards,</p>
                                <p style="margin: 4px 0 0 0; font-weight: bold; color: #2563eb;">ScriptHive Editorial Team</p>
                                <p style="margin: 0; color: #64748b;"><a href="mailto:info@scripthive.org" style="color: #2563eb; text-decoration: none;">info@scripthive.org</a> | <a href="https://scripthive.org" style="color: #2563eb; text-decoration: none;">www.scripthive.org</a></p>
                            </div>
                        </div>
                    </div>
                `
            };

            // 2. Send Admin Notification Email (with file attachment)
            const mailOptionsAdmin = {
                from: `"${author_name} (Paper Submit)" <${process.env.SUBMIT_SENDER_EMAIL || process.env.SENDER_EMAIL}>`,
                replyTo: author_email,
                to: 'info@scripthive.org',
                subject: `New Paper Submission: ${submissionId} | ${pickedJournalTitle}`,
                html: `
                    <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 650px; margin: 0 auto; color: #1e293b; line-height: 1.6; border: 1px solid #cbd5e1; border-radius: 12px; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.05);">
                        <div style="background: linear-gradient(135deg, #0f172a 0%, #1e3a8a 100%); padding: 35px 40px;">
                            <span style="display: inline-block; background: rgba(251, 191, 36, 0.15); border: 1px solid rgba(251, 191, 36, 0.3); color: #fbbf24; font-size: 10px; font-weight: 800; padding: 4px 12px; border-radius: 20px; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 12px;">Admin Paper Alert</span>
                            <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 800; letter-spacing: -0.02em;">New Manuscript Submitted</h1>
                            <p style="color: #94a3b8; margin: 6px 0 0 0; font-size: 14px;">A new paper has been submitted to the ScriptHive publishing platform.</p>
                        </div>
                        
                        <div style="padding: 40px; background-color: #ffffff;">
                            <div style="border-left: 4px solid #2563eb; padding-left: 15px; margin-bottom: 25px;">
                                <span style="color: #64748b; font-size: 12px; text-transform: uppercase; font-weight: 700; letter-spacing: 0.05em;">Security Log Details</span>
                                <p style="margin: 4px 0 0 0; font-size: 14px; font-weight: 500;">Submitted on: <span style="color: #1e293b; font-weight: bold;">${timestamp}</span> | Submitter IP: <span style="color: #1e293b; font-weight: bold; font-family: monospace;">${ip}</span></p>
                            </div>

                            <h3 style="color: #0f172a; margin: 0 0 15px 0; font-size: 16px; font-weight: 700; border-bottom: 2px solid #f1f5f9; padding-bottom: 8px;">Manuscript Details</h3>
                            
                            <table style="width: 100%; border-collapse: collapse; margin-bottom: 30px; font-size: 14px;">
                                <tr>
                                    <td style="padding: 10px; border-bottom: 1px solid #f1f5f9; font-weight: 600; color: #475569; width: 180px; background-color: #f8fafc;">Target Journal</td>
                                    <td style="padding: 10px; border-bottom: 1px solid #f1f5f9; font-weight: bold; color: #2563eb;">${pickedJournalTitle}</td>
                                </tr>
                                <tr>
                                    <td style="padding: 10px; border-bottom: 1px solid #f1f5f9; font-weight: 600; color: #475569; background-color: #f8fafc;">Submission ID</td>
                                    <td style="padding: 10px; border-bottom: 1px solid #f1f5f9; font-weight: 700; color: #2563eb; font-family: monospace;">${submissionId}</td>
                                </tr>
                                <tr>
                                    <td style="padding: 10px; border-bottom: 1px solid #f1f5f9; font-weight: 600; color: #475569; background-color: #f8fafc;">Paper Title</td>
                                    <td style="padding: 10px; border-bottom: 1px solid #f1f5f9; font-weight: bold; color: #0f172a;">${paper_title}</td>
                                </tr>
                                <tr>
                                    <td style="padding: 10px; border-bottom: 1px solid #f1f5f9; font-weight: 600; color: #475569; background-color: #f8fafc;">Author Names</td>
                                    <td style="padding: 10px; border-bottom: 1px solid #f1f5f9; color: #0f172a; font-weight: 500;">${authorsList.join(', ')}</td>
                                </tr>
                                <tr>
                                    <td style="padding: 10px; border-bottom: 1px solid #f1f5f9; font-weight: 600; color: #475569; background-color: #f8fafc;">Primary Contact Email</td>
                                    <td style="padding: 10px; border-bottom: 1px solid #f1f5f9; color: #0f172a;"><a href="mailto:${author_email}" style="color: #2563eb; text-decoration: none; font-weight: 500;">${author_email}</a></td>
                                </tr>
                                <tr>
                                    <td style="padding: 10px; border-bottom: 1px solid #f1f5f9; font-weight: 600; color: #475569; background-color: #f8fafc;">Contact Phone</td>
                                    <td style="padding: 10px; border-bottom: 1px solid #f1f5f9; color: #0f172a; font-weight: 500;">${author_phone || 'Not provided'}</td>
                                </tr>
                                <tr>
                                    <td style="padding: 10px; border-bottom: 1px solid #f1f5f9; font-weight: 600; color: #475569; background-color: #f8fafc;">Keywords</td>
                                    <td style="padding: 10px; border-bottom: 1px solid #f1f5f9; color: #0f172a; font-family: monospace;">${keywords}</td>
                                </tr>
                            </table>

                            <h3 style="color: #0f172a; margin: 0 0 10px 0; font-size: 15px; font-weight: 700;">Abstract</h3>
                            <div style="background-color: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; padding: 20px; font-size: 14px; color: #334155; line-height: 1.6; margin-bottom: 30px; text-align: justify;">
                                ${abstract.replace(/\n/g, '<br/>')}
                            </div>

                            <div style="background-color: #f0fdf4; border: 1px dashed #bbf7d0; border-radius: 8px; padding: 15px 20px;">
                                <h4 style="margin: 0 0 10px 0; font-size: 13px; text-transform: uppercase; color: #166534; letter-spacing: 0.05em;">📎 Manuscript File Attached</h4>
                                <div style="font-size: 13px; color: #14532d;">
                                    📄 <strong>File Name:</strong> <span style="font-family: monospace; color: #15803d;">${file.filename}</span>
                                </div>
                            </div>
                            
                            <div style="margin-top: 30px; border-top: 1px solid #f1f5f9; padding-top: 20px; font-size: 12px; color: #94a3b8; text-align: center;">
                                <p style="margin: 0;">This email is auto-generated by the ScriptHive Website Application Portal.</p>
                            </div>
                        </div>
                    </div>
                `,
                attachments: [
                    {
                        filename: file.originalname,
                        path: file.path
                    }
                ]
            };

            // Respond immediately — don't block on emails or API forward
            res.json({
                status: 'success',
                submission_id: submissionId,
                timestamp: timestamp,
                author_name,
                email: author_email,
                paper_title,
                journal: pickedJournalTitle,
                review_timeline: '7–15 Working Days'
            });

            // Fire-and-forget: emails + backend API (non-blocking)
            Promise.all([
                submitTransporter.sendMail(mailOptionsAuthor),
                submitTransporter.sendMail(mailOptionsAdmin)
            ]).catch(err => console.error('[Email] Send failed:', err.message));

        } catch (error) {
            console.error('Manuscript Submission Route Error:', error);
            res.status(500).json({ status: 'error', message: 'Failed to process manuscript submission. Server error occurred.' });
        }
    });
});

// POST Routes

app.post('/contact', upload.single('attachment'), async (req, res) => {
    try {
        const { name, email, phone, subject, message } = req.body;
        if (!name || !email || !subject || !message) {
            return res.status(400).json({ status: 'error', message: 'All required fields must be filled.' });
        }

        const apiUrl = process.env.SCRIPTHIVE_API_URL || 'http://localhost:3001';
        const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '';

        // Save to PostgreSQL via backend API
        const apiRes = await fetch(`${apiUrl}/api/contact`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, email, phone: phone || '', subject, message, ipAddress: ip })
        });

        const apiData = await apiRes.json();
        if (!apiRes.ok) {
            return res.status(500).json({ status: 'error', message: apiData.message || 'Save failed' });
        }

        const queryId = apiData.queryId;
        const timestamp = new Date().toLocaleString();

        // Send emails fire-and-forget
        const mailAdmin = {
            from: `"${name} via ScriptHive" <${process.env.SENDER_EMAIL}>`,
            replyTo: email,
            to: 'info@scripthive.org',
            subject: `New Query: ${subject} [${queryId}]`,
            html: `<h3>New Contact Query</h3><p><b>ID:</b> ${queryId}</p><p><b>Name:</b> ${name}</p><p><b>Email:</b> ${email}</p><p><b>Phone:</b> ${phone || '—'}</p><p><b>Subject:</b> ${subject}</p><p><b>Message:</b><br/>${message.replace(/\n/g, '<br/>')}</p>`
        };
        const mailUser = {
            from: `"ScriptHive Publication" <${process.env.SENDER_EMAIL}>`,
            replyTo: 'info@scripthive.org',
            to: email,
            subject: `Query Received – ScriptHive [Ref: ${queryId}]`,
            html: `<p>Dear ${name},</p><p>Thank you for contacting ScriptHive. Your query has been logged with reference <strong>${queryId}</strong>. We will respond within 24–48 business hours.</p><p>Regards,<br/>ScriptHive Editorial Team</p>`
        };
        Promise.all([
            transporter.sendMail(mailAdmin),
            transporter.sendMail(mailUser)
        ]).catch(err => console.warn('[Contact email]', err.message));

        res.json({ status: 'success', query_id: queryId, timestamp });

    } catch (error) {
        console.error('Contact Form Error:', error);
        res.status(500).json({ status: 'error', message: 'Failed to process. Please try again later.' });
    }
});

// Ensure upload directories exist for Editorial Board
const uploadDirs = [
    'uploads/editorial-board/resumes',
    'uploads/editorial-board/photos'
];
uploadDirs.forEach(dir => {
    if (!fs.existsSync(dir)){
        fs.mkdirSync(dir, { recursive: true });
    }
});

// Setup disk storage configuration for Editorial Board applications
const editorialStorage = multer.diskStorage({
    destination: function (req, file, cb) {
        if (file.fieldname === 'resume') {
            cb(null, 'uploads/editorial-board/resumes');
        } else if (file.fieldname === 'photo') {
            cb(null, 'uploads/editorial-board/photos');
        } else {
            cb(new Error('Invalid field name'), null);
        }
    },
    filename: function (req, file, cb) {
        const timestamp = Date.now();
        // Sanitize original file name to prevent injection attacks
        const sanitized = file.originalname.replace(/[^a-zA-Z0-9.\-_]/g, '');
        cb(null, `${timestamp}-${sanitized}`);
    }
});

const editorialUpload = multer({
    storage: editorialStorage,
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB overall file upload limit
    },
    fileFilter: function (req, file, cb) {
        const filetypes = /pdf|doc|docx|jpg|jpeg|png/i;
        const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = filetypes.test(file.mimetype);

        if (extname && mimetype) {
            return cb(null, true);
        }
        cb(new Error('File upload failed: Only PDF, DOC, DOCX, JPG, JPEG, and PNG files are allowed!'));
    }
});

const applyUpload = editorialUpload.fields([
    { name: 'resume', maxCount: 1 },
    { name: 'photo', maxCount: 1 }
]);

// POST Route for Editorial Board Application
app.post('/api/editorial-board/apply', (req, res) => {
    applyUpload(req, res, async function (err) {
        if (err instanceof multer.MulterError) {
            return res.status(400).json({ status: 'error', message: `Upload error: ${err.message}` });
        } else if (err) {
            return res.status(400).json({ status: 'error', message: err.message });
        }

        try {
            const { name, email, phone, degree, institution, post, journalName } = req.body;
            const resumeFile = req.files && req.files.resume ? req.files.resume[0] : null;
            const photoFile = req.files && req.files.photo ? req.files.photo[0] : null;

            // Form validations
            if (!name || !email || !phone || !degree || !institution || !post) {
                return res.status(400).json({ status: 'error', message: 'All text fields are required.' });
            }
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(email)) {
                return res.status(400).json({ status: 'error', message: 'Please provide a valid email address.' });
            }
            if (!resumeFile) {
                return res.status(400).json({ status: 'error', message: 'CV/Resume file is required.' });
            }
            if (!photoFile) {
                return res.status(400).json({ status: 'error', message: 'Candidate Photo is required.' });
            }

            // Specific Size checks
            if (resumeFile.size > 10 * 1024 * 1024) {
                return res.status(400).json({ status: 'error', message: 'Resume size exceeds the 10MB limit.' });
            }
            if (photoFile.size > 4 * 1024 * 1024) {
                return res.status(400).json({ status: 'error', message: 'Photo size exceeds the 4MB limit.' });
            }

            const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'Unknown';
            const appId = `EBA-${Math.floor(10000 + Math.random() * 90000)}`;
            const timestamp = new Date().toLocaleString();

            // Set fallback if journalName is missing
            const pickedJournal = journalName || 'ScriptHive Global Journal of Vedic and Sanskrit Research (SGJVSR)';

            // 1. CONFIRMATION EMAIL TO APPLICANT
            const mailOptionsCandidate = {
                from: `"ScriptHive Editorial Team" <${process.env.EDITORIAL_SENDER_EMAIL || process.env.SENDER_EMAIL}>`,
                replyTo: 'editor@scripthive.org',
                to: email,
                subject: `Application Received – Editorial Board | ${pickedJournal}`,
                html: `
                    <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 650px; margin: 0 auto; color: #1e293b; line-height: 1.6; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.03);">
                        <div style="background: linear-gradient(135deg, #1e3a8a 0%, #1e40af 100%); padding: 30px 40px; text-align: center;">
                            <h1 style="color: #ffffff; margin: 0; font-size: 26px; font-weight: 800; letter-spacing: -0.01em;">ScriptHive Publication</h1>
                            <span style="display: inline-block; background: rgba(251, 191, 36, 0.2); border: 1px solid rgba(251, 191, 36, 0.4); color: #fbbf24; font-size: 11px; font-weight: 700; padding: 4px 12px; border-radius: 20px; margin-top: 10px; text-transform: uppercase; letter-spacing: 0.05em;">Editorial Board System</span>
                        </div>
                        
                        <div style="padding: 40px; background-color: #ffffff;">
                            <p style="font-size: 16px; margin-top: 0; color: #0f172a; font-weight: 600;">Dear ${name},</p>
                            
                            <p style="font-size: 15px; color: #475569;">Thank you for applying to join the Editorial Board of <strong>${pickedJournal}</strong>.</p>
                            
                            <p style="font-size: 15px; color: #475569;">We have successfully received your application and supporting documents. Our editorial management team will review your profile and contact you shortly regarding the next steps.</p>
                            
                            <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px 25px; margin: 25px 0;">
                                <h3 style="color: #1e3a8a; margin: 0 0 15px 0; font-size: 15px; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px; font-weight: 700;">Application Details:</h3>
                                <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
                                    <tr>
                                        <td style="padding: 6px 0; color: #64748b; font-weight: 600; width: 180px;">• Applied Journal:</td>
                                        <td style="padding: 6px 0; color: #1e3a8a; font-weight: bold;">${pickedJournal}</td>
                                    </tr>
                                    <tr>
                                        <td style="padding: 6px 0; color: #64748b; font-weight: 600; width: 180px;">• Name:</td>
                                        <td style="padding: 6px 0; color: #0f172a; font-weight: 500;">${name}</td>
                                    </tr>
                                    <tr>
                                        <td style="padding: 6px 0; color: #64748b; font-weight: 600;">• Degree:</td>
                                        <td style="padding: 6px 0; color: #0f172a; font-weight: 500;">${degree}</td>
                                    </tr>
                                    <tr>
                                        <td style="padding: 6px 0; color: #64748b; font-weight: 600;">• Department & College:</td>
                                        <td style="padding: 6px 0; color: #0f172a; font-weight: 500;">${institution}</td>
                                    </tr>
                                    <tr>
                                        <td style="padding: 6px 0; color: #64748b; font-weight: 600;">• Current Position:</td>
                                        <td style="padding: 6px 0; color: #0f172a; font-weight: 500;">${post}</td>
                                    </tr>
                                </table>
                            </div>
                            
                            <p style="font-size: 15px; color: #475569;">Our Senior Editorial Board typically completes credential evaluations within <strong>7 to 10 working days</strong>. In the meantime, should you have any queries or wish to submit additional details, please feel free to reply directly to this email.</p>
                            
                            <p style="font-size: 15px; color: #475569; margin-bottom: 0;">Thank you for your interest in contributing to academic excellence.</p>
                            
                            <div style="margin-top: 35px; border-top: 1px solid #e2e8f0; padding-top: 20px; font-size: 14px;">
                                <p style="margin: 0; color: #64748b;">Regards,</p>
                                <p style="margin: 4px 0 0 0; font-weight: bold; color: #1e3a8a;">ScriptHive Editorial Team</p>
                                <p style="margin: 0; color: #64748b;"><a href="mailto:editor@scripthive.org" style="color: #3b82f6; text-decoration: none;">editor@scripthive.org</a> | <a href="https://scripthive.org" style="color: #3b82f6; text-decoration: none;">www.scripthive.org</a></p>
                            </div>
                        </div>
                    </div>
                `
            };

            // 2. ADMIN NOTIFICATION EMAIL TO info@scripthive.org (With physical file attachments from disk)
            const mailOptionsAdmin = {
                from: `"${name} (Editorial Apply)" <${process.env.EDITORIAL_SENDER_EMAIL || process.env.SENDER_EMAIL}>`,
                replyTo: email,
                to: 'info@scripthive.org',
                subject: `New Editorial Board Application – ${name} | ${pickedJournal}`,
                html: `
                    <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 650px; margin: 0 auto; color: #1e293b; line-height: 1.6; border: 1px solid #cbd5e1; border-radius: 12px; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.05);">
                        <!-- Glassmorphic Styled Academic Header -->
                        <div style="background: linear-gradient(135deg, #0f172a 0%, #1e3a8a 100%); padding: 35px 40px;">
                            <span style="display: inline-block; background: rgba(251, 191, 36, 0.15); border: 1px solid rgba(251, 191, 36, 0.3); color: #fbbf24; font-size: 10px; font-weight: 800; padding: 4px 12px; border-radius: 20px; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 12px;">Admin Alert System</span>
                            <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 800; letter-spacing: -0.02em;">New Board Application</h1>
                            <p style="color: #94a3b8; margin: 6px 0 0 0; font-size: 14px;">A new candidate professor has applied to join the ScriptHive Publication Editorial Board.</p>
                        </div>
                        
                        <!-- Body Grid -->
                        <div style="padding: 40px; background-color: #ffffff;">
                            <div style="border-left: 4px solid #3b82f6; padding-left: 15px; margin-bottom: 25px;">
                                <span style="color: #64748b; font-size: 12px; text-transform: uppercase; font-weight: 700; letter-spacing: 0.05em;">Security Log Details</span>
                                <p style="margin: 4px 0 0 0; font-size: 14px; font-weight: 500;">Submitted on: <span style="color: #1e293b; font-weight: bold;">${timestamp}</span> | Candidate IP: <span style="color: #1e293b; font-weight: bold; font-family: monospace;">${ip}</span></p>
                            </div>

                            <h3 style="color: #0f172a; margin: 0 0 15px 0; font-size: 16px; font-weight: 700; border-bottom: 2px solid #f1f5f9; padding-bottom: 8px;">Candidate Profile Details</h3>
                            
                            <table style="width: 100%; border-collapse: collapse; margin-bottom: 30px; font-size: 14px;">
                                <tr>
                                    <td style="padding: 10px; border-bottom: 1px solid #f1f5f9; font-weight: 600; color: #475569; width: 180px; background-color: #f8fafc;">Applied Journal</td>
                                    <td style="padding: 10px; border-bottom: 1px solid #f1f5f9; font-weight: bold; color: #1e3a8a;">${pickedJournal}</td>
                                </tr>
                                <tr>
                                    <td style="padding: 10px; border-bottom: 1px solid #f1f5f9; font-weight: 600; color: #475569; background-color: #f8fafc;">Application Ref</td>
                                    <td style="padding: 10px; border-bottom: 1px solid #f1f5f9; font-weight: 700; color: #2563eb; font-family: monospace;">${appId}</td>
                                </tr>
                                <tr>
                                    <td style="padding: 10px; border-bottom: 1px solid #f1f5f9; font-weight: 600; color: #475569; background-color: #f8fafc;">Full Name</td>
                                    <td style="padding: 10px; border-bottom: 1px solid #f1f5f9; font-weight: 600; color: #0f172a;">${name}</td>
                                </tr>
                                <tr>
                                    <td style="padding: 10px; border-bottom: 1px solid #f1f5f9; font-weight: 600; color: #475569; background-color: #f8fafc;">Email Address</td>
                                    <td style="padding: 10px; border-bottom: 1px solid #f1f5f9; color: #0f172a;"><a href="mailto:${email}" style="color: #2563eb; text-decoration: none; font-weight: 500;">${email}</a></td>
                                </tr>
                                <tr>
                                    <td style="padding: 10px; border-bottom: 1px solid #f1f5f9; font-weight: 600; color: #475569; background-color: #f8fafc;">Contact Number</td>
                                    <td style="padding: 10px; border-bottom: 1px solid #f1f5f9; color: #0f172a; font-weight: 500;">${phone}</td>
                                </tr>
                                <tr>
                                    <td style="padding: 10px; border-bottom: 1px solid #f1f5f9; font-weight: 600; color: #475569; background-color: #f8fafc;">Highest Degree</td>
                                    <td style="padding: 10px; border-bottom: 1px solid #f1f5f9; color: #0f172a;">${degree}</td>
                                </tr>
                                <tr>
                                    <td style="padding: 10px; border-bottom: 1px solid #f1f5f9; font-weight: 600; color: #475569; background-color: #f8fafc;">Department & College</td>
                                    <td style="padding: 10px; border-bottom: 1px solid #f1f5f9; color: #0f172a;">${institution}</td>
                                </tr>
                                <tr>
                                    <td style="padding: 10px; border-bottom: 1px solid #f1f5f9; font-weight: 600; color: #475569; background-color: #f8fafc;">Current Post</td>
                                    <td style="padding: 10px; border-bottom: 1px solid #f1f5f9; color: #0f172a;">${post}</td>
                                </tr>
                            </table>

                            <div style="background-color: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 8px; padding: 15px 20px;">
                                <h4 style="margin: 0 0 10px 0; font-size: 13px; text-transform: uppercase; color: #475569; letter-spacing: 0.05em;">📎 Uploaded Documents</h4>
                                <div style="font-size: 13px; color: #0f172a; display: flex; flex-direction: column; gap: 6px;">
                                    <div>📄 <strong>Resume File:</strong> <span style="font-family: monospace; color: #64748b;">${resumeFile.filename}</span></div>
                                    <div>🖼️ <strong>Applicant Photo:</strong> <span style="font-family: monospace; color: #64748b;">${photoFile.filename}</span></div>
                                </div>
                            </div>
                            
                            <div style="margin-top: 30px; border-top: 1px solid #f1f5f9; padding-top: 20px; font-size: 12px; color: #94a3b8; text-align: center;">
                                <p style="margin: 0;">This email is auto-generated by the ScriptHive Website Application Portal.</p>
                            </div>
                        </div>
                    </div>
                `,
                attachments: [
                    {
                        filename: resumeFile.originalname,
                        path: resumeFile.path
                    },
                    {
                        filename: photoFile.originalname,
                        path: photoFile.path
                    }
                ]
            };

            await editorialTransporter.sendMail(mailOptionsCandidate);
            await editorialTransporter.sendMail(mailOptionsAdmin);

            res.json({
                status: 'success',
                application_id: appId,
                timestamp: timestamp,
                message: 'Your Editorial Board application has been submitted successfully.'
            });

        } catch (error) {
            console.error('Editorial Board Application Route Error:', error);
            res.status(500).json({ status: 'error', message: 'Server error occurred while submitting your application.' });
        }
    });
});

// Handle 404
app.use((req, res) => {
    res.status(404).send('Page not found');
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
    console.log(`[ScriptHive API] Forwarding submissions to: ${process.env.SCRIPTHIVE_API_URL || 'http://localhost:5000 (fallback — set SCRIPTHIVE_API_URL in .env)'}`);
});

