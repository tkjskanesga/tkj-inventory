import { state, csrfToken, setCsrfToken, API_URL } from './state.js';
import { showLoading, hideLoading, showNotification, closeModal, toLocalDateString } from './utils.js';
import { renderHistory, populateBorrowForm } from './render.js';
import { showFlushHistoryModal, updateBackupModalUI, updateExportModalUI, updateImportModalUI } from './modals.js';
import { setActivePage, updateStockPageFabs } from './ui.js';
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
        showNotification(contextMessage || 'Terjadi kesalahan yang tidak diketahui.', 'error');
    }
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
                state.classes = result.data.classes; // Menyimpan data kelas dinamis
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
 * Menangani permintaan untuk menghapus beberapa barang sekaligus.
 * @param {string[]} ids - Array ID barang yang akan dihapus.
 */
export const handleDeleteMultipleItems = async (ids) => {
    const formData = new FormData();
    formData.append('action', 'delete_multiple_items');
    formData.append('csrf_token', csrfToken);
    ids.forEach(id => formData.append('ids[]', id));
    
    try {
        const response = await fetch(API_URL, { method: 'POST', body: formData });
        const result = await handleApiResponse(response);
        if(result.status === 'success') {
            state.selectedItems = [];
            await loadPageData('#stock');
            updateStockPageFabs();
        }
    } catch (error) {
        handleFetchError(error, 'Gagal menghapus barang.');
    } finally { 
        closeModal(); 
    }
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

// --- FUNGSI UNTUK IMPOR CSV ---

/**
 * Memulai proses impor CSV dengan mengirim file ke server untuk dibuatkan antrian.
 * @param {FormData} formData - Form data yang berisi file CSV.
 */
export const startImportCsv = async (formData) => {
    formData.append('action', 'start_import_csv');
    formData.append('csrf_token', csrfToken);

    updateImportModalUI({ status: 'running', log: [{ time: new Date().toLocaleTimeString('id-ID'), message: 'Mengunggah file dan membuat antrian...', status: 'info' }] });

    try {
        const response = await fetch(API_URL, { method: 'POST', body: formData });
        const result = await response.json();

        if (result.status === 'success') {
            await processImportQueue();
        } else {
            // Tampilkan error di modal yang sama, tapi jangan tutup
            showNotification(result.message, 'error');
            // Reset form di modal
            const form = document.getElementById('importCsvForm');
            if (form) {
                form.reset();
                form.querySelector('.image-uploader__prompt').style.display = 'flex';
                form.querySelector('.image-uploader__file-info').style.display = 'none';
                form.querySelector('button[type="submit"]').disabled = false;
            }
             // Tampilkan kembali tampilan konfirmasi
            const confirmationView = document.getElementById('import-confirmation-view');
            const progressView = document.getElementById('import-progress-view');
            if(confirmationView) confirmationView.style.display = 'block';
            if(progressView) progressView.style.display = 'none';
        }
    } catch (error) {
        handleFetchError(error, 'Gagal memulai impor.');
        updateImportModalUI({ status: 'error', message: 'Gagal menghubungi server untuk memulai impor.' });
    }
};

/**
 * Memproses antrian impor CSV secara rekursif (polling).
 */
export const processImportQueue = async () => {
    try {
        const response = await fetch(`${API_URL}?action=process_import_job`);
        const result = await response.json();

        if (response.status === 429) {
            setTimeout(processImportQueue, 1000);
            return;
        }

        if (result.status === 'error' && !result.jobs) {
            updateImportModalUI({ status: 'error', message: result.message });
            return;
        }

        updateImportModalUI(result);

        if (result.status === 'running') {
            setTimeout(processImportQueue, 150);
        }
    } catch (error) {
        handleFetchError(error, 'Gagal memproses antrian impor.');
        updateImportModalUI({ status: 'error', message: 'Koneksi ke server terputus.' });
    }
};


/**
 * Mengambil status proses impor CSV saat ini.
 */
export const getImportStatus = async () => {
    try {
        const response = await fetch(`${API_URL}?action=get_import_status`);
        if (!response.ok) throw new Error('Network response not OK');
        return await response.json();
    } catch (error) {
        console.error('Gagal mengambil status impor:', error);
        return { status: 'idle' };
    }
};

/**
 * Membersihkan status impor CSV yang sudah selesai atau gagal.
 */
export const clearImportStatus = async () => {
    const formData = new FormData();
    formData.append('action', 'clear_import_status');
    formData.append('csrf_token', csrfToken);
    try {
        await fetch(API_URL, { method: 'POST', body: formData });
    } catch (error) {
        console.error('Gagal membersihkan status impor:', error);
    }
};


// --- FUNGSI UNTUK BACKUP & EKSPOR ---

/**
 * Memproses antrian backup riwayat secara rekursif.
 */
export const processBackupQueue = async () => {
    try {
        const response = await fetch(`${API_URL}?action=process_backup_job`);
        const result = await response.json();

        if (response.status === 429) {
            setTimeout(processBackupQueue, 1000);
            return;
        }

        if (result.status === 'error') {
            updateBackupModalUI({ status: 'error', message: result.message });
            return;
        }

        updateBackupModalUI(result);

        if (result.status === 'running' || result.status === 'finalizing') {
            setTimeout(processBackupQueue, 100);
        }
    } catch (error) {
        handleFetchError(error, 'Gagal memproses antrian backup.');
        updateBackupModalUI({ status: 'error', message: 'Koneksi ke server terputus.' });
    }
};

/**
 * Memulai proses backup riwayat ke Google Drive.
 */
export const startBackupToDrive = async () => {
    updateBackupModalUI({ status: 'running', total: 0, processed: 0, log: [{time: new Date().toLocaleTimeString('id-ID'), message: 'Memulai dan membuat antrian...', status: 'info'}] });
    
    const formData = new FormData();
    formData.append('action', 'backup_to_drive');
    formData.append('csrf_token', csrfToken);

    try {
        const response = await fetch(API_URL, { method: 'POST', body: formData });
        const result = await response.json();

        if (result.status === 'success') {
            await processBackupQueue();
        } else {
            updateBackupModalUI({ status: 'error', message: result.message });
        }
    } catch (error) {
        handleFetchError(error, 'Gagal memulai proses backup.');
        updateBackupModalUI({ status: 'error', message: 'Gagal menghubungi server untuk memulai backup.' });
    }
};

/**
 * Mengambil status proses backup riwayat saat ini.
 */
export const getBackupStatus = async () => {
    try {
        const response = await fetch(`${API_URL}?action=get_backup_status`);
        if (!response.ok) throw new Error('Network response was not ok');
        return await response.json();
    } catch (error) {
        console.error('Gagal mengambil status backup:', error);
        return { status: 'error', error: 'Gagal menghubungi server.' };
    }
};

/**
 * Membersihkan status backup riwayat yang sudah selesai.
 */
export const clearBackupStatus = async () => {
    const formData = new FormData();
    formData.append('action', 'clear_backup_status');
    formData.append('csrf_token', csrfToken);
    try {
        const response = await fetch(API_URL, { method: 'POST', body: formData });
        return await response.json();
    } catch (error) {
        handleFetchError(error, 'Gagal membersihkan status backup.');
    }
};

/**
 * Memproses antrian ekspor secara rekursif.
 */
export const processExportQueue = async () => {
    try {
        const response = await fetch(`${API_URL}?action=process_export_job`);
        const result = await response.json();

        if (response.status === 429) {
            setTimeout(processExportQueue, 1000);
            return;
        }

        if (result.status === 'error') {
            updateExportModalUI({ status: 'error', message: result.message });
            return;
        }

        updateExportModalUI(result);

        if (result.status === 'running' || result.status === 'finalizing') {
            setTimeout(processExportQueue, 100);
        }
    } catch (error) {
        handleFetchError(error, 'Gagal memproses antrian ekspor.');
        updateExportModalUI({ status: 'error', message: 'Koneksi ke server terputus.' });
    }
};

/**
 * Memulai proses ekspor stok ke Google Drive.
 */
export const startExportStockToDrive = async () => {
    updateExportModalUI({ status: 'running', total: 0, processed: 0, log: [{time: new Date().toLocaleTimeString('id-ID'), message: 'Memulai dan membuat antrian...', status: 'info'}] });
    
    const formData = new FormData();
    formData.append('action', 'start_export');
    formData.append('export_type', 'stock');
    formData.append('csrf_token', csrfToken);

    try {
        const response = await fetch(API_URL, { method: 'POST', body: formData });
        const result = await response.json();

        if (result.status === 'success') {
            await processExportQueue();
        } else {
            showNotification(result.message, 'error');
            closeModal();
        }
    } catch (error) {
        handleFetchError(error, 'Gagal memulai proses ekspor.');
        updateExportModalUI({ status: 'error', message: 'Gagal menghubungi server untuk memulai ekspor.' });
    }
};

/**
 * Memulai proses ekspor akun ke Google Drive.
 */
export const startExportAccountsToDrive = async () => {
    updateExportModalUI({ status: 'running', total: 0, processed: 0, log: [{time: new Date().toLocaleTimeString('id-ID'), message: 'Memulai dan membuat antrian...', status: 'info'}] });
    
    const formData = new FormData();
    formData.append('action', 'start_export');
    formData.append('export_type', 'accounts');
    formData.append('csrf_token', csrfToken);

    try {
        const response = await fetch(API_URL, { method: 'POST', body: formData });
        const result = await response.json();

        if (result.status === 'success') {
            await processExportQueue();
        } else {
            showNotification(result.message, 'error');
            closeModal();
        }
    } catch (error) {
        handleFetchError(error, 'Gagal memulai proses ekspor.');
        updateExportModalUI({ status: 'error', message: 'Gagal menghubungi server untuk memulai ekspor.' });
    }
};

/**
 * Mengambil status proses ekspor saat ini.
 */
export const getExportStatus = async () => {
    try {
        const response = await fetch(`${API_URL}?action=get_export_status`);
        if (!response.ok) throw new Error('Network response was not ok');
        return await response.json();
    } catch (error) {
        console.error('Gagal mengambil status ekspor:', error);
        return { status: 'error', error: 'Gagal menghubungi server.' };
    }
};

/**
 * Membersihkan status ekspor yang sudah selesai.
 */
export const clearExportStatus = async () => {
    const formData = new FormData();
    formData.append('action', 'clear_export_status');
    formData.append('csrf_token', csrfToken);
    try {
        const response = await fetch(API_URL, { method: 'POST', body: formData });
        return await response.json();
    } catch (error) {
        handleFetchError(error, 'Gagal membersihkan status ekspor.');
    }
};

// --- API UNTUK MANAJEMEN KELAS ---

/**
 * Menambahkan kelas baru.
 * @param {string} name - Nama kelas baru.
 * @returns {Promise<object>} - Hasil dari API.
 */
export const addClass = async (name) => {
    const formData = new FormData();
    formData.append('action', 'add_class');
    formData.append('name', name);
    formData.append('csrf_token', csrfToken);
    try {
        const response = await fetch(API_URL, { method: 'POST', body: formData });
        return await response.json();
    } catch (error) {
        return { status: 'error', message: 'Gagal terhubung ke server.' };
    }
};

/**
 * Mengedit nama kelas.
 * @param {number|string} id - ID kelas yang akan diedit.
 * @param {string} newName - Nama baru untuk kelas.
 * @returns {Promise<object>} - Hasil dari API.
 */
export const editClass = async (id, newName) => {
    const formData = new FormData();
    formData.append('action', 'edit_class');
    formData.append('id', id);
    formData.append('name', newName);
    formData.append('csrf_token', csrfToken);
    try {
        const response = await fetch(API_URL, { method: 'POST', body: formData });
        return await response.json();
    } catch (error) {
        return { status: 'error', message: 'Gagal terhubung ke server.' };
    }
};

/**
 * Menghapus kelas.
 * @param {number|string} id - ID kelas yang akan dihapus.
 * @returns {Promise<object>} - Hasil dari API.
 */
export const deleteClass = async (id) => {
    const formData = new FormData();
    formData.append('action', 'delete_class');
    formData.append('id', id);
    formData.append('csrf_token', csrfToken);
    try {
        const response = await fetch(API_URL, { method: 'POST', body: formData });
        return await response.json();
    } catch (error) {
        return { status: 'error', message: 'Gagal terhubung ke server.' };
    }
};