# 🖼️ Mini Lbeo Gallery

Một ứng dụng lưu trữ và quản lý ảnh nhỏ gọn, chạy trên môi trường local và chia sẻ dễ dàng trong mạng LAN. Hỗ trợ upload hàng loạt, tìm kiếm theo hashtag và tự động ghi đè khi trùng tên file.

## ✨ Tính năng chính
- **Upload hàng loạt:** Chọn nhiều ảnh cùng lúc để tải lên.
- **Tự động ghi đè:** Nếu tên file ảnh trùng với ảnh cũ, hệ thống sẽ tự động cập nhật nội dung và thông tin mới.
- **Tìm kiếm thông minh:** Tìm kiếm nhanh theo tên file hoặc các hashtag đính kèm.
- **Quản lý dữ liệu nhẹ:** Lưu trữ thông tin dưới dạng file JSON (không cần cài đặt Database phức tạp).
- **Chia sẻ mạng LAN:** Mọi thiết bị trong cùng mạng Wifi/LAN đều có thể truy cập, xem và tải ảnh.
- **Tiện ích:** Có nút Copy file ảnh trực tiếp vào Clipboard (để dán vào Chat) và nút Download.

## 🛠️ Tech Stack
- **Backend:** Node.js, Express.js.
- **Frontend:** HTML5, Tailwind CSS (via CDN), Vanilla JavaScript.
- **Lưu trữ:** Multer (xử lý file), JSON (lưu metadata).

## 🚀 Hướng dẫn cài đặt

### 1. Yêu cầu hệ thống
- Máy tính đã cài đặt [Node.js](https://nodejs.org/) (phiên bản 14 trở lên).

### 2. Cài đặt
Giải nén thư mục dự án và mở terminal tại thư mục đó:
```bash
npm install