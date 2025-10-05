import { state, csrfToken, setCsrfToken, API_URL } from './state.js';
import { showLoading, hideLoading, showNotification, closeModal, toLocalDateString } from './utils.js';
import { renderHistory, populateBorrowForm } from './render.js';
import { showFlushHistoryModal } from './modals.js';
import { setActivePage } from './ui.js';
import { loadPageData } from './app.js';

/**
 * Mengunggah file dengan progress bar menggunakan XMLHttpRequest.
 * @param {string} url - URL tujuan.
 * @param {FormData} formData - Data form yang akan diunggah.
 * @param {HTMLElement} submitButton - Tombol submit untuk menampilkan status loading.
 * @returns {Promise<string>} - Meresolve dengan response text dari server.
 */
const uploadWithProgress = (url, formData, submitButton) => {
    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', url, true);

        const progressFill = submitButton.querySelector('.btn__progress');
        if (progressFill) progressFill.style.width = '0%';
        submitButton.classList.add('btn--loading');
        submitButton.disabled = true;

        xhr.upload.onprogress = (event) => {
            if (event.lengthComputable && progressFill) {
                const percentComplete = (event.loaded / event.total) * 100;
                progressFill.style.width = percentComplete + '%';
            }
        };
        
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

/**
 * Fungsi pusat untuk menangani error fetch API dan menampilkan notifikasi yang sesuai.
 * @param {Error} error - Objek error yang ditangkap.
 * @param {string} contextMessage - Pesan yang akan ditampilkan jika bukan error koneksi.
 */
const handleFetchError = (error, contextMessage) => {
    // Cek apakah ini error jaringan (misalnya, offline, DNS gagal)
    if (error instanceof TypeError && (error.message.includes('Failed to fetch') || error.message.includes('NetworkError'))) {
        showNotification('Koneksi gagal, periksa koneksi internet Anda.', 'error');
    } else {
        // Untuk error lainnya, tampilkan pesan konteks yang diberikan
        showNotification(contextMessage || 'Terjadi kesalahan yang tidak diketahui.', 'error');
    }
    // Lempar kembali error agar fungsi pemanggil tahu bahwa terjadi kegagalan
    throw error;
};

/**
 * Mengambil token CSRF dari server.
 */
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
        handleFetchError(error, 'Gagal memuat token keamanan.');
        if (!state.session.isLoggedIn) {
             window.location.href = 'login.html';
        }
    }
};

/**
 * Mengambil pengaturan peminjaman dari server.
 */
export const fetchBorrowSettings = async () => {
    try {
        const response = await fetch(`${API_URL}?action=get_settings`);
        if (!response.ok) {
            throw new Error('Network response was not ok');
        }
        const result = await response.json();
        if (result.status === 'success' && result.data) {
            state.borrowSettings = {
                startTime: result.data.borrow_start_time,
                endTime: result.data.borrow_end_time,
                isManuallyLocked: result.data.is_manually_locked,
                isAppLocked: result.data.is_app_locked,
                lockReason: result.data.lock_reason,
                isLoaded: true
            };
        } else {
            throw new Error(result.message || 'Gagal memuat pengaturan peminjaman.');
        }
    } catch (error) {
        handleFetchError(error, 'Gagal memuat pengaturan peminjaman.');
    }
};

/**
 * Mengambil data utama aplikasi (items, borrowals, history) dari server.
 * @param {string} type - Tipe data yang akan diambil ('items', 'borrowals', 'history').
 */
export const fetchData = async (type) => {
    showLoading();
    try {
        const response = await fetch(`${API_URL}?action=get_data&type=${type}`);
        const result = await response.json();
        if (result.status === 'success') {
            if (type === 'items') {
                state.items = result.data.items;
                state.classifiers = result.data.classifiers;
            } else {
                state[type] = result.data;
            }
        } else {
            throw new Error(result.message);
        }
    } catch (error) {
        handleFetchError(error, `Gagal memuat data ${type}.`);
    } finally {
        hideLoading();
    }
};

/**
 * Mengambil data riwayat dengan paginasi, pencarian, dan filter tanggal.
 * @param {boolean} isLoadMore - Apakah ini permintaan untuk memuat lebih banyak data.
 */
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
        handleFetchError(error, 'Gagal memuat riwayat.');
        state.hasMoreHistory = false;
    } finally {
        renderHistory();
        state.isLoadingMoreHistory = false;
        if (!isLoadMore) hideLoading();
    }
};

/**
 * Menangani response JSON umum dari server dan menampilkan notifikasi.
 * @param {Response} response - Objek response dari fetch.
 * @returns {Promise<object>} - Hasil JSON dari response.
 */
export const handleApiResponse = async (response) => {
    const result = await response.json();
    if (result.status === 'error' && result.message.includes('kedaluwarsa')) {
        await getCsrfToken();
    }
    showNotification(result.message, result.status);
    return result;
};

/**
 * Menangani submit form untuk menambah atau mengedit barang.
 * @param {Event} e - Event submit form.
 */
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
        const defaultError = 'Gagal menyimpan data barang.';
        let errorMessage = defaultError;
        if (error.response) {
            try { errorMessage = JSON.parse(error.response).message || defaultError; } catch (parseError) { /* ignore */ }
        }
        handleFetchError(error, errorMessage);
    }
};

/**
 * Menangani permintaan untuk menghapus barang.
 * @param {string|number} id - ID barang yang akan dihapus.
 */
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
        handleFetchError(error, 'Gagal menghapus barang.');
    } finally { closeModal(); }
};

/**
 * Menangani submit form peminjaman barang.
 * @param {Event} e - Event submit form.
 */
export const handleBorrowFormSubmit = async (e) => {
    e.preventDefault();
    const form = e.target;
    const formData = new FormData();

    formData.append('borrower_name', form.querySelector('#borrowerName').value);
    formData.append('borrower_class', form.querySelector('#borrowerClassValue').value);
    formData.append('subject', form.querySelector('#subject').value);
    formData.append('action', 'borrow_item');
    formData.append('csrf_token', csrfToken);

    const itemRows = form.querySelectorAll('.borrow-item-row');
    itemRows.forEach((row, index) => {
        const itemId = row.querySelector('input[type="hidden"]').value;
        const quantity = row.querySelector('input[type="number"]').value;
        if (itemId && quantity) {
            formData.append(`items[${index}][id]`, itemId);
            formData.append(`items[${index}][quantity]`, quantity);
        }
    });

    try {
        const response = await fetch(API_URL, { method: 'POST', body: formData });
        const result = await handleApiResponse(response);
        if (result.status === 'success') {
            form.reset();
            document.getElementById('borrowItemsContainer').innerHTML = '';
            populateBorrowForm();
            setActivePage('#return');
        }
    } catch(error) { handleFetchError(error, 'Gagal memproses peminjaman.'); }
};

/**
 * Menangani submit form untuk menambah barang ke peminjaman yang sudah ada.
 * @param {Event} e - Event submit form.
 */
export const handleAddItemFormSubmit = async (e) => {
    e.preventDefault();
    const form = e.target;
    const formData = new FormData();

    formData.append('transaction_id', form.querySelector('input[name="transaction_id"]').value);
    formData.append('action', 'add_to_borrowal');
    formData.append('csrf_token', csrfToken);

    const itemRows = form.querySelectorAll('.borrow-item-row');
    let hasItems = false;
    itemRows.forEach((row, index) => {
        const itemId = row.querySelector('input[name="item_id"]').value;
        const quantity = row.querySelector('input[type="number"]').value;
        if (itemId && quantity) {
            formData.append(`items[${index}][id]`, itemId);
            formData.append(`items[${index}][quantity]`, quantity);
            hasItems = true;
        }
    });

    if (!hasItems) {
        showNotification('Silakan pilih setidaknya satu alat untuk ditambahkan.', 'error');
        return;
    }

    try {
        const response = await fetch(API_URL, { method: 'POST', body: formData });
        const result = await handleApiResponse(response);
        if (result.status === 'success') {
            closeModal();
            loadPageData('#return');
        }
    } catch(error) { 
        handleFetchError(error, 'Gagal menambah alat.'); 
    }
};

/**
 * Menangani submit form pengembalian barang.
 * @param {Event} e - Event submit form.
 */
export const handleReturnFormSubmit = async(e) => {
    e.preventDefault();
    const form = e.target;
    const submitButton = form.querySelector('button[type="submit"]');
    const formData = new FormData(form);
    formData.append('action', 'return_item');
    formData.append('csrf_token', csrfToken);
    
    const galleryInput = form.querySelector('#returnProofGallery');
    const cameraInput = form.querySelector('#returnProofCamera');

    if (cameraInput && cameraInput.files.length > 0) {
        formData.set('proof_image', cameraInput.files[0], cameraInput.files[0].name);
    } else if (galleryInput && galleryInput.files.length > 0) {
        formData.set('proof_image', galleryInput.files[0], galleryInput.files[0].name);
    }
    formData.delete('proof_image_camera');

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
        const defaultError = 'Gagal mengunggah bukti pengembalian.';
        let errorMessage = defaultError;
        if (error.response) {
            try { errorMessage = JSON.parse(error.response).message || defaultError; } catch (parseError) { /* ignore */ }
        }
        handleFetchError(error, errorMessage);
    }
};

/**
 * Menangani submit form untuk impor data dari CSV.
 * @param {Event} e - Event submit form.
 */
export const handleImportCsvSubmit = async (e) => {
    e.preventDefault();
    const form = e.target;
    const submitButton = form.querySelector('button[type="submit"]');
    const formData = new FormData(form);
    formData.append('action', 'import_items');
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
            loadPageData('#stock');
        }
    } catch (error) {
        const defaultError = 'Gagal mengimpor file CSV.';
        let errorMessage = defaultError;
        if (error.response) {
            try {
                errorMessage = JSON.parse(error.response).message || defaultError;
            } catch (parseError) { /* ignore */ }
        }
        handleFetchError(error, errorMessage);
    }
};

/**
 * Menangani submit form untuk mengedit detail peminjaman.
 * @param {Event} e - Event submit form.
 */
export const handleEditBorrowalSubmit = async (e) => {
    e.preventDefault();
    const form = e.target;
    const formData = new FormData(form);
    formData.append('action', 'edit_borrowal');
    formData.append('csrf_token', csrfToken);
    
    try {
        const response = await fetch(API_URL, { method: 'POST', body: formData });
        const result = await handleApiResponse(response);
        if (result.status === 'success') {
            closeModal();
            await Promise.all([fetchData('borrowals'), fetchData('items')]);
            const activePage = document.querySelector('.page.active');
            if(activePage && activePage.id === 'return') {
                loadPageData('#return');
            }
        }
    } catch(error) {
        handleFetchError(error, 'Gagal memperbarui peminjaman.');
    }
};

/**
 * Menangani permintaan untuk menghapus satu item dari sebuah peminjaman.
 * @param {string|number} id - ID peminjaman (borrowal) yang akan dihapus.
 */
export const handleDeleteBorrowalItem = async (id) => {
    const formData = new FormData();
    formData.append('action', 'delete_borrowal');
    formData.append('id', id);
    formData.append('csrf_token', csrfToken);
    
    try {
        const response = await fetch(API_URL, { method: 'POST', body: formData });
        const result = await handleApiResponse(response);
        if(result.status === 'success') {
            loadPageData('#return');
        }
    } catch (error) {
        handleFetchError(error, 'Gagal menghapus item peminjaman.');
    } finally { 
        closeModal(); 
    }
};

/**
 * Menangani permintaan untuk menghapus satu entri riwayat.
 * @param {string|number} id - ID riwayat yang akan dihapus.
 */
export const handleDeleteHistoryItem = async (id) => {
    const formData = new FormData();
    formData.append('action', 'delete_history_item');
    formData.append('id', id);
    formData.append('csrf_token', csrfToken);
    
    try {
        const response = await fetch(API_URL, { method: 'POST', body: formData });
        const result = await handleApiResponse(response);
        if(result.status === 'success') {
            fetchAndRenderHistory();
        }
    } catch (error) {
        handleFetchError(error, 'Gagal menghapus riwayat.');
    } finally { 
        closeModal(); 
    }
};

/**
 * Menangani submit form untuk membersihkan seluruh riwayat.
 * @param {Event} e - Event submit form.
 */
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
    } catch (error) { handleFetchError(error, 'Proses gagal.'); }
};

/**
 * Menangani submit form untuk memperbarui kredensial akun.
 * @param {Event} e - Event submit form.
 */
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
        handleFetchError(error, 'Gagal memperbarui akun.');
    }
};

/**
 * Menangani permintaan untuk memperbarui pengaturan aplikasi.
 * @param {FormData} formData - Data form pengaturan.
 */
export const handleUpdateSettings = async (formData) => {
    try {
        const response = await fetch(API_URL, { method: 'POST', body: formData });
        const result = await handleApiResponse(response);
        if (result.status === 'success') {
            await fetchBorrowSettings();
            closeModal();
        }
    } catch (error) {
        handleFetchError(error, 'Gagal memperbarui pengaturan.');
    }
};