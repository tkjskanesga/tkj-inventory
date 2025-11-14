import { state } from '../state.js';
import { openModal, escapeHTML } from '../utils.js';
import { handleDeleteHistoryItem } from '../api.js';

/**
 * Menampilkan modal konfirmasi untuk menghapus satu entri riwayat.
 * @param {string|number} id - ID riwayat yang akan dihapus.
 */
export const showDeleteHistoryModal = (id) => {
    const historyItem = state.history.find(h => h.id == id);
    if (!historyItem) return;

    openModal('Konfirmasi Hapus', `
        <p class="modal-details">Anda yakin ingin menghapus riwayat peminjaman:</p>
        <p class="modal-details"><strong>${escapeHTML(historyItem.item_name)}</strong> oleh <strong>${escapeHTML(historyItem.borrower_name)}</strong> <span style="font-weight: bold; color: var(--danger-color);">secara permanen?</span></p>
        <div class="modal-footer">
            <button type="button" class="btn btn-secondary close-modal-btn">Batal</button>
            <button type="button" id="confirmDeleteHistoryBtn" class="btn btn-danger">Ya, Hapus</button>
        </div>`);
    document.getElementById('confirmDeleteHistoryBtn').onclick = () => handleDeleteHistoryItem(id);
};