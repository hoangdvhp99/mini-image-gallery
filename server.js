const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 3000;
const DB_PATH = path.join(__dirname, 'data', 'db.json');
const UPLOAD_DIR = path.join(__dirname, 'public', 'uploads');

// Đảm bảo thư mục data và uploads tồn tại
if (!fs.existsSync(path.join(__dirname, 'data'))) fs.mkdirSync(path.join(__dirname, 'data'));
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR);
if (!fs.existsSync(DB_PATH)) fs.writeFileSync(DB_PATH, JSON.stringify([]));

app.use(express.json());
app.use(express.static('public'));

// Cấu hình Multer: Giữ nguyên tên file gốc để tự động ghi đè nếu trùng
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, UPLOAD_DIR),
    filename: (req, file, cb) => {
        // Khắc phục lỗi font tiếng Việt có dấu khi upload file
        file.originalname = Buffer.from(file.originalname, 'latin1').toString('utf8');
        cb(null, file.originalname);
    }
});
const upload = multer({ storage: storage });

// Đọc DB JSON
function readDB() {
    return JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
}

// Ghi DB JSON
function writeDB(data) {
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}

// 1. API Upload hàng loạt ảnh
app.post('/api/upload', upload.array('images'), (req, res) => {
    try {
        const hashtags = req.body.hashtags ? req.body.hashtags.split(',').map(t => t.trim().toLowerCase()).filter(t => t) : [];
        const description = req.body.description || '';
        let db = readDB();

        req.files.forEach(file => {
            const fileName = file.originalname;

            const imageData = {
                name: fileName,
                url: `/uploads/${fileName}`,
                hashtags: hashtags,
                description: description,
                uploadedAt: new Date().toISOString()
            };

            // Tìm xem ảnh đã tồn tại chưa (Ghi đè thông tin trong DB)
            const existingIndex = db.findIndex(img => img.name === fileName);
            if (existingIndex !== -1) {
                db[existingIndex] = imageData; // Ghi đè metadata
            } else {
                db.push(imageData); // Thêm mới
            }
        });

        writeDB(db);
        res.json({ success: true, message: `Đã upload ${req.files.length} ảnh thành công.` });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// 2. API Lấy danh sách ảnh & Tìm kiếm
app.get('/api/images', (req, res) => {
    const search = (req.query.search || '').toLowerCase().trim();
    const db = readDB();

    if (!search) {
        return res.json(db);
    }

    const filtered = db.filter(img => {
        const matchName = img.name.toLowerCase().includes(search);
        const matchHashtag = img.hashtags.some(tag => tag.includes(search));
        return matchName || matchHashtag;
    });

    res.json(filtered);
});

// 3. API Xóa ảnh
app.delete('/api/images/:name', (req, res) => {
    try {
        const fileName = req.params.name;
        let db = readDB();

        // Tìm ảnh trong database
        const imageIndex = db.findIndex(img => img.name === fileName);
        if (imageIndex === -1) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy ảnh trong database.' });
        }

        // Đường dẫn tới file ảnh vật lý
        const filePath = path.join(UPLOAD_DIR, fileName);

        // 1. Xóa file ảnh vật lý nếu file tồn tại
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }

        // 2. Xóa thông tin ảnh trong file JSON
        db.splice(imageIndex, 1);
        writeDB(db);

        res.json({ success: true, message: `Đã xóa ảnh ${fileName} thành công.` });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`=============================================`);
    console.log(`🚀 Ứng dụng đang chạy tại:`);
    console.log(`   - Local: http://localhost:${PORT}`);
    console.log(`=============================================`);
});
