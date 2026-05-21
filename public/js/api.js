export async function fetchMediaList(search = '') {
    const res = await fetch(`/api/images?search=${encodeURIComponent(search)}`);
    if (!res.ok) throw new Error('Không thể lấy danh sách media');
    return await res.json();
}

export async function uploadMedia(formData) {
    const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData
    });
    const result = await res.json();
    if (!res.ok || !result.success) {
        throw new Error(result.message || 'Lỗi hệ thống khi upload!');
    }
    return result;
}

export async function updateMedia(oldName, isLbeo, formData) {
    const res = await fetch(`/api/images/${encodeURIComponent(oldName)}?isLbeo=${isLbeo}`, {
        method: 'PUT',
        body: formData
    });
    const result = await res.json();
    if (!res.ok || !result.success) {
        throw new Error(result.message || 'Lỗi hệ thống khi cập nhật!');
    }
    return result;
}

export async function deleteMedia(name, isLbeo) {
    const res = await fetch(`/api/images/${encodeURIComponent(name)}?isLbeo=${isLbeo}`, {
        method: 'DELETE'
    });
    if (!res.ok) {
        throw new Error('Lỗi hệ thống khi xóa!');
    }
    return await res.json();
}

export async function likeMedia(name) {
    const res = await fetch(`/api/images/${encodeURIComponent(name)}/like`, {
        method: 'POST'
    });
    const result = await res.json();
    if (!res.ok || !result.success) {
        throw new Error('Lỗi khi thả tim!');
    }
    return result;
}

export async function hahaMedia(name) {
    const res = await fetch(`/api/images/${encodeURIComponent(name)}/haha`, {
        method: 'POST'
    });
    const result = await res.json();
    if (!res.ok || !result.success) {
        throw new Error('Lỗi khi Haha!');
    }
    return result;
}

export async function commentMedia(name, text) {
    const res = await fetch(`/api/images/${encodeURIComponent(name)}/comment`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ text })
    });
    if (!res.ok) {
        throw new Error('Lỗi khi bình luận!');
    }
    return await res.json();
}

export async function fetchIdeas() {
    const res = await fetch('/api/ideas');
    if (!res.ok) throw new Error('Không thể lấy danh sách đóng góp ý kiến');
    return await res.json();
}

export async function submitIdea(data) {
    const res = await fetch('/api/ideas', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
    });
    const result = await res.json();
    if (!res.ok || !result.success) {
        throw new Error(result.message || 'Lỗi hệ thống khi gửi ý tưởng!');
    }
    return result;
}

export async function likeIdea(id) {
    const res = await fetch(`/api/ideas/${encodeURIComponent(id)}/like`, {
        method: 'POST'
    });
    const result = await res.json();
    if (!res.ok || !result.success) {
        throw new Error('Lỗi khi vote ý tưởng!');
    }
    return result;
}
