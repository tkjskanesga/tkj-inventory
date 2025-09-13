import { state, API_URL } from './state.js';
import { openModal, closeModal, toLocalDateString } from './utils.js';
import { handleItemFormSubmit, handleReturnFormSubmit, handleDeleteItem, handleFlushHistoryFormSubmit, handleAccountUpdateSubmit, fetchAndRenderHistory, handleDeleteHistoryItem } from './api.js';
import { renderReturns } from './render.js';
import { updateFabFilterState } from './ui.js';

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
            <div class="form-group"><label for="itemName">Nama Barang</label><input type="text" id="itemName" name="name" value="${item.name || ''}" required></div>
            <div class="form-group"><label for="itemQuantity">Jumlah Total</label><input type="number" id="itemQuantity" name="total_quantity" min="1" value="${item.total_quantity || ''}" required></div>
            <div class="form-group"><label for="itemImage">${isEdit ? 'Ganti Gambar (Opsional)' : 'Gambar Barang'}</label><div class="image-uploader"><input type="file" id="itemImage" name="image" accept="image/*" hidden><div class="image-uploader__prompt"><i class="bx bx-upload"></i><p>Seret & lepas gambar, atau klik</p></div><img src="#" alt="Pratinjau" class="image-uploader__preview"></div></div>
            <div class="modal-footer">
                <button type="button" class="btn btn-secondary close-modal-btn">Batal</button>
                <button type="submit" class="btn btn-primary">
                    <span class="btn__text">${isEdit ? 'Update' : 'Simpan'}</span>
                    <div class="btn__progress"></div>
                </button>
            </div>
        </form>`);
    
    document.getElementById('itemForm').addEventListener('submit', handleItemFormSubmit);
    setupImageUploader(document.querySelector('.image-uploader'));
};

export const showDeleteItemModal = (id) => {
    const item = state.items.find(i => i.id == id);
    if (!item) return;
    openModal('Konfirmasi Hapus', `
        <p class="modal-details">Anda yakin ingin menghapus <strong>${item.name}</strong>?</p>
        <div class="modal-footer"><button type="button" class="btn btn-secondary close-modal-btn">Batal</button><button type="button" id="confirmDeleteBtn" class="btn btn-danger">Ya, Hapus</button></div>`);
    document.getElementById('confirmDeleteBtn').onclick = () => handleDeleteItem(id);
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

export const showReturnModal = (id) => {
    const borrowal = state.borrowals.find(b => b.id == id);
    if (!borrowal) return;

    openModal(`Pengembalian`, `
        <form id="returnForm">
            <input type="hidden" name="borrowal_id" value="${borrowal.id}">
            <p>Mengembalikan <strong>${borrowal.quantity} ${borrowal.item_name}</strong> (Peminjam: ${borrowal.borrower_name}).</p><br>
            <div class="form-group">
                <label>Bukti Pengembalian</label>
                <input type="file" id="returnProofGallery" name="proof_image" accept="image/*" hidden>
                <input type="file" id="returnProofCamera" name="proof_image" accept="image/*" capture="environment" hidden>
                
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
            galleryInput.files = e.dataTransfer.files;
            showPreview(e.dataTransfer.files[0]);
        }
    });

    takePictureBtn.addEventListener('click', () => cameraInput.click());

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
        if (!galleryInput.files[0] && !cameraInput.files[0]) {
            fileError.style.display = 'block';
            return;
        }

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
            <p><strong>PERINGATAN:</strong> Tindakan ini akan menghapus semua riwayat dan file bukti secara permanen.</p>
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
    openModal(`<i class='bx bxs-user-cog'></i> Pengaturan Akun`, `
        <form id="accountForm">
            <div class="form-group">
                <label for="accountUsername">Username</label>
                <input type="text" id="accountUsername" name="username" value="${state.session.username}" required>
            </div>
            <div class="form-group">
                <label for="accountPassword">Password Baru (Opsional)</label>
                <input type="password" id="accountPassword" name="password" placeholder="Kosongkan jika tidak ingin ganti">
                <small class="form-text">Minimal 8 karakter jika ingin mengganti.</small>
            </div>
            <div class="modal-footer">
                <button type="button" class="btn btn-secondary close-modal-btn">Batal</button>
                <button type="submit" class="btn btn-primary">Update</button>
            </div>
        </form>
    `);

    document.getElementById('accountForm').addEventListener('submit', handleAccountUpdateSubmit);
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
        
        openModal('Pilih Tanggal Filter', `
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
