import { state } from './state.js';
import { closeModal, showLoading, hideLoading } from './utils.js';
import { checkSession, handleLogout } from './auth.js';
import { setupTheme, setupUIForRole, setActivePage, toggleSidebar, handleThemeToggle, updateFabFilterState } from './ui.js';
import { applyStockFilterAndRender, renderReturns, populateBorrowForm } from './render.js';
import { fetchData, getCsrfToken, fetchAndRenderHistory, handleBorrowFormSubmit } from './api.js';
import { showItemModal, showDeleteItemModal, showReturnModal, showExportHistoryModal, showFlushHistoryModal, showAccountModal, showDateFilterModal } from './modals.js';

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
const fabFilterDateBtn = document.getElementById('fabFilterDateBtn');
const modal = document.getElementById('modal');
const borrowForm = document.getElementById('borrowForm');

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
            await fetchData('borrowals');
            renderReturns();
            break;
        case 'history':
            fetchAndRenderHistory();
            break;
    }
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
        if (!e.target.closest('.profile-dropdown')) {
            document.querySelectorAll('.profile-dropdown__menu').forEach(menu => menu.classList.remove('is-open'));
            document.querySelectorAll('.profile-dropdown__toggle').forEach(toggle => toggle.setAttribute('aria-expanded', 'false'));
        }
        if (!e.target.closest('.filter-dropdown')) filterOptions?.classList.remove('show');
        if (!e.target.closest('.custom-dropdown')) document.querySelectorAll('.custom-dropdown.is-open').forEach(d => d.classList.remove('is-open'));

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
    
    document.addEventListener('click', (e) => {
        const target = e.target.closest('.card__action-btn, .return-btn, .close-modal-btn, #fabAddItemBtn, #exportHistoryBtn, #flushHistoryBtn, .custom-dropdown__selected');
        if (target) {
            if (target.matches('.edit:not(:disabled)')) showItemModal(target.dataset.id);
            if (target.matches('.delete:not(:disabled)')) showDeleteItemModal(target.dataset.id);
            if (target.matches('.return-btn')) showReturnModal(target.dataset.id);
            if (target.matches('#fabAddItemBtn')) showItemModal();
            if (target.matches('#exportHistoryBtn:not(:disabled)')) showExportHistoryModal();
            if (target.matches('#flushHistoryBtn:not(:disabled)')) showFlushHistoryModal();
            if (target.matches('.close-modal-btn')) closeModal();
            if (target.matches('.custom-dropdown__selected')) {
                target.closest('.custom-dropdown').classList.toggle('is-open');
            }
        }
    });

    userProfileToggle?.addEventListener('click', () => {
        const isOpen = userProfileMenu.classList.toggle('is-open');
        userProfileToggle.setAttribute('aria-expanded', isOpen);
    });

    dropdownLogoutBtn?.addEventListener('click', handleLogout);
    accountBtn?.addEventListener('click', showAccountModal);
    
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
    
    modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });

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
    await getCsrfToken();

    const lastPage = localStorage.getItem('lastActivePage') || '#stock';
    filterBtn.className = 'btn filter-all';
    filterBtn.innerHTML = `<i class='bx bx-filter-alt'></i> Semua`;
    
    setupTheme();
    setupEventListeners();
    setupUIForRole();
    setActivePage(lastPage);
    hideLoading();
};

init();