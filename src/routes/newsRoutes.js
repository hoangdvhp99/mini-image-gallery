const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { db } = require('../config/db');
const { removeVietnameseTones } = require('../utils/vietnamese');

const newsDir = path.join(__dirname, '..', '..', 'public', 'uploads', 'news');
if (!fs.existsSync(newsDir)) {
    fs.mkdirSync(newsDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, newsDir),
    filename: (req, file, cb) => {
        const originalName = Buffer.from(file.originalname, 'latin1').toString('utf8');
        const cleanName = removeVietnameseTones(originalName).replace(/[^a-zA-Z0-9.\-_]/g, '');
        cb(null, Date.now() + '-' + cleanName);
    }
});

const uploadNews = multer({
    storage: storage,
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Chỉ chấp nhận định dạng Ảnh cho tin tức!'));
        }
    }
});

// Lấy danh sách tin tức (công khai)
router.get('/', (req, res) => {
    try {
        const news = db.prepare('SELECT * FROM news ORDER BY created_at DESC').all();
        res.json({ success: true, news });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// Thêm tin tức mới (chỉ Admin)
router.post('/', uploadNews.single('image'), (req, res) => {
    if (!req.session || !req.session.isAdmin) {
        return res.status(403).json({ success: false, message: 'Từ chối truy cập!' });
    }
    
    const { title, content } = req.body;
    if (!title || !content) {
        return res.status(400).json({ success: false, message: 'Thiếu tiêu đề hoặc nội dung!' });
    }
    
    let imageUrl = '';
    if (req.file) {
        imageUrl = `/uploads/news/${req.file.filename}`;
    }

    try {
        const stmt = db.prepare('INSERT INTO news (title, content, image_url, created_at) VALUES (?, ?, ?, ?)');
        const info = stmt.run(title, content, imageUrl, Date.now());
        
        res.json({ success: true, message: 'Đăng tin tức thành công!', id: info.lastInsertRowid });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// Xóa tin tức (chỉ Admin)
router.delete('/:id', (req, res) => {
    if (!req.session || !req.session.isAdmin) {
        return res.status(403).json({ success: false, message: 'Từ chối truy cập!' });
    }
    
    const id = req.params.id;
    try {
        const newsItem = db.prepare('SELECT image_url FROM news WHERE id = ?').get(id);
        if (newsItem && newsItem.image_url) {
            const filename = path.basename(newsItem.image_url);
            const filePath = path.join(newsDir, filename);
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
        }
        
        db.prepare('DELETE FROM news WHERE id = ?').run(id);
        res.json({ success: true, message: 'Xóa tin tức thành công!' });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

module.exports = router;
