import { openModal, closeModal } from '../utils.js';
import { startExportAccountsToDrive, processExportQueue } from '../api.js';
import { updateExportModalUI } from '../helpers/exportModalHelper.js';

/**
 * Menampilkan modal untuk ekspor akun siswa.
 * @param {object|null} initialData - Data status awal jika ada proses yang sedang berjalan.
 */
export const showExportAccountsModal = (initialData = null) => {
    openModal(`Ekspor Akun ke Google Drive`, `
        <div id="exportModalContainer">
            <div id="export-confirmation-view">
                <p class="modal-details">Ini akan membuat file CSV yang berisi data kredensial dari semua akun siswa.</p>
                <p>File CSV akan diunggah ke folder khusus di Google Drive.</p>
                <p class="modal-warning-text" style="text-align: left; margin-top: 1rem;">Password akan di-hash untuk alasan keamanan.</p>
            </div>
            <div id="export-progress-view" style="display: none;">
                <div class="progress-bar-container" style="margin: 1.5rem 0;">
                    <div class="progress-bar-text" id="exportProgressText" style="margin-bottom: 0.5rem; color: var(--text-color-light); font-size: 0.9rem;">Memulai...</div>
                    <div class="progress-bar" style="background-color: var(--border-color); border-radius: 20px; overflow: hidden;">
                        <div id="exportProgressBar" class="progress-bar__fill" style="width: 0%; height: 15px; background-color: var(--success-color); border-radius: 20px; transition: width 0.3s ease;"></div>
                    </div>
                </div>
                <div class="progress-log" id="exportProgressLog" style="background-color: var(--secondary-color); border-radius: var(--border-radius); padding: 1rem; height: 150px; overflow-y: auto; font-size: 0.8rem; line-height: 1.5;"></div>
            </div>
            <div class="modal-footer">
                <button type="button" class="btn btn-secondary close-modal-btn">Batal</button>
                <button type="button" id="startExportBtn" class="btn btn-primary">Mulai Ekspor</button>
                <button type="button" id="primaryCloseExportBtn" class="btn btn-primary" style="display: none;">Selesai</button>
            </div>
        </div>
    `);
    
    document.querySelector('#exportModalContainer .close-modal-btn').onclick = closeModal;
    
    document.getElementById('startExportBtn').onclick = (e) => {
        e.target.disabled = true;
        startExportAccountsToDrive();
    };
    
    if (initialData && initialData.status !== 'idle') {
        updateExportModalUI(initialData);
        if (initialData.status === 'running' || initialData.status === 'finalizing') {
            processExportQueue();
        }
    }
};