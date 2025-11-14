import { openModal, closeModal, escapeHTML } from '../utils.js';
import { getAutoBackupConfig, saveAutoBackupConfig, clearAutoBackupStatus, getAutoBackupStatus } from '../api.js';
import { createStatusPoller } from '../helpers/progressUpdater.js';
import { setupModalDropdowns } from '../modals.js';

/**
 * Variabel global untuk menyimpan instance poller status auto-backup.
 */
let autoBackupPoller = null;

/**
 * Memperbarui UI modal Auto Backup berdasarkan data status dari server.
 * @param {object} data - Objek status auto-backup dari file status.
 */
export const updateAutoBackupModalUI = (data) => {
	const progressBar = document.getElementById('autoBackupProgressBar');
	const progressText = document.getElementById('autoBackupProgressText');
	const progressLog = document.getElementById('autoBackupProgressLog');
	const primaryCloseBtn = document.getElementById('primaryCloseAutoBackupBtn');
	const confirmationView = document.getElementById('autobackup-config-view');
	const progressView = document.getElementById('autobackup-progress-view');

	if (!progressView || !data) return;

	if (data.status === 'running' || data.status === 'complete' || data.status === 'error' || data.status === 'pending') {
		if (confirmationView) confirmationView.classList.add('is-hidden');
		if (progressView) progressView.classList.remove('is-hidden');
	}

	if (data.log && Array.isArray(data.log) && progressLog) {
		progressLog.innerHTML = data.log.map(entry => {
			const statusClass = entry.status === 'success' ? 'text-success' : (entry.status === 'error' ? 'text-danger' : '');
			const statusIcon = entry.status === 'success' ? '✓' : (entry.status === 'error' ? '✗' : '•');
			const iconHTML = entry.status === 'info' ? '' : `${statusIcon} `;

            let message = entry.message;
            let messageHTML = '';

            if (entry.status === 'success' && message.startsWith('Backup Selesai! URL: ')) {
                const url = message.substring(message.indexOf('URL: ') + 5);
                const text = `Backup Selesai!`;
                messageHTML = `${escapeHTML(text)} <a href="${escapeHTML(url)}" target="_blank" rel="noopener noreferrer" style="text-decoration: underline;">Lihat di Google Drive</a>`;
            } else {
                messageHTML = escapeHTML(message);
            }

			return `<div class="${statusClass}">[${entry.time}] ${iconHTML}${messageHTML}</div>`;
		}).join('');
		progressLog.scrollTop = progressLog.scrollHeight;
	}

	if (data.status === 'running' || data.status === 'pending') {
        const lastLog = data.log && data.log.length > 0 ? data.log[data.log.length - 1].message : 'Memulai...';
		if(progressText) progressText.textContent = lastLog;
		if(progressBar) progressBar.style.width = '50%'; // Indikator generik 'sedang berjalan'
	} else if (data.status === 'complete' || data.status === 'error') {
        if (autoBackupPoller) {
            autoBackupPoller.stop();
            autoBackupPoller = null;
        }
		if (data.status === 'complete') {
			if(progressText) progressText.textContent = 'Auto-Backup Selesai!';
			if(progressBar) progressBar.style.width = '100%';
			if(primaryCloseBtn) primaryCloseBtn.textContent = 'Selesai';
		} else {
			if(progressText) progressText.textContent = 'Auto-Backup Gagal!';
			if(primaryCloseBtn) primaryCloseBtn.textContent = 'Tutup';
		}
		if(primaryCloseBtn) {
			primaryCloseBtn.style.display = 'inline-flex';
			primaryCloseBtn.onclick = async () => {
                if (autoBackupPoller) {
                    autoBackupPoller.stop();
                    autoBackupPoller = null;
                }
				await clearAutoBackupStatus();
				closeModal();
			};
		}
	}
};

export const showAutoBackupModal = async (initialData = null) => {
    if (autoBackupPoller) {
        autoBackupPoller.stop();
        autoBackupPoller = null;
    }
	if (initialData) {
		openModal('Auto Backup', `
			<div id="autobackup-progress-view">
				<div class="progress-bar-container" style="margin: 1.5rem 0;">
					<div class="progress-bar-text" id="autoBackupProgressText" style="margin-bottom: 0.5rem; color: var(--text-color-light); font-size: 0.9rem;">...</div>                    
					<div class="progress-bar" style="background-color: var(--border-color); border-radius: 20px; overflow: hidden;">
						<div id="autoBackupProgressBar" class="progress-bar__fill" style="width: 0%; height: 15px; background-color: var(--primary-color); border-radius: 20px; transition: width 0.3s ease;"></div>
					</div>
				</div>
				<div class="progress-log" id="autoBackupProgressLog" style="background-color: var(--secondary-color); border-radius: var(--border-radius); padding: 1rem; height: 180px; overflow-y: auto; font-size: 0.8rem; line-height: 1.5;"></div>
			</div>
			<div class="modal-footer">
				<button type="button" id="primaryCloseAutoBackupBtn" class="btn btn-primary" style="display: none;">Selesai</button>
			</div>
		`);
		updateAutoBackupModalUI(initialData);
        if (initialData.status === 'running' || initialData.status === 'pending') {
            autoBackupPoller = createStatusPoller(getAutoBackupStatus, updateAutoBackupModalUI, 2000);
            autoBackupPoller.start();
        }
	} else {
		const configResult = await getAutoBackupConfig();
		const config = configResult.data || {};
		const isEnabled = config.autobackup_enabled == '1';
        const currentFrequency = config.autobackup_frequency || 'daily';
        const currentDay = config.autobackup_day || '1';

		openModal('Auto Backup', `
			<form id="autoBackupConfigForm">
				<div id="autobackup-config-view">
                    
					<div class="form-group form-group--toggle">
						<label for="autobackup_enabled">Aktifkan Auto-Backup</label>
						<div class="toggle-switch">
							<input type="checkbox" id="autobackup_enabled" name="autobackup_enabled" value="1" ${isEnabled ? 'checked' : ''}>
							<label for="autobackup_enabled"></label>
						</div>
					</div>

					<div id="autobackup_scheduler_fields" class="${isEnabled ? '' : 'is-hidden'}">
						
                        <!-- Dropdown Frekuensi (Kustom) -->
                        <div class="form-group">
							<label>Frekuensi</label>
                            <div class="custom-dropdown">
                                <input type="hidden" name="autobackup_frequency" value="${escapeHTML(currentFrequency)}">
                                <button type="button" class="custom-dropdown__selected">
                                    <span class="custom-dropdown__placeholder">Pilih Frekuensi</span>
                                    <div class="custom-dropdown__value"></div>
                                    <i class='bx bx-chevron-down custom-dropdown__arrow'></i>
                                </button>
                                <div class="custom-dropdown__options">
                                    <div class="custom-dropdown__option" data-value="daily" data-display="<span>Harian (Setiap Hari)</span>">
                                        <span class="custom-dropdown__option-name">Harian (Setiap Hari)</span>
                                    </div>
                                    <div class="custom-dropdown__option" data-value="weekly" data-display="<span>Mingguan</span>">
                                        <span class="custom-dropdown__option-name">Mingguan</span>
                                    </div>
                                    <div class="custom-dropdown__option" data-value="monthly" data-display="<span>Bulanan</span>">
                                        <span class="custom-dropdown__option-name">Bulanan</span>
                                    </div>
                                </div>
                            </div>
						</div>
						
                        <!-- Dropdown Hari (Mingguan) (Kustom) -->
                        <div class="form-group autobackup_day_weekly_field is-hidden">
							<label>Pilih Hari</label>
                            <div class="custom-dropdown">
                                <input type="hidden" name="autobackup_day_weekly" value="${escapeHTML(currentDay)}">
                                <button type="button" class="custom-dropdown__selected">
                                    <span class="custom-dropdown__placeholder">Pilih Hari</span>
                                    <div class="custom-dropdown__value"></div>
                                    <i class='bx bx-chevron-down custom-dropdown__arrow'></i>
                                </button>
                                <div class="custom-dropdown__options">
                                    <div class="custom-dropdown__option" data-value="1" data-display="<span>Senin</span>"><span class="custom-dropdown__option-name">Senin</span></div>
                                    <div class="custom-dropdown__option" data-value="2" data-display="<span>Selasa</span>"><span class="custom-dropdown__option-name">Selasa</span></div>
                                    <div class="custom-dropdown__option" data-value="3" data-display="<span>Rabu</span>"><span class="custom-dropdown__option-name">Rabu</span></div>
                                    <div class="custom-dropdown__option" data-value="4" data-display="<span>Kamis</span>"><span class="custom-dropdown__option-name">Kamis</span></div>
                                    <div class="custom-dropdown__option" data-value="5" data-display="<span>Jumat</span>"><span class="custom-dropdown__option-name">Jumat</span></div>
                                    <div class="custom-dropdown__option" data-value="6" data-display="<span>Sabtu</span>"><span class="custom-dropdown__option-name">Sabtu</span></div>
                                    <div class="custom-dropdown__option" data-value="7" data-display="<span>Minggu</span>"><span class="custom-dropdown__option-name">Minggu</span></div>
                                </div>
                            </div>
						</div>
						
                        <!-- Dropdown Tanggal (Bulanan) (Kustom) -->
                        <div class="form-group autobackup_day_monthly_field is-hidden">
							<label>Pilih Tanggal</label>
                            <div class="custom-dropdown">
                                <input type="hidden" name="autobackup_day_monthly" value="${escapeHTML(currentDay)}">
                                <button type="button" class="custom-dropdown__selected">
                                    <span class="custom-dropdown__placeholder">Pilih Tanggal</span>
                                    <div class="custom-dropdown__value"></div>
                                    <i class='bx bx-chevron-down custom-dropdown__arrow'></i>
                                </button>
                                <div class="custom-dropdown__options">
                                    ${[...Array(31).keys()].map(i => `
                                        <div class="custom-dropdown__option" data-value="${i+1}" data-display="<span>Tanggal ${i+1}</span>">
                                            <span class="custom-dropdown__option-name">Tanggal ${i+1}</span>
                                        </div>
                                    `).join('')}
                                </div>
                            </div>
						</div>

						<div class="form-group">
							<label for="autobackup_time">Waktu Backup (WIB)</label>
							<input type="time" id="autobackup_time" name="autobackup_time" value="${config.autobackup_time || '03:00'}" class="form-group input">
							<small class="form-text">Gunakan format 24 jam.</small>
						</div>
					</div>
				</div>
				<div class="modal-footer">
					<button type="button" class="btn btn-secondary close-modal-btn">Batal</button>
					<button type="submit" class="btn btn-primary">Simpan</button>
				</div>
			</form>
		`);

		const form = document.getElementById('autoBackupConfigForm');
		const schedulerFields = document.getElementById('autobackup_scheduler_fields');
		const enabledToggle = document.getElementById('autobackup_enabled');
        
        // Ambil referensi ke input tersembunyi
		const frequencyInput = form.querySelector('input[name="autobackup_frequency"]');
        // Menggunakan selector class baru
		const dayWeeklyField = form.querySelector('.autobackup_day_weekly_field');
		const dayMonthlyField = form.querySelector('.autobackup_day_monthly_field');

        /**
         * Mengatur tampilan field hari berdasarkan frekuensi yang dipilih.
         * @param {string} freqValue - Nilai dari dropdown frekuensi ('daily', 'weekly', 'monthly').
         */
		const toggleSchedulerFields = (freqValue) => {
			dayWeeklyField.classList.toggle('is-hidden', freqValue !== 'weekly');
			dayMonthlyField.classList.toggle('is-hidden', freqValue !== 'monthly');
		};

		enabledToggle.addEventListener('change', () => {
			schedulerFields.classList.toggle('is-hidden', !enabledToggle.checked);
		});

        // Inisialisasi semua custom dropdown di dalam form
        setupModalDropdowns(form, (newValue) => {
            const freqDropdown = form.querySelector('input[name="autobackup_frequency"]');
            if (freqDropdown && newValue === freqDropdown.value) {
                toggleSchedulerFields(newValue);
            }
        });

        // Tambahkan listener manual ke dropdown frekuensi untuk memicu toggle
        const frequencyDropdown = frequencyInput.closest('.custom-dropdown');
        if (frequencyDropdown) {
            frequencyDropdown.querySelector('.custom-dropdown__options').addEventListener('click', (e) => {
                const option = e.target.closest('.custom-dropdown__option');
                if (option && option.dataset.value) {
                    toggleSchedulerFields(option.dataset.value);
                }
            });
        }

        // Jalankan sekali saat memuat untuk mengatur tampilan awal
		toggleSchedulerFields(frequencyInput.value);

		form.addEventListener('submit', async (e) => {
			e.preventDefault();
			const formData = new FormData(form);
			if (!enabledToggle.checked) {
				formData.set('autobackup_enabled', '0');
			}
            
            // Ambil nilai frekuensi dari input tersembunyi
            const frequencyValue = formData.get('autobackup_frequency');

			if (frequencyValue === 'weekly') {
				formData.set('autobackup_day', form.querySelector('input[name="autobackup_day_weekly"]').value);
			} else if (frequencyValue === 'monthly') {
				formData.set('autobackup_day', form.querySelector('input[name="autobackup_day_monthly"]').value);
			} else {
				formData.set('autobackup_day', '1');
			}
            
			formData.delete('autobackup_day_weekly');
			formData.delete('autobackup_day_monthly');

			const result = await saveAutoBackupConfig(formData);
			if (result.status === 'success') {
				closeModal();
			}
		});
	}
};