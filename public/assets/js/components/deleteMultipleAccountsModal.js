import { state } from '../state.js';
import { openModal } from '../utils.js';
import { handleDeleteMultipleAccounts } from '../account.js';

/**
 * Menampilkan modal konfirmasi untuk menghapus beberapa akun sekaligus.
 */
export const showDeleteMultipleAccountsModal = () => {
    const selectedIds = state.selectedAccounts;
    if (selectedIds.length === 0) return;

    openModal('Konfirmasi Hapus Akun', `
        <p class="modal-details">Anda yakin ingin menghapus <strong>${selectedIds.length} akun</strong> yang dipilih secara permanen?</p>
        <p class="modal-warning-text" style="text-align: left; margin-top: 1rem;">Tindakan ini tidak dapat diurungkan.</p>
        <div class="modal-footer">
            <button type="button" class="btn btn-secondary close-modal-btn">Batal</button>
            <button type="button" id="confirmDeleteMultipleAccountsBtn" class="btn btn-danger">Ya, Hapus</button>
        </div>
    `);

    document.getElementById('confirmDeleteMultipleAccountsBtn').onclick = () => handleDeleteMultipleAccounts(selectedIds);
};