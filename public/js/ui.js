import { isVideo, cleanNameFrontend } from './utils.js';

export function showToast(message, type = 'success') {
    const toastContainer = document.getElementById('toastContainer');
    if (!toastContainer) return;
    const toast = document.createElement('div');
    toast.className = `p-4 rounded-xl shadow-2xl text-white font-bold text-xs flex items-center justify-between pointer-events-auto animate-slide-in border ${
        type === 'success' ? 'bg-neutral-900 border-emerald-500 text-emerald-400' : 'bg-neutral-900 border-rose-500 text-rose-400'
    }`;
    toast.innerHTML = `<span>${message}</span><button onclick="this.parentElement.remove()" class="ml-4 text-gray-500 hover:text-white font-bold text-base transition">&times;</button>`;
    toastContainer.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(100%)';
        toast.style.transition = 'all 0.3s ease-in';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// Render danh sách file xem trước và tạo input đặt tên
export function renderPreviewGrid(files, elements) {
    const { previewGrid, previewContainer, fileCounter } = elements;
    const validFiles = Array.from(files).filter(file => file.type.startsWith('image/') || file.type.startsWith('video/'));
    if (validFiles.length === 0) {
        showToast('Vui lòng chọn file hình ảnh hoặc video thích hợp!', 'error');
        return [];
    }

    fileCounter.textContent = `✓ Đã chọn ${validFiles.length} tệp`;
    fileCounter.classList.remove('hidden');
    previewGrid.innerHTML = '';

    validFiles.forEach((file, index) => {
        const objectUrl = URL.createObjectURL(file);
        const isItemVideo = file.type.startsWith('video/');

        const lastDot = file.name.lastIndexOf('.');
        const rawName = lastDot !== -1 ? file.name.substring(0, lastDot) : file.name;
        const cleanedDefaultName = cleanNameFrontend(rawName);

        const row = document.createElement('div');
        row.className = "flex items-center gap-2 bg-neutral-950 p-2 rounded-lg border border-neutral-800/60";

        let mediaElement = `<img src="${objectUrl}" class="w-12 h-12 object-cover rounded bg-black">`;
        if (isItemVideo) {
            mediaElement = `
                <div class="w-12 h-12 relative bg-black rounded overflow-hidden flex items-center justify-center">
                    <video src="${objectUrl}" class="w-full h-full object-cover" muted></video>
                    <span class="absolute text-[8px] bg-ph-orange text-black font-black px-0.5 rounded bottom-0">VID</span>
                </div>
            `;
        }

        row.innerHTML = `
            ${mediaElement}
            <div class="flex-grow">
                <input type="text" name="customNameInputs" data-index="${index}" value="${cleanedDefaultName}" placeholder="Đặt tên cho tệp..." class="w-full p-1.5 bg-neutral-900 border border-neutral-800 rounded text-xs text-white focus:outline-none focus:border-ph-orange transition font-medium">
            </div>
        `;
        previewGrid.appendChild(row);
    });

    previewContainer.classList.remove('hidden');
    return validFiles;
}

// Render Gallery Grid
export function renderGalleryGrid(mediaList, isAdmin, elements, callbacks) {
    const { galleryGrid } = elements;
    const { onOpenModal, onOpenEditModal, onDeleteImage } = callbacks;

    if (mediaList.length === 0) {
        galleryGrid.innerHTML = `<div class="col-span-full text-center text-neutral-600 py-12 font-bold text-sm tracking-wide bg-ph-dark rounded-xl border border-neutral-800">DANH SÁCH TRỐNG - CHƯA CÓ NỘI DUNG NÀO ĐƯỢC ĐĂNG</div>`;
        return;
    }

    // Đăng ký callbacks tạm thời trên window để hoạt động với onclick inline
    window.uiOpenModal = onOpenModal;
    window.uiOpenEditModal = onOpenEditModal;
    window.uiDeleteImage = onDeleteImage;

    galleryGrid.innerHTML = mediaList.map(item => {
        const checkVideo = isVideo(item.name);
        const currentLikes = item.likes || 0;
        const currentHahas = item.hahas || 0;
        const currentCommentsCount = item.comments ? item.comments.length : 0;

        const mediaPreview = checkVideo
            ? `<video src="${item.url}" class="object-contain w-full h-full max-h-44" muted></video><div class="absolute inset-0 bg-black bg-opacity-30 flex items-center justify-center pointer-events-none"><span class="text-black text-xs bg-ph-orange font-black px-2 py-1 rounded shadow-lg tracking-tighter">PLAY VIDEO</span></div>`
            : `<img src="${item.url}" alt="${item.name}" class="object-contain w-full h-full max-h-44 transition-transform duration-300 group-hover:scale-105">`;

        let actionButtons = `<a href="${item.url}" download="${item.name}" class="flex items-center justify-center gap-1 text-xs bg-neutral-800 text-gray-300 py-2 rounded-lg hover:bg-neutral-700 font-bold text-center transition col-span-2 tracking-wide border border-neutral-700">📥 TẢI XUỐNG</a>`;

        if (isAdmin) {
            actionButtons = `
                <a href="${item.url}" download="${item.name}" class="flex items-center justify-center gap-1 text-xs bg-neutral-800 text-gray-300 py-2 rounded-lg hover:bg-neutral-700 font-bold text-center transition col-span-2 tracking-wide border border-neutral-700">📥 TẢI XUỐNG</a>
                <button onclick="event.stopPropagation(); window.uiOpenEditModal('${item.name}')" class="flex items-center justify-center gap-1 text-xs bg-amber-950 text-amber-400 py-2 rounded-lg hover:bg-amber-900 font-bold text-center transition border border-amber-900/50">✏️ SỬA</button>
                <button onclick="event.stopPropagation(); window.uiDeleteImage('${item.name}')" class="flex items-center justify-center gap-1 text-xs bg-rose-950 text-rose-400 py-2 rounded-lg hover:bg-rose-900 font-bold text-center transition border border-rose-900/50">🗑️ XÓA</button>
            `;
        }

        const dateStr = new Date(item.uploadedAt).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' });

        return `
            <div onclick="window.uiOpenModal('${item.url}', '${item.name}')" class="bg-ph-dark rounded-xl overflow-hidden border border-neutral-800 flex flex-col justify-between shadow-lg group cursor-pointer">
                <div class="aspect-video bg-neutral-950 flex items-center justify-center overflow-hidden relative">${mediaPreview}</div>
                <div class="p-3.5 flex-grow flex flex-col justify-between space-y-2">
                    <div>
                        <h3 class="font-bold text-sm text-white group-hover:text-ph-orange transition truncate" title="${item.name}">${item.name}</h3>
                        <p class="text-xs text-neutral-500 mt-1 line-clamp-1 leading-relaxed">${item.description || '<i class="text-neutral-700">Không có mô tả sản phẩm</i>'}</p>
                        <div class="flex items-center justify-between mt-2">
                            <span class="text-[10px] text-neutral-600 font-mono">📅 ${dateStr}</span>
                            <span class="text-[10px] text-ph-orange font-bold flex items-center gap-2 bg-neutral-900 px-2 py-0.5 rounded border border-neutral-800"><span>❤️ ${currentLikes}</span><span>😆 ${currentHahas}</span><span>💬 ${currentCommentsCount}</span></span>
                        </div>
                    </div>
                    <div>
                        <div class="flex flex-wrap gap-1 my-1">${item.hashtags.map(tag => `<span class="bg-neutral-900 text-neutral-400 text-[10px] font-bold px-2 py-0.5 rounded border border-neutral-800">#${tag}</span>`).join('')}</div>
                        <div class="grid grid-cols-2 gap-2 pt-2 border-t border-neutral-800">${actionButtons}</div>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

// Render dữ liệu Modal
export function renderModalInteractions(name, mediaList, elements) {
    const { modalTitle, modalDesc, modalTags, likeCount, hahaCount, commentsContainer } = elements;
    const currentItem = mediaList.find(item => item.name === name);
    if (!currentItem) return;

    modalTitle.textContent = currentItem.name;
    modalDesc.innerHTML = currentItem.description || '<i class="text-neutral-700">Không có mô tả sản phẩm</i>';
    likeCount.textContent = currentItem.likes || 0;
    if (hahaCount) hahaCount.textContent = currentItem.hahas || 0;
    modalTags.innerHTML = currentItem.hashtags.map(tag => `<span class="bg-neutral-900 text-neutral-400 text-[10px] font-bold px-2 py-0.5 rounded border border-neutral-800">#${tag}</span>`).join('');
    
    const comments = currentItem.comments || [];
    if (comments.length === 0) {
        commentsContainer.innerHTML = `<div class="text-center text-neutral-600 text-xs py-8 italic">Chưa có bình luận.</div>`;
    } else {
        commentsContainer.innerHTML = comments.map(cmt => {
            return `<div class="bg-neutral-900 border border-neutral-800 p-2.5 rounded-lg text-xs space-y-1"><div class="flex items-center justify-between font-bold"><span class="text-ph-orange">🧡 ${cmt.author}</span><span class="text-[10px] text-neutral-600 font-mono">${new Date(cmt.createdAt).toLocaleString('vi-VN')}</span></div><p class="text-gray-300 break-all">${cmt.text}</p></div>`;
        }).join('');
        commentsContainer.scrollTop = commentsContainer.scrollHeight;
    }
}

// Mở Media Modal
export function openModal(url, name, mediaList, elements) {
    const { mediaModal, modalContent } = elements;
    const urlParams = new URLSearchParams(window.location.search);
    urlParams.set('id', name);
    window.history.pushState({ path: window.location.pathname + '?' + urlParams.toString() }, '', window.location.pathname + '?' + urlParams.toString());
    
    modalContent.innerHTML = isVideo(name)
        ? `<video src="${url}" class="max-w-full max-h-full rounded shadow-lg" controls autoplay></video>`
        : `<img src="${url}" class="max-w-full max-h-full object-contain">`;
        
    renderModalInteractions(name, mediaList, elements);
    mediaModal.classList.remove('hidden');
}

// Đóng Media Modal
export function closeModal(elements) {
    const { mediaModal, modalContent } = elements;
    mediaModal.classList.add('hidden');
    modalContent.innerHTML = '';
    const urlParams = new URLSearchParams(window.location.search);
    urlParams.delete('id');
    const clean = window.location.pathname + (urlParams.toString() ? '?' + urlParams.toString() : '');
    window.history.pushState({ path: clean }, '', clean);
}

// Mở Edit Modal
export function openEditModal(name, mediaList, elements) {
    const { editModal, editOldName, editNewNameInput, editTagsInput, editDescInput, editCategorySelect } = elements;
    const currentItem = mediaList.find(item => item.name === name);
    if (!currentItem) return;
    
    editOldName.value = currentItem.name;
    editNewNameInput.value = currentItem.name;
    editTagsInput.value = currentItem.hashtags.join(', ');
    editDescInput.value = currentItem.description || '';
    if (editCategorySelect) {
        editCategorySelect.value = currentItem.category || 'home';
    }
    editModal.classList.remove('hidden');
}

// Đóng Edit Modal
export function closeEditModal(elements) {
    const { editModal } = elements;
    editModal.classList.add('hidden');
}

// Render Ideas Grid
export function renderIdeas(ideas, elements, onLikeIdea) {
    const { ideasGrid } = elements;
    if (!ideasGrid) return;
    
    if (ideas.length === 0) {
        ideasGrid.innerHTML = `<div class="col-span-full text-center text-neutral-600 py-12 font-bold text-sm tracking-wide bg-ph-dark rounded-xl border border-neutral-800">DANH SÁCH TRỐNG - HÃY LÀ NGƯỜI ĐẦU TIÊN ĐÓNG GÓP Ý TƯỞNG!</div>`;
        return;
    }

    // Đăng ký callback trên window để gọi từ inline onclick
    window.uiLikeIdea = onLikeIdea;

    ideasGrid.innerHTML = ideas.map(idea => {
        const dateStr = new Date(idea.createdAt).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' });
        const hashtags = idea.hashtags || [];
        return `
            <div class="bg-ph-dark rounded-xl border border-neutral-800 p-4 flex flex-col justify-between shadow-lg hover:border-ph-orange transition duration-200">
                <div class="space-y-2 flex-grow">
                    <div class="flex items-center justify-between border-b border-neutral-800/60 pb-2">
                        <span class="text-xs font-bold text-ph-orange bg-neutral-900 border border-neutral-800 px-2 py-0.5 rounded-full">👤 ${idea.author}</span>
                        <span class="text-[10px] text-neutral-600 font-mono">📅 ${dateStr}</span>
                    </div>
                    <h3 class="font-bold text-sm text-white pt-1">${idea.title}</h3>
                    <p class="text-xs text-neutral-400 leading-relaxed break-words">${idea.description}</p>
                </div>
                <div class="mt-4 pt-3 border-t border-neutral-800/60 flex items-center justify-between">
                    <div class="flex flex-wrap gap-1">
                        ${hashtags.map(t => `<span class="text-[9px] font-bold bg-neutral-900 text-neutral-500 px-1.5 py-0.5 rounded">#${t}</span>`).join('')}
                    </div>
                    <button onclick="window.uiLikeIdea('${idea.id}')" class="flex items-center gap-1 bg-neutral-900 border border-neutral-800 hover:border-ph-orange hover:text-ph-orange px-2.5 py-1.5 rounded-lg text-[10px] font-bold text-white transition">
                        <span>❤️</span>
                        <span class="font-mono">${idea.likes || 0}</span>
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

// Expose showToast globally for non-module scripts like game.js
window.showToast = showToast;
