import { state } from '../state.js';
import { openModal, escapeHTML } from '../utils.js';
import { handleDeleteMultipleItems } from '../api.js';

export const showDeleteMultipleItemsModal = () => {
    const selectedIds = state.selectedItems;
    if (selectedIds.length === 0) return;

    const selectedItemsDetails = selectedIds.map(id => state.items.find(item => item.id == id)).filter(Boolean);
    const itemsInUse = selectedItemsDetails.filter(item => item.current_quantity < item.total_quantity);

    const itemsListHTML = selectedItemsDetails.map(item => `<li>${escapeHTML(item.name)}</li>`).join('');

    let modalContent;
    let confirmButtonHTML;

    if (itemsInUse.length > 0) {
        const itemsInUseHTML = itemsInUse.map(item => `<li><strong>${escapeHTML(item.name)}</strong></li>`).join('');
        modalContent = `
            <p class="modal-warning-text" style="text-align: left;"><strong>Tidak dapat menghapus.</strong></p>
            <p>Barang berikut sedang dalam status dipinjam:</p>
            <ul style="list-style-position: inside; margin: 1rem 0; background-color: var(--danger-color-light-bg); padding: 1rem; border-radius: var(--border-radius);">${itemsInUseHTML}</ul>
            <p class="modal-details">Kembalikan barang dahulu sebelum menghapusnya.</p>
        `;
        confirmButtonHTML = `<button type="button" class="btn btn-secondary close-modal-btn">Tutup</button>`;
    } else {
        modalContent = `
            <p class="modal-details">Anda akan menghapus <strong>${selectedIds.length} barang</strong> berikut secara permanen?</p>
            <ul style="list-style-position: inside; margin: 1rem 0;">${itemsListHTML}</ul>
            <p class="modal-warning-text" style="text-align: left;">Tindakan ini tidak dapat diurungkan.</p>
        `;
        confirmButtonHTML = `
            <button type="button" class="btn btn-secondary close-modal-btn">Batal</button>
            <button type="button" id="confirmDeleteMultipleBtn" class="btn btn-danger">Ya, Hapus</button>
        `;
    }

    openModal('Konfirmasi Hapus', `
        ${modalContent}
        <div class="modal-footer">${confirmButtonHTML}</div>
    `);

    if (itemsInUse.length === 0) {
        document.getElementById('confirmDeleteMultipleBtn').onclick = () => handleDeleteMultipleItems(selectedIds);
    }
};