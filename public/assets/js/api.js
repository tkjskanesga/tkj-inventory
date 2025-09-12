import { state, csrfToken, setCsrfToken, API_URL } from './state.js';
import { showLoading, hideLoading, showNotification, closeModal, toLocalDateString } from './utils.js';
import { renderHistory } from './render.js';
import { showFlushHistoryModal } from './modals.js';
import { setActivePage } from './ui.js';
import { loadPageData } from './app.js';

const uploadWithProgress = (url, formData, submitButton) => {
    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', url, true);

        const progressFill = submitButton.querySelector('.btn__progress');
        if (progressFill) progressFill.style.width = '0%';
        submitButton.classList.add('btn--loading');
        submitButton.disabled = true;

        // Event listener untuk progress upload
        xhr.upload.onprogress = (event) => {
            if (event.lengthComputable && progressFill) {
                const percentComplete = (event.loaded / event.total) * 100;
                progressFill.style.width = percentComplete + '%';
            }
        };
        
        // Fungsi untuk membersihkan UI setelah selesai
        const cleanup = () => {
            submitButton.classList.remove('btn--loading');
            submitButton.disabled = false;
            if (progressFill) {
                setTimeout(() => {
                    progressFill.style.width = '0%';
                }, 500);
            }
        };

        xhr.onload = () => {
            cleanup();
            if (xhr.status >= 200 && xhr.status < 300) {
                resolve(xhr.responseText);
            } else {
                reject({ status: xhr.status, statusText: xhr.statusText, response: xhr.responseText });
            }
        };

        xhr.onerror = () => {
            cleanup();
            reject({ status: xhr.status, statusText: xhr.statusText });
        };

        xhr.send(formData);
    });
};

// Tangani semua komunikasi dengan server.
export const getCsrfToken = async () => {
    try {
        const response = await fetch(`${API_URL}?action=get_csrf_token`);
        const result = await response.json();
        if (result.status === 'success' && result.data.token) {
            setCsrfToken(result.data.token);
        } else {
            throw new Error('Gagal memuat token keamanan.');
        }
    } catch (error) {
        showNotification(error.message, 'error');
        if (!state.session.isLoggedIn) {
             window.location.href = 'login.html';
        }
    }
};

export const fetchData = async (type) => {
    showLoading();
    try {
        const response = await fetch(`${API_URL}?action=get_data&type=${type}`);
        const result = await response.json();
        if (result.status === 'success') {
            state[type] = result.data;
        } else {
            throw new Error(result.message);
        }
    } catch (error) {
        showNotification(`Gagal memuat data ${type}.`, 'error');
    } finally {
        hideLoading();
    }
};

export const fetchAndRenderHistory = async (isLoadMore = false) => {
    if (state.isLoadingMoreHistory) return;
    state.isLoadingMoreHistory = true;

    if (!isLoadMore) {
        state.historyPage = 1;
        state.history = [];
        showLoading();
    } else {
        state.historyPage++;
        const loaderContainer = document.getElementById('historyLoaderContainer');
        if (loaderContainer) {
             loaderContainer.innerHTML = `<div class="loading-spinner" style="width:30px;height:30px;border-width:3px;margin:1rem auto;"></div>`;
        }
    }
    
    const search = document.getElementById('historySearch').value;
    const date = toLocalDateString(state.selectedDate);
    
    try {
        const params = new URLSearchParams({
            action: 'get_data',
            type: 'history',
            page: state.historyPage,
            search: search,
            filterDate: date
        });
        
        const response = await fetch(`${API_URL}?${params.toString()}`);
        const result = await response.json();

        if (result.status === 'success' && result.data) {
            state.history = isLoadMore ? [...state.history, ...result.data.records] : result.data.records;
            state.hasMoreHistory = result.data.hasMore;
        } else {
            throw new Error(result.message || 'Gagal memuat riwayat.');
        }
    } catch (error) {
        showNotification(error.message, 'error');
        state.hasMoreHistory = false;
    } finally {
        renderHistory();
        state.isLoadingMoreHistory = false;
        if (!isLoadMore) hideLoading();
    }
};

export const handleApiResponse = async (response) => {
    const result = await response.json();
    if (result.status === 'error' && result.message.includes('kedaluwarsa')) {
        await getCsrfToken();
    }
    showNotification(result.message, result.status);
    return result;
};

export const handleItemFormSubmit = async (e) => {
    e.preventDefault();
    const form = e.target;
    const submitButton = form.querySelector('button[type="submit"]');
    const formData = new FormData(form);
    formData.append('action', formData.get('id') ? 'edit_item' : 'add_item');
    formData.append('csrf_token', csrfToken);
    
    const imageInput = form.querySelector('#itemImage');
    const hasFile = imageInput && imageInput.files.length > 0;

    try {
        let responseText;
        if (hasFile) {
            responseText = await uploadWithProgress(API_URL, formData, submitButton);
        } else {
            // Gunakan fetch biasa jika tidak ada file dan tambahkan state loading
            submitButton.classList.add('btn--loading');
            submitButton.disabled = true;
            const response = await fetch(API_URL, { method: 'POST', body: formData });
            responseText = await response.text();
            submitButton.classList.remove('btn--loading');
            submitButton.disabled = false;
        }
        
        const result = JSON.parse(responseText);
        if (result.status === 'error' && result.message.includes('kedaluwarsa')) {
            await getCsrfToken();
        }
        showNotification(result.message, result.status);

        if (result.status === 'success') { 
            closeModal(); 
            loadPageData('#stock'); 
        }
    } catch (error) {
        if (!hasFile && submitButton) {
            submitButton.classList.remove('btn--loading');
            submitButton.disabled = false;
        }
        const defaultError = 'Gagal terhubung ke server.';
        let errorMessage = defaultError;
        if (error.response) {
            try { errorMessage = JSON.parse(error.response).message || defaultError; } catch (parseError) { /* ignore */ }
        }
        showNotification(errorMessage, 'error');
    }
};

export const handleDeleteItem = async (id) => {
    const formData = new FormData();
    formData.append('action', 'delete_item');
    formData.append('id', id);
    formData.append('csrf_token', csrfToken);
    
    try {
        const response = await fetch(API_URL, { method: 'POST', body: formData });
        const result = await handleApiResponse(response);
        if(result.status === 'success') {
            loadPageData('#stock');
        }
    } catch (error) {
        showNotification('Gagal terhubung ke server.', 'error');
    } finally { closeModal(); }
};

export const handleBorrowFormSubmit = async (e) => {
    e.preventDefault();
    const form = e.target;
    const formData = new FormData(form);
    formData.append('action', 'borrow_item');
    formData.append('csrf_token', csrfToken);
    
    try {
        const response = await fetch(API_URL, { method: 'POST', body: formData });
        const result = await handleApiResponse(response);
        if (result.status === 'success') {
            form.reset();
            ['itemDropdownContainer', 'classDropdownContainer'].forEach(id => {
                const container = document.getElementById(id);
                if (container) {
                    container.querySelector('.custom-dropdown__value').style.display = 'none';
                    container.querySelector('.custom-dropdown__placeholder').style.display = 'block';
                }
            });
            document.getElementById('maxQuantity').textContent = '';
            setActivePage('#return');
        }
    } catch(error) { showNotification('Gagal terhubung ke server.', 'error'); }
};

export const handleReturnFormSubmit = async(e) => {
    e.preventDefault();
    const form = e.target;
    const submitButton = form.querySelector('button[type="submit"]');
    const formData = new FormData(form);
    formData.append('action', 'return_item');
    formData.append('csrf_token', csrfToken);
    
    try {
        const responseText = await uploadWithProgress(API_URL, formData, submitButton);
        const result = JSON.parse(responseText);

        if (result.status === 'error' && result.message.includes('kedaluwarsa')) {
            await getCsrfToken();
        }
        showNotification(result.message, result.status);

        if (result.status === 'success') { 
            closeModal(); 
            setActivePage('#history'); 
        }
    } catch (error) {
        const defaultError = 'Gagal terhubung ke server.';
        let errorMessage = defaultError;
        if (error.response) {
            try { errorMessage = JSON.parse(error.response).message || defaultError; } catch (parseError) { /* ignore */ }
        }
        showNotification(errorMessage, 'error');
    }
};

export const handleFlushHistoryFormSubmit = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    formData.append('action', 'flush_history');
    formData.append('csrf_token', csrfToken);
    
    try {
        const response = await fetch(API_URL, { method: 'POST', body: formData });
        const result = await handleApiResponse(response);

        if (result.status === 'success') {
            closeModal();
            fetchAndRenderHistory();
        } else {
            showFlushHistoryModal().then(() => {
                const captchaInput = document.getElementById('captchaInput');
                if (captchaInput) {
                     captchaInput.insertAdjacentHTML('afterend', `<small class="text-danger" style="display:block; margin-top:5px;">${result.message}</small>`);
                }
            });
        }
    } catch (error) { showNotification('Proses gagal.', 'error'); }
};

export const handleAccountUpdateSubmit = async (e) => {
    e.preventDefault();
    const form = e.target;
    const formData = new FormData(form);
    formData.append('action', 'update_credentials');
    formData.append('csrf_token', csrfToken);

    try {
        const response = await fetch(API_URL, { method: 'POST', body: formData });
        const result = await handleApiResponse(response);
        if (result.status === 'success') {
            state.session.username = formData.get('username');
            document.getElementById('usernameDisplay').textContent = state.session.username;
            document.getElementById('mobileUsernameDisplay').textContent = state.session.username;
            closeModal();
        }
    } catch (error) {
        showNotification('Gagal terhubung ke server.', 'error');
    }
};