const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const session = require('express-session');

// Cấu hình đường dẫn cho Ảnh Bí Mật Pikabeo
const { db } = require('./src/config/db');

// (Phần JSON Score Path đã được gỡ bỏ vì dùng SQLite)

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
    limits: { fileSize: 10 * 1024 * 1024 }, // Giới hạn 10MB tránh đầy đĩa cứng
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

// Cấu hình đường dẫn cho Ảnh Q&A
const qandaDir = path.join(__dirname, 'public', 'uploads', 'qanda');
if (!fs.existsSync(qandaDir)) {
    fs.mkdirSync(qandaDir, { recursive: true });
}

// Cấu hình Multer để lưu trữ Ảnh Q&A
const qandaStorage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, qandaDir),
    filename: (req, file, cb) => {
        const originalName = Buffer.from(file.originalname, 'latin1').toString('utf8');
        const cleanName = originalName.replace(/[^a-zA-Z0-9.\-_]/g, '');
        cb(null, Date.now() + '-' + cleanName);
    }
});

const uploadQanda = multer({
    storage: qandaStorage,
    limits: { fileSize: 10 * 1024 * 1024 }, // Giới hạn 10MB tránh đầy đĩa cứng
    fileFilter: (req, file, cb) => {
        const isImage = file.mimetype.startsWith('image/');
        const ext = path.extname(file.originalname).toLowerCase();
        const safeImageExts = ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg', '.bmp'];
        
        if (isImage && safeImageExts.includes(ext)) {
            cb(null, true);
        } else {
            cb(new Error('Chỉ chấp nhận tệp hình ảnh hợp lệ (.png, .jpg, .jpeg, .webp, .gif, .svg, .bmp)!'), false);
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

// Set up EJS view engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.locals.version = Date.now(); // Global cache-busting version

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

// Route render bằng EJS
app.get('/', (req, res) => {
    res.render('index');
});

app.get('/minigame', (req, res) => {
    res.render('minigame');
});

app.get('/login', (req, res) => {
    res.render('login');
});

app.get('/admin-news', (req, res) => {
    res.render('admin-news');
});

app.get('/qanda', (req, res) => {
    res.render('qanda');
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
        const { logUpload } = require('./src/utils/logger');
        logUpload(req, req.file.filename, req.file.originalname, 'Pikabeo Secret');

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

// Lấy ngẫu nhiên 1 Ảnh Bí Mật (Chỉ cho phép khi có phiên chơi game Pikabeo đang hoạt động)
app.get('/api/pikabeo/secrets/random', (req, res) => {
    // Chống hack/cào ảnh bí mật: Đòi hỏi có phiên chơi game Pikabeo hoạt động
    if (!req.session || !req.session.activeGame || req.session.activeGame.type !== 'pikabeo') {
        return res.status(403).json({ success: false, message: 'Cảnh báo chống hack: Lượt chơi không hợp lệ hoặc chưa được khởi tạo!' });
    }

    // Giới hạn chỉ cho phép lấy 1 lần mỗi phiên chơi
    if (req.session.activeGame.hasRetrievedSecret) {
        return res.status(403).json({ success: false, message: 'Cảnh báo chống hack: Bạn chỉ được tải ảnh bí mật tối đa 1 lần mỗi lượt chơi!' });
    }

    try {
        req.session.activeGame.hasRetrievedSecret = true;
        
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

// Khởi tạo phiên chơi game chống hack
app.post('/api/game/start', (req, res) => {
    if (!req.session) {
        return res.status(500).json({ success: false, message: 'Session is not configured!' });
    }
    req.session.activeGame = {
        type: req.body.gameType,
        startTime: Date.now()
    };
    res.json({ success: true, message: 'Phiên chơi game đã được khởi tạo!' });
});

// ================= pikabeo leaderboard ranking apis =================

// Lấy danh sách bảng xếp hạng cao thủ Pikabeo (Top 50)
app.get('/api/pikabeo/scores/leaderboard', (req, res) => {
    try {
        const stmt = db.prepare('SELECT * FROM pikabeo_scores ORDER BY score DESC, level DESC, timePlayed ASC, timestamp ASC LIMIT 50');
        const leaderboard = stmt.all();
        res.json({ success: true, leaderboard });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// Lưu điểm số mới đạt được
app.post('/api/pikabeo/scores', (req, res) => {
    const { playerName, score, level, timePlayed, hintsUsed, shufflesUsed } = req.body;
    
    if (!playerName || String(playerName).trim() === '') {
        return res.status(400).json({ success: false, message: 'Tên người chơi không được để trống!' });
    }

    // Chống hack: Kiểm tra phiên chơi game hoạt động
    if (!req.session || !req.session.activeGame || req.session.activeGame.type !== 'pikabeo') {
        return res.status(403).json({ success: false, message: 'Cảnh báo chống hack: Lượt chơi không hợp lệ hoặc chưa được khởi tạo!' });
    }

    try {
        const id = Date.now();
        const cleanName = String(playerName).trim().substring(0, 15);
        const safeScore = Math.max(0, parseInt(score) || 0);
        const safeLevel = Math.max(1, parseInt(level) || 1);
        const safeTimePlayed = Math.max(0, parseInt(timePlayed) || 0);
        const safeHintsUsed = Math.max(0, parseInt(hintsUsed) || 0);
        const safeShufflesUsed = Math.max(0, parseInt(shufflesUsed) || 0);

        // Chống hack: Kiểm tra thời gian chơi thực tế so với thời gian trôi qua trên session (cho sai số tối đa 15 giây)
        const elapsedSeconds = (Date.now() - req.session.activeGame.startTime) / 1000;
        if (Math.abs(safeTimePlayed - elapsedSeconds) > 15 && safeTimePlayed > elapsedSeconds + 5) {
            return res.status(403).json({ success: false, message: 'Cảnh báo chống hack: Thời gian chơi thực tế không khớp với thời gian phiên!' });
        }

        // Chống hack: Điểm số tối đa vật lý cho mỗi cấp độ (ví dụ: cấp độ 1 tối đa 3500 điểm)
        const maxScoreForLevel = safeLevel * 3500;
        if (safeScore > maxScoreForLevel) {
            return res.status(403).json({ success: false, message: 'Cảnh báo chống hack: Điểm số vượt quá giới hạn vật lý của cấp độ!' });
        }

        // Xóa phiên chơi sau khi đã dùng để tránh gửi lại điểm số cũ
        delete req.session.activeGame;

        const existing = db.prepare('SELECT * FROM pikabeo_scores WHERE playerName = ?').get(cleanName);
        if (existing) {
            const isBetter = safeScore > existing.score || 
                             (safeScore === existing.score && safeLevel > existing.level) || 
                             (safeScore === existing.score && safeLevel === existing.level && safeTimePlayed < existing.timePlayed);
            
            if (isBetter) {
                db.prepare('UPDATE pikabeo_scores SET score = ?, level = ?, timePlayed = ?, hintsUsed = ?, shufflesUsed = ?, timestamp = ? WHERE playerName = ?').run(safeScore, safeLevel, safeTimePlayed, safeHintsUsed, safeShufflesUsed, id, cleanName);
            }
        } else {
            db.prepare('INSERT INTO pikabeo_scores (id, playerName, score, level, timePlayed, hintsUsed, shufflesUsed, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(id, cleanName, safeScore, safeLevel, safeTimePlayed, safeHintsUsed, safeShufflesUsed, id);
        }
        
        // Find their best score to calculate rank
        const bestEntry = db.prepare('SELECT * FROM pikabeo_scores WHERE playerName = ?').get(cleanName);

        // Lấy thứ hạng (Rank)
        const rankStmt = db.prepare(`
            SELECT COUNT(*) + 1 AS rank FROM pikabeo_scores 
            WHERE score > ? 
            OR (score = ? AND level > ?) 
            OR (score = ? AND level = ? AND timePlayed < ?)
            OR (score = ? AND level = ? AND timePlayed = ? AND timestamp < ?)
        `);
        const rankResult = rankStmt.get(bestEntry.score, bestEntry.score, bestEntry.level, bestEntry.score, bestEntry.level, bestEntry.timePlayed, bestEntry.score, bestEntry.level, bestEntry.timePlayed, bestEntry.timestamp);

        res.json({ success: true, rank: rankResult.rank, entry: bestEntry });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// Admin xóa điểm Pikabeo
app.delete('/api/pikabeo/scores/:id', (req, res) => {
    if (!req.session || !req.session.isAdmin) {
        return res.status(403).json({ success: false, message: 'Từ chối!' });
    }
    const id = req.params.id;
    try {
        db.prepare('DELETE FROM pikabeo_scores WHERE id = ?').run(id);
        res.json({ success: true, message: 'Đã xóa kỷ lục!' });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// ================= dino run leaderboard apis =================

app.get('/api/dino/characters/count', (req, res) => {
    try {
        const spritesDir = path.join(__dirname, 'public', 'img', 'beo-dino', 'characters');
        if (!fs.existsSync(spritesDir)) {
            return res.json({ success: true, count: 9 });
        }
        const files = fs.readdirSync(spritesDir);
        const count = files.filter(f => f.endsWith('.png')).length;
        res.json({ success: true, count: count > 0 ? count : 9 });
    } catch (e) {
        res.json({ success: true, count: 9 });
    }
});

app.get('/api/dino/items/count', (req, res) => {
    try {
        const birdsDir = path.join(__dirname, 'public', 'img', 'beo-dino', 'items', 'birds');
        const plantsDir = path.join(__dirname, 'public', 'img', 'beo-dino', 'items', 'plants');
        
        const countFiles = (dir) => {
            if (!fs.existsSync(dir)) return 0;
            return fs.readdirSync(dir).filter(f => f.endsWith('.png')).length;
        };

        res.json({
            success: true,
            birds: countFiles(birdsDir),
            plants: countFiles(plantsDir)
        });
    } catch (e) {
        res.json({ success: false, birds: 0, plants: 0 });
    }
});

app.get('/api/dino/scores/leaderboard', (req, res) => {
    try {
        const stmt = db.prepare('SELECT * FROM dino_scores ORDER BY score DESC, timestamp ASC LIMIT 50');
        const leaderboard = stmt.all();
        res.json({ success: true, leaderboard });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

app.post('/api/dino/scores', (req, res) => {
    const { playerName, score } = req.body;
    
    if (!playerName || String(playerName).trim() === '') {
        return res.status(400).json({ success: false, message: 'Tên người chơi không được để trống!' });
    }

    // Chống hack: Kiểm tra phiên chơi game hoạt động
    if (!req.session || !req.session.activeGame || req.session.activeGame.type !== 'dino') {
        return res.status(403).json({ success: false, message: 'Cảnh báo chống hack: Lượt chơi không hợp lệ hoặc chưa được khởi tạo!' });
    }

    try {
        const id = Date.now();
        const cleanName = String(playerName).trim().substring(0, 15);
        const safeScore = Math.max(0, parseInt(score) || 0);

        // Chống hack: Kiểm tra tốc độ tăng điểm tối đa so với thời gian thực tế trôi qua (Dino tăng tối đa ~15 điểm/giây)
        const elapsedSeconds = (Date.now() - req.session.activeGame.startTime) / 1000;

        // Giới hạn thời gian chơi tối đa cho một phiên (Dino không quá 30 phút = 1800 giây)
        if (elapsedSeconds > 1800) {
            return res.status(403).json({ success: false, message: 'Cảnh báo chống hack: Phiên chơi game đã hết hạn!' });
        }

        const maxPossibleScore = Math.ceil(elapsedSeconds * 15) + 100; // Thêm 100 điểm đệm
        if (safeScore > maxPossibleScore) {
            return res.status(403).json({ success: false, message: 'Cảnh báo chống hack: Điểm số tăng nhanh bất thường so với thời gian chơi!' });
        }

        // Xóa phiên chơi sau khi đã dùng
        delete req.session.activeGame;

        const existing = db.prepare('SELECT * FROM dino_scores WHERE playerName = ?').get(cleanName);
        if (existing) {
            if (safeScore > existing.score) {
                db.prepare('UPDATE dino_scores SET score = ?, timestamp = ? WHERE playerName = ?').run(safeScore, id, cleanName);
            }
        } else {
            db.prepare('INSERT INTO dino_scores (id, playerName, score, timestamp) VALUES (?, ?, ?, ?)').run(id, cleanName, safeScore, id);
        }
        
        // Find their best score to calculate rank
        const bestEntry = db.prepare('SELECT * FROM dino_scores WHERE playerName = ?').get(cleanName);

        // Lấy thứ hạng
        const rankStmt = db.prepare(`
            SELECT COUNT(*) + 1 AS rank FROM dino_scores 
            WHERE score > ? 
            OR (score = ? AND timestamp < ?)
        `);
        const rankResult = rankStmt.get(bestEntry.score, bestEntry.score, bestEntry.timestamp);

        res.json({ success: true, rank: rankResult.rank, entry: bestEntry });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// Admin xóa điểm Dino
app.delete('/api/dino/scores/:id', (req, res) => {
    if (!req.session || !req.session.isAdmin) {
        return res.status(403).json({ success: false, message: 'Từ chối!' });
    }
    const id = req.params.id;
    try {
        db.prepare('DELETE FROM dino_scores WHERE id = ?').run(id);
        res.json({ success: true, message: 'Đã xóa kỷ lục!' });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// ================= Q&A APIs =================

// Lấy danh sách câu hỏi Q&A
app.get('/api/qanda', (req, res) => {
    try {
        const questions = db.prepare('SELECT * FROM qanda ORDER BY createdAt DESC').all();
        res.json({ success: true, questions });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// Submit câu hỏi mới
app.post('/api/qanda', uploadQanda.single('qandaImage'), (req, res) => {
    // Tần suất giới hạn: Tối đa 1 Q&A mỗi 15 giây mỗi session
    const nowTime = Date.now();
    if (req.session.lastQandaTime && (nowTime - req.session.lastQandaTime < 15000)) {
        const waitSecs = Math.ceil((15000 - (nowTime - req.session.lastQandaTime)) / 1000);
        // Nếu có ảnh đã tải lên tạm thời, xóa đi tránh rác đĩa
        if (req.file) {
            try {
                const tempPath = path.join(qandaDir, req.file.filename);
                if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
            } catch (e) {}
        }
        return res.status(429).json({ success: false, message: `Vui lòng chờ ${waitSecs} giây trước khi gửi câu hỏi tiếp theo!` });
    }
    req.session.lastQandaTime = nowTime;

    const { username, title, description } = req.body;
    
    if (!username || String(username).trim() === '') {
        return res.status(400).json({ success: false, message: 'Tên người dùng không được để trống!' });
    }
    if (!title || String(title).trim() === '') {
        return res.status(400).json({ success: false, message: 'Tiêu đề không được để trống!' });
    }
    if (!description || String(description).trim() === '') {
        return res.status(400).json({ success: false, message: 'Nội dung không được để trống!' });
    }

    try {
        let imageUrl = '';
        if (req.file) {
            imageUrl = `/uploads/qanda/${req.file.filename}`;
            const { logUpload } = require('./src/utils/logger');
            logUpload(req, req.file.filename, req.file.originalname, 'Q&A Image');
        }

        const newQuestion = {
            username: String(username).trim().substring(0, 30),
            title: String(title).trim().substring(0, 100),
            description: String(description).trim(),
            imageUrl,
            reply: '',
            createdAt: Date.now(),
            repliedAt: null
        };

        const stmt = db.prepare(`
            INSERT INTO qanda (username, title, description, imageUrl, reply, createdAt, repliedAt)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `);
        const info = stmt.run(
            newQuestion.username,
            newQuestion.title,
            newQuestion.description,
            newQuestion.imageUrl,
            newQuestion.reply,
            newQuestion.createdAt,
            newQuestion.repliedAt
        );

        res.json({ success: true, questionId: info.lastInsertRowid });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// Admin trả lời câu hỏi
app.post('/api/qanda/:id/reply', (req, res) => {
    if (!req.session || !req.session.isAdmin) {
        return res.status(403).json({ success: false, message: 'Từ chối! Quyền Admin là bắt buộc.' });
    }
    
    const id = req.params.id;
    const { reply } = req.body;

    if (!reply || String(reply).trim() === '') {
        return res.status(400).json({ success: false, message: 'Nội dung câu trả lời không được để trống!' });
    }

    try {
        const cleanReply = String(reply).trim();
        const stmt = db.prepare('UPDATE qanda SET reply = ?, repliedAt = ? WHERE id = ?');
        const result = stmt.run(cleanReply, Date.now(), id);

        if (result.changes === 0) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy câu hỏi này!' });
        }

        res.json({ success: true, message: 'Đã lưu câu trả lời!' });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// Admin xóa câu hỏi Q&A
app.delete('/api/qanda/:id', (req, res) => {
    if (!req.session || !req.session.isAdmin) {
        return res.status(403).json({ success: false, message: 'Từ chối!' });
    }
    const id = req.params.id;
    try {
        db.prepare('DELETE FROM qanda WHERE id = ?').run(id);
        res.json({ success: true, message: 'Đã xóa câu hỏi!' });
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