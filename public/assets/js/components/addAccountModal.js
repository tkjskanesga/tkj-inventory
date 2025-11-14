import { openModal } from '../utils.js';
import { handleAccountFormSubmit } from '../account.js';
import { setupModalDropdowns, initializeHybridDropdown } from '../modals.js';
import { toggleAccountFields } from '../helpers/accountFormHelpers.js';

export const showAddAccountModal = () => {
    openModal('Tambah Akun Baru', `
        <form id="accountForm" novalidate>
            <div class="form-group">
                <label for="accountRoleBtn">Role</label>
                <div class="custom-dropdown">
                    <input type="hidden" id="accountRole" name="role" value="user" required>
                    <button type="button" class="custom-dropdown__selected" id="accountRoleBtn">
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
                <label for="accountClassBtn">Kelas</label>
                <div class="hybrid-dropdown" id="class-hybrid-dropdown">
                     <input type="hidden" id="accountClass" name="kelas" required>
                     <button type="button" class="hybrid-dropdown__selected" id="accountClassBtn">
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