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
        if (file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/')) {
            cb(null, true);
        } else {
            cb(new Error('Chỉ chấp nhận định dạng Ảnh hoặc Video!'));
        }
    }
});

module.exports = upload;
