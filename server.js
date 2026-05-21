const express = require('express');

const app = express();
const PORT = 3000;

// Khởi chạy việc tạo database và thư mục nếu cần thông qua việc import db config
require('./src/config/db');

// Import router
const mediaRouter = require('./src/routes/mediaRoutes');
const ideaRouter = require('./src/routes/ideaRoutes');

// Middlewares
app.use(express.json());
app.use(express.static('public'));

// Cấu hình các route API
app.use('/api', mediaRouter);
app.use('/api/ideas', ideaRouter);

let latestDonation = null;

app.post('/api/donate/alert', (req, res) => {
    if (req.query.isLbeo !== '0') {
        return res.status(403).json({ success: false, message: 'Từ chối!' });
    }
    const { name, amount, message } = req.body;
    latestDonation = {
        id: Date.now(),
        name: name || 'Ẩn danh',
        amount: amount || '0 VND',
        message: message || '',
        timestamp: Date.now()
    };
    res.json({ success: true });
});

app.get('/api/donate/latest', (req, res) => {
    res.json({ success: true, latest: latestDonation });
});

// Khởi chạy server
app.listen(PORT, '0.0.0.0', () => {
    console.log(`=====================================================`);
    console.log(` 🖤 🔶  HỆ THỐNG TRUY CẬP MEDIA BEOHUB ĐANG HOẠT ĐỘNG 🔶 🖤`);
    console.log(`=====================================================`);
    console.log(` http://localhost:${PORT}`);
});