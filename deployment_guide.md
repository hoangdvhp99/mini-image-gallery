# Hướng Dẫn Triển Khai Ứng Dụng Lên Ubuntu Server Bằng PM2

Tài liệu này hướng dẫn từng bước để bạn triển khai ứng dụng **beohub** lên máy chủ Ubuntu.
Dữ liệu (`data/`) và ảnh đã tải lên (`public/uploads/`) sẽ được **lưu trữ vĩnh viễn trực tiếp trên Server**, không bị ảnh hưởng hay ghi đè khi bạn cập nhật code sau này.

---

## MỤC LỤC
1. [Bước 1: Cấu hình môi trường trên Ubuntu Server](#bước-1-cấu-hình-môi-trường-trên-ubuntu-server)
2. [Bước 2: Clone dự án trên Server](#bước-2-clone-dự-án-trên-server)
3. [Bước 3: Khởi chạy ứng dụng bằng PM2](#bước-3-khởi-chạy-ứng-dụng-bằng-pm2)
4. [Bước 4: Cấu hình Nginx làm Reverse Proxy](#bước-4-cấu-hình-nginx-làm-reverse-proxy)
5. [Bước 5: Cấu hình SSL HTTPS miễn phí (Tùy chọn)](#bước-5-cấu-hình-ssl-https-miễn-phí-tùy-chọn)
6. [Quy trình cập nhật code sau này](#quy-trình-cập-nhật-code-sau-này)

---

## Bước 1: Cấu hình môi trường trên Ubuntu Server
Truy cập vào VPS/Ubuntu Server của bạn qua SSH, sau đó chạy các lệnh sau để cài đặt Node.js, Git và PM2.

### 1. Cập nhật hệ thống
```bash
sudo apt update && sudo apt upgrade -y
```

### 2. Cài đặt Node.js (LTS v20)
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
```
Kiểm tra cài đặt thành công:
```bash
node -v   # Output ví dụ: v20.x.x
npm -v    # Output ví dụ: 10.x.x
```

### 3. Cài đặt PM2 toàn cục
```bash
sudo npm install pm2 -g
```

---

## Bước 2: Clone dự án trên Server
Di chuyển vào thư mục bạn muốn triển khai (ví dụ `/var/www/` hoặc thư mục home của user):

```bash
# Tạo thư mục và di chuyển vào (ví dụ deploy ở thư mục người dùng)
cd ~
git clone <URL_KHO_LƯU_TRỮ_GIT_CỦA_BẠN> beohub
cd beohub

# Cài đặt các thư viện phụ thuộc (loại bỏ devDependencies để nhẹ hơn)
npm install --omit=dev
```

---

## Bước 3: Khởi chạy ứng dụng bằng PM2
Quay trở lại terminal của **Server**, di chuyển vào thư mục dự án và chạy:

```bash
# Khởi chạy thông qua file cấu hình ecosystem
pm2 start ecosystem.config.js

# Cấu hình tự động khởi động ứng dụng cùng hệ thống nếu Server bị reboot
pm2 startup
```
*Lưu ý: Lệnh `pm2 startup` sẽ sinh ra một lệnh hướng dẫn dạng `sudo env PATH=...`. Bạn chỉ cần copy lệnh đó và chạy trên terminal của Server.*

Sau đó lưu lại trạng thái hiện tại của PM2:
```bash
pm2 save
```

### Các lệnh quản lý PM2 thường dùng:
* **Xem trạng thái ứng dụng**: `pm2 status` hoặc `pm2 list`
* **Xem log thời gian thực**: `pm2 logs beohub-gallery`
* **Khởi động lại**: `pm2 restart beohub-gallery`
* **Dừng ứng dụng**: `pm2 stop beohub-gallery`

---

## Bước 4: Cấu hình Nginx làm Reverse Proxy
Nginx sẽ đóng vai trò nhận request từ cổng 80 (HTTP) hoặc 443 (HTTPS) và chuyển hướng vào cổng 3000 của Node.js.

### 1. Cài đặt Nginx
```bash
sudo apt install nginx -y
```

### 2. Tạo file cấu hình Nginx cho trang web
```bash
sudo nano /etc/nginx/sites-available/beohub
```

Dán nội dung sau vào file (thay đổi `your-domain-or-ip.com` thành tên miền hoặc IP server của bạn):

```nginx
server {
    listen 80;
    server_name your-domain-or-ip.com;

    # Cấu hình proxy ngược đến ứng dụng Node.js chạy ở cổng 3000
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Tối ưu hóa việc tải file upload trực tiếp qua Nginx để tăng hiệu năng (Tùy chọn)
    location /uploads/ {
        alias /home/ubuntu/beohub/public/uploads/;
        expires 30d;
        add_header Cache-Control "public, no-transform";
    }
}
```

*Nhấn `Ctrl + O` -> `Enter` để lưu, `Ctrl + X` để thoát nano.*

### 3. Kích hoạt cấu hình và restart Nginx
```bash
# Tạo liên kết để kích hoạt cấu hình
sudo ln -s /etc/nginx/sites-available/beohub /etc/nginx/sites-enabled/

# Xóa cấu hình mặc định (nếu chưa dùng) để tránh xung đột
sudo rm /etc/nginx/sites-enabled/default

# Kiểm tra cú pháp Nginx xem có lỗi không
sudo nginx -t

# Khởi động lại Nginx
sudo systemctl restart nginx
```

---

## Bước 5: Cấu hình SSL HTTPS miễn phí (Tùy chọn)
Nếu bạn đã trỏ Tên miền (Domain) về IP của Server, bạn nên cài đặt SSL để trang web chạy qua giao thức HTTPS bảo mật.

### 1. Cài đặt Certbot và plugin Nginx
```bash
sudo apt install certbot python3-certbot-nginx -y
```

### 2. Yêu cầu cấp phát chứng chỉ SSL
```bash
sudo certbot --nginx -d your-domain-or-ip.com
```
*Làm theo hướng dẫn trên màn hình (nhập email, đồng ý điều khoản). Certbot sẽ tự động sửa đổi file cấu hình Nginx để kích hoạt HTTPS và tự động chuyển hướng HTTP sang HTTPS.*

---

## Quy trình cập nhật code sau này
Khi bạn thực hiện thay đổi mã nguồn ở local và muốn cập nhật lên Server:

1. Ở máy **Local**: `git commit` và `git push` code mới lên GitHub.
2. Trên **Server**:
   ```bash
   cd ~/beohub
   git pull origin main
   npm install --omit=dev  # (nếu có thay đổi thư viện trong package.json)
   pm2 restart beohub-gallery
   ```

*Do dữ liệu JSON và thư mục ảnh tải lên đã được bỏ qua khỏi Git, chúng sẽ **không bao giờ bị mất hoặc bị ghi đè** khi bạn chạy lệnh `git pull` trên Server.*
