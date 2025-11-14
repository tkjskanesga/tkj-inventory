import { state } from '../state.js';
import { openModal, escapeHTML } from '../utils.js';
import { handleDeleteItem } from '../api.js';

/**
 * Menampilkan modal konfirmasi untuk menghapus satu barang.
 * @param {string|number} id - ID barang yang akan dihapus.
 */
export const showDeleteItemModal = (id) => {
    const item = state.items.find(i => i.id == id);
    if (!item) return;
    openModal('Konfirmasi Hapus', `
        <p class="modal-details">Anda yakin ingin menghapus <strong>${escapeHTML(item.name)}</strong>?</p>
        <div class="modal-footer"><button type="button" class="btn btn-secondary close-modal-btn">Batal</button><button type="button" id="confirmDeleteBtn" class="btn btn-danger">Ya, Hapus</button></div>`);
    document.getElementById('confirmDeleteBtn').onclick = () => handleDeleteItem(id);
};