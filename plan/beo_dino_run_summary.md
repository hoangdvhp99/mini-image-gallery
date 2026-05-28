# Tổng hợp các tính năng và cải tiến đã thực hiện cho Game Beo Dino Run

Dưới đây là danh sách toàn bộ những thay đổi, nâng cấp và sửa lỗi đã được thực hiện để hoàn thiện mini-game **Beo Dino Run**:

### 1. Quản lý Tài nguyên (Assets) & Khả năng mở rộng
- **Nhân vật động:** Thay đổi hệ thống nạp nhân vật từ dạng tĩnh (`beo-sprit`) sang dạng động. Game tự động đếm và nạp các nhân vật có trong thư mục `public/img/beo-dino/characters/` (hỗ trợ nhiều nhân vật hơn, tự động nạp ảnh `1.png`, `2.png`...).
- **Chướng ngại vật ngẫu nhiên:** Chia thư mục chướng ngại vật thành `birds` (chướng ngại vật bay) và `plants` (chướng ngại vật dưới đất) trong `public/img/beo-dino/items/`. Game sẽ tự động load ngẫu nhiên ảnh trong này, giúp sau này cực kỳ dễ dàng mở rộng (chỉ cần vứt thêm ảnh vào folder là xong).
- **Trang trí cảnh quan:** Thay thế mặt trời (trước đây được vẽ bằng code Canvas hình tròn) bằng ảnh thiết kế `sun.png` ở thư mục items để đồ họa đẹp hơn.
- **Vật phẩm (Buff):** Đổi tên vật phẩm thu thập từ "trà sữa" thành "bia" theo đúng yêu cầu.

### 2. Cải thiện Gameplay & Trải nghiệm Người dùng (UX)
- **Tăng kích thước màn hình:** Mở rộng không gian chơi (`h-[400px] md:h-[600px]`) giúp góc nhìn thoáng hơn, dễ nhìn chướng ngại vật hơn (tương tự như màn hình rộng của Pikabeo).
- **Vật lý (Physics):** Tăng sức bật nhảy (`jumpPower = -14.5`) giúp nhân vật nhảy cao hơn, tránh việc quá khó khi vượt qua các chướng ngại vật to.
- **Sửa lỗi Hitbox ảo (Chưa chạm đã chết):** Tinh chỉnh lại ranh giới va chạm (Collision Hitbox) bằng cách thêm các biến số margin (cắt bớt những khoảng trong suốt thừa của ảnh png), giúp việc va chạm trở nên chính xác tuyệt đối.
- **Chống "Kẹt xe" chướng ngại vật:** 
  - Khắc phục lỗi chí mạng khiến nhiều chướng ngại vật sinh ra đè lên nhau cùng 1 lúc (do dùng hàm Modulo random theo từng khung hình). Đã chuyển sang dùng logic `nextSpawnFrame` với khoảng cách cố định.
  - Thêm logic giảm tỷ lệ sinh ra 2 cây xương rồng (Cactus) liên tiếp nhau.
- **Làm rõ vật thể:** Tăng kích thước vẽ chướng ngại vật lên to và rõ ràng hơn.

### 3. Tối ưu Kiến trúc Backend & Database
- **Chuyển đổi sang SQLite:** Nâng cấp toàn bộ hệ thống lưu trữ bảng xếp hạng từ file `dino_scores.json` sang bảng `dino_scores` trong CSDL `database.sqlite` (dùng `better-sqlite3`), giúp chấm dứt vĩnh viễn tình trạng tràn CPU hoặc lỗi file (race condition) khi có nhiều truy cập cùng lúc.
- **Chống Duplicate Bảng Xếp Hạng:** Viết lại logic API `POST /api/dino/scores`. Giờ đây nếu một người chơi (trùng tên) ghi điểm mới:
  - Nếu điểm mới cao hơn: Cập nhật đè lên điểm cũ.
  - Nếu điểm mới thấp hơn: Bỏ qua và giữ nguyên thành tích cao nhất.
  - Tính toán thứ hạng siêu tốc bằng truy vấn SQL `SELECT COUNT(*) + 1`.
- **Script Bảo trì:**
  - Tạo script `scripts/migrate_scores.js` để tự động đẩy dữ liệu JSON cũ sang SQLite.
  - Sửa script `scripts/reset_dino_leaderboard.js` dùng lệnh SQL `DELETE FROM` để xóa an toàn tuyệt đối.

### 4. Tối ưu Hệ thống Deploy
- **Cache Busting:** Áp dụng tham số query động (`?v=<%= version %>`) vào toàn bộ file JS, CSS. Trình duyệt sẽ tự động bắt buộc tải file mới nhất ngay sau mỗi lần bạn khởi động lại server/deploy mà **không cần phải dùng Tab Ẩn Danh** nữa.
