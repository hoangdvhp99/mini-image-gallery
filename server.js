const express = require('express');
const fs = require('fs');
const path = require('path');

// Đọc file .env nếu có để tải các biến môi trường (như PORT) khi chạy trực tiếp
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
    try {
        const envContent = fs.readFileSync(envPath, 'utf8');
        envContent.split('\n').forEach(line => {
            const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
            if (match) {
                const key = match[1];
                let value = match[2] ? match[2].trim() : '';
                if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
                else if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
                if (!process.env[key]) process.env[key] = value;
            }
        });
    } catch (e) {
        console.error('Không thể đọc file .env:', e);
    }
}

const app = express();
const PORT = process.env.PORT || 3000;

// Khởi chạy việc tạo database và thư mục nếu cần thông qua việc import db config
require('./src/config/db');

// Import router
const mediaRouter = require('./src/routes/mediaRoutes');
const ideaRouter = require('./src/routes/ideaRoutes');

// Đường dẫn lưu trữ IP truy cập
const visitsPath = path.join(__dirname, 'data', 'visits.json');
if (!fs.existsSync(visitsPath)) {
    fs.writeFileSync(visitsPath, JSON.stringify({}));
}

// MẢNG CHỨA CÁC IP BỎ QUA KHÔNG GHI NHẬN (Hãy thêm/sửa các IP bạn muốn bỏ qua tại đây!)
const IGNORED_IPS = [
    '172.16.1.100', // Máy của bạn
    '127.0.0.1',    // Localhost
    '::1',          // Localhost IPv6
    '::ffff:127.0.0.1',
    '::ffff:172.16.1.100'
];

// Middleware tự động đếm lượt truy cập của các IP khách
app.use((req, res, next) => {
    if (req.path === '/' || req.path === '/index.html') {
        let ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '';
        
        // Chuẩn hóa định dạng IP
        if (ip.includes('::ffff:')) {
            ip = ip.split('::ffff:')[1];
        }
        if (ip === '::1') {
            ip = '127.0.0.1';
        }

        // Chỉ đếm nếu IP hợp lệ và không nằm trong mảng bỏ qua
        if (ip && !IGNORED_IPS.includes(ip)) {
            try {
                let visits = {};
                if (fs.existsSync(visitsPath)) {
                    visits = JSON.parse(fs.readFileSync(visitsPath, 'utf8'));
                }
                visits[ip] = (visits[ip] || 0) + 1;
                fs.writeFileSync(visitsPath, JSON.stringify(visits, null, 2));
            } catch (e) {
                console.error('Lỗi khi ghi nhận lượt truy cập IP:', e);
            }
        }
    }
    next();
});

// Middlewares
app.use(express.json());
app.use(express.static('public'));

// Cấu hình các route API
app.use('/api', mediaRouter);
app.use('/api/ideas', ideaRouter);

// Đường dẫn file lưu trữ lời nhắn donate
const donationsPath = path.join(__dirname, 'data', 'donations.json');
if (!fs.existsSync(donationsPath)) {
    fs.writeFileSync(donationsPath, JSON.stringify([]));
}

let latestDonation = null;

app.post('/api/donate/alert', (req, res) => {
    if (req.query.isLbeo !== '0') {
        return res.status(403).json({ success: false, message: 'Từ chối!' });
    }
    const { name, amount, message } = req.body;
    
    // Phát sóng tức thì bằng tay
    latestDonation = {
        id: Date.now(),
        name: name || 'Ẩn danh',
        amount: amount || '0 VND',
        message: message || '',
        timestamp: Date.now()
    };

    // Lưu trữ thông tin quyên góp để phát sóng tự động về sau
    try {
        let savedDonations = [];
        if (fs.existsSync(donationsPath)) {
            savedDonations = JSON.parse(fs.readFileSync(donationsPath, 'utf8'));
        }
        savedDonations.push({
            name: name || 'Ẩn danh',
            message: message || ''
        });
        fs.writeFileSync(donationsPath, JSON.stringify(savedDonations, null, 2));
    } catch (e) {
        console.error('Lỗi khi lưu thông tin donate:', e);
    }

    res.json({ success: true });
});

app.get('/api/donate/latest', (req, res) => {
    res.json({ success: true, latest: latestDonation });
});

app.get('/api/visits/leaderboard', (req, res) => {
    if (req.query.isLbeo !== '0') {
        return res.status(403).json({ success: false, message: 'Từ chối!' });
    }
    try {
        let visits = {};
        if (fs.existsSync(visitsPath)) {
            visits = JSON.parse(fs.readFileSync(visitsPath, 'utf8'));
        }
        
        // Chuyển đổi đối tượng sang mảng và sắp xếp số lượt truy cập giảm dần
        const leaderboard = Object.keys(visits).map(ip => ({
            ip: ip,
            count: visits[ip]
        })).sort((a, b) => b.count - a.count);

        res.json({ success: true, leaderboard });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// Thiết lập vòng lặp phát sóng tự động mỗi 3 phút (180000ms)
setInterval(() => {
    try {
        if (!fs.existsSync(donationsPath)) return;
        const savedDonations = JSON.parse(fs.readFileSync(donationsPath, 'utf8'));
        if (savedDonations.length === 0) return;

        // Chọn ngẫu nhiên một thông điệp từ danh sách đã lưu
        const randomIndex = Math.floor(Math.random() * savedDonations.length);
        const selected = savedDonations[randomIndex];

        // Tạo số tiền ngẫu nhiên từ 1.000đ đến 1.111.111đ
        const minAmount = 1000;
        const maxAmount = 1111111;
        const randomVal = Math.floor(Math.random() * (maxAmount - minAmount + 1)) + minAmount;
        const formattedAmount = randomVal.toLocaleString('vi-VN') + ' VND';

        // Cập nhật phát sóng tự động toàn dân
        latestDonation = {
            id: Date.now(),
            name: selected.name || 'Ẩn danh',
            amount: formattedAmount,
            message: selected.message || '',
            timestamp: Date.now()
        };
        console.log(`[Auto-Donate] Phát sóng tự động: ${selected.name} - ${formattedAmount} - ${selected.message}`);
    } catch (e) {
        console.error('Lỗi trong vòng lặp phát sóng tự động:', e);
    }
}, 180000);

// Khởi chạy server
app.listen(PORT, '0.0.0.0', () => {
    console.log(`=====================================================`);
    console.log(` 🖤 🔶  HỆ THỐNG TRUY CẬP MEDIA BEOHUB ĐANG HOẠT ĐỘNG 🔶 🖤`);
    console.log(`=====================================================`);
    console.log(` http://localhost:${PORT}`);
});