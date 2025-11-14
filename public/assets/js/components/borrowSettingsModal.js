import { state, csrfToken } from '../state.js';
import { openModal } from '../utils.js';
import { handleUpdateSettings } from '../api.js';

/**
 * Menampilkan modal untuk admin mengatur jam buka/tutup dan kunci manual.
 */
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
        
        formData.append('is_locked', newLockState ? '1' : '0');
        formData.append('action', 'update_settings');
        formData.append('csrf_token', csrfToken);
        
        e.target.textContent = 'Memproses...';
        e.target.disabled = true;
        handleUpdateSettings(formData).finally(() => {
        });
    });
};