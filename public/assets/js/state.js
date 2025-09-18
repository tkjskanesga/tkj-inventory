// Sumber kebenaran tunggal untuk status dan konfigurasi aplikasi.
export let state = {
    items: [],
    classifiers: [],
    borrowals: [],
    history: [],
    itemToBorrow: null,
    itemsToBorrow: [],
    selectedItems: [],
    currentStockFilter: 'all',
    selectedDate: null,
    historyPage: 1,
    isLoadingMoreHistory: false,
    hasMoreHistory: true,
    session: {
        isLoggedIn: false,
        username: null,
        role: null
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
export const classList = [ "X-TKJ 1", "X-TKJ 2", "XI-TKJ 1", "XI-TKJ 2", "XII-TKJ 1", "XII-TKJ 2", "Guru / Pegawai" ];

// Fungsi untuk update CSRF token, dibutuhkan oleh api.js
export const setCsrfToken = (token) => {
    csrfToken = token;
};