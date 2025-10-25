// Sumber kebenaran tunggal untuk status dan konfigurasi aplikasi.
export let state = {
    items: [],
    classifiers: [],
    classes: [],
    borrowals: [],
    history: [],
    accounts: [],
    itemToBorrow: null,
    itemsToBorrow: [],
    selectedItems: [],
    selectedAccounts: [],
    currentStockFilter: 'all',
    currentClassifierFilter: null,
    selectedDate: null,
    historyPage: 1,
    isLoadingMoreHistory: false,
    hasMoreHistory: true,
    accountPage: 1,
    isLoadingMoreAccounts: false,
    hasMoreAccounts: true,
    session: {
        isLoggedIn: false,
        username: null,
        role: null,
        login_username: null,
        kelas: null
    },
    borrowSettings: {
        startTime: '06:30',
        endTime: '17:00',
        isManuallyLocked: false,
        isAppLocked: false,
        lockReason: 'open',
        isLoaded: false
    }
};

export let csrfToken = null;

export const API_URL = 'api.php';
export const AUTH_URL = 'auth.php';

// Fungsi untuk update CSRF token, dibutuhkan oleh api.js
export const setCsrfToken = (token) => {
    csrfToken = token;
};