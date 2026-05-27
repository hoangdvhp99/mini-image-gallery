const fs = require('fs');
const path = require('path');

const logFilePath = path.join(__dirname, '..', '..', 'data', 'upload_history.log');

// Khởi tạo thư mục data nếu chưa tồn tại
const dataDir = path.dirname(logFilePath);
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

function logUpload(req, filename, originalname, type) {
    try {
        let ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '';
        if (ip.includes('::ffff:')) {
            ip = ip.split('::ffff:')[1];
        }
        if (ip === '::1') {
            ip = '127.0.0.1';
        }
        
        const timestamp = new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
        const logLine = `[${timestamp}] IP: ${ip} | Type: ${type} | Original Name: "${originalname}" | Saved Name: "${filename}"\n`;
        
        fs.appendFileSync(logFilePath, logLine, 'utf8');
        console.log(`[Upload-Log] ${logLine.trim()}`);
    } catch (e) {
        console.error('Lỗi khi ghi file log upload:', e);
    }
}

module.exports = {
    logUpload
};
