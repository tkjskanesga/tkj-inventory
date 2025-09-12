import { state } from './state.js';
import { loadPageData } from './app.js';
import { toLocalDateString } from './utils.js';

// Kelola UI elements seperti tema, sidebar, and navigasi.
const fabAddItemBtn = document.getElementById('fabAddItemBtn');
const fabFilterDateBtn = document.getElementById('fabFilterDateBtn');
const flushHistoryBtn = document.getElementById('flushHistoryBtn');
const exportHistoryBtn = document.getElementById('exportHistoryBtn');
const accountBtn = document.getElementById('accountBtn');
const usernameDisplay = document.getElementById('usernameDisplay');
const userProfileDropdown = document.getElementById('userProfileDropdown');
const mobileUserProfileContainer = document.getElementById('mobileUserProfileContainer');
const sidebarNavContainer = document.getElementById('sidebarNavContainer');
const sidebarFooterContainer = document.getElementById('sidebarFooterContainer');
const sidebar = document.getElementById('sidebar');
const overlay = document.getElementById('overlay');
const pages = document.querySelectorAll('.page');

export const setupUIForRole = () => {
    const isAdmin = state.session.role === 'admin';

    fabAddItemBtn.style.display = isAdmin ? 'flex' : 'none';
    flushHistoryBtn.style.display = isAdmin ? 'flex' : 'none';
    exportHistoryBtn.style.display = isAdmin ? 'flex' : 'none';
    accountBtn.style.display = isAdmin ? 'flex' : 'none';

    if (state.session.isLoggedIn) {
        usernameDisplay.textContent = state.session.username;
        userProfileDropdown.style.display = 'block';
    }
    
    setupMobileNav();
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

export const setupMobileNav = () => {
    const isAdmin = state.session.role === 'admin';
    
    mobileUserProfileContainer.innerHTML = `
        <div class="profile-dropdown" id="mobileProfileDropdown">
            <button class="profile-dropdown__toggle ${!isAdmin ? 'no-arrow' : ''}" id="mobileUserProfileToggle" aria-haspopup="true" aria-expanded="false">
                <i class='bx bxs-user-circle'></i>
                <span id="mobileUsernameDisplay" class="profile-dropdown__username">${state.session.username}</span>
                <i class='bx bx-chevron-down profile-dropdown__arrow'></i>
            </button>
            <div class="profile-dropdown__menu" id="mobileUserProfileMenu" role="menu">
                ${isAdmin ? `<button class="profile-dropdown__item" id="mobileAccountBtn" role="menuitem">
                                <i class='bx bxs-user-cog'></i>
                                <span>Account</span>
                             </button>` : ''}
            </div>
        </div>`;
        
    const desktopNavList = document.querySelector('#desktopNav .nav__list');
    const clonedNavList = desktopNavList.cloneNode(true);
    clonedNavList.querySelectorAll('.nav__link').forEach(link => {
        link.innerHTML = `<span>${link.textContent}</span>`;
    });
    
    const historyLink = clonedNavList.querySelector('a[href="#history"]');
    if (historyLink) {
        const themeToggleItem = document.createElement('li');
        themeToggleItem.className = 'nav__item';
        themeToggleItem.innerHTML = `
            <a href="#" class="nav__link theme-toggle" aria-label="Ganti Tema">
                <i class='bx bx-moon theme-toggle-icon'></i>
                <span class="theme-toggle-text">Mode Gelap</span>
            </a>`;
        historyLink.parentElement.insertAdjacentElement('afterend', themeToggleItem);
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

export const setActivePage = (hash) => {
    hash = hash || '#stock';
    pages.forEach(p => p.classList.toggle('active', p.id === hash.substring(1)));
    document.querySelectorAll('.nav__link').forEach(l => {
         if (l.classList.contains('theme-toggle')) return;
         l.classList.toggle('active', l.getAttribute('href') === hash)
    });
    
    const isStockPage = hash === '#stock';
    const isFilterablePage = hash === '#return' || hash === '#history';
    
    fabAddItemBtn.classList.toggle('is-visible', isStockPage && state.session.role === 'admin');
    fabFilterDateBtn.classList.toggle('is-visible', isFilterablePage);

    if (!isFilterablePage && state.selectedDate) {
        state.selectedDate = null;
    }

    updateFabFilterState();
    localStorage.setItem('lastActivePage', hash);
    loadPageData(hash);
};

export const updateFabFilterState = () => {
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