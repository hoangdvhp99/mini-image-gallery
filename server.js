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
        res.json({ success: true, message: `Đã upload ${req.files.length} file thành công.` });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// 2. API Lấy danh sách ảnh & Tìm kiếm
app.get('/api/images', (req, res) => {
    try {
        const search = (req.query.search || '').toLowerCase().trim();
        const db = readDB();

        // 1. Tiến hành lọc dữ liệu theo từ khóa trước (nếu có)
        let filtered = db;
        if (search) {
            filtered = db.filter(img => {
                const matchName = img.name.toLowerCase().includes(search);
                const matchHashtag = img.hashtags.some(tag => tag.includes(search));
                return matchName || matchHashtag;
            });
        }

        // 2. Thực hiện sắp xếp: Bản ghi nào có ngày uploadedAt lớn hơn (mới hơn) sẽ được đưa lên đầu
        filtered.sort((a, b) => {
            return new Date(b.uploadedAt) - new Date(a.uploadedAt);
        });

        res.json(filtered);
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// 3. API Xóa ảnh (Chỉ cho phép nếu có param isAdmin=1)
app.delete('/api/images/:name', (req, res) => {
    try {
        const isAdmin = req.query.isAdmin; // Lấy param từ URL (?isAdmin=1)

        // Kiểm tra quyền Admin
        if (isAdmin !== '1') {
            return res.status(403).json({ success: false, message: 'Từ chối truy cập! Bạn không có quyền xóa ảnh.' });
        }

        const fileName = req.params.name;
        let db = readDB();

        // Tìm ảnh trong database
        const imageIndex = db.findIndex(img => img.name === fileName);
        if (imageIndex === -1) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy ảnh trong database.' });
        }

        // Đường dẫn tới file ảnh vật lý
        const filePath = path.join(UPLOAD_DIR, fileName);

        // 1. Xóa file ảnh vật lý nếu tồn tại
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }

        // 2. Xóa thông tin ảnh trong file JSON
        db.splice(imageIndex, 1);
        writeDB(db);

        res.json({ success: true, message: `Đã xóa ${fileName} thành công.` });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// 4. API Cập nhật thông tin / Đổi tên file (Yêu cầu isAdmin=1)
app.put('/api/images/:name', upload.single('newImage'), (req, res) => {
    try {
        const isAdmin = req.query.isAdmin;
        if (isAdmin !== '1') {
            return res.status(403).json({ success: false, message: 'Từ chối truy cập! Bạn không có quyền sửa.' });
        }

        const oldName = req.params.name;
        let db = readDB();

        // 1. Kiểm tra bản ghi cũ có tồn tại trong JSON không
        const imageIndex = db.findIndex(img => img.name === oldName);
        if (imageIndex === -1) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy dữ liệu trên server.' });
        }

        const oldImageData = db[imageIndex];
        const hashtags = req.body.hashtags ? req.body.hashtags.split(',').map(t => t.trim().toLowerCase()).filter(t => t) : [];
        const description = req.body.description || '';

        // Lấy tên file mới do người dùng nhập (nếu không nhập thì giữ nguyên tên cũ)
        let finalFileName = req.body.newName ? req.body.newName.trim() : oldName;

        let currentFileOnDisk = oldName; // File hiện tại đang nằm trên ổ đĩa là file nào

        // 2. TRƯỜNG HỢP 1: Người dùng tải lên một file MỚI hoàn toàn để thay thế
        if (req.file) {
            const uploadedFileName = req.file.originalname;

            // Nếu file vừa tải lên có tên khác hoàn toàn với file cũ đang lưu, xóa file cũ đi
            if (uploadedFileName !== oldName) {
                const oldFilePath = path.join(UPLOAD_DIR, oldName);
                if (fs.existsSync(oldFilePath)) {
                    fs.unlinkSync(oldFilePath);
                }
            }
            currentFileOnDisk = uploadedFileName;
            // Nếu người dùng không chủ động gõ tên mới vào ô text, lấy luôn tên file mới vừa upload làm tên chính thức
            if (!req.body.newName) {
                finalFileName = uploadedFileName;
            }
        }

        // 3. TRƯỜNG HỢP 2: Người dùng đổi tên file (Sửa text ở ô Tên file)
        if (finalFileName !== currentFileOnDisk) {
            // Tự động bổ sung lại đuôi định dạng (extension) cũ nếu người dùng lỡ tay xóa mất đuôi file khi sửa text
            const oldExt = path.extname(currentFileOnDisk);
            if (!finalFileName.toLowerCase().endsWith(oldExt.toLowerCase())) {
                finalFileName += oldExt;
            }

            const currentFilePath = path.join(UPLOAD_DIR, currentFileOnDisk);
            const newFilePath = path.join(UPLOAD_DIR, finalFileName);

            // Kiểm tra xem tên mới này đã bị trùng với một file khác có sẵn trên server chưa
            if (fs.existsSync(newFilePath) && finalFileName !== oldName) {
                // Nếu trùng và có file mới vừa upload, dọn dẹp file vừa upload tạm đó đi trước khi báo lỗi
                if (req.file) fs.unlinkSync(path.join(UPLOAD_DIR, req.file.originalname));
                return res.status(400).json({ success: false, message: `Tên file "${finalFileName}" đã tồn tại trên server. Vui lòng đặt tên khác!` });
            }

            // Đổi tên file vật lý trên ổ đĩa máy tính
            if (fs.existsSync(currentFilePath)) {
                fs.renameSync(currentFilePath, newFilePath);
            }
        }

        // 4. Cập nhật lại toàn bộ thông tin mới vào Object dữ liệu
        const updatedData = {
            name: finalFileName,
            url: `/uploads/${finalFileName}`,
            hashtags: hashtags,
            description: description,
            uploadedAt: oldImageData.uploadedAt,
            updatedAt: new Date().toISOString()
        };

        // Ghi đè lại bản ghi trong DB JSON
        db[imageIndex] = updatedData;
        writeDB(db);

        res.json({ success: true, message: `Đã cập nhật dữ liệu và đổi tên thành công.` });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// 5. API Thả tim (Like) - Không cần đăng nhập
app.post('/api/images/:name/like', (req, res) => {
    try {
        const fileName = req.params.name;
        let db = readDB();

        const imageIndex = db.findIndex(img => img.name === fileName);
        if (imageIndex === -1) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy dữ liệu.' });
        }

        // Nếu trường likes chưa tồn tại thì khởi tạo bằng 0, sau đó tăng lên 1
        db[imageIndex].likes = (db[imageIndex].likes || 0) + 1;
        writeDB(db);

        res.json({ success: true, likes: db[imageIndex].likes });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// 6. API Thêm bình luận (Comment) - Không cần đăng nhập
app.post('/api/images/:name/comment', (req, res) => {
    try {
        const fileName = req.params.name;
        const { text } = req.body; // Lấy nội dung comment từ client

        if (!text || !text.trim()) {
            return res.status(400).json({ success: false, message: 'Nội dung bình luận không được để trống.' });
        }

        let db = readDB();
        const imageIndex = db.findIndex(img => img.name === fileName);
        if (imageIndex === -1) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy dữ liệu.' });
        }

        // Khởi tạo mảng comments nếu chưa có
        if (!db[imageIndex].comments) {
            db[imageIndex].comments = [];
        }

        // Tạo object comment mới với một cái tên ẩn danh ngẫu nhiên cho vui
        const anonymousNames = ['Người dùng ẩn danh', 'Khách vãng lai', 'Fan BeoHub', 'Ẩn danh đại hiệp', 'Thành viên bí ẩn'];
        const randomName = anonymousNames[Math.floor(Math.random() * anonymousNames.length)];

        const newComment = {
            id: Date.now(),
            author: randomName,
            text: text.trim(),
            createdAt: new Date().toISOString()
        };

        db[imageIndex].comments.push(newComment);
        writeDB(db);

        res.json({ success: true, comment: newComment });
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
