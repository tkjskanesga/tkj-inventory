import { state } from './state.js';
import { loadPageData } from './app.js';
import { toLocalDateString } from './utils.js';

// Kelola UI elements seperti tema, sidebar, and navigasi.
const fabAddItemBtn = document.getElementById('fabAddItemBtn');
const fabImportCsvBtn = document.getElementById('fabImportCsvBtn');
const fabFilterDateBtn = document.getElementById('fabFilterDateBtn');
const fabBorrowSelectedBtn = document.getElementById('fabBorrowSelectedBtn');
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
            <button class="profile-dropdown__toggle ${!isAdmin ? 'no-arrow' : ''}" id="mobileUserProfileToggle" aria-haspopup="true" aria-expanded="false">
                <i class='bx bxs-user-circle'></i>
                <span id="mobileUsernameDisplay" class="profile-dropdown__username">${state.session.username}</span>
                ${isAdmin ? "<i class='bx bx-chevron-down profile-dropdown__arrow'></i>" : ""}
            </button>
            <div class="profile-dropdown__menu" id="mobileUserProfileMenu" role="menu">
                ${isAdmin ? `<button class="profile-dropdown__item" id="mobileAccountBtn" role="menuitem">
                                <i class='bx bx-user'></i>
                                <span>Akun</span>
                             </button>` : ''}
            </div>
        </div>`;
        
    const desktopNavList = document.querySelector('#desktopNav .nav__list');
    const clonedNavList = desktopNavList.cloneNode(true);
    clonedNavList.querySelectorAll('.nav__link').forEach(link => {
        link.innerHTML = `<span>${link.textContent}</span>`;
    });
    
    // Cari link terakhir untuk menyisipkan toggle tema
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

export const updateStockPageFabs = () => {
    const hasSelection = state.selectedItems.length > 0;
    const isStockPage = document.getElementById('stock').classList.contains('active');
    const isAdmin = state.session.role === 'admin';

    // Sembunyikan semua FAB jika bukan di halaman stok
    if (!isStockPage) {
        if (fabBorrowSelectedBtn) fabBorrowSelectedBtn.classList.remove('is-visible');
        if (fabAddItemBtn) fabAddItemBtn.classList.remove('is-visible');
        if (fabImportCsvBtn) fabImportCsvBtn.classList.remove('is-visible');
        return;
    }

    // Tampilkan FAB pinjam jika ada item dipilih
    if (fabBorrowSelectedBtn) {
        fabBorrowSelectedBtn.classList.toggle('is-visible', hasSelection);
    }
    
    // Logika untuk admin
    if (isAdmin) {
        // Tampilkan tombol tambah & impor jika tidak ada item yang dipilih
        const showAdminButtons = isStockPage && !hasSelection;
        if (fabAddItemBtn) fabAddItemBtn.classList.toggle('is-visible', showAdminButtons);
        if (fabImportCsvBtn) fabImportCsvBtn.classList.toggle('is-visible', showAdminButtons);
    } else {
        // Sembunyikan tombol admin jika bukan admin
        if (fabAddItemBtn) fabAddItemBtn.classList.remove('is-visible');
        if (fabImportCsvBtn) fabImportCsvBtn.classList.remove('is-visible');
    }
};


export const setActivePage = (hash) => {
    hash = hash || '#stock';

    if (hash === '#statistics' && state.session.role !== 'admin') {
        hash = '#stock';
    }

    pages.forEach(p => p.classList.toggle('active', p.id === hash.substring(1)));
    document.querySelectorAll('.nav__link').forEach(l => {
         if (l.classList.contains('theme-toggle')) return;
         l.classList.toggle('active', l.getAttribute('href') === hash)
    });

    const isStockPage = hash === '#stock';
    const isFilterablePage = hash === '#return' || hash === '#history';
    
    // Kosongkan seleksi jika meninggalkan halaman stok
    if (!isStockPage && state.selectedItems.length > 0) {
        state.selectedItems = [];
    }

    // Perbarui visibilitas semua FAB berdasarkan halaman dan status seleksi
    updateStockPageFabs();

    if (fabFilterDateBtn) {
        fabFilterDateBtn.classList.toggle('is-visible', isFilterablePage);
    }

    if (!isFilterablePage && state.selectedDate) {
        state.selectedDate = null;
    }

    updateFabFilterState();
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
    const borrowFormElements = borrowForm ? borrowForm.querySelectorAll('input, button, .custom-dropdown__selected') : [];
    const returnButtons = document.querySelectorAll('.return-btn');
    const countdownContainer = document.getElementById('countdown');

    const toggleInteractiveElements = (disabled) => {
        borrowFormElements.forEach(el => {
            el.disabled = disabled;
            if (el.classList.contains('custom-dropdown__selected')) {
                el.closest('.custom-dropdown')?.classList.toggle('is-disabled', disabled);
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