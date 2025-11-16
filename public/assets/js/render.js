import { reconcileList } from './helpers/domReconciler.js';
import { state, API_URL } from './state.js';
import { createEmptyState, searchData, toLocalDateString, showNotification, escapeHTML } from './utils.js';
import { showImageViewer } from './components/imageViewer.js';
import { fetchAndRenderHistory, addClass } from './api.js';
import { showClassifierFilterModal } from './modals.js';
import { updateClearFilterFabVisibility, updateFilterButtonState } from './ui.js';


// Renders data menjadi HTML.
const stockGrid = document.getElementById('stockGrid');
const returnGrid = document.getElementById('returnGrid');
const historyGrid = document.getElementById('historyGrid');
const exportHistoryBtn = document.getElementById('exportHistoryBtn');
const flushHistoryBtn = document.getElementById('flushHistoryBtn');
const historyLoaderContainer = document.getElementById('historyLoaderContainer');

// --- State Lokal untuk Form Peminjaman ---
let borrowItemRows = [];
let itemRowCounter = 0;

// Fungsi untuk memformat tanggal menjadi format "Hari, DD/MM/YYYY"
const formatDateForSeparator = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    if (isNaN(date)) return '';
    
    const options = { weekday: 'long', day: 'numeric', month: 'numeric', year: 'numeric' };
    return new Intl.DateTimeFormat('id-ID', options).format(date);
};

const createDateSeparatorHTML = (dateString) => {
    return `
    <div class="date-separator">
        <span class="date-separator__badge">${escapeHTML(formatDateForSeparator(dateString))}</span>
    </div>`;
};

// Fungsi untuk membuat HTML dari satu item kartu
const createCardHTML = (item) => {
    const isAdmin = state.session.role === 'admin';
    const isBorrowingDisabled = !isAdmin && state.borrowSettings.isAppLocked;
    const isOutOfStock = item.current_quantity <= 0;
    const isBorrowed = item.current_quantity < item.total_quantity;
    const isSelected = state.selectedItems.includes(item.id.toString());
    const stockClass = isOutOfStock ? 'text-danger' : '';
    const imageUrl = item.image_url || `https://placehold.co/600x400/8ab4f8/ffffff?text=${encodeURIComponent(item.name)}`;
    
    const adminActionsHTML = isAdmin ? `
        <div class="card__image-overlay-actions">
            <button class="card__action-btn edit" data-id="${item.id}" ${isBorrowed ? 'disabled title="Tidak bisa edit barang yang dipinjam"' : 'title="Edit"'}><i class='bx bxs-pencil'></i></button>
            <button class="card__action-btn delete" data-id="${item.id}" ${isBorrowed ? 'disabled title="Tidak bisa hapus barang yang dipinjam"' : 'title="Hapus"'}><i class='bx bxs-trash-alt'></i></button>
        </div>` : '';

    const borrowShortcutHTML = !isOutOfStock ? `
        <div class="card__borrow-action-container">
            <button class="card__action-btn borrow-shortcut" 
                    data-id="${item.id}" 
                    title="${isBorrowingDisabled ? 'Peminjaman sedang ditutup' : 'Pinjam Barang Ini'}" 
                    ${isBorrowingDisabled ? 'disabled' : ''}>
                <i class='bx bx-right-arrow-alt'></i>
            </button>
        </div>` : '';

    const classifierHTML = item.classifier
        ? `<span class="card__classifier-chip">${escapeHTML(item.classifier)}</span>`
        : '';
        
    const outOfStockBadge = isOutOfStock ? `<div class="card__out-of-stock-badge">Kosong</div>` : '';
    
    return `
    <div class="card ${isOutOfStock ? 'is-out-of-stock' : ''} ${isSelected ? 'is-selected' : ''}" data-item-id="${item.id}">
        <div class="card__image-container">
            <!-- [MODIFIKASI] Hapus data-src dan class 'lazy', gunakan 'src' langsung dengan loading='lazy' -->
            <img src="${escapeHTML(imageUrl)}" alt="${escapeHTML(item.name)}" class="card__image" loading="lazy">
            ${outOfStockBadge}
            ${classifierHTML}
            ${adminActionsHTML}
            <div class="card__bottom-actions">
                <div class="card__selection-icon">
                    <i class='bx bxs-check-circle'></i>
                </div>
                ${borrowShortcutHTML}
            </div>
        </div>
        <div class="card__body">
            <h3 class="card__title" title="${escapeHTML(item.name)}">${escapeHTML(item.name)}</h3>
            <div class="card__info">
                <span>Tersedia: <strong class="${stockClass}">${escapeHTML(item.current_quantity)}</strong></span>
                <span class="card__quantity-chip">Total: ${escapeHTML(item.total_quantity)}</span>
            </div>
        </div>
    </div>`;
};

export const filterStock = () => {
    const searchTerm = document.getElementById('stockSearch').value.toLowerCase();

    let filteredData = state.items;

    // Terapkan filter jenis barang JIKA aktif
    if (state.currentStockFilter === 'classifier' && state.currentClassifierFilter) {
        filteredData = filteredData.filter(item => item.classifier === state.currentClassifierFilter);
    }

    // Terapkan filter ketersediaan JIKA aktif (bukan 'all' atau 'classifier')
    if (state.currentStockFilter === 'available') {
        filteredData = filteredData.filter(item => item.current_quantity > 0);
    } else if (state.currentStockFilter === 'empty') {
        filteredData = filteredData.filter(item => item.current_quantity <= 0);
    }

    // Terapkan filter pencarian
    if (searchTerm) {
        filteredData = searchData(filteredData, searchTerm, ['name', 'classifier']);
    }

    if (!stockGrid) return;

    const emptyStateElement = stockGrid.querySelector('.empty-state');
    if (emptyStateElement) {
        emptyStateElement.remove();
    }

    reconcileList(
        stockGrid,
        filteredData,
        createCardHTML,
        'id',
        'itemId',
        '.card'
    );

    if (filteredData.length === 0 && !stockGrid.querySelector('.empty-state')) {
        const message = state.items.length > 0 ? 'Barang tidak ditemukan.' : 'Belum ada barang di inventaris.';
        stockGrid.insertAdjacentHTML('beforeend', createEmptyState('Stok tidak ditemukan', message));
    }

    updateClearFilterFabVisibility();
};

export const initializeStockPage = () => {
    if (!stockGrid) return;

    stockGrid.innerHTML = '';

    if (state.items.length === 0) {
        stockGrid.innerHTML = createEmptyState('Stok Kosong', 'Belum ada barang di inventaris.');
        return;
    }
    
    // Panggil filterStock untuk melakukan render awal
    filterStock();
};


const applyDateAndSearchFilters = (data, searchInputElement, searchFields, dateFields) => {
    let filteredData = data;
    if (state.selectedDate) {
        const filterDateStr = toLocalDateString(state.selectedDate);
        filteredData = filteredData.filter(item => 
            dateFields.some(field => toLocalDateString(item[field]) === filterDateStr)
        );
    }
    const searchTerm = searchInputElement.value;
    return searchData(filteredData, searchTerm, searchFields);
};


const createReturnTransactionGroupHTML = (group) => {
    const isAdmin = state.session.role === 'admin';
    const itemsHTML = group.items.map(item => {
        const imageUrl = item.image_url || `https://placehold.co/50x50/8ab4f8/ffffff?text=?`;
        
        const adminActions = isAdmin ? `
            <div class="list-item__actions" style="margin-left: auto; display: flex; gap: 0.5rem;">
                <button class="btn btn-success action-btn edit-borrowal-btn" data-id="${item.id}" title="Ubah Peminjaman">
                    <i class='bx bx-pencil'></i>
                </button>
                <button class="btn btn-danger action-btn delete-borrowal-btn" data-id="${item.id}" title="Hapus Item Peminjaman">
                    <i class='bx bx-trash'></i>
                </button>
            </div>
        ` : '';

        return `
            <li class="transaction-group__item">
                <img src="${escapeHTML(imageUrl)}" alt="${escapeHTML(item.item_name)}" class="transaction-group__item-img">
                <div class="transaction-group__item-details">
                    <div class="transaction-group__item-name">${escapeHTML(item.item_name)}</div>
                    <div class="transaction-group__item-qty">Jumlah: ${escapeHTML(item.quantity)} pcs</div>
                </div>
                ${adminActions}
            </li>`;
    }).join('');

    const actionButtons = `
        <div class="transaction-group__header-actions">
            <button class="btn btn-success add-item-btn" data-id="${group.transaction_id}">
                Tambah
            </button>
            <button class="btn btn-primary return-btn" data-id="${group.transaction_id}">
                Kembalikan
            </button>
        </div>
    `;

    return `
        <div class="transaction-group">
            <div class="transaction-group__header">
                <div class="transaction-group__borrower-info">
                    <strong>${escapeHTML(group.borrower_name)}</strong>
                    <span class="class">${escapeHTML(group.borrower_class)}</span>
                    <span class="subject">Tujuan (Mapel): ${escapeHTML(group.subject) || '-'}</span>
                     <small style="display: block; margin-top: 5px;">${new Date(group.borrow_date).toLocaleString('id-ID')}</small>
                </div>
                ${actionButtons}
            </div>
            <ul class="transaction-group__items">${itemsHTML}</ul>
        </div>`;
};


const createReturnDateGroupHTML = (dateGroup) => {
    const separatorHTML = createDateSeparatorHTML(dateGroup.date);
    const transactionsHTML = dateGroup.transactions.map(createReturnTransactionGroupHTML).join('');

    return `
    <div class="date-group" data-return-item-id="${escapeHTML(dateGroup.id)}">
        ${separatorHTML}
        ${transactionsHTML}
    </div>
    `;
};


export const renderReturns = () => {
    if (!returnGrid) return;
    const searchInput = document.getElementById('returnSearch');
    const filteredData = applyDateAndSearchFilters(
        state.borrowals,
        searchInput,
        ['borrower_name', 'borrower_class', 'item_name', 'subject'],
        ['borrow_date']
    );

    const emptyStateElement = returnGrid.querySelector('.empty-state');
    if (emptyStateElement) {
        emptyStateElement.remove();
    }

    if (filteredData.length === 0) {
        returnGrid.innerHTML = createEmptyState('Tidak Ada Peminjaman', 'Tidak ada data yang cocok dengan filter.');
        return;
    }

    const groupedByTransaction = filteredData.reduce((acc, b) => {
        const key = b.transaction_id || `single-${b.id}`;
        if (!acc[key]) {
            acc[key] = {
                items: [],
                borrower_name: b.borrower_name,
                borrower_class: b.borrower_class,
                subject: b.subject,
                borrow_date: b.borrow_date,
                transaction_id: b.transaction_id
            };
        }
        acc[key].items.push(b);
        return acc;
    }, {});

    const sortedGroups = Object.values(groupedByTransaction).sort((a, b) => new Date(b.borrow_date) - new Date(a.borrow_date));

    const groupedByDate = [];
    let lastDate = null;
    sortedGroups.forEach((group) => {
        const currentDate = toLocalDateString(group.borrow_date);
        if (currentDate !== lastDate) {
            groupedByDate.push({
                type: 'date-group',
                id: `date-group-${currentDate}`,
                date: group.borrow_date,
                transactions: [group]
            });
            lastDate = currentDate;
        } else {
            groupedByDate[groupedByDate.length - 1].transactions.push(group);
        }
    });

    reconcileList(
        returnGrid,
        groupedByDate,
        createReturnDateGroupHTML,
        'id',
        'returnItemId',
        '.date-group'
    );
};


const createTransactionGroupHTML = (group, isAdmin) => {
    const itemsHTML = group.items.map(item => {
        const imageUrl = item.image_url || `https://placehold.co/50x50/8ab4f8/ffffff?text=?`;
        const adminDeleteBtn = isAdmin ? `
            <div class="list-item__actions" style="margin-left: auto;">
                <button class="btn btn-danger action-btn delete-history-btn" data-id="${item.id}" title="Hapus Riwayat Ini">
                    <i class='bx bx-trash'></i>
                </button>
            </div>
            ` : '';

        return `
            <li class="transaction-group__item">
                 <img src="${escapeHTML(imageUrl)}" alt="${escapeHTML(item.item_name)}" class="transaction-group__item-img">
                 <div class="transaction-group__item-details">
                    <div class="transaction-group__item-name">${escapeHTML(item.item_name)}</div>
                    <div class="transaction-group__item-qty">Jumlah: ${escapeHTML(item.quantity)} pcs</div>
                </div>
                ${adminDeleteBtn}
            </li>`;
    }).join('');

    return `
        <div class="transaction-group">
            <div class="transaction-group__header">
                <div class="transaction-group__borrower-info">
                    <strong>${escapeHTML(group.borrower_name)}</strong>
                    <span class="class">${escapeHTML(group.borrower_class)}</span>
                    <span class="subject">Tujuan (Mapel) : ${escapeHTML(group.subject) || '-'}</span>
                    <small class="date-history-detail" style="display: block; margin-top: 10px;">
                        <span class="date-history-info">Pinjam : ${new Date(group.borrow_date).toLocaleString('id-ID')}</span> <br>
                        <span class="date-history-info">Kembali :  ${new Date(group.return_date).toLocaleString('id-ID')}</span>
                    </small>
                </div>
                <button type="button" class="btn btn-primary see-proof-btn view-proof-btn" style="padding: .8rem 1rem;" data-proof-url="${escapeHTML(group.proof_image_url)}" title="Lihat Bukti Pengembalian">
                    <i class='bx bx-link-external'></i> Lihat Bukti
                </button>
            </div>
            <ul class="transaction-group__items">${itemsHTML}</ul>
        </div>`;
};


const createDateGroupHTML = (dateGroup, isAdmin) => {
    const separatorHTML = createDateSeparatorHTML(dateGroup.date);
    const transactionsHTML = dateGroup.transactions.map(group => 
        createTransactionGroupHTML(group, isAdmin)
    ).join('');

    return `
    <div class="date-group" data-history-item-id="${escapeHTML(dateGroup.id)}">
        ${separatorHTML}
        ${transactionsHTML}
    </div>
    `;
};


export const renderHistory = () => {
    if (!historyGrid || !historyLoaderContainer) return;
    
    const isAdmin = state.session.role === 'admin';
    const hasData = state.history.length > 0;
    
    if (exportHistoryBtn) exportHistoryBtn.disabled = !hasData;
    if (flushHistoryBtn) flushHistoryBtn.disabled = !hasData;

    const emptyStateElement = historyGrid.querySelector('.empty-state');
    if (emptyStateElement) {
        emptyStateElement.remove();
    }

    if (!hasData) {
        historyGrid.innerHTML = createEmptyState('Riwayat Kosong', 'Tidak ada riwayat yang cocok dengan filter.');
        historyLoaderContainer.innerHTML = '';
        return;
    }

    // Kelompokkan riwayat berdasarkan transaction_id
    const groupedByTransaction = state.history.reduce((acc, h) => {
        const key = h.transaction_id || `single-history-${h.id}`;
        if (!acc[key]) {
            acc[key] = {
                items: [],
                borrower_name: h.borrower_name,
                borrower_class: h.borrower_class,
                subject: h.subject,
                return_date: h.return_date,
                borrow_date: h.borrow_date,
                proof_image_url: h.proof_image_url,
                transaction_id: h.transaction_id
            };
        }
        acc[key].items.push(h);
        return acc;
    }, {});

    let lastDate = null;
    const groupedByDate = [];

    const sortedGroups = Object.values(groupedByTransaction).sort((a, b) => new Date(b.return_date) - new Date(a.return_date));

    sortedGroups.forEach((group) => {
        const currentDate = toLocalDateString(group.return_date);
        if (currentDate !== lastDate) {
            groupedByDate.push({
                type: 'date-group',
                id: `date-group-${currentDate}`,
                date: group.return_date,
                transactions: [group]
            });
            lastDate = currentDate;
        } else {
            groupedByDate[groupedByDate.length - 1].transactions.push(group);
        }
    });

    reconcileList(
        historyGrid,
        groupedByDate,
        (item) => createDateGroupHTML(item, isAdmin),
        'id',
        'historyItemId',
        '.date-group'
    );

    historyGrid.querySelectorAll('.view-proof-btn').forEach(btn => {
        if (btn._listenerAttached) return;
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            const proofUrl = btn.dataset.proofUrl;
            if (proofUrl) {
                showImageViewer(proofUrl, 'Bukti Pengembalian');
            }
        });
        btn._listenerAttached = true;
    });
        
    if (state.hasMoreHistory) {
        historyLoaderContainer.innerHTML = `<button id="loadMoreHistoryBtn" class="btn btn-primary">Selengkapnya</button>`;
        document.getElementById('loadMoreHistoryBtn').onclick = () => fetchAndRenderHistory(true);
    } else {
        historyLoaderContainer.innerHTML = `<p class="end-of-list">Semua data telah ditampilkan.</p>`;
    }
};

const createBorrowItemRowHTML = (itemRow) => {
    const { rowId, selectedItemId, quantity, max } = itemRow;

    const allSelectedIds = borrowItemRows.map(r => r.selectedItemId).filter(Boolean);
    
    const availableItems = state.items.filter(item => 
        item.current_quantity > 0 || item.id == selectedItemId
    );

    const itemOptionsHTML = availableItems.map(item => {
        let itemMax = item.current_quantity;
        if (item.id == selectedItemId) {
            const originalItem = state.items.find(i => i.id == selectedItemId);
            if (originalItem) {
                itemMax = originalItem.current_quantity; 
            }
        }

        const isDisabled = allSelectedIds.includes(item.id.toString()) && item.id != selectedItemId;
        const imageUrl = escapeHTML(item.image_url) || 'https://placehold.co/40x40/8ab4f8/ffffff?text=?';
        const itemName = escapeHTML(item.name);
        const itemQty = escapeHTML(item.current_quantity);
        
        return `
        <div class="custom-dropdown__option" 
             data-value="${item.id}" 
             data-max="${itemMax}" 
             data-display="<img src='${imageUrl}' alt='${itemName}'><span>${itemName}</span>"
             aria-disabled="${isDisabled}">
            <img src="${imageUrl}" alt="${itemName}" class="custom-dropdown__option-img">
            <div class="custom-dropdown__option-info">
                <span class="custom-dropdown__option-name">${itemName}</span>
                <span class="custom-dropdown__option-qty">Sisa: ${itemQty}</span>
            </div>
        </div>`;
    }).join('');

    // Tentukan tampilan untuk item yang sedang dipilih
    const currentItem = selectedItemId ? state.items.find(i => i.id == selectedItemId) : null;
    const displayHTML = currentItem 
        ? `<img src='${escapeHTML(currentItem.image_url) || 'https://placehold.co/40x40/8ab4f8/ffffff?text=?'}' alt='${escapeHTML(currentItem.name)}'><span>${escapeHTML(currentItem.name)}</span>`
        : '<span class="custom-dropdown__placeholder">Pilih Alat</span>';
    
    const displayStyle = currentItem ? 'style="display: flex;"' : '';
    const placeholderStyle = currentItem ? 'style="display: none;"' : '';
    
    const maxQty = max || 1; 
    const maxHintText = max ? `Maks: ${max}` : '';

    return `
    <div class="borrow-item-row" id="${rowId}" data-row-id="${rowId}">
        <div class="form-group borrow-item-row__item">
            <label>Alat</label>
            <div class="custom-dropdown">
                <input type="hidden" name="item_id" value="${selectedItemId || ''}" required>
                <button type="button" class="custom-dropdown__selected">
                    <span class="custom-dropdown__placeholder" ${placeholderStyle}>Pilih Alat</span>
                    <div class="custom-dropdown__value" ${displayStyle}>${displayHTML}</div>
                    <i class='bx bx-chevron-down custom-dropdown__arrow'></i>
                </button>
                <div class="custom-dropdown__options">${itemOptionsHTML}</div>
            </div>
        </div>
        <div class="form-group borrow-item-row__quantity">
            <label for="quantity-${rowId}">Jumlah</label>
            <input type="number" id="quantity-${rowId}" name="quantity" min="1" max="${maxQty}" value="${quantity}" required>
            <small class="form-text max-quantity-hint">${maxHintText}</small>
        </div>
    </div>`;
};

const attachBorrowRowListeners = () => {
    const container = document.getElementById('borrowItemsContainer');
    if (!container) return;

    container.querySelectorAll('.borrow-item-row').forEach(row => {
        if (row._listenersAttached) return;

        const dropdown = row.querySelector('.custom-dropdown');
        const optionsEl = dropdown.querySelector('.custom-dropdown__options');
        const quantityInput = row.querySelector('input[name="quantity"]');
        const rowId = row.dataset.rowId;

        // Temukan state untuk baris ini
        const rowState = borrowItemRows.find(r => r.rowId === rowId);
        if (!rowState) return;

        // Listener untuk membuka/menutup dropdown
        dropdown.querySelector('.custom-dropdown__selected').onclick = (e) => {
            e.stopPropagation();
            // Tutup dropdown lain
            document.querySelectorAll('.custom-dropdown.is-open, .hybrid-dropdown.is-open').forEach(d => {
                if (d !== dropdown) d.classList.remove('is-open');
            });
            dropdown.classList.toggle('is-open');
        };

        // Listener untuk memilih item
        optionsEl.onclick = (e) => {
            const option = e.target.closest('.custom-dropdown__option');
            if (!option || option.getAttribute('aria-disabled') === 'true') return;

            const selectedId = option.dataset.value;
            const max = parseInt(option.dataset.max);

            // Update state
            rowState.selectedItemId = selectedId;
            rowState.max = max;
            
            // Jika kuantitas saat ini > max baru, reset ke 1
            if (rowState.quantity > max) {
                rowState.quantity = 1;
            } else if (rowState.quantity < 1) {
                rowState.quantity = 1;
            }

            renderBorrowRows();
        };

        // Listener untuk input kuantitas
        quantityInput.onchange = (e) => {
            let newQty = parseInt(e.target.value);
            if (isNaN(newQty) || newQty < 1) newQty = 1;
            
            // Gunakan max dari state
            if (rowState.max && newQty > rowState.max) {
                newQty = rowState.max;
            }
            
            rowState.quantity = newQty;
            e.target.value = newQty;
        };
        
        quantityInput.oninput = (e) => {
            e.target.value = e.target.value.replace(/[^0-9]/g, '');
        };

        row._listenersAttached = true;
    });
};


const updateBorrowFormActions = () => {
    const borrowItemsContainer = document.getElementById('borrowItemsContainer');
    if (!borrowItemsContainer) return;
    
    const rows = borrowItemsContainer.querySelectorAll('.borrow-item-row');

    // Hapus tombol yang mungkin sudah ada
    const existingBtn = borrowItemsContainer.querySelector('.remove-last-item-btn');
    if (existingBtn) {
        existingBtn.remove();
    }

    // Jika ada lebih dari satu baris, tambahkan tombol hapus ke baris terakhir
    if (rows.length > 1) {
        const lastRow = rows[rows.length - 1];

        const removeBtn = document.createElement('button');
        removeBtn.type = 'button';
        removeBtn.className = 'btn btn-secondary remove-last-item-btn';
        removeBtn.title = 'Hapus alat terakhir';
        removeBtn.innerHTML = `<i class='bx bx-chevron-up'></i>`;
        
        removeBtn.onclick = () => {
            borrowItemRows.pop();
            renderBorrowRows();
        };

        lastRow.appendChild(removeBtn);
    }
};


const renderBorrowRows = () => {
    const borrowItemsContainer = document.getElementById('borrowItemsContainer');
    if (!borrowItemsContainer) return;

    reconcileList(
        borrowItemsContainer,
        borrowItemRows,
        createBorrowItemRowHTML,
        'rowId',
        'rowId',
        '.borrow-item-row'
    );

    attachBorrowRowListeners();
    updateBorrowFormActions();
};


export const populateBorrowForm = () => {
    const borrowItemsContainer = document.getElementById('borrowItemsContainer');
    const borrowerNameInput = document.getElementById('borrowerName');
    const borrowerClassValueInput = document.getElementById('borrowerClassValue');
    const classDropdownContainer = document.getElementById('classDropdownContainer');
    const nameSuggestionsContainer = document.getElementById('nameSuggestions');
    const borrowForm = document.getElementById('borrowForm');

    if (borrowForm) {
        borrowForm._selectedUserId = null;
    }

    if (!borrowItemsContainer) return;

    // Reset state form
    borrowItemRows = [];
    itemRowCounter = 0;

    if (state.session.role === 'user') {
        if (borrowerNameInput) {
            borrowerNameInput.value = state.session.username;
        }
        if (borrowerClassValueInput) {
            borrowerClassValueInput.value = state.session.kelas;
            const classValueDisplay = classDropdownContainer.querySelector('.hybrid-dropdown__value, .custom-dropdown__value');
            const classPlaceholder = classDropdownContainer.querySelector('.hybrid-dropdown__placeholder, .custom-dropdown__placeholder');
            if (classValueDisplay) {
                classValueDisplay.innerHTML = `<span>${escapeHTML(state.session.kelas)}</span>`;
                classValueDisplay.style.display = 'flex';
            }
            if (classPlaceholder) {
                classPlaceholder.style.display = 'none';
            }
        }
    } else {
        if (borrowerNameInput) borrowerNameInput.value = '';
        if (borrowerClassValueInput) borrowerClassValueInput.value = '';
        const classValueDisplay = classDropdownContainer.querySelector('.hybrid-dropdown__value, .custom-dropdown__value');
        const classPlaceholder = classDropdownContainer.querySelector('.hybrid-dropdown__placeholder, .custom-dropdown__placeholder');
        if (classValueDisplay) classValueDisplay.style.display = 'none';
        if (classPlaceholder) classPlaceholder.style.display = 'block';
    }


    if (state.session.role === 'admin') {
        initializeBorrowClassDropdown(classDropdownContainer, borrowerClassValueInput);
    }

    const itemsToPreBorrow = [...state.itemsToBorrow];
    state.itemsToBorrow = [];

    if (itemsToPreBorrow.length > 0) {
        // Mode multi-select
        itemsToPreBorrow.forEach(itemId => {
            const item = state.items.find(i => i.id == itemId);
            if (item) {
                borrowItemRows.push({
                    rowId: `row-${itemRowCounter++}`,
                    selectedItemId: itemId,
                    quantity: 1,
                    max: item.current_quantity
                });
            }
        });
    } else if (state.itemToBorrow) {
        // Mode shortcut
        const item = state.items.find(i => i.id == state.itemToBorrow);
        if (item) {
            borrowItemRows.push({
                rowId: `row-${itemRowCounter++}`,
                selectedItemId: state.itemToBorrow,
                quantity: 1,
                max: item.current_quantity
            });
        }
        state.itemToBorrow = null;
    } else {
        // Mode default (kosong)
        borrowItemRows.push({
            rowId: `row-${itemRowCounter++}`,
            selectedItemId: null,
            quantity: 1,
            max: 1
        });
    }

    // Pasang listener untuk tombol "Tambah Alat"
    const addBtn = document.getElementById('addBorrowItemBtn');
    addBtn.onclick = () => {
        borrowItemRows.push({
            rowId: `row-${itemRowCounter++}`,
            selectedItemId: null,
            quantity: 1,
            max: 1
        });
        renderBorrowRows();
    };

    // Render awal
    renderBorrowRows();

    // --- Logika Autocomplete Nama (tetap sama) ---
    if (state.session.role === 'admin' && borrowerNameInput && nameSuggestionsContainer) {
        let debounceTimeout;
        borrowerNameInput.addEventListener('input', () => {
            if (borrowForm) {
                borrowForm._selectedUserId = null;
            }

            clearTimeout(debounceTimeout);
            const query = borrowerNameInput.value.trim();

            if (query.length < 2) {
                nameSuggestionsContainer.style.display = 'none';
                return;
            }

            debounceTimeout = setTimeout(async () => {
                try {
                    const response = await fetch(`${API_URL}?action=search_user&query=${encodeURIComponent(query)}`);
                    const result = await response.json();

                    if (result.status === 'success' && result.data.length > 0) {
                        nameSuggestionsContainer.innerHTML = result.data.map(user => `
                            <div class="suggestion-item" data-nama="${escapeHTML(user.nama)}" data-kelas="${escapeHTML(user.kelas)}" data-userid="${escapeHTML(user.id)}">
                                <span class="name">${escapeHTML(user.nama)}</span>
                                <span class="class">${escapeHTML(user.kelas)}</span>
                            </div>
                        `).join('');
                        nameSuggestionsContainer.style.display = 'block';
                    } else {
                        nameSuggestionsContainer.style.display = 'none';
                    }
                } catch (error) {
                    console.error('Failed to fetch name suggestions:', error);
                    nameSuggestionsContainer.style.display = 'none';
                }
            }, 300);
        });

        nameSuggestionsContainer.addEventListener('click', (e) => {
            const suggestion = e.target.closest('.suggestion-item');
            if (suggestion && borrowForm) {
                const userId = suggestion.dataset.userid;
                const nama = suggestion.dataset.nama;
                const kelas = suggestion.dataset.kelas;

                borrowForm._selectedUserId = userId;

                if (borrowerNameInput) borrowerNameInput.value = nama;

                const classValueInput = classDropdownContainer.querySelector('#borrowerClassValue');
                const valueDisplay = classDropdownContainer.querySelector('.hybrid-dropdown__value');
                const placeholder = classDropdownContainer.querySelector('.hybrid-dropdown__placeholder');

                if (classValueInput) classValueInput.value = kelas;
                if (valueDisplay) {
                    valueDisplay.textContent = kelas;
                    valueDisplay.style.display = 'block';
                }
                if (placeholder) placeholder.style.display = 'none';

                nameSuggestionsContainer.style.display = 'none';
            }
        });


        borrowerNameInput.addEventListener('blur', () => {
            setTimeout(() => {
                if (nameSuggestionsContainer) nameSuggestionsContainer.style.display = 'none';
            }, 200);
        });
    }
};

/**
 * Menambahkan event listener untuk fungsionalitas filter dan pencarian di halaman stok.
 */
export const setupStockEventListeners = () => {
    const filterBtn = document.getElementById('filterBtn');
    const filterOptions = document.getElementById('filterOptions');
    const searchInput = document.getElementById('stockSearch');

    let searchDebounceTimeout;

    searchInput?.addEventListener('input', () => {
        clearTimeout(searchDebounceTimeout);
        searchDebounceTimeout = setTimeout(() => {
            filterStock();
        }, 200); // Debounce
    });

    filterBtn?.addEventListener('click', (e) => {
        e.stopPropagation();
        filterOptions.classList.toggle('show');
    });

    filterOptions?.addEventListener('click', (e) => {
        if (e.target.tagName === 'LI') {
            const filterValue = e.target.dataset.filter;

            if (filterValue === 'classifier') {
                // Tampilkan modal jika memilih 'Jenis Barang'
                showClassifierFilterModal();
                filterOptions.classList.remove('show');
            } else {
                // Logika filter lainnya (Semua, Tersedia, Kosong)
                state.currentStockFilter = filterValue;
                state.currentClassifierFilter = null;
                updateFilterButtonState();
                filterOptions.classList.remove('show');
                filterStock();
            }
        }
    });
};

function createBorrowClassOptionHTML(c) {
    return `
        <div class="hybrid-dropdown__option" data-id="${c.id}" data-value="${escapeHTML(c.name)}">
            <span class="option-name">${escapeHTML(c.name)}</span>
        </div>`;
}

function initializeBorrowClassDropdown(dropdownEl, hiddenInput) {
    if (!dropdownEl || !hiddenInput) return;

    const selected = dropdownEl.querySelector('.hybrid-dropdown__selected');
    const optionsContainer = dropdownEl.querySelector('.hybrid-dropdown__options');
    const placeholder = dropdownEl.querySelector('.hybrid-dropdown__placeholder');
    const valueDisplay = dropdownEl.querySelector('.hybrid-dropdown__value');

    const closeDropdown = () => dropdownEl.classList.remove('is-open');

    const updateValue = (newValue) => {
        hiddenInput.value = newValue;
        if (newValue) {
            valueDisplay.textContent = escapeHTML(newValue);
            valueDisplay.style.display = 'block';
            if (placeholder) placeholder.style.display = 'none';
        } else {
            valueDisplay.textContent = '';
            valueDisplay.style.display = 'none';
            if (placeholder) placeholder.style.display = 'block';
        }
        closeDropdown();
    };

    const populateOptions = () => {
        const existingInput = optionsContainer.querySelector('.hybrid-dropdown__new-input-container');
        if (existingInput) {
            existingInput.remove();
        }
        
        let createNewOpt = optionsContainer.querySelector('.hybrid-dropdown__option--create');
        if (!createNewOpt) {
            createNewOpt = document.createElement('div');
            createNewOpt.className = 'hybrid-dropdown__option hybrid-dropdown__option--create';
            createNewOpt.innerHTML = `<i class='bx bx-plus-circle'></i><span>Buat Kelas Baru</span>`;

            createNewOpt.onclick = (e) => {
                e.stopPropagation();
                optionsContainer.innerHTML = `
                    <div class="hybrid-dropdown__new-input-container">
                        <input type="text" placeholder="Contoh: XII-TKJ 3" class="hybrid-dropdown__new-input">
                        <button type="button" class="btn btn-primary hybrid-dropdown__save-btn"><i class='bx bx-check'></i></button>
                    </div>`;

                const newInput = optionsContainer.querySelector('.hybrid-dropdown__new-input');
                const saveBtn = optionsContainer.querySelector('.hybrid-dropdown__save-btn');
                newInput.focus();

                const saveNewValue = async () => {
                    const val = newInput.value.trim();
                    if (val) {
                        saveBtn.disabled = true;
                        const result = await addClass(val);
                        showNotification(result.message, result.status);
                        if (result.status === 'success') {
                            if (!state.classes.some(c => c.id === result.data.id)) {
                                state.classes.push(result.data);
                                state.classes.sort((a, b) => a.name.localeCompare(b.name, 'en', { numeric: true }));
                            }
                            updateValue(val);
                        } else {
                            saveBtn.disabled = false;
                            populateOptions(); 
                        }
                    } else {
                        populateOptions();
                    }
                };
                newInput.onkeydown = (ev) => { if (ev.key === 'Enter') { ev.preventDefault(); saveNewValue(); } };
                saveBtn.onclick = (e_save) => { e_save.stopPropagation(); saveNewValue(); };
            };
            optionsContainer.appendChild(createNewOpt);
        } else {
            createNewOpt.style.display = 'flex';
        }

        reconcileList(
            optionsContainer,
            state.classes,
            createBorrowClassOptionHTML,
            'id',
            'id',
            '.hybrid-dropdown__option[data-id]'
        );

        optionsContainer.querySelectorAll('.hybrid-dropdown__option[data-id]').forEach(opt => {
            opt.onclick = () => updateValue(opt.dataset.value);
        });
    };

    selected.onclick = (e) => {
        e.stopPropagation();
        document.querySelectorAll('.hybrid-dropdown.is-open, .custom-dropdown.is-open').forEach(d => {
            if (d !== dropdownEl) d.classList.remove('is-open');
        });
        
        populateOptions();
        
        dropdownEl.classList.toggle('is-open');
    };

    updateValue(hiddenInput.value);
}