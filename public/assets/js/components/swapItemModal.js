import { state } from '../state.js';
import { openModal, escapeHTML } from '../utils.js';
import { handleSwapItemSubmit } from '../api.js';

export const showSwapItemModal = (borrowalId) => {
    const borrowal = state.borrowals.find(b => b.id == borrowalId);
    if (!borrowal) return;

    // Ambil data lengkap barang yang sedang dipinjam
    const currentItem = state.items.find(i => i.id == borrowal.item_id);
    const currentClassifier = currentItem ? currentItem.classifier : null;

    // Filter Barang Pengganti (Sama ID atau Sama Jenis, dan Stok Cukup)
    const relevantItems = state.items.filter(item => {
        const hasStock = item.current_quantity >= borrowal.quantity;
        const isSameItem = item.id == borrowal.item_id;
        const isSameClassifier = currentClassifier && item.classifier === currentClassifier;
        return hasStock && (isSameItem || isSameClassifier);
    });

    const itemOptionsHTML = relevantItems.map(item => {
        const isSame = item.id == borrowal.item_id;
        const labelSuffix = isSame ? ' (Barang Sama)' : '';
        
        return `
        <div class="custom-dropdown__option" data-value="${item.id}" data-display="<img src='${escapeHTML(item.image_url || 'assets/favicon/dummy.jpg')}' alt='${escapeHTML(item.name)}'><span>${escapeHTML(item.name)}</span>">
            <img src="${escapeHTML(item.image_url || 'assets/favicon/dummy.jpg')}" alt="${escapeHTML(item.name)}" class="custom-dropdown__option-img">
            <div class="custom-dropdown__option-info">
                <span class="custom-dropdown__option-name">${escapeHTML(item.name)} ${labelSuffix}</span>
                <span class="custom-dropdown__option-qty">Sisa: ${escapeHTML(item.current_quantity)}</span>
            </div>
        </div>
    `}).join('');

    const dropdownContent = itemOptionsHTML.length > 0 
        ? itemOptionsHTML 
        : '<div style="padding:1rem;text-align:center;color:var(--text-color-light);">Tidak ada barang pengganti sejenis yang tersedia.</div>';

    openModal(`Tukar Barang`, `
        <form id="swapItemForm">
            <input type="hidden" name="borrowal_id" value="${borrowal.id}">
            
            <div class="form-group">
                <label>Barang (Akan Ditukar)</label>
                <div class="form-static-item-display">
                    <img src="${escapeHTML(borrowal.image_url || 'assets/favicon/dummy.jpg')}" alt="Item">
                    <span>${escapeHTML(borrowal.item_name)} (${borrowal.quantity} pcs)</span>
                </div>
            </div>

            <div class="form-group">
                <label>Kondisi Saat Ini</label>
                <div class="custom-dropdown" id="conditionDropdown">
                    <input type="hidden" id="swapCondition" name="condition" value="good" required>
                    <button type="button" class="custom-dropdown__selected">
                        <span class="custom-dropdown__value" style="display: block;">Normal (Hanya Tukar)</span>
                        <span class="custom-dropdown__placeholder" style="display: none;">Pilih Kondisi</span>
                        <i class='bx bx-chevron-down custom-dropdown__arrow'></i>
                    </button>
                    <div class="custom-dropdown__options">
                        <div class="custom-dropdown__option" data-value="good" data-display="Normal (Hanya Tukar)">
                            <span class="custom-dropdown__option-name">Normal (Hanya Tukar)</span>
                        </div>
                        <div class="custom-dropdown__option" data-value="bad" data-display="Rusak & Tukar">
                            <span class="custom-dropdown__option-name">Rusak & Tukar</span>
                        </div>
                    </div>
                </div>
            </div>

            <div class="form-group" id="remarkField" style="display: none;">
                <label for="swapRemark">Kendala / Kerusakan</label>
                <input type="text" id="swapRemark" name="remark" class="form-control" placeholder="Contoh: Tidak Bisa Menyala..." autocomplete="off">
            </div>

            <div class="form-group">
                <label>Pilih Barang Pengganti</label>
                <div class="custom-dropdown" id="swapItemDropdown">
                    <input type="hidden" name="new_item_id" required>
                    <button type="button" class="custom-dropdown__selected">
                        <span class="custom-dropdown__placeholder">Barang Pengganti</span>
                        <div class="custom-dropdown__value"></div>
                        <i class='bx bx-chevron-down custom-dropdown__arrow'></i>
                    </button>
                    <div class="custom-dropdown__options">
                        ${dropdownContent}
                    </div>
                </div>
                <small class="form-text">Menampilkan barang yang sama atau sejenis.</small>
            </div>

            <div class="modal-footer">
                <button type="button" class="btn btn-secondary close-modal-btn">Batal</button>
                <button type="submit" class="btn btn-primary">Tukar Barang</button>
            </div>
        </form>
    `);

    const form = document.getElementById('swapItemForm');
    const conditionInput = document.getElementById('swapCondition');
    const remarkField = document.getElementById('remarkField');
    const remarkInput = document.getElementById('swapRemark');
    
    const conditionDropdown = document.getElementById('conditionDropdown');
    const condSelectedBtn = conditionDropdown.querySelector('.custom-dropdown__selected');
    const condOptions = conditionDropdown.querySelector('.custom-dropdown__options');
    
    condSelectedBtn.onclick = (e) => {
        e.stopPropagation();
        const itemDD = document.getElementById('swapItemDropdown');
        if (itemDD) itemDD.classList.remove('is-open');
        
        conditionDropdown.classList.toggle('is-open');
    };

    condOptions.onclick = (e) => {
        const option = e.target.closest('.custom-dropdown__option');
        if (!option) return;
        
        const val = option.dataset.value;
        conditionInput.value = val;
        
        // Update UI
        const displayEl = conditionDropdown.querySelector('.custom-dropdown__value');
        displayEl.textContent = option.dataset.display;
        
        conditionDropdown.classList.remove('is-open');

        // Tampilkan/Sembunyikan field Remark
        if (val === 'bad') {
            remarkField.style.display = 'block';
            remarkInput.required = true;
            remarkInput.focus();
        } else {
            remarkField.style.display = 'none';
            remarkInput.required = false;
            remarkInput.value = '';
        }
    };

    // Setup Dropdown Barang Pengganti
    const itemDropdown = document.getElementById('swapItemDropdown');
    if (itemOptionsHTML.length > 0) {
        const itemSelectedBtn = itemDropdown.querySelector('.custom-dropdown__selected');
        const itemOptions = itemDropdown.querySelector('.custom-dropdown__options');
        const itemHiddenInput = itemDropdown.querySelector('input[name="new_item_id"]');
        const itemPlaceholder = itemDropdown.querySelector('.custom-dropdown__placeholder');
        const itemValueDisplay = itemDropdown.querySelector('.custom-dropdown__value');

        itemSelectedBtn.onclick = (e) => {
            e.stopPropagation();
            conditionDropdown.classList.remove('is-open');
            itemDropdown.classList.toggle('is-open');
        };

        itemOptions.onclick = (e) => {
            const option = e.target.closest('.custom-dropdown__option');
            if (!option) return;
            
            itemHiddenInput.value = option.dataset.value;
            itemValueDisplay.innerHTML = option.dataset.display;
            itemValueDisplay.style.display = 'flex';
            itemPlaceholder.style.display = 'none';
            itemDropdown.classList.remove('is-open');            
            itemSelectedBtn.style.borderColor = '';
        };
    } else {
        itemDropdown.classList.add('is-disabled');
    }

    // Listener global untuk menutup dropdown saat klik di luar
    const modalBody = document.getElementById('modalBody');
    const outsideClickListener = (e) => {
        if (!e.target.closest('.custom-dropdown')) {
            conditionDropdown.classList.remove('is-open');
            itemDropdown.classList.remove('is-open');
        }
    };
    modalBody.addEventListener('click', outsideClickListener);

    form.addEventListener('submit', (e) => {
        e.preventDefault();
        const newItemId = form.querySelector('input[name="new_item_id"]').value;
        
        if (!newItemId) {
            const dropdownBtn = itemDropdown.querySelector('.custom-dropdown__selected');
            dropdownBtn.style.borderColor = 'var(--danger-color)';
            dropdownBtn.animate([
                { transform: 'translateX(0)' },
                { transform: 'translateX(-5px)' },
                { transform: 'translateX(5px)' },
                { transform: 'translateX(0)' }
            ], { duration: 300 });
            return;
        }

        handleSwapItemSubmit(e);
    });
};