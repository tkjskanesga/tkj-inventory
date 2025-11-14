import { openModal, closeModal } from '../utils.js';

/**
 * @param {string} title - Judul modal.
 * @param {string} message - Pesan konfirmasi (HTML diizinkan).
 * @param {function} onConfirm - Callback yang dijalankan jika user menekan "Ya".
 */
export const showConfirmModal = (title, message, onConfirm) => {
    openModal(title, `
        <p class="modal-details">${message}</p> <!-- Pesan bisa berisi HTML -->
        <div class="modal-footer">
            <button type="button" class="btn btn-secondary close-modal-btn">Batal</button>
            <button type="button" id="modalConfirmBtn" class="btn btn-danger">Ya</button>
        </div>
    `);
    const confirmBtn = document.getElementById('modalConfirmBtn');
    if (confirmBtn) {
        confirmBtn.onclick = () => {
            closeModal();
            setTimeout(onConfirm, 50);
        };
    }
};