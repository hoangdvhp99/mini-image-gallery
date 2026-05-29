const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const UPLOAD_DIR = path.join(__dirname, '..', '..', 'public', 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}
const dataDir = path.join(__dirname, '..', '..', 'data');
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

const db = new Database(path.join(dataDir, 'database.sqlite'));

db.pragma('journal_mode = WAL');

db.exec(`
    CREATE TABLE IF NOT EXISTS media (
        name TEXT PRIMARY KEY,
        url TEXT,
        hashtags TEXT,
        description TEXT,
        category TEXT,
        likes INTEGER DEFAULT 0,
        hahas INTEGER DEFAULT 0,
        comments TEXT,
        uploadedAt TEXT
    );
    CREATE TABLE IF NOT EXISTS ideas (
        id TEXT PRIMARY KEY,
        author TEXT,
        title TEXT,
        description TEXT,
        hashtags TEXT,
        likes INTEGER DEFAULT 0,
        createdAt TEXT
    );
    CREATE TABLE IF NOT EXISTS admins (
        username TEXT PRIMARY KEY,
        password TEXT
    );
    CREATE TABLE IF NOT EXISTS donations (
        id INTEGER PRIMARY KEY,
        name TEXT,
        amount TEXT,
        message TEXT,
        timestamp INTEGER
    );
    CREATE TABLE IF NOT EXISTS secrets (
        name TEXT PRIMARY KEY,
        url TEXT,
        timestamp INTEGER
    );
    CREATE TABLE IF NOT EXISTS visits (
        ip TEXT PRIMARY KEY,
        count INTEGER DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS news (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT,
        content TEXT,
        image_url TEXT,
        created_at INTEGER
    );
    CREATE TABLE IF NOT EXISTS dino_scores (
        id TEXT PRIMARY KEY,
        playerName TEXT,
        score INTEGER,
        timestamp INTEGER
    );
    CREATE TABLE IF NOT EXISTS pikabeo_scores (
        id INTEGER PRIMARY KEY,
        playerName TEXT,
        score INTEGER,
        level INTEGER,
        timePlayed INTEGER,
        hintsUsed INTEGER,
        shufflesUsed INTEGER,
        timestamp INTEGER
    );
    CREATE TABLE IF NOT EXISTS qanda (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT,
        title TEXT,
        description TEXT,
        imageUrl TEXT,
        reply TEXT,
        createdAt INTEGER,
        repliedAt INTEGER
    );
    CREATE TABLE IF NOT EXISTS game_settings (
        game_id TEXT PRIMARY KEY,
        is_active INTEGER DEFAULT 0
    );
`);

// Insert default game settings
db.prepare('INSERT OR IGNORE INTO game_settings (game_id, is_active) VALUES (?, ?)').run('pikabeo', 1);
db.prepare('INSERT OR IGNORE INTO game_settings (game_id, is_active) VALUES (?, ?)').run('dino', 1);
db.prepare('INSERT OR IGNORE INTO game_settings (game_id, is_active) VALUES (?, ?)').run('dobeo', 1);
db.prepare('INSERT OR IGNORE INTO game_settings (game_id, is_active) VALUES (?, ?)').run('caro', 0);

// Insert default admin if not exists
const bcrypt = require('bcryptjs');
const adminCount = db.prepare('SELECT count(*) as count FROM admins').get().count;
if (adminCount === 0) {
    const defaultPasswordHash = bcrypt.hashSync('BeoHub_Admin_99@Secure!#', 10);
    db.prepare('INSERT INTO admins (username, password) VALUES (?, ?)').run('admin', defaultPasswordHash);
}

// Tự động dọn dẹp các điểm số hack từ các phiên bản cũ trước khi bảo mật được thiết lập
try {
    db.prepare('DELETE FROM dino_scores WHERE score > 50000').run();
    db.prepare('DELETE FROM pikabeo_scores WHERE score > 100000').run();
} catch (e) {
    console.error('Lỗi khi dọn dẹp kỷ lục cũ:', e);
}

module.exports = {
    db,
    UPLOAD_DIR
};
