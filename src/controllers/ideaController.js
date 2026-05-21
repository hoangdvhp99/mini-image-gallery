const { readIdeasDB, writeIdeasDB } = require('../config/db');
const fs = require('fs');
const path = require('path');

exports.getIdeas = (req, res) => {
    try {
        const ideas = readIdeasDB();
        // Sắp xếp theo số lượt thích (likes) giảm dần, sau đó đến ngày tạo mới nhất
        ideas.sort((a, b) => {
            if (b.likes !== a.likes) {
                return b.likes - a.likes;
            }
            return new Date(b.createdAt) - new Date(a.createdAt);
        });
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

        const ideas = readIdeasDB();
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

        ideas.push(newIdea);
        writeIdeasDB(ideas);

        res.json({ success: true, message: 'Ý tưởng đã được đóng góp thành công!', data: newIdea });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Không thể lưu ý tưởng đóng góp.' });
    }
};

exports.likeIdea = (req, res) => {
    try {
        const id = req.params.id;
        const ideas = readIdeasDB();
        const idx = ideas.findIndex(idea => idea.id === id);

        if (idx === -1) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy ý tưởng.' });
        }

        ideas[idx].likes = (ideas[idx].likes || 0) + 1;
        writeIdeasDB(ideas);

        res.json({ success: true, likes: ideas[idx].likes });
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
        const fixedFacePath = path.join(__dirname, '../../src/assets/face.jpg');

        // Xác minh xem file đích face.jpg có tồn tại hay không
        if (!fs.existsSync(fixedFacePath)) {
            // Xóa file upload tạm thời
            try { fs.unlinkSync(userUploadedPath); } catch (e) {}
            return res.status(400).json({ success: false, message: 'Không tìm thấy ảnh mẫu cố định trong hệ thống.' });
        }

        const { Client, handle_file } = await import('@gradio/client');

        // Kết nối tới public Space trên Hugging Face
        const client = await Client.connect("Dentro/face-swap");

        // Gọi model AI để hoán đổi
        // Tham số 0: sourceImage (Khuôn mặt sẽ được lấy để dán lên) -> Khuôn mặt cố định
        // Tham số 2: destinationImage (Bức ảnh sẽ bị thay thế khuôn mặt) -> Ảnh người dùng tải lên
        const result = await client.predict(0, [
            handle_file(fixedFacePath), // sourceImage (The face to use)
            1,                          // sourceFaceIndex
            handle_file(userUploadedPath), // destinationImage (The photo to modify)
            1                           // destinationFaceIndex
        ]);

        if (result && result.data && result.data[0] && result.data[0].url) {
            const swappedUrl = result.data[0].url;
            const resImageName = `swapped-${Date.now()}.webp`;
            const localSwappedPath = path.join(__dirname, '../../public/uploads', resImageName);

            // Tải ảnh kết quả từ Hugging Face về lưu trữ nội bộ mạng LAN
            const response = await fetch(swappedUrl);
            const buffer = await response.arrayBuffer();
            await fs.promises.writeFile(localSwappedPath, Buffer.from(buffer));

            // Dọn dẹp ảnh tạm thời đã tải lên ban đầu
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
        // Dọn dẹp ảnh tạm thời nếu gặp sự cố
        if (req.file && req.file.path && fs.existsSync(req.file.path)) {
            try { fs.unlinkSync(req.file.path); } catch (e) {}
        }
        console.error("Lỗi khi hoán đổi khuôn mặt:", error);
        res.status(500).json({ success: false, message: 'Lỗi hệ thống khi hoán đổi khuôn mặt AI: ' + error.message });
    }
};
