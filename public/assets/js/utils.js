// Fungsi pembantu untuk keperluan umum.

const loadingOverlay = document.getElementById('loadingOverlay');
const notificationEl = document.getElementById('notification');
const modal = document.getElementById('modal');
const modalTitle = document.getElementById('modalTitle');
const modalBody = document.getElementById('modalBody');

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
    modal.classList.remove('is-visible');
    setTimeout(() => { modalBody.innerHTML = ''; }, 300);
};

export const createEmptyState = (title, text) => `
    <div class="empty-state">
        <img src="assets/favicon/empty.png" alt="Data Kosong" class="empty-state__image">
        <h2 class="empty-state__title">${title}</h2>
        <p class="empty-state__text">${text}</p>
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