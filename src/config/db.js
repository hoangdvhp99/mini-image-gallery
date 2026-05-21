const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', '..', 'data', 'db.json');
const IDEAS_PATH = path.join(__dirname, '..', '..', 'data', 'ideas.json');
const UPLOAD_DIR = path.join(__dirname, '..', '..', 'public', 'uploads');

// Khởi tạo các thư mục và file db nếu chưa tồn tại
if (!fs.existsSync(path.join(__dirname, '..', '..', 'data'))) {
    fs.mkdirSync(path.join(__dirname, '..', '..', 'data'));
}
if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR);
}
if (!fs.existsSync(DB_PATH)) {
    fs.writeFileSync(DB_PATH, JSON.stringify([]));
}
if (!fs.existsSync(IDEAS_PATH)) {
    fs.writeFileSync(IDEAS_PATH, JSON.stringify([]));
}

function readDB() {
    return JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
}

function writeDB(data) {
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}

function readIdeasDB() {
    return JSON.parse(fs.readFileSync(IDEAS_PATH, 'utf8'));
}

function writeIdeasDB(data) {
    fs.writeFileSync(IDEAS_PATH, JSON.stringify(data, null, 2));
}

module.exports = {
    DB_PATH,
    IDEAS_PATH,
    UPLOAD_DIR,
    readDB,
    writeDB,
    readIdeasDB,
    writeIdeasDB
};
