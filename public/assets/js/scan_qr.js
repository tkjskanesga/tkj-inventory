import { showNotification } from './utils.js';
import { state } from './state.js';
import { setActivePage } from './ui.js';
import { addScannedItemToForm } from './render.js';

// State Internal Scanner
let html5QrcodeScanner = null;
let availableCameras = [];
let currentCameraIndex = 0;
let isScanning = false;
let currentZoom = 1;
let zoomCapabilities = null;

// DOM Elements
const overlay = document.getElementById('qrScannerOverlay');
const zoomSlider = document.getElementById('qrZoomSlider');
const zoomValue = document.getElementById('qrZoomValue');
const controlsDiv = document.getElementById('qrScannerControls');
const switchBtn = document.getElementById('qrSwitchCameraBtn');
const cancelBtn = document.getElementById('qrCancelBtn');
const cameraCountEl = document.getElementById('qrCameraCount');

export const showQrScannerModal = async () => {
    if (!overlay) return;
    
    overlay.style.display = 'flex';
    currentZoom = 1;
    if (zoomSlider) zoomSlider.value = 1;
    if (zoomValue) zoomValue.textContent = '1.0x';
    if (controlsDiv) controlsDiv.classList.remove('show');
    
    await getCameras();
    startScanner();
};

const updateCameraCount = () => {
    if (availableCameras.length > 0 && cameraCountEl) {
        cameraCountEl.textContent = `${currentCameraIndex + 1}/${availableCameras.length}`;
    }
};

const getCameras = async () => {
    try {
        availableCameras = await Html5Qrcode.getCameras();
        const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
        
        if ((availableCameras && availableCameras.length > 1) || (isMobile && availableCameras.length === 0)) {
            switchBtn.style.display = 'flex';
            if (availableCameras.length > 1) updateCameraCount();
            else if (cameraCountEl) cameraCountEl.textContent = '1/2'; 
        } else {
            switchBtn.style.display = 'none';
        }
    } catch (err) {
        console.error("Error getting cameras", err);
    }
};

const startScanner = async () => {
    if (isScanning) return;
    
    try {
        if (html5QrcodeScanner) {
            await html5QrcodeScanner.clear();
        }

        html5QrcodeScanner = new Html5Qrcode("qr-reader");
        
        const config = { 
            fps: 10,
            qrbox: (viewfinderWidth, viewfinderHeight) => {
                const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
                return {
                    width: Math.floor(minEdge * 0.7),
                    height: Math.floor(minEdge * 0.7)
                };
            }
        };
        
        let cameraIdOrConfig;
        if (availableCameras.length > 0) {
            if (currentCameraIndex >= availableCameras.length) currentCameraIndex = 0;
            cameraIdOrConfig = availableCameras[currentCameraIndex].id;
        } else {
            cameraIdOrConfig = { facingMode: "environment" }; 
        }

        isScanning = true;
        if(switchBtn) switchBtn.disabled = true;

        await html5QrcodeScanner.start(
            cameraIdOrConfig, 
            config, 
            onScanSuccess, 
            onScanFailure
        );
        
        if(switchBtn) switchBtn.disabled = false;
        setupCameraCapabilities();

    } catch (err) {
        console.error("Scanner Error:", err);
        showNotification("Gagal mengakses kamera. Coba refresh atau periksa izin.", 'error');
        closeScanner();
    }
};

// Setup kemampuan kamera (Zoom & Fokus)
const setupCameraCapabilities = () => {
    setTimeout(() => {
        const video = document.querySelector('#qr-reader video');
        if (!video || !video.srcObject) return;

        const videoTrack = video.srcObject.getVideoTracks()[0];
        if (!videoTrack) return;

        const capabilities = videoTrack.getCapabilities();

        if (capabilities.zoom) {
            zoomCapabilities = capabilities.zoom;
            if(zoomSlider) {
                zoomSlider.min = capabilities.zoom.min;
                zoomSlider.max = capabilities.zoom.max;
                zoomSlider.step = capabilities.zoom.step || 0.1;
                zoomSlider.value = currentZoom;
            }
            if(controlsDiv) controlsDiv.classList.add('show');
        } else {
            if(controlsDiv) controlsDiv.classList.remove('show');
        }

        if (capabilities.focusMode && capabilities.focusMode.includes('continuous')) {
            videoTrack.applyConstraints({
                advanced: [{ focusMode: "continuous" }]
            }).catch(e => {
                console.warn("Focus mode apply failed", e);
            });
        }

    }, 500);
};

const applyZoom = async (level) => {
    const video = document.querySelector('#qr-reader video');
    if (!video || !video.srcObject) return;

    const videoTrack = video.srcObject.getVideoTracks()[0];
    if (videoTrack && zoomCapabilities) {
        try {
            await videoTrack.applyConstraints({ advanced: [{ zoom: level }] });
            currentZoom = level;
            if(zoomValue) zoomValue.textContent = level.toFixed(1) + 'x';
        } catch (e) {
            console.error("Zoom failed", e);
        }
    }
};

const closeScanner = async () => {
    if (html5QrcodeScanner) {
        try {
            if (html5QrcodeScanner.isScanning) {
                await html5QrcodeScanner.stop();
            }
            html5QrcodeScanner.clear();
        } catch (e) {
            console.warn("Stop failed", e);
        }
    }
    html5QrcodeScanner = null;
    isScanning = false;
    if (overlay) overlay.style.display = 'none';
    if (controlsDiv) controlsDiv.classList.remove('show');
};

const onScanSuccess = async (decodedText) => {
    if (html5QrcodeScanner) {
        html5QrcodeScanner.pause(true);
    }

    const item = state.items.find(i => i.item_code === decodedText);

    if (!item) {
        showNotification(`Barang tidak ditemukan`, 'error');
        setTimeout(() => { if (html5QrcodeScanner) html5QrcodeScanner.resume(); }, 2000);
        return;
    }

    if (item.current_quantity <= 0) {
        showNotification(`Stok ${item.name} habis!`, 'error');
        setTimeout(() => { if (html5QrcodeScanner) html5QrcodeScanner.resume(); }, 2000);
        return;
    }

    await closeScanner();

    const activePage = document.querySelector('.page.active');
    if (!activePage || activePage.id !== 'borrow') {
        await setActivePage('#borrow');
    }

    setTimeout(() => {
        const success = addScannedItemToForm(item.id);
        
        if (success) {
            showNotification(`${item.name} telah ditambahkan`, 'success');
            const container = document.getElementById('borrowItemsContainer');
            if(container) {
                const rows = container.querySelectorAll('.borrow-item-row');
                const lastRow = rows[rows.length - 1];
                if (lastRow) lastRow.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        } else {
            showNotification(`Barang sudah ada di daftar peminjaman.`, 'error');
        }
    }, 100);
};

const onScanFailure = () => {};

if (zoomSlider) {
    zoomSlider.addEventListener('input', (e) => applyZoom(parseFloat(e.target.value)));
}

if (switchBtn) {
    switchBtn.addEventListener('click', async () => {
        if (!isScanning) return;
        switchBtn.disabled = true;
        
        if (availableCameras.length > 0) {
            currentCameraIndex = (currentCameraIndex + 1) % availableCameras.length;
        } else {
            currentCameraIndex = currentCameraIndex === 0 ? 1 : 0;
        }
        updateCameraCount();
        
        await closeScanner(); 
        if (overlay) overlay.style.display = 'flex';
        isScanning = false; 
        await startScanner();
        
        switchBtn.disabled = false;
    });
}

if (cancelBtn) {
    cancelBtn.addEventListener('click', closeScanner);
}