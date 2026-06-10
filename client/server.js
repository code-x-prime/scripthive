const express = require('express');
const path = require('path');
const multer = require('multer');
const nodemailer = require('nodemailer');
const fs = require('fs');
require('dotenv').config();

const db = require('./db');
const rateLimit = require('express-rate-limit');

const app = express();
app.set('trust proxy', 1); // Fix: Nginx reverse proxy sets X-Forwarded-For
const PORT = process.env.PORT || 3000;

// Body parsing middleware
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// Cache active journals (refresh every 60s)
let _activeJournalsCache = [];
let _activeJournalsCacheAt = 0;
let _activeJournalsFetched = false; // track if at least one successful fetch done
async function getActiveJournals() {
    if (Date.now() - _activeJournalsCacheAt < 5000 && _activeJournalsFetched) return _activeJournalsCache;
    try {
        const apiUrl = process.env.SCRIPTHIVE_API_URL || 'http://localhost:3001';
        const r = await fetch(`${apiUrl}/api/journals`, { signal: AbortSignal.timeout(3000) });
        if (r.ok) {
            const data = await r.json();
            const list = Array.isArray(data) ? data : (data.data || []);
            _activeJournalsCache = list; // always update — even empty means all inactive
            _activeJournalsCacheAt = Date.now();
            _activeJournalsFetched = true;
        }
    } catch { /* non-blocking */ }
    // Only fallback to JOURNAL_META if API never responded (startup race)
    if (!_activeJournalsFetched) {
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
            name: j.name || meta.name || abbr,
            issn: j.issn || meta.issn,
            issnOnline: j.eIssn || j.issnOnline || meta.issnOnline
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
    secure: process.env.SMTP_PORT == 465,
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
    let apcRates = { inr: 0, usd: 0 };
    try {
        const apiUrl = process.env.SCRIPTHIVE_API_URL || 'http://localhost:3001';
        const r = await fetch(`${apiUrl}/api/settings/public/addons`);
        if (r.ok) {
            const data = await r.json();
            // Support both old format (array) and new format ({addons, apc})
            if (Array.isArray(data)) {
                addonServices = data;
            } else {
                addonServices = data.addons || [];
                apcRates = data.apc || { inr: 0, usd: 0 };
            }
        }
    } catch { /* non-blocking */ }
    res.render('pages/submit', {
        preselectedJournal: req.query.journal || '',
        addonServices,
        apcRates
    });
});
app.get('/subscription', (req, res) => res.render('pages/subscription'));

// Journal metadata — static fallback, overridden by live DB data
const JOURNAL_META = {
    SGJVSR: { abbr: 'SGJVSR', issn: '3048-6114', issnOnline: 'XXXX-XXXX', name: 'ScriptHive Global Journal of Vedic and Sanskrit Research', shortDesc: 'Vedic & Sanskrit Research', cover: '/images/SGJVSR - Cover Page.png' },
    SGMRJ: { abbr: 'SGMRJ', issn: '3048-6122', issnOnline: 'XXXX-XXXX', name: 'ScriptHive Global Multidisciplinary Research Journal', shortDesc: 'Multidisciplinary Research', cover: '/images/SGMRJ - Cover Page.png' },
    SGJPLS: { abbr: 'SGJPLS', issn: '3048-6130', issnOnline: 'XXXX-XXXX', name: 'ScriptHive Global Journal of Physical and Life Sciences', shortDesc: 'Physical & Life Sciences', cover: '/images/SGJPLS Cover Page.png' },
    SGJETR: { abbr: 'SGJETR', issn: '3048-6149', issnOnline: 'XXXX-XXXX', name: 'ScriptHive Global Journal of Engineering and Technology Research', shortDesc: 'Engineering & Technology', cover: '/images/SGJETR - Cover Page.png' },
    SGJSSH: { abbr: 'SGJSSH', issn: '3048-6157', issnOnline: 'XXXX-XXXX', name: 'ScriptHive Global Journal of Social Sciences and Humanities', shortDesc: 'Social Sciences & Humanities', cover: '/images/SGJSSH - Cover Page.png' },
    SGJASH: { abbr: 'SGJASH', issn: '3048-6165', issnOnline: 'XXXX-XXXX', name: 'ScriptHive Global Journal of Applied Science and Health', shortDesc: 'Applied Science & Health', cover: '/images/SGJASH Cover Page.png' }
};

// Live ISSN cache — refresh from DB every 5 min
let _issnCache = {};
let _issnCacheAt = 0;
async function getLiveJournalMeta(jid) {
    if (Date.now() - _issnCacheAt < 300000 && _issnCache[jid]) return _issnCache[jid];
    try {
        const apiUrl = process.env.SCRIPTHIVE_API_URL || 'http://localhost:3001';
        const r = await fetch(`${apiUrl}/api/journals/admin`, { headers: { 'Authorization': 'Bearer skip' } }).catch(() => null);
        // Use public journals list instead
        const r2 = await fetch(`${apiUrl}/api/journals`);
        if (r2.ok) {
            const list = await r2.json();
            list.forEach(j => {
                const id = j.id || j.abbr;
                if (JOURNAL_META[id]) {
                    _issnCache[id] = Object.assign({}, JOURNAL_META[id], {
                        issn: j.issn || JOURNAL_META[id].issn,
                        issnOnline: j.eIssn || JOURNAL_META[id].issnOnline
                    });
                }
            });
            _issnCacheAt = Date.now();
        }
    } catch { /* fallback to static */ }
    return _issnCache[jid] || JOURNAL_META[jid] || {};
}

// Journals Routes — pass archive data + journalId for #archives section
const JOURNAL_IDS_LIST = ['SGJASH', 'SGJETR', 'SGJPLS', 'SGJSSH', 'SGJVSR', 'SGMRJ'];
JOURNAL_IDS_LIST.forEach(jid => {
    app.get(`/${jid}`, async (req, res) => {
        if (!(res.locals.activeJournals || []).some(j => (j.abbr || j.id) === jid)) { res.status(404).render('pages/404'); return; }
        const [archive, editorialBoard] = await Promise.all([
            fetchArchive(jid),
            fetchEditorialBoard(jid)
        ]);
        const journalMeta = await getLiveJournalMeta(jid);
        res.render(`journals/${jid}`, { archive, journalId: jid, editorialBoard, journalMeta });
    });

    app.get(`/${jid}/archives`, async (req, res) => {
        if (!(res.locals.activeJournals || []).some(j => (j.abbr || j.id) === jid)) { res.status(404).render('pages/404'); return; }
        const archive = await fetchArchive(jid);
        getLiveJournalMeta(jid).then(jm => res.render('journals/journal_archives', { archive, journalId: jid, journal: jm }));
    });

    app.get(`/${jid}/archives/:slug`, async (req, res) => {
        if (!(res.locals.activeJournals || []).some(j => (j.abbr || j.id) === jid)) { res.status(404).render('pages/404'); return; }
        const archive = await fetchArchive(jid);
        getLiveJournalMeta(jid).then(jm => res.render('journals/journal_archives', { archive, journalId: jid, journal: jm, activeSlug: req.params.slug }));
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

// Editorial board public data
async function fetchEditorialBoard(journalId) {
    try {
        const apiUrl = process.env.SCRIPTHIVE_API_URL || 'http://localhost:3001';
        const resp = await fetch(`${apiUrl}/api/journals/${journalId}/editorial-board/public`);
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
if (!fs.existsSync(manuscriptDir)) {
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
        const filetypes = /pdf|doc|docx|xls|xlsx/i;
        const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
        if (extname) { return cb(null, true); }
        cb(new Error('File upload failed: Only PDF, DOC, DOCX, XLS, XLSX files are allowed!'));
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
            const { author_name, author_email, author_phone, journal, paper_title, abstract, keywords, author_names, country, addons } = req.body;
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
                return res.status(400).json({ status: 'error', message: 'Please upload your manuscript file (.pdf, .doc, .docx, .xls, or .xlsx).' });
            }

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

            // Forward to ScriptHive backend (PostgreSQL) — BLOCKING to get real submission ID
            let submissionId = null;
            let _backendForwardSuccess = false;
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
                if (country) fd.append('country', country);
                if (addons) fd.append('addons', typeof addons === 'string' ? addons : JSON.stringify(addons));
                const fileBuffer = fs.readFileSync(file.path);
                const ext = (file.originalname || '').split('.').pop().toLowerCase();
                const mimeMap = { pdf: 'application/pdf', doc: 'application/msword', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', xls: 'application/vnd.ms-excel', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' };
                const mime = mimeMap[ext] || file.mimetype || 'application/octet-stream';
                const blob = new Blob([fileBuffer], { type: mime });
                fd.append('manuscript', blob, file.originalname);

                const apiRes = await fetch(`${apiUrl}/api/submissions`, { method: 'POST', body: fd });
                if (apiRes.ok) {
                    const apiData = await apiRes.json();
                    submissionId = apiData.id || apiData.submission_id || apiData.data?.id || null;
                    // If duplicate detected by backend — return existing ID, skip all processing
                    if (apiData._duplicate) {
                        console.log('[ScriptHive API] Duplicate submission detected, returning existing ID:', submissionId);
                        return res.json({ status: 'success', submission_id: submissionId, paper_title, journal: journal, review_timeline: '7–15 Working Days' });
                    }
                    _backendForwardSuccess = true; // backend will handle emails
                    console.log('[ScriptHive API] Submission created, ID:', submissionId);
                } else {
                    const errBody = await apiRes.json().catch(() => ({}));
                    console.warn('[ScriptHive API] Forward failed:', errBody.message || apiRes.status);
                }
            } catch (fwdErr) {
                console.warn('[ScriptHive API] Forward error:', fwdErr.message);
            }

            // Fallback: generate local ID only if backend failed
            if (!submissionId) {
                const year = new Date().getFullYear();
                const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
                let randomChars = '';
                for (let i = 0; i < 4; i++) randomChars += CHARS[Math.floor(Math.random() * CHARS.length)];
                submissionId = `SH-${year}-${randomChars}`;
                console.warn('[ScriptHive] Using fallback local ID:', submissionId);
            }

            // Save to local SQLite with correct ID
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
            await db.saveSubmission(record);

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

            const _shBase2 = (ttl, body) => `<!DOCTYPE html><html><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head><body style="margin:0;padding:0;background:#eef2f7;font-family:'Segoe UI',Arial,sans-serif;"><table width="100%" cellpadding="0" cellspacing="0" style="background:#eef2f7;padding:40px 0;"><tr><td align="center"><table width="620" cellpadding="0" cellspacing="0" style="max-width:620px;width:100%;"><tr><td style="background:#1d4ed8;height:5px;font-size:0;">&nbsp;</td></tr><tr><td style="background:#0f172a;padding:36px 48px 28px;"><table width="100%" cellpadding="0" cellspacing="0"><tr><td><div style="font-size:24px;font-weight:800;color:#fff;letter-spacing:-0.5px;">ScriptHive Publication</div><div style="font-size:11px;color:#93c5fd;margin-top:5px;letter-spacing:2px;text-transform:uppercase;font-weight:600;">International Research Journals</div></td><td align="right" valign="middle"><div style="background:#1d4ed8;color:#fff;font-size:11px;font-weight:700;padding:5px 14px;letter-spacing:1px;text-transform:uppercase;">ISSN Supported</div></td></tr></table></td></tr><tr><td style="background:#1d4ed8;padding:16px 48px;"><div style="font-size:15px;font-weight:700;color:#fff;letter-spacing:0.3px;">${ttl}</div></td></tr><tr><td style="background:#fff;padding:44px 48px;border-left:1px solid #dde3ed;border-right:1px solid #dde3ed;">${body}</td></tr><tr><td style="background:#f1f5f9;border:1px solid #dde3ed;border-top:3px solid #1d4ed8;padding:28px 48px;"><div style="font-size:13px;font-weight:700;color:#0f172a;">ScriptHive Publication</div><div style="font-size:12px;color:#64748b;margin-top:3px;"><a href="https://scripthive.org" style="color:#1d4ed8;text-decoration:none;">scripthive.org</a>&nbsp;&middot;&nbsp;<a href="mailto:info@scripthive.org" style="color:#1d4ed8;text-decoration:none;">info@scripthive.org</a>&nbsp;&middot;&nbsp;+91 9899916683</div><div style="font-size:11px;color:#94a3b8;margin-top:12px;border-top:1px solid #e2e8f0;padding-top:12px;">Automated email. If unexpected, please ignore or contact us.</div></td></tr><tr><td style="background:#0f172a;height:4px;font-size:0;">&nbsp;</td></tr></table></td></tr></table></body></html>`;
            const _shRows2 = (rows) => `<table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #dde3ed;margin:24px 0;"><thead><tr><td colspan="2" style="background:#0f172a;padding:10px 16px;font-size:11px;font-weight:800;color:#93c5fd;letter-spacing:1.5px;text-transform:uppercase;">Details</td></tr></thead><tbody>${rows.map(([k,v],i)=>`<tr style="background:${i%2===0?'#f8fafc':'#fff'};"><td style="padding:11px 16px;font-size:12px;color:#64748b;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;border-bottom:1px solid #e8edf4;width:38%;border-right:1px solid #e8edf4;">${k}</td><td style="padding:11px 16px;font-size:13px;color:#0f172a;font-weight:600;border-bottom:1px solid #e8edf4;">${v}</td></tr>`).join('')}</tbody></table>`;

            // 1. Send Author Confirmation Email
            const mailOptionsAuthor = {
                from: `"ScriptHive Publication" <${process.env.SUBMIT_SENDER_EMAIL || process.env.SENDER_EMAIL}>`,
                replyTo: 'info@scripthive.org',
                to: author_email,
                subject: `Manuscript Submission Received – ScriptHive Publication [ID: ${submissionId}]`,
                html: _shBase2('Manuscript Submission Received', `<p style="font-size:16px;color:#0f172a;font-weight:700;margin:0 0 6px;">Dear ${author_name},</p><p style="font-size:15px;color:#475569;margin:0 0 20px;line-height:1.6;">Thank you for submitting your research manuscript to <strong>${pickedJournalTitle}</strong>. We have successfully received your submission and it is now queued for editorial pre-screening followed by double-blind peer review.</p>${_shRows2([['Submission ID',`<span style="font-family:monospace;color:#1d4ed8;font-weight:800;">${submissionId}</span>`],['Journal',pickedJournalTitle],['Paper Title',paper_title],['Authors',authorsList.join(', ')],['Date & Time',timestamp],['Review Timeline','7–15 Working Days']])}<p style="font-size:14px;color:#475569;margin:0 0 8px;line-height:1.6;">Please keep your Submission ID safe — you'll need it to track your paper's status. For any queries, reply to this email with your Submission ID.</p><div style="margin-top:28px;border-top:2px solid #e8edf4;padding-top:20px;font-size:13px;color:#64748b;">Regards,<br/><strong style="color:#0f172a;">ScriptHive Editorial Team</strong><br/><a href="mailto:info@scripthive.org" style="color:#1d4ed8;text-decoration:none;">info@scripthive.org</a></div>`)
            };

            // 2. Send Admin Notification Email (with file attachment)
            const mailOptionsAdmin = {
                from: `"${author_name} (Paper Submit)" <${process.env.SUBMIT_SENDER_EMAIL || process.env.SENDER_EMAIL}>`,
                replyTo: author_email,
                to: 'info@scripthive.org',
                subject: `New Paper Submission: ${submissionId} | ${pickedJournalTitle}`,
                html: _shBase2('New Manuscript Submitted — Admin Alert', `<div style="background:#fff3cd;border-left:4px solid #f59e0b;padding:12px 16px;margin-bottom:24px;font-size:13px;color:#92400e;font-weight:600;">New submission received · IP: <span style="font-family:monospace;">${ip}</span> · ${timestamp}</div>${_shRows2([['Submission ID',`<span style="font-family:monospace;color:#1d4ed8;font-weight:800;">${submissionId}</span>`],['Journal',pickedJournalTitle],['Paper Title',`<strong>${paper_title}</strong>`],['Authors',authorsList.join(', ')],['Email',`<a href="mailto:${author_email}" style="color:#1d4ed8;text-decoration:none;">${author_email}</a>`],['Phone',author_phone||'Not provided'],['Keywords',`<span style="font-family:monospace;font-size:12px;">${keywords}</span>`]])}<div style="margin-top:20px;"><div style="background:#0f172a;padding:10px 16px;font-size:11px;font-weight:800;color:#93c5fd;letter-spacing:1.5px;text-transform:uppercase;">Abstract</div><div style="border:1px solid #dde3ed;border-top:none;padding:16px;font-size:14px;color:#334155;line-height:1.7;text-align:justify;">${abstract.replace(/\n/g,'<br/>')}</div></div><div style="margin-top:16px;background:#f0fdf4;border-left:4px solid #22c55e;padding:12px 16px;font-size:13px;color:#166534;font-weight:600;">Manuscript file attached to this email</div>`),
                attachments: [
                    {
                        filename: file.originalname,
                        path: file.path
                    }
                ]
            };

            // Respond immediately — don't block on emails
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

            // Only send emails from here if backend API forward FAILED
            // (backend already sends author confirmation + admin notification on success)
            const backendForwardedOk = submissionId && !submissionId.startsWith('SH-') ||
                (submissionId && submissionId.match(/^SH-\d{4}-[A-Z0-9]{4}$/) && !submissionId.includes('fallback'));
            // Simpler check: if submissionId was set from API response (not fallback), skip emails
            // We track this via a flag set during API forward
            if (!_backendForwardSuccess) {
                console.warn('[Email] Backend forward failed — sending fallback emails from client');
                Promise.all([
                    submitTransporter.sendMail(mailOptionsAuthor),
                    submitTransporter.sendMail(mailOptionsAdmin)
                ]).then(() => {
                    console.log('[Email] Fallback emails sent successfully');
                }).catch(err => console.error('[Email] Fallback send failed:', err.message));
            } else {
                console.log('[Email] Backend handled emails — skipping client duplicate send');
            }

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
        const _shBase = (ttl, body) => `<!DOCTYPE html><html><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head><body style="margin:0;padding:0;background:#eef2f7;font-family:'Segoe UI',Arial,sans-serif;"><table width="100%" cellpadding="0" cellspacing="0" style="background:#eef2f7;padding:40px 0;"><tr><td align="center"><table width="620" cellpadding="0" cellspacing="0" style="max-width:620px;width:100%;"><tr><td style="background:#1d4ed8;height:5px;font-size:0;">&nbsp;</td></tr><tr><td style="background:#0f172a;padding:36px 48px 28px;"><table width="100%" cellpadding="0" cellspacing="0"><tr><td><div style="font-size:24px;font-weight:800;color:#fff;letter-spacing:-0.5px;">ScriptHive Publication</div><div style="font-size:11px;color:#93c5fd;margin-top:5px;letter-spacing:2px;text-transform:uppercase;font-weight:600;">International Research Journals</div></td><td align="right" valign="middle"><div style="background:#1d4ed8;color:#fff;font-size:11px;font-weight:700;padding:5px 14px;letter-spacing:1px;text-transform:uppercase;">ISSN Supported</div></td></tr></table></td></tr><tr><td style="background:#1d4ed8;padding:16px 48px;"><div style="font-size:15px;font-weight:700;color:#fff;letter-spacing:0.3px;">${ttl}</div></td></tr><tr><td style="background:#fff;padding:44px 48px;border-left:1px solid #dde3ed;border-right:1px solid #dde3ed;">${body}</td></tr><tr><td style="background:#f1f5f9;border:1px solid #dde3ed;border-top:3px solid #1d4ed8;padding:28px 48px;"><div style="font-size:13px;font-weight:700;color:#0f172a;">ScriptHive Publication</div><div style="font-size:12px;color:#64748b;margin-top:3px;"><a href="https://scripthive.org" style="color:#1d4ed8;text-decoration:none;">scripthive.org</a>&nbsp;&middot;&nbsp;<a href="mailto:info@scripthive.org" style="color:#1d4ed8;text-decoration:none;">info@scripthive.org</a>&nbsp;&middot;&nbsp;+91 9899916683</div><div style="font-size:11px;color:#94a3b8;margin-top:12px;border-top:1px solid #e2e8f0;padding-top:12px;">Automated email. If unexpected, please ignore or contact us.</div></td></tr><tr><td style="background:#0f172a;height:4px;font-size:0;">&nbsp;</td></tr></table></td></tr></table></body></html>`;
        const _shRows = (rows) => `<table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #dde3ed;margin:24px 0;"><thead><tr><td colspan="2" style="background:#0f172a;padding:10px 16px;font-size:11px;font-weight:800;color:#93c5fd;letter-spacing:1.5px;text-transform:uppercase;">Details</td></tr></thead><tbody>${rows.map(([k,v],i)=>`<tr style="background:${i%2===0?'#f8fafc':'#fff'};"><td style="padding:11px 16px;font-size:12px;color:#64748b;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;border-bottom:1px solid #e8edf4;width:38%;border-right:1px solid #e8edf4;">${k}</td><td style="padding:11px 16px;font-size:13px;color:#0f172a;font-weight:600;border-bottom:1px solid #e8edf4;">${v}</td></tr>`).join('')}</tbody></table>`;

        const mailAdmin = {
            from: `"${name} via ScriptHive" <${process.env.SENDER_EMAIL}>`,
            replyTo: email,
            to: 'info@scripthive.org',
            subject: `New Query: ${subject} [${queryId}]`,
            html: _shBase('New Contact Inquiry', `<p style="font-size:15px;color:#0f172a;font-weight:700;margin:0 0 20px;">New contact query received via scripthive.org</p>${_shRows([['Query ID',`<span style="font-family:monospace;color:#1d4ed8;font-weight:800;">${queryId}</span>`],['Name',name],['Email',`<a href="mailto:${email}" style="color:#1d4ed8;text-decoration:none;">${email}</a>`],['Phone',phone||'—'],['Subject',subject]])}<div style="background:#f8fafc;border-left:4px solid #1d4ed8;padding:16px 20px;margin-top:8px;"><div style="font-size:11px;font-weight:800;color:#64748b;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">Message</div><div style="font-size:14px;color:#334155;line-height:1.7;">${message.replace(/\n/g,'<br/>')}</div></div>`)
        };
        const mailUser = {
            from: `"ScriptHive Publication" <${process.env.SENDER_EMAIL}>`,
            replyTo: 'info@scripthive.org',
            to: email,
            subject: `Query Received – ScriptHive [Ref: ${queryId}]`,
            html: _shBase('Query Received', `<p style="font-size:16px;color:#0f172a;font-weight:700;margin:0 0 6px;">Dear ${name},</p><p style="font-size:15px;color:#475569;margin:0 0 24px;line-height:1.6;">Thank you for reaching out to ScriptHive Publication. We have received your query and our team will respond within <strong>24–48 business hours</strong>.</p>${_shRows([['Reference ID',`<span style="font-family:monospace;color:#1d4ed8;font-weight:800;">${queryId}</span>`],['Subject',subject],['Status','Received — Under Review']])}<p style="font-size:13px;color:#64748b;margin:20px 0 0;line-height:1.6;">For urgent queries, reach us at <a href="mailto:info@scripthive.org" style="color:#1d4ed8;text-decoration:none;">info@scripthive.org</a> or call <strong>+91 9899916683</strong>.</p><div style="margin-top:28px;border-top:2px solid #e8edf4;padding-top:20px;font-size:13px;color:#64748b;">Regards,<br/><strong style="color:#0f172a;">ScriptHive Editorial Team</strong></div>`)
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
    if (!fs.existsSync(dir)) {
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

            const _shBase3 = (ttl, body) => `<!DOCTYPE html><html><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head><body style="margin:0;padding:0;background:#eef2f7;font-family:'Segoe UI',Arial,sans-serif;"><table width="100%" cellpadding="0" cellspacing="0" style="background:#eef2f7;padding:40px 0;"><tr><td align="center"><table width="620" cellpadding="0" cellspacing="0" style="max-width:620px;width:100%;"><tr><td style="background:#1d4ed8;height:5px;font-size:0;">&nbsp;</td></tr><tr><td style="background:#0f172a;padding:36px 48px 28px;"><table width="100%" cellpadding="0" cellspacing="0"><tr><td><div style="font-size:24px;font-weight:800;color:#fff;letter-spacing:-0.5px;">ScriptHive Publication</div><div style="font-size:11px;color:#93c5fd;margin-top:5px;letter-spacing:2px;text-transform:uppercase;font-weight:600;">International Research Journals</div></td><td align="right" valign="middle"><div style="background:#1d4ed8;color:#fff;font-size:11px;font-weight:700;padding:5px 14px;letter-spacing:1px;text-transform:uppercase;">ISSN Supported</div></td></tr></table></td></tr><tr><td style="background:#1d4ed8;padding:16px 48px;"><div style="font-size:15px;font-weight:700;color:#fff;letter-spacing:0.3px;">${ttl}</div></td></tr><tr><td style="background:#fff;padding:44px 48px;border-left:1px solid #dde3ed;border-right:1px solid #dde3ed;">${body}</td></tr><tr><td style="background:#f1f5f9;border:1px solid #dde3ed;border-top:3px solid #1d4ed8;padding:28px 48px;"><div style="font-size:13px;font-weight:700;color:#0f172a;">ScriptHive Publication</div><div style="font-size:12px;color:#64748b;margin-top:3px;"><a href="https://scripthive.org" style="color:#1d4ed8;text-decoration:none;">scripthive.org</a>&nbsp;&middot;&nbsp;<a href="mailto:info@scripthive.org" style="color:#1d4ed8;text-decoration:none;">info@scripthive.org</a>&nbsp;&middot;&nbsp;+91 9899916683</div><div style="font-size:11px;color:#94a3b8;margin-top:12px;border-top:1px solid #e2e8f0;padding-top:12px;">Automated email. If unexpected, please ignore or contact us.</div></td></tr><tr><td style="background:#0f172a;height:4px;font-size:0;">&nbsp;</td></tr></table></td></tr></table></body></html>`;
            const _shRows3 = (rows) => `<table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #dde3ed;margin:24px 0;"><thead><tr><td colspan="2" style="background:#0f172a;padding:10px 16px;font-size:11px;font-weight:800;color:#93c5fd;letter-spacing:1.5px;text-transform:uppercase;">Details</td></tr></thead><tbody>${rows.map(([k,v],i)=>`<tr style="background:${i%2===0?'#f8fafc':'#fff'};"><td style="padding:11px 16px;font-size:12px;color:#64748b;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;border-bottom:1px solid #e8edf4;width:38%;border-right:1px solid #e8edf4;">${k}</td><td style="padding:11px 16px;font-size:13px;color:#0f172a;font-weight:600;border-bottom:1px solid #e8edf4;">${v}</td></tr>`).join('')}</tbody></table>`;

            // 1. CONFIRMATION EMAIL TO APPLICANT
            const mailOptionsCandidate = {
                from: `"ScriptHive Editorial Team" <${process.env.EDITORIAL_SENDER_EMAIL || process.env.SENDER_EMAIL}>`,
                replyTo: 'editor@scripthive.org',
                to: email,
                subject: `Application Received – Editorial Board | ${pickedJournal}`,
                html: _shBase3('Editorial Board Application Received', `<p style="font-size:16px;color:#0f172a;font-weight:700;margin:0 0 6px;">Dear ${name},</p><p style="font-size:15px;color:#475569;margin:0 0 20px;line-height:1.6;">Thank you for applying to join the Editorial Board of <strong>${pickedJournal}</strong>. We have successfully received your application and supporting documents. Our editorial management team will review your profile and contact you within <strong>7–10 working days</strong>.</p>${_shRows3([['Application Ref',`<span style="font-family:monospace;color:#1d4ed8;font-weight:800;">${appId}</span>`],['Applied Journal',pickedJournal],['Name',name],['Degree',degree],['Institution',institution],['Current Post',post]])}<p style="font-size:13px;color:#64748b;margin:20px 0 0;line-height:1.6;">For any queries, reply to this email or contact <a href="mailto:editor@scripthive.org" style="color:#1d4ed8;text-decoration:none;">editor@scripthive.org</a></p><div style="margin-top:28px;border-top:2px solid #e8edf4;padding-top:20px;font-size:13px;color:#64748b;">Regards,<br/><strong style="color:#0f172a;">ScriptHive Editorial Team</strong></div>`)
            };

            // 2. ADMIN NOTIFICATION EMAIL TO info@scripthive.org (With physical file attachments from disk)
            const mailOptionsAdmin = {
                from: `"${name} (Editorial Apply)" <${process.env.EDITORIAL_SENDER_EMAIL || process.env.SENDER_EMAIL}>`,
                replyTo: email,
                to: 'info@scripthive.org',
                subject: `New Editorial Board Application – ${name} | ${pickedJournal}`,
                html: _shBase3('New Editorial Board Application — Admin Alert', `<div style="background:#fff3cd;border-left:4px solid #f59e0b;padding:12px 16px;margin-bottom:24px;font-size:13px;color:#92400e;font-weight:600;">New application received · IP: <span style="font-family:monospace;">${ip}</span> · ${timestamp}</div>${_shRows3([['Application Ref',`<span style="font-family:monospace;color:#1d4ed8;font-weight:800;">${appId}</span>`],['Journal',pickedJournal],['Full Name',name],['Email',`<a href="mailto:${email}" style="color:#1d4ed8;text-decoration:none;">${email}</a>`],['Phone',phone],['Degree',degree],['Institution',institution],['Post',post]])}<div style="margin-top:16px;background:#f0fdf4;border-left:4px solid #22c55e;padding:12px 16px;font-size:13px;color:#166534;font-weight:600;">Resume &amp; photo files attached to this email</div>`),
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

