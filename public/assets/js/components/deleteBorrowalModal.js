import { state } from '../state.js';
import { openModal, escapeHTML } from '../utils.js';
import { handleDeleteBorrowalItem } from '../api.js';

/**
 * Menampilkan modal konfirmasi untuk menghapus satu item dari peminjaman aktif.
 * @param {string|number} id - ID peminjaman (borrowal) yang akan dihapus.
 */
export const showDeleteBorrowalModal = (id) => {
    const borrowalItem = state.borrowals.find(b => b.id == id);
    if (!borrowalItem) return;

    openModal('Konfirmasi Hapus', `
        <p class="modal-warning-text" style="text-align: left; margin-top: 1rem;"><strong>PERINGATAN:</strong> Stok barang akan dikembalikan. Tindakan ini tidak dapat diurungkan.</p>
        <p class="modal-details">Anda yakin ingin menghapus item peminjaman:</p>
        <p class="modal-details"><strong>${escapeHTML(borrowalItem.item_name)} (${escapeHTML(borrowalItem.quantity)} pcs)</strong> oleh <strong>${escapeHTML(borrowalItem.borrower_name)}</strong>?</p>
        <div class="modal-footer">
            <button type="button" class="btn btn-secondary close-modal-btn">Batal</button>
            <button type="button" id="confirmDeleteBorrowalBtn" class="btn btn-danger">Ya, Hapus</button>
        </div>`);
    document.getElementById('confirmDeleteBorrowalBtn').onclick = () => handleDeleteBorrowalItem(id);
};