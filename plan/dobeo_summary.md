# Tài liệu tổng quan: Dò Beo (Minesweeper Siêu Bựa)

## 1. Overview (Tổng Quan)

Dò Beo là một minigame dựa trên cơ chế của trò chơi dò mìn (Minesweeper) kinh điển, nhưng được "chế" lại theo phong cách độc quyền và hài hước của BeoHub. 

**Cốt truyện / Bối cảnh:**
- **Mìn (Mines):** Thay vì mìn, người chơi phải tránh click trúng "Lbeo đang ngủ" (Bom/Lbeo). Nếu đánh thức Lbeo, bạn sẽ "Bị ép uống phạt" (Game Over).
- **Cờ (Flags):** Để đánh dấu vị trí nghi ngờ có Lbeo, người chơi sẽ đặt "Cốc Bia" (🍺).
- **Ô an toàn (Safe cells):** Khi mở thành công một ô an toàn, người chơi sẽ "Nhặt được Lạc" (🥜). Mục tiêu là phải luộc (mở) hết toàn bộ đĩa lạc mà không đánh thức Lbeo.

**Tính năng chính:**
- 3 mức độ khó: Làm Tí (9x9, 10 Lbeo), Tới Bến (16x16, 40 Lbeo), Bất Tỉnh (24x24, 99 Lbeo).
- Cơ chế bảo vệ click đầu tiên (First-click safety): Lần click đầu tiên luôn an toàn và tự động mở ra một mảng trống lớn (thuật toán chuyển mìn hoặc đặt mìn sau cú click đầu).
- Chording (Mở nhanh): Click chuột phải vào ô số đã mở để mở ngay lập tức tất cả các ô xung quanh nếu đã cắm đủ cờ (bia).
- Hỗ trợ đa nền tảng: Chơi bằng chuột trên PC (Left Click mở, Right Click cắm cờ/mở nhanh) và cảm ứng trên Mobile (Chạm mở, Giữ lâu cắm cờ).
- Giao diện Dark mode sang trọng với Canvas rendering mượt mà, tự động co giãn kích thước (Responsive).

---

## 2. Plan (Kế hoạch kiến trúc)

Minigame Dò Beo được cấu trúc dựa trên mô hình Hướng đối tượng (OOP) thuần Javascript trên nền Canvas.

**Cấu trúc thư mục liên quan:**
- `public/js/dobeo.js`: Chứa toàn bộ logic lõi của trò chơi (`class DobeoGame`).
- `views/minigame.ejs`: Chứa HTML layout cho Dò Beo (`#dobeoPlayground`), bao gồm phần chọn mức độ, bộ đếm giờ, đếm bia (cờ), nút chơi lại và thoát.

**Luồng hoạt động (Workflow):**
1. **Khởi tạo:** Khi người dùng nhấn nút "Chơi Ngay" ở màn hình Minigame, hàm `startDobeoGame()` sẽ hiển thị `#dobeoPlayground` và khởi tạo đối tượng `new DobeoGame()`.
2. **Vẽ giao diện (Render):** Canvas sẽ tự động tính toán kích thước (dựa trên màn hình và cấu hình lưới) -> gọi hàm `draw()` để vẽ các ô lưới, màu sắc, bóng đổ và các Emoji.
3. **Xử lý Tương tác (Events):**
   - Sự kiện `mousedown`/`mouseup` để bắt click trái/phải.
   - Sự kiện `touchstart`/`touchend` kết hợp với `setTimeout` để xử lý "Long Press" (cắm cờ) trên điện thoại.
4. **Logic Game (Cập nhật trạng thái):**
   - Click trái: Chạy hàm `reveal(r, c)`. Nếu trúng mìn -> `gameOver()`. Nếu là ô 0 -> chạy thuật toán Flood Fill / BFS để đệ quy mở các ô xung quanh. Kiểm tra điều kiện thắng (`checkWin()`).
   - Cắm cờ (Click phải vào ô chưa mở): Thay đổi trạng thái ô thành `flagged`, cập nhật giao diện "Ly bia còn lại".
   - Chording (Click phải vào ô đã mở): Đếm số cờ xung quanh. Nếu bằng với giá trị của ô, gọi hàm `chordCell()` để mở nhanh 8 ô lân cận. Nếu cắm cờ sai (mở trúng Lbeo) -> `gameOver()`.

---

## 3. Những gì đã làm được (Implemented Features)

- [x] **Logic Lưới & Mìn:** Đã triển khai thuật toán tạo lưới động (9x9, 16x16, 24x24) và rải mìn ngẫu nhiên (Fisher-Yates shuffle hoặc random allocation).
- [x] **First-Click Safety:** Cú click đầu tiên đảm bảo mở ra ô trống (giá trị 0). Logic: Đợi người dùng click ô đầu, gán ô đó an toàn, sau đó mới rải mìn ở các ô còn lại, cuối cùng gọi hàm `reveal()` cho ô đó.
- [x] **Canvas Rendering:** 
  - Đã xử lý vẽ ô lưới trạng thái đóng (ẩn), mở (số từ 1-8).
  - Gắn màu sắc khác nhau cho từng số lượng mìn xung quanh (vd: 1 màu xanh dương, 2 màu xanh lá, 3 màu đỏ...).
  - Tích hợp Emoji: Cờ = 🍺, Mìn = 💣 (khi nổ), Ô an toàn = 🥜.
- [x] **Event Handlers:**
  - Hoạt động tốt với chuột trái/phải trên Desktop (bao gồm cả thao tác cắm cờ và mở nhanh Chording).
  - Xử lý được thao tác Long-press để cắm cờ trên Mobile/Tablet.
- [x] **Chording (Mở nhanh):** Cài đặt tính năng tự động mở 8 ô lân cận khi click chuột phải vào ô số nếu xung quanh đã cắm đủ số cờ tương ứng. Cảnh báo Game Over tự động nếu cắm cờ sai.
- [x] **UI/UX:**
  - Tự động thay đổi kích thước bàn chơi (Responsive Resize) khi đổi thiết bị hoặc lật màn hình (`window.addEventListener('resize')`).
  - Giao diện tính thời gian và tính số lượng "Ly bia còn lại" cập nhật theo thời gian thực.
  - Tích hợp Toast notification thông báo Thắng/Thua.
  - Nút "Thoát" và "Chơi lại" hoạt động ổn định, dọn dẹp các Interval và Events cũ trước khi reset để tránh memory leak.
- [x] **Tích hợp Layout Full-screen:** Đã tháo bỏ giới hạn `max-w-4xl`, bàn chơi giờ đây trải dài tự nhiên trên màn hình lớn.

---

## 4. Hướng dẫn dành cho Người bảo trì (Maintainer)

Nếu bạn muốn tiếp tục phát triển Dò Beo, đây là một số gợi ý cải tiến:

1. **Hiệu ứng âm thanh:** Có thể thêm Web Audio API vào các hành động như khi mở ô an toàn (tiếng "bụp" nhẹ), khi nổ mìn (tiếng nổ), khi chiến thắng (âm thanh vỗ tay/ting ting).
2. **Particle Effects (Pháo hoa/Mảnh vỡ):** Thêm canvas particle khi Lbeo nổ tung, hoặc hiệu ứng pháo hoa bằng HTML khi người chơi chiến thắng (có thể tái sử dụng hàm `triggerDonationAnimation` bên `app.js`).
3. **Bảng Xếp Hạng (Leaderboard):**
   - Thu thập thời gian hoàn thành nhanh nhất theo từng mức độ khó.
   - Gửi API về backend lưu kỷ lục người chơi.
4. **Giao diện Responsive phức tạp:** Với mức Bất Tỉnh (24x24) trên màn hình dọc của điện thoại, kích thước ô (cell) có thể hơi nhỏ. Xem xét bổ sung tính năng Pan/Zoom (Kéo/Phóng to) bàn chơi để dễ bấm trên điện thoại.
