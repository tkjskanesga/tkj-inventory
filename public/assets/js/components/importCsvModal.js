import { openModal, closeModal, showNotification, escapeHTML } from '../utils.js';
import { startImportCsv, clearImportStatus, processImportQueue } from '../api.js';

/**
 * Memperbarui UI modal impor CSV berdasarkan data status dari server.
 * @param {object} data - Objek status impor dari file status.
 */
export const updateImportModalUI = (data) => {
    const progressBar = document.getElementById('importProgressBar');
    const progressText = document.getElementById('importProgressText');
    const progressLog = document.getElementById('importProgressLog');
    const primaryCloseBtn = document.getElementById('primaryCloseImportBtn');
    const confirmationView = document.getElementById('import-confirmation-view');
    const progressView = document.getElementById('import-progress-view');

    if (!progressView || !data) return;

    if (['running', 'complete', 'error'].includes(data.status)) {
        if (confirmationView && confirmationView.style.display !== 'none') confirmationView.style.display = 'none';
        if (progressView && progressView.style.display !== 'block') progressView.style.display = 'block';
    }

    const { processed = 0, total = 0 } = data;
    if (total > 0) {
        const percent = (processed / total) * 100;
        if(progressBar) progressBar.style.width = `${percent}%`;
        if(progressText) progressText.textContent = `Memproses ${processed} dari ${total} baris...`;
    } else {
        if(progressText) progressText.textContent = "Mempersiapkan...";
    }

    if (data.log && Array.isArray(data.log) && progressLog) {
        progressLog.innerHTML = data.log.map(entry => {
            let statusClass = '', statusIcon = '•';
            if (entry.status === 'success') { statusClass = 'text-success'; statusIcon = '✓'; }
            else if (entry.status === 'error') { statusClass = 'text-danger'; statusIcon = '✗'; }
            else if (entry.status === 'warning') { statusClass = 'text-warning'; statusIcon = '!'; }
            const iconHTML = entry.status === 'info' ? '' : `${statusIcon} `;
            return `<div class="${statusClass}">[${entry.time}] ${iconHTML}${escapeHTML(entry.message)}</div>`;
        }).join('');
        progressLog.scrollTop = progressLog.scrollHeight;
    }
    
    if (data.status === 'complete' || data.status === 'error') {
        if (data.status === 'complete') {
            if(progressText) progressText.textContent = `Impor selesai! ${data.success} berhasil, ${data.failed} gagal.`;
            if(progressBar) progressBar.style.width = '100%';
            if(primaryCloseBtn) primaryCloseBtn.textContent = 'Selesai';
        } else {
            if(progressText) progressText.textContent = 'Impor Gagal!';
            const errorMessage = data.message || 'Terjadi kesalahan.';
            if (progressLog && !progressLog.innerHTML.includes(errorMessage)) {
                 progressLog.innerHTML += `<div class="text-danger">[${new Date().toLocaleTimeString('id-ID')}] ✗ Error: ${escapeHTML(errorMessage)}</div>`;
            }
            if(primaryCloseBtn) primaryCloseBtn.textContent = 'Tutup';
        }
        
        if(primaryCloseBtn) {
            primaryCloseBtn.style.display = 'inline-flex';
            primaryCloseBtn.onclick = async () => {
                await clearImportStatus();
                if (data.status === 'complete' && data.success > 0) {
                    const targetPage = ['stock', 'accounts'].includes(data.import_type) ? `#${data.import_type}` : '#history';
                    localStorage.setItem('lastActivePage', targetPage);
                    window.location.reload();
                } else {
                    closeModal();
                }
            };
        }
    }
};

/**
 * Menampilkan modal untuk impor CSV (bisa untuk Stok, Riwayat, atau Akun).
 * @param {string} type - 'stock', 'history', atau 'accounts'.
 * @param {object|null} initialData - Data status awal jika ada proses yang sedang berjalan.
 */
export const showImportCsvModal = (type = 'stock', initialData = null) => {
    let title, description, descriptionDetails, format, templateName, templateContent;

    if (type === 'history') {
        title = 'Impor Riwayat (CSV)';
        description = 'Unggah file CSV yang dihasilkan dari fitur <strong>Backup to Google Drive</strong> untuk memulihkan riwayat.';
        descriptionDetails = 'Pastikan barang di dalam file CSV sudah ada di stok barang.';
        format = '<strong>Nama Peminjam, Kelas, ..., Link Bukti Google Drive</strong>';
        templateName = 'template_impor_riwayat.csv';
        templateContent = "Nama Peminjam,Kelas,Mata Pelajaran,Nama Barang,Jenis Alat,Jumlah,Tanggal Pinjam,Tanggal Kembali,Link Bukti Google Drive\nJohn Doe,XI-TKJ 1,Jaringan Dasar,Router Mikrotik,Router,1,2025-10-10 08:00:00,2025-10-10 16:00:00,https://drive.google.com/file/d/xxxxx/view?usp=sharing\n,,,,Kabel LAN 5m,Kabel,2,,,https://drive.google.com/file/d/xxxxx/view?usp=sharing";
    } else if (type === 'accounts') {
        title = 'Impor Akun (CSV)';
        description = 'Unggah file CSV untuk mengimpor data akun.';
        descriptionDetails = 'Pastikan tidak ada NIS yang sama dengan data yang sudah ada.';
        format = '<strong>NIS, Password, Nama, Kelas</strong>';
        templateName = 'template_impor_akun.csv';
        templateContent = 'NIS,Password,Nama,Kelas\n12345678,password123,John Doe,XI-TKJ 1\n87654321,password456,Jane Smith,XII-TKJ 2';
    } else { // 'stock'
        title = 'Impor Barang (CSV)';
        description = 'Unggah file CSV untuk menambahkan data barang.';
        descriptionDetails = 'Pastikan format file CSV benar.';
        format = '<strong>Kode Barang, Nama Barang, Jenis Barang, Jumlah, Link Gambar</strong>';
        templateName = 'template_impor_barang.csv';
        templateContent = "Kode Barang,Nama Barang,Jenis Barang,Jumlah,Link Gambar\nINV-12345ABCD,Router Cisco,Router,10,https://example.com/router.jpg\n,Kabel LAN 5m,Kabel,50,https://example.com/cable.jpg";
    }

    openModal(title, `
        <div id="importModalContainer">
            <div id="import-confirmation-view">
                <form id="importCsvForm">
                    <input type="hidden" name="import_type" value="${type}">
                     <div class="form-group">
                        <p>${description}</p>
                        <p style="margin: 1rem 0;">Pastikan format sesuai: ${format}.</p>
                        <a href="#" id="downloadCsvTemplate" style="font-size: 0.9rem; text-decoration: underline;">Unduh template CSV</a>
                        <p class="modal-warning-text" style="margin: 1rem 0; text-align: left;">${descriptionDetails}</p>
                    </div>
                    <div class="form-group">
                        <div class="image-uploader" id="csvUploader">
                            <input type="file" id="csvFile" name="csv_file" accept=".csv,text/csv" hidden required>
                            <div class="image-uploader__prompt"><i class='bx bxs-file-import'></i><p>Seret & lepas file, atau klik</p></div>
                            <div class="image-uploader__file-info"><i class='bx bxs-file-check'></i><span id="csvFileName"></span></div>
                        </div>
                        <small id="csv-file-error" class="text-danger" style="display:none; margin-top: 0.5rem;">File CSV wajib diunggah.</small>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary close-modal-btn">Batal</button>
                        <button type="submit" id="startImportBtn" class="btn btn-primary">Mulai Impor</button>
                    </div>
                </form>
            </div>
            <div id="import-progress-view" style="display: none;">
                <div class="progress-bar-container" style="margin: 1.5rem 0;">
                    <div class="progress-bar-text" id="importProgressText" style="margin-bottom: 0.5rem; color: var(--text-color-light); font-size: 0.9rem;">Memulai...</div>
                    <div class="progress-bar" style="background-color: var(--border-color); border-radius: 20px; overflow: hidden;">
                        <div id="importProgressBar" class="progress-bar__fill" style="width: 0%; height: 15px; background-color: var(--success-color); border-radius: 20px; transition: width 0.3s ease;"></div>
                    </div>
                </div>
                <div class="progress-log" id="importProgressLog" style="background-color: var(--secondary-color); border-radius: var(--border-radius); padding: 1rem; height: 180px; overflow-y: auto; font-size: 0.8rem; line-height: 1.5;"></div>
                 <div class="modal-footer">
                    <button type="button" id="primaryCloseImportBtn" class="btn btn-primary" style="display: none;">Selesai</button>
                </div>
            </div>
        </div>
    `);
    
    const form = document.getElementById('importCsvForm');
    if (form) {
        const uploader = document.getElementById('csvUploader');
        const fileInput = document.getElementById('csvFile');
        const prompt = uploader.querySelector('.image-uploader__prompt');
        const fileInfo = uploader.querySelector('.image-uploader__file-info');
        const fileNameDisplay = document.getElementById('csvFileName');
        const fileError = document.getElementById('csv-file-error');

        const handleFile = (file) => {
            if (file && (file.type === 'text/csv' || file.name.toLowerCase().endsWith('.csv') || file.type === 'application/vnd.ms-excel')) {
                const dataTransfer = new DataTransfer(); dataTransfer.items.add(file); fileInput.files = dataTransfer.files;
                fileNameDisplay.textContent = file.name;
                prompt.style.display = 'none'; fileInfo.style.display = 'flex'; fileError.style.display = 'none';
            } else {
                fileInput.value = ''; prompt.style.display = 'flex'; fileInfo.style.display = 'none'; fileNameDisplay.textContent = '';
                if (file) showNotification('Harap pilih file dengan format .csv', 'error');
            }
        };
        
        uploader.addEventListener('click', () => fileInput.click());
        fileInput.addEventListener('change', () => handleFile(fileInput.files[0]));
        uploader.addEventListener('dragover', (e) => { e.preventDefault(); uploader.classList.add('drag-over'); });
        uploader.addEventListener('dragleave', () => uploader.classList.remove('drag-over'));
        uploader.addEventListener('drop', (e) => { e.preventDefault(); uploader.classList.remove('drag-over'); handleFile(e.dataTransfer.files[0]); });

        document.getElementById('downloadCsvTemplate').addEventListener('click', (e) => {
            e.preventDefault();
            const blob = new Blob([templateContent], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement("a");
            link.href = URL.createObjectURL(blob);
            link.download = templateName;
            link.click();
            URL.revokeObjectURL(link.href);
        });

        form.addEventListener('submit', (e) => {
            e.preventDefault();
            if (!fileInput.files[0]) {
                fileError.style.display = 'block';
                return;
            }
            e.target.querySelector('button[type="submit"]').disabled = true;
            startImportCsv(new FormData(form));
        });
    }
    
    if (initialData && initialData.status !== 'idle') {
        updateImportModalUI(initialData);
        if (initialData.status === 'running') {
            processImportQueue();
        }
    }
};