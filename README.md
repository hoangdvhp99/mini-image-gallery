# 🖼️ BeoHub - Mini Media Gallery & LAN Sharing

Một ứng dụng web lưu trữ, quản lý và chia sẻ hình ảnh & video nhỏ gọn, được tối ưu hóa để chạy trên môi trường local và chia sẻ tốc độ cao qua mạng nội bộ (LAN).

---

## ✨ Tính năng nổi bật

- **📤 Kéo thả & Tải lên hàng loạt:** Hỗ trợ kéo thả hình ảnh/video trực tiếp hoặc duyệt file từ thiết bị. Cho phép upload nhiều tệp tin cùng một lúc.
- **✏️ Đặt tên & Xem trước linh hoạt:** Xem trước hình ảnh/video đã chọn và tùy chỉnh đặt lại tên riêng biệt cho từng tệp tin ngay trước khi nhấn tải lên.
- **🛡️ Kiểm soát trùng lặp:** Hệ thống tự động lọc bỏ dấu tiếng Việt, ký tự đặc biệt của tên tệp và kiểm tra trùng tên trên cả đĩa vật lý lẫn cơ sở dữ liệu để ngăn chặn ghi đè ngoài ý muốn.
- **🔍 Tìm kiếm thông minh:** Ô tìm kiếm thời gian thực giúp lọc nhanh các tệp phương tiện theo tên hoặc hashtag liên quan.
- **💬 Tương tác xã hội:**
  - **Thả tim (Like):** Bày tỏ sự yêu thích cho các tác phẩm truyền thông.
  - **Bình luận (Comment):** Thảo luận dưới dạng ẩn danh theo thời gian thực.
- **🔗 Chia sẻ nhanh (LAN Deeplinking):** Hỗ trợ nút sao chép liên kết chia sẻ trực tiếp. Khi người dùng truy cập liên kết dạng này, hệ thống tự động mở Modal chi tiết tệp tin đó.
- **⚙️ Chế độ Admin:** Truy cập thông qua tham số `?isLbeo=0` trên URL để mở quyền **Chỉnh sửa thông tin** (tên tệp, mô tả, hashtag) hoặc **Xóa vĩnh viễn** phương tiện.

---

## 🛠️ Tech Stack & Công nghệ

- **Backend:** Node.js, Express.js.
- **Frontend:** HTML5, Tailwind CSS (via CDN), Vanilla JavaScript.
- **Xử lý tệp tin:** Multer middleware (hỗ trợ lọc định dạng và lưu trữ tạm thời).
- **Cơ sở dữ liệu:** File JSON (`data/db.json`) lưu trữ metadata gọn nhẹ, không yêu cầu cài đặt hệ quản trị cơ sở dữ liệu phức tạp.

---

## 🚀 Hướng dẫn cài đặt & Chạy ứng dụng

### 1. Yêu cầu hệ thống
- Đã cài đặt [Node.js](https://nodejs.org/) (phiên bản 14 trở lên).

### 2. Cài đặt các thư viện phụ thuộc
Mở Terminal tại thư mục gốc của dự án và chạy lệnh sau:
```bash
npm install
```

### 3. Chạy ứng dụng
Khởi động máy chủ:
```bash
npm start
```
Mặc định, ứng dụng sẽ chạy tại địa chỉ:
- Truy cập local: `http://localhost:3000`
- Truy cập trong mạng LAN: `http://<IP-MÁY-CHỦ>:3000` (Thay thế `<IP-MÁY-CHỦ>` bằng địa chỉ IP cục bộ của máy chạy server, ví dụ: `192.168.1.15`).

---

## 📁 Cấu trúc thư mục dự án

```text
mini-image-gallery/
├── data/
│   └── db.json          # Cơ sở dữ liệu JSON lưu trữ metadata (tên, mô tả, tags, bình luận, lượt thích)
├── public/
│   ├── uploads/         # Thư mục chứa hình ảnh/video thực tế đã được upload thành công
│   ├── favicon.png      # Biểu tượng trang web (favicon)
│   └── index.html       # Giao diện chính của ứng dụng web (SPA)
├── package.json         # Danh sách cấu hình ứng dụng và các package phụ thuộc
├── server.js            # Máy chủ Express xử lý các API endpoint
└── README.md            # Tài liệu hướng dẫn sử dụng dự án
```

---

## 🔌 Chi tiết các API Endpoints

### 1. Phương tiện (Media)
- **`GET /api/images`**: Lấy danh sách các tệp tin phương tiện.
  - *Query Parameter:* `?search=...` (Tìm kiếm theo tên hoặc hashtag).
- **`POST /api/upload`**: Tải lên danh sách các hình ảnh/video.
  - *Form-data:* `images` (tệp tin), `hashtags` (ngăn cách bởi dấu phẩy), `description` (mô tả chung), `customNames` (mảng tên tùy chỉnh tương ứng với từng file).
- **`PUT /api/images/:name`**: Cập nhật thông tin chi tiết một phương tiện.
  - *Query Parameter:* `?isLbeo=0` (Bắt buộc).
  - *Body:* `newName`, `hashtags`, `description`.
- **`DELETE /api/images/:name`**: Xóa vĩnh viễn phương tiện khỏi đĩa và DB.
  - *Query Parameter:* `?isLbeo=0` (Bắt buộc).

### 2. Tương tác (Interactions)
- **`POST /api/images/:name/like`**: Tăng lượt thích cho tệp tin phương tiện.
- **`POST /api/images/:name/comment`**: Viết bình luận ẩn danh.
  - *Body:* `{ "text": "Nội dung bình luận" }`