import { showToast } from './ui.js';

document.addEventListener('DOMContentLoaded', () => {
    const qandaForm = document.getElementById('qandaForm');
    const qandaImage = document.getElementById('qandaImage');
    const imagePreview = document.getElementById('imagePreview');
    const imagePreviewContainer = document.getElementById('imagePreviewContainer');
    const uploadText = document.getElementById('uploadText');
    const uploadIcon = document.getElementById('uploadIcon');

    // Live preview of uploaded Q&A image
    if (qandaImage) {
        qandaImage.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                if (!file.type.startsWith('image/')) {
                    showToast('⚠️ Chỉ chấp nhận các file ảnh!', 'warning');
                    qandaImage.value = '';
                    return;
                }
                
                const reader = new FileReader();
                reader.onload = (event) => {
                    imagePreview.src = event.target.result;
                    imagePreviewContainer.classList.remove('hidden');
                    uploadText.innerText = `Đã chọn: ${file.name.substring(0, 20)}...`;
                    uploadIcon.innerText = '✅';
                };
                reader.readAsDataURL(file);
            } else {
                resetImageUploadState();
            }
        });
    }

    function resetImageUploadState() {
        if (qandaImage) qandaImage.value = '';
        if (imagePreview) imagePreview.src = '';
        if (imagePreviewContainer) imagePreviewContainer.classList.add('hidden');
        if (uploadText) uploadText.innerText = 'Tải hình ảnh minh họa lên';
        if (uploadIcon) uploadIcon.innerText = '📸';
    }

    // Submit new question
    if (qandaForm) {
        qandaForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const usernameInput = document.getElementById('qandaUsername');
            const titleInput = document.getElementById('qandaTitle');
            const descInput = document.getElementById('qandaDescription');
            const submitBtn = document.getElementById('qandaSubmitBtn');

            const username = usernameInput.value.trim();
            const title = titleInput.value.trim();
            const description = descInput.value.trim();

            if (!username || !title || !description) {
                showToast('⚠️ Vui lòng nhập đầy đủ thông tin bắt buộc!', 'warning');
                return;
            }

            const formData = new FormData();
            formData.append('username', username);
            formData.append('title', title);
            formData.append('description', description);
            if (qandaImage.files[0]) {
                formData.append('qandaImage', qandaImage.files[0]);
            }

            try {
                submitBtn.disabled = true;
                submitBtn.innerHTML = '<span>⏳ Đang gửi...</span>';

                const res = await fetch('/api/qanda', {
                    method: 'POST',
                    body: formData
                });
                const data = await res.json();

                if (data.success) {
                    showToast('🚀 Câu hỏi đã được gửi thành công!', 'success');
                    // Reset form
                    qandaForm.reset();
                    resetImageUploadState();
                    // Reload question list
                    loadQuestions();
                } else {
                    showToast(`⚠️ Lỗi: ${data.message}`, 'error');
                }
            } catch (err) {
                console.error('Lỗi khi gửi câu hỏi:', err);
                showToast('⚠️ Không thể gửi câu hỏi lên hệ thống!', 'error');
            } finally {
                submitBtn.disabled = false;
                submitBtn.innerHTML = '<span>🚀 Gửi Câu Hỏi</span>';
            }
        });
    }

    // Initialize: Check Admin status and then load question list
    async function initPage() {
        try {
            const res = await fetch('/api/auth/me');
            const data = await res.json();
            window.isAdmin = data.success && data.isAdmin;
        } catch (e) {
            console.error('Lỗi kiểm tra quyền Admin:', e);
            window.isAdmin = false;
        }
        loadQuestions();
    }

    // Load Q&A listing
    async function loadQuestions() {
        const qandaList = document.getElementById('qandaList');
        if (!qandaList) return;

        try {
            const res = await fetch('/api/qanda');
            const data = await res.json();

            if (data.success) {
                qandaList.innerHTML = '';
                if (data.questions.length === 0) {
                    qandaList.innerHTML = `
                        <div class="text-center py-16 text-neutral-500 text-xs font-bold select-none space-y-2">
                            <span class="text-4xl block">🍃</span>
                            <span>Chưa có câu hỏi nào được thiết lập. Hãy là người đầu tiên!</span>
                        </div>
                    `;
                    return;
                }

                data.questions.forEach((q) => {
                    const card = document.createElement('div');
                    card.className = 'bg-neutral-900/40 border border-neutral-800 p-5 rounded-2xl relative shadow-md transition hover:border-neutral-700/50 flex flex-col gap-4';

                    // Format dates
                    const createdDate = new Date(q.createdAt).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
                    const repliedDate = q.repliedAt ? new Date(q.repliedAt).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }) : '';

                    // Question Header
                    let headerHtml = `
                        <div class="flex justify-between items-start">
                            <div class="space-y-1">
                                <span class="text-[11px] font-bold text-gray-500 uppercase tracking-wider block">Bởi: <span class="text-amber-500/80 font-black">${q.username}</span> • ${createdDate}</span>
                                <h3 class="text-base font-black text-white tracking-wide">${q.title}</h3>
                            </div>
                    `;

                    // Delete button if Admin
                    if (window.isAdmin) {
                        headerHtml += `
                            <button class="bg-red-950/40 hover:bg-red-900/60 text-red-400 border border-red-900/30 p-1.5 rounded-lg transition-all text-xs font-black delete-question-btn" data-id="${q.id}">
                                🗑️ Xóa
                            </button>
                        `;
                    }
                    headerHtml += `</div>`;

                    // Question description
                    let descHtml = `
                        <p class="text-xs text-neutral-300 font-medium leading-relaxed whitespace-pre-wrap select-text">${q.description}</p>
                    `;

                    // Image attachment if any
                    let imgHtml = '';
                    if (q.imageUrl) {
                        imgHtml = `
                            <div class="max-w-md bg-neutral-950 rounded-xl overflow-hidden border border-neutral-850 shadow-inner group cursor-zoom-in">
                                <a href="${q.imageUrl}" target="_blank">
                                    <img src="${q.imageUrl}" class="w-full max-h-64 object-contain hover:scale-[1.02] transition duration-300" alt="Q&A Image Attachment">
                                </a>
                            </div>
                        `;
                    }

                    // Admin Reply Box
                    let replyHtml = '';
                    if (q.reply) {
                        replyHtml = `
                            <div class="admin-reply-box p-4 rounded-xl space-y-2 mt-2">
                                <div class="flex justify-between items-center">
                                    <span class="text-[10px] font-black text-amber-500 uppercase tracking-widest flex items-center gap-1.5 select-none">
                                        <span>👑</span> Lbeo Admin phản hồi
                                    </span>
                                    <span class="text-[9px] text-gray-500 font-bold">${repliedDate}</span>
                                </div>
                                <p class="text-xs text-gray-200 font-semibold leading-relaxed whitespace-pre-wrap select-text">${q.reply}</p>
                            </div>
                        `;
                    } else if (!window.isAdmin) {
                        // Normal user waiting message
                        replyHtml = `
                            <div class="flex items-center gap-1.5 text-neutral-500 text-[10px] font-bold select-none mt-1.5 pl-1">
                                <span>⏳</span> Chờ Admin phản hồi...
                            </div>
                        `;
                    }

                    // Reply Form if Admin
                    let adminReplyFormHtml = '';
                    if (window.isAdmin) {
                        adminReplyFormHtml = `
                            <div class="border-t border-neutral-850/80 pt-4 mt-2 space-y-2.5">
                                <label class="block text-[10px] font-black text-gray-400 uppercase tracking-wider pl-1">${q.reply ? '✏️ Sửa câu trả lời (Admin)' : '💬 Nhập phản hồi (Admin)'}</label>
                                <div class="flex flex-col sm:flex-row gap-2">
                                    <textarea class="flex-grow p-3 bg-neutral-950 border border-neutral-850 rounded-xl text-xs text-white placeholder-neutral-600 focus:outline-none focus:border-ph-orange transition leading-relaxed font-semibold reply-input" rows="2" placeholder="Nhập câu trả lời cho danh tánh này...">${q.reply || ''}</textarea>
                                    <button class="bg-amber-500 hover:bg-amber-400 text-black px-4 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-wider transition shadow-md shadow-amber-500/10 flex items-center justify-center shrink-0 reply-submit-btn" data-id="${q.id}">
                                        Gửi 🚀
                                    </button>
                                </div>
                            </div>
                        `;
                    }

                    card.innerHTML = `
                        ${headerHtml}
                        ${descHtml}
                        ${imgHtml}
                        ${replyHtml}
                        ${adminReplyFormHtml}
                    `;
                    qandaList.appendChild(card);
                });

                // Attach delete button listeners
                if (window.isAdmin) {
                    document.querySelectorAll('.delete-question-btn').forEach(btn => {
                        btn.addEventListener('click', async (e) => {
                            const id = btn.getAttribute('data-id');
                            if (confirm('⚠️ Bạn có chắc chắn muốn xóa câu hỏi này khỏi hệ thống?')) {
                                try {
                                    const res = await fetch(`/api/qanda/${id}`, { method: 'DELETE' });
                                    const data = await res.json();
                                    if (data.success) {
                                        showToast('🗑️ Đã xóa câu hỏi thành công!', 'success');
                                        loadQuestions();
                                    } else {
                                        showToast(`❌ Lỗi: ${data.message}`, 'error');
                                    }
                                } catch (err) {
                                    console.error('Lỗi khi xóa câu hỏi:', err);
                                    showToast('❌ Lỗi kết nối máy chủ!', 'error');
                                }
                            }
                        });
                    });

                    // Attach reply submit button listeners
                    document.querySelectorAll('.reply-submit-btn').forEach(btn => {
                        btn.addEventListener('click', async (e) => {
                            const id = btn.getAttribute('data-id');
                            const container = btn.closest('div');
                            const textarea = container.querySelector('.reply-input');
                            const reply = textarea.value.trim();

                            if (!reply) {
                                showToast('⚠️ Vui lòng nhập nội dung câu trả lời!', 'warning');
                                return;
                            }

                            try {
                                btn.disabled = true;
                                btn.innerText = 'Gửi...';

                                const res = await fetch(`/api/qanda/${id}/reply`, {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ reply })
                                });
                                const data = await res.json();

                                if (data.success) {
                                    showToast('✅ Đã lưu phản hồi thành công!', 'success');
                                    loadQuestions();
                                } else {
                                    showToast(`❌ Lỗi: ${data.message}`, 'error');
                                }
                            } catch (err) {
                                console.error('Lỗi gửi câu trả lời:', err);
                                showToast('❌ Lỗi kết nối máy chủ!', 'error');
                            } finally {
                                btn.disabled = false;
                                btn.innerText = 'Gửi 🚀';
                            }
                        });
                    });
                }
            }
        } catch (e) {
            console.error('Lỗi tải danh sách câu hỏi:', e);
            qandaList.innerHTML = `
                <div class="text-center py-16 text-red-500/70 text-xs font-bold select-none">
                    ⚠️ Không thể tải danh sách câu hỏi từ máy chủ!
                </div>
            `;
        }
    }

    initPage();
});
