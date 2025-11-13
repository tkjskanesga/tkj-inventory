// Fungsi pembantu untuk keperluan umum.
const loadingOverlay = document.getElementById('loadingOverlay');
const notificationEl = document.getElementById('notification');
const modal = document.getElementById('modal');
const modalTitle = document.getElementById('modalTitle');
const modalBody = document.getElementById('modalBody');

/**
 * Fungsi untuk melakukan escaping pada HTML untuk mencegah serangan XSS.
 * Mengubah karakter khusus HTML menjadi entitas yang aman,
 * @param {string} str - String yang akan di-escape.
 * @returns {string} - String yang sudah aman untuk ditampilkan di HTML.
 */
export const escapeHTML = (str) => {
    if (str === null || str === undefined) {
        return '';
    }
    return String(str).replace(/[&<>"]/g, function(match) {
        return {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            "'": '&#39;',
            '"': '&quot;'
        }[match];
    });
};


export const showLoading = () => loadingOverlay.classList.add('is-visible');
export const hideLoading = () => loadingOverlay.classList.remove('is-visible');

export const showNotification = (message, type = 'success') => {
    notificationEl.textContent = message;
    notificationEl.className = `notification ${type} show`;
    setTimeout(() => notificationEl.classList.remove('show'), 3000);
};

export const openModal = (title, content) => {
    modalTitle.innerHTML = title;
    modalBody.innerHTML = content;
    modal.classList.add('is-visible');
};

export const closeModal = () => {
    if (!modal.classList.contains('is-visible')) {
        return;
    }
    modal.classList.add('is-closing');
    
    setTimeout(() => {
        modal.classList.remove('is-visible');
        modal.classList.remove('is-closing');
        modalBody.innerHTML = '';
    }, 300);
};

export const createEmptyState = (title, text) => `
    <div class="empty-state">
        <img src="assets/favicon/empty.png" alt="Data Kosong" class="empty-state__image">
        <h2 class="empty-state__title">${escapeHTML(title)}</h2>
        <p class="empty-state__text">${escapeHTML(text)}</p>
    </div>`;

export const searchData = (dataArray, searchTerm, fieldsToSearch) => {
    const term = searchTerm.toLowerCase();
    if (!term) return dataArray;
    return dataArray.filter(item =>
        fieldsToSearch.some(field =>
            item[field] && String(item[field]).toLowerCase().includes(term)
        )
    );
};

export const toLocalDateString = (date) => {
    if (!date) return '';
    const d = new Date(date);
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().split('T')[0];
};

/* Draggable Image Viewer */
export const showImageViewer = (imageUrl, title = 'Bukti Pengembalian') => {
    const viewer = document.getElementById('imageViewer');
    const viewerImage = document.getElementById('viewerImage');
    const viewerTitle = viewer.querySelector('.image-viewer__title');
    const loading = viewer.querySelector('.image-viewer__loading');
    
    if (!viewer || !viewerImage) return;
    
    viewerTitle.textContent = title;
    
    viewerImage.classList.remove('loaded');
    viewerImage.src = '';
    loading.style.display = 'flex';
    
    viewer.style.display = 'flex';
    const isMobile = window.innerWidth <= 840;
    const viewerWidth = isMobile ? window.innerWidth * 0.85 : 600;
    const viewerHeight = isMobile ? window.innerHeight * 0.7 : 500;
    
    if (isMobile) {
        viewer.style.width = `${viewerWidth}px`;
        viewer.style.height = `${viewerHeight}px`;
    } else {
        viewer.style.width = '600px';
        viewer.style.height = '500px';
    }
    
    viewer.style.left = `${(window.innerWidth - viewerWidth) / 2}px`;
    viewer.style.top = `${(window.innerHeight - viewerHeight) / 2}px`;
    
    viewer.classList.remove('is-closing');
    viewer.classList.add('is-visible');
    
    const img = new Image();
    img.onload = () => {
        viewerImage.src = imageUrl;
        viewerImage.classList.add('loaded');
        loading.style.display = 'none';
    };
    img.onerror = () => {
        loading.innerHTML = '<p style="color: var(--danger-color);">Gagal memuat gambar</p>';
    };
    img.src = imageUrl;
};

const closeImageViewer = () => {
    const viewer = document.getElementById('imageViewer');
    if (!viewer) return;
    
    if (!viewer.classList.contains('is-visible') || viewer.classList.contains('is-closing')) {
        return;
    }
    
    viewer.classList.add('is-closing');
    viewer.classList.remove('is-dragging');
    
    setTimeout(() => {
        const viewerImage = document.getElementById('viewerImage');
        if (viewerImage) {
            viewerImage.src = '';
            viewerImage.classList.remove('loaded');
        }
        viewer.style.display = 'none';
        viewer.classList.remove('is-closing');
        viewer.classList.remove('is-visible');
    }, 300);
};

const initializeImageViewer = () => {
    const viewer = document.getElementById('imageViewer');
    if (!viewer) return;
    
    const header = viewer.querySelector('.image-viewer__header');
    const closeBtn = viewer.querySelector('.close-btn');
    const resizeHandle = viewer.querySelector('.image-viewer__resize-handle');
    
    let isDragging = false;
    let isResizing = false;
    let currentX, currentY, initialX, initialY;
    let initialWidth, initialHeight;
    
    closeBtn?.addEventListener('click', closeImageViewer);
    
    const dragStart = (e) => {
        if (e.target.closest('.image-viewer__actions') || 
            e.target.closest('.image-viewer__resize-handle')) return;
        
        isDragging = true;
        const touch = e.type.includes('touch') ? e.touches[0] : e;

        if (!touch) {
            return;
        }
        
        initialX = touch.clientX - viewer.offsetLeft;
        initialY = touch.clientY - viewer.offsetTop;
        
        viewer.style.cursor = 'grabbing';
        header.style.cursor = 'grabbing';
        viewer.classList.add('is-dragging');
    };
    
    const dragMove = (e) => {
        if (!isDragging) return;
        e.preventDefault();
        
        const touch = e.type.includes('touch') ? e.touches[0] : e;
        currentX = touch.clientX - initialX;
        currentY = touch.clientY - initialY;
        
        const maxX = window.innerWidth - viewer.offsetWidth;
        const maxY = window.innerHeight - viewer.offsetHeight;
        
        currentX = Math.max(0, Math.min(currentX, maxX));
        currentY = Math.max(0, Math.min(currentY, maxY));
        
        viewer.style.left = `${currentX}px`;
        viewer.style.top = `${currentY}px`;
    };
    
    const dragEnd = () => {
        isDragging = false;
        viewer.style.cursor = '';
        header.style.cursor = 'move';
        viewer.classList.remove('is-dragging');
    };
    
    header?.addEventListener('mousedown', dragStart);
    document.addEventListener('mousemove', dragMove);
    document.addEventListener('mouseup', dragEnd);
    
    header?.addEventListener('touchstart', dragStart, { passive: false });
    document.addEventListener('touchmove', dragMove, { passive: false });
    document.addEventListener('touchend', dragEnd);
    
    const resizeStart = (e) => {
        e.stopPropagation();
        isResizing = true;
        
        const touch = e.type.includes('touch') ? e.touches[0] : e;
        
        initialX = touch.clientX;
        initialY = touch.clientY;
        initialWidth = viewer.offsetWidth;
        initialHeight = viewer.offsetHeight;
        
        viewer.classList.add('is-dragging');
        
        if (e.type.includes('touch')) {
            e.preventDefault();
        }
    };
    
    const resizeMove = (e) => {
        if (!isResizing) return;
        
        if (e.type.includes('touch')) {
            e.preventDefault();
        }
        
        const touch = e.type.includes('touch') ? e.touches[0] : e;
        const deltaX = touch.clientX - initialX;
        const deltaY = touch.clientY - initialY;
        
        let newWidth = initialWidth + deltaX;
        let newHeight = initialHeight + deltaY;
        
        const isMobile = window.innerWidth <= 840;
        const minWidth = isMobile ? 280 : 300;
        const minHeight = isMobile ? 200 : 250;
        const maxWidth = window.innerWidth * 0.9;
        const maxHeight = window.innerHeight * 0.9;
        
        newWidth = Math.max(minWidth, Math.min(newWidth, maxWidth));
        newHeight = Math.max(minHeight, Math.min(newHeight, maxHeight));
        
        viewer.style.width = `${newWidth}px`;
        viewer.style.height = `${newHeight}px`;
    };
    
    const resizeEnd = () => {
        if (!isResizing) return;
        isResizing = false;
        viewer.classList.remove('is-dragging');
    };
    
    if (resizeHandle) {
        resizeHandle.addEventListener('mousedown', resizeStart);
        document.addEventListener('mousemove', resizeMove);
        document.addEventListener('mouseup', resizeEnd);
        
        resizeHandle.addEventListener('touchstart', resizeStart, { passive: false });
        document.addEventListener('touchmove', resizeMove, { passive: false });
        document.addEventListener('touchend', resizeEnd);
        document.addEventListener('touchcancel', resizeEnd);
    }
};


if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeImageViewer);
} else {
    initializeImageViewer();
}