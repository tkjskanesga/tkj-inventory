import { openModal, escapeHTML } from '../utils.js';
import { handleDeleteAccount } from '../account.js';

/**
 * Menampilkan modal konfirmasi untuk menghapus satu akun.
 * @param {object} account - Objek akun yang akan dihapus.
 */
export const showDeleteAccountModal = (account) => {
    openModal('Konfirmasi Hapus Akun', `
        <p class="modal-details">Anda yakin ingin menghapus akun:</p>
        <p><strong>${escapeHTML(account.nama)} (${escapeHTML(account.role === 'admin' ? account.username : account.nis)})</strong></p>
        <p class="modal-warning-text" style="text-align: left; margin-top: 1rem;">Tindakan ini tidak dapat diurungkan.</p>
        <div class="modal-footer">
            <button type="button" class="btn btn-secondary close-modal-btn">Batal</button>
            <button type="button" id="confirmDeleteAccountBtn" class="btn btn-danger">Ya, Hapus</button>
        </div>
    `);
    document.getElementById('confirmDeleteAccountBtn').onclick = () => handleDeleteAccount(account.id);
};