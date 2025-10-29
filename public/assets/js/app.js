import { state } from './state.js';
import { closeModal, showLoading, hideLoading, showNotification } from './utils.js';
import { checkSession, handleLogout } from './auth.js';
import { setupTheme, setupUIForRole, setActivePage, toggleSidebar, handleThemeToggle, updateFabFilterState, manageBorrowLockOverlay, updateStockPageFabs, updateAccountPageFabs,
        updateClearFilterFabVisibility, updateFilterButtonState } from './ui.js';
import { initializeStockPage, renderReturns, populateBorrowForm, setupStockEventListeners, filterStock } from './render.js';
import { fetchData, getCsrfToken, fetchAndRenderHistory, handleBorrowFormSubmit, fetchBorrowSettings, getBackupStatus, getExportStatus, getImportStatus } from './api.js';
import { renderAccountsPage, handleSelectAllAccounts } from './account.js';
import { showItemModal, showDeleteItemModal, showReturnModal, showAddItemModal, showExportHistoryModal, showFlushHistoryModal, showAccountModal, 
        showDateFilterModal, showDeleteHistoryModal, showBorrowSettingsModal, showEditBorrowalModal, showDeleteBorrowalModal, showImportCsvModal, 
        showBackupModal, showImportHistoryModal, showDesktopAppModal, showDeleteMultipleItemsModal, showExportStockModal, showAddAccountModal, showDeleteMultipleAccountsModal, showExportAccountsModal } from './modals.js';
import { renderStatisticsPage } from './statistics.js';

// --- DOM REFERENCES ---
const returnSearchInput = document.getElementById('returnSearch');
const historySearchInput = document.getElementById('historySearch');
const hamburgerMenu = document.getElementById('hamburgerMenu');
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
const fabDeleteSelectedAccountsBtn = document.getElementById('fabDeleteSelectedAccountsBtn');
const fabSelectAllAccountsBtn = document.getElementById('fabSelectAllAccountsBtn');
const fabSelectAllItemsBtn = document.getElementById('fabSelectAllItemsBtn');
const modal = document.getElementById('modal');
const borrowForm = document.getElementById('borrowForm');
const stockGrid = document.getElementById('stockGrid');

let isOffline = !navigator.onLine;

// Orkestrasi seluruh aplikasi
export const loadPageData = async (hash) => {
    const pageId = hash.substring(1);
    switch (pageId) {
        case 'stock':
            await fetchData('items');
            initializeStockPage();
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
                await renderAccountsPage();
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

/**
 * Menangani logika untuk memilih semua (atau membatalkan pilihan semua) alat yang terlihat di halaman stok.
 */
const handleSelectAllItems = () => {
    const visibleItemCards = document.querySelectorAll('#stockGrid .card:not([style*="display: none"])');
    const visibleItemIds = Array.from(visibleItemCards).map(card => card.dataset.itemId);
    
    const selectableItemIds = visibleItemIds.filter(id => {
        const item = state.items.find(i => i.id.toString() === id);
        return item && item.current_quantity > 0;
    });

    const allSelectableVisibleSelected = selectableItemIds.length > 0 && selectableItemIds.every(id => state.selectedItems.includes(id));

    if (allSelectableVisibleSelected) {
        state.selectedItems = state.selectedItems.filter(id => !selectableItemIds.includes(id));
    } else {
        const newSelectionSet = new Set([...state.selectedItems, ...selectableItemIds]);
        state.selectedItems = Array.from(newSelectionSet);
    }

    // Perbarui UI
    visibleItemCards.forEach(card => {
        const itemId = card.dataset.itemId;
        if (selectableItemIds.includes(itemId)) { // Hanya toggle kartu yang bisa dipilih
            const shouldBeSelected = state.selectedItems.includes(itemId);
            card.classList.toggle('is-selected', shouldBeSelected);
        }
    });

    updateStockPageFabs();
};

// Setup event listeners untuk UI elements
const setupEventListeners = () => {
    window.addEventListener('pageshow', (event) => {
        if (event.persisted) checkSession();
    });
    
    hamburgerMenu?.addEventListener('click', toggleSidebar);
    overlay?.addEventListener('click', toggleSidebar);
    desktopThemeToggle?.addEventListener('click', handleThemeToggle);
    
    document.body.addEventListener('click', (e) => {
        // --- Logika Autocomplete ---
        const suggestion = e.target.closest('#nameSuggestions .suggestion-item');
        if (suggestion) {
            e.stopPropagation(); // Hentikan event agar tidak memicu listener lain
            const form = suggestion.closest('form');
            if (!form) return;

            const borrowerNameInput = form.querySelector('#borrowerName');
            const classDropdown = form.querySelector('#classDropdownContainer');
            if (!borrowerNameInput || !classDropdown) return;

            const nama = suggestion.dataset.nama;
            const kelas = suggestion.dataset.kelas;

            borrowerNameInput.value = nama;

            const classValueInput = classDropdown.querySelector('#borrowerClassValue');
            const valueDisplay = classDropdown.querySelector('.hybrid-dropdown__value');
            const placeholder = classDropdown.querySelector('.hybrid-dropdown__placeholder');

            if (classValueInput) classValueInput.value = kelas;
            if (valueDisplay) {
                valueDisplay.textContent = kelas;
                valueDisplay.style.display = 'block';
            }
            if (placeholder) placeholder.style.display = 'none';

            const nameSuggestionsContainer = form.querySelector('#nameSuggestions');
            if (nameSuggestionsContainer) nameSuggestionsContainer.style.display = 'none';
            return;
        }
        
        // --- Logika Penutupan Dropdown dan Elemen Lain ---
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

        const accountsPage = document.getElementById('accounts');
        const isAccountsPageActive = accountsPage && accountsPage.classList.contains('active');
        if (isAccountsPageActive && state.selectedAccounts.length > 0 && !e.target.closest('.account-list-item') && !e.target.closest('.fab-container')) {
            state.selectedAccounts = [];
            document.querySelectorAll('#accountList .account-list-item.is-selected').forEach(item => item.classList.remove('is-selected'));
            updateAccountPageFabs();
        }

        const sidebarLink = e.target.closest('.sidebar__nav .nav__link:not(.theme-toggle)');
        if (sidebarLink) {
            e.preventDefault();
            setActivePage(sidebarLink.getAttribute('href'));
            toggleSidebar();
        }
        
        const mobileProfileToggle = e.target.closest('#mobileUserProfileToggle');
        if (mobileProfileToggle) {
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

    
    document.addEventListener('click', (e) => {
        const target = e.target.closest('.card__action-btn, .return-btn, .add-item-btn, .close-modal-btn, #fabAddItemBtn, .custom-dropdown__selected, .delete-history-btn, #borrowSettingsBtn, .edit-borrowal-btn, .delete-borrowal-btn, #exportActionsBtn, #exportCsvOnlyBtn, #backupToDriveBtn, #flushHistoryBtn, #importCsvBtn, #fabAddAccountBtn, #fabImportAccountsBtn, #fabExportAccountsBtn');
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
        if (target.matches('#fabAddAccountBtn')) showAddAccountModal();
        if (target.matches('#fabImportAccountsBtn')) {
            e.preventDefault();
            showImportCsvModal('accounts');
        }
        if (target.matches('#fabExportAccountsBtn')) {
            e.preventDefault();
            showExportAccountsModal();
        }
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
    
    fabDeleteSelectedAccountsBtn?.addEventListener('click', () => {
        if (state.selectedAccounts.length > 0 && state.session.role === 'admin') {
            showDeleteMultipleAccountsModal();
        }
    });

    fabSelectAllAccountsBtn?.addEventListener('click', () => {
        if (state.session.role === 'admin') {
            handleSelectAllAccounts();
        }
    });

    fabSelectAllItemsBtn?.addEventListener('click', () => {
        if (state.session.role === 'admin') {
            handleSelectAllItems();
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

    // Event Listener untuk FAB Hapus Filter
    const fabClearFilter = document.getElementById('fabClearFilterBtn');
    fabClearFilter?.addEventListener('click', () => {
        state.currentStockFilter = 'all';
        state.currentClassifierFilter = null;
        updateFilterButtonState();
        filterStock();
    });
    
    setupStockEventListeners();

    returnSearchInput?.addEventListener('input', renderReturns);

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
    const currentYear = new Date().getFullYear();
    console.log(
        `%c© Developed by Alea Farrel - ${currentYear} Inventaris TKJ\n              All Rights Reserved.`,
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
        if (exportStatus.status !== 'idle') {
            if (exportStatus.export_type === 'accounts') {
                showExportAccountsModal(exportStatus);
            } else {
                showExportStockModal(exportStatus);
            }
        }
        if (importStatus.status !== 'idle') showImportCsvModal(importStatus.import_type || 'stock', importStatus);
    }

    let lastPage = localStorage.getItem('lastActivePage') || '#stock';
    if (state.session.role !== 'admin' && (lastPage === '#statistics' || lastPage === '#accounts')) {
        lastPage = '#stock';
    }
    
    const filterBtnInitial = document.getElementById('filterBtn');
    if (filterBtnInitial) {
        filterBtnInitial.className = 'btn filter-all';
        filterBtnInitial.innerHTML = `<i class='bx bx-filter-alt'></i> Semua`;
        state.currentStockFilter = 'all';
        state.currentClassifierFilter = null;
    }
    const accountFilterBtn = document.getElementById('accountFilterBtn');
    if (accountFilterBtn) {
        accountFilterBtn.className = 'btn filter-all';
        accountFilterBtn.innerHTML = `<i class='bx bx-filter-alt'></i> Semua`;
    }
    
    setupTheme();
    setupEventListeners();
    setupUIForRole();
    setActivePage(lastPage);
    startLiveClock();
    updateFilterButtonState();
    updateClearFilterFabVisibility();
    showDesktopButtonIfNeeded();
    manageBorrowLockOverlay();
    hideLoading();
    setInterval(pollSettingsAndManageLock, 2000);
};

init();