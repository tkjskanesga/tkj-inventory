import { openModal, closeModal } from '../utils.js';
import { API_URL } from '../state.js';

/**
 * Menampilkan modal konfirmasi untuk mengekspor riwayat sebagai CSV.
 */
export const showExportHistoryModal = () => {
    openModal('Konfirmasi Ekspor', `
        <p class="modal-details">Anda yakin ingin mengekspor seluruh riwayat peminjaman ke dalam file CSV?</p>
        <div class="modal-footer">
            <button type="button" class="btn btn-secondary close-modal-btn">Batal</button>
            <button type="button" id="confirmExportBtn" class="btn btn-success">Ya, Ekspor</button>
        </div>
    `);
    document.getElementById('confirmExportBtn').onclick = () => {
        window.location.href = `${API_URL}?action=export_history`;
        closeModal();
    };
};