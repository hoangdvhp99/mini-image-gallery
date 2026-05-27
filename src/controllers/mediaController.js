const path = require('path');
const fs = require('fs');
const { db, UPLOAD_DIR } = require('../config/db');
const { removeVietnameseTones } = require('../utils/vietnamese');

exports.uploadMedia = (req, res) => {
    const files = req.files;

    if (!files || files.length === 0) {
        return res.status(400).json({ success: false, message: 'Không có tệp tin nào được tải lên.' });
    }

    try {
        const hashtags = req.body.hashtags ? req.body.hashtags.split(',').map(t => t.trim().toLowerCase()).filter(t => t) : [];
        const description = req.body.description || '';

        let customNames = req.body.customNames;
        if (!Array.isArray(customNames)) {
            customNames = [customNames];
        }

        let newRecords = [];
        let errors = [];

        const checkDuplicateStmt = db.prepare('SELECT count(*) as count FROM media WHERE LOWER(name) LIKE ?');
        const insertStmt = db.prepare('INSERT INTO media (name, url, hashtags, description, category, likes, hahas, comments, uploadedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');

        db.transaction(() => {
            files.forEach((file, index) => {
                const tempPath = file.path;
                const originalNameFix = Buffer.from(file.originalname, 'latin1').toString('utf8');
                const ext = path.extname(originalNameFix);

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

                // Check DB duplicate
                const dupCount = checkDuplicateStmt.get(`%${cleanBaseName}%`).count;
                // Since base name can have any extension, we could check without ext, but % deals with it loosely
                // For exact match: check if cleanBaseName matches the base name in db. SQLite doesn't have good path.basename out of box.
                // We'll just fetch by name if it exists exactly with this extension
                const finalFileName = cleanBaseName + ext;
                const exist = db.prepare('SELECT name FROM media WHERE name = ?').get(finalFileName);

                const targetFilePath = path.join(UPLOAD_DIR, finalFileName);
                const isDuplicateDisk = fs.existsSync(targetFilePath);

                if (exist || isDuplicateDisk) {
                    if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
                    errors.push(`Tên tệp "${cleanBaseName}" đã tồn tại (Bị chặn trùng tên thô).`);
                    return;
                }

                fs.renameSync(tempPath, targetFilePath);

                const now = new Date().toISOString();
                insertStmt.run(
                    finalFileName,
                    `/uploads/${finalFileName}`,
                    JSON.stringify(hashtags),
                    description,
                    req.body.category || 'home',
                    0,
                    0,
                    '[]',
                    now
                );

                newRecords.push(finalFileName);
            });
        })();

        if (newRecords.length === 0) {
            return res.status(400).json({ success: false, message: errors.join('\n') });
        }

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
        let rows = [];
        if (search) {
            rows = db.prepare('SELECT * FROM media WHERE LOWER(name) LIKE ? OR LOWER(hashtags) LIKE ? ORDER BY uploadedAt DESC').all(`%${search}%`, `%${search}%`);
        } else {
            rows = db.prepare('SELECT * FROM media ORDER BY uploadedAt DESC').all();
        }
        
        const results = rows.map(r => ({
            ...r,
            hashtags: JSON.parse(r.hashtags),
            comments: JSON.parse(r.comments)
        }));
        res.json(results);
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.deleteMedia = (req, res) => {
    try {
        if (!req.session || !req.session.isAdmin) return res.status(403).json({ success: false, message: 'Từ chối!' });
        const name = req.params.name;
        
        const info = db.prepare('DELETE FROM media WHERE name = ?').run(name);
        if (info.changes === 0) return res.status(404).json({ success: false });
        
        const filePath = path.join(UPLOAD_DIR, name);
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        
        res.json({ success: true, message: 'Xóa thành công.' });
    } catch (e) {
        res.status(500).json({ success: false });
    }
};

exports.updateMedia = (req, res) => {
    try {
        if (!req.session || !req.session.isAdmin) return res.status(403).json({ success: false });
        const oldName = req.params.name;
        const row = db.prepare('SELECT * FROM media WHERE name = ?').get(oldName);
        if (!row) return res.status(404).json({ success: false });
        
        let finalFileName = oldName;
        if (req.body.newName) {
            const inputName = req.body.newName.trim();
            const oldExt = path.extname(oldName);
            const inputExt = path.extname(inputName);
            let cleanNewBaseName = inputExt.toLowerCase() === oldExt.toLowerCase() ? removeVietnameseTones(path.basename(inputName, inputExt)) : removeVietnameseTones(inputName);
            
            finalFileName = cleanNewBaseName + oldExt;
            if (finalFileName !== oldName) {
                const exist = db.prepare('SELECT name FROM media WHERE name = ?').get(finalFileName);
                if (exist) return res.status(400).json({ success: false, message: 'Tên bài đăng đã tồn tại.' });
                
                if (fs.existsSync(path.join(UPLOAD_DIR, finalFileName))) return res.status(400).json({ success: false, message: 'Tệp vật lý trùng.' });
                if (fs.existsSync(path.join(UPLOAD_DIR, oldName))) fs.renameSync(path.join(UPLOAD_DIR, oldName), path.join(UPLOAD_DIR, finalFileName));
            }
        }
        const oldCategory = row.category || 'home';
        const newCategory = req.body.category || 'home';
        const hashtags = req.body.hashtags ? req.body.hashtags.split(',').map(t => t.trim().toLowerCase()).filter(t => t) : [];
        const description = req.body.description || '';

        if (newCategory !== oldCategory) {
            const oldExt = path.extname(finalFileName);
            const baseName = path.basename(finalFileName, oldExt);
            let copyFileName = `${baseName}_copy${oldExt}`;
            
            let counter = 1;
            while (
                db.prepare('SELECT name FROM media WHERE name = ?').get(copyFileName) || 
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
            
            // Update old record
            db.prepare('UPDATE media SET name = ?, url = ?, hashtags = ?, description = ? WHERE name = ?').run(
                finalFileName, `/uploads/${finalFileName}`, JSON.stringify(hashtags), description, oldName
            );

            // Insert new copied record
            db.prepare('INSERT INTO media (name, url, hashtags, description, category, likes, hahas, comments, uploadedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').run(
                copyFileName, `/uploads/${copyFileName}`, JSON.stringify(hashtags), description, newCategory, row.likes, row.hahas, row.comments, new Date().toISOString()
            );

            res.json({ success: true, message: 'Đã nhân bản và copy thêm 1 bản sang nơi hiển thị mới thành công!' });
        } else {
            db.prepare('UPDATE media SET name = ?, url = ?, hashtags = ?, description = ?, category = ? WHERE name = ?').run(
                finalFileName, `/uploads/${finalFileName}`, JSON.stringify(hashtags), description, newCategory, oldName
            );
            res.json({ success: true, message: 'Cập nhật thành công.' });
        }
    } catch (e) {
        res.status(500).json({ success: false });
    }
};

exports.likeMedia = (req, res) => {
    try {
        db.prepare('UPDATE media SET likes = likes + 1 WHERE name = ?').run(req.params.name);
        const row = db.prepare('SELECT likes FROM media WHERE name = ?').get(req.params.name);
        res.json({ success: true, likes: row ? row.likes : 0 });
    } catch (e) {
        res.status(500).json({ success: false });
    }
};

exports.hahaMedia = (req, res) => {
    try {
        db.prepare('UPDATE media SET hahas = hahas + 1 WHERE name = ?').run(req.params.name);
        const row = db.prepare('SELECT hahas FROM media WHERE name = ?').get(req.params.name);
        res.json({ success: true, hahas: row ? row.hahas : 0 });
    } catch (e) {
        res.status(500).json({ success: false });
    }
};

exports.commentMedia = (req, res) => {
    try {
        const { text } = req.body;
        const row = db.prepare('SELECT comments FROM media WHERE name = ?').get(req.params.name);
        if (!row) return res.status(404).json({ success: false });

        let comments = JSON.parse(row.comments || '[]');
        comments.push({
            id: Date.now(),
            author: 'Ẩn danh',
            text: text.trim(),
            createdAt: new Date().toISOString()
        });

        db.prepare('UPDATE media SET comments = ? WHERE name = ?').run(JSON.stringify(comments), req.params.name);
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ success: false });
    }
};
