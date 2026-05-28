const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../data/dino_scores.json');

try {
    fs.writeFileSync(filePath, '[]', 'utf8');
    console.log('✅ Đã reset thành công bảng xếp hạng Beo Dino!');
} catch (error) {
    console.error('❌ Lỗi khi reset bảng xếp hạng Dino:', error);
}
