import { createEmptyState, showNotification } from './utils.js';

// Data dummy untuk akun siswa
const dummyAccounts = [
    { nis: '12345678', name: 'Alea Farrel', class: 'XII-TKJ 1' },
    { nis: '87654321', name: 'Budi Santoso', class: 'XII-TKJ 2' },
    { nis: '11223344', name: 'Citra Lestari', class: 'XI-TKJ 1' },
    { nis: '44332211', name: 'Dewi Anggraini', class: 'XI-TKJ 2' },
    { nis: '98765432', name: 'Eko Prasetyo', class: 'X-TKJ 1' },
    { nis: '55667788', name: 'Fitria Hasanah', class: 'X-TKJ 2' },
];

/**
 * Merender daftar akun ke dalam container.
 * @param {Array} accountsToRender - Array objek akun yang akan ditampilkan.
 */
const renderAccounts = (accountsToRender) => {
    const accountListContainer = document.getElementById('accountList');
    if (!accountListContainer) return;

    if (accountsToRender.length === 0) {
        accountListContainer.innerHTML = createEmptyState('Akun Tidak Ditemukan', 'Tidak ada akun siswa yang cocok dengan pencarian Anda.');
        return;
    }

    const headerHTML = `
        <div class="account-list-header">
            <div>NIS</div>
            <div>Nama Siswa</div>
            <div>Kelas</div>
            <div>Aksi</div>
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

/**
 * Fungsi utama untuk menginisialisasi halaman manajemen akun.
 */
export const renderAccountsPage = () => {
    // Render data dummy saat halaman pertama kali dimuat
    renderAccounts(dummyAccounts);

    // Siapkan event listener untuk fungsionalitas halaman
    const searchInput = document.getElementById('accountSearch');
    if (searchInput) {
        searchInput.addEventListener('input', () => {
            const searchTerm = searchInput.value.toLowerCase();
            const filteredAccounts = dummyAccounts.filter(account => 
                account.name.toLowerCase().includes(searchTerm) || 
                account.nis.toLowerCase().includes(searchTerm)
            );
            renderAccounts(filteredAccounts);
        });
    }
};