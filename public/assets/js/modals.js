/* Modal Components */

import { showImportCsvModal } from './components/importCsvModal.js';

// --- Modals Utama & Utilitas ---
export { showConfirmModal } from './components/confirmModal.js';
export { showAccountModal } from './components/accountProfileModal.js';
export { showBorrowSettingsModal } from './components/borrowSettingsModal.js';
export { showDesktopAppModal, showDesktopInstructionsModal } from './components/desktopAppModal.js';

// --- Modals Item (Stok) ---
export { showItemModal } from './components/itemModal.js';
export { showDeleteItemModal } from './components/deleteItemModal.js';
export { showDeleteMultipleItemsModal } from './components/deleteMultipleItemsModal.js';

// --- Modals Akun ---
export { showAddAccountModal } from './components/addAccountModal.js';
export { showEditAccountModal } from './components/editAccountModal.js';
export { showDeleteAccountModal } from './components/deleteAccountModal.js';
export { showDeleteMultipleAccountsModal } from './components/deleteMultipleAccountsModal.js';

// --- Modals Transaksi (Pinjam/Kembali) ---
export { showReturnModal } from './components/returnModal.js';
export { showAddItemModal } from './components/addBorrowalItemModal.js';
export { showEditBorrowalModal } from './components/editBorrowalModal.js';
export { showDeleteBorrowalModal } from './components/deleteBorrowalModal.js';

// --- Modals Riwayat ---
export { showDeleteHistoryModal } from './components/deleteHistoryModal.js';
export { showFlushHistoryModal } from './components/flushHistoryModal.js';

// --- Modals Filter ---
export { showClassifierFilterModal } from './components/classifierFilterModal.js';
export { showDateFilterModal } from './components/dateFilterModal.js';

// --- Modals Impor / Ekspor / Backup ---
export { showImportCsvModal, updateImportModalUI } from './components/importCsvModal.js';
export { showExportHistoryModal } from './components/exportHistoryModal.js';
export { showExportStockModal } from './components/exportStockModal.js';
export { showExportAccountsModal } from './components/exportAccountsModal.js';
export { showBackupModal, updateBackupModalUI } from './components/backupModal.js';
export { showAutoBackupModal, updateAutoBackupModalUI } from './components/autoBackupModal.js';

// --- Helpers ---
export { setupModalDropdowns, initializeHybridDropdown } from './helpers/dropdownHelpers.js';


// --- Fungsi Alias ---
// Panggilan ke modal impor CSV
export const showImportHistoryModal = () => {showImportCsvModal('history')};