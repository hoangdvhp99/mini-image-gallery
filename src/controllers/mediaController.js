const path = require('path');
const fs = require('fs');
const { readDB, writeDB, UPLOAD_DIR } = require('../config/db');
const { removeVietnameseTones } = require('../utils/vietnamese');

exports.uploadMedia = (req, res) => {
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
                if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
                errors.push(`Tên tệp "${cleanBaseName}" đã tồn tại (Bị chặn trùng tên thô).`);
                return;
            }

            fs.renameSync(tempPath, targetFilePath);

            const imageData = {
                name: finalFileName,
                url: `/uploads/${finalFileName}`,
                hashtags: hashtags,
                description: description,
                category: req.body.category || 'home',
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
};

exports.getMediaList = (req, res) => {
    try {
        const search = (req.query.search || '').toLowerCase().trim();
        const db = readDB();
        let filtered = db;
        if (search) {
            filtered = db.filter(img => img.name.toLowerCase().includes(search) || img.hashtags.some(tag => tag.includes(search)));
        }
        filtered.sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));
        res.json(filtered);
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.deleteMedia = (req, res) => {
    try {
        if (req.query.isLbeo !== '0') return res.status(403).json({ success: false, message: 'Từ chối!' });
        const name = req.params.name;
        let db = readDB();
        const idx = db.findIndex(i => i.name === name);
        if (idx === -1) return res.status(404).json({ success: false });
        const filePath = path.join(UPLOAD_DIR, name);
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        db.splice(idx, 1);
        writeDB(db);
        res.json({ success: true, message: 'Xóa thành công.' });
    } catch (e) {
        res.status(500).json({ success: false });
    }
};

exports.updateMedia = (req, res) => {
    try {
        if (req.query.isLbeo !== '0') return res.status(403).json({ success: false });
        const oldName = req.params.name;
        let db = readDB();
        const idx = db.findIndex(i => i.name === oldName);
        if (idx === -1) return res.status(404).json({ success: false });
        let finalFileName = oldName;
        if (req.body.newName) {
            const inputName = req.body.newName.trim();
            const oldExt = path.extname(oldName);
            const inputExt = path.extname(inputName);
            let cleanNewBaseName = inputExt.toLowerCase() === oldExt.toLowerCase() ? removeVietnameseTones(path.basename(inputName, inputExt)) : removeVietnameseTones(inputName);
            const isDuplicateEdit = db.some((img, i) => i !== idx && path.basename(img.name, path.extname(img.name)).toLowerCase() === cleanNewBaseName.toLowerCase());
            finalFileName = cleanNewBaseName + oldExt;
            if (isDuplicateEdit) return res.status(400).json({ success: false, message: 'Tên bài đăng đã tồn tại.' });
            if (finalFileName !== oldName) {
                if (fs.existsSync(path.join(UPLOAD_DIR, finalFileName))) return res.status(400).json({ success: false, message: 'Tệp vật lý trùng.' });
                if (fs.existsSync(path.join(UPLOAD_DIR, oldName))) fs.renameSync(path.join(UPLOAD_DIR, oldName), path.join(UPLOAD_DIR, finalFileName));
            }
        }
        const oldCategory = db[idx].category || 'home';
        const newCategory = req.body.category || 'home';

        if (newCategory !== oldCategory) {
            const oldExt = path.extname(finalFileName);
            const baseName = path.basename(finalFileName, oldExt);
            let copyFileName = `${baseName}_copy${oldExt}`;
            
            let counter = 1;
            while (
                db.some(img => img.name.toLowerCase() === copyFileName.toLowerCase()) || 
                fs.existsSync(path.join(UPLOAD_DIR, copyFileName))
            ) {
                copyFileName = `${baseName}_copy${counter}${oldExt}`;
                counter++;
            }
            
            const sourcePath = path.join(UPLOAD_DIR, finalFileName);
            const destPath = path.join(UPLOAD_DIR, copyFileName);
            if (fs.existsSync(sourcePath)) {
                fs.copyFileSync(sourcePath, destPath);
            }
            
            db[idx] = {
                ...db[idx],
                name: finalFileName,
                url: `/uploads/${finalFileName}`,
                hashtags: req.body.hashtags ? req.body.hashtags.split(',').map(t => t.trim().toLowerCase()).filter(t => t) : [],
                description: req.body.description || '',
                category: oldCategory,
                uploadedAt: new Date().toISOString()
            };

            const duplicatedRecord = {
                ...db[idx],
                name: copyFileName,
                url: `/uploads/${copyFileName}`,
                category: newCategory,
                uploadedAt: new Date().toISOString()
            };
            db.push(duplicatedRecord);
            writeDB(db);
            res.json({ success: true, message: 'Đã nhân bản và copy thêm 1 bản sang nơi hiển thị mới thành công!' });
        } else {
            db[idx] = {
                ...db[idx],
                name: finalFileName,
                url: `/uploads/${finalFileName}`,
                hashtags: req.body.hashtags ? req.body.hashtags.split(',').map(t => t.trim().toLowerCase()).filter(t => t) : [],
                description: req.body.description || '',
                category: newCategory,
                uploadedAt: new Date().toISOString()
            };
            writeDB(db);
            res.json({ success: true, message: 'Cập nhật thành công.' });
        }
    } catch (e) {
        res.status(500).json({ success: false });
    }
};

exports.likeMedia = (req, res) => {
    try {
        let db = readDB();
        const idx = db.findIndex(i => i.name === req.params.name);
        db[idx].likes = (db[idx].likes || 0) + 1;
        writeDB(db);
        res.json({ success: true, likes: db[idx].likes });
    } catch (e) {
        res.status(500).json({ success: false });
    }
};

exports.hahaMedia = (req, res) => {
    try {
        let db = readDB();
        const idx = db.findIndex(i => i.name === req.params.name);
        db[idx].hahas = (db[idx].hahas || 0) + 1;
        writeDB(db);
        res.json({ success: true, hahas: db[idx].hahas });
    } catch (e) {
        res.status(500).json({ success: false });
    }
};

exports.commentMedia = (req, res) => {
    try {
        const { text } = req.body;
        let db = readDB();
        const idx = db.findIndex(i => i.name === req.params.name);
        if (!db[idx].comments) db[idx].comments = [];
        db[idx].comments.push({
            id: Date.now(),
            author: 'Ẩn danh',
            text: text.trim(),
            createdAt: new Date().toISOString()
        });
        writeDB(db);
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ success: false });
    }
};
