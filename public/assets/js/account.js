import { reconcileList } from './helpers/domReconciler.js';
import { state, API_URL, csrfToken } from './state.js';
import { createEmptyState, showNotification, closeModal, escapeHTML } from './utils.js';
import { handleApiResponse } from './api.js';
import { showEditAccountModal, showDeleteAccountModal } from './modals.js';
import { updateAccountPageFabs } from './ui.js';

// State lokal untuk halaman akun
let currentAccountFilter = 'all';
let accountSearchTimeout;

/**
 * Membuat opsi filter dropdown secara dinamis.
 * @param {Array} dynamicClasses - Array berisi nama-nama kelas unik.
 */
const setupDynamicFilters = (dynamicClasses) => {
    const filterOptions = document.getElementById('accountFilterOptions');
    if (!filterOptions) return;

    const classOptionsHTML = dynamicClasses.map(c => `<li data-filter="${escapeHTML(c)}">${escapeHTML(c)}</li>`).join('');
    const adminFilterHTML = `<li class="filter-divider"></li><li data-filter="admin" class="filter-admin-option">Admin</li>`;
    
    filterOptions.innerHTML = `<li data-filter="all">Semua</li>` + classOptionsHTML + adminFilterHTML;
};


/**
 * Mengambil data akun dari server dengan paginasi, pencarian, dan filter.
 * @param {boolean} isLoadMore - Apakah ini permintaan untuk memuat lebih banyak data.
 */
export const fetchAndRenderAccounts = async (isLoadMore = false) => {
    if (state.isLoadingMoreAccounts) return;
    state.isLoadingMoreAccounts = true;

    if (!isLoadMore) {
        state.accountPage = 1;
        state.accounts = [];
    } else {
        state.accountPage++;
        const loaderContainer = document.getElementById('accountLoaderContainer');
        if (loaderContainer) {
             loaderContainer.innerHTML = `<div class="loading-spinner" style="width:30px;height:30px;border-width:3px;margin:1rem auto;"></div>`;
        }
    }
    
    const search = document.getElementById('accountSearch').value;
    
    try {
        const params = new URLSearchParams({
            action: 'get_accounts',
            page: state.accountPage,
            search: search,
            filter: currentAccountFilter
        });
        
        const response = await fetch(`${API_URL}?${params.toString()}`);
        const result = await response.json();

        if (result.status === 'success' && result.data) {
            const newRecords = result.data.records || [];
            state.accounts = isLoadMore ? [...state.accounts, ...newRecords] : newRecords;
            state.hasMoreAccounts = result.data.hasMore;
            
            // Update daftar kelas global jika belum ada atau untuk sinkronisasi
            if (result.data.classes_full) {
                state.classes = result.data.classes_full;
            }
            
            if (!isLoadMore) {
                setupDynamicFilters(result.data.classes || []);
            }
            renderAccounts(isLoadMore);
        } else {
            throw new Error(result.message || 'Gagal memuat data akun.');
        }
    } catch (error) {
        showNotification(`Gagal memuat data akun: ${error.message}`, 'error');
        state.hasMoreAccounts = false;
        renderAccounts(isLoadMore);
    } finally {
        state.isLoadingMoreAccounts = false;
        updateAccountPageFabs();
    }
};

/**
 * Fungsi murni untuk merender HTML satu item akun.
 * Logika ini dipindahkan dari renderAccounts.
 * @param {object} account - Objek akun dari state.
 * @returns {string} String HTML untuk satu item.
 */
const createAccountItemHTML = (account) => {
    const isSelected = state.selectedAccounts.includes(account.id.toString());
    const displayId = account.role === 'admin' ? (account.username || '-') : (account.nis || '-');
    const displayClass = account.kelas || '-';

    // Gunakan data-account-id sebagai key
    return `
    <div class="account-list-item ${isSelected ? 'is-selected' : ''}" data-account-id="${escapeHTML(account.id)}">
        <div class="account-item__selection-icon">
            <i class='bx bxs-check-circle'></i>
        </div>
        <div class="account-item__nis" data-label="ID Pengguna:">${escapeHTML(displayId)}</div>
        <div class="account-item__name" data-label="Nama:">${escapeHTML(account.nama)}</div>
        <div class="account-item__class" data-label="Kelas:">${escapeHTML(displayClass)}</div>
        <div class="account-item__actions">
            <button class="btn btn-secondary action-btn edit-account-btn" title="Edit Akun">
                <i class='bx bx-key'></i>
            </button>
            <button class="btn btn-danger action-btn delete-account-btn" title="Hapus Akun">
                <i class='bx bx-trash'></i>
            </button>
        </div>
    </div>
    `;
};

/**
 * Merender daftar akun ke dalam container.
 * @param {boolean} isAppending - Jika true, data akan ditambahkan, bukan diganti.
 */
const renderAccounts = (isAppending = false) => {
    const accountListContainer = document.getElementById('accountList');
    const loaderContainer = document.getElementById('accountLoaderContainer');
    if (!accountListContainer || !loaderContainer) return;
    
    // --- Logika "Load More" ---
    if (isAppending) {
        const recordsToRender = state.accounts.slice(-Math.abs(state.accounts.length - (state.accountPage - 1) * 30));
        const itemsHTML = recordsToRender.map(createAccountItemHTML).join('');
        
        accountListContainer.insertAdjacentHTML('beforeend', itemsHTML);

    } else {        
        if (!accountListContainer.querySelector('.account-list-header')) {
            accountListContainer.innerHTML = `
                <div class="account-list-header">
                    <div style="text-align: center;">ID Pengguna</div>
                    <div>Nama Pengguna</div>
                    <div>Kelas</div>
                    <div style="text-align: center;">Aksi</div>
                </div>
            `;
        }
        
        let emptyState = accountListContainer.querySelector('.empty-state');
        if (state.accounts.length === 0) {
            if (!emptyState) {
                const emptyHTML = createEmptyState('Akun Tidak Ditemukan', 'Tidak ada akun yang cocok dengan filter atau pencarian.');
                accountListContainer.insertAdjacentHTML('beforeend', emptyHTML);
                emptyState = accountListContainer.querySelector('.empty-state');
            }
            emptyState.style.display = 'flex';
        } else if (emptyState) {
            emptyState.style.display = 'none';
        }

        reconcileList(
            accountListContainer,
            state.accounts,
            createAccountItemHTML,
            'id',
            'accountId',
            '.account-list-item'
        );
    }

    if (state.hasMoreAccounts) {
        loaderContainer.innerHTML = `<button id="loadMoreAccountsBtn" class="btn btn-primary">Selengkapnya</button>`;
        document.getElementById('loadMoreAccountsBtn').onclick = () => fetchAndRenderAccounts(true);
    } else {
        loaderContainer.innerHTML = `<p class="end-of-list">Semua data telah ditampilkan.</p>`;
    }
    
    attachActionListeners();
};


/**
 * Event listener untuk tombol edit dan hapus pada daftar akun.
 */
const attachActionListeners = () => {
    document.querySelectorAll('.account-list-item').forEach(item => {
        if (item._listenersAttached) return;

        item.addEventListener('click', (e) => {
            if (e.target.closest('.action-btn')) return;

            const accountId = item.dataset.accountId;
            if (!accountId) return;

            item.classList.toggle('is-selected');
            const index = state.selectedAccounts.indexOf(accountId);
            if (index > -1) {
                state.selectedAccounts.splice(index, 1);
            } else {
                state.selectedAccounts.push(accountId);
            }
            updateAccountPageFabs();
        });

        const editBtn = item.querySelector('.edit-account-btn');
        if (editBtn) {
            editBtn.addEventListener('click', () => {
                const accountId = item.dataset.accountId;
                const accountData = state.accounts.find(acc => acc.id == accountId);
                if (accountData) showEditAccountModal(accountData);
            });
        }

        const deleteBtn = item.querySelector('.delete-account-btn');
        if (deleteBtn) {
            deleteBtn.addEventListener('click', () => {
                const accountId = item.dataset.accountId;
                const accountData = state.accounts.find(acc => acc.id == accountId);
                if (accountData) showDeleteAccountModal(accountData);
            });
        }
        
        // Tandai bahwa listener sudah dipasang
        item._listenersAttached = true;
    });
};

/**
 * Mengatur event listener untuk filter dan pencarian.
 */
const setupFilterAndSearch = () => {
    const searchInput = document.getElementById('accountSearch');
    const filterBtn = document.getElementById('accountFilterBtn');
    const filterOptions = document.getElementById('accountFilterOptions');

    searchInput?.addEventListener('input', () => {
        clearTimeout(accountSearchTimeout);
        accountSearchTimeout = setTimeout(() => {
            fetchAndRenderAccounts(false);
        }, 300); // Debounce
    });
    
    filterBtn?.addEventListener('click', () => filterOptions.classList.toggle('show'));

    filterOptions?.addEventListener('click', (e) => {
        if (e.target.tagName === 'LI' && !e.target.classList.contains('filter-divider')) {
            currentAccountFilter = e.target.dataset.filter;
            filterBtn.innerHTML = `<i class='bx bx-filter-alt'></i> ${e.target.textContent}`;
            
            let btnClass = 'filter-all';
            if (currentAccountFilter === 'admin') {
                btnClass = 'filter-admin';
            } else if (currentAccountFilter !== 'all') {
                btnClass = 'filter-available';
            }
            filterBtn.className = `btn ${btnClass}`;

            filterOptions.classList.remove('show');
            fetchAndRenderAccounts(false);
        }
    });
};

/**
 * Menangani submit form untuk menambah atau mengedit akun.
 * @param {Event} e - Event submit dari form.
 */
export const handleAccountFormSubmit = async (e) => {
    e.preventDefault();
    const form = e.target;
    const submitButton = form.querySelector('button[type="submit"]');
    const formData = new FormData(form);
    const isEdit = formData.get('id') ? true : false;
    
    formData.append('action', isEdit ? 'edit_account' : 'add_account');
    formData.append('csrf_token', csrfToken);
    
    submitButton.disabled = true;

    try {
        const response = await fetch(API_URL, { method: 'POST', body: formData });
        const result = await handleApiResponse(response);
        if (result.status === 'success') {
            closeModal();
            await renderAccountsPage(); // Muat ulang data setelah sukses
        }
    } catch (error) {
        showNotification('Gagal memproses permintaan.', 'error');
    } finally {
        if (submitButton) submitButton.disabled = false;
    }
};

/**
 * Menangani penghapusan akun.
 * @param {string|number} id - ID akun yang akan dihapus.
 */
export const handleDeleteAccount = async (id) => {
    const formData = new FormData();
    formData.append('action', 'delete_account');
    formData.append('id', id);
    formData.append('csrf_token', csrfToken);

    try {
        const response = await fetch(API_URL, { method: 'POST', body: formData });
        const result = await handleApiResponse(response);
        if (result.status === 'success') {
            await renderAccountsPage(); // Muat ulang data setelah sukses
        }
    } catch (error) {
        showNotification('Gagal menghapus akun.', 'error');
    } finally {
        closeModal();
    }
};

/**
 * Menangani permintaan untuk menghapus beberapa akun sekaligus.
 * @param {string[]} ids - Array ID akun yang akan dihapus.
 */
export const handleDeleteMultipleAccounts = async (ids) => {
    const formData = new FormData();
    formData.append('action', 'delete_multiple_accounts');
    formData.append('csrf_token', csrfToken);
    ids.forEach(id => formData.append('ids[]', id));
    
    try {
        const response = await fetch(API_URL, { method: 'POST', body: formData });
        const result = await handleApiResponse(response);
        if(result.status === 'success') {
            state.selectedAccounts = [];
            await renderAccountsPage(); // Muat ulang data setelah sukses
        }
    } catch (error) {
        showNotification('Gagal menghapus beberapa akun.', 'error');
    } finally { 
        closeModal(); 
    }
};

/**
 * Menangani logika untuk memilih semua (atau membatalkan pilihan semua) akun yang terlihat.
 */
export const handleSelectAllAccounts = () => {
    const visibleAccountIds = state.accounts.map(acc => acc.id.toString());
    const allVisibleSelected = visibleAccountIds.length > 0 && visibleAccountIds.every(id => state.selectedAccounts.includes(id));

    if (allVisibleSelected) {
        state.selectedAccounts = state.selectedAccounts.filter(id => !visibleAccountIds.includes(id));
    } else {
        const newSelectionSet = new Set([...state.selectedAccounts, ...visibleAccountIds]);
        state.selectedAccounts = Array.from(newSelectionSet);
    }

    renderAccounts(false);
    updateAccountPageFabs();
};


/**
 * Fungsi utama untuk menginisialisasi halaman manajemen akun.
 */
export const renderAccountsPage = async () => {
    currentAccountFilter = 'all'; 
    state.selectedAccounts = [];
    
    const filterBtn = document.getElementById('accountFilterBtn');
    if (filterBtn) {
        filterBtn.innerHTML = `<i class='bx bx-filter-alt'></i> Semua`;
        filterBtn.className = 'btn filter-all';
    }
    
    const searchInput = document.getElementById('accountSearch');
    if(searchInput) searchInput.value = '';

    await fetchAndRenderAccounts(false);
};

setupFilterAndSearch();

window.addEventListener('classDataChanged', () => {
    if (document.getElementById('accounts')?.classList.contains('active')) {
        renderAccountsPage();
    }
});