const fs = require('fs');
const path = require('path');

// Target file names
const DB_FILE = path.join(__dirname, 'database.sqlite');
const FALLBACK_FILE = path.join(__dirname, 'submissions.json');

let sqlite3;
let db = null;
let useJsonFallback = false;

// Attempt to load sqlite3
try {
    sqlite3 = require('sqlite3').verbose();
    console.log('Successfully loaded sqlite3 module.');
} catch (err) {
    console.warn('sqlite3 module loading failed. Falling back to JSON database storage:', err.message);
    useJsonFallback = true;
}

// Initialize database
function initDatabase() {
    if (useJsonFallback) {
        initJsonDatabase();
        return;
    }

    try {
        db = new sqlite3.Database(DB_FILE, (err) => {
            if (err) {
                console.error('Failed to open SQLite database, falling back to JSON:', err.message);
                useJsonFallback = true;
                initJsonDatabase();
            } else {
                console.log('Connected to SQLite database.');
                createTable();
            }
        });
    } catch (err) {
        console.error('Error during SQLite initialization, falling back to JSON:', err.message);
        useJsonFallback = true;
        initJsonDatabase();
    }
}

// Create Submissions Table
function createTable() {
    const query = `
        CREATE TABLE IF NOT EXISTS submissions (
            id TEXT PRIMARY KEY,
            author_name TEXT NOT NULL,
            email TEXT NOT NULL,
            phone TEXT,
            journal TEXT NOT NULL,
            title TEXT NOT NULL,
            abstract TEXT NOT NULL,
            keywords TEXT NOT NULL,
            filename TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'Submitted',
            submitted_at TEXT NOT NULL
        )
    `;
    db.run(query, (err) => {
        if (err) {
            console.error('Error creating submissions table, switching to JSON fallback:', err.message);
            useJsonFallback = true;
            initJsonDatabase();
        } else {
            console.log('Submissions table is ready.');
        }
    });
}

// Initialize JSON database fallback
function initJsonDatabase() {
    if (!fs.existsSync(FALLBACK_FILE)) {
        try {
            fs.writeFileSync(FALLBACK_FILE, JSON.stringify([], null, 2), 'utf8');
            console.log('Initialized empty JSON database fallback.');
        } catch (err) {
            console.error('Fatal: Failed to write JSON database file:', err.message);
        }
    } else {
        console.log('JSON database fallback file verified.');
    }
}

// Save Submission
function saveSubmission(submission) {
    return new Promise((resolve, reject) => {
        const {
            id,
            author_name,
            email,
            phone = '',
            journal,
            title,
            abstract,
            keywords,
            filename,
            status = 'Submitted',
            submitted_at = new Date().toLocaleString()
        } = submission;

        if (useJsonFallback) {
            try {
                // Thread-safe / Atomic write fallback
                const fileData = fs.readFileSync(FALLBACK_FILE, 'utf8');
                const submissions = JSON.parse(fileData || '[]');
                
                const newRecord = {
                    id,
                    author_name,
                    email,
                    phone,
                    journal,
                    title,
                    abstract,
                    keywords,
                    filename,
                    status,
                    submitted_at
                };

                submissions.push(newRecord);
                
                // Write atomically to temporary file first, then rename
                const tempFile = `${FALLBACK_FILE}.tmp`;
                fs.writeFileSync(tempFile, JSON.stringify(submissions, null, 2), 'utf8');
                fs.renameSync(tempFile, FALLBACK_FILE);

                console.log(`Saved submission ${id} to JSON database.`);
                resolve(newRecord);
            } catch (err) {
                console.error('Failed to save submission to JSON database:', err);
                reject(err);
            }
        } else {
            const query = `
                INSERT INTO submissions (id, author_name, email, phone, journal, title, abstract, keywords, filename, status, submitted_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;
            db.run(
                query,
                [id, author_name, email, phone, journal, title, abstract, keywords, filename, status, submitted_at],
                function (err) {
                    if (err) {
                        console.error(`Failed to insert submission ${id} into SQLite:`, err.message);
                        reject(err);
                    } else {
                        console.log(`Saved submission ${id} to SQLite database.`);
                        resolve({
                            id,
                            author_name,
                            email,
                            phone,
                            journal,
                            title,
                            abstract,
                            keywords,
                            filename,
                            status,
                            submitted_at
                        });
                    }
                }
            );
        }
    });
}

// Get Submission by ID
function getSubmission(id) {
    return new Promise((resolve, reject) => {
        if (useJsonFallback) {
            try {
                const fileData = fs.readFileSync(FALLBACK_FILE, 'utf8');
                const submissions = JSON.parse(fileData || '[]');
                const found = submissions.find(s => s.id === id);
                resolve(found || null);
            } catch (err) {
                reject(err);
            }
        } else {
            const query = `SELECT * FROM submissions WHERE id = ?`;
            db.get(query, [id], (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(row || null);
                }
            });
        }
    });
}

// Get all submissions
function getAllSubmissions() {
    return new Promise((resolve, reject) => {
        if (useJsonFallback) {
            try {
                const fileData = fs.readFileSync(FALLBACK_FILE, 'utf8');
                const submissions = JSON.parse(fileData || '[]');
                resolve(submissions);
            } catch (err) {
                reject(err);
            }
        } else {
            const query = `SELECT * FROM submissions ORDER BY submitted_at DESC`;
            db.all(query, [], (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows || []);
                }
            });
        }
    });
}

// Initialize right away
initDatabase();

module.exports = {
    saveSubmission,
    getSubmission,
    getAllSubmissions,
    isFallback: () => useJsonFallback
};
