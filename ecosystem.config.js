const fs = require('fs');
const path = require('path');

// Đọc file .env nếu có để cấu hình PORT
let port = 3000;
try {
  const envPath = path.join(__dirname, '.env');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    const match = envContent.match(/^PORT\s*=\s*(\d+)/m);
    if (match) {
      port = parseInt(match[1], 10);
    }
  }
} catch (e) {
  console.error('Không thể đọc file .env:', e);
}

module.exports = {
  apps: [
    {
      name: 'beohub',
      script: 'server.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PORT: port
      }
    }
  ]
};
