const multer = require('multer');
const path = require('path');
const { removeVietnameseTones } = require('../utils/vietnamese');
const { UPLOAD_DIR } = require('../config/db');

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, UPLOAD_DIR),
    filename: (req, file, cb) => {
        const originalName = Buffer.from(file.originalname, 'latin1').toString('utf8');
        cb(null, 'tmp-' + Date.now() + '-' + removeVietnameseTones(originalName));
    }
});

const upload = multer({
    storage: storage,
    fileFilter: (req, file, cb) => {
        const isImage = file.mimetype.startsWith('image/');
        const isVideo = file.mimetype.startsWith('video/');
        
        if (!isImage && !isVideo) {
            return cb(new Error('Chỉ chấp nhận định dạng Ảnh hoặc Video!'), false);
        }
        
        const ext = path.extname(file.originalname).toLowerCase();
        const safeImageExts = ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg', '.bmp'];
        const safeVideoExts = ['.mp4', '.webm', '.ogg', '.mov', '.avi', '.mkv'];
        
        const isSafeImage = isImage && safeImageExts.includes(ext);
        const isSafeVideo = isVideo && safeVideoExts.includes(ext);
        
        if (!isSafeImage && !isSafeVideo) {
            return cb(new Error('Tệp tải lên không hợp lệ hoặc chứa đuôi mở rộng có nguy cơ độc hại!'), false);
        }
        
        cb(null, true);
    }
});

module.exports = upload;
