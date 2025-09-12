// Sumber kebenaran tunggal untuk status dan konfigurasi aplikasi.
export let state = {
    items: [],
    borrowals: [],
    history: [],
    currentStockFilter: 'all',
    selectedDate: null,
    historyPage: 1,
    isLoadingMoreHistory: false,
    hasMoreHistory: true,
    session: {
        isLoggedIn: false,
        username: null,
        role: null
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