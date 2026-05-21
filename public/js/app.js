import { fetchMediaList, uploadMedia, updateMedia, deleteMedia, likeMedia, commentMedia } from './api.js';
import { showToast, renderPreviewGrid, renderGalleryGrid, renderModalInteractions, openModal, closeModal, openEditModal, closeEditModal } from './ui.js';

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
    editDescInput: document.getElementById('editDescInput')
};

// Global States
let selectedFiles = [];
let globalMediaList = [];
let activeMediaName = "";
let isInitialLoad = true;

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
        globalMediaList = await fetchMediaList(search);
        
        const targetId = urlParams.get('id');

        renderGalleryGrid(globalMediaList, isAdmin, elements, {
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

// Khởi tạo chạy lần đầu
fetchImages();
