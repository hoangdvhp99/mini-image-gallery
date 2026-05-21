const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 3000;
const DB_PATH = path.join(__dirname, 'data', 'db.json');
const UPLOAD_DIR = path.join(__dirname, 'public', 'uploads');

if (!fs.existsSync(path.join(__dirname, 'data'))) fs.mkdirSync(path.join(__dirname, 'data'));
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR);
if (!fs.existsSync(DB_PATH)) fs.writeFileSync(DB_PATH, JSON.stringify([]));

app.use(express.json());
app.use(express.static('public'));

function removeVietnameseTones(str) {
    str = str.replace(/à|á|ạ|ả|ã|â|ầ|ấ|ậ|ẩ|ẫ|ă|ằ|ắ|ặ|ẳ|ẵ/g, "a");
    str = str.replace(/è|é|ẹ|e|ẽ|ê|ề|ế|ệ|ể|ễ/g, "e");
    str = str.replace(/ì|í|ị|ỉ|ĩ/g, "i");
    str = str.replace(/ò|ó|ọ|ỏ|õ|ô|ồ|ố|ộ|ổ|ỗ|ơ|ờ|ớ|ợ|ở|ỡ/g, "o");
    str = str.replace(/ù|ú|ụ|ủ|ũ|ư|ừ|ứ|ự|ử|ữ/g, "u");
    str = str.replace(/ỳ|ý|ỵ|ỷ|ỹ/g, "y");
    str = str.replace(/đ/g, "d");
    str = str.replace(/À|Á|Ạ|Ả|Ã|Â|Ầ|Ấ|Ậ|Ẩ|Ẫ|Ă|Ằ|Ắ|Ặ|Ẳ|Ẵ/g, "A");
    str = str.replace(/È|É|Ạ|Ẻ|Ẽ|Ê|Ề|Ế|Ệ|Ể|Ễ/g, "E");
    str = str.replace(/Ì|Í|Ị|Ỉ|Ĩ/g, "I");
    str = str.replace(/Ò|Ó|Ọ|Ỏ|Õ|Ô|Ồ|Ố|Ộ|Ổ|Ỗ|Ơ|Ờ|Ớ|Ợ|Ở|Ỡ/g, "O");
    str = str.replace(/Ù|Ú|Ụ|Ủ|Ũ|Ư|Ừ|Ứ|Ự|Ử|Ữ/g, "U");
    str = str.replace(/Ỳ|Ý|Ỵ|Ỷ|Ỹ/g, "Y");
    str = str.replace(/Đ/g, "D");
    str = str.replace(/\u0300|\u0301|\u0303|\u0309|\u0323/g, "");
    str = str.replace(/\u02C6|\u0306|\u031B/g, "");
    str = str.replace(/\s+/g, "-");
    str = str.replace(/[^a-zA-Z0-9.\-_]/g, "");
    return str;
}

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
        if (file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/')) cb(null, true);
        else cb(new Error('Chỉ chấp nhận định dạng Ảnh hoặc Video!'));
    }
});

function readDB() { return JSON.parse(fs.readFileSync(DB_PATH, 'utf8')); }
function writeDB(data) { fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2)); }

// 1. API Upload nội dung (Đã nâng cấp: Xử lý mảng tên tùy chỉnh theo vòng lặp loop)
app.post('/api/upload', upload.array('images'), (req, res) => {
    let db = readDB();
    const files = req.files;

    if (!files || files.length === 0) {
        return res.status(400).json({ success: false, message: 'Không có tệp tin nào được tải lên.' });
    }

    try {
        const hashtags = req.body.hashtags ? req.body.hashtags.split(',').map(t => t.trim().toLowerCase()).filter(t => t) : [];
        const description = req.body.description || '';

        // Nhận mảng tên tương ứng từ Frontend gửi lên (nếu upload 1 file thì gộp thành mảng luôn)
        let customNames = req.body.customNames;
        if (!Array.isArray(customNames)) {
            customNames = [customNames];
        }

        let newRecords = [];
        let errors = [];

        files.forEach((file, index) => {
            const tempPath = file.path;
            const originalNameFix = Buffer.from(file.originalname, 'latin1').toString('utf8');
            const ext = path.extname(originalNameFix);

            // Đọc tên tùy chỉnh tương ứng của file tại index này, nếu trống thì fallback về tên file gốc
            let eachCustomName = customNames[index] ? customNames[index].trim() : '';
            let cleanBaseName = "";

            if (eachCustomName) {
                const inputExt = path.extname(eachCustomName);
                if (inputExt.toLowerCase() === ext.toLowerCase()) {
                    cleanBaseName = removeVietnameseTones(path.basename(eachCustomName, inputExt));
                } else {
                    cleanBaseName = removeVietnameseTones(eachCustomName);
                }
            } else {
                cleanBaseName = removeVietnameseTones(path.basename(originalNameFix, ext));
            }

            // Kiểm tra trùng tên file thô (Base name)
            const isDuplicateDB = db.some(img => {
                const dbExt = path.extname(img.name);
                const dbBaseName = path.basename(img.name, dbExt);
                return dbBaseName.toLowerCase() === cleanBaseName.toLowerCase();
            });

            const finalFileName = cleanBaseName + ext;
            const targetFilePath = path.join(UPLOAD_DIR, finalFileName);
            const isDuplicateDisk = fs.existsSync(targetFilePath);

            if (isDuplicateDB || isDuplicateDisk) {
                fs.unlinkSync(tempPath);
                errors.push(`Tên tệp "${cleanBaseName}" đã tồn tại (Bị chặn trùng tên thô).`);
                return;
            }

            fs.renameSync(tempPath, targetFilePath);

            const imageData = {
                name: finalFileName,
                url: `/uploads/${finalFileName}`,
                hashtags: hashtags,
                description: description,
                likes: 0,
                comments: [],
                uploadedAt: new Date().toISOString()
            };

            newRecords.push(imageData);
        });

        if (newRecords.length === 0) {
            return res.status(400).json({ success: false, message: errors.join('\n') });
        }

        db.push(...newRecords);
        writeDB(db);

        let msg = `Đã tải lên ${newRecords.length} tệp tin thành công.`;
        if (errors.length > 0) msg += `\nCảnh báo lỗi trùng tên:\n` + errors.join('\n');

        res.json({ success: true, message: msg });

    } catch (error) {
        if (files) files.forEach(f => { if (fs.existsSync(f.path)) fs.unlinkSync(f.path); });
        res.status(500).json({ success: false, message: error.message });
    }
});

// Các API Lấy danh sách, Xóa, Sửa, Like, Comment giữ nguyên hoàn toàn giống bản cũ...
app.get('/api/images', (req, res) => {
    try {
        const search = (req.query.search || '').toLowerCase().trim();
        const db = readDB();
        let filtered = db;
        if (search) filtered = db.filter(img => img.name.toLowerCase().includes(search) || img.hashtags.some(tag => tag.includes(search)));
        filtered.sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));
        res.json(filtered);
    } catch (error) { res.status(500).json({ success: false, message: error.message }); }
});
app.delete('/api/images/:name', (req, res) => {
    try {
        if (req.query.isAdmin !== '1') return res.status(403).json({ success: false, message: 'Từ chối!' });
        const name = req.params.name; let db = readDB(); const idx = db.findIndex(i => i.name === name);
        if (idx === -1) return res.status(404).json({ success: false });
        const filePath = path.join(UPLOAD_DIR, name); if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        db.splice(idx, 1); writeDB(db); res.json({ success: true, message: 'Xóa thành công.' });
    } catch (e) { res.status(500).json({ success: false }); }
});
app.put('/api/images/:name', upload.single('newImage'), (req, res) => {
    try {
        if (req.query.isAdmin !== '1') return res.status(403).json({ success: false });
        const oldName = req.params.name; let db = readDB(); const idx = db.findIndex(i => i.name === oldName);
        if (idx === -1) return res.status(404).json({ success: false });
        let finalFileName = oldName;
        if (req.body.newName) {
            const inputName = req.body.newName.trim(); const oldExt = path.extname(oldName); const inputExt = path.extname(inputName);
            let cleanNewBaseName = inputExt.toLowerCase() === oldExt.toLowerCase() ? removeVietnameseTones(path.basename(inputName, inputExt)) : removeVietnameseTones(inputName);
            const isDuplicateEdit = db.some((img, i) => i !== idx && path.basename(img.name, path.extname(img.name)).toLowerCase() === cleanNewBaseName.toLowerCase());
            finalFileName = cleanNewBaseName + oldExt;
            if (isDuplicateEdit) return res.status(400).json({ success: false, message: 'Tên bài đăng đã tồn tại.' });
            if (finalFileName !== oldName) {
                if (fs.existsSync(path.join(UPLOAD_DIR, finalFileName))) return res.status(400).json({ success: false, message: 'Tệp vật lý trùng.' });
                if (fs.existsSync(path.join(UPLOAD_DIR, oldName))) fs.renameSync(path.join(UPLOAD_DIR, oldName), path.join(UPLOAD_DIR, finalFileName));
            }
        }
        db[idx] = { ...db[idx], name: finalFileName, url: `/uploads/${finalFileName}`, hashtags: req.body.hashtags ? req.body.hashtags.split(',').map(t => t.trim().toLowerCase()).filter(t => t) : [], description: req.body.description || '', uploadedAt: new Date().toISOString() };
        writeDB(db); res.json({ success: true, message: 'Cập nhật thành công.' });
    } catch (e) { res.status(500).json({ success: false }); }
});
app.post('/api/images/:name/like', (req, res) => {
    try { let db = readDB(); const idx = db.findIndex(i => i.name === req.params.name); db[idx].likes = (db[idx].likes || 0) + 1; writeDB(db); res.json({ success: true, likes: db[idx].likes }); } catch (e) { res.status(500).json({ success: false }); }
});
app.post('/api/images/:name/comment', (req, res) => {
    try {
        const { text } = req.body; let db = readDB(); const idx = db.findIndex(i => i.name === req.params.name); if (!db[idx].comments) db[idx].comments = [];
        db[idx].comments.push({ id: Date.now(), author: 'Ẩn danh', text: text.trim(), createdAt: new Date().toISOString() }); writeDB(db); res.json({ success: true });
    } catch (e) { res.status(500).json({ success: false }); }
});
app.listen(PORT, '0.0.0.0', () => {
    console.log(`=====================================================`);
    console.log(` 🖤 🔶  HỆ THỐNG TRUY CẬP MEDIA BEOHUB ĐANG HOẠT ĐỘNG`);
    console.log(`=====================================================`);
});