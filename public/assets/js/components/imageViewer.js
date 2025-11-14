/**
 * Menampilkan draggable image viewer.
 * @param {string} imageUrl - URL gambar yang akan ditampilkan.
 * @param {string} [title='Bukti Pengembalian'] - Judul untuk window viewer.
 */
export const showImageViewer = (imageUrl, title = 'Bukti Pengembalian') => {
    const viewer = document.getElementById('imageViewer');
    const viewerImage = document.getElementById('viewerImage');
    const viewerTitle = viewer.querySelector('.image-viewer__title');
    const loading = viewer.querySelector('.image-viewer__loading');
    
    if (!viewer || !viewerImage) return;
    
    if (viewerTitle) viewerTitle.textContent = title;
    
    if (viewerImage) {
        viewerImage.classList.remove('loaded');
        viewerImage.src = '';
    }
    if (loading) loading.style.display = 'flex';
    
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
        if (viewerImage) {
            viewerImage.src = imageUrl;
            viewerImage.classList.add('loaded');
        }
        if (loading) loading.style.display = 'none';
    };
    img.onerror = () => {
        if (loading) loading.innerHTML = '<p style="color: var(--danger-color);">Gagal memuat gambar</p>';
    };
    img.src = imageUrl;
};

/**
 * Menutup image viewer.
 */
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

/**
 * Menginisialisasi fungsionalitas drag dan resize untuk image viewer.
 */
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
        if (header) header.style.cursor = 'grabbing';
        viewer.classList.add('is-dragging');
    };
    
    const dragMove = (e) => {
        if (!isDragging) return;
        e.preventDefault();
        
        const touch = e.type.includes('touch') ? e.touches[0] : e;
        if (!touch) return;
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
        if (header) header.style.cursor = 'move';
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
        if (!touch) return;
        
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
        if (!touch) return;
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

// Inisialisasi listener saat DOM siap
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeImageViewer);
} else {
    initializeImageViewer();
}