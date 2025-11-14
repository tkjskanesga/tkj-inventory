import { state } from '../state.js';
import { openModal, closeModal, showNotification, escapeHTML } from '../utils.js';
import { filterStock } from '../render.js';
import { updateFilterButtonState } from '../ui.js';

/**
 * Menampilkan modal untuk memilih filter jenis barang.
 */
export const showClassifierFilterModal = () => {
    if (state.classifiers.length === 0) {
        showNotification('Tidak ada jenis barang yang tersedia untuk difilter.', 'error');
        return;
    }

    const classifierOptionsHTML = state.classifiers.map(classifier => `
        <div class="form-check classifier-filter-item" style="margin-bottom: 0.75rem;">
            <input class="form-check-input classifier-filter-input" type="radio" name="classifierFilter" id="classifier-${escapeHTML(classifier)}" value="${escapeHTML(classifier)}" ${state.currentClassifierFilter === classifier ? 'checked' : ''}>
            <label class="form-check-label classifier-filter-label" for="classifier-${escapeHTML(classifier)}">
                ${escapeHTML(classifier)}
            </label>
        </div>
    `).join('');

    openModal('Filter Jenis Barang', `
        <form id="classifierFilterForm">
            <p class="modal-details" style="margin-bottom: 1rem;">Pilih salah satu jenis barang untuk ditampilkan:</p>
            <div class="classifier-filter-list" style="max-height: 300px; overflow-y: auto; padding-right: 1rem;">
                ${classifierOptionsHTML}
            </div>
            <div class="modal-footer" style="margin-top: 1.5rem;">
                <button type="button" class="btn btn-secondary close-modal-btn">Batal</button>
                <button type="submit" class="btn btn-primary">Terapkan</button>
            </div>
        </form>
    `);

    const form = document.getElementById('classifierFilterForm');
    form.addEventListener('submit', (e) => {
        e.preventDefault();
        const selectedRadio = form.querySelector('input[name="classifierFilter"]:checked');
        if (selectedRadio) {
            state.currentClassifierFilter = selectedRadio.value;
            state.currentStockFilter = 'classifier';
            updateFilterButtonState();
            filterStock();
            closeModal();
        } else {
            showNotification('Pilih salah satu jenis barang.', 'error');
        }
    });
};