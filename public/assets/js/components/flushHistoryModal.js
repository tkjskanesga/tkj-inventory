import { API_URL } from '../state.js';
import { openModal } from '../utils.js';
import { handleFlushHistoryFormSubmit } from '../api.js';

export const showFlushHistoryModal = async () => {
    openModal('Bersihkan Riwayat', `
        <form id="flushHistoryForm">
            <p class="modal-warning-text" style="text-align: left;"><strong>PERINGATAN:</strong> Tindakan ini akan menghapus semua riwayat dan file bukti secara permanen.</p>
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