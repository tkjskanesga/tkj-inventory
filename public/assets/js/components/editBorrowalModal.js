import { state } from '../state.js';
import { openModal, escapeHTML } from '../utils.js';
import { handleEditBorrowalSubmit } from '../api.js';

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

        const escapedImgUrl = escapeHTML(item.image_url || '[https://placehold.co/40x40/8ab4f8/ffffff?text=](https://placehold.co/40x40/8ab4f8/ffffff?text=)?');
        const escapedName = escapeHTML(item.name);
    
        return `
        <div class="custom-dropdown__option" data-value="${escapeHTML(item.id)}" data-max="${escapeHTML(maxStock)}" data-display="<img src='${escapedImgUrl}' alt='${escapedName}'><span>${escapedName}</span>">
            <img src="${escapedImgUrl}" alt="${escapedName}" class="custom-dropdown__option-img">
            <div class="custom-dropdown__option-info">
                <span class="custom-dropdown__option-name">${escapedName}</span>
                <span class="custom-dropdown__option-qty">Sisa: ${escapeHTML(item.current_quantity)}</span>
            </div>
        </div>`;
    }).join('');

    const currentItem = state.items.find(i => i.id == borrowal.item_id);
    const initialMax = currentItem ? currentItem.current_quantity + borrowal.quantity : borrowal.quantity;
    const initialItemDisplay = currentItem 
        ? `<img src='${escapeHTML(currentItem.image_url || 'https://placehold.co/40x40/8ab4f8/ffffff?text=?')}' alt='${escapeHTML(currentItem.name)}'><span>${escapeHTML(currentItem.name)}</span>`  
        : '<span>Barang tidak ditemukan</span>';

    openModal(`Ubah Peminjaman`, `
        <form id="editBorrowalForm">
            <input type="hidden" name="borrowal_id" value="${borrowal.id}">
            <p class="modal-warning-text" style="text-align: left;"><strong>PERINGATAN:</strong> Tindakan ini akan mengubah data peminjaman dan stok barang secara langsung.</p>
            <div class="form-group">
                <label>Nama Peminjam</label>
                <input type="text" value="${escapeHTML(borrowal.borrower_name)} (${escapeHTML(borrowal.borrower_class)})" readonly>
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
                <input type="number" id="newQuantity" name="new_quantity" min="1" max="${escapeHTML(initialMax)}" value="${escapeHTML(borrowal.quantity)}" required>
                <small class="form-text max-quantity-hint">Maksimal pinjam: ${escapeHTML(initialMax)}</small>
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