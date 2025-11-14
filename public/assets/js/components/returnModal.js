import { state } from '../state.js';
import { openModal, escapeHTML } from '../utils.js';
import { handleReturnFormSubmit } from '../api.js';
import { isMobileDevice, openCameraUI } from '../helpers/cameraHelper.js';

export const showReturnModal = (transactionId) => {
    const borrowalsInTransaction = state.borrowals.filter(b => b.transaction_id === transactionId);
    if (borrowalsInTransaction.length === 0) return;

    const borrowerInfo = borrowalsInTransaction[0];
    const itemsListHTML = borrowalsInTransaction.map(b => 
        `<li><strong>${escapeHTML(b.quantity)}x</strong> ${escapeHTML(b.item_name)}</li>`
    ).join('');

    openModal(`Pengembalian`, `
        <form id="returnForm">
            <input type="hidden" name="transaction_id" value="${transactionId}">
            <p>Konfirmasi pengembalian dari <strong>${escapeHTML(borrowerInfo.borrower_name)}</strong> (${escapeHTML(borrowerInfo.borrower_class)}):</p>
            <ul style="list-style-position: inside; margin: 1rem 0;">${itemsListHTML}</ul>
            <div class="form-group">
                <label for="returnProofGallery">Bukti Pengembalian</label>
                <input type="file" id="returnProofGallery" name="proof_image" accept="image/*" hidden>
                <input type="file" id="returnProofCamera" name="proof_image_camera" accept="image/*" capture="environment" hidden>
                
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
            cameraInput.value = '';
            galleryInput.files = e.dataTransfer.files;
            showPreview(galleryInput.files[0]);
        }
    });
    
    // Logika kondisional untuk tombol "Ambil Foto"
    if (isMobileDevice()) {
        // Pada mobile, langsung trigger input file dengan atribut 'capture'
        takePictureBtn.addEventListener('click', () => cameraInput.click());
    } else {
        // Pada desktop, buka UI kamera custom
        takePictureBtn.addEventListener('click', () => {
            openCameraUI(cameraInput, galleryInput, showPreview);
        });
    }

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

        // Pastikan salah satu input file memiliki file
        if (galleryInput.files.length === 0 && cameraInput.files.length === 0) {
            fileError.style.display = 'block';
            return;
        }

        // Siapkan form untuk dikirim dengan menonaktifkan input yang tidak terpakai
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