import { showToast } from './ui.js';

document.addEventListener('DOMContentLoaded', async () => {
    const newsForm = document.getElementById('newsForm');
    const newsTitleInput = document.getElementById('newsTitle');
    const newsContentInput = document.getElementById('newsContent');
    const newsImageInput = document.getElementById('newsImage');
    const imagePreviewContainer = document.getElementById('imagePreviewContainer');
    const imagePreview = document.getElementById('imagePreview');
    const uploadIcon = document.getElementById('uploadIcon');
    const uploadText = document.getElementById('uploadText');
    const submitBtn = document.getElementById('submitBtn');
    const newsList = document.getElementById('newsList');

    // Kiểm tra quyền Admin
    try {
        const res = await fetch('/api/auth/me');
        const data = await res.json();
        if (!data.success || !data.isAdmin) {
            window.location.href = '/login';
            return;
        }
    } catch (e) {
        window.location.href = '/login';
        return;
    }

    // Hiển thị preview ảnh khi chọn file
    newsImageInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            const url = URL.createObjectURL(file);
            imagePreview.src = url;
            imagePreviewContainer.classList.remove('hidden');
            uploadIcon.classList.add('hidden');
            uploadText.textContent = 'Đã chọn ảnh: ' + file.name;
            uploadText.classList.replace('text-neutral-400', 'text-emerald-400');
        } else {
            imagePreviewContainer.classList.add('hidden');
            uploadIcon.classList.remove('hidden');
            uploadText.textContent = 'Chọn ảnh làm banner bài viết';
            uploadText.classList.replace('text-emerald-400', 'text-neutral-400');
        }
    });

    // Hàm load danh sách tin tức
    const loadNews = async () => {
        try {
            const res = await fetch('/api/news');
            const data = await res.json();
            
            if (data.success) {
                renderNewsList(data.news);
            } else {
                newsList.innerHTML = `<div class="text-center py-10 text-red-500 text-xs font-bold">Lỗi tải dữ liệu</div>`;
            }
        } catch (e) {
            newsList.innerHTML = `<div class="text-center py-10 text-red-500 text-xs font-bold">Lỗi kết nối máy chủ</div>`;
        }
    };

    // Hàm render danh sách
    const renderNewsList = (newsArr) => {
        if (!newsArr || newsArr.length === 0) {
            newsList.innerHTML = `<div class="text-center py-10 text-neutral-500 text-xs font-bold">Chưa có bản tin nào.</div>`;
            return;
        }
        
        newsList.innerHTML = '';
        newsArr.forEach(item => {
            const dateStr = new Date(item.created_at).toLocaleString('vi-VN');
            const div = document.createElement('div');
            div.className = 'bg-neutral-900/50 border border-neutral-800 rounded-xl p-4 flex flex-col md:flex-row gap-4 hover:border-neutral-700 transition group';
            
            let imageHtml = '';
            if (item.image_url) {
                imageHtml = `
                    <div class="w-full md:w-32 h-24 shrink-0 rounded-lg overflow-hidden bg-black border border-neutral-800 relative">
                        <img src="${item.image_url}" class="w-full h-full object-cover">
                    </div>
                `;
            } else {
                imageHtml = `
                    <div class="w-full md:w-32 h-24 shrink-0 rounded-lg bg-neutral-950 border border-neutral-800 flex items-center justify-center text-2xl text-neutral-800">
                        📰
                    </div>
                `;
            }

            // Trích xuất đoạn ngắn nội dung để preview
            const shortContent = item.content.length > 100 ? item.content.substring(0, 100) + '...' : item.content;

            div.innerHTML = `
                ${imageHtml}
                <div class="flex-grow space-y-2 flex flex-col justify-between">
                    <div>
                        <h3 class="font-black text-white text-sm line-clamp-1 group-hover:text-amber-500 transition">${item.title}</h3>
                        <p class="text-[11px] text-neutral-400 mt-1 line-clamp-2">${shortContent}</p>
                    </div>
                    <div class="flex items-center justify-between mt-2">
                        <span class="text-[10px] text-neutral-500 font-bold">📅 ${dateStr}</span>
                        <button class="btn-delete bg-red-900/30 hover:bg-red-500 text-red-500 hover:text-white px-3 py-1.5 rounded-lg text-[10px] font-black transition border border-red-900/50 flex items-center gap-1" data-id="${item.id}">
                            <span>🗑️</span> XÓA
                        </button>
                    </div>
                </div>
            `;
            newsList.appendChild(div);
        });

        // Add event listeners cho nút xóa
        document.querySelectorAll('.btn-delete').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const id = e.currentTarget.getAttribute('data-id');
                if (confirm('Bạn có chắc chắn muốn xóa bản tin này không?')) {
                    await deleteNews(id);
                }
            });
        });
    };

    // Hàm xóa tin tức
    const deleteNews = async (id) => {
        try {
            const res = await fetch(`/api/news/${id}`, { method: 'DELETE' });
            const data = await res.json();
            if (data.success) {
                showToast('Đã xóa bản tin thành công!', 'success');
                loadNews();
            } else {
                showToast(data.message || 'Lỗi khi xóa', 'error');
            }
        } catch (e) {
            showToast('Lỗi kết nối máy chủ', 'error');
        }
    };

    // Handle submit form
    newsForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const title = newsTitleInput.value.trim();
        const content = newsContentInput.value.trim();
        const file = newsImageInput.files[0];

        if (!title || !content) {
            showToast('Vui lòng nhập đầy đủ tiêu đề và nội dung', 'error');
            return;
        }

        const formData = new FormData();
        formData.append('title', title);
        formData.append('content', content);
        if (file) {
            formData.append('image', file);
        }

        const originalBtnText = submitBtn.innerHTML;
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span>⏳ Đang xử lý...</span>';

        try {
            const res = await fetch('/api/news', {
                method: 'POST',
                body: formData
            });
            const data = await res.json();

            if (data.success) {
                showToast('Đăng bản tin thành công!', 'success');
                newsForm.reset();
                
                // Reset preview
                imagePreviewContainer.classList.add('hidden');
                uploadIcon.classList.remove('hidden');
                uploadText.textContent = 'Chọn ảnh làm banner bài viết';
                uploadText.classList.replace('text-emerald-400', 'text-neutral-400');

                // Reload list
                loadNews();
            } else {
                showToast(data.message || 'Lỗi khi đăng tin', 'error');
            }
        } catch (e) {
            showToast('Lỗi kết nối máy chủ', 'error');
        } finally {
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalBtnText;
        }
    });

    // Load initial data
    loadNews();
});
