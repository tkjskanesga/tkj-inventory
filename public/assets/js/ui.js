import { state } from './state.js';
import { loadPageData } from './app.js';
import { toLocalDateString } from './utils.js';

// Kelola UI elements seperti tema, sidebar, and navigasi.
const fabAddItemBtn = document.getElementById('fabAddItemBtn');
const fabStockActionsGroup = document.querySelector('.fab-multi-action-group[data-page="stock"]');
const fabStockActionsToggle = document.getElementById('fabStockActionsToggle');
const fabFilterDateBtn = document.getElementById('fabFilterDateBtn');
const fabBorrowSelectedBtn = document.getElementById('fabBorrowSelectedBtn');
const fabDeleteSelectedBtn = document.getElementById('fabDeleteSelectedBtn');
const fabSelectAllItemsBtn = document.getElementById('fabSelectAllItemsBtn');
const usernameDisplay = document.getElementById('usernameDisplay');
const userProfileDropdown = document.getElementById('userProfileDropdown');
const mobileUserProfileContainer = document.getElementById('mobileUserProfileContainer');
const sidebarNavContainer = document.getElementById('sidebarNavContainer');
const sidebarFooterContainer = document.getElementById('sidebarFooterContainer');
const sidebar = document.getElementById('sidebar');
const overlay = document.getElementById('overlay');
const pages = document.querySelectorAll('.page');
const lockOverlay = document.getElementById('lockOverlay');
let countdownInterval;

// FAB untuk halaman Akun
const fabAddAccountBtn = document.getElementById('fabAddAccountBtn');
const fabAccountActionsGroup = document.querySelector('.fab-multi-action-group[data-page="accounts"]');
const fabAccountActionsToggle = document.getElementById('fabAccountActionsToggle');
const fabDeleteSelectedAccountsBtn = document.getElementById('fabDeleteSelectedAccountsBtn');
const fabSelectAllAccountsBtn = document.getElementById('fabSelectAllAccountsBtn');


export const setupUIForRole = () => {
    // Fungsi ini fokus pada setup elemen dinamis.
    const isAdmin = state.session.role === 'admin';

    if (state.session.isLoggedIn) {
        usernameDisplay.textContent = state.session.username;
        userProfileDropdown.style.display = 'block';
    }

    setupMobileNav(isAdmin);
};

const updateThemeContent = (isDark) => {
    const iconClass = isDark ? 'bxs-sun' : 'bx-moon';
    const removeIconClass = isDark ? 'bx-moon' : 'bxs-sun';
    const text = isDark ? 'Mode Cerah' : 'Mode Gelap';

    document.querySelectorAll('.theme-toggle-icon').forEach(icon => {
        icon.classList.remove(removeIconClass);
        icon.classList.add(iconClass);
    });

    document.querySelectorAll('.theme-toggle-text').forEach(span => {
        span.textContent = text;
    });
};

export const handleThemeToggle = () => {
    const isDark = document.documentElement.classList.toggle('dark');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
    updateThemeContent(isDark);
};

export const setupTheme = () => {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const savedTheme = localStorage.getItem('theme');
    const isDark = savedTheme === 'dark' || (!savedTheme && prefersDark);
    document.documentElement.classList.toggle('dark', isDark);
    updateThemeContent(isDark);
};

export const toggleSidebar = () => {
    sidebar.classList.toggle('is-open');
    overlay.classList.toggle('is-visible');
};

export const setupMobileNav = (isAdmin) => {
    mobileUserProfileContainer.innerHTML = `
        <div class="profile-dropdown" id="mobileProfileDropdown">
            <button class="profile-dropdown__toggle" id="mobileUserProfileToggle" aria-haspopup="true" aria-expanded="false">
                <i class='bx bxs-user-circle'></i>
                <span id="mobileUsernameDisplay" class="profile-dropdown__username">${state.session.username}</span>
                <i class='bx bx-chevron-down profile-dropdown__arrow'></i>
            </button>
            <div class="profile-dropdown__menu" id="mobileUserProfileMenu" role="menu">
                <button class="profile-dropdown__item" id="mobileAccountBtn" role="menuitem">
                    <i class='bx bx-user'></i>
                    <span>Profil</span>
                </button>
            </div>
        </div>`;

    const desktopNavList = document.querySelector('#desktopNav .nav__list');
    const clonedNavList = desktopNavList.cloneNode(true);

    if (isAdmin) {
        const dropdownLi = clonedNavList.querySelector('.nav-dropdown');
        if (dropdownLi) {
            // Ubah dropdown menjadi item biasa di sidebar
            const links = Array.from(dropdownLi.querySelectorAll('.nav-dropdown__menu .nav__link'));
            const newItems = links.map(link => {
                const newItem = document.createElement('li');
                newItem.className = 'nav__item';
                // Pastikan link memiliki href yang benar untuk setActivePage
                const clonedLink = link.cloneNode(true);
                newItem.appendChild(clonedLink);
                return newItem;
            });
            dropdownLi.replaceWith(...newItems);
        }
    } else {
        // Hapus dropdown 'Lainnya' jika bukan admin
        const dropdownLi = clonedNavList.querySelector('.nav-dropdown');
        if (dropdownLi) dropdownLi.remove();
    }

    // Pastikan semua link memiliki struktur span di dalamnya
    clonedNavList.querySelectorAll('.nav__link:not(.theme-toggle)').forEach(link => {
        // Jika belum ada span, tambahkan
        if (!link.querySelector('span')) {
            link.innerHTML = `<span>${link.textContent.trim()}</span>`;
        }
    });

    const lastLink = clonedNavList.querySelector('li:last-child');
    if (lastLink) {
        const themeToggleItem = document.createElement('li');
        themeToggleItem.className = 'nav__item';
        themeToggleItem.innerHTML = `
            <a href="#" class="nav__link theme-toggle" aria-label="Ganti Tema">
                <i class='bx bx-moon theme-toggle-icon'></i>
                <span class="theme-toggle-text">Mode Gelap</span>
            </a>`;
        lastLink.insertAdjacentElement('afterend', themeToggleItem);
    }

    sidebarNavContainer.innerHTML = '';
    sidebarNavContainer.appendChild(clonedNavList);

    sidebarFooterContainer.innerHTML = `
         <button class="btn btn-danger btn-block" id="sidebarLogoutBtn">
            <i class='bx bx-log-out'></i>
            <span>Logout</span>
         </button>`;

    updateThemeContent(document.documentElement.classList.contains('dark'));
};

export const updateAccountPageFabs = () => {
    const isAdmin = state.session.role === 'admin';
    if (!isAdmin) {
        if (fabAddAccountBtn) fabAddAccountBtn.classList.remove('is-visible');
        if (fabAccountActionsGroup) fabAccountActionsGroup.classList.remove('is-visible');
        if (fabDeleteSelectedAccountsBtn) fabDeleteSelectedAccountsBtn.classList.remove('is-visible');
        if (fabSelectAllAccountsBtn) fabSelectAllAccountsBtn.classList.remove('is-visible');
        return;
    }

    const accountsPage = document.getElementById('accounts');
    const isAccountPage = accountsPage && accountsPage.classList.contains('active');
    const hasSelection = state.selectedAccounts.length > 0;

    if (fabAccountActionsGroup && fabAccountActionsGroup.classList.contains('is-open')) {
        fabAccountActionsGroup.classList.remove('is-open');
        if (fabAccountActionsToggle) fabAccountActionsToggle.classList.remove('is-open');
    }

    const showAdminButtons = isAccountPage && !hasSelection;
    if (fabAddAccountBtn) fabAddAccountBtn.classList.toggle('is-visible', showAdminButtons);
    if (fabAccountActionsGroup) fabAccountActionsGroup.classList.toggle('is-visible', showAdminButtons);

    if (fabDeleteSelectedAccountsBtn) fabDeleteSelectedAccountsBtn.classList.toggle('is-visible', isAccountPage && hasSelection);
    if (fabSelectAllAccountsBtn) fabSelectAllAccountsBtn.classList.toggle('is-visible', isAccountPage && hasSelection);
};

export const updateStockPageFabs = () => {
    const hasSelection = state.selectedItems.length > 0;
    const isStockPage = document.getElementById('stock').classList.contains('active');
    const isAdmin = state.session.role === 'admin';

    if (fabStockActionsGroup && fabStockActionsGroup.classList.contains('is-open')) {
        fabStockActionsGroup.classList.remove('is-open');
        if(fabStockActionsToggle) fabStockActionsToggle.classList.remove('is-open');
    }

    if (!isStockPage) {
        if (fabBorrowSelectedBtn) fabBorrowSelectedBtn.classList.remove('is-visible');
        if (fabDeleteSelectedBtn) fabDeleteSelectedBtn.classList.remove('is-visible');
        if (fabSelectAllItemsBtn) fabSelectAllItemsBtn.classList.remove('is-visible');
        if (fabAddItemBtn) fabAddItemBtn.classList.remove('is-visible');
        if (fabStockActionsGroup) fabStockActionsGroup.classList.remove('is-visible');
        return;
    }

    if (fabBorrowSelectedBtn) fabBorrowSelectedBtn.classList.toggle('is-visible', hasSelection);

    if (isAdmin) {
        if (fabDeleteSelectedBtn) fabDeleteSelectedBtn.classList.toggle('is-visible', hasSelection);
        if (fabSelectAllItemsBtn) fabSelectAllItemsBtn.classList.toggle('is-visible', hasSelection);
        const showAdminButtons = isStockPage && !hasSelection;
        if (fabAddItemBtn) fabAddItemBtn.classList.toggle('is-visible', showAdminButtons);
        if (fabStockActionsGroup) fabStockActionsGroup.classList.toggle('is-visible', showAdminButtons);
    } else {
        if (fabDeleteSelectedBtn) fabDeleteSelectedBtn.classList.remove('is-visible');
        if (fabSelectAllItemsBtn) fabSelectAllItemsBtn.classList.remove('is-visible');
        if (fabAddItemBtn) fabAddItemBtn.classList.remove('is-visible');
        if (fabStockActionsGroup) fabStockActionsGroup.classList.remove('is-visible');
    }
};


export const setActivePage = (hash) => {
    hash = hash || '#stock'; // Default ke #stock jika hash kosong

    // Redirect jika user biasa mencoba akses halaman admin
    if ((hash === '#statistics' || hash === '#accounts') && state.session.role !== 'admin') {
        hash = '#stock';
    }

    pages.forEach(p => p.classList.toggle('active', p.id === hash.substring(1)));

    document.querySelectorAll('#desktopNav .nav__link, #sidebarNavContainer .nav__link, .nav-dropdown__toggle').forEach(el => el.classList.remove('active'));

    // Temukan link yang cocok di navigasi desktop
    const activeDesktopLink = document.querySelector(`#desktopNav .nav__link[href="${hash}"]`);
    if (activeDesktopLink) {
        activeDesktopLink.classList.add('active');
        // Jika link ada di dalam dropdown, tandai juga toggle dropdown-nya sebagai aktif
        const parentDropdown = activeDesktopLink.closest('.nav-dropdown');
        if (parentDropdown) {
            parentDropdown.querySelector('.nav-dropdown__toggle').classList.add('active');
        }
    }

    // Temukan link yang cocok di navigasi sidebar mobile
    const activeSidebarLink = document.querySelector(`#sidebarNavContainer .nav__link[href="${hash}"]`);
    if (activeSidebarLink) {
        activeSidebarLink.classList.add('active');
    }

    // Kelola visibilitas FAB filter tanggal
    const isFilterablePage = hash === '#return' || hash === '#history';
    if (fabFilterDateBtn) fabFilterDateBtn.classList.toggle('is-visible', isFilterablePage);

    // Reset seleksi dan tanggal jika pindah halaman
    if (hash !== '#stock' && state.selectedItems.length > 0) state.selectedItems = [];
    if (hash !== '#accounts' && state.selectedAccounts.length > 0) state.selectedAccounts = [];
    if (!isFilterablePage && state.selectedDate) state.selectedDate = null;

    // Perbarui visibilitas FAB berdasarkan halaman dan state
    updateStockPageFabs();
    updateAccountPageFabs();
    updateFabFilterState();

    // Simpan halaman terakhir yang aktif dan muat datanya
    localStorage.setItem('lastActivePage', hash);
    loadPageData(hash);
};

export const updateFabFilterState = () => {
    if (!fabFilterDateBtn) return;
    const icon = fabFilterDateBtn.querySelector('i');
    if (state.selectedDate) {
        fabFilterDateBtn.style.backgroundColor = 'var(--danger-color)';
        fabFilterDateBtn.title = `Hapus Filter: ${toLocalDateString(state.selectedDate)}`;
        icon.classList.remove('bx-calendar');
        icon.classList.add('bx-x');
    } else {
        fabFilterDateBtn.style.backgroundColor = '';
        fabFilterDateBtn.title = 'Filter Berdasarkan Tanggal';
        icon.classList.remove('bx-x');
        icon.classList.add('bx-calendar');
    }
};

export const manageBorrowLockOverlay = () => {
    if (countdownInterval) clearInterval(countdownInterval);
    const { isLoaded, isAppLocked, lockReason, startTime, endTime } = state.borrowSettings;

    if (!lockOverlay || !isLoaded || state.session.role === 'admin') {
        if(lockOverlay) lockOverlay.classList.remove('is-visible');
        return;
    }

    const borrowForm = document.getElementById('borrowForm');
    const borrowFormElements = borrowForm ? borrowForm.querySelectorAll('input, button, .custom-dropdown__selected, .hybrid-dropdown__selected') : [];
    const returnButtons = document.querySelectorAll('.return-btn');
    const countdownContainer = document.getElementById('countdown');

    const toggleInteractiveElements = (disabled) => {
        borrowFormElements.forEach(el => {
            el.disabled = disabled;
            if (el.classList.contains('custom-dropdown__selected') || el.classList.contains('hybrid-dropdown__selected')) {
                el.closest('.custom-dropdown, .hybrid-dropdown')?.classList.toggle('is-disabled', disabled);
            }
        });
        returnButtons.forEach(el => { el.disabled = disabled; });
    };


    if (isAppLocked) {
        lockOverlay.classList.add('is-visible');
        toggleInteractiveElements(true);

        if (lockReason === 'manual') {
            document.getElementById('lockOverlayTitle').textContent = 'Sistem Dikunci';
            document.getElementById('lockOverlayMessage').textContent = 'Aplikasi dikunci oleh admin. Silakan coba lagi nanti.';
            countdownContainer.style.display = 'none';
        } else {
            document.getElementById('lockOverlayTitle').textContent = 'Aplikasi Ditutup';
            document.getElementById('lockOverlayMessage').textContent = 'Aplikasi dapat diakses kembali dalam:';
            countdownContainer.style.display = 'flex';

            const now = new Date();
            const [startHour, startMinute] = startTime.split(':').map(Number);
            const startTimeDate = new Date();
            startTimeDate.setHours(startHour, startMinute, 0, 0);

            let targetTime;
            if (now < startTimeDate) {
                targetTime = startTimeDate;
            } else {
                targetTime = new Date(startTimeDate.getTime() + 24 * 60 * 60 * 1000);
            }

            const updateCountdown = () => {
                const distance = targetTime.getTime() - new Date().getTime();
                if (distance < 0) {
                    clearInterval(countdownInterval);
                    window.location.reload();
                    return;
                }
                const days = Math.floor(distance / (1000 * 60 * 60 * 24));
                const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
                const seconds = Math.floor((distance % (1000 * 60)) / 1000);

                document.getElementById('countdown-days').textContent = String(days).padStart(2, '0');
                document.getElementById('countdown-hours').textContent = String(hours).padStart(2, '0');
                document.getElementById('countdown-minutes').textContent = String(minutes).padStart(2, '0');
                document.getElementById('countdown-seconds').textContent = String(seconds).padStart(2, '0');
            };
            updateCountdown();
            countdownInterval = setInterval(updateCountdown, 1000);
        }
    } else {
        lockOverlay.classList.remove('is-visible');
        toggleInteractiveElements(false);
    }
     document.getElementById('borrowingHours').textContent = `${startTime} - ${endTime}`;
};