import { state } from './state.js';
import { closeModal, showLoading, hideLoading, showNotification, createEmptyState } from './utils.js';
import { checkSession, handleLogout } from './auth.js';
import { setupTheme, setupUIForRole, setActivePage, toggleSidebar, handleThemeToggle, updateFabFilterState, manageBorrowLockOverlay, updateStockPageFabs } from './ui.js';
import { applyStockFilterAndRender, renderReturns, populateBorrowForm } from './render.js';
import { fetchData, getCsrfToken, fetchAndRenderHistory, handleBorrowFormSubmit, fetchBorrowSettings, getBackupStatus, getExportStatus, getImportStatus } from './api.js';
import { showItemModal, showDeleteItemModal, showReturnModal, showAddItemModal, showExportHistoryModal, showFlushHistoryModal, showAccountModal, 
        showDateFilterModal, showDeleteHistoryModal, showBorrowSettingsModal, showEditBorrowalModal, showDeleteBorrowalModal, showImportCsvModal, 
        showBackupModal, showImportHistoryModal, showDesktopAppModal, showDeleteMultipleItemsModal, showExportStockModal } from './modals.js';
import { renderStatisticsPage } from './statistics.js';

// --- DOM REFERENCES ---
const stockSearchInput = document.getElementById('stockSearch');
const returnSearchInput = document.getElementById('returnSearch');
const historySearchInput = document.getElementById('historySearch');
const accountSearchInput = document.getElementById('accountSearch');
const filterBtn = document.getElementById('filterBtn');
const filterOptions = document.getElementById('filterOptions');
const accountFilterBtn = document.getElementById('accountFilterBtn');
const accountFilterOptions = document.getElementById('accountFilterOptions');
const hamburgerMenu = document.getElementById('hamburgerMenu');
const closeSidebar = document.getElementById('closeSidebar');
const overlay = document.getElementById('overlay');
const desktopThemeToggle = document.getElementById('desktopThemeToggle');
const userProfileToggle = document.getElementById('userProfileToggle');
const userProfileMenu = document.getElementById('userProfileMenu');
const dropdownLogoutBtn = document.getElementById('dropdownLogoutBtn');
const accountBtn = document.getElementById('accountBtn');
const desktopAppBtn = document.getElementById('desktopAppBtn');
const fabFilterDateBtn = document.getElementById('fabFilterDateBtn');
const fabBorrowSelectedBtn = document.getElementById('fabBorrowSelectedBtn');
const fabDeleteSelectedBtn = document.getElementById('fabDeleteSelectedBtn');
const fabImportStockBtn = document.getElementById('fabImportStockBtn');
const fabExportStockBtn = document.getElementById('fabExportStockBtn');
const modal = document.getElementById('modal');
const borrowForm = document.getElementById('borrowForm');
const stockGrid = document.getElementById('stockGrid');

let isOffline = !navigator.onLine;

let studentAccounts = [
    { nis: '12345678', name: 'Alea Farrel', class: 'XII-TKJ 1' },
    { nis: '87654321', name: 'Budi Santoso', class: 'XII-TKJ 2' },
    { nis: '11223344', name: 'Citra Lestari', class: 'XI-TKJ 1' },
    { nis: '44332211', name: 'Dewi Anggraini', class: 'XI-TKJ 2' },
    { nis: '98765432', name: 'Eko Prasetyo', class: 'X-TKJ 1' },
    { nis: '55667788', name: 'Fitria Hasanah', class: 'X-TKJ 2' },
];
let currentAccountFilter = 'all';

const applyAccountFilterAndRender = () => {
    const searchTerm = document.getElementById('accountSearch').value.toLowerCase();
    let filtered = studentAccounts;

    if (currentAccountFilter !== 'all') {
        filtered = filtered.filter(account => account.class === currentAccountFilter);
    }

    if (searchTerm) {
        filtered = filtered.filter(account => 
            account.name.toLowerCase().includes(searchTerm) || 
            account.nis.includes(searchTerm)
        );
    }
    renderAccounts(filtered);
}

const renderAccounts = (accountsToRender) => {
    const accountListContainer = document.getElementById('accountList');
    if (!accountListContainer) return;

    if (accountsToRender.length === 0) {
        accountListContainer.innerHTML = createEmptyState('Akun Tidak Ditemukan', 'Tidak ada akun siswa yang cocok dengan filter atau pencarian.');
        return;
    }

    const headerHTML = `
        <div class="account-list-header">
            <div style="text-align: center;">NIS</div>
            <div>Nama Siswa</div>
            <div>Kelas</div>
            <div style="text-align: center;">Aksi</div>
        </div>
    `;

    const itemsHTML = accountsToRender.map(account => `
        <div class="account-list-item">
            <div class="account-item__nis" data-label="NIS:">${account.nis}</div>
            <div class="account-item__name" data-label="Nama:">${account.name}</div>
            <div class="account-item__class" data-label="Kelas:">${account.class}</div>
            <div class="account-item__actions">
                <button class="btn btn-secondary action-btn" title="Ubah Password" onclick="showNotification('Fitur ini sedang dalam pengembangan.', 'error')">
                    <i class='bx bx-key'></i>
                </button>
                <button class="btn btn-danger action-btn" title="Hapus Akun" onclick="showNotification('Fitur ini sedang dalam pengembangan.', 'error')">
                    <i class='bx bxs-trash-alt'></i>
                </button>
            </div>
        </div>
    `).join('');

    accountListContainer.innerHTML = headerHTML + itemsHTML;
};

const renderAccountsPage = () => {
    applyAccountFilterAndRender();
};

// Orkestrasi seluruh aplikasi
export const loadPageData = async (hash) => {
    const pageId = hash.substring(1);
    switch (pageId) {
        case 'stock':
            await fetchData('items');
            applyStockFilterAndRender();
            break;
        case 'borrow':
            await fetchData('items');
            populateBorrowForm();
            break;
        case 'return':
            await Promise.all([fetchData('borrowals'), fetchData('items')]);
            renderReturns();
            break;
        case 'history':
            fetchAndRenderHistory();
            break;
        case 'statistics':
            if (state.session.role === 'admin') {
                await renderStatisticsPage();
            } else {
                setActivePage('#stock');
            }
            break;
        case 'accounts':
            if (state.session.role === 'admin') {
                renderAccountsPage();
            } else {
                setActivePage('#stock');
            }
            break;
    }
};

// Polling pengaturan peminjaman dan kelola overlay kunci
const pollSettingsAndManageLock = async () => {
    if (!navigator.onLine || isOffline) {
        if (!isOffline) {
            isOffline = true;
            showNotification('Koneksi terputus. Periksa koneksi anda.', 'error');
        }
        return;
    }

    try {
        if (document.getElementById('borrowSettingsForm')) return;
        await fetchBorrowSettings();
        if (isOffline) {
            isOffline = false;
            showNotification('Koneksi kembali online.', 'success');
        }
        manageBorrowLockOverlay();
    } catch (error) {
        if (!isOffline) isOffline = true;
    }
};

const startLiveClock = () => {
    const clockElement = document.getElementById('liveClock');
    if (!clockElement) return;

    const updateClock = () => {
        const now = new Date();
        const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
        const dayName = days[now.getDay()];
        const date = String(now.getDate()).padStart(2, '0');
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const year = now.getFullYear();
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        const seconds = String(now.getSeconds()).padStart(2, '0');
        clockElement.textContent = `${dayName}, ${date}/${month}/${year} - ${hours}:${minutes}:${seconds}`;
    };

    updateClock();
    setInterval(updateClock, 1000);
};

// Setup event listeners untuk UI elements
const setupEventListeners = () => {
    window.addEventListener('pageshow', (event) => {
        if (event.persisted) checkSession();
    });
    
    hamburgerMenu?.addEventListener('click', toggleSidebar);
    closeSidebar?.addEventListener('click', toggleSidebar);
    overlay?.addEventListener('click', toggleSidebar);
    desktopThemeToggle?.addEventListener('click', handleThemeToggle);
    
    document.body.addEventListener('click', (e) => {
        const isAdmin = state.session.role === 'admin';

        if (!e.target.closest('.profile-dropdown')) {
            document.querySelectorAll('.profile-dropdown__menu.is-open').forEach(m => m.classList.remove('is-open'));
            document.querySelectorAll('.profile-dropdown__toggle[aria-expanded="true"]').forEach(t => t.setAttribute('aria-expanded', 'false'));
        }
        if (!e.target.closest('.nav-dropdown')) {
            document.querySelectorAll('.nav-dropdown.is-open').forEach(d => {
                d.classList.remove('is-open');
                d.querySelector('.nav-dropdown__toggle').setAttribute('aria-expanded', 'false');
            });
        }
        if (!e.target.closest('.filter-dropdown')) {
             document.querySelectorAll('.filter-dropdown__menu.show').forEach(m => m.classList.remove('show'));
        }
        if (!e.target.closest('.custom-dropdown')) document.querySelectorAll('.custom-dropdown.is-open').forEach(d => d.classList.remove('is-open'));
        if (!e.target.closest('.hybrid-dropdown')) document.querySelectorAll('.hybrid-dropdown.is-open').forEach(d => d.classList.remove('is-open'));
        if (!e.target.closest('.action-dropdown')) document.querySelectorAll('.action-dropdown.is-open').forEach(d => d.classList.remove('is-open'));

        const fabGroup = e.target.closest('.fab-multi-action-group');
        document.querySelectorAll('.fab-multi-action-group.is-open').forEach(group => {
            if (group !== fabGroup) {
                group.classList.remove('is-open');
                group.querySelector('.fab-action').classList.remove('is-open');
            }
        });


        const isStockPageActive = document.getElementById('stock').classList.contains('active');
        if (isStockPageActive && state.selectedItems.length > 0 && !e.target.closest('.card') && !e.target.closest('.fab-container')) {
            state.selectedItems = [];
            document.querySelectorAll('#stockGrid .card.is-selected').forEach(card => card.classList.remove('is-selected'));
            updateStockPageFabs();
        }

        const sidebarLink = e.target.closest('.sidebar__nav .nav__link:not(.theme-toggle)');
        if (sidebarLink) {
            e.preventDefault();
            setActivePage(sidebarLink.getAttribute('href'));
            toggleSidebar();
        }
        
        const mobileProfileToggle = e.target.closest('#mobileUserProfileToggle');
        if (mobileProfileToggle && isAdmin) {
             const menu = document.getElementById('mobileUserProfileMenu');
             const isOpen = menu.classList.toggle('is-open');
             mobileProfileToggle.setAttribute('aria-expanded', isOpen);
        }

        if (e.target.closest('#mobileAccountBtn')) {
            toggleSidebar();
            showAccountModal();
        }
        if (e.target.closest('#sidebarLogoutBtn')) handleLogout();
        if (e.target.closest('.sidebar__nav .theme-toggle')) {
            e.preventDefault();
            handleThemeToggle();
        }
    });
    
    document.querySelector('.header').addEventListener('click', (e) => {
        const mainLink = e.target.closest('.nav__item:not(.nav-dropdown) > .nav__link, .header__logo');
        if (mainLink) {
            e.preventDefault();
            setActivePage(mainLink.getAttribute('href'));
        }

        const dropdownToggle = e.target.closest('.nav-dropdown__toggle');
        if (dropdownToggle) {
            e.preventDefault();
            const dropdown = dropdownToggle.closest('.nav-dropdown');
            const isOpen = dropdown.classList.toggle('is-open');
            dropdownToggle.setAttribute('aria-expanded', isOpen);
        }

        const dropdownItem = e.target.closest('.nav-dropdown__menu .nav__link');
        if(dropdownItem) {
            e.preventDefault();
            setActivePage(dropdownItem.getAttribute('href'));
            const dropdown = dropdownItem.closest('.nav-dropdown');
            dropdown.classList.remove('is-open');
            dropdown.querySelector('.nav-dropdown__toggle').setAttribute('aria-expanded', 'false');
        }
    });

    filterBtn?.addEventListener('click', () => filterOptions.classList.toggle('show'));
    filterOptions?.addEventListener('click', (e) => {
        if (e.target.tagName === 'LI') {
            state.currentStockFilter = e.target.dataset.filter;
            filterBtn.innerHTML = `<i class='bx bx-filter-alt'></i> ${e.target.textContent}`;
            filterBtn.className = `btn filter-${e.target.dataset.filter}`;
            filterOptions.classList.remove('show');
            applyStockFilterAndRender();
        }
    });

    accountFilterBtn?.addEventListener('click', () => accountFilterOptions.classList.toggle('show'));
    accountFilterOptions?.addEventListener('click', (e) => {
        if (e.target.tagName === 'LI') {
            const filterValue = e.target.dataset.filter;
            currentAccountFilter = filterValue;
            accountFilterBtn.innerHTML = `<i class='bx bx-filter-alt'></i> ${e.target.textContent}`;
            
            if (filterValue === 'all') {
                accountFilterBtn.className = 'btn filter-all';
            } else {
                accountFilterBtn.className = 'btn filter-available';
            }

            accountFilterOptions.classList.remove('show');
            applyAccountFilterAndRender();
        }
    });
    
    document.addEventListener('click', (e) => {
        const target = e.target.closest('.card__action-btn, .return-btn, .add-item-btn, .close-modal-btn, #fabAddItemBtn, .custom-dropdown__selected, .delete-history-btn, #borrowSettingsBtn, .edit-borrowal-btn, .delete-borrowal-btn, #exportActionsBtn, #exportCsvOnlyBtn, #backupToDriveBtn, #flushHistoryBtn, #importCsvBtn, #fabAddAccountBtn');
        if (!target) return;
    
        if (target.matches('.edit:not(:disabled)')) showItemModal(target.dataset.id);
        if (target.matches('.delete:not(:disabled)')) showDeleteItemModal(target.dataset.id);
        if (target.matches('.borrow-shortcut')) {
            const itemId = target.dataset.id;
            state.itemToBorrow = itemId;
            setActivePage('#borrow');
        }
        if (target.matches('.return-btn')) showReturnModal(target.dataset.id);
        if (target.matches('.add-item-btn')) showAddItemModal(target.dataset.id);
        if (target.matches('.edit-borrowal-btn')) showEditBorrowalModal(target.dataset.id);
        if (target.matches('.delete-borrowal-btn')) showDeleteBorrowalModal(target.dataset.id);
        if (target.matches('#fabAddItemBtn')) showItemModal();
        if (target.matches('#fabAddAccountBtn')) showNotification('Fitur ini sedang dalam pengembangan.', 'error');
        if (target.matches('.close-modal-btn')) closeModal();
        if (target.matches('.custom-dropdown__selected')) target.closest('.custom-dropdown').classList.toggle('is-open');
        if (target.matches('.delete-history-btn')) showDeleteHistoryModal(target.dataset.id);
        if (target.matches('#borrowSettingsBtn')) showBorrowSettingsModal();
        if (target.matches('#exportActionsBtn')) target.closest('.action-dropdown').classList.toggle('is-open');
        if (target.matches('#exportCsvOnlyBtn')) {
            e.preventDefault();
            if (state.history.length > 0) showExportHistoryModal();
            else showNotification('Tidak ada riwayat untuk diekspor.', 'error');
        }
        if (target.matches('#importCsvBtn')) {
            e.preventDefault();
            showImportHistoryModal();
        }
        if (target.matches('#backupToDriveBtn')) {
            e.preventDefault();
            if (state.history.length === 0) showNotification('Tidak ada riwayat untuk di-backup.', 'error');
            else showBackupModal();
        }
        if (target.matches('#flushHistoryBtn:not(:disabled)')) showFlushHistoryModal();
    });

    userProfileToggle?.addEventListener('click', () => {
        const isOpen = userProfileMenu.classList.toggle('is-open');
        userProfileToggle.setAttribute('aria-expanded', isOpen);
    });

    dropdownLogoutBtn?.addEventListener('click', handleLogout);
    accountBtn?.addEventListener('click', showAccountModal);
    desktopAppBtn?.addEventListener('click', showDesktopAppModal);
    
    fabFilterDateBtn.addEventListener('click', () => {
        const activePageId = document.querySelector('.page.active')?.id;
        if (activePageId !== 'history' && activePageId !== 'return') return;

        if (state.selectedDate) {
            state.selectedDate = null;
            updateFabFilterState();
            if (activePageId === 'history') fetchAndRenderHistory();
            else if (activePageId === 'return') renderReturns();
        } else {
            showDateFilterModal();
        }
    });

    fabBorrowSelectedBtn?.addEventListener('click', () => {
        if (state.selectedItems.length > 0) {
            state.itemsToBorrow = [...state.selectedItems];
            state.selectedItems = [];
            updateStockPageFabs();
            setActivePage('#borrow');
        }
    });

    fabDeleteSelectedBtn?.addEventListener('click', () => {
        if (state.selectedItems.length > 0 && state.session.role === 'admin') {
            showDeleteMultipleItemsModal();
        }
    });
    
    document.querySelectorAll('.fab-action').forEach(toggle => {
        toggle.addEventListener('click', (e) => {
            e.stopPropagation();
            const group = e.currentTarget.closest('.fab-multi-action-group');
            group.classList.toggle('is-open');
            e.currentTarget.classList.toggle('is-open');
        });
    });

    fabImportStockBtn?.addEventListener('click', () => showImportCsvModal('stock'));
    fabExportStockBtn?.addEventListener('click', () => showExportStockModal());
    modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });

    stockGrid?.addEventListener('click', (e) => {
        if (e.target.closest('.card__action-btn, .card__borrow-action-container, .card__image-overlay-actions')) return;

        const card = e.target.closest('.card');
        if (card) {
            const itemId = card.dataset.itemId;
            if (!itemId) return;
            const item = state.items.find(i => i.id == itemId);
            if (item && item.current_quantity <= 0) {
                showNotification('Barang ini sedang kosong dan tidak bisa dipilih.', 'error');
                return;
            }
            card.classList.toggle('is-selected');
            const index = state.selectedItems.indexOf(itemId);
            if (index > -1) state.selectedItems.splice(index, 1);
            else state.selectedItems.push(itemId);
            updateStockPageFabs();
        }
    });

    stockSearchInput?.addEventListener('input', applyStockFilterAndRender);
    returnSearchInput?.addEventListener('input', renderReturns);
    accountSearchInput?.addEventListener('input', applyAccountFilterAndRender);


    let historySearchTimeout;
    historySearchInput?.addEventListener('input', () => {
        clearTimeout(historySearchTimeout);
        historySearchTimeout = setTimeout(() => fetchAndRenderHistory(), 300);
    });

    borrowForm?.addEventListener('submit', handleBorrowFormSubmit);
};

// Tampilkan tombol aplikasi desktop jika diperlukan
const showDesktopButtonIfNeeded = () => {
    const isDesktop = !/Mobi|Android/i.test(navigator.userAgent);
    if (isDesktop && desktopAppBtn) desktopAppBtn.style.display = 'flex';
};

window.addEventListener("load", function () {
    console.log(
        "%c© Developed by Alea Farrel - 2025 Inventaris TKJ\n              All Rights Reserved.",
        "background: #222; color: #bada55; font-size:12px; padding:4px; border-radius:4px;"
    );
});

// --- APPLICATION INITIALIZATION ---
const init = async () => {
    await checkSession(); 
    showLoading();
    await Promise.all([getCsrfToken(), fetchBorrowSettings()]);

    if (state.session.role === 'admin') {
        const [backupStatus, exportStatus, importStatus] = await Promise.all([
            getBackupStatus(), getExportStatus(), getImportStatus()
        ]);
        if (backupStatus.status !== 'idle') showBackupModal(backupStatus);
        if (exportStatus.status !== 'idle') showExportStockModal(exportStatus);
        if (importStatus.status !== 'idle') showImportCsvModal(importStatus.import_type || 'stock', importStatus);
    }

    let lastPage = localStorage.getItem('lastActivePage') || '#stock';
    if (state.session.role !== 'admin' && (lastPage === '#statistics' || lastPage === '#accounts')) {
        lastPage = '#stock';
    }

    if (filterBtn) {
        filterBtn.className = 'btn filter-all';
        filterBtn.innerHTML = `<i class='bx bx-filter-alt'></i> Semua`;
    }
    if (accountFilterBtn) {
        accountFilterBtn.className = 'btn filter-all';
        accountFilterBtn.innerHTML = `<i class='bx bx-filter-alt'></i> Semua`;
    }
    
    setupTheme();
    setupEventListeners();
    setupUIForRole();
    setActivePage(lastPage);
    startLiveClock();
    showDesktopButtonIfNeeded();
    manageBorrowLockOverlay();
    hideLoading();
    setInterval(pollSettingsAndManageLock, 2000);
};

init();