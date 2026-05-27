const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const session = require('express-session');

// Cấu hình đường dẫn cho Ảnh Bí Mật Pikabeo
const { db } = require('./src/config/db');

// Cấu hình đường dẫn cho Điểm số Pikabeo
const pikabeoScoresPath = path.join(__dirname, 'data', 'pikabeo_scores.json');
if (!fs.existsSync(pikabeoScoresPath)) {
    fs.writeFileSync(pikabeoScoresPath, JSON.stringify([]));
}

const secretsDir = path.join(__dirname, 'public', 'uploads', 'secrets');
if (!fs.existsSync(secretsDir)) {
    fs.mkdirSync(secretsDir, { recursive: true });
}

// Cấu hình Multer để lưu trữ Ảnh Bí Mật
const secretsStorage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, secretsDir),
    filename: (req, file, cb) => {
        const originalName = Buffer.from(file.originalname, 'latin1').toString('utf8');
        const cleanName = originalName.replace(/[^a-zA-Z0-9.\-_]/g, '');
        cb(null, Date.now() + '-' + cleanName);
    }
});

const uploadSecret = multer({
    storage: secretsStorage,
    fileFilter: (req, file, cb) => {
        const isImage = file.mimetype.startsWith('image/');
        const ext = path.extname(file.originalname).toLowerCase();
        const safeImageExts = ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg', '.bmp'];
        
        if (isImage && safeImageExts.includes(ext)) {
            cb(null, true);
        } else {
            cb(new Error('Chỉ chấp nhận tệp hình ảnh hợp lệ (.png, .jpg, .jpeg, .webp, .gif, .svg, .bmp) làm phần thưởng bí mật!'), false);
        }
    }
});

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
// Đã được gọi ở trên qua const { db } = require('./src/config/db');

// Import router
const mediaRouter = require('./src/routes/mediaRoutes');
const ideaRouter = require('./src/routes/ideaRoutes');
const authRouter = require('./src/routes/authRoutes');
const newsRouter = require('./src/routes/newsRoutes');

// (Phần IP visitsPath đã được gỡ bỏ vì dùng SQLite)

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
                db.prepare('INSERT INTO visits (ip, count) VALUES (?, 1) ON CONFLICT(ip) DO UPDATE SET count = count + 1').run(ip);
            } catch (e) {
                console.error('Lỗi khi ghi nhận lượt truy cập IP:', e);
            }
        }
    }
    next();
});

// Middlewares
app.use(express.json());

// Session Middleware
app.use(session({
    secret: process.env.SESSION_SECRET || 'beohub-super-secret-key-12345',
    resave: false,
    saveUninitialized: false,
    cookie: { 
        secure: false, // process.env.NODE_ENV === 'production' nếu có HTTPS
        maxAge: 24 * 60 * 60 * 1000 // 1 ngày
    }
}));

// Route phục vụ trang Minigame riêng biệt
app.get('/minigame', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'minigame.html'));
});

app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.get('/admin-news', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin-news.html'));
});

app.use(express.static('public'));

// Cấu hình các route API
app.use('/api/auth', authRouter);
app.use('/api', mediaRouter);
app.use('/api/ideas', ideaRouter);
app.use('/api/news', newsRouter);

// (Phần donationsPath đã được gỡ bỏ vì dùng SQLite)

let latestDonation = null;

app.post('/api/donate/alert', (req, res) => {
    if (!req.session || !req.session.isAdmin) {
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
        db.prepare('INSERT INTO donations (id, name, amount, message, timestamp) VALUES (?, ?, ?, ?, ?)').run(
            Date.now(), name || 'Ẩn danh', amount || '0 VND', message || '', Date.now()
        );
    } catch (e) {
        console.error('Lỗi khi lưu thông tin donate:', e);
    }

    res.json({ success: true });
});

app.get('/api/donate/latest', (req, res) => {
    res.json({ success: true, latest: latestDonation });
});

app.get('/api/visits/leaderboard', (req, res) => {
    if (!req.session || !req.session.isAdmin) {
        return res.status(403).json({ success: false, message: 'Từ chối!' });
    }
    try {
        const leaderboard = db.prepare('SELECT ip, count FROM visits ORDER BY count DESC').all();
        res.json({ success: true, leaderboard });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// ================= pikabeo secret reward images apis =================

// Lấy danh sách Ảnh Bí Mật (Quyền Admin)
app.get('/api/pikabeo/secrets', (req, res) => {
    if (!req.session || !req.session.isAdmin) {
        return res.status(403).json({ success: false, message: 'Từ chối!' });
    }
    try {
        const secrets = db.prepare('SELECT * FROM secrets').all();
        res.json({ success: true, secrets });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// Admin upload Ảnh Bí Mật mới
app.post('/api/pikabeo/secrets', uploadSecret.single('secretImage'), (req, res) => {
    if (!req.session || !req.session.isAdmin) {
        return res.status(403).json({ success: false, message: 'Từ chối!' });
    }
    if (!req.file) {
        return res.status(400).json({ success: false, message: 'Không có tệp tải lên!' });
    }
    try {
        const newSecret = {
            name: req.file.filename,
            url: `/uploads/secrets/${req.file.filename}`,
            timestamp: Date.now()
        };
        db.prepare('INSERT INTO secrets (name, url, timestamp) VALUES (?, ?, ?)').run(
            newSecret.name, newSecret.url, newSecret.timestamp
        );
        
        res.json({ success: true, secret: newSecret });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// Admin xóa Ảnh Bí Mật
app.delete('/api/pikabeo/secrets/:name', (req, res) => {
    if (!req.session || !req.session.isAdmin) {
        return res.status(403).json({ success: false, message: 'Từ chối!' });
    }
    const filename = req.params.name;
    try {
        const filePath = path.join(secretsDir, filename);
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }
        
        db.prepare('DELETE FROM secrets WHERE name = ?').run(filename);
        
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// Lấy ngẫu nhiên 1 Ảnh Bí Mật (Mọi người dùng)
app.get('/api/pikabeo/secrets/random', (req, res) => {
    try {
        const secrets = db.prepare('SELECT * FROM secrets').all();
        
        if (secrets.length > 0) {
            const randomIndex = Math.floor(Math.random() * secrets.length);
            return res.json({ success: true, url: secrets[randomIndex].url });
        }
        
        // Trả về ảnh mặc định ngẫu nhiên trong hệ thống
        const defaults = [
            '/img/default_secrets/secret_1.svg',
            '/img/default_secrets/secret_2.svg',
            '/img/default_secrets/secret_3.svg',
            '/img/default_secrets/secret_4.svg',
            '/img/default_secrets/secret_5.svg'
        ];
        const randomDefault = defaults[Math.floor(Math.random() * defaults.length)];
        res.json({ success: true, url: randomDefault });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// ================= pikabeo leaderboard ranking apis =================

// Lấy danh sách bảng xếp hạng cao thủ Pikabeo (Top 50)
app.get('/api/pikabeo/scores/leaderboard', (req, res) => {
    try {
        let scores = [];
        if (fs.existsSync(pikabeoScoresPath)) {
            scores = JSON.parse(fs.readFileSync(pikabeoScoresPath, 'utf8'));
        }
        
        // Sắp xếp: score giảm dần, level giảm dần, timeLeft giảm dần, timestamp tăng dần
        const sorted = scores.sort((a, b) => {
            if (b.score !== a.score) return b.score - a.score;
            if (b.level !== a.level) return b.level - a.level;
            if (b.timeLeft !== a.timeLeft) return b.timeLeft - a.timeLeft;
            return a.timestamp - b.timestamp;
        });

        res.json({ success: true, leaderboard: sorted.slice(0, 50) });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// Lưu điểm số mới đạt được
app.post('/api/pikabeo/scores', (req, res) => {
    const { playerName, score, level, timeLeft, hintsUsed, shufflesUsed } = req.body;
    
    if (!playerName || String(playerName).trim() === '') {
        return res.status(400).json({ success: false, message: 'Tên người chơi không được để trống!' });
    }

    try {
        let scores = [];
        if (fs.existsSync(pikabeoScoresPath)) {
            scores = JSON.parse(fs.readFileSync(pikabeoScoresPath, 'utf8'));
        }
        
        const newEntry = {
            id: Date.now(),
            playerName: String(playerName).trim().substring(0, 15),
            score: Math.max(0, parseInt(score) || 0),
            level: Math.max(1, parseInt(level) || 1),
            timeLeft: Math.max(0, parseInt(timeLeft) || 0),
            hintsUsed: Math.max(0, parseInt(hintsUsed) || 0),
            shufflesUsed: Math.max(0, parseInt(shufflesUsed) || 0),
            timestamp: Date.now()
        };

        scores.push(newEntry);
        
        // Sắp xếp danh sách
        scores.sort((a, b) => {
            if (b.score !== a.score) return b.score - a.score;
            if (b.level !== a.level) return b.level - a.level;
            if (b.timeLeft !== a.timeLeft) return b.timeLeft - a.timeLeft;
            return a.timestamp - b.timestamp;
        });

        // Giới hạn 100 dòng ghi nhận
        if (scores.length > 100) {
            scores = scores.slice(0, 100);
        }

        fs.writeFileSync(pikabeoScoresPath, JSON.stringify(scores, null, 2));

        // Tìm thứ hạng của lượt chơi hiện tại (1-indexed)
        const rankIndex = scores.findIndex(item => item.id === newEntry.id) + 1;

        res.json({ success: true, rank: rankIndex, entry: newEntry });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// Thiết lập vòng lặp phát sóng tự động mỗi 3 phút (180000ms)
setInterval(() => {
    try {
        const savedDonations = db.prepare('SELECT * FROM donations').all();
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