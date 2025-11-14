import { openModal, closeModal, escapeHTML } from '../utils.js';
import { startBackupToDrive, clearBackupStatus, processBackupQueue } from '../api.js';

/**
 * Memperbarui UI modal backup berdasarkan data status dari server.
 * @param {object} data - Objek status backup dari file status.
 */
export const updateBackupModalUI = (data) => {
    const progressBar = document.getElementById('backupProgressBar');
    const progressText = document.getElementById('backupProgressText');
    const progressLog = document.getElementById('backupProgressLog');
    const startBtn = document.getElementById('startBackupBtn');
    const primaryCloseBtn = document.getElementById('primaryCloseBackupBtn');
    const cancelBtn = document.querySelector('#backupModalContainer .close-modal-btn');
    const confirmationView = document.getElementById('backup-confirmation-view');
    const progressView = document.getElementById('backup-progress-view');

    if (!progressView || !data) return;

    if (data.status === 'running' || data.status === 'finalizing' || data.status === 'complete' || data.status === 'error') {
        if (confirmationView) confirmationView.style.display = 'none';
        if (progressView) progressView.style.display = 'block';
        if (startBtn) startBtn.style.display = 'none';
        if (cancelBtn) cancelBtn.style.display = 'none';
    }

    const { processed = 0, total = 0 } = data;
    if (total > 0) {
        const percent = (processed / total) * 100;
        progressBar.style.width = `${percent}%`;
        progressText.textContent = `Memproses ${processed} dari ${total} file...`;
    } else {
        progressText.textContent = "Mempersiapkan...";
    }

    if (data.log && Array.isArray(data.log)) {
        progressLog.innerHTML = data.log.map(entry => {
            const statusClass = entry.status === 'success' ? 'text-success' : (entry.status === 'error' ? 'text-danger' : '');
            const statusIcon = entry.status === 'success' ? '✓' : (entry.status === 'error' ? '✗' : '•');
            const iconHTML = entry.status === 'info' ? '' : `${statusIcon} `;
            return `<div class="${statusClass}">[${entry.time}] ${iconHTML}${escapeHTML(entry.message)}</div>`;
        }).join('');
        progressLog.scrollTop = progressLog.scrollHeight;
    }
    
    if (data.status === 'complete' || data.status === 'error') {
        if (data.status === 'complete') {
            progressText.textContent = 'Proses backup selesai!';
            progressBar.style.width = '100%';
            if (data.csv_url && !progressLog.querySelector('a[href="' + data.csv_url + '"]')) {
                progressLog.innerHTML += `<div><a href="${escapeHTML(data.csv_url)}" target="_blank" rel="noopener noreferrer" style="text-decoration: underline;">Lihat File CSV di Google Drive</a></div>`;
            }
            primaryCloseBtn.textContent = 'Selesai';
        } else {
            progressText.textContent = 'Backup Gagal!';
            const errorMessage = data.message || 'Terjadi kesalahan tidak diketahui.';
            const errorHTML = `<div class="text-danger" style="margin-top: 1rem; font-weight: bold;">[${new Date().toLocaleTimeString('id-ID')}] ✗ Error: ${escapeHTML(errorMessage)}</div>`;
            if (!progressLog.innerHTML.includes(errorMessage)) {
                 progressLog.innerHTML += errorHTML;
            }
            primaryCloseBtn.textContent = 'Tutup';
        }
        
        progressLog.scrollTop = progressLog.scrollHeight;
        primaryCloseBtn.style.display = 'inline-flex';
        primaryCloseBtn.onclick = async () => {
            await clearBackupStatus();
            closeModal();
        };
    }
};


/**
 * Menampilkan modal backup, baik untuk memulai backup baru atau melanjutkan tampilan proses yang sedang berjalan.
 * @param {object|null} initialData - Data status awal jika ada proses yang sedang berjalan.
 */
export const showBackupModal = (initialData = null) => {
    openModal(`Backup Riwayat ke Google Drive`, `
        <div id="backupModalContainer">
            <div id="backup-confirmation-view">
                <p class="modal-details">Ini akan mengunggah semua file bukti riwayat ke Google Drive dan membuat file CSV.</p>
                <p>Proses ini mungkin memakan waktu lama dan tidak dapat dibatalkan setelah dimulai.</p>
                <p class="modal-warning-text" style="text-align: left; margin-top: 1rem;">Pastikan koneksi internet Anda stabil.</p>
            </div>
            <div id="backup-progress-view" style="display: none;">
                <div class="progress-bar-container" style="margin: 1.5rem 0;">
                    <div class="progress-bar-text" id="backupProgressText" style="margin-bottom: 0.5rem; color: var(--text-color-light); font-size: 0.9rem;">Memulai...</div>
                    <div class="progress-bar" style="background-color: var(--border-color); border-radius: 20px; overflow: hidden;">
                        <div id="backupProgressBar" class="progress-bar__fill" style="width: 0%; height: 15px; background-color: var(--primary-color); border-radius: 20px; transition: width 0.3s ease;"></div>
                    </div>
                </div>
                <div class="progress-log" id="backupProgressLog" style="background-color: var(--secondary-color); border-radius: var(--border-radius); padding: 1rem; height: 150px; overflow-y: auto; font-size: 0.8rem; line-height: 1.5;"></div>
            </div>
            <div class="modal-footer">
                <button type="button" class="btn btn-secondary close-modal-btn">Batal</button>
                <button type="button" id="startBackupBtn" class="btn btn-primary">Mulai Backup</button>
                <button type="button" id="primaryCloseBackupBtn" class="btn btn-primary" style="display: none;">Selesai</button>
            </div>
        </div>
    `);
    
    document.querySelector('#backupModalContainer .close-modal-btn').onclick = closeModal;
    
    const startBtn = document.getElementById('startBackupBtn');
    startBtn.onclick = (e) => {
        e.target.disabled = true;
        startBackupToDrive();
    };
    
    if (initialData && initialData.status !== 'idle') {
        updateBackupModalUI(initialData);
        if (initialData.status === 'running') {
            processBackupQueue();
        }
    }
};