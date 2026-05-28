const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '../data/database.sqlite');
const db = new Database(dbPath);

try {
    db.prepare('DELETE FROM pikabeo_scores').run();
    console.log('✅ Đã reset thành công bảng xếp hạng PikaBeo (SQLite)!');
} catch (error) {
    console.error('❌ Lỗi khi reset bảng xếp hạng PikaBeo:', error);
}
