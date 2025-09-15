import { state, classList } from './state.js';
import { createEmptyState, searchData, toLocalDateString } from './utils.js';
import { fetchAndRenderHistory } from './api.js';

// Renders data menjadi HTML.
const stockGrid = document.getElementById('stockGrid');
const returnGrid = document.getElementById('returnGrid');
const historyGrid = document.getElementById('historyGrid');
const exportHistoryBtn = document.getElementById('exportHistoryBtn');
const flushHistoryBtn = document.getElementById('flushHistoryBtn');
const historyLoaderContainer = document.getElementById('historyLoaderContainer');

// Fungsi untuk memformat tanggal menjadi format "Hari, DD/MM/YYYY"
const formatDateForSeparator = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    if (isNaN(date)) return '';
    
    const options = { weekday: 'long', day: 'numeric', month: 'numeric', year: 'numeric' };
    return new Intl.DateTimeFormat('id-ID', options).format(date);
};

// Fungsi untuk membuat HTML badge pemisah tanggal
const createDateSeparatorHTML = (dateString) => {
    return `
    <div class="date-separator">
        <span class="date-separator__badge">${formatDateForSeparator(dateString)}</span>
    </div>`;
};


export const applyStockFilterAndRender = () => {
    const searchTerm = document.getElementById('stockSearch').value.toLowerCase();
    let filtered = state.items;

    if (state.currentStockFilter === 'available') {
        filtered = filtered.filter(item => item.current_quantity > 0);
    } else if (state.currentStockFilter === 'empty') {
        filtered = filtered.filter(item => item.current_quantity <= 0);
    }

    if (searchTerm) {
        filtered = searchData(filtered, searchTerm, ['name', 'classifier', 'total_quantity', 'current_quantity']);
    }
    renderStock(filtered);
};

const renderStock = (itemsToRender) => {
    if (!stockGrid) return;

    if (itemsToRender.length === 0) {
        const message = state.items.length > 0 ? 'Barang tidak ditemukan.' : 'Belum ada barang di inventaris.';
        stockGrid.innerHTML = createEmptyState('Stok tidak ditemukan', message);
        return;
    }

    const isAdmin = state.session.role === 'admin';
    const isBorrowingDisabled = !isAdmin && state.borrowSettings.isAppLocked;

    stockGrid.innerHTML = itemsToRender.map(item => {
        const isOutOfStock = item.current_quantity <= 0;
        const isBorrowed = item.current_quantity < item.total_quantity;
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
            ? `<span class="card__classifier-chip">${item.classifier}</span>`
            : '';
            
        const outOfStockBadge = isOutOfStock ? `<div class="card__out-of-stock-badge">Kosong</div>` : '';

        return `
        <div class="card ${isOutOfStock ? 'is-out-of-stock' : ''}">
            <div class="card__image-container">
                <img src="${imageUrl}" alt="${item.name}" class="card__image" onerror="this.onerror=null;this.src='https://placehold.co/600x400/8ab4f8/ffffff?text=Error';">
                ${outOfStockBadge}
                ${classifierHTML}
                ${adminActionsHTML}
                ${borrowShortcutHTML}
            </div>
            <div class="card__body">
                <h3 class="card__title" title="${item.name}">${item.name}</h3>
                <div class="card__info">
                    <span>Tersedia: <strong class="${stockClass}">${item.current_quantity}</strong></span>
                    <span class="card__quantity-chip">Total: ${item.total_quantity}</span>
                </div>
            </div>
        </div>`;
    }).join('');
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

export const renderReturns = () => {
    if (!returnGrid) return;
    const searchInput = document.getElementById('returnSearch');
    const filteredData = applyDateAndSearchFilters(
        state.borrowals,
        searchInput,
        ['borrower_name', 'borrower_class', 'item_name', 'quantity', 'subject'],
        ['borrow_date']
    );

    if (filteredData.length === 0) {
        returnGrid.innerHTML = createEmptyState('Tidak Ada Peminjaman', 'Tidak ada data yang cocok dengan filter.');
        return;
    }
    
    let lastDate = null;
    let htmlContent = '';
    let currentGroupItemsHTML = '';
    const isAdmin = state.session.role === 'admin';

    const closeCurrentGroup = () => {
        if (currentGroupItemsHTML) {
            htmlContent += `<div class="date-group">${currentGroupItemsHTML}</div>`;
        }
    };

    filteredData.forEach(b => {
        const currentDate = toLocalDateString(b.borrow_date);
        if (currentDate !== lastDate) {
            closeCurrentGroup();
            currentGroupItemsHTML = createDateSeparatorHTML(b.borrow_date);
            lastDate = currentDate;
        }

        const imageUrl = b.image_url || `https://placehold.co/80x80/8ab4f8/ffffff?text=${encodeURIComponent(b.item_name)}`;
        
        const adminEditBtn = isAdmin ? `
            <button class="btn btn-success action-btn edit-borrowal-btn" data-id="${b.id}" title="Ubah Jumlah Pinjam">
                <i class='bx bxs-pencil'></i>
            </button>` : '';

        currentGroupItemsHTML += `
        <div class="list-item list-item--has-actions">
            <div class="list-item__info list-item__info--return">
                <div class="list-item__data list-item__borrower"><strong>${b.borrower_name}</strong> (${b.borrower_class})</div>
                <div class="list-item__data list-item__item-name"><strong>${b.item_name}</strong> (${b.quantity} pcs)</div>
                <img src="${imageUrl}" alt="${b.item_name}" class="list-item__image" onerror="this.onerror=null;this.src='https://placehold.co/80x80/8ab4f8/ffffff?text=Error';">
                <div class="list-item__data list-item__subject"><strong>Mapel (Tujuan)</strong> ${b.subject || '-'}</div>                
                <div class="list-item__data list-item__date"><strong>Tgl Pinjam</strong> ${new Date(b.borrow_date).toLocaleString('id-ID')}</div>
            </div>
            <div class="list-item__actions">
                <button class="btn btn-primary return-btn" data-id="${b.id}">Kembalikan</button>
                ${adminEditBtn}
            </div>
        </div>`;
    });

    closeCurrentGroup();
    returnGrid.innerHTML = htmlContent;
};

export const renderHistory = () => {
    if (!historyGrid || !historyLoaderContainer) return;
    
    const isAdmin = state.session.role === 'admin';
    const hasData = state.history.length > 0;
    
    if (exportHistoryBtn) {
        exportHistoryBtn.disabled = !hasData;
    }
    if (flushHistoryBtn) {
        flushHistoryBtn.disabled = !hasData;
    }

    if (!hasData) {
        historyGrid.innerHTML = createEmptyState('Riwayat Kosong', 'Tidak ada riwayat yang cocok dengan filter.');
        historyLoaderContainer.innerHTML = '';
        return;
    }
    
    let lastDate = null;
    let htmlContent = '';
    let currentGroupItemsHTML = '';
    
    const closeCurrentGroup = () => {
        if (currentGroupItemsHTML) {
            htmlContent += `<div class="date-group">${currentGroupItemsHTML}</div>`;
        }
    };

    state.history.forEach(h => {
        const currentDate = toLocalDateString(h.return_date);
        if (currentDate !== lastDate) {
            closeCurrentGroup();
            currentGroupItemsHTML = createDateSeparatorHTML(h.return_date);
            lastDate = currentDate;
        }

        const listItemClass = isAdmin ? 'list-item list-item--has-actions' : 'list-item';
        const adminActionsHTML = isAdmin ? `
            <div class="list-item__actions">
                <button class="btn btn-danger action-btn delete-history-btn" data-id="${h.id}" title="Hapus Riwayat Ini">
                    <i class='bx bx-trash'></i>
                </button>
            </div>` : '';

        currentGroupItemsHTML += `
        <div class="${listItemClass}">
            <div class="list-item__info">
                <div class="list-item__data"><strong class="list-item__returner">${h.borrower_name}</strong> (${h.borrower_class})</div>
                <div class="list-item__data"><strong>${h.item_name}</strong> (${h.quantity} pcs)</div>
                <div class="list-item__data"><strong>Tujuan (Mapel)</strong> ${h.subject || '-'}</div>
                <div class="list-item__data"><strong>Tgl Pinjam</strong> ${new Date(h.borrow_date).toLocaleString('id-ID')}</div>
                <div class="list-item__data"><strong>Tgl Kembali</strong> ${new Date(h.return_date).toLocaleString('id-ID')}</div>
                <div class="list-item__data"><strong>Bukti</strong> <a href="${h.proof_image_url}" target="_blank" class="history__proof-link"><i class='bx bx-link-external'></i> Lihat Bukti</a></div>
            </div>
            ${adminActionsHTML}
        </div>`;
    });

    closeCurrentGroup();
    historyGrid.innerHTML = htmlContent;
        
    if (state.hasMoreHistory) {
        historyLoaderContainer.innerHTML = `<button id="loadMoreHistoryBtn" class="btn btn-primary">Lihat Selengkapnya</button>`;
        document.getElementById('loadMoreHistoryBtn').onclick = () => fetchAndRenderHistory(true);
    } else {
        historyLoaderContainer.innerHTML = `<p class="end-of-list">Semua data telah ditampilkan.</p>`;
    }
};

export const populateBorrowForm = () => {
    const createDropdown = (containerId, hiddenInputId, items) => {
        const container = document.getElementById(containerId);
        if (!container) return;
        const optionsEl = container.querySelector('.custom-dropdown__options');
        const valueEl = container.querySelector('.custom-dropdown__value');
        const placeholderEl = container.querySelector('.custom-dropdown__placeholder');
        const hiddenInput = document.getElementById(hiddenInputId);

        optionsEl.innerHTML = items.length > 0 ? items.map(item => item.html).join('') : `<div class="custom-dropdown__option--disabled">Tidak ada pilihan</div>`;

        optionsEl.querySelectorAll('.custom-dropdown__option').forEach(opt => {
            opt.onclick = () => {
                hiddenInput.value = opt.dataset.value;
                valueEl.innerHTML = opt.dataset.display;
                valueEl.style.display = 'flex';
                placeholderEl.style.display = 'none';
                container.classList.remove('is-open');
                if (opt.dataset.max) {
                    const quantityInput = document.getElementById('borrowQuantity');
                    const maxHint = document.getElementById('maxQuantity');
                    quantityInput.max = opt.dataset.max;
                    if (parseInt(quantityInput.value) > opt.dataset.max || !quantityInput.value) quantityInput.value = 1;
                    maxHint.textContent = `Maksimal pinjam: ${opt.dataset.max}`;
                }
            };
        });
    };

    const availableItems = state.items.filter(item => item.current_quantity > 0).map(item => ({
        html: `<div class="custom-dropdown__option" data-value="${item.id}" data-max="${item.current_quantity}" data-display="<img src='${item.image_url || 'https://placehold.co/40x40/8ab4f8/ffffff?text=?'}' alt='${item.name}'><span>${item.name}</span>">
                   <img src="${item.image_url || 'https://placehold.co/40x40/8ab4f8/ffffff?text=?'}" alt="${item.name}" class="custom-dropdown__option-img">
                   <div class="custom-dropdown__option-info"><span class="custom-dropdown__option-name">${item.name}</span><span class="custom-dropdown__option-qty">Sisa: ${item.current_quantity}</span></div>
               </div>`
    }));
    
    const classes = classList.map(c => ({
        html: `<div class="custom-dropdown__option" data-value="${c}" data-display="<span>${c}</span>"><span class="custom-dropdown__option-name">${c}</span></div>`
    }));

    createDropdown('itemDropdownContainer', 'borrowItemId', availableItems);
    createDropdown('classDropdownContainer', 'borrowerClassValue', classes);

    // Cek apakah ada item yang perlu dipilih otomatis dari shortcut halaman stok
    if (state.itemToBorrow) {
        const itemDropdownContainer = document.getElementById('itemDropdownContainer');
        const optionToSelect = itemDropdownContainer.querySelector(`.custom-dropdown__option[data-value='${state.itemToBorrow}']`);
        
        if (optionToSelect) {
            // Simulasikan klik untuk memicu semua update yang diperlukan
            optionToSelect.click();
        }
        
        // Reset properti state
        state.itemToBorrow = null;
    }
};