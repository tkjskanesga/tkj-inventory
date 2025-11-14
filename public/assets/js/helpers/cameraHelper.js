import { showNotification } from '../utils.js';

export const isMobileDevice = () => /Mobi|Android|iPhone/i.test(navigator.userAgent);

/**
 * Membuka UI kamera untuk mengambil foto.
 * @param {HTMLInputElement} cameraFileInput - Input file target untuk hasil kamera.
 * @param {HTMLInputElement} galleryFileInput - Input file galeri sebagai fallback.
 * @param {Function} showPreviewCallback - Callback untuk menampilkan pratinjau.
 */
export const openCameraUI = (cameraFileInput, galleryFileInput, showPreviewCallback) => {
    if (!('mediaDevices' in navigator && 'getUserMedia' in navigator.mediaDevices)) {
        console.warn('Camera API not supported, falling back to gallery input.');
        if (galleryFileInput) galleryFileInput.click();
        return;
    }

    const overlay = document.createElement('div');
    overlay.className = 'camera-overlay';
    overlay.innerHTML = `
        <div class="camera-container">
            <video id="cameraFeed" autoplay playsinline style="transform: scaleX(-1);"></video>
            <canvas id="cameraCanvas" style="display:none;"></canvas>
            <div class="camera-controls">
                <div class="camera-select-wrapper">
                    <i class='bx bxs-camera-switch'></i>
                    <select id="cameraSelectList" class="camera-select-list" title="Ganti Kamera" style="display: none;">
                        <option value="">Memuat Kamera...</option>
                    </select>
                </div>
                <button type="button" class="camera-capture-btn" title="Ambil Gambar"></button>
                <button type="button" class="camera-cancel-btn" title="Batal"><i class='bx bx-x'></i></button>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);

    const video = document.getElementById('cameraFeed');
    const canvas = document.getElementById('cameraCanvas');
    const captureBtn = overlay.querySelector('.camera-capture-btn');
    const cancelBtn = overlay.querySelector('.camera-cancel-btn');
    const cameraSelect = document.getElementById('cameraSelectList');
    
    let currentStream = null;
    let availableCameras = [];

    const cleanup = () => {
        if (currentStream) {
            currentStream.getTracks().forEach(track => track.stop());
        }
        if (document.body.contains(overlay)) {
            document.body.removeChild(overlay);
        }
    };

    const startCamera = async (deviceId) => {
        if (currentStream) {
            currentStream.getTracks().forEach(track => track.stop());
        }

        const constraints = {
            audio: false,
            video: { facingMode: 'user' }
        };

        if (deviceId) {
            constraints.video = { deviceId: { exact: deviceId } };
        }

        try {
            currentStream = await navigator.mediaDevices.getUserMedia(constraints);
            video.srcObject = currentStream;
            if (availableCameras.length === 0) { 
                await new Promise(resolve => setTimeout(resolve, 200));
                const devices = await navigator.mediaDevices.enumerateDevices();
                availableCameras = devices.filter(device => device.kind === 'videoinput');
                
                if (availableCameras.length >= 1) {
                    const currentTrack = currentStream.getVideoTracks()[0];
                    const currentDeviceId = currentTrack.getSettings().deviceId;

                    cameraSelect.innerHTML = '';
                    availableCameras.forEach((camera, index) => {
                        const option = document.createElement('option');
                        option.value = camera.deviceId;
                        option.text = camera.label || `Kamera ${index + 1}`;
                        if (camera.deviceId === currentDeviceId) {
                            option.selected = true;
                        }
                        cameraSelect.appendChild(option);
                    });
                    cameraSelect.style.display = 'block';
                }
            }
        } catch (err) {
            showNotification('Gagal mengakses kamera. Silakan gunakan unggah dari galeri.', 'error');
            cleanup();
            if (galleryFileInput) galleryFileInput.click();
        }
    };

    cameraSelect.addEventListener('change', () => {
        startCamera(cameraSelect.value);
    });

    startCamera(null);

    cancelBtn.onclick = cleanup;
    overlay.onclick = (e) => {
        if (e.target === overlay) cleanup();
    };
    
    captureBtn.onclick = () => {
        if (!currentStream) return;
        
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        
        const ctx = canvas.getContext('2d');
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        canvas.toBlob(blob => {
            const fileName = `capture_${new Date().toISOString()}.jpg`;
            const file = new File([blob], fileName, { type: 'image/jpeg', lastModified: Date.now() });

            if (galleryFileInput) galleryFileInput.value = '';

            const dataTransfer = new DataTransfer();
            dataTransfer.items.add(file);
            cameraFileInput.files = dataTransfer.files;

            showPreviewCallback(file);
            cleanup();
        }, 'image/jpeg', 0.9);
    };
};