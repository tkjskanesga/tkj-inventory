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
    // Daftar karakter yang akan di-escape diperbarui (apostrof dihapus dari daftar).
    return String(str).replace(/[&<>"]/g, function(match) {
        return {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
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