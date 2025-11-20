import { state } from '../state.js';
import { openModal, escapeHTML } from '../utils.js';
import { handleItemFormSubmit } from '../api.js';
import { setupImageUploader } from '../helpers/imageUploader.js';

// --- Menampilkan Modal QR Code ---
const showQrCodeModal = (itemCode, itemName) => {
    // URL CDN untuk generate QR Code
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(itemCode)}&margin=10`;

    const overlay = document.createElement('div');
    overlay.className = 'qr-modal-overlay';
    
    overlay.innerHTML = `
        <div class="qr-modal-content">
            <div class="qr-modal-header">
                ${escapeHTML(itemName)}
            </div>
            <div class="qr-image-wrapper">
                <img src="${qrUrl}" alt="QR Code ${itemCode}">
            </div>
            <div style="font-family: monospace; font-size: 0.9rem; color: var(--text-color-light); margin-top: -0.5rem;">
                ${escapeHTML(itemCode)}
            </div>
            <div style="display: flex; gap: 0.5rem;">
                <button type="button" class="btn btn-secondary btn-block close-qr-btn">Tutup</button>
                <button type="button" class="btn btn-primary btn-block download-qr-btn">
                    <i class='bx bxs-download'></i> Simpan
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(overlay);

    // Logika Tutup Modal
    const close = () => overlay.remove();
    overlay.querySelector('.close-qr-btn').onclick = close;
    overlay.onclick = (e) => { if (e.target === overlay) close(); };

    // Logika Download
    overlay.querySelector('.download-qr-btn').onclick = async (e) => {
        const btn = e.currentTarget;
        const originalContent = btn.innerHTML;
        btn.innerHTML = `<div class="loading-spinner" style="width: 15px; height: 15px; border-width: 2px;"></div>`;
        btn.disabled = true;

        try {
            const response = await fetch(qrUrl);
            const blob = await response.blob();
            const url = URL.createObjectURL(blob);
            
            const a = document.createElement('a');
            a.href = url;
            a.download = `QR_${itemName}.png`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
            close();
        } catch (err) {
            console.error('Gagal download QR:', err);
            alert('Gagal mengunduh gambar. Periksa koneksi internet.');
            btn.innerHTML = originalContent;
            btn.disabled = false;
        }
    };
};

export const showItemModal = (id = null) => {
    const isEdit = id !== null;
    const item = isEdit ? state.items.find(i => i.id == id) : {};
    if (isEdit && !item) return;

    const itemCodeField = isEdit ? `
        <div class="form-group">
            <label>Kode Barang (QR)</label>
            <div style="position: relative;">
                <input type="text" value="${escapeHTML(item.item_code || 'Belum ada kode')}" readonly style="background-color: var(--secondary-color); padding-right: 40px; color: var(--text-color-light); font-family: monospace; letter-spacing: 1px;">
                <i class='bx bx-qr qr-btn-trigger' 
                   data-code="${escapeHTML(item.item_code)}" 
                   data-name="${escapeHTML(item.name)}" 
                   title="Klik untuk lihat QR Code" 
                   style="position: absolute; right: 12px; top: 50%; transform: translateY(-50%); color: var(--text-color-light); font-size: 1.4rem;"></i>
            </div>
            <small class="form-text">Klik ikon QR untuk melihat.</small>
        </div>
    ` : '';

    openModal(isEdit ? 'Edit Barang' : 'Barang Baru', `
        <form id="itemForm">
            <input type="hidden" name="id" value="${escapeHTML(item.id || '')}">
            <input type="hidden" name="classifier" id="classifierValue" value="${escapeHTML(item.classifier || '')}">
            <div class="form-group">
                <label for="itemName">Nama Barang</label>
                <input type="text" id="itemName" name="name" value="${escapeHTML(item.name || '')}" required>
            </div>
            <div class="form-group">
                <label for="itemClassifierBtn">Jenis Alat</label>
                <div class="hybrid-dropdown">
                    <button type="button" class="hybrid-dropdown__selected" id="itemClassifierBtn">
                        <span class="hybrid-dropdown__placeholder">Pilih atau buat jenis baru...</span>
                        <div class="hybrid-dropdown__value"></div>
                        <i class='bx bx-chevron-down hybrid-dropdown__arrow'></i>
                    </button>
                    <div class="hybrid-dropdown__options">
                        <!-- Options are populated by JS -->
                    </div>
                </div>
            </div>
            ${itemCodeField}
            <div class="form-group">
                <label for="itemQuantity">Jumlah Total</label>
                <input type="number" id="itemQuantity" name="total_quantity" min="1" value="${escapeHTML(item.total_quantity || '')}" required>
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

    if (isEdit) {
        const qrBtn = document.querySelector('.qr-btn-trigger');
        if (qrBtn) {
            qrBtn.addEventListener('click', () => {
                const code = qrBtn.dataset.code;
                const name = qrBtn.dataset.name;
                if (code && code !== 'Belum ada kode') {
                    showQrCodeModal(code, name);
                } else {
                    alert('Kode barang belum tersedia.');
                }
            });
        }
    }
    
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