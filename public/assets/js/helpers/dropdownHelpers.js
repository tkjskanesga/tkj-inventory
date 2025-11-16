import { state } from '../state.js';
import { showNotification, escapeHTML } from '../utils.js';
import { addClass, editClass, deleteClass } from '../api.js';
import { showConfirmModal } from '../components/confirmModal.js';

/**
 * Menginisialisasi semua dropdown kustom di dalam elemen modal yang diberikan.
 * @param {HTMLElement} modalElement - Elemen container dari modal (biasanya form).
 * @param {function(string): void} [onRoleChangeCallback] - Callback opsional yang dijalankan saat dropdown role berubah.
 */
export const setupModalDropdowns = (modalElement, onRoleChangeCallback) => {
    const dropdowns = modalElement.querySelectorAll('.custom-dropdown');

    dropdowns.forEach(dropdown => {
        const selectedBtn = dropdown.querySelector('.custom-dropdown__selected');
        const optionsContainer = dropdown.querySelector('.custom-dropdown__options');
        const hiddenInput = dropdown.querySelector('input[type="hidden"]');
        const valueDisplay = dropdown.querySelector('.custom-dropdown__value');
        const placeholder = dropdown.querySelector('.custom-dropdown__placeholder');

        const updateDisplay = (value) => {
            if (!optionsContainer) return; // Guard clause jika optionsContainer tidak ada
            const option = optionsContainer.querySelector(`.custom-dropdown__option[data-value="${value}"]`);
            if (value && option) {
                if (valueDisplay) {
                    valueDisplay.innerHTML = option.dataset.display || `<span>${option.textContent.trim()}</span>`;
                    valueDisplay.style.display = 'flex';
                }
                if (placeholder) placeholder.style.display = 'none';
            } else {
                if (valueDisplay) valueDisplay.style.display = 'none';
                if (placeholder) placeholder.style.display = 'block';
            }
        };
        
        // Atur tampilan awal berdasarkan nilai yang ada
        if (hiddenInput) {
            updateDisplay(hiddenInput.value);
        }

        if (selectedBtn) {
            selectedBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                // Tutup dropdown lain yang mungkin terbuka
                document.querySelectorAll('.custom-dropdown.is-open').forEach(otherDropdown => {
                    if (otherDropdown !== dropdown) {
                        otherDropdown.classList.remove('is-open');
                    }
                });
                dropdown.classList.toggle('is-open');
            });
        }

        if (optionsContainer) {
            optionsContainer.addEventListener('click', (e) => {
                const option = e.target.closest('.custom-dropdown__option');
                if (option) {
                    const newValue = option.dataset.value;
                    if (hiddenInput) {
                        hiddenInput.value = newValue;
                        updateDisplay(newValue);
                    }
                    dropdown.classList.remove('is-open');

                    // Jika dropdown ini adalah dropdown role, panggil callback
                    if (hiddenInput && hiddenInput.id === 'accountRole' && onRoleChangeCallback) {
                        onRoleChangeCallback(newValue);
                    }
                }
            });
        }
    });

    // Menutup dropdown jika klik di luar
    document.addEventListener('click', function(event) {
        if (modalElement && !modalElement.contains(event.target)) {
            dropdowns.forEach(d => d.classList.remove('is-open'));
        }
    }, { once: true });
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
        if (hiddenInput) hiddenInput.value = newValue;
        if (newValue) {
            if (valueDisplay) {
                valueDisplay.textContent = newValue;
                valueDisplay.style.display = 'block';
            }
            if(placeholder) placeholder.style.display = 'none';
        } else {
            if (valueDisplay) {
                valueDisplay.style.display = 'none';
            }
            if(placeholder) placeholder.style.display = 'block';
        }
        closeDropdown();
    };

    const populateOptions = () => {
        if (!optionsContainer) return;
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
            if (newInput) newInput.focus();

            const saveNewValue = async () => {
                if (!newInput) return;
                const val = newInput.value.trim();
                if (val) {
                    const result = await addClass(val);
                    showNotification(result.message, result.status);
                    if (result.status === 'success') {
                        state.classes.push(result.data);
                        state.classes.sort((a, b) => a.name.localeCompare(b.name));
                        updateValue(val);
                        window.dispatchEvent(new Event('classDataChanged'));
                    }
                }
            };
            if (newInput) {
                newInput.onkeydown = (ev) => { if (ev.key === 'Enter') { ev.preventDefault(); saveNewValue(); } };
            }
            if (saveBtn) {
                saveBtn.onclick = (e_save) => {
                    e_save.stopPropagation(); // Mencegah form submit
                    saveNewValue();
                };
            }
        };
        optionsContainer.appendChild(createNewOpt);

        state.classes.forEach(c => {
            const opt = document.createElement('div');
            opt.className = 'hybrid-dropdown__option';
            opt.dataset.id = c.id;
            opt.innerHTML = `
                <span class="option-name">${escapeHTML(c.name)}</span>
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

    if (optionsContainer) {
        optionsContainer.addEventListener('click', async (e) => {
            const editBtn = e.target.closest('.hybrid-dropdown__action-btn.edit');
            const deleteBtn = e.target.closest('.hybrid-dropdown__action-btn.delete');
            
            if (editBtn) {
                e.stopPropagation(); // Mencegah form submit dan dropdown tertutup
                const optionEl = editBtn.closest('.hybrid-dropdown__option');
                if (!optionEl) return;
                const classId = optionEl.dataset.id;
                const nameEl = optionEl.querySelector('.option-name');
                if (!nameEl) return;
                const currentName = nameEl.textContent;
                
                optionEl.innerHTML = `
                    <div class="hybrid-dropdown__new-input-container" style="width:100%">
                        <input type="text" class="hybrid-dropdown__new-input" value="${escapeHTML(currentName)}">
                        <button type="button" class="btn btn-primary hybrid-dropdown__save-btn"><i class='bx bx-check'></i></button>
                    </div>`;
                
                const inputContainer = optionEl.querySelector('.hybrid-dropdown__new-input-container');
                if (inputContainer) {
                    inputContainer.addEventListener('click', e_input => e_input.stopPropagation());
                }

                const input = optionEl.querySelector('input');
                if (input) {
                    input.focus();
                    input.select();
                }
                
                const saveEdit = async () => {
                    if (!input) return;
                    const newName = input.value.trim();
                    if (newName && newName !== currentName) {
                        const result = await editClass(classId, newName);
                        showNotification(result.message, result.status);
                        if (result.status === 'success') {
                            const classIndex = state.classes.findIndex(cls => cls.id == classId);
                            if(classIndex > -1) state.classes[classIndex].name = newName;
                            state.classes.sort((a, b) => a.name.localeCompare(b.name));
                            if (hiddenInput && hiddenInput.value === currentName) {
                                updateValue(newName);
                            }
                            window.dispatchEvent(new Event('classDataChanged'));
                        }
                    }
                    populateOptions();
                };
                
                if (input) {
                    input.onblur = saveEdit;
                    input.onkeydown = (ev) => { if (ev.key === 'Enter') { ev.preventDefault(); ev.target.blur(); } };
                }
                const saveBtn = optionEl.querySelector('.hybrid-dropdown__save-btn');
                if (saveBtn) {
                    saveBtn.onclick = (e_save_edit) => {
                        e_save_edit.stopPropagation();
                        if (input) input.blur();
                    };
                }
            }

            if (deleteBtn) {
                e.stopPropagation();
                const optionEl = deleteBtn.closest('.hybrid-dropdown__option');
                if (!optionEl) return;
                const classId = optionEl.dataset.id;
                const nameEl = optionEl.querySelector('.option-name');
                if (!nameEl) return;
                const className = nameEl.textContent;
                
                showConfirmModal(
                    'Konfirmasi Hapus Kelas',
                    `Anda yakin ingin menghapus kelas <strong>${escapeHTML(className)}</strong>?
                    <p class="modal-warning-text" style="text-align: left;">Tindakan ini juga akan menghapus referensi kelas ini dari semua pengguna, peminjaman aktif, dan riwayat.</p>`,
                    async () => {
                        const result = await deleteClass(classId);
                        showNotification(result.message, result.status);
                        if (result.status === 'success') {
                            state.classes = state.classes.filter(cls => cls.id != classId);
                            populateOptions();
                            if (hiddenInput && hiddenInput.value === className) {
                                updateValue('');
                            }
                            window.dispatchEvent(new Event('classDataChanged'));
                        }
                    }
                );
            }
        });
    }

    if (selected) {
        selected.onclick = (e) => {
            e.stopPropagation();
            document.querySelectorAll('.hybrid-dropdown.is-open').forEach(d => {
                if (d !== dropdownEl) d.classList.remove('is-open');
            });
            if (!dropdownEl.classList.contains('is-open')) {
                populateOptions();
            }
            dropdownEl.classList.toggle('is-open');
        };
    }

    if (hiddenInput && hiddenInput.value) {
        updateValue(hiddenInput.value);
    }
    
    document.addEventListener('click', (event) => {
        if (!dropdownEl.contains(event.target)) {
            closeDropdown();
        }
    }, true);
};