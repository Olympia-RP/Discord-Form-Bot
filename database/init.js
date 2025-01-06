const sqlite3 = require('sqlite3').verbose();

const db = new sqlite3.Database('./database/forms.db', (err) => {
    if (err) {
        console.error('Error connecting to database:', err);
    } else {
        console.log('Connected to database');
        initializeDatabase();
    }
});

function initializeDatabase() {
    db.serialize(() => {
        db.run(`CREATE TABLE IF NOT EXISTS form_templates (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            guild_id TEXT,
            name TEXT,
            fields TEXT,
            form_channel_id TEXT,
            response_channel_id TEXT,
            public_channel_id TEXT,
            form_type TEXT DEFAULT 'private',
            requires_approval BOOLEAN DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`);

        db.run(`CREATE TABLE IF NOT EXISTS submitted_forms (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            template_id INTEGER,
            user_id TEXT,
            responses TEXT,
            status TEXT DEFAULT 'pending',
            response_reason TEXT,
            responded_by TEXT,
            submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            responded_at TIMESTAMP,
            public_message_id TEXT,
            upvotes INTEGER DEFAULT 0,
            downvotes INTEGER DEFAULT 0,
            FOREIGN KEY(template_id) REFERENCES form_templates(id)
        )`);

        db.run(`CREATE TABLE IF NOT EXISTS form_votes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            submission_id INTEGER,
            user_id TEXT,
            vote_type TEXT,
            voted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(submission_id) REFERENCES submitted_forms(id),
            UNIQUE(submission_id, user_id)
        )`);
    });
}

module.exports = db; 