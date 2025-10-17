import { state, API_URL } from './state.js';
import { createEmptyState, searchData, toLocalDateString, showNotification } from './utils.js';
import { fetchAndRenderHistory, addClass } from './api.js';
import { initializeHybridDropdown } from './modals.js';

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

// Fungsi untuk lazy load gambar
const lazyLoadImages = () => {
    const lazyImages = document.querySelectorAll('img.lazy');

    if ('IntersectionObserver' in window) {
        const imageObserver = new IntersectionObserver((entries, observer) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const image = entry.target;
                    image.src = image.dataset.src;
                    
                    // Tambahkan kelas 'loaded' setelah gambar selesai dimuat untuk efek fade-in
                    image.onload = () => {
                        image.classList.add('loaded');
                    };
                    // Tangani jika gambar gagal dimuat
                    image.onerror = () => {
                        image.src = `https://placehold.co/600x400/8ab4f8/ffffff?text=Error`;
                        image.classList.add('loaded');
                    };
                    
                    image.classList.remove('lazy');
                    observer.unobserve(image);
                }
            });
        });

        lazyImages.forEach(image => {
            imageObserver.observe(image);
        });
    } else {
        // Fallback untuk yang tidak mendukung IntersectionObserver
        lazyImages.forEach(image => {
            image.src = image.dataset.src;
            image.classList.remove('lazy');
            image.classList.add('loaded');
        });
    }
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
    lazyLoadImages(); // Terapkan lazy loading setelah me-render
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
            ? `<span class="card__classifier-chip">${item.classifier}</span>`
            : '';
            
        const outOfStockBadge = isOutOfStock ? `<div class="card__out-of-stock-badge">Kosong</div>` : '';
        
        // Gunakan placeholder transparan yang sangat kecil untuk src awal
        const placeholderSrc = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

        return `
        <div class="card ${isOutOfStock ? 'is-out-of-stock' : ''} ${isSelected ? 'is-selected' : ''}" data-item-id="${item.id}">
            <div class="card__image-container">
                <img src="${placeholderSrc}" data-src="${imageUrl}" alt="${item.name}" class="card__image lazy" loading="lazy">
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
        ['borrower_name', 'borrower_class', 'item_name', 'subject'],
        ['borrow_date']
    );

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

    let htmlContent = '';
    let lastDate = null;

    sortedGroups.forEach((group, index) => {
        const currentDate = toLocalDateString(group.borrow_date);
        
        if (currentDate !== lastDate) {
            if (lastDate !== null) {
                htmlContent += `</div>`;
            }
            htmlContent += `<div class="date-group">`;
            htmlContent += createDateSeparatorHTML(group.borrow_date);
            lastDate = currentDate;
        }

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
                    <img src="${imageUrl}" alt="${item.item_name}" class="transaction-group__item-img">
                    <div class="transaction-group__item-details">
                        <div class="transaction-group__item-name">${item.item_name}</div>
                        <div class="transaction-group__item-qty">Jumlah: ${item.quantity} pcs</div>
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

        htmlContent += `
            <div class="transaction-group">
                <div class="transaction-group__header">
                    <div class="transaction-group__borrower-info">
                        <strong>${group.borrower_name}</strong>
                        <span class="class">${group.borrower_class}</span>
                        <span class="subject">Tujuan (Mapel): ${group.subject || '-'}</span>
                         <small style="display: block; margin-top: 5px;">${new Date(group.borrow_date).toLocaleString('id-ID')}</small>
                    </div>
                    ${actionButtons}
                </div>
                <ul class="transaction-group__items">${itemsHTML}</ul>
            </div>`;

        if (index === sortedGroups.length - 1) {
            htmlContent += `</div>`;
        }
    });

    returnGrid.innerHTML = htmlContent;
};

export const renderHistory = () => {
    if (!historyGrid || !historyLoaderContainer) return;
    
    const isAdmin = state.session.role === 'admin';
    const hasData = state.history.length > 0;
    
    if (exportHistoryBtn) exportHistoryBtn.disabled = !hasData;
    if (flushHistoryBtn) flushHistoryBtn.disabled = !hasData;

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
    let htmlContent = '';

    // Urutkan grup berdasarkan tanggal pengembalian terbaru
    const sortedGroups = Object.values(groupedByTransaction).sort((a, b) => new Date(b.return_date) - new Date(a.return_date));

    sortedGroups.forEach((group, index) => {
        const currentDate = toLocalDateString(group.return_date);
        if (currentDate !== lastDate) {
            if (lastDate !== null) {
                htmlContent += `</div>`;
            }
            htmlContent += `<div class="date-group">`;
            htmlContent += createDateSeparatorHTML(group.return_date);
            lastDate = currentDate;
        }

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
                     <img src="${imageUrl}" alt="${item.item_name}" class="transaction-group__item-img">
                     <div class="transaction-group__item-details">
                        <div class="transaction-group__item-name">${item.item_name}</div>
                        <div class="transaction-group__item-qty">Jumlah: ${item.quantity} pcs</div>
                    </div>
                    ${adminDeleteBtn}
                </li>`;
        }).join('');

        htmlContent += `
            <div class="transaction-group">
                <div class="transaction-group__header">
                    <div class="transaction-group__borrower-info">
                        <strong>${group.borrower_name}</strong>
                        <span class="class">${group.borrower_class}</span>
                        <span class="subject">Tujuan (Mapel) : ${group.subject || '-'}</span>
                        <small class="date-history-detail" style="display: block; margin-top: 10px;">
                            <span class="date-history-info">Pinjam : ${new Date(group.borrow_date).toLocaleString('id-ID')}</span> <br>
                            <span class="date-history-info">Kembali :  ${new Date(group.return_date).toLocaleString('id-ID')}</span>
                        </small>
                    </div>
                    <a href="${group.proof_image_url}" target="_blank" title="Lihat Bukti Pengembalian" class="btn btn-primary see-proof-btn" style="text-decoration: none;">
                        <i class='bx bx-link-external'></i> Lihat Bukti
                    </a>
                </div>
                <ul class="transaction-group__items">${itemsHTML}</ul>
            </div>`;

        if (index === sortedGroups.length - 1) {
            htmlContent += `</div>`;
        }
    });

    historyGrid.innerHTML = htmlContent;
        
    if (state.hasMoreHistory) {
        historyLoaderContainer.innerHTML = `<button id="loadMoreHistoryBtn" class="btn btn-primary">Selengkapnya</button>`;
        document.getElementById('loadMoreHistoryBtn').onclick = () => fetchAndRenderHistory(true);
    } else {
        historyLoaderContainer.innerHTML = `<p class="end-of-list">Semua data telah ditampilkan.</p>`;
    }
};

let itemRowCounter = 0;

const createBorrowItemRow = () => {
    itemRowCounter++;
    const rowId = `item-row-${itemRowCounter}`;

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
            <label>Alat</label>
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
            <label for="quantity-${itemRowCounter}">Jumlah</label>
            <input type="number" id="quantity-${itemRowCounter}" name="quantity" min="1" value="1" required>
            <small class="form-text max-quantity-hint"></small>
        </div>`;

    const dropdown = row.querySelector('.custom-dropdown');
    const optionsEl = dropdown.querySelector('.custom-dropdown__options');
    const valueEl = dropdown.querySelector('.custom-dropdown__value');
    const placeholderEl = dropdown.querySelector('.custom-dropdown__placeholder');
    const hiddenInput = dropdown.querySelector('input[type="hidden"]');
    const quantityInput = row.querySelector('input[type="number"]');
    const maxHint = row.querySelector('.max-quantity-hint');
    
    optionsEl.addEventListener('click', e => {
        const option = e.target.closest('.custom-dropdown__option');
        if (!option || option.getAttribute('aria-disabled') === 'true') return;

        hiddenInput.value = option.dataset.value;
        valueEl.innerHTML = option.dataset.display;
        valueEl.style.display = 'flex';
        placeholderEl.style.display = 'none';
        dropdown.classList.remove('is-open');

        if (option.dataset.max) {
            quantityInput.max = option.dataset.max;
            if (parseInt(quantityInput.value) > parseInt(option.dataset.max) || !quantityInput.value) {
                quantityInput.value = 1;
            }
            maxHint.textContent = `Maks: ${option.dataset.max}`;
        }
        updateAllDropdowns();
    });

    document.getElementById('borrowItemsContainer').appendChild(row);
    updateAllDropdowns();
    return row;
}

const updateAllDropdowns = () => {
    const selectedItemIds = Array.from(document.querySelectorAll('#borrowItemsContainer input[name="item_id"]'))
        .map(input => input.value)
        .filter(Boolean);

    document.querySelectorAll('#borrowItemsContainer .custom-dropdown').forEach(dropdown => {
        const currentSelectedId = dropdown.querySelector('input[name="item_id"]').value;
        dropdown.querySelectorAll('.custom-dropdown__option').forEach(option => {
            const isSelectedElsewhere = selectedItemIds.includes(option.dataset.value) && option.dataset.value !== currentSelectedId;
            option.setAttribute('aria-disabled', isSelectedElsewhere);
        });
    });
};


// --- Fungsi Untuk Mengelola Tombol Aksi ---
const updateBorrowFormActions = () => {
    const borrowItemsContainer = document.getElementById('borrowItemsContainer');
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
            lastRow.remove();
            updateAllDropdowns();
            updateBorrowFormActions(); // Panggil lagi untuk memeriksa kondisi
        };

        lastRow.appendChild(removeBtn);
    }
};

export const populateBorrowForm = () => {
    const borrowItemsContainer = document.getElementById('borrowItemsContainer');
    const borrowerNameInput = document.getElementById('borrowerName');
    const borrowerClassValueInput = document.getElementById('borrowerClassValue');
    const classDropdownContainer = document.getElementById('classDropdownContainer');
    const nameSuggestionsContainer = document.getElementById('nameSuggestions');
    
    if (!borrowItemsContainer) return;
    borrowItemsContainer.innerHTML = ''; // Clear previous rows

    // Jika user adalah siswa, isi otomatis data mereka
    if (state.session.role === 'user') {
        if (borrowerNameInput) {
            borrowerNameInput.value = state.session.username;
        }
        if (borrowerClassValueInput) {
            borrowerClassValueInput.value = state.session.kelas;
            // Perbarui juga tampilan dropdown meskipun tersembunyi
            const classValueDisplay = classDropdownContainer.querySelector('.hybrid-dropdown__value, .custom-dropdown__value');
            const classPlaceholder = classDropdownContainer.querySelector('.hybrid-dropdown__placeholder, .custom-dropdown__placeholder');
            if (classValueDisplay) {
                classValueDisplay.innerHTML = `<span>${state.session.kelas}</span>`;
                classValueDisplay.style.display = 'flex';
            }
            if (classPlaceholder) {
                classPlaceholder.style.display = 'none';
            }
        }
    } else {
        // Jika admin, pastikan formnya kosong
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
    state.itemsToBorrow = []; // Kosongkan setelah diambil

    if (itemsToPreBorrow.length > 0) {
        // Mode multi-select
        itemsToPreBorrow.forEach(itemId => {
            const row = createBorrowItemRow();
            const optionToSelect = row.querySelector(`.custom-dropdown__option[data-value='${itemId}']`);
            if (optionToSelect) {
                optionToSelect.click();
            }
        });
    } else {
        // Mode default (shortcut atau kosong)
        const firstRow = createBorrowItemRow();
        if (state.itemToBorrow) {
            const optionToSelect = firstRow.querySelector(`.custom-dropdown__option[data-value='${state.itemToBorrow}']`);
            if (optionToSelect) {
                optionToSelect.click();
            }
            state.itemToBorrow = null;
        }
    }
    
    const addBtn = document.getElementById('addBorrowItemBtn');
    addBtn.onclick = () => {
        createBorrowItemRow();
        updateBorrowFormActions();
    };

    updateBorrowFormActions();

    // --- LOGIKA AUTOCOMPLETE NAMA ---
    let debounceTimeout;
    borrowerNameInput.addEventListener('input', () => {
        if (state.session.role !== 'admin') return;

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
                        <div class="suggestion-item" data-nama="${user.nama}" data-kelas="${user.kelas}">
                            <span class="name">${user.nama}</span>
                            <span class="class">${user.kelas}</span>
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

    // Event listener untuk klik pada suggestion dihapus dari sini

    borrowerNameInput.addEventListener('blur', () => {
        // Beri sedikit jeda agar event click pada suggestion bisa berjalan
        setTimeout(() => {
            nameSuggestionsContainer.style.display = 'none';
        }, 200);
    });
};

/**
 * Menambahkan event listener untuk fungsionalitas filter dan pencarian di halaman stok.
 */
const setupStockFilterAndSearch = () => {
    const filterBtn = document.getElementById('filterBtn');
    const filterOptions = document.getElementById('filterOptions');
    
    filterBtn?.addEventListener('click', (e) => {
        e.stopPropagation(); // Mencegah event click lain (seperti di body) menutup dropdown ini
        filterOptions.classList.toggle('show');
    });

    filterOptions?.addEventListener('click', (e) => {
        if (e.target.tagName === 'LI') {
            const filterValue = e.target.dataset.filter;
            state.currentStockFilter = filterValue;
            
            filterBtn.innerHTML = `<i class='bx bx-filter-alt'></i> ${e.target.textContent}`;
            
            let btnClass = 'filter-all'; // default
            if (filterValue === 'available') {
                btnClass = 'filter-available';
            } else if (filterValue === 'empty') {
                btnClass = 'filter-empty';
            }
            filterBtn.className = `btn ${btnClass}`;
            
            filterOptions.classList.remove('show');
            applyStockFilterAndRender();
        }
    });
};

// Panggil fungsi setup saat skrip dimuat
setupStockFilterAndSearch();

/**
 * Menginisialisasi dropdown kelas pada form peminjaman dengan fitur tambah kelas baru.
 * Berbeda dari hybrid dropdown di modal, dropdown ini tidak memiliki fitur edit/hapus.
 * @param {HTMLElement} dropdownEl - Elemen kontainer dropdown.
 * @param {HTMLInputElement} hiddenInput - Input tersembunyi untuk menyimpan nilai.
 */
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
            valueDisplay.textContent = newValue;
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
        optionsContainer.innerHTML = '';
        
        const createNewOpt = document.createElement('div');
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
                }
            };
            newInput.onkeydown = (ev) => { if (ev.key === 'Enter') { ev.preventDefault(); saveNewValue(); } };
            saveBtn.onclick = (e_save) => { e_save.stopPropagation(); saveNewValue(); };
        };
        optionsContainer.appendChild(createNewOpt);

        state.classes.forEach(c => {
            const opt = document.createElement('div');
            opt.className = 'hybrid-dropdown__option';
            opt.innerHTML = `<span class="option-name">${c.name}</span>`;
            opt.onclick = () => updateValue(c.name);
            optionsContainer.appendChild(opt);
        });
    };

    selected.onclick = (e) => {
        e.stopPropagation();
        document.querySelectorAll('.hybrid-dropdown.is-open, .custom-dropdown.is-open').forEach(d => {
            if (d !== dropdownEl) d.classList.remove('is-open');
        });
        if (!dropdownEl.classList.contains('is-open')) {
            populateOptions();
        }
        dropdownEl.classList.toggle('is-open');
    };

    // Set nilai awal ke kosong saat form dimuat
    updateValue('');
}