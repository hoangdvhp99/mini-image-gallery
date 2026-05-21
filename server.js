const express = require('express');

const app = express();
const PORT = 3000;

// Khởi chạy việc tạo database và thư mục nếu cần thông qua việc import db config
require('./src/config/db');

// Import router
const mediaRouter = require('./src/routes/mediaRoutes');

// Middlewares
app.use(express.json());
app.use(express.static('public'));

// Cấu hình các route API
app.use('/api', mediaRouter);

// Khởi chạy server
app.listen(PORT, '0.0.0.0', () => {
    console.log(`=====================================================`);
    console.log(` 🖤 🔶  HỆ THỐNG TRUY CẬP MEDIA BEOHUB ĐANG HOẠT ĐỘNG 🔶 🖤`);
    console.log(`=====================================================`);
    console.log(` http://localhost:${PORT}`);
});