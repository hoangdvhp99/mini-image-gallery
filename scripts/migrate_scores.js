const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const dataDir = path.join(__dirname, '..', 'data');
const dbPath = path.join(dataDir, 'database.sqlite');
const db = new Database(dbPath);

console.log('Bắt đầu migrate dữ liệu bảng xếp hạng sang SQLite...');

const readJSON = (filename) => {
    const file = path.join(dataDir, filename);
    if (fs.existsSync(file)) {
        try {
            return JSON.parse(fs.readFileSync(file, 'utf8'));
        } catch (e) {
            return [];
        }
    }
    return [];
};

const dinoScores = readJSON('dino_scores.json');
const pikabeoScores = readJSON('pikabeo_scores.json');

console.log(`Đã đọc được ${dinoScores.length} lượt chơi Dino và ${pikabeoScores.length} lượt chơi PikaBeo.`);

// Migrate Dino
if (dinoScores.length > 0) {
    const insertDino = db.prepare('INSERT OR IGNORE INTO dino_scores (id, playerName, score, timestamp) VALUES (?, ?, ?, ?)');
    const insertDinoTx = db.transaction((items) => {
        for (const item of items) {
            insertDino.run(item.id, item.playerName, item.score, item.timestamp || item.id);
        }
    });
    insertDinoTx(dinoScores);
    console.log('✅ Chuyển đổi dữ liệu Dino thành công!');
}

// Migrate PikaBeo
if (pikabeoScores.length > 0) {
    const insertPikabeo = db.prepare('INSERT OR IGNORE INTO pikabeo_scores (id, playerName, score, level, timePlayed, hintsUsed, shufflesUsed, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
    const insertPikabeoTx = db.transaction((items) => {
        for (const item of items) {
            insertPikabeo.run(
                item.id, 
                item.playerName, 
                item.score, 
                item.level || 1, 
                item.timePlayed || 0, 
                item.hintsUsed || 0, 
                item.shufflesUsed || 0, 
                item.timestamp || item.id
            );
        }
    });
    insertPikabeoTx(pikabeoScores);
    console.log('✅ Chuyển đổi dữ liệu PikaBeo thành công!');
}

console.log('🎉 Quá trình Migrate Bảng Xếp Hạng hoàn tất!');
