import { closeModal, escapeHTML } from '../utils.js';
import { clearExportStatus } from '../api.js';

/**
 * Memperbarui UI modal ekspor (bisa untuk stok atau akun).
 * @param {object} data - Objek status ekspor dari file status.
 */
export const updateExportModalUI = (data) => {
    const progressBar = document.getElementById('exportProgressBar');
    const progressText = document.getElementById('exportProgressText');
    const progressLog = document.getElementById('exportProgressLog');
    const startBtn = document.getElementById('startExportBtn');
    const primaryCloseBtn = document.getElementById('primaryCloseExportBtn');
    const cancelBtn = document.querySelector('#exportModalContainer .close-modal-btn');
    const confirmationView = document.getElementById('export-confirmation-view');
    const progressView = document.getElementById('export-progress-view');

    if (!progressView || !data) return;

    if (data.status === 'running' || data.status === 'finalizing' || data.status === 'complete' || data.status === 'error') {
        if (confirmationView) confirmationView.style.display = 'none';
        if (progressView) progressView.style.display = 'block';
        if (startBtn) startBtn.style.display = 'none';
        if (cancelBtn) cancelBtn.style.display = 'none';
    }

    const { processed = 0, total = 0 } = data;
    const isAccountExport = data.export_type === 'accounts';

    if (isAccountExport && ['running', 'finalizing'].includes(data.status)) {
        progressBar.style.width = '50%';
        progressText.textContent = 'Membuat file CSV...';
    } else if (total > 0) {
        const percent = (processed / total) * 100;
        progressBar.style.width = `${percent}%`;
        progressText.textContent = `Memproses ${processed} dari ${total} gambar...`;
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
            progressText.textContent = 'Proses ekspor selesai!';
            progressBar.style.width = '100%';
            if (data.csv_url && !progressLog.querySelector('a[href="' + data.csv_url + '"]')) {
                progressLog.innerHTML += `<div><a href="${escapeHTML(data.csv_url)}" target="_blank" rel="noopener noreferrer" style="text-decoration: underline;">Lihat File CSV di Google Drive</a></div>`;
            }
            primaryCloseBtn.textContent = 'Selesai';
        } else {
            progressText.textContent = 'Ekspor Gagal!';
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
            await clearExportStatus();
            closeModal();
        };
    }
};