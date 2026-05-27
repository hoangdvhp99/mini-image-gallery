document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('loginForm');
    const usernameInput = document.getElementById('username');
    const passwordInput = document.getElementById('password');
    const errorMsg = document.getElementById('errorMsg');
    const submitBtn = document.getElementById('submitBtn');
    const loadingIcon = document.getElementById('loadingIcon');
    const btnText = submitBtn.querySelector('span');

    // Kiểm tra xem đã đăng nhập chưa
    fetch('/api/auth/me')
        .then(res => res.json())
        .then(data => {
            if (data.success && data.isAdmin) {
                window.location.href = '/'; // Đã đăng nhập thì về trang chủ
            }
        });

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const username = usernameInput.value.trim();
        const password = passwordInput.value.trim();

        if (!username || !password) return;

        // UI Loading state
        submitBtn.disabled = true;
        btnText.textContent = 'Đang xử lý...';
        loadingIcon.classList.remove('hidden');
        errorMsg.classList.add('hidden');

        try {
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ username, password })
            });

            const data = await response.json();

            if (data.success) {
                // Đăng nhập thành công, chuyển hướng về trang chủ
                window.location.href = '/';
            } else {
                // Lỗi đăng nhập
                errorMsg.textContent = data.message || 'Có lỗi xảy ra, vui lòng thử lại!';
                errorMsg.classList.remove('hidden');
                
                // Hiệu ứng rung nhẹ
                loginForm.classList.add('animate-shake');
                setTimeout(() => loginForm.classList.remove('animate-shake'), 500);
            }
        } catch (error) {
            errorMsg.textContent = 'Lỗi kết nối máy chủ!';
            errorMsg.classList.remove('hidden');
        } finally {
            submitBtn.disabled = false;
            btnText.textContent = 'Đăng nhập';
            loadingIcon.classList.add('hidden');
        }
    });
});

// Thêm animation shake vào style cho document
const style = document.createElement('style');
style.innerHTML = `
@keyframes shake {
    0%, 100% { transform: translateX(0); }
    25% { transform: translateX(-5px); }
    50% { transform: translateX(5px); }
    75% { transform: translateX(-5px); }
}
.animate-shake {
    animation: shake 0.4s cubic-bezier(.36,.07,.19,.97) both;
}
`;
document.head.appendChild(style);
