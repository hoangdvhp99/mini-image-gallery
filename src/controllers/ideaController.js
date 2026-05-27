const { db } = require('../config/db');
const fs = require('fs');
const path = require('path');

exports.getIdeas = (req, res) => {
    try {
        const rows = db.prepare('SELECT * FROM ideas ORDER BY likes DESC, createdAt DESC').all();
        const ideas = rows.map(r => ({
            ...r,
            hashtags: JSON.parse(r.hashtags)
        }));
        res.json(ideas);
    } catch (error) {
        res.status(500).json({ success: false, message: 'Không thể lấy danh sách ý tưởng.' });
    }
};

exports.createIdea = (req, res) => {
    try {
        const { author, title, description, hashtags } = req.body;

        if (!title || !title.trim()) {
            return res.status(400).json({ success: false, message: 'Vui lòng nhập chủ đề ý tưởng.' });
        }
        if (!description || !description.trim()) {
            return res.status(400).json({ success: false, message: 'Vui lòng nhập chi tiết ý tưởng.' });
        }

        const parsedTags = hashtags 
            ? hashtags.split(',').map(t => t.trim().toLowerCase()).filter(t => t) 
            : [];

        const newIdea = {
            id: Date.now().toString(),
            author: (author && author.trim()) ? author.trim() : 'Ẩn danh',
            title: title.trim(),
            description: description.trim(),
            hashtags: parsedTags,
            likes: 0,
            createdAt: new Date().toISOString()
        };

        db.prepare('INSERT INTO ideas (id, author, title, description, hashtags, likes, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)').run(
            newIdea.id, newIdea.author, newIdea.title, newIdea.description, JSON.stringify(newIdea.hashtags), newIdea.likes, newIdea.createdAt
        );

        res.json({ success: true, message: 'Ý tưởng đã được đóng góp thành công!', data: newIdea });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Không thể lưu ý tưởng đóng góp.' });
    }
};

exports.likeIdea = (req, res) => {
    try {
        const id = req.params.id;
        const info = db.prepare('UPDATE ideas SET likes = likes + 1 WHERE id = ?').run(id);

        if (info.changes === 0) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy ý tưởng.' });
        }

        const row = db.prepare('SELECT likes FROM ideas WHERE id = ?').get(id);
        res.json({ success: true, likes: row.likes });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Không thể bình chọn ý tưởng.' });
    }
};

exports.swapFace = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: 'Vui lòng tải lên 1 file ảnh có chứa khuôn mặt của bạn.' });
        }

        const userUploadedPath = req.file.path;
        const { logUpload } = require('../utils/logger');
        logUpload(req, req.file.filename, req.file.originalname, 'AI FaceSwap');

        const fixedFacePath = path.join(__dirname, '../../src/assets/face.jpg');

        if (!fs.existsSync(fixedFacePath)) {
            try { fs.unlinkSync(userUploadedPath); } catch (e) {}
            return res.status(400).json({ success: false, message: 'Không tìm thấy ảnh mẫu cố định trong hệ thống.' });
        }

        const { Client, handle_file } = await import('@gradio/client');

        const client = await Client.connect("Dentro/face-swap");
        const result = await client.predict(0, [
            handle_file(fixedFacePath),
            1,
            handle_file(userUploadedPath),
            1
        ]);

        if (result && result.data && result.data[0] && result.data[0].url) {
            const swappedUrl = result.data[0].url;
            const resImageName = `swapped-${Date.now()}.webp`;
            const localSwappedPath = path.join(__dirname, '../../public/uploads', resImageName);

            const response = await fetch(swappedUrl);
            const buffer = await response.arrayBuffer();
            await fs.promises.writeFile(localSwappedPath, Buffer.from(buffer));

            try {
                await fs.promises.unlink(userUploadedPath);
            } catch (err) {}

            return res.json({
                success: true,
                message: 'Hoán đổi khuôn mặt AI thành công!',
                url: `/uploads/${resImageName}`
            });
        } else {
            throw new Error('Không nhận được dữ liệu ảnh phản hồi hợp lệ từ Hugging Face.');
        }
    } catch (error) {
        if (req.file && req.file.path && fs.existsSync(req.file.path)) {
            try { fs.unlinkSync(req.file.path); } catch (e) {}
        }
        console.error("Lỗi khi hoán đổi khuôn mặt:", error);
        
        let clientMsg = error.message || 'Lỗi hệ thống không xác định.';
        if (clientMsg.includes('includes only 0 faces') || clientMsg.includes('0 faces')) {
            clientMsg = 'Không tìm thấy khuôn mặt nào trong ảnh của bạn! Vui lòng chụp chính diện và rõ mặt hơn.';
        } else if (clientMsg.includes('fetch') || clientMsg.includes('connect')) {
            clientMsg = 'Không thể kết nối đến máy chủ AI Hugging Face. Vui lòng kiểm tra đường truyền Internet/mạng LAN!';
        }

        res.status(500).json({ success: false, message: 'Lỗi hoán đổi khuôn mặt AI: ' + clientMsg });
    }
};
