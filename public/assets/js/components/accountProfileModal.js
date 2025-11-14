import { state } from '../state.js';
import { openModal, escapeHTML } from '../utils.js';
import { handleAccountUpdateSubmit } from '../api.js';

/**
 * Menampilkan modal untuk pengguna mengedit kredensial mereka sendiri.
 */
export const showAccountModal = () => {
    const isAdmin = state.session.role === 'admin';
    const displayName = state.session.username || ''; // Ini adalah 'nama'
    const loginName = state.session.login_username || ''; // Ini adalah 'username' untuk admin, 'nis' untuk user
    const usernameLabel = isAdmin ? 'Username' : 'Username (NIS)';

    openModal(`<i class='bx bxs-user-cog'></i> Pengaturan Akun`, `
        <form id="accountForm">
            <div class="form-group">
                <label for="accountName">Nama</label>
                <input type="text" id="accountName" name="nama" value="${escapeHTML(displayName)}" ${isAdmin ? 'required' : 'readonly'}>
            </div>
            <div class="form-group">
                <label for="accountUsername">${usernameLabel}</label>
                <input type="text" id="accountUsername" name="username" value="${escapeHTML(loginName)}" ${isAdmin ? 'required' : 'readonly'}>
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