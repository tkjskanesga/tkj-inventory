import { state, API_URL, csrfToken } from './state.js';
import { createEmptyState, showNotification, closeModal } from './utils.js';
import { handleApiResponse } from './api.js';
import { showAddAccountModal, showEditAccountModal, showDeleteAccountModal } from './modals.js';

let allAccounts = [];
let currentAccountFilter = 'all';

/**
 * Membuat opsi filter dropdown secara dinamis.
 * @param {Array} dynamicClasses - Array berisi nama-nama kelas unik.
 */
const setupDynamicFilters = (dynamicClasses) => {
    const filterOptions = document.getElementById('accountFilterOptions');
    if (!filterOptions) return;

    // Buat HTML untuk setiap kelas dinamis
    const classOptionsHTML = dynamicClasses.map(c => `<li data-filter="${c}">${c}</li>`).join('');
    
    // Siapkan filter statis (Admin)
    const adminFilterHTML = `<li class="filter-divider"></li><li data-filter="admin" class="filter-admin-option">Admin</li>`;
    
    // Gabungkan semuanya
    filterOptions.innerHTML = `<li data-filter="all">Semua</li>` + classOptionsHTML + adminFilterHTML;
};


/**
 * Mengambil data semua akun dari server dan menginisiasi filter.
 */
export const fetchAccounts = async () => {
    try {
        const response = await fetch(`${API_URL}?action=get_accounts`);
        const result = await response.json();
        if (result.status === 'success') {
            allAccounts = result.data.users;
            // Panggil fungsi untuk membuat filter dinamis dengan data kelas dari API
            setupDynamicFilters(result.data.classes || []);
            return true;
        } else {
            throw new Error(result.message);
        }
    } catch (error) {
        showNotification(`Gagal memuat data akun: ${error.message}`, 'error');
        allAccounts = [];
        // Jika gagal, tetap tampilkan filter statis
        setupDynamicFilters([]);
        return false;
    }
};

/**
 * Menerapkan filter dan pencarian saat ini ke daftar akun dan merendernya.
 */
export const applyAccountFilterAndRender = () => {
    const searchTerm = document.getElementById('accountSearch').value.toLowerCase();
    let filtered;

    // Logika filter
    if (currentAccountFilter === 'admin') {
        filtered = allAccounts.filter(account => account.role === 'admin');
    } else if (currentAccountFilter === 'all') {
        filtered = allAccounts.filter(account => account.role !== 'admin');
    } else {
        filtered = allAccounts.filter(account => account.kelas === currentAccountFilter && account.role !== 'admin');
    }

    // Logika pencarian
    if (searchTerm) {
        filtered = filtered.filter(account =>
            (account.nama && account.nama.toLowerCase().includes(searchTerm)) ||
            (account.nis && account.nis.toLowerCase().includes(searchTerm)) ||
            (account.kelas && account.kelas.toLowerCase().includes(searchTerm)) ||
            (account.username && account.username.toLowerCase().includes(searchTerm))
        );
    }
    renderAccounts(filtered);
};

/**
 * Merender daftar akun ke dalam container.
 * @param {Array} accountsToRender - Array objek akun yang akan ditampilkan.
 */
const renderAccounts = (accountsToRender) => {
    const accountListContainer = document.getElementById('accountList');
    if (!accountListContainer) return;

    if (accountsToRender.length === 0) {
        const message = allAccounts.length > 0 ? 'Tidak ada akun yang cocok dengan filter.' : 'Belum ada akun pengguna yang ditambahkan.';
        accountListContainer.innerHTML = createEmptyState('Akun Tidak Ditemukan', message);
        return;
    }

    const headerHTML = `
        <div class="account-list-header">
            <div style="text-align: center;">ID Pengguna</div>
            <div>Nama Pengguna</div>
            <div>Kelas</div>
            <div style="text-align: center;">Aksi</div>
        </div>
    `;

    const itemsHTML = accountsToRender.map(account => {
        // Tampilkan username untuk admin, dan NIS untuk user
        const displayId = account.role === 'admin' ? (account.username || '-') : (account.nis || '-');
        const displayClass = account.kelas || '-';

        return `
        <div class="account-list-item" data-account-id="${account.id}">
            <div class="account-item__nis" data-label="ID Pengguna:">${displayId}</div>
            <div class="account-item__name" data-label="Nama:">${account.nama}</div>
            <div class="account-item__class" data-label="Kelas:">${displayClass}</div>
            <div class="account-item__actions">
                <button class="btn btn-secondary action-btn edit-account-btn" title="Edit Akun">
                    <i class='bx bx-key'></i>
                </button>
                <button class="btn btn-danger action-btn delete-account-btn" title="Hapus Akun">
                    <i class='bx bxs-trash-alt'></i>
                </button>
            </div>
        </div>
    `}).join('');

    accountListContainer.innerHTML = headerHTML + itemsHTML;
    attachActionListeners();
};

/**
 * Event listener untuk tombol edit dan hapus pada daftar akun.
 */
const attachActionListeners = () => {
    document.querySelectorAll('.edit-account-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const accountId = btn.closest('.account-list-item').dataset.accountId;
            const accountData = allAccounts.find(acc => acc.id == accountId);
            if (accountData) {
                showEditAccountModal(accountData);
            }
        });
    });

    document.querySelectorAll('.delete-account-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const accountId = btn.closest('.account-list-item').dataset.accountId;
             const accountData = allAccounts.find(acc => acc.id == accountId);
            if (accountData) {
                showDeleteAccountModal(accountData);
            }
        });
    });
};

/**
 * Mengatur event listener untuk filter dan pencarian.
 */
const setupFilterAndSearch = () => {
    const searchInput = document.getElementById('accountSearch');
    const filterBtn = document.getElementById('accountFilterBtn');
    const filterOptions = document.getElementById('accountFilterOptions');

    searchInput?.addEventListener('input', applyAccountFilterAndRender);
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
            applyAccountFilterAndRender();
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
            await renderAccountsPage();
        }
    } catch (error) {
        showNotification('Gagal memproses permintaan.', 'error');
    } finally {
        submitButton.disabled = false;
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
            await renderAccountsPage();
        }
    } catch (error) {
        showNotification('Gagal menghapus akun.', 'error');
    } finally {
        closeModal();
    }
};


/**
 * Fungsi utama untuk menginisialisasi halaman manajemen akun.
 */
export const renderAccountsPage = async () => {
    currentAccountFilter = 'all'; 
    const filterBtn = document.getElementById('accountFilterBtn');
    if (filterBtn) {
        filterBtn.innerHTML = `<i class='bx bx-filter-alt'></i> Semua`;
        filterBtn.className = 'btn filter-all';
    }

    const success = await fetchAccounts();
    if (success) {
        applyAccountFilterAndRender();
    } else {
        const accountListContainer = document.getElementById('accountList');
        if(accountListContainer) {
            accountListContainer.innerHTML = createEmptyState('Gagal Memuat', 'Tidak dapat mengambil data akun dari server.');
        }
    }
};

// Inisialisasi event listener sekali saat script dimuat
setupFilterAndSearch();