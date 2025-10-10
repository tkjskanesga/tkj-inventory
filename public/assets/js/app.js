import { state } from './state.js';
import { closeModal, showLoading, hideLoading, showNotification } from './utils.js';
import { checkSession, handleLogout } from './auth.js';
import { setupTheme, setupUIForRole, setActivePage, toggleSidebar, handleThemeToggle, updateFabFilterState, manageBorrowLockOverlay, updateStockPageFabs } from './ui.js';
import { applyStockFilterAndRender, renderReturns, populateBorrowForm } from './render.js';
import { fetchData, getCsrfToken, fetchAndRenderHistory, handleBorrowFormSubmit, fetchBorrowSettings, getBackupStatus } from './api.js';
import { showItemModal, showDeleteItemModal, showReturnModal, showAddItemModal, showExportHistoryModal, showFlushHistoryModal, showAccountModal, showDateFilterModal, showDeleteHistoryModal, showBorrowSettingsModal, showEditBorrowalModal, showDeleteBorrowalModal, showImportCsvModal, showBackupModal, showDesktopAppModal } from './modals.js';
import { renderStatisticsPage } from './statistics.js';

// --- DOM REFERENCES ---
const stockSearchInput = document.getElementById('stockSearch');
const returnSearchInput = document.getElementById('returnSearch');
const historySearchInput = document.getElementById('historySearch');
const filterBtn = document.getElementById('filterBtn');
const filterOptions = document.getElementById('filterOptions');
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
const fabImportCsvBtn = document.getElementById('fabImportCsvBtn');
const modal = document.getElementById('modal');
const borrowForm = document.getElementById('borrowForm');
const stockGrid = document.getElementById('stockGrid');

let isOffline = !navigator.onLine;

// Orkestrasi seluruh aplikasi.
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
    }
};

// Fungsi untuk polling status dari server
const pollSettingsAndManageLock = async () => {
    if (!navigator.onLine || isOffline) {
        // Hanya tampilkan notifikasi sekali saat pertama kali terdeteksi offline.
        if (!isOffline) {
            isOffline = true;
            showNotification('Koneksi terputus. Periksa koneksi anda.', 'error');
        }
        return;
    }

    try {
        // Jangan fetch jika modal pengaturan sedang terbuka (untuk admin)
        if (document.getElementById('borrowSettingsForm')) return;

        await fetchBorrowSettings();

        // Jika berhasil, berarti koneksi sudah pulih
        if (isOffline) {
            isOffline = false;
            showNotification('Koneksi kembali online.', 'success');
        }
        manageBorrowLockOverlay();

    } catch (error) {
        // Jika fetch gagal (error dilempar dari api.js), anggap sedang offline.
        if (!isOffline) {
            isOffline = true;
        }
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

const setupEventListeners = () => {
    window.addEventListener('pageshow', (event) => {
        if (event.persisted) {
            checkSession();
        }
    });
    
    hamburgerMenu?.addEventListener('click', toggleSidebar);
    closeSidebar?.addEventListener('click', toggleSidebar);
    overlay?.addEventListener('click', toggleSidebar);
    desktopThemeToggle?.addEventListener('click', handleThemeToggle);
    
    document.body.addEventListener('click', (e) => {
        const isAdmin = state.session.role === 'admin';
        // Close dropdowns when clicking outside
        if (!e.target.closest('.profile-dropdown')) {
            document.querySelectorAll('.profile-dropdown__menu').forEach(menu => menu.classList.remove('is-open'));
            document.querySelectorAll('.profile-dropdown__toggle').forEach(toggle => toggle.setAttribute('aria-expanded', 'false'));
        }
        if (!e.target.closest('.filter-dropdown')) filterOptions?.classList.remove('show');
        if (!e.target.closest('.custom-dropdown')) document.querySelectorAll('.custom-dropdown.is-open').forEach(d => d.classList.remove('is-open'));
        if (!e.target.closest('.hybrid-dropdown')) document.querySelectorAll('.hybrid-dropdown.is-open').forEach(d => d.classList.remove('is-open'));
        if (!e.target.closest('.action-dropdown')) document.querySelectorAll('.action-dropdown.is-open').forEach(d => d.classList.remove('is-open'));


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
        const target = e.target.closest('.nav__link, .header__logo');
        if (target) {
            e.preventDefault();
            setActivePage(target.getAttribute('href'));
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
    
    // Event delegation for dynamically added elements and modals
    document.addEventListener('click', (e) => {
        const target = e.target.closest('.card__action-btn, .return-btn, .add-item-btn, .close-modal-btn, #fabAddItemBtn, .custom-dropdown__selected, .delete-history-btn, #borrowSettingsBtn, .edit-borrowal-btn, .delete-borrowal-btn, #fabImportCsvBtn, #exportActionsBtn, #exportCsvOnlyBtn, #backupToDriveBtn, #flushHistoryBtn');
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
        if (target.matches('#fabImportCsvBtn')) showImportCsvModal();
        if (target.matches('.close-modal-btn')) closeModal();
        if (target.matches('.custom-dropdown__selected')) {
            target.closest('.custom-dropdown').classList.toggle('is-open');
        }
        if (target.matches('.delete-history-btn')) {
            showDeleteHistoryModal(target.dataset.id);
        }
        if (target.matches('#borrowSettingsBtn')) {
            showBorrowSettingsModal();
        }

        // History page actions
        if (target.matches('#exportActionsBtn')) {
            target.closest('.action-dropdown').classList.toggle('is-open');
        }
        if (target.matches('#exportCsvOnlyBtn')) {
            e.preventDefault();
            if (state.history.length > 0) showExportHistoryModal();
        }
        if (target.matches('#backupToDriveBtn')) {
            e.preventDefault();
            if (state.history.length > 0) showBackupModal();
        }
        if (target.matches('#flushHistoryBtn:not(:disabled)')) {
            showFlushHistoryModal();
        }
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
    
    modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });

    stockGrid?.addEventListener('click', (e) => {
        if (e.target.closest('.card__action-btn, .card__borrow-action-container, .card__image-overlay-actions')) {
            return;
        }

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

            if (index > -1) {
                state.selectedItems.splice(index, 1);
            } else {
                state.selectedItems.push(itemId);
            }
            updateStockPageFabs();
        }
    });


    stockSearchInput?.addEventListener('input', applyStockFilterAndRender);
    returnSearchInput?.addEventListener('input', renderReturns);

    let historySearchTimeout;
    historySearchInput?.addEventListener('input', () => {
        clearTimeout(historySearchTimeout);
        historySearchTimeout = setTimeout(() => {
            fetchAndRenderHistory();
        }, 300);
    });

    borrowForm?.addEventListener('submit', handleBorrowFormSubmit);
};

const showDesktopButtonIfNeeded = () => {
    // Deteksi sederhana untuk perangkat non-mobile
    const isDesktop = !/Mobi|Android/i.test(navigator.userAgent);
    if (isDesktop && desktopAppBtn) {
        desktopAppBtn.style.display = 'flex';
    }
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

    // Ambil token keamanan dan pengaturan peminjaman secara bersamaan
    await Promise.all([getCsrfToken(), fetchBorrowSettings()]);

    // Periksa status backup yang sedang berjalan saat aplikasi dimuat
    if (state.session.role === 'admin') {
        const initialBackupStatus = await getBackupStatus();
        if (initialBackupStatus.status !== 'idle') {
            showBackupModal(initialBackupStatus);
        }
    }

    let lastPage = localStorage.getItem('lastActivePage') || '#stock';
    // Jika user non-admin mencoba mengakses halaman statistik, redirect ke stok
    if (state.session.role !== 'admin' && lastPage === '#statistics') {
        lastPage = '#stock';
    }

    filterBtn.className = 'btn filter-all';
    filterBtn.innerHTML = `<i class='bx bx-filter-alt'></i> Semua`;
    
    setupTheme();
    setupEventListeners();
    setupUIForRole();
    setActivePage(lastPage);
    startLiveClock();
    showDesktopButtonIfNeeded();
    
    // Lakukan pengecekan kunci pertama kali saat aplikasi dimuat
    manageBorrowLockOverlay();
    
    hideLoading();
    
    setInterval(pollSettingsAndManageLock, 2000); // Cek setiap 2 detik
};

init();