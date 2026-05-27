import { fetchMediaList, uploadMedia, updateMedia, deleteMedia, likeMedia, hahaMedia, commentMedia, fetchIdeas, submitIdea, likeIdea } from './api.js';
import { showToast, renderPreviewGrid, renderGalleryGrid, renderModalInteractions, openModal, closeModal, openEditModal, closeEditModal, renderIdeas } from './ui.js';

// DOM Elements
const elements = {
    uploadForm: document.getElementById('uploadForm'),
    searchInput: document.getElementById('searchInput'),
    galleryGrid: document.getElementById('galleryGrid'),
    mediaModal: document.getElementById('mediaModal'),
    modalContent: document.getElementById('modalContent'),
    modalTitle: document.getElementById('modalTitle'),
    modalDesc: document.getElementById('modalDesc'),
    modalTags: document.getElementById('modalTags'),
    likeBtn: document.getElementById('likeBtn'),
    likeCount: document.getElementById('likeCount'),
    hahaBtn: document.getElementById('hahaBtn'),
    hahaCount: document.getElementById('hahaCount'),
    prevBtn: document.getElementById('prevBtn'),
    nextBtn: document.getElementById('nextBtn'),
    shareLinkBtn: document.getElementById('shareLinkBtn'),
    commentsContainer: document.getElementById('commentsContainer'),
    commentForm: document.getElementById('commentForm'),
    commentInput: document.getElementById('commentInput'),
    toastContainer: document.getElementById('toastContainer'),
    dropzone: document.getElementById('dropzone'),
    fileInput: document.getElementById('fileInput'),
    fileCounter: document.getElementById('fileCounter'),
    previewContainer: document.getElementById('previewContainer'),
    previewGrid: document.getElementById('previewGrid'),
    editModal: document.getElementById('editModal'),
    editForm: document.getElementById('editForm'),
    editOldName: document.getElementById('editOldName'),
    editNewNameInput: document.getElementById('editNewNameInput'),
    editTagsInput: document.getElementById('editTagsInput'),
    editDescInput: document.getElementById('editDescInput'),
    editCategorySelect: document.getElementById('editCategorySelect'),
    
    // Navigation & Ideas Elements
    tabHome: document.getElementById('tabHome'),
    tabLbeo: document.getElementById('tabLbeo'),
    tabIdeas: document.getElementById('tabIdeas'),
    tabMinigame: document.getElementById('tabMinigame'),
    homeSection: document.getElementById('homeSection'),
    ideasSection: document.getElementById('ideasSection'),
    minigameSection: document.getElementById('minigameSection'),
    uploadContainer: document.getElementById('uploadContainer'),
    galleryContainer: document.getElementById('galleryContainer'),
    lbeoBanner: document.getElementById('lbeoBanner'),
    ideaForm: document.getElementById('ideaForm'),
    ideaAuthorInput: document.getElementById('ideaAuthorInput'),
    ideaTitleInput: document.getElementById('ideaTitleInput'),
    ideaDescInput: document.getElementById('ideaDescInput'),
    ideaTagsInput: document.getElementById('ideaTagsInput'),
    ideasGrid: document.getElementById('ideasGrid'),
    
    // Face Swap AI Elements
    faceSwapForm: document.getElementById('faceSwapForm'),
    faceSwapInput: document.getElementById('faceSwapInput'),
    faceSwapLabel: document.getElementById('faceSwapLabel'),
    faceSwapCounter: document.getElementById('faceSwapCounter'),
    faceSwapBtn: document.getElementById('faceSwapBtn'),
    faceSwapResultContainer: document.getElementById('faceSwapResultContainer'),
    faceSwapResultImg: document.getElementById('faceSwapResultImg'),
    downloadSwappedBtn: document.getElementById('downloadSwappedBtn'),
    uploadSwappedBtn: document.getElementById('uploadSwappedBtn'),
    faceSwapResultNameInput: document.getElementById('faceSwapResultNameInput'),
    faceSwapResultDescInput: document.getElementById('faceSwapResultDescInput'),
    uploadCategorySelect: document.getElementById('uploadCategorySelect'),
    faceSwapResultCategorySelect: document.getElementById('faceSwapResultCategorySelect'),
    faceSwapPreviewContainer: document.getElementById('faceSwapPreviewContainer'),
    faceSwapPreviewImg: document.getElementById('faceSwapPreviewImg'),
    faceSwapIcon: document.getElementById('faceSwapIcon'),
    btnDonate: document.getElementById('btnDonate'),
    donateModal: document.getElementById('donateModal')
};

// Global States
let selectedFiles = [];
let globalMediaList = [];
let activeMediaName = "";
let isInitialLoad = true;
let currentTab = "home";
let fullDisplayList = [];
let currentPage = 1;
const itemsPerPage = 15;

// Lấy thông tin từ URL
const urlParams = new URLSearchParams(window.location.search);
let isAdmin = false;
try {
    const authRes = await fetch('/api/auth/me');
    const authData = await authRes.json();
    isAdmin = authData.isAdmin;
} catch (e) {
    console.error('Lỗi kiểm tra quyền:', e);
}

// Đăng ký các hàm đóng mở modal lên window để HTML onclick (từ các nút đóng modal tĩnh trong HTML) có thể gọi được
window.closeModal = () => {
    closeModal(elements);
    activeMediaName = "";
};

window.closeEditModal = () => {
    closeEditModal(elements);
};

window.closeDonateModal = () => {
    if (elements.donateModal) {
        elements.donateModal.classList.add('hidden');
    }
};

// Hàm tải và render bảng xếp hạng lượt truy cập IP (Chỉ dành cho Admin)
async function loadLeaderboard() {
    if (!isAdmin) return;
    try {
        const res = await fetch(`/api/visits/leaderboard`);
        const data = await res.json();
        if (data.success && data.leaderboard) {
            const tbody = document.getElementById('leaderboardBody');
            if (!tbody) return;
            
            if (data.leaderboard.length === 0) {
                tbody.innerHTML = `<tr><td colspan="3" class="text-center text-gray-500 py-3 text-[10px]">Chưa có lượt truy cập từ IP khác...</td></tr>`;
                return;
            }
            
            tbody.innerHTML = data.leaderboard.map((item, index) => {
                let badge = `${index + 1}`;
                if (index === 0) badge = '🥇';
                else if (index === 1) badge = '🥈';
                else if (index === 2) badge = '🥉';
                
                const highlightClass = index === 0 ? 'text-amber-400 font-bold' : '';
                
                return `
                    <tr class="border-b border-neutral-900/50 py-1 hover:bg-neutral-800/20 transition">
                        <td class="py-1.5 text-center text-xs">${badge}</td>
                        <td class="py-1.5 font-mono text-white ${highlightClass}">${item.ip}</td>
                        <td class="py-1.5 text-right font-bold text-amber-500 font-mono">${item.count}</td>
                    </tr>
                `;
            }).join('');
        }
    } catch (err) {
        console.error('Lỗi khi tải bảng xếp hạng IP:', err);
    }
}

window.openDonateModal = () => {
    if (elements.donateModal) {
        elements.donateModal.classList.remove('hidden');
        loadLeaderboard();
    }
};

// --- Fetch & Render Thư Viện ---
async function fetchImages(search = '') {
    try {
        let media = await fetchMediaList(search);
        globalMediaList = media;
        
        let displayList = media;
        if (currentTab === 'home') {
            displayList = media.filter(item => !item.category || item.category === 'home');
        } else if (currentTab === 'lbeo') {
            displayList = media.filter(item => item.category === 'lbeo');
        }
        
        // Lưu trữ danh sách đầy đủ và khởi tạo phân trang
        fullDisplayList = displayList;
        currentPage = 1;

        // Chỉ hiển thị 15 ảnh đầu tiên
        const slicedList = displayList.slice(0, currentPage * itemsPerPage);
        
        const targetId = urlParams.get('id');

        renderGalleryGrid(slicedList, isAdmin, elements, {
            onOpenModal: (url, name) => {
                activeMediaName = name;
                openModal(url, name, globalMediaList, elements);
            },
            onOpenEditModal: (name) => {
                openEditModal(name, globalMediaList, elements);
            },
            onDeleteImage: async (fileName) => {
                if (!confirm(`Xóa vĩnh viễn tệp tin "${fileName}" khỏi BeoHub?`)) return;
                try {
                    const result = await deleteMedia(fileName);
                    if (result.success) {
                        showToast('Đã xóa dữ liệu thành công.', 'success');
                        fetchImages(elements.searchInput.value);
                    }
                } catch (err) {
                    showToast('Gặp lỗi khi xóa dữ liệu.', 'error');
                }
            }
        });

        if (isInitialLoad && targetId) {
            isInitialLoad = false;
            const matched = globalMediaList.find(img => img.name === targetId);
            if (matched) {
                activeMediaName = matched.name;
                openModal(matched.url, matched.name, globalMediaList, elements);
            }
        }
        if (!elements.mediaModal.classList.contains('hidden') && activeMediaName) {
            renderModalInteractions(activeMediaName, globalMediaList, elements);
        }
    } catch (err) {
        showToast('Lỗi kết nối tới máy chủ BeoHub!', 'error');
    }
}

// --- Drag & Drop & File selection ---
if (elements.dropzone) {
    elements.dropzone.addEventListener('click', () => elements.fileInput.click());
    
    elements.fileInput.addEventListener('change', (e) => {
        selectedFiles = renderPreviewGrid(e.target.files, elements);
    });

    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(ev => {
        elements.dropzone.addEventListener(ev, (e) => e.preventDefault(), false);
    });

    ['dragenter', 'dragover'].forEach(ev => {
        elements.dropzone.addEventListener(ev, () => {
            elements.dropzone.classList.add('border-ph-orange', 'bg-neutral-800');
        });
    });

    ['dragleave', 'drop'].forEach(ev => {
        elements.dropzone.addEventListener(ev, () => {
            elements.dropzone.classList.remove('border-ph-orange', 'bg-neutral-800');
        });
    });

    elements.dropzone.addEventListener('drop', (e) => {
        selectedFiles = renderPreviewGrid(e.dataTransfer.files, elements);
    });
}

// --- Gửi dữ liệu Tải lên mới ---
elements.uploadForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (selectedFiles.length === 0) {
        showToast('Vui lòng chọn hoặc kéo thả tệp tin!', 'error');
        return;
    }

    const formData = new FormData();
    selectedFiles.forEach(file => formData.append('images', file));
    formData.append('hashtags', document.getElementById('tagsInput').value);
    formData.append('description', document.getElementById('descInput').value);
    formData.append('category', elements.uploadCategorySelect.value);

    // Thu thập tất cả tên tùy chỉnh từ danh sách xem trước
    const nameInputs = document.querySelectorAll('input[name="customNameInputs"]');
    nameInputs.forEach(input => {
        formData.append('customNames', input.value);
    });

    try {
        const result = await uploadMedia(formData);
        showToast(result.message, 'success');
        elements.uploadForm.reset();
        selectedFiles = [];
        elements.fileCounter.classList.add('hidden');
        elements.previewContainer.classList.add('hidden');
        elements.previewGrid.innerHTML = '';
        fetchImages();
    } catch (err) {
        showToast(err.message || 'Lỗi kết nối tới máy chủ BeoHub!', 'error');
    }
});

// --- Sửa Thông Tin form Sửa ---
elements.editForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const oldName = elements.editOldName.value;
    const newName = elements.editNewNameInput.value;

    const formData = new FormData();
    formData.append('newName', newName);
    formData.append('hashtags', elements.editTagsInput.value);
    formData.append('description', elements.editDescInput.value);
    if (elements.editCategorySelect) {
        formData.append('category', elements.editCategorySelect.value);
    }

    try {
        const result = await updateMedia(oldName, formData);
        showToast(result.message, 'success');
        closeEditModal(elements);
        fetchImages(elements.searchInput.value);
    } catch (err) {
        showToast(err.message || 'Có lỗi xảy ra khi cập nhật tệp tin.', 'error');
    }
});

// --- Tìm kiếm ---
let searchTimeout;
elements.searchInput.addEventListener('input', (e) => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => fetchImages(e.target.value), 300);
});

// --- Điều hướng chuyển ảnh (Prev/Next Modal) ---
function navigateMedia(direction) {
    if (!activeMediaName || globalMediaList.length === 0) return;
    
    const currentIndex = globalMediaList.findIndex(item => item.name === activeMediaName);
    if (currentIndex === -1) return;
    
    let newIndex = currentIndex + direction;
    
    // Tự động xoay vòng danh sách (Loop)
    if (newIndex < 0) {
        newIndex = globalMediaList.length - 1;
    } else if (newIndex >= globalMediaList.length) {
        newIndex = 0;
    }
    
    const nextMedia = globalMediaList[newIndex];
    activeMediaName = nextMedia.name;
    
    // Mở ảnh/video mới liền mạch
    openModal(nextMedia.url, nextMedia.name, globalMediaList, elements);
}

// Bắt sự kiện click chuột nút chuyển ảnh
elements.prevBtn.onclick = (e) => {
    e.stopPropagation();
    navigateMedia(-1);
};
elements.nextBtn.onclick = (e) => {
    e.stopPropagation();
    navigateMedia(1);
};

// Đăng ký phím mũi tên Trái/Phải để chuyển ảnh từ bàn phím
window.addEventListener('keydown', (e) => {
    if (elements.mediaModal.classList.contains('hidden')) return;
    
    // Tránh cướp phím khi người dùng đang gõ bình luận
    if (document.activeElement === elements.commentInput || 
        document.activeElement === document.getElementById('donateNameInput') ||
        document.activeElement === document.getElementById('donateAmountInput') ||
        document.activeElement === document.getElementById('donateMessageInput')) {
        return;
    }
    
    if (e.key === 'ArrowLeft') {
        navigateMedia(-1);
    } else if (e.key === 'ArrowRight') {
        navigateMedia(1);
    } else if (e.key === 'Escape') {
        window.closeModal();
    }
});

// --- Thả tim ---
elements.likeBtn.onclick = async () => {
    if (!activeMediaName) return;
    try {
        const r = await likeMedia(activeMediaName);
        elements.likeCount.textContent = r.likes;
        fetchImages(elements.searchInput.value);
    } catch (err) {
        showToast('Không thể thả tim!', 'error');
    }
};

// --- Haha ---
elements.hahaBtn.onclick = async () => {
    if (!activeMediaName) return;
    try {
        const r = await hahaMedia(activeMediaName);
        elements.hahaCount.textContent = r.hahas;
        fetchImages(elements.searchInput.value);
    } catch (err) {
        showToast('Không thể Haha!', 'error');
    }
};

// --- Bình luận ---
elements.commentForm.onsubmit = async (e) => {
    e.preventDefault();
    const text = elements.commentInput.value.trim();
    if (!text || !activeMediaName) return;
    try {
        await commentMedia(activeMediaName, text);
        elements.commentInput.value = '';
        fetchImages(elements.searchInput.value);
    } catch (err) {
        showToast('Không thể gửi bình luận!', 'error');
    }
};

// --- Copy share link ---
elements.shareLinkBtn.onclick = async () => {
    if (!activeMediaName) return;
    const shareUrl = window.location.href;
    if (navigator.clipboard && navigator.clipboard.writeText) {
        try {
            await navigator.clipboard.writeText(shareUrl);
            showToast('Đã copy đường dẫn bài đăng!', 'success');
            return;
        } catch (e) {}
    }
    const t = document.createElement("textarea");
    t.value = shareUrl;
    t.style.position = "fixed";
    t.style.left = "-9999px";
    document.body.appendChild(t);
    t.focus();
    t.select();
    document.execCommand('copy');
    document.body.removeChild(t);
    showToast('Đã copy đường dẫn bài đăng (LAN Fallback)!', 'success');
};

// --- Lắng nghe sự kiện bàn phím ESC ---
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        window.closeModal();
        window.closeEditModal();
    }
});

// --- Tab Switching Logic ---
async function loadIdeas() {
    try {
        const ideas = await fetchIdeas();
        renderIdeas(ideas, elements, async (id) => {
            try {
                const res = await likeIdea(id);
                showToast('Đã bình chọn ý tưởng!', 'success');
                loadIdeas();
            } catch (err) {
                showToast(err.message || 'Lỗi khi vote ý tưởng', 'error');
            }
        });
    } catch (err) {
        showToast('Không thể tải danh sách ý tưởng!', 'error');
    }
}

async function switchTab(tabName) {
    currentTab = tabName;

    // Reset active button classes
    [elements.tabHome, elements.tabLbeo, elements.tabIdeas, elements.tabMinigame].forEach(btn => {
        if (btn) btn.classList.remove('active');
    });

    // Reset layout defaults
    elements.uploadContainer.classList.remove('hidden');
    elements.galleryContainer.className = 'md:col-span-3 space-y-4';
    elements.lbeoBanner.classList.add('hidden');
    elements.homeSection.classList.remove('hidden');
    elements.ideasSection.classList.add('hidden');
    if (elements.minigameSection) elements.minigameSection.classList.add('hidden');

    // Quit active game session if switching away
    if (tabName !== 'minigame' && window.pikaGame && window.pikaGame.gameActive) {
        window.pikaGame.quitGame();
    }

    if (tabName === 'home') {
        elements.tabHome.classList.add('active');
        fetchImages(elements.searchInput.value);
    } else if (tabName === 'lbeo') {
        elements.tabLbeo.classList.add('active');
        elements.uploadContainer.classList.add('hidden');
        elements.galleryContainer.className = 'md:col-span-4 space-y-4';
        elements.lbeoBanner.classList.remove('hidden');
        fetchImages('');
    } else if (tabName === 'ideas') {
        elements.tabIdeas.classList.add('active');
        elements.homeSection.classList.add('hidden');
        elements.ideasSection.classList.remove('hidden');
    } else if (tabName === 'minigame') {
        window.location.href = '/minigame';
        return;
    }
}

// Đăng ký sự kiện click các Tab điều hướng
if (elements.tabHome) elements.tabHome.addEventListener('click', () => switchTab('home'));
if (elements.tabLbeo) elements.tabLbeo.addEventListener('click', () => switchTab('lbeo'));
if (elements.tabIdeas) elements.tabIdeas.addEventListener('click', () => switchTab('ideas'));
if (elements.tabMinigame) elements.tabMinigame.addEventListener('click', () => switchTab('minigame'));
if (elements.btnDonate) elements.btnDonate.addEventListener('click', () => window.openDonateModal());

// Đăng ký gửi form đóng góp ý kiến
if (elements.ideaForm) {
    elements.ideaForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const author = elements.ideaAuthorInput.value.trim();
        const title = elements.ideaTitleInput.value.trim();
        const description = elements.ideaDescInput.value.trim();
        const hashtags = elements.ideaTagsInput.value.trim();

        try {
            const result = await submitIdea({ author, title, description, hashtags });
            showToast(result.message, 'success');
            elements.ideaForm.reset();
            loadIdeas();
        } catch (err) {
            showToast(err.message || 'Lỗi khi gửi đóng góp ý tưởng!', 'error');
        }
    });
}

// Đăng ký sự kiện chọn ảnh khuôn mặt Face Swap
if (elements.faceSwapInput) {
    elements.faceSwapInput.addEventListener('change', (e) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            elements.faceSwapCounter.classList.remove('hidden');
            elements.faceSwapLabel.textContent = `✓ Đã chọn: ${file.name}`;
            elements.faceSwapLabel.classList.add('text-emerald-400');

            const reader = new FileReader();
            reader.onload = (event) => {
                elements.faceSwapPreviewImg.src = event.target.result;
                elements.faceSwapPreviewContainer.classList.remove('hidden');
                if (elements.faceSwapIcon) elements.faceSwapIcon.classList.add('hidden');
            };
            reader.readAsDataURL(file);
        } else {
            elements.faceSwapCounter.classList.add('hidden');
            elements.faceSwapLabel.textContent = 'Chọn bức ảnh bạn muốn bị ghép mặt (JPG/PNG)';
            elements.faceSwapLabel.classList.remove('text-emerald-400');
            elements.faceSwapPreviewImg.src = '';
            elements.faceSwapPreviewContainer.classList.add('hidden');
            if (elements.faceSwapIcon) elements.faceSwapIcon.classList.remove('hidden');
        }
    });
}

// Đăng ký gửi form Face Swap AI
if (elements.faceSwapForm) {
    elements.faceSwapForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const file = elements.faceSwapInput.files[0];
        if (!file) {
            showToast('Vui lòng chọn 1 ảnh khuôn mặt trước!', 'error');
            return;
        }

        const formData = new FormData();
        formData.append('faceImage', file);

        // Vô hiệu hóa nút và hiển thị trạng thái loading
        const origBtnText = elements.faceSwapBtn.innerHTML;
        elements.faceSwapBtn.disabled = true;
        elements.faceSwapBtn.innerHTML = `<span>⏳ AI ĐANG GHÉP MẶT... (5-15 GIÂY)</span>`;
        elements.faceSwapBtn.classList.remove('bg-ph-orange', 'hover:bg-amber-500');
        elements.faceSwapBtn.classList.add('bg-neutral-800', 'text-gray-400', 'cursor-not-allowed');
        elements.faceSwapResultContainer.classList.add('hidden');

        try {
            const res = await fetch('/api/ideas/faceswap', {
                method: 'POST',
                body: formData
            });
            let result;
            try {
                result = await res.json();
            } catch (jsonErr) {
                throw new Error('Không nhận được phản hồi hợp lệ từ máy chủ BeoHub.');
            }

            if (!res.ok || !result || !result.success) {
                throw new Error((result && result.message) || 'Lỗi hệ thống hoán đổi khuôn mặt AI.');
            }

            showToast(result.message, 'success');
            elements.faceSwapResultImg.src = result.url;
            elements.downloadSwappedBtn.href = result.url;
            elements.faceSwapResultContainer.classList.remove('hidden');
        } catch (err) {
            showToast(err.message || 'Gặp lỗi trong quá trình hoán đổi khuôn mặt AI!', 'error');
        } finally {
            elements.faceSwapBtn.disabled = false;
            elements.faceSwapBtn.innerHTML = origBtnText;
            elements.faceSwapBtn.classList.add('bg-ph-orange', 'hover:bg-amber-500');
            elements.faceSwapBtn.classList.remove('bg-neutral-800', 'text-gray-400', 'cursor-not-allowed');
        }
    });
}

// Đăng ký sự kiện upload trực tiếp kết quả lên BeoHub
if (elements.uploadSwappedBtn) {
    elements.uploadSwappedBtn.addEventListener('click', async () => {
        const imageUrl = elements.faceSwapResultImg.src;
        if (!imageUrl) {
            showToast('Không có ảnh kết quả nào để upload!', 'error');
            return;
        }

        const origBtnText = elements.uploadSwappedBtn.innerHTML;
        elements.uploadSwappedBtn.disabled = true;
        elements.uploadSwappedBtn.innerHTML = `<span>⏳ ĐANG UPLOAD...</span>`;
        elements.uploadSwappedBtn.classList.remove('bg-ph-orange', 'hover:bg-amber-500');
        elements.uploadSwappedBtn.classList.add('bg-neutral-800', 'text-gray-400', 'cursor-not-allowed');

        try {
            // Lấy tên tệp tin và mô tả từ giao diện
            let customName = elements.faceSwapResultNameInput.value.trim() || 'lbeo_swapped';
            if (!customName.endsWith('.webp')) {
                customName += '.webp';
            }
            const customDesc = elements.faceSwapResultDescInput.value.trim() || 'Ảnh ghép mặt Lbeo AI độc quyền!';

            // Tải ảnh dưới dạng Blob từ URL nội bộ
            const response = await fetch(imageUrl);
            const blob = await response.blob();
            const file = new File([blob], customName, { type: 'image/webp' });

            const formData = new FormData();
            formData.append('images', file);
            formData.append('hashtags', 'faceswap, lbeo');
            formData.append('description', customDesc);
            formData.append('customNames', customName);
            formData.append('category', elements.faceSwapResultCategorySelect.value);

            await uploadMedia(formData);
            showToast('Đăng ảnh ghép mặt AI trực tiếp lên BeoHub thành công! 🎉', 'success');
        } catch (err) {
            showToast(err.message || 'Lỗi khi upload trực tiếp ảnh ghép mặt lên BeoHub!', 'error');
        } finally {
            elements.uploadSwappedBtn.disabled = false;
            elements.uploadSwappedBtn.innerHTML = origBtnText;
            elements.uploadSwappedBtn.classList.add('bg-ph-orange', 'hover:bg-amber-500');
            elements.uploadSwappedBtn.classList.remove('bg-neutral-800', 'text-gray-400', 'cursor-not-allowed');
        }
    });
}

// Tải thêm ảnh khi cuộn (Lazy Load / Phân trang)
function loadMoreImages() {
    const totalItems = fullDisplayList.length;
    const maxPage = Math.ceil(totalItems / itemsPerPage);
    if (currentPage >= maxPage) return; // Đã hiển thị hết tất cả các ảnh

    currentPage++;
    const slicedList = fullDisplayList.slice(0, currentPage * itemsPerPage);

    renderGalleryGrid(slicedList, isAdmin, elements, {
        onOpenModal: (url, name) => {
            activeMediaName = name;
            openModal(url, name, globalMediaList, elements);
        },
        onOpenEditModal: (name) => {
            openEditModal(name, globalMediaList, elements);
        },
        onDeleteImage: async (fileName) => {
            if (!confirm(`Xóa vĩnh viễn tệp tin "${fileName}" khỏi BeoHub?`)) return;
            try {
                const result = await deleteMedia(fileName);
                if (result.success) {
                    showToast('Đã xóa dữ liệu thành công.', 'success');
                    fetchImages(elements.searchInput.value);
                }
            } catch (err) {
                showToast('Gặp lỗi khi xóa dữ liệu.', 'error');
            }
        }
    });
}

// Đăng ký sự kiện cuộn chuột để kích hoạt Lazy Load
window.addEventListener('scroll', () => {
    if (currentTab === 'ideas') return; // Không lazy load ở tab Ideas

    const { scrollTop, scrollHeight, clientHeight } = document.documentElement;
    // Tự động tải thêm khi cuộn gần tới đáy trang (cách đáy 150px)
    if (scrollTop + clientHeight >= scrollHeight - 150) {
        loadMoreImages();
    }
});

// Khởi tạo chạy lần đầu dựa trên tham số URL
const tabParam = urlParams.get('tab');
if (tabParam && ['home', 'lbeo', 'ideas'].includes(tabParam)) {
    switchTab(tabParam);
} else {
    fetchImages();
}

if (urlParams.get('donate') === '1') {
    window.openDonateModal();
}

// --- TÍNH NĂNG DONATE REAL-TIME (HIỆU ỨNG PHÁO HOA & NỔ TIN NHẮN) ---

// Hiển thị Form Donate của Admin nếu có quyền ?isLbeo=0
if (isAdmin) {
    const adminDonateFormContainer = document.getElementById('adminDonateFormContainer');
    if (adminDonateFormContainer) adminDonateFormContainer.classList.remove('hidden');
}

// Xử lý gửi Form Donate của Admin
const adminDonateForm = document.getElementById('adminDonateForm');
if (adminDonateForm) {
    adminDonateForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = document.getElementById('donateNameInput').value.trim();
        const amount = document.getElementById('donateAmountInput').value.trim();
        const message = document.getElementById('donateMessageInput').value.trim();

        try {
            const res = await fetch(`/api/donate/alert`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, amount, message })
            });
            const data = await res.json();
            if (data.success) {
                showToast('Đã phát sóng quyên góp toàn dân thành công!', 'success');
                adminDonateForm.reset();
                window.closeDonateModal();
            } else {
                showToast('Lỗi khi phát sóng quyên góp!', 'error');
            }
        } catch (err) {
            showToast('Lỗi kết nối máy chủ!', 'error');
        }
    });
}

// Khởi tạo vòng lặp Polling kiểm tra tin nhắn Donate mới (2 giây mỗi lần)
let lastSeenDonationId = null;

function startDonationPolling() {
    setInterval(async () => {
        try {
            const res = await fetch('/api/donate/latest');
            const data = await res.json();
            if (data.success && data.latest) {
                const latest = data.latest;
                // Nếu là tin nhắn mới và thời gian tạo trong vòng 15 giây qua
                if (latest.id !== lastSeenDonationId && (Date.now() - latest.timestamp) < 15000) {
                    lastSeenDonationId = latest.id;
                    triggerDonationAnimation(latest.name, latest.amount, latest.message);
                } else if (latest.id !== lastSeenDonationId) {
                    // Cập nhật id mà không nổ pháo hoa nếu tin nhắn quá cũ
                    lastSeenDonationId = latest.id;
                }
            }
        } catch (err) {
            // Bỏ qua lỗi kết nối để tránh ô nhiễm log console
        }
    }, 2000);
}

// Khởi chạy Polling kiểm tra tin nhắn
startDonationPolling();

// Tạo âm thanh ting-ting thông báo nhận tiền sử dụng Web Audio API (100% offline-friendly, không cần file tĩnh)
function playTingTingSound() {
    try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return;
        const ctx = new AudioContext();

        // Tiếng Ting thứ nhất (High Pitch C6)
        const osc1 = ctx.createOscillator();
        const gain1 = ctx.createGain();
        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(1046.50, ctx.currentTime);
        gain1.gain.setValueAtTime(0, ctx.currentTime);
        gain1.gain.linearRampToValueAtTime(0.25, ctx.currentTime + 0.01);
        gain1.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);

        osc1.connect(gain1);
        gain1.connect(ctx.destination);
        osc1.start(ctx.currentTime);
        osc1.stop(ctx.currentTime + 0.25);

        // Tiếng Ting thứ hai (Độ trễ nhẹ 120ms, nốt E6 cao hơn)
        setTimeout(() => {
            const osc2 = ctx.createOscillator();
            const gain2 = ctx.createGain();
            osc2.type = 'sine';
            osc2.frequency.setValueAtTime(1318.51, ctx.currentTime);
            gain2.gain.setValueAtTime(0, ctx.currentTime);
            gain2.gain.linearRampToValueAtTime(0.25, ctx.currentTime + 0.01);
            gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);

            osc2.connect(gain2);
            gain2.connect(ctx.destination);
            osc2.start(ctx.currentTime);
            osc2.stop(ctx.currentTime + 0.4);
        }, 120);
    } catch (e) {
        console.warn('Lỗi kích hoạt âm thanh ting-ting:', e);
    }
}

// Tạo hiệu ứng nổi tin nhắn và nổ pháo hoa hạt nhiều màu sắc
function triggerDonationAnimation(name, amount, message) {
    const container = document.getElementById('donationAlertContainer');
    if (!container) return;

    // Phát âm thanh ting-ting cực vui tai
    playTingTingSound();

    // Tạo hộp thoại thông báo nổi
    const alertCard = document.createElement('div');
    alertCard.className = 'donation-alert-card bg-neutral-950/95 border border-amber-500/50 p-6 rounded-2xl shadow-2xl flex flex-col items-center justify-center space-y-3 pointer-events-none transform transition-all duration-500 scale-50 opacity-0 max-w-sm text-center backdrop-blur-md relative z-[100]';
    alertCard.innerHTML = `
        <div class="absolute -top-6 text-3xl animate-bounce">👑</div>
        <h3 class="text-xs font-black text-amber-400 tracking-widest uppercase">🎉 ĐẠI GIA DONATE MỚI 🎉</h3>
        <div class="text-lg font-black text-white">${name}</div>
        <div class="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-500 font-mono tracking-wide scale-110 transform transition">${amount}</div>
        <div class="text-xs italic text-gray-300">"${message || 'cho zui'}"</div>
    `;
    
    container.appendChild(alertCard);

    // Kích hoạt nổi và hiển thị
    setTimeout(() => {
        alertCard.style.transform = 'scale(1.15) translateY(-20px)';
        alertCard.style.opacity = '1';
    }, 50);

    // Tạo 35 hạt pháo hoa xung quanh màn hình
    for (let i = 0; i < 35; i++) {
        createFireworkParticle(container);
    }

    // Mờ dần sau 4.2 giây, biến mất hoàn toàn sau 5 giây
    setTimeout(() => {
        alertCard.style.transform = 'scale(0.8) translateY(-60px)';
        alertCard.style.opacity = '0';
    }, 4200);

    setTimeout(() => {
        alertCard.remove();
    }, 5000);
}

// Tạo hạt pháo hoa đơn lẻ bay chuyển động ngẫu nhiên với hiệu ứng trọng lực nhẹ
function createFireworkParticle(container) {
    const particle = document.createElement('div');
    particle.className = 'absolute w-2 h-2 rounded-full pointer-events-none z-[99]';
    
    const colors = ['#f59e0b', '#fbbf24', '#f59e0b', '#ef4444', '#3b82f6', '#10b981', '#ec4899'];
    particle.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
    
    // Tọa độ trung tâm màn hình làm điểm phát nổ
    const x = window.innerWidth / 2;
    const y = window.innerHeight / 2;
    particle.style.left = `${x}px`;
    particle.style.top = `${y}px`;
    
    // Tạo quỹ đạo phân tán ngẫu nhiên 360 độ
    const angle = Math.random() * Math.PI * 2;
    const velocity = 80 + Math.random() * 250;
    const dx = Math.cos(angle) * velocity;
    const dy = Math.sin(angle) * velocity;
    
    container.appendChild(particle);
    
    particle.animate([
        { transform: 'translate(0, 0) scale(1.2)', opacity: 1 },
        { transform: `translate(${dx}px, ${dy + 120}px) scale(0.1)`, opacity: 0 }
    ], {
        duration: 1000 + Math.random() * 1000,
        easing: 'cubic-bezier(0.1, 0.8, 0.3, 1)',
        fill: 'forwards'
    });
    
    setTimeout(() => particle.remove(), 2500);
}
