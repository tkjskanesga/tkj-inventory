import { state } from '../state.js';
import { openModal, escapeHTML } from '../utils.js';
import { handleAddItemFormSubmit } from '../api.js';

export const showAddItemModal = (transactionId) => {
    const existingBorrowals = state.borrowals.filter(b => b.transaction_id === transactionId);
    if (existingBorrowals.length === 0) return;

    const borrowerInfo = existingBorrowals[0];

    // Buat daftar item yang sudah dipinjam (read-only)
    const existingItemsHTML = existingBorrowals.map(item => `
        <li class="transaction-group__item" style="padding: 0.75rem 0;">
            <img src="${escapeHTML(item.image_url || 'https://placehold.co/50x50/8ab4f8/ffffff?text=?')}" alt="${escapeHTML(item.item_name)}" class="transaction-group__item-img">
            <div class="transaction-group__item-details">
                <div class="transaction-group__item-name">${escapeHTML(item.item_name)}</div>
                <div class="transaction-group__item-qty">Jumlah: ${escapeHTML(item.quantity)} pcs</div>
            </div>
        </li>
    `).join('');

    openModal(`Tambah Alat`, `
        <div class="form-group">
            <label>Peminjam</label>
            <input type="text" value="${escapeHTML(borrowerInfo.borrower_name)} (${escapeHTML(borrowerInfo.borrower_class)})" readonly>
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