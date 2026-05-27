const express = require('express');
const bcrypt = require('bcryptjs');
const { db } = require('../config/db');

const router = express.Router();

// Route Đăng nhập
router.post('/login', (req, res) => {
    const { username, password } = req.body;
    
    if (!username || !password) {
        return res.status(400).json({ success: false, message: 'Vui lòng nhập đầy đủ tên đăng nhập và mật khẩu!' });
    }

    try {
        const adminUser = db.prepare('SELECT * FROM admins WHERE username = ?').get(username);

        if (!adminUser) {
            return res.status(401).json({ success: false, message: 'Sai tên đăng nhập hoặc mật khẩu!' });
        }

        const isMatch = bcrypt.compareSync(password, adminUser.password);
        if (!isMatch) {
            return res.status(401).json({ success: false, message: 'Sai tên đăng nhập hoặc mật khẩu!' });
        }

        // Lưu session
        req.session.isAdmin = true;
        req.session.username = adminUser.username;

        res.json({ success: true, message: 'Đăng nhập thành công!' });
    } catch (e) {
        console.error('Lỗi khi đăng nhập:', e);
        res.status(500).json({ success: false, message: 'Lỗi hệ thống!' });
    }
});

// Route Đăng xuất
router.post('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            return res.status(500).json({ success: false, message: 'Không thể đăng xuất!' });
        }
        res.clearCookie('connect.sid');
        res.json({ success: true, message: 'Đăng xuất thành công!' });
    });
});

// Kiểm tra trạng thái đăng nhập
router.get('/me', (req, res) => {
    if (req.session && req.session.isAdmin) {
        res.json({ success: true, isAdmin: true, username: req.session.username });
    } else {
        res.json({ success: true, isAdmin: false });
    }
});

module.exports = router;
