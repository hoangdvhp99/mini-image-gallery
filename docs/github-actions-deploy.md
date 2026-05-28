# Hướng dẫn thiết lập GitHub Actions để Auto Deploy

Tài liệu này hướng dẫn cách cấu hình GitHub Actions để tự động deploy dự án `mini-image-gallery` (beohub) lên server mỗi khi có thay đổi được push lên nhánh `main`.

## 1. Chuẩn bị trên Server

Trước khi cấu hình GitHub Actions, server của bạn cần được cài đặt sẵn:
- **Node.js** và **npm**
- **PM2** (Cài đặt toàn cục: `npm install -g pm2`)
- **Git**
- Thư mục dự án đã được clone từ GitHub (hoặc nguồn của bạn) về server (ví dụ: `/var/www/beohub`).

## 2. Tạo SSH Key để GitHub Actions truy cập Server

GitHub Actions cần quyền truy cập SSH vào server của bạn để chạy lệnh. Tốt nhất là tạo một SSH key riêng biệt cho việc này.

1. Truy cập vào server của bạn qua SSH bằng terminal.
2. Tạo một SSH key pair mới (nếu chưa có sẵn):
   ```bash
   ssh-keygen -t rsa -b 4096 -C "github-actions-deploy"
   ```
   *(Nhấn Enter cho tất cả các câu hỏi để giữ nguyên thư mục mặc định và để trống mật khẩu (passphrase) cho key này)*
3. Thêm public key vào file `authorized_keys` trên server để cho phép đăng nhập:
   ```bash
   cat ~/.ssh/id_rsa.pub >> ~/.ssh/authorized_keys
   chmod 600 ~/.ssh/authorized_keys
   ```
4. Copy toàn bộ nội dung của private key để lát nữa thêm vào GitHub:
   ```bash
   cat ~/.ssh/id_rsa
   ```
   *(Lưu ý: Copy từ dòng `-----BEGIN RSA PRIVATE KEY-----` cho đến hết dòng `-----END RSA PRIVATE KEY-----`)*

## 3. Cấu hình GitHub Secrets

Truy cập vào trang Repository của bạn trên GitHub -> **Settings** -> **Secrets and variables** -> **Actions** -> Nhấp vào **New repository secret**.

Bạn cần tạo các Secret sau:

- `SSH_HOST`: Địa chỉ IP (Public IP) của server bạn.
- `SSH_USER`: Tên user để SSH vào server (ví dụ: `root`, `ubuntu`, `debian`...).
- `SSH_KEY`: Dán toàn bộ nội dung của private key (`id_rsa`) vừa copy ở bước 2.
- `SSH_PORT`: Cổng SSH của server (mặc định là `22`).
- `TARGET_DIR`: Đường dẫn tuyệt đối tới thư mục dự án trên server (ví dụ: `/var/www/beohub`).

## 4. Tạo file cấu hình GitHub Actions

Trong thư mục dự án của bạn (trên máy tính hoặc qua giao diện GitHub), hãy tạo một workflow file:

1. Tạo thư mục ẩn: `.github/workflows/`
2. Tạo file `deploy.yml` bên trong thư mục đó (đường dẫn đầy đủ: `.github/workflows/deploy.yml`) với nội dung sau:

```yaml
name: Deploy to Server

on:
  push:
    branches:
      - main # Action sẽ chạy khi có code được push lên nhánh main

jobs:
  deploy:
    runs-on: ubuntu-latest
    
    steps:
      - name: Deploy qua SSH
        uses: appleboy/ssh-action@v1.0.3
        with:
          host: ${{ secrets.SSH_HOST }}
          username: ${{ secrets.SSH_USER }}
          key: ${{ secrets.SSH_KEY }}
          port: ${{ secrets.SSH_PORT }}
          script: |
            # Di chuyển vào thư mục dự án
            cd ${{ secrets.TARGET_DIR }}
            
            # Kéo code mới nhất từ nhánh main
            git pull origin main
            
            # Cài đặt các gói npm mới (nếu có cập nhật trong package.json)
            npm install --production
            
            # Khởi động lại ứng dụng thông qua pm2 bằng ecosystem.config.js
            # Nếu ứng dụng chưa chạy thì pm2 start, nếu đang chạy thì restart
            pm2 start ecosystem.config.js --env production || pm2 restart beohub
```

> **Lưu ý:** Workflow này sử dụng trực tiếp SSH để chạy lệnh trên server (Git pull, npm install, pm2). Nó giả định server của bạn đã pull code lần đầu tiên một cách thủ công và đã được cấu hình `.env` trên server.

## 5. Kiểm tra quá trình Auto Deploy

1. Sau khi thêm file `.github/workflows/deploy.yml`, hãy commit và push nó lên nhánh `main`.
2. Mở repository trên GitHub, chuyển sang tab **Actions**.
3. Bạn sẽ thấy một workflow có tên "Deploy to Server" đang chạy.
4. Bấm vào để xem log chi tiết. Nếu có tích xanh là quá trình deploy tự động lên server đã thành công! PM2 cũng đã tự động reload ứng dụng với code mới nhất.
