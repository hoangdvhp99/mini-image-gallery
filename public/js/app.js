import { fetchMediaList, uploadMedia, updateMedia, deleteMedia, likeMedia, commentMedia, fetchIdeas, submitIdea, likeIdea } from './api.js';
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
    
    // Navigation & Ideas Elements
    tabHome: document.getElementById('tabHome'),
    tabLbeo: document.getElementById('tabLbeo'),
    tabIdeas: document.getElementById('tabIdeas'),
    homeSection: document.getElementById('homeSection'),
    ideasSection: document.getElementById('ideasSection'),
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
    downloadSwappedBtn: document.getElementById('downloadSwappedBtn')
};

// Global States
let selectedFiles = [];
let globalMediaList = [];
let activeMediaName = "";
let isInitialLoad = true;
let currentTab = "home";

// Lấy thông tin từ URL
const urlParams = new URLSearchParams(window.location.search);
const isAdmin = urlParams.get('isAdmin') === '1';

// Đăng ký các hàm đóng mở modal lên window để HTML onclick (từ các nút đóng modal tĩnh trong HTML) có thể gọi được
window.closeModal = () => {
    closeModal(elements);
    activeMediaName = "";
};

window.closeEditModal = () => {
    closeEditModal(elements);
};

// --- Fetch & Render Thư Viện ---
async function fetchImages(search = '') {
    try {
        let media = await fetchMediaList(search);
        globalMediaList = media;
        
        let displayList = media;
        if (currentTab === 'lbeo') {
            displayList = media.filter(item => 
                item.name.toLowerCase().includes('lbeo') || 
                item.hashtags.some(tag => tag.includes('lbeo'))
            );
        }
        
        const targetId = urlParams.get('id');

        renderGalleryGrid(displayList, isAdmin, elements, {
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
                    const result = await deleteMedia(fileName, urlParams.get('isAdmin') || '0');
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

    try {
        const result = await updateMedia(oldName, urlParams.get('isAdmin') || '0', formData);
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
    [elements.tabHome, elements.tabLbeo, elements.tabIdeas].forEach(btn => {
        if (btn) btn.classList.remove('active');
    });

    // Reset layout defaults
    elements.uploadContainer.classList.remove('hidden');
    elements.galleryContainer.className = 'md:col-span-3 space-y-4';
    elements.lbeoBanner.classList.add('hidden');
    elements.homeSection.classList.remove('hidden');
    elements.ideasSection.classList.add('hidden');

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
        loadIdeas();
    }
}

// Đăng ký sự kiện click các Tab điều hướng
if (elements.tabHome) elements.tabHome.addEventListener('click', () => switchTab('home'));
if (elements.tabLbeo) elements.tabLbeo.addEventListener('click', () => switchTab('lbeo'));
if (elements.tabIdeas) elements.tabIdeas.addEventListener('click', () => switchTab('ideas'));

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
            elements.faceSwapCounter.classList.remove('hidden');
            elements.faceSwapLabel.textContent = `✓ Đã chọn: ${e.target.files[0].name}`;
            elements.faceSwapLabel.classList.add('text-emerald-400');
        } else {
            elements.faceSwapCounter.classList.add('hidden');
            elements.faceSwapLabel.textContent = 'Chọn ảnh mặt của bạn (JPG/PNG)';
            elements.faceSwapLabel.classList.remove('text-emerald-400');
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
            const result = await res.json();

            if (!res.ok || !result.success) {
                throw new Error(result.message || 'Lỗi hệ thống hoán đổi khuôn mặt AI.');
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

// Khởi tạo chạy lần đầu
fetchImages();
