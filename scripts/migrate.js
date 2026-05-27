const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const dataDir = path.join(__dirname, '..', 'data');
const dbPath = path.join(dataDir, 'database.sqlite');
const db = new Database(dbPath);

console.log('Khởi tạo cấu trúc Database SQLite...');

// Tạo bảng
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
`);

const readJSON = (filename, defaultVal) => {
    const file = path.join(dataDir, filename);
    if (fs.existsSync(file)) {
        try {
            return JSON.parse(fs.readFileSync(file, 'utf8'));
        } catch (e) {
            return defaultVal;
        }
    }
    return defaultVal;
};

console.log('Đang đọc dữ liệu JSON cũ...');
const mediaData = readJSON('db.json', []);
const ideasData = readJSON('ideas.json', []);
const adminsData = readJSON('admins.json', []);
const donationsData = readJSON('donations.json', []);
const secretsData = readJSON('secrets.json', []);
const visitsData = readJSON('visits.json', {});

console.log('Chuyển đổi dữ liệu Media...');
const insertMedia = db.prepare('INSERT OR REPLACE INTO media (name, url, hashtags, description, category, likes, hahas, comments, uploadedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
const insertMediaTx = db.transaction((items) => {
    for (const item of items) {
        insertMedia.run(
            item.name,
            item.url,
            JSON.stringify(item.hashtags || []),
            item.description || '',
            item.category || 'home',
            item.likes || 0,
            item.hahas || 0,
            JSON.stringify(item.comments || []),
            item.uploadedAt || new Date().toISOString()
        );
    }
});
insertMediaTx(mediaData);

console.log('Chuyển đổi dữ liệu Ideas...');
const insertIdea = db.prepare('INSERT OR REPLACE INTO ideas (id, author, title, description, hashtags, likes, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)');
const insertIdeaTx = db.transaction((items) => {
    for (const item of items) {
        insertIdea.run(
            item.id,
            item.author,
            item.title,
            item.description,
            JSON.stringify(item.hashtags || []),
            item.likes || 0,
            item.createdAt || new Date().toISOString()
        );
    }
});
insertIdeaTx(ideasData);

console.log('Chuyển đổi dữ liệu Admins...');
const insertAdmin = db.prepare('INSERT OR REPLACE INTO admins (username, password) VALUES (?, ?)');
const insertAdminTx = db.transaction((items) => {
    for (const item of items) {
        insertAdmin.run(item.username, item.password);
    }
});
insertAdminTx(adminsData);

console.log('Chuyển đổi dữ liệu Donations...');
const insertDonation = db.prepare('INSERT INTO donations (name, amount, message, timestamp) VALUES (?, ?, ?, ?)');
const insertDonationTx = db.transaction((items) => {
    for (const item of items) {
        insertDonation.run(
            item.name,
            item.amount, // some might be number or string formatted
            item.message,
            item.timestamp || Date.now()
        );
    }
});
insertDonationTx(donationsData);

console.log('Chuyển đổi dữ liệu Secrets...');
const insertSecret = db.prepare('INSERT OR REPLACE INTO secrets (name, url, timestamp) VALUES (?, ?, ?)');
const insertSecretTx = db.transaction((items) => {
    for (const item of items) {
        insertSecret.run(item.name, item.url, item.timestamp || Date.now());
    }
});
insertSecretTx(secretsData);

console.log('Chuyển đổi dữ liệu Visits...');
const insertVisit = db.prepare('INSERT OR REPLACE INTO visits (ip, count) VALUES (?, ?)');
const insertVisitTx = db.transaction((visitsObj) => {
    for (const ip in visitsObj) {
        insertVisit.run(ip, visitsObj[ip]);
    }
});
insertVisitTx(visitsData);

console.log('✅ Chuyển đổi hoàn tất thành công!');
