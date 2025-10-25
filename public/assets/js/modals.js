import { state, API_URL, csrfToken } from './state.js';
import { openModal, closeModal, toLocalDateString, showNotification, escapeHTML } from './utils.js';
import { handleItemFormSubmit, handleReturnFormSubmit, handleDeleteItem, handleFlushHistoryFormSubmit, 
        handleAccountUpdateSubmit, fetchAndRenderHistory, handleDeleteHistoryItem, handleUpdateSettings, 
        handleEditBorrowalSubmit, handleAddItemFormSubmit, handleDeleteBorrowalItem, startImportCsv, 
        startBackupToDrive, clearBackupStatus, processBackupQueue, 
        handleDeleteMultipleItems, startExportStockToDrive, clearExportStatus, processExportQueue, processImportQueue, clearImportStatus, startExportAccountsToDrive,
        addClass, editClass, deleteClass } from './api.js';
import { handleAccountFormSubmit, handleDeleteAccount, handleDeleteMultipleAccounts } from './account.js';
import { renderReturns, filterStock } from './render.js';
import { updateFabFilterState, updateFilterButtonState } from './ui.js';

/**
 * @param {string} title - Judul modal.
 * @param {string} message - Pesan konfirmasi (HTML diizinkan, akan di-escape jika perlu).
 * @param {function} onConfirm - Callback yang dijalankan jika user menekan "Ya".
 */
const showConfirmModal = (title, message, onConfirm) => {
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

/**
 * Menginisialisasi semua dropdown kustom di dalam elemen modal yang diberikan.
 * @param {HTMLElement} modalElement - Elemen container dari modal (biasanya form).
 * @param {function(string): void} [onRoleChangeCallback] - Callback opsional yang dijalankan saat dropdown role berubah.
 */
const setupModalDropdowns = (modalElement, onRoleChangeCallback) => {
    const dropdowns = modalElement.querySelectorAll('.custom-dropdown');

    dropdowns.forEach(dropdown => {
        const selectedBtn = dropdown.querySelector('.custom-dropdown__selected');
        const optionsContainer = dropdown.querySelector('.custom-dropdown__options');
        const hiddenInput = dropdown.querySelector('input[type="hidden"]');
        const valueDisplay = dropdown.querySelector('.custom-dropdown__value');
        const placeholder = dropdown.querySelector('.custom-dropdown__placeholder');

        const updateDisplay = (value) => {
            const option = optionsContainer.querySelector(`.custom-dropdown__option[data-value="${value}"]`);
            if (value && option) {
                valueDisplay.innerHTML = option.dataset.display || `<span>${option.textContent.trim()}</span>`;
                valueDisplay.style.display = 'flex';
                if (placeholder) placeholder.style.display = 'none';
            } else {
                valueDisplay.style.display = 'none';
                if (placeholder) placeholder.style.display = 'block';
            }
        };
        
        // Atur tampilan awal berdasarkan nilai yang ada
        updateDisplay(hiddenInput.value);

        selectedBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            // Tutup dropdown lain yang mungkin terbuka
            dropdowns.forEach(otherDropdown => {
                if (otherDropdown !== dropdown) {
                    otherDropdown.classList.remove('is-open');
                }
            });
            dropdown.classList.toggle('is-open');
        });

        optionsContainer.addEventListener('click', (e) => {
            const option = e.target.closest('.custom-dropdown__option');
            if (option) {
                const newValue = option.dataset.value;
                hiddenInput.value = newValue;
                updateDisplay(newValue);
                dropdown.classList.remove('is-open');

                // Jika dropdown ini adalah dropdown role, panggil callback
                if (hiddenInput.id === 'accountRole' && onRoleChangeCallback) {
                    onRoleChangeCallback(newValue);
                }
            }
        });
    });

    // Menutup dropdown jika klik di luar
    document.addEventListener('click', function(event) {
        if (!modalElement.contains(event.target)) {
            dropdowns.forEach(d => d.classList.remove('is-open'));
        }
    }, { once: true });
};

/* Modal untuk memilih filter jenis barang */
export const showClassifierFilterModal = () => {
    if (state.classifiers.length === 0) {
        showNotification('Tidak ada jenis barang yang tersedia untuk difilter.', 'error');
        return;
    }

    const classifierOptionsHTML = state.classifiers.map(classifier => `
        <div class="form-check classifier-filter-item" style="margin-bottom: 0.75rem;">
            <input class="form-check-input classifier-filter-input" type="radio" name="classifierFilter" id="classifier-${escapeHTML(classifier)}" value="${escapeHTML(classifier)}" ${state.currentClassifierFilter === classifier ? 'checked' : ''}>
            <label class="form-check-label classifier-filter-label" for="classifier-${escapeHTML(classifier)}">
                ${escapeHTML(classifier)}
            </label>
        </div>
    `).join('');

    openModal('Filter Jenis Barang', `
        <form id="classifierFilterForm">
            <p class="modal-details" style="margin-bottom: 1rem;">Pilih salah satu jenis barang untuk ditampilkan:</p>
            <div class="classifier-filter-list" style="max-height: 300px; overflow-y: auto; padding-right: 1rem;">
                ${classifierOptionsHTML}
            </div>
            <div class="modal-footer" style="margin-top: 1.5rem;">
                <button type="button" class="btn btn-secondary close-modal-btn">Batal</button>
                <button type="submit" class="btn btn-primary">Terapkan</button>
            </div>
        </form>
    `);

    const form = document.getElementById('classifierFilterForm');
    form.addEventListener('submit', (e) => {
        e.preventDefault();
        const selectedRadio = form.querySelector('input[name="classifierFilter"]:checked');
        if (selectedRadio) {
            state.currentClassifierFilter = selectedRadio.value;
            state.currentStockFilter = 'classifier';
            updateFilterButtonState();
            filterStock();
            closeModal();
        } else {
            showNotification('Pilih salah satu jenis barang.', 'error');
        }
    });
};

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
            return `<div class="${statusClass}">[${entry.time}] ${iconHTML}${entry.message}</div>`;
        }).join('');
        progressLog.scrollTop = progressLog.scrollHeight;
    }
    
    if (data.status === 'complete' || data.status === 'error') {
        if (data.status === 'complete') {
            progressText.textContent = 'Proses backup selesai!';
            progressBar.style.width = '100%';
            if (data.csv_url && !progressLog.querySelector('a[href="' + data.csv_url + '"]')) {
                progressLog.innerHTML += `<div><a href="${data.csv_url}" target="_blank" rel="noopener noreferrer" style="text-decoration: underline;">Lihat File CSV di Google Drive</a></div>`;
            }
            primaryCloseBtn.textContent = 'Selesai';
        } else {
            progressText.textContent = 'Backup Gagal!';
            const errorMessage = data.message || 'Terjadi kesalahan tidak diketahui.';
            const errorHTML = `<div class="text-danger" style="margin-top: 1rem; font-weight: bold;">[${new Date().toLocaleTimeString('id-ID')}] ✗ Error: ${errorMessage}</div>`;
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
            return `<div class="${statusClass}">[${entry.time}] ${iconHTML}${entry.message}</div>`;
        }).join('');
        progressLog.scrollTop = progressLog.scrollHeight;
    }
    
    if (data.status === 'complete' || data.status === 'error') {
        if (data.status === 'complete') {
            progressText.textContent = 'Proses ekspor selesai!';
            progressBar.style.width = '100%';
            if (data.csv_url && !progressLog.querySelector('a[href="' + data.csv_url + '"]')) {
                progressLog.innerHTML += `<div><a href="${data.csv_url}" target="_blank" rel="noopener noreferrer" style="text-decoration: underline;">Lihat File CSV di Google Drive</a></div>`;
            }
            primaryCloseBtn.textContent = 'Selesai';
        } else {
            progressText.textContent = 'Ekspor Gagal!';
            const errorMessage = data.message || 'Terjadi kesalahan tidak diketahui.';
            const errorHTML = `<div class="text-danger" style="margin-top: 1rem; font-weight: bold;">[${new Date().toLocaleTimeString('id-ID')}] ✗ Error: ${errorMessage}</div>`;
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

/**
 * Menampilkan modal ekspor stok.
 * @param {object|null} initialData - Data status awal jika ada proses yang sedang berjalan.
 */
export const showExportStockModal = (initialData = null) => {
    openModal(`Ekspor Stok ke Google Drive`, `
        <div id="exportModalContainer">
            <div id="export-confirmation-view">
                <p class="modal-details">Ini akan mengunggah semua gambar barang ke Google Drive dan membuat file CSV yang dapat digunakan untuk impor.</p>
                <p class="modal-warning-text" style="text-align: left;">Pastikan koneksi internet Anda stabil.</p>
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
        startExportStockToDrive();
    };
    
    if (initialData && initialData.status !== 'idle') {
        updateExportModalUI(initialData);
        if (initialData.status === 'running') {
            processExportQueue();
        }
    }
};

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


// --- Modal Utama ---
const isMobileDevice = () => /Mobi|Android|iPhone/i.test(navigator.userAgent);

// Buat dan kelola semua modal.
export const setupImageUploader = (uploaderElement) => {
    if (!uploaderElement) return;
    const input = uploaderElement.querySelector('input[type="file"]');
    const preview = uploaderElement.querySelector('.image-uploader__preview');
    
    const showPreview = (file) => {
        const reader = new FileReader();
        reader.onload = () => { preview.src = reader.result; uploaderElement.classList.add('has-preview'); };
        reader.readAsDataURL(file);
    };
    
    const handleFiles = (files) => {
        if (files.length > 0 && files[0].type.startsWith('image/')) {
            const dataTransfer = new DataTransfer();
            dataTransfer.items.add(files[0]);
            input.files = dataTransfer.files;
            showPreview(files[0]);
        }
    };
    
    uploaderElement.addEventListener('click', () => input.click());
    input.addEventListener('change', () => handleFiles(input.files));
    uploaderElement.addEventListener('dragover', (e) => { e.preventDefault(); uploaderElement.classList.add('drag-over'); });
    uploaderElement.addEventListener('dragleave', () => uploaderElement.classList.remove('drag-over'));
    uploaderElement.addEventListener('drop', (e) => { e.preventDefault(); uploaderElement.classList.remove('drag-over'); handleFiles(e.dataTransfer.files); });
};

export const showItemModal = (id = null) => {
    const isEdit = id !== null;
    const item = isEdit ? state.items.find(i => i.id == id) : {};
    if (isEdit && !item) return;

    openModal(isEdit ? 'Edit Barang' : 'Barang Baru', `
        <form id="itemForm">
            <input type="hidden" name="id" value="${item.id || ''}">
            <input type="hidden" name="classifier" id="classifierValue" value="${item.classifier || ''}">
            <div class="form-group">
                <label for="itemName">Nama Barang</label>
                <input type="text" id="itemName" name="name" value="${item.name || ''}" required>
            </div>
            <div class="form-group">
                <label for="hybrid-dropdown-select">Jenis Alat</label>
                <div class="hybrid-dropdown">
                    <button type="button" class="hybrid-dropdown__selected">
                        <span class="hybrid-dropdown__placeholder">Pilih atau buat jenis baru...</span>
                        <div class="hybrid-dropdown__value"></div>
                        <i class='bx bx-chevron-down hybrid-dropdown__arrow'></i>
                    </button>
                    <div class="hybrid-dropdown__options">
                        <!-- Options are populated by JS -->
                    </div>
                </div>
            </div>
            <div class="form-group">
                <label for="itemQuantity">Jumlah Total</label>
                <input type="number" id="itemQuantity" name="total_quantity" min="1" value="${item.total_quantity || ''}" required>
            </div>
            <div class="form-group">
                <label for="itemImage">${isEdit ? 'Ganti Gambar (Opsional)' : 'Gambar Barang'}</label>
                <div class="image-uploader">
                    <input type="file" id="itemImage" name="image" accept="image/*" hidden>
                    <div class="image-uploader__prompt"><i class="bx bx-upload"></i><p>Seret & lepas gambar, atau klik</p></div>
                    <img src="#" alt="Pratinjau" class="image-uploader__preview">
                </div>
            </div>
            <div class="modal-footer">
                <button type="button" class="btn btn-secondary close-modal-btn">Batal</button>
                <button type="submit" class="btn btn-primary">
                    <span class="btn__text">${isEdit ? 'Update' : 'Simpan'}</span>
                    <div class="btn__progress"></div>
                </button>
            </div>
        </form>`);
    
    // --- Logika Hybrid Dropdown ---
    const form = document.getElementById('itemForm');
    const dropdown = form.querySelector('.hybrid-dropdown');
    const selected = dropdown.querySelector('.hybrid-dropdown__selected');
    const optionsContainer = dropdown.querySelector('.hybrid-dropdown__options');
    const placeholder = dropdown.querySelector('.hybrid-dropdown__placeholder');
    const valueDisplay = dropdown.querySelector('.hybrid-dropdown__value');
    const hiddenInput = form.querySelector('#classifierValue');

    const closeDropdown = () => dropdown.classList.remove('is-open');

    const updateValue = (newValue) => {
        hiddenInput.value = newValue;
        if (newValue) {
            valueDisplay.textContent = newValue;
            valueDisplay.style.display = 'block';
            placeholder.style.display = 'none';
        } else {
            valueDisplay.style.display = 'none';
            placeholder.style.display = 'block';
        }
        closeDropdown();
    };
    
    const populateOptions = () => {
        optionsContainer.innerHTML = '';
        
        // Buat opsi "Buat Baru"
        const createNewOpt = document.createElement('div');
        createNewOpt.className = 'hybrid-dropdown__option hybrid-dropdown__option--create';
        createNewOpt.innerHTML = `<i class='bx bx-plus-circle'></i><span>Buat Jenis Baru</span>`;
        createNewOpt.onclick = (e) => {
            e.stopPropagation();
            optionsContainer.innerHTML = `
                <div class="hybrid-dropdown__new-input-container">
                    <input type="text" placeholder="Contoh: Router, Switch..." class="hybrid-dropdown__new-input">
                    <button type="button" class="btn btn-primary hybrid-dropdown__save-btn"><i class='bx bx-check'></i></button>
                </div>`;
            
            const newInput = optionsContainer.querySelector('.hybrid-dropdown__new-input');
            const saveBtn = optionsContainer.querySelector('.hybrid-dropdown__save-btn');
            newInput.focus();

            const saveNewValue = () => {
                const val = newInput.value.trim();
                if (val) updateValue(val);
            };

            newInput.onkeydown = (ev) => { if (ev.key === 'Enter') saveNewValue(); };
            saveBtn.onclick = saveNewValue;
        };
        optionsContainer.appendChild(createNewOpt);

        // Tambahkan opsi yang sudah ada
        state.classifiers.forEach(c => {
            const opt = document.createElement('div');
            opt.className = 'hybrid-dropdown__option';
            opt.textContent = c;
            opt.onclick = () => updateValue(c);
            optionsContainer.appendChild(opt);
        });
    };

    selected.onclick = () => {
        if (!dropdown.classList.contains('is-open')) {
            populateOptions();
        }
        dropdown.classList.toggle('is-open');
    };

    // Set nilai awal jika sedang mengedit
    if (item.classifier) {
        updateValue(item.classifier);
    }

    form.addEventListener('submit', handleItemFormSubmit);
    setupImageUploader(form.querySelector('.image-uploader'));

    // Menutup dropdown jika klik di luar
    document.addEventListener('click', function(event) {
        if (!dropdown.contains(event.target)) {
            closeDropdown();
        }
    }, true);
};

export const showDeleteItemModal = (id) => {
    const item = state.items.find(i => i.id == id);
    if (!item) return;
    openModal('Konfirmasi Hapus', `
        <p class="modal-details">Anda yakin ingin menghapus <strong>${item.name}</strong>?</p>
        <div class="modal-footer"><button type="button" class="btn btn-secondary close-modal-btn">Batal</button><button type="button" id="confirmDeleteBtn" class="btn btn-danger">Ya, Hapus</button></div>`);
    document.getElementById('confirmDeleteBtn').onclick = () => handleDeleteItem(id);
};

export const showDeleteMultipleItemsModal = () => {
    const selectedIds = state.selectedItems;
    if (selectedIds.length === 0) return;

    const selectedItemsDetails = selectedIds.map(id => state.items.find(item => item.id == id)).filter(Boolean);
    const itemsInUse = selectedItemsDetails.filter(item => item.current_quantity < item.total_quantity);

    const itemsListHTML = selectedItemsDetails.map(item => `<li>${item.name}</li>`).join('');

    let modalContent;
    let confirmButtonHTML;

    if (itemsInUse.length > 0) {
        const itemsInUseHTML = itemsInUse.map(item => `<li><strong>${item.name}</strong></li>`).join('');
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

export const showDeleteHistoryModal = (id) => {
    const historyItem = state.history.find(h => h.id == id);
    if (!historyItem) return;

    openModal('Konfirmasi Hapus', `
        <p class="modal-details">Anda yakin ingin menghapus riwayat peminjaman:</p>
        <p class="modal-details"><strong>${historyItem.item_name}</strong> oleh <strong>${historyItem.borrower_name}</strong> <span style="font-weight: bold; color: var(--danger-color);">secara permanen?</span></p>
        <div class="modal-footer">
            <button type="button" class="btn btn-secondary close-modal-btn">Batal</button>
            <button type="button" id="confirmDeleteHistoryBtn" class="btn btn-danger">Ya, Hapus</button>
        </div>`);
    document.getElementById('confirmDeleteHistoryBtn').onclick = () => handleDeleteHistoryItem(id);
};

export const showDeleteBorrowalModal = (id) => {
    const borrowalItem = state.borrowals.find(b => b.id == id);
    if (!borrowalItem) return;

    openModal('Konfirmasi Hapus', `
        <p class="modal-warning-text" style="text-align: left; margin-top: 1rem;"><strong>PERINGATAN:</strong> Stok barang akan dikembalikan. Tindakan ini tidak dapat diurungkan.</p>
        <p class="modal-details">Anda yakin ingin menghapus item peminjaman:</p>
        <p class="modal-details"><strong>${borrowalItem.item_name} (${borrowalItem.quantity} pcs)</strong> oleh <strong>${borrowalItem.borrower_name}</strong>?</p>
        <div class="modal-footer">
            <button type="button" class="btn btn-secondary close-modal-btn">Batal</button>
            <button type="button" id="confirmDeleteBorrowalBtn" class="btn btn-danger">Ya, Hapus</button>
        </div>`);
    document.getElementById('confirmDeleteBorrowalBtn').onclick = () => handleDeleteBorrowalItem(id);
};

/**
 * Membuka UI kamera untuk mengambil foto.
 * @param {HTMLInputElement} cameraFileInput - Input file target untuk hasil kamera.
 * @param {HTMLInputElement} galleryFileInput - Input file galeri sebagai fallback.
 * @param {Function} showPreviewCallback - Callback untuk menampilkan pratinjau.
 */
const openCameraUI = (cameraFileInput, galleryFileInput, showPreviewCallback) => {
    if (!('mediaDevices' in navigator && 'getUserMedia' in navigator.mediaDevices)) {
        console.warn('Camera API not supported, falling back to gallery input.');
        if (galleryFileInput) galleryFileInput.click();
        return;
    }

    const overlay = document.createElement('div');
    overlay.className = 'camera-overlay';
    overlay.innerHTML = `
        <div class="camera-container">
            <video id="cameraFeed" autoplay playsinline style="transform: scaleX(-1);"></video>
            <canvas id="cameraCanvas" style="display:none;"></canvas>
            <div class="camera-controls">
                <button type="button" class="camera-cancel-btn" title="Batal"><i class='bx bx-x'></i></button>
                <button type="button" class="camera-capture-btn" title="Ambil Gambar"></button>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);

    const video = document.getElementById('cameraFeed');
    const canvas = document.getElementById('cameraCanvas');
    const captureBtn = overlay.querySelector('.camera-capture-btn');
    const cancelBtn = overlay.querySelector('.camera-cancel-btn');
    let stream = null;

    const cleanup = () => {
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
        }
        if (document.body.contains(overlay)) {
            document.body.removeChild(overlay);
        }
    };

    cancelBtn.onclick = cleanup;
    overlay.onclick = (e) => {
        if (e.target === overlay) cleanup();
    };
    
    captureBtn.onclick = () => {
        if (!stream) return;
        
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        
        const ctx = canvas.getContext('2d');
        // Balikkan konteks canvas secara horizontal
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);
        // Gambar video ke canvas yang sudah dibalik
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        canvas.toBlob(blob => {
            const fileName = `capture_${new Date().toISOString()}.jpg`;
            const file = new File([blob], fileName, { type: 'image/jpeg', lastModified: Date.now() });

            if (galleryFileInput) galleryFileInput.value = '';

            const dataTransfer = new DataTransfer();
            dataTransfer.items.add(file);
            cameraFileInput.files = dataTransfer.files;

            showPreviewCallback(file);
            cleanup();
        }, 'image/jpeg', 0.9);
    };

    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false })
        .then(mediaStream => {
            stream = mediaStream;
            video.srcObject = stream;
        })
        .catch(err => {
            console.error("Camera access error:", err.name, err.message);
            showNotification('Gagal mengakses kamera. Silakan gunakan unggah dari galeri.', 'error');
            cleanup();
            if (galleryFileInput) galleryFileInput.click();
        });
};

export const showReturnModal = (transactionId) => {
    const borrowalsInTransaction = state.borrowals.filter(b => b.transaction_id === transactionId);
    if (borrowalsInTransaction.length === 0) return;

    const borrowerInfo = borrowalsInTransaction[0];
    const itemsListHTML = borrowalsInTransaction.map(b => 
        `<li><strong>${b.quantity}x</strong> ${b.item_name}</li>`
    ).join('');

    openModal(`Pengembalian`, `
        <form id="returnForm">
            <input type="hidden" name="transaction_id" value="${transactionId}">
            <p>Konfirmasi pengembalian dari <strong>${borrowerInfo.borrower_name}</strong> (${borrowerInfo.borrower_class}):</p>
            <ul style="list-style-position: inside; margin: 1rem 0;">${itemsListHTML}</ul>
            <div class="form-group">
                <label>Bukti Pengembalian</label>
                <input type="file" id="returnProofGallery" name="proof_image" accept="image/*" hidden>
                <input type="file" id="returnProofCamera" name="proof_image_camera" accept="image/*" capture="environment" hidden>
                
                <div class="image-uploader">
                    <div class="image-uploader__prompt"><i class='bx bx-upload'></i><p>Unggah dari galeri</p></div>
                    <img src="#" alt="Pratinjau" class="image-uploader__preview">
                </div>
                <button type="button" id="takePictureBtn" class="btn btn-secondary btn-block" style="margin-top: 1rem;"><i class='bx bxs-camera'></i> Ambil Foto</button>
                <small id="file-error" class="text-danger" style="display:none; margin-top: 0.5rem;">Bukti foto wajib diunggah.</small>
            </div>
            <div class="modal-footer">
                <button type="button" class="btn btn-secondary close-modal-btn">Batal</button>
                <button type="submit" class="btn btn-primary">
                    <span class="btn__text">Konfirmasi</span>
                    <div class="btn__progress"></div>
                </button>
            </div>
        </form>`);

    const form = document.getElementById('returnForm');
    const galleryInput = document.getElementById('returnProofGallery');
    const cameraInput = document.getElementById('returnProofCamera');
    const uploaderDiv = form.querySelector('.image-uploader');
    const previewImg = form.querySelector('.image-uploader__preview');
    const takePictureBtn = document.getElementById('takePictureBtn');
    const fileError = document.getElementById('file-error');

    const showPreview = (file) => {
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
            previewImg.src = reader.result;
            uploaderDiv.classList.add('has-preview');
            fileError.style.display = 'none';
        };
        reader.readAsDataURL(file);
    };

    uploaderDiv.addEventListener('click', () => galleryInput.click());
    uploaderDiv.addEventListener('dragover', (e) => { e.preventDefault(); uploaderDiv.classList.add('drag-over'); });
    uploaderDiv.addEventListener('dragleave', () => uploaderDiv.classList.remove('drag-over'));
    uploaderDiv.addEventListener('drop', (e) => {
        e.preventDefault();
        uploaderDiv.classList.remove('drag-over');
        if (e.dataTransfer.files.length > 0) {
            cameraInput.value = '';
            galleryInput.files = e.dataTransfer.files;
            showPreview(galleryInput.files[0]);
        }
    });
    
    // Logika kondisional untuk tombol "Ambil Foto"
    if (isMobileDevice()) {
        // Pada mobile, langsung trigger input file dengan atribut 'capture'
        takePictureBtn.addEventListener('click', () => cameraInput.click());
    } else {
        // Pada desktop, buka UI kamera custom
        takePictureBtn.addEventListener('click', () => {
            openCameraUI(cameraInput, galleryInput, showPreview);
        });
    }

    galleryInput.addEventListener('change', () => {
        if (galleryInput.files.length > 0) {
            cameraInput.value = '';
            showPreview(galleryInput.files[0]);
        }
    });

    cameraInput.addEventListener('change', () => {
        if (cameraInput.files.length > 0) {
            galleryInput.value = '';
            showPreview(cameraInput.files[0]);
        }
    });

    form.addEventListener('submit', (e) => {
        e.preventDefault();

        // Pastikan salah satu input file memiliki file
        if (galleryInput.files.length === 0 && cameraInput.files.length === 0) {
            fileError.style.display = 'block';
            return;
        }

        // Siapkan form untuk dikirim dengan menonaktifkan input yang tidak terpakai
        if (galleryInput.files.length > 0) {
            cameraInput.disabled = true;
        } else {
            galleryInput.disabled = true;
        }

        handleReturnFormSubmit(e).finally(() => {
            cameraInput.disabled = false;
            galleryInput.disabled = false;
        });
    });
};

export const showAddItemModal = (transactionId) => {
    const existingBorrowals = state.borrowals.filter(b => b.transaction_id === transactionId);
    if (existingBorrowals.length === 0) return;

    const borrowerInfo = existingBorrowals[0];

    // Buat daftar item yang sudah dipinjam (read-only)
    const existingItemsHTML = existingBorrowals.map(item => `
        <li class="transaction-group__item" style="padding: 0.75rem 0;">
            <img src="${item.image_url || 'https://placehold.co/50x50/8ab4f8/ffffff?text=?'}" alt="${item.item_name}" class="transaction-group__item-img">
            <div class="transaction-group__item-details">
                <div class="transaction-group__item-name">${item.item_name}</div>
                <div class="transaction-group__item-qty">Jumlah: ${item.quantity} pcs</div>
            </div>
        </li>
    `).join('');

    openModal(`Tambah Alat`, `
        <div class="form-group">
            <label>Peminjam</label>
            <input type="text" value="${borrowerInfo.borrower_name} (${borrowerInfo.borrower_class})" readonly>
        </div>
        <div class="form-group">
            <label>Sudah Dipinjam</label>
            <ul class="transaction-group__items" style="max-height: 150px; overflow-y: auto; padding: 1rem; background-color: var(--secondary-color); border-radius: var(--border-radius);">${existingItemsHTML}</ul>
        </div>
        
        <form id="addItemForm">
            <input type="hidden" name="transaction_id" value="${transactionId}">
            <p style="font-weight: 500; margin-bottom: 1rem; border-top: 1px solid var(--border-color); padding-top: 1.5rem;">Tambah Alat</p>
            
            <div id="newItemsContainer">
                <!-- Baris item baru akan ditambahkan di sini oleh JS -->
            </div>

            <div class="form-group" style="margin-top: 1.5rem; text-align: center;">
                <button type="button" id="addNewItemBtn" class="btn btn-secondary btn-block">
                    <i class='bx bx-plus'></i>
                    <span>Tambah Alat</span>
                </button>
            </div>
            
            <div class="modal-footer">
                <button type="button" class="btn btn-secondary close-modal-btn">Batal</button>
                <button type="submit" class="btn btn-primary">
                    <span class="btn__text">Simpan</span>
                </button>
            </div>
        </form>
    `);

    // Logika untuk menambah/menghapus baris di dalam modal
    const newItemsContainer = document.getElementById('newItemsContainer');
    let newRowCounter = 0;

    const updateModalDropdowns = () => {
        const selectedItemIds = Array.from(newItemsContainer.querySelectorAll('input[name="item_id"]'))
            .map(input => input.value)
            .filter(Boolean);
        
        const existingItemIds = existingBorrowals.map(b => b.item_id.toString());
        const allDisabledIds = [...selectedItemIds, ...existingItemIds];

        newItemsContainer.querySelectorAll('.custom-dropdown').forEach(dropdown => {
            const currentSelectedId = dropdown.querySelector('input[name="item_id"]').value;
            dropdown.querySelectorAll('.custom-dropdown__option').forEach(option => {
                const isDisabled = allDisabledIds.includes(option.dataset.value) && option.dataset.value !== currentSelectedId;
                option.setAttribute('aria-disabled', isDisabled);
            });
        });
    };
    
    const updateModalActionButtons = () => {
        const rows = newItemsContainer.querySelectorAll('.borrow-item-row');
        rows.forEach(row => {
            const existingBtn = row.querySelector('.remove-last-item-btn');
            if (existingBtn) existingBtn.remove();
        });

        if (rows.length > 1) {
            const lastRow = rows[rows.length - 1];
            const removeBtn = document.createElement('button');
            removeBtn.type = 'button';
            removeBtn.className = 'btn btn-secondary remove-last-item-btn';
            removeBtn.title = 'Hapus alat terakhir';
            removeBtn.innerHTML = `<i class='bx bx-chevron-up'></i>`;
            removeBtn.onclick = () => {
                lastRow.remove();
                updateModalDropdowns();
                updateModalActionButtons();
            };
            lastRow.appendChild(removeBtn);
        }
    };

    const createNewItemRow = () => {
        newRowCounter++;
        const rowId = `new-item-row-${newRowCounter}`;
        const row = document.createElement('div');
        row.className = 'borrow-item-row';
        row.id = rowId;

        const availableItems = state.items.filter(item => item.current_quantity > 0);
        const itemOptionsHTML = availableItems.map(item => `
            <div class="custom-dropdown__option" data-value="${item.id}" data-max="${item.current_quantity}" data-display="<img src='${item.image_url || 'https://placehold.co/40x40/8ab4f8/ffffff?text=?'}' alt='${item.name}'><span>${item.name}</span>">
                <img src="${item.image_url || 'https://placehold.co/40x40/8ab4f8/ffffff?text=?'}" alt="${item.name}" class="custom-dropdown__option-img">
                <div class="custom-dropdown__option-info">
                    <span class="custom-dropdown__option-name">${item.name}</span>
                    <span class="custom-dropdown__option-qty">Sisa: ${item.current_quantity}</span>
                </div>
            </div>`
        ).join('');

        row.innerHTML = `
            <div class="form-group borrow-item-row__item">
                <div class="custom-dropdown">
                    <input type="hidden" name="item_id" required>
                    <button type="button" class="custom-dropdown__selected">
                        <span class="custom-dropdown__placeholder">Pilih Alat</span>
                        <div class="custom-dropdown__value"></div>
                        <i class='bx bx-chevron-down custom-dropdown__arrow'></i>
                    </button>
                    <div class="custom-dropdown__options">${itemOptionsHTML}</div>
                </div>
            </div>
            <div class="form-group borrow-item-row__quantity">
                <input type="number" id="quantity-new-${newRowCounter}" name="quantity" min="1" value="1" required>
                <small class="form-text max-quantity-hint"></small>
            </div>
        `;
        
        const dropdown = row.querySelector('.custom-dropdown');
        const quantityInput = row.querySelector('input[type="number"]');
        const maxHint = row.querySelector('.max-quantity-hint');

        dropdown.querySelectorAll('.custom-dropdown__option').forEach(option => {
            option.addEventListener('click', () => {
                if (option.getAttribute('aria-disabled') === 'true') return;
                
                const hiddenInput = dropdown.querySelector('input[type="hidden"]');
                hiddenInput.value = option.dataset.value;

                const valueEl = dropdown.querySelector('.custom-dropdown__value');
                valueEl.innerHTML = option.dataset.display;
                valueEl.style.display = 'flex';
                dropdown.querySelector('.custom-dropdown__placeholder').style.display = 'none';
                dropdown.classList.remove('is-open');

                quantityInput.max = option.dataset.max;
                if (parseInt(quantityInput.value) > parseInt(option.dataset.max)) quantityInput.value = 1;
                maxHint.textContent = `Maks: ${option.dataset.max}`;
                
                updateModalDropdowns();
            });
        });
        
        newItemsContainer.appendChild(row);
        updateModalDropdowns();
        updateModalActionButtons();
    };
    
    createNewItemRow();
    document.getElementById('addNewItemBtn').addEventListener('click', createNewItemRow);
    document.getElementById('addItemForm').addEventListener('submit', handleAddItemFormSubmit);
};


export const showEditBorrowalModal = (id) => {
    const borrowal = state.borrowals.find(b => b.id == id);
    if (!borrowal) return;

    const availableItems = state.items.filter(item => 
        item.current_quantity > 0 || item.id == borrowal.item_id
    );

    const itemOptionsHTML = availableItems.map(item => {
        // Hitung stok maksimal yang bisa dipinjam
        const maxStock = (item.id == borrowal.item_id) 
            ? item.current_quantity + borrowal.quantity 
            : item.current_quantity;

        return `
        <div class="custom-dropdown__option" data-value="${item.id}" data-max="${maxStock}" data-display="<img src='${item.image_url || 'https://placehold.co/40x40/8ab4f8/ffffff?text=?'}' alt='${item.name}'><span>${item.name}</span>">
            <img src="${item.image_url || 'https://placehold.co/40x40/8ab4f8/ffffff?text=?'}" alt="${item.name}" class="custom-dropdown__option-img">
            <div class="custom-dropdown__option-info">
                <span class="custom-dropdown__option-name">${item.name}</span>
                <span class="custom-dropdown__option-qty">Sisa: ${item.current_quantity}</span>
            </div>
        </div>`;
    }).join('');

    const currentItem = state.items.find(i => i.id == borrowal.item_id);
    const initialMax = currentItem ? currentItem.current_quantity + borrowal.quantity : borrowal.quantity;
    const initialItemDisplay = currentItem 
        ? `<img src='${currentItem.image_url || 'https://placehold.co/40x40/8ab4f8/ffffff?text=?'}' alt='${currentItem.name}'><span>${currentItem.name}</span>` 
        : '<span>Barang tidak ditemukan</span>';

    openModal(`Ubah Peminjaman`, `
        <form id="editBorrowalForm">
            <input type="hidden" name="borrowal_id" value="${borrowal.id}">
            <p class="modal-warning-text" style="text-align: left;"><strong>PERINGATAN:</strong> Tindakan ini akan mengubah data peminjaman dan stok barang secara langsung.</p>
            <div class="form-group">
                <label>Nama Peminjam</label>
                <input type="text" value="${borrowal.borrower_name} (${borrowal.borrower_class})" readonly>
            </div>
             <div class="form-group">
                <label>Alat</label>
                <div class="custom-dropdown" id="editItemDropdown">
                    <input type="hidden" name="new_item_id" value="${borrowal.item_id}" required>
                    <button type="button" class="custom-dropdown__selected">
                        <div class="custom-dropdown__value" style="display: flex;">${initialItemDisplay}</div>
                        <i class='bx bx-chevron-down custom-dropdown__arrow'></i>
                    </button>
                    <div class="custom-dropdown__options">${itemOptionsHTML}</div>
                </div>
            </div>
            <div class="form-group">
                <label for="newQuantity">Jumlah</label>
                <input type="number" id="newQuantity" name="new_quantity" min="1" max="${initialMax}" value="${borrowal.quantity}" required>
                <small class="form-text max-quantity-hint">Maksimal pinjam: ${initialMax}</small>
            </div>
            <div class="modal-footer">
                <button type="button" class="btn btn-secondary close-modal-btn">Batal</button>
                <button type="submit" class="btn btn-primary">Update</button>
            </div>
        </form>
    `);
    
    // --- Dropdown Logic ---
    const dropdown = document.getElementById('editItemDropdown');
    const optionsEl = dropdown.querySelector('.custom-dropdown__options');
    const valueEl = dropdown.querySelector('.custom-dropdown__value');
    const hiddenInput = dropdown.querySelector('input[name="new_item_id"]');
    const quantityInput = document.getElementById('newQuantity');
    const maxHint = document.querySelector('.max-quantity-hint');

    // Logika pemilihan opsi
    optionsEl.addEventListener('click', e => {
        const option = e.target.closest('.custom-dropdown__option');
        if (!option) return;

        const newMax = parseInt(option.dataset.max);
        
        hiddenInput.value = option.dataset.value;
        valueEl.innerHTML = option.dataset.display;
        dropdown.classList.remove('is-open');
        
        quantityInput.max = newMax;
        if (parseInt(quantityInput.value) > newMax || quantityInput.value < 1) {
             quantityInput.value = newMax > 0 ? 1 : 0;
        }
        maxHint.textContent = `Maksimal pinjam: ${newMax}`;
    });
    
    document.getElementById('editBorrowalForm').addEventListener('submit', handleEditBorrowalSubmit);
};


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

export const showFlushHistoryModal = async () => {
    openModal('Bersihkan Riwayat', `
        <form id="flushHistoryForm">
            <p class="modal-warning-text" style="text-align: left;"><strong>PERINGATAN:</strong> Tindakan ini akan menghapus semua riwayat dan file bukti secara permanen.</p>
            <div class="captcha-container"><p>Masukkan teks pada gambar di bawah ini:</p><div id="captchaImageContainer"><p>Memuat...</p></div></div>
            <div class="form-group"><input type="text" id="captchaInput" name="captcha" placeholder="Masukkan captcha" autocomplete="off" required></div>
            <div class="modal-footer"><button type="button" class="btn btn-secondary close-modal-btn">Batal</button><button type="submit" class="btn btn-danger">Hapus Semua</button></div>
        </form>`);
    
    try {
        const response = await fetch(`${API_URL}?action=get_captcha`);
        const result = await response.json();
        const captchaContainer = document.getElementById('captchaImageContainer');
        captchaContainer.innerHTML = (result.status === 'success')
            ? `<img src="${result.data.image}" alt="Captcha" style="cursor:pointer;">`
            : `<p class="text-danger">Gagal memuat captcha.</p>`;
        if (result.status === 'success') captchaContainer.firstElementChild.onclick = showFlushHistoryModal;
    } catch (error) {
        document.getElementById('captchaImageContainer').innerHTML = `<p class="text-danger">Gagal terhubung ke server.</p>`;
    }
    
    document.getElementById('flushHistoryForm').addEventListener('submit', handleFlushHistoryFormSubmit);
};

export const showAccountModal = () => {
    const isAdmin = state.session.role === 'admin';
    const displayName = state.session.username || ''; // Ini adalah 'nama'
    const loginName = state.session.login_username || ''; // Ini adalah 'username' untuk admin, 'nis' untuk user
    const usernameLabel = isAdmin ? 'Username' : 'Username (NIS)';

    openModal(`<i class='bx bxs-user-cog'></i> Pengaturan Akun`, `
        <form id="accountForm">
            <div class="form-group">
                <label for="accountName">Nama</label>
                <input type="text" id="accountName" name="nama" value="${displayName}" ${isAdmin ? 'required' : 'readonly'}>
            </div>
            <div class="form-group">
                <label for="accountUsername">${usernameLabel}</label>
                <input type="text" id="accountUsername" name="username" value="${loginName}" ${isAdmin ? 'required' : 'readonly'}>
            </div>
            <div class="form-group">
                <label for="accountPassword">Password Baru</label>
                <input type="password" id="accountPassword" name="password" placeholder="Kosongkan jika tidak ingin ganti">
                <small class="form-text">Minimal 8 karakter untuk mengganti.</small>
            </div>
            <div class="form-group">
                <label for="confirmPassword">Konfirmasi Password Baru</label>
                <input type="password" id="confirmPassword" name="confirm_password" placeholder="Ketik ulang password baru">
                <small id="passwordMismatchError" class="text-danger" style="display:none; margin-top: 0.5rem;">Password tidak cocok.</small>
            </div>
            <div class="modal-footer">
                <button type="button" class="btn btn-secondary close-modal-btn">Batal</button>
                <button type="submit" id="updateAccountBtn" class="btn btn-primary">Update</button>
            </div>
        </form>
    `);

    const form = document.getElementById('accountForm');
    const passwordInput = document.getElementById('accountPassword');
    const confirmPasswordInput = document.getElementById('confirmPassword');
    const updateButton = document.getElementById('updateAccountBtn');
    const mismatchError = document.getElementById('passwordMismatchError');

    const validatePasswords = () => {
        if (passwordInput.value) {
            if (passwordInput.value !== confirmPasswordInput.value) {
                mismatchError.style.display = 'block';
                updateButton.disabled = true;
            } else {
                mismatchError.style.display = 'none';
                updateButton.disabled = false;
            }
        } else {
            confirmPasswordInput.value = '';
            mismatchError.style.display = 'none';
            updateButton.disabled = false;
        }
    };

    passwordInput.addEventListener('input', validatePasswords);
    confirmPasswordInput.addEventListener('input', validatePasswords);
    
    validatePasswords();

    form.addEventListener('submit', handleAccountUpdateSubmit);
};

// --- Modal Menejemen Akun (Baru & Edit) ---

/**
 * Menampilkan atau menyembunyikan field berdasarkan role yang dipilih.
 * @param {string} role - 'admin' atau 'user'.
 * @param {HTMLElement} formElement - Elemen form.
 */
const toggleAccountFields = (role, formElement) => {
    const nisField = formElement.querySelector('.nis-field');
    const kelasField = formElement.querySelector('.kelas-field');
    const usernameField = formElement.querySelector('.username-field');

    const nisInput = nisField?.querySelector('input');
    const kelasInput = kelasField?.querySelector('input[type="hidden"]');
    const usernameInput = usernameField?.querySelector('input');

    if (role === 'admin') {
        if (nisField) nisField.style.display = 'none';
        if (kelasField) kelasField.style.display = 'none';
        if (usernameField) usernameField.style.display = 'block';

        if (nisInput) nisInput.required = false;
        if (kelasInput) kelasInput.required = false;
        if (usernameInput) usernameInput.required = true;
    } else { // 'user'
        if (nisField) nisField.style.display = 'block';
        if (kelasField) kelasField.style.display = 'block';
        if (usernameField) usernameField.style.display = 'none';

        if (nisInput) nisInput.required = true;
        if (kelasInput) kelasInput.required = true;
        if (usernameInput) usernameInput.required = false;
    }
};

export const showAddAccountModal = () => {
    openModal('Tambah Akun Baru', `
        <form id="accountForm" novalidate>
            <div class="form-group">
                <label for="accountRole">Role</label>
                <div class="custom-dropdown">
                    <input type="hidden" id="accountRole" name="role" value="user" required>
                    <button type="button" class="custom-dropdown__selected">
                        <span class="custom-dropdown__placeholder">Pilih Role</span>
                        <div class="custom-dropdown__value"></div>
                        <i class='bx bx-chevron-down custom-dropdown__arrow'></i>
                    </button>
                    <div class="custom-dropdown__options">
                        <div class="custom-dropdown__option" data-value="user" data-display="<span>User (Siswa)</span>"><span class="custom-dropdown__option-name">User (Siswa)</span></div>
                        <div class="custom-dropdown__option" data-value="admin" data-display="<span>Admin</span>"><span class="custom-dropdown__option-name">Admin</span></div>
                    </div>
                </div>
            </div>
            <div class="form-group">
                <label for="accountName">Nama Lengkap</label>
                <input type="text" id="accountName" name="nama" required>
            </div>
             <div class="form-group username-field" style="display: none;">
                <label for="accountUsername">Username</label>
                <input type="text" id="accountUsername" name="username">
            </div>
            <div class="form-group nis-field">
                <label for="accountNis">NIS</label>
                <input type="text" id="accountNis" name="nis" required>
            </div>
            <div class="form-group kelas-field">
                <label for="accountClass">Kelas</label>
                <div class="hybrid-dropdown" id="class-hybrid-dropdown">
                     <input type="hidden" id="accountClass" name="kelas" required>
                     <button type="button" class="hybrid-dropdown__selected">
                        <span class="hybrid-dropdown__placeholder">Pilih atau buat kelas...</span>
                        <div class="hybrid-dropdown__value"></div>
                        <i class='bx bx-chevron-down hybrid-dropdown__arrow'></i>
                    </button>
                    <div class="hybrid-dropdown__options">
                        <!-- Opsi kelas dinamis dimuat di sini -->
                    </div>
                </div>
            </div>
            <div class="form-group">
                <label for="accountPassword">Password</label>
                <input type="password" id="accountPassword" name="password" required minlength="8">
                <small class="form-text">Minimal 8 karakter.</small>
            </div>
            <div class="modal-footer">
                <button type="button" class="btn btn-secondary close-modal-btn">Batal</button>
                <button type="submit" class="btn btn-primary">Simpan</button>
            </div>
        </form>
    `);
    
    const form = document.getElementById('accountForm');
    
    // Inisialisasi dropdown role
    setupModalDropdowns(form, (newRole) => {
        toggleAccountFields(newRole, form);
    });
    
    // Inisialisasi dropdown kelas yang baru
    initializeHybridDropdown(document.getElementById('class-hybrid-dropdown'));

    const initialRole = form.querySelector('#accountRole').value;
    toggleAccountFields(initialRole, form);
    
    form.addEventListener('submit', handleAccountFormSubmit);
};

export const showEditAccountModal = (account) => {
    openModal('Edit Akun', `
        <form id="accountForm" novalidate>
            <input type="hidden" name="id" value="${account.id}">
            <div class="form-group">
                <label for="accountRole">Role</label>
                <div class="custom-dropdown">
                    <input type="hidden" id="accountRole" name="role" value="${account.role}" required>
                    <button type="button" class="custom-dropdown__selected">
                        <span class="custom-dropdown__placeholder">Pilih Role</span>
                        <div class="custom-dropdown__value"></div>
                        <i class='bx bx-chevron-down custom-dropdown__arrow'></i>
                    </button>
                    <div class="custom-dropdown__options">
                        <div class="custom-dropdown__option" data-value="user" data-display="<span>User (Siswa)</span>"><span class="custom-dropdown__option-name">User (Siswa)</span></div>
                        <div class="custom-dropdown__option" data-value="admin" data-display="<span>Admin</span>"><span class="custom-dropdown__option-name">Admin</span></div>
                    </div>
                </div>
            </div>
            <div class="form-group">
                <label for="accountName">Nama Lengkap</label>
                <input type="text" id="accountName" name="nama" value="${account.nama || ''}" required>
            </div>
            <div class="form-group username-field" style="display: none;">
                <label for="accountUsername">Username</label>
                <input type="text" id="accountUsername" name="username" value="${account.username || ''}">
            </div>
            <div class="form-group nis-field">
                <label for="accountNis">NIS</label>
                <input type="text" id="accountNis" name="nis" value="${account.nis || ''}">
            </div>
            <div class="form-group kelas-field">
                <label for="accountClass">Kelas</label>
                <div class="hybrid-dropdown" id="class-hybrid-dropdown">
                     <input type="hidden" id="accountClass" name="kelas" value="${account.kelas || ''}">
                     <button type="button" class="hybrid-dropdown__selected">
                        <span class="hybrid-dropdown__placeholder">Pilih atau buat kelas...</span>
                        <div class="hybrid-dropdown__value"></div>
                        <i class='bx bx-chevron-down hybrid-dropdown__arrow'></i>
                    </button>
                    <div class="hybrid-dropdown__options">
                        <!-- Opsi kelas dinamis dimuat di sini -->
                    </div>
                </div>
            </div>
            <div class="form-group">
                <label for="accountPassword">Password Baru</label>
                <input type="password" id="accountPassword" name="password" minlength="8">
                <small class="form-text">Kosongkan jika tidak ingin mengubah password.</small>
            </div>
            <div class="modal-footer">
                <button type="button" class="btn btn-secondary close-modal-btn">Batal</button>
                <button type="submit" class="btn btn-primary">Update</button>
            </div>
        </form>
    `);

    const form = document.getElementById('accountForm');

    // Inisialisasi dropdown role
    setupModalDropdowns(form, (newRole) => {
        toggleAccountFields(newRole, form);
    });

    // Inisialisasi dropdown kelas yang baru
    initializeHybridDropdown(document.getElementById('class-hybrid-dropdown'));
    
    toggleAccountFields(account.role, form);
    
    form.addEventListener('submit', handleAccountFormSubmit);
};


export const showDeleteAccountModal = (account) => {
    openModal('Konfirmasi Hapus Akun', `
        <p class="modal-details">Anda yakin ingin menghapus akun:</p>
        <p><strong>${account.nama} (${account.role === 'admin' ? account.username : account.nis})</strong></p>
        <p class="modal-warning-text" style="text-align: left; margin-top: 1rem;">Tindakan ini tidak dapat diurungkan.</p>
        <div class="modal-footer">
            <button type="button" class="btn btn-secondary close-modal-btn">Batal</button>
            <button type="button" id="confirmDeleteAccountBtn" class="btn btn-danger">Ya, Hapus</button>
        </div>
    `);
    document.getElementById('confirmDeleteAccountBtn').onclick = () => handleDeleteAccount(account.id);
};

export const showDeleteMultipleAccountsModal = () => {
    const selectedIds = state.selectedAccounts;
    if (selectedIds.length === 0) return;

    openModal('Konfirmasi Hapus Akun', `
        <p class="modal-details">Anda yakin ingin menghapus <strong>${selectedIds.length} akun</strong> yang dipilih secara permanen?</p>
        <p class="modal-warning-text" style="text-align: left; margin-top: 1rem;">Tindakan ini tidak dapat diurungkan.</p>
        <div class="modal-footer">
            <button type="button" class="btn btn-secondary close-modal-btn">Batal</button>
            <button type="button" id="confirmDeleteMultipleAccountsBtn" class="btn btn-danger">Ya, Hapus</button>
        </div>
    `);

    document.getElementById('confirmDeleteMultipleAccountsBtn').onclick = () => handleDeleteMultipleAccounts(selectedIds);
};


export const showDateFilterModal = () => {
    let displayDate = state.selectedDate ? new Date(state.selectedDate) : new Date();
    let tempSelectedDate = state.selectedDate ? new Date(state.selectedDate) : null;

    const renderCalendar = () => {
        const year = displayDate.getFullYear();
        const month = displayDate.getMonth();
        const monthNames = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
        const weekdays = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
        
        const monthOptions = monthNames.map((m, i) => `<option value="${i}" ${i === month ? 'selected' : ''}>${m}</option>`).join('');
        
        const currentYear = new Date().getFullYear();
        let yearOptions = '';
        for (let y = currentYear - 5; y <= currentYear + 5; y++) {
            yearOptions += `<option value="${y}" ${y === year ? 'selected' : ''}>${y}</option>`;
        }

        const firstDay = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const today = new Date();

        let calendarGrid = '';
        for (let i = 0; i < firstDay; i++) {
            calendarGrid += `<div class="calendar-day is-empty"></div>`;
        }

        for (let day = 1; day <= daysInMonth; day++) {
            const thisDate = new Date(year, month, day);
            let classes = 'calendar-day';
            if (toLocalDateString(thisDate) === toLocalDateString(today)) classes += ' is-today';
            if (tempSelectedDate && toLocalDateString(thisDate) === toLocalDateString(tempSelectedDate)) classes += ' is-selected';
            calendarGrid += `<div class="${classes}" data-date="${thisDate.toISOString()}">${day}</div>`;
        }
        
        openModal('Filter Tanggal', `
            <div class="calendar-container">
                <div class="calendar-header">
                    <button class="calendar-header__nav" id="cal-prev"><i class='bx bx-chevron-left'></i></button>
                    <div class="calendar-header__title">
                        <select id="month-select" class="calendar-select">${monthOptions}</select>
                        <select id="year-select" class="calendar-select">${yearOptions}</select>
                    </div>
                    <button class="calendar-header__nav" id="cal-next"><i class='bx bx-chevron-right'></i></button>
                </div>
                <div class="calendar-grid">
                    ${weekdays.map(day => `<div class="calendar-weekday">${day}</div>`).join('')}
                    ${calendarGrid}
                </div>
            </div>
            <div class="modal-footer">
                <button type="button" class="btn btn-secondary close-modal-btn">Batal</button>
                <button type="button" class="btn btn-primary" id="applyDateFilterBtn">Terapkan</button>
            </div>
        `);
        
        document.getElementById('cal-prev').onclick = () => { displayDate.setMonth(month - 1); renderCalendar(); };
        document.getElementById('cal-next').onclick = () => { displayDate.setMonth(month + 1); renderCalendar(); };
        document.getElementById('month-select').onchange = (e) => { displayDate.setMonth(parseInt(e.target.value)); renderCalendar(); };
        document.getElementById('year-select').onchange = (e) => { displayDate.setFullYear(parseInt(e.target.value)); renderCalendar(); };
        
        document.querySelectorAll('.calendar-day:not(.is-empty)').forEach(el => {
            el.onclick = () => {
                tempSelectedDate = new Date(el.dataset.date);
                renderCalendar();
            };
        });
        
        document.getElementById('applyDateFilterBtn').onclick = () => {
            state.selectedDate = tempSelectedDate;
            updateFabFilterState();
            closeModal();
            
            const activePageId = document.querySelector('.page.active')?.id;
            if (activePageId === 'history') {
                fetchAndRenderHistory();
            } else if (activePageId === 'return') {
                renderReturns();
            }
        };
    };
    renderCalendar();
};

export const showBorrowSettingsModal = () => {
    const { startTime, endTime, isManuallyLocked } = state.borrowSettings;
    
    let lockButtonText, lockButtonClass, newLockState;

    if (isManuallyLocked) {
        // Jika saat ini terkunci manual, tombolnya untuk membuka.
        lockButtonText = 'Buka (Manual)';
        lockButtonClass = 'btn-success';
        newLockState = false;
    } else {
        // Jika tidak terkunci manual, tombolnya untuk mengunci.
        lockButtonText = 'Kunci (Manual)';
        lockButtonClass = 'btn-danger';
        newLockState = true;
    }

    openModal(`Pengaturan Aplikasi`, `
        <form id="borrowSettingsForm">
            <p style="padding-bottom: 2rem;">Atur jadwal kapan aplikasi dapat diakses oleh siswa.</p>
            <div class="form-group">
                <label for="startTime">Buka Mulai Jam</label>
                <input type="time" id="startTime" name="start_time" value="${startTime}" class="form-control" required>
            </div>
            <div class="form-group">
                <label for="endTime">Tutup Mulai Jam</label>
                <input type="time" id="endTime" name="end_time" value="${endTime}" class="form-control" required>
            </div>
            <div class="form-group">
                <button type="button" id="manualLockBtn" class="btn ${lockButtonClass} btn-block" style="margin: 0.2rem 0;">${lockButtonText}</button>
            </div>
            <div class="modal-footer">
                <button type="button" class="btn btn-secondary close-modal-btn">Batal</button>
                <button type="submit" class="btn btn-primary">Simpan</button>
            </div>
        </form>
    `);
    
    document.getElementById('borrowSettingsForm').addEventListener('submit', (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const submitButton = e.target.querySelector('button[type="submit"]');
        
        formData.append('action', 'update_settings');
        formData.append('csrf_token', csrfToken);
        
        submitButton.disabled = true;
        handleUpdateSettings(formData).finally(() => {
            submitButton.disabled = false;
        });
    });

    document.getElementById('manualLockBtn').addEventListener('click', (e) => {
        const formData = new FormData();
        
        // Menambahkan semua parameter yang diperlukan
        formData.append('is_locked', newLockState ? '1' : '0');
        formData.append('action', 'update_settings');
        formData.append('csrf_token', csrfToken);
        
        e.target.textContent = 'Memproses...';
        e.target.disabled = true;
        handleUpdateSettings(formData).finally(() => {
            // Biarkan polling yang memperbarui teks tombol
        });
    });
};

// Panggilan ke modal impor CSV
export const showImportHistoryModal = () => {
    showImportCsvModal('history');
};

export const showDesktopAppModal = () => {
    openModal('Unduh Aplikasi Desktop', `
        <p class="modal-details">Apakah Anda ingin mengunduh aplikasi desktop untuk pengalaman yang lebih baik?</p>
        <div class="modal-footer">
            <button type="button" class="btn btn-secondary close-modal-btn">Batal</button>
            <a href="https://tkjtools.skanesga.com/download/inventaristkj.exe" download class="btn btn-primary" style="text-decoration: none;" id="confirmDownloadBtn">Ya, Unduh</a>
        </div>
    `);

    document.getElementById('confirmDownloadBtn').addEventListener('click', () => {
        showNotification('Mengunduh aplikasi desktop...', 'success');
        closeModal();
    });
};

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
            return `<div class="${statusClass}">[${entry.time}] ${iconHTML}${entry.message}</div>`;
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
                 progressLog.innerHTML += `<div class="text-danger">[${new Date().toLocaleTimeString('id-ID')}] ✗ Error: ${errorMessage}</div>`;
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
        format = '<strong>Nama Barang, Jenis Barang, Jumlah, Link Gambar</strong>';
        templateName = 'template_impor_barang.csv';
        templateContent = "Nama Barang,Jenis Barang,Jumlah,Link Gambar\nRouter Cisco,Router,10,https://example.com/router.jpg\nKabel LAN 5m,Kabel,50,https://example.com/cable.jpg";
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
            if (file && (file.type === 'text/csv' || file.name.toLowerCase().endsWith('.csv'))) {
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

/**
 * Menginisialisasi dropdown hybrid yang dinamis untuk manajemen kelas.
 * @param {HTMLElement} dropdownEl - Elemen kontainer dari dropdown.
 */
export const initializeHybridDropdown = (dropdownEl) => {
    if (!dropdownEl) return;

    const selected = dropdownEl.querySelector('.hybrid-dropdown__selected');
    const optionsContainer = dropdownEl.querySelector('.hybrid-dropdown__options');
    const placeholder = dropdownEl.querySelector('.hybrid-dropdown__placeholder');
    const valueDisplay = dropdownEl.querySelector('.hybrid-dropdown__value');
    const hiddenInput = dropdownEl.querySelector('input[type="hidden"]');

    const closeDropdown = () => dropdownEl.classList.remove('is-open');

    const updateValue = (newValue) => {
        hiddenInput.value = newValue;
        if (newValue) {
            valueDisplay.textContent = newValue;
            valueDisplay.style.display = 'block';
            if(placeholder) placeholder.style.display = 'none';
        } else {
            valueDisplay.style.display = 'none';
            if(placeholder) placeholder.style.display = 'block';
        }
        closeDropdown();
    };

    const populateOptions = () => {
        optionsContainer.innerHTML = '';
        
        const createNewOpt = document.createElement('div');
        createNewOpt.className = 'hybrid-dropdown__option hybrid-dropdown__option--create';
        createNewOpt.innerHTML = `<i class='bx bx-plus-circle'></i><span>Buat Kelas Baru</span>`;
        
        createNewOpt.onclick = (e) => {
            e.stopPropagation(); // Mencegah form submit dan dropdown tertutup
            optionsContainer.innerHTML = `
                <div class="hybrid-dropdown__new-input-container">
                    <input type="text" placeholder="Contoh: X-RPL 1" class="hybrid-dropdown__new-input">
                    <button type="button" class="btn btn-primary hybrid-dropdown__save-btn"><i class='bx bx-check'></i></button>
                </div>`;
            
            const newInput = optionsContainer.querySelector('.hybrid-dropdown__new-input');
            const saveBtn = optionsContainer.querySelector('.hybrid-dropdown__save-btn');
            newInput.focus();

            const saveNewValue = async () => {
                const val = newInput.value.trim();
                if (val) {
                    const result = await addClass(val);
                    showNotification(result.message, result.status);
                    if (result.status === 'success') {
                        state.classes.push(result.data);
                        state.classes.sort((a, b) => a.name.localeCompare(b.name));
                        updateValue(val);
                    }
                }
            };
            newInput.onkeydown = (ev) => { if (ev.key === 'Enter') { ev.preventDefault(); saveNewValue(); } };
            saveBtn.onclick = (e_save) => {
                e_save.stopPropagation(); // Mencegah form submit
                saveNewValue();
            };
        };
        optionsContainer.appendChild(createNewOpt);

        state.classes.forEach(c => {
            const opt = document.createElement('div');
            opt.className = 'hybrid-dropdown__option';
            opt.dataset.id = c.id;
            opt.innerHTML = `
                <span class="option-name">${c.name}</span>
                <div class="hybrid-dropdown__option-actions">
                    <button type="button" class="hybrid-dropdown__action-btn edit" title="Edit"><i class='bx bxs-pencil'></i></button>
                    <button type="button" class="hybrid-dropdown__action-btn delete" title="Hapus"><i class='bx bxs-trash'></i></button>
                </div>`;
            
            opt.addEventListener('click', (e) => {
                if (!e.target.closest('.hybrid-dropdown__action-btn')) {
                    updateValue(c.name);
                }
            });

            optionsContainer.appendChild(opt);
        });
    };

    optionsContainer.addEventListener('click', async (e) => {
        const editBtn = e.target.closest('.hybrid-dropdown__action-btn.edit');
        const deleteBtn = e.target.closest('.hybrid-dropdown__action-btn.delete');
        
        if (editBtn) {
            e.stopPropagation(); // Mencegah form submit dan dropdown tertutup
            const optionEl = editBtn.closest('.hybrid-dropdown__option');
            const classId = optionEl.dataset.id;
            const currentName = optionEl.querySelector('.option-name').textContent;
            
            optionEl.innerHTML = `
                <div class="hybrid-dropdown__new-input-container" style="width:100%">
                    <input type="text" class="hybrid-dropdown__new-input" value="${currentName}">
                    <button type="button" class="btn btn-primary hybrid-dropdown__save-btn"><i class='bx bx-check'></i></button>
                </div>`;
            
            optionEl.querySelector('.hybrid-dropdown__new-input-container').addEventListener('click', e_input => e_input.stopPropagation());

            const input = optionEl.querySelector('input');
            input.focus();
            input.select();
            
            const saveEdit = async () => {
                const newName = input.value.trim();
                if (newName && newName !== currentName) {
                    const result = await editClass(classId, newName);
                    showNotification(result.message, result.status);
                    if (result.status === 'success') {
                        const classIndex = state.classes.findIndex(cls => cls.id == classId);
                        if(classIndex > -1) state.classes[classIndex].name = newName;
                        state.classes.sort((a, b) => a.name.localeCompare(b.name));
                        if (hiddenInput.value === currentName) {
                            updateValue(newName);
                        }
                    }
                }
                populateOptions();
            };
            
            input.onblur = saveEdit;
            input.onkeydown = (ev) => { if (ev.key === 'Enter') { ev.preventDefault(); ev.target.blur(); } };
            optionEl.querySelector('.hybrid-dropdown__save-btn').onclick = (e_save_edit) => {
                e_save_edit.stopPropagation();
                input.blur();
            };
        }

        if (deleteBtn) {
            e.stopPropagation();
            const optionEl = deleteBtn.closest('.hybrid-dropdown__option');
            const classId = optionEl.dataset.id;
            const className = optionEl.querySelector('.option-name').textContent;
            
            showConfirmModal(
                'Konfirmasi Hapus Kelas',
                `Anda yakin ingin menghapus kelas "<strong>${className}</strong>"?
                <p class="modal-warning-text" style="text-align: left;">Tindakan ini juga akan menghapus referensi kelas ini dari semua pengguna, peminjaman aktif, dan riwayat.</p>`,
                async () => {
                    const result = await deleteClass(classId);
                    showNotification(result.message, result.status);
                    if (result.status === 'success') {
                        state.classes = state.classes.filter(cls => cls.id != classId);
                        populateOptions();
                        if (hiddenInput.value === className) {
                            updateValue('');
                        }
                    }
                }
            );
        }
    });

    selected.onclick = (e) => {
        e.stopPropagation();
        if (!dropdownEl.classList.contains('is-open')) {
            populateOptions();
        }
        dropdownEl.classList.toggle('is-open');
    };

    if (hiddenInput.value) {
        updateValue(hiddenInput.value);
    }
    
    document.addEventListener('click', (event) => {
        if (!dropdownEl.contains(event.target)) {
            closeDropdown();
        }
    }, true);
};