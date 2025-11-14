import { openModal, closeModal, showNotification } from '../utils.js';

/**
 * Menampilkan modal petunjuk instalasi aplikasi desktop.
 * @param {string|null} [activeOs=null] - OS yang tab-nya harus aktif.
 */
export function showDesktopInstructionsModal(activeOs = null) {
    // Tentukan tab mana yang aktif berdasarkan parameter atau default ke Windows
    const isWindowsActive = (!activeOs || activeOs === 'Windows');
    const isLinuxActive = (activeOs === 'Linux');

    openModal('Petunjuk Penggunaan', `
        <div class="modal-tabs">
            <button class="modal-tab ${isWindowsActive ? 'active' : ''}" data-target="windows-instructions">
                <i class='bx bxl-windows'></i> Windows
            </button>
            <button class="modal-tab ${isLinuxActive ? 'active' : ''}" data-target="linux-instructions">
                <i class='bx bxl-tux'></i> Linux
            </button>
        </div>

        <div class="modal-tab-content ${isWindowsActive ? 'active' : ''}" id="windows-instructions">
            <h4>Instalasi di Windows (.exe):</h4>
            <ol>
                <li>Setelah unduhan selesai, buka file <code>.exe</code> yang telah diunduh.</li>
                <li>Ikuti petunjuk instalasi yang muncul di layar.</li>
                <li>Jika muncul peringatan keamanan (seperti Windows SmartScreen), klik <b>More info</b> atau <b>Run anyway</b>. Aplikasi ini aman digunakan.</li>
                <li>Setelah instalasi selesai, Anda dapat menjalankan aplikasi dari Start Menu atau shortcut di Desktop.</li>
            </ol>
            <p class="modal-details" style="margin-top: 1.5rem; font-size: 0.9em;">Aplikasi ini dibuat untuk langsung dapat di-install pada perangkat</p>
        </div>

        <div class="modal-tab-content ${isLinuxActive ? 'active' : ''}" id="linux-instructions">
            <h4>Menjalankan di Linux (.AppImage):</h4>
            <p class="modal-details">File AppImage adalah format aplikasi portabel untuk Linux.</p>
            <ol>
                <li>Setelah unduhan selesai, buka Terminal di direktori tempat Anda menyimpan file <code>.AppImage</code>.</li>
                <li>Berikan izin eksekusi pada file tersebut dengan perintah:
                    <pre><code class="language-bash">sudo chmod +x inventaristkj-linux.AppImage</code></pre>
                </li>
                <li>Jalankan aplikasi. Ada beberapa cara:</li>
                <ul>
                    <li>Klik dua kali pada file <code>inventaristkj-linux.AppImage</code> di file manager Anda.</li>
                    <li>Atau, jalankan melalui Terminal dengan perintah (pastikan Anda tidak sebagai root):
                        <pre><code class="language-bash">./inventaristkj-linux.AppImage --no-sandbox</code></pre>
                         <small>Flag <code>--no-sandbox</code> mungkin diperlukan pada beberapa sistem.</small>
                    </li>
                </ul>
            </ol>
             <p class="modal-details" style="margin-top: 1rem; font-size: 0.9em;">Tidak perlu instalasi, file AppImage bisa langsung dijalankan.</p>
        </div>

        <div class="modal-footer" style="margin-top: 1rem;">
            <button type="button" class="btn btn-secondary" id="backToDownloadBtn">Kembali</button>
        </div>
    `);

    const backBtn = document.getElementById('backToDownloadBtn');
    if (backBtn) {
        backBtn.addEventListener('click', () => {
            closeModal();
            setTimeout(() => {
                showDesktopAppModal();
            }, 300);
        });
    }
    
    const modalContent = document.getElementById('modalBody');
    const tabs = modalContent.querySelectorAll('.modal-tab');
    const tabContents = modalContent.querySelectorAll('.modal-tab-content');

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));

            tab.classList.add('active');
            const targetId = tab.dataset.target;
            const targetContent = modalContent.querySelector(`#${targetId}`);
            if (targetContent) {
                targetContent.classList.add('active');
            }
        });
    });

    if (typeof hljs === 'undefined') {
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.7.0/highlight.min.js';
        script.onload = () => {
            document.querySelectorAll('#linux-instructions pre code').forEach((block) => {
                hljs.highlightElement(block);
            });
        };
        document.body.appendChild(script);
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.7.0/styles/atom-one-dark.min.css';
        document.head.appendChild(link);
    } else {
         document.querySelectorAll('#linux-instructions pre code').forEach((block) => {
            hljs.highlightElement(block);
        });
    }
}

/**
 * Menampilkan modal untuk mengunduh aplikasi desktop (Windows/Linux).
 */
export function showDesktopAppModal() {
    openModal('Aplikasi Desktop', `
        <p class="modal-details">
            Unduh aplikasi Inventaris TKJ untuk desktop.
        </p>
        <p class="modal-details" style="margin-bottom: 1.5rem;">
            Aplikasi akan tetap sama, hanya saja akan bisa di-install pada perangkat.
        </p>
        <div class="desktop-app-options">
            <div class="desktop-app-card">
                 <!-- Menggunakan Boxicons untuk konsistensi -->
                 <i class='bx bxl-windows desktop-app-icon windows'></i>
                 <h3 class="desktop-app-title">Windows</h3>
                 <p class="desktop-app-desc">Unduh <u>.exe</u> untuk Windows 10 & 11 (64-bit).</p>
                 <a href="https://tkjtools.skanesga.com/download/inventaristkj-win.exe" download class="btn btn-primary desktop-app-download-btn" data-os="Windows">
                     <i class='bx bxs-download'></i> Unduh
                 </a>
            </div>
            <div class="desktop-app-card">
                 <!-- Menggunakan Boxicons untuk konsistensi -->
                 <i class='bx bxl-tux desktop-app-icon linux'></i>
                 <h3 class="desktop-app-title">Linux</h3>
                 <p class="desktop-app-desc">Unduh .AppImage.</p>
                 <a href="https://tkjtools.skanesga.com/download/inventaristkj-linux.AppImage" download class="btn btn-primary desktop-app-download-btn" data-os="Linux">
                      <i class='bx bxs-download'></i> Unduh
                 </a>
            </div>
        </div>
        <div class="modal-footer" style="margin-top: 1rem; padding-top: 1.5rem;">
            <button type="button" class="btn btn-secondary close-modal-btn">Keluar</button>
            <button type="button" class="btn btn-primary" id="showInstructionsBtn"><i class='bx bx-info-circle'></i> Petunjuk</button>
        </div>
    `);

    const instructionsBtn = document.getElementById('showInstructionsBtn');
    if (instructionsBtn) {
        instructionsBtn.addEventListener('click', () => {
            showDesktopInstructionsModal();
        });
    }

    document.querySelectorAll('.desktop-app-download-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            const os = e.currentTarget.dataset.os;
            showNotification(`Mengunduh aplikasi desktop untuk ${os}...`, 'success');
            setTimeout(() => {
                showDesktopInstructionsModal(os);
            }, 500);
        });
    });
}