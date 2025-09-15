<?php
    // Memulai sesi jika belum ada
    if (session_status() == PHP_SESSION_NONE) {
        session_start();
    }

    // Mencegah browser menyimpan halaman ini di cache
    header("Cache-Control: no-store, no-cache, must-revalidate, max-age=0");
    header("Cache-control: post-check=0, pre-check=0", false);
    header("Pragma: no-cache");

    // Memeriksa apakah pengguna sudah login. Jika tidak, arahkan ke login.
    if (!isset($_SESSION['user_id'])) {
        header("Location: login.html");
        exit();
    }
    
    // Simpan peran pengguna untuk digunakan di seluruh halaman
    $user_role = $_SESSION['role'] ?? 'user';
?>
<!DOCTYPE html>
<html lang="id"> <!-- Class 'dark' ditambahkan oleh JS untuk mode gelap -->
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Inventaris TKJ</title>
    <!-- Stylesheets -->
    <link rel="stylesheet" href="assets/css/style.css">
    <link rel="stylesheet" href="assets/css/style-dark.css">
    <link rel="stylesheet" href="assets/css/style-chart.css">
    <!-- Favicon & Icons -->
    <link rel="shortcut icon" href="assets/favicon/favicon.png" type="image/x-icon">
    <link href='https://unpkg.com/boxicons@2.1.4/css/boxicons.min.css' rel='stylesheet'>
    <!-- Google Fonts -->
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
    <!-- Chart.js CDN -->
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
</head>
<body data-role="<?php echo htmlspecialchars($user_role); ?>">
    <div id="loadingOverlay" class="loading-overlay">
        <div class="loading-spinner"></div>
    </div>

    <!-- Elemen notifikasi global -->
    <div id="notification" class="notification"></div>

    <!-- Header & Navigasi Utama -->
    <header class="header">
        <div class="header__container">
            <a href="#stock" class="header__logo">
                <i class='bx bxs-cube-alt'></i>
                <span>Inventaris <span class="logo-TKJ">TKJ</span></span>
            </a>

            <div class="header__nav-actions">
                <!-- Navigasi untuk Desktop -->
                <nav class="nav" id="desktopNav">
                    <ul class="nav__list">
                        <li class="nav__item"><a href="#stock" class="nav__link active">Stok</a></li>
                        <li class="nav__item"><a href="#borrow" class="nav__link">Peminjaman</a></li>
                        <li class="nav__item"><a href="#return" class="nav__link">Pengembalian</a></li>
                        <li class="nav__item"><a href="#history" class="nav__link">Riwayat</a></li>
                        <?php if ($user_role === 'admin'): ?>
                        <li class="nav__item"><a href="#statistics" class="nav__link">Statistik</a></li>
                        <?php endif; ?>
                    </ul>
                </nav>

                <!-- Dropdown Profil Pengguna (Desktop) -->
                <div class="profile-dropdown" id="userProfileDropdown" style="display: none;">
                    <button class="profile-dropdown__toggle" id="userProfileToggle" aria-haspopup="true" aria-expanded="false">
                        <i class='bx bxs-user-circle'></i>
                        <span id="usernameDisplay" class="profile-dropdown__username"></span>
                        <i class='bx bx-chevron-down profile-dropdown__arrow'></i>
                    </button>
                    <div class="profile-dropdown__menu" id="userProfileMenu" role="menu">
                        <!-- Tombol Ganti Tema untuk Desktop -->
                        <button class="profile-dropdown__item" id="desktopThemeToggle" role="menuitem">
                            <i class='bx bx-moon theme-toggle-icon'></i>
                            <span class="theme-toggle-text">Tema Gelap</span>
                        </button>
                        <!-- Tombol Akun (Hanya Admin) -->
                        <?php if ($user_role === 'admin'): ?>
                        <button class="profile-dropdown__item" id="accountBtn" role="menuitem">
                            <i class='bx bx-cog'></i>
                            <span>Akun</span>
                        </button>
                        <?php endif; ?>
                        <!-- Tombol Logout -->
                        <button class="profile-dropdown__item is-logout" id="dropdownLogoutBtn" role="menuitem">
                            <i class='bx bx-log-out'></i>
                            <span>Logout</span>
                        </button>
                    </div>
                </div>

                <!-- Tombol menu untuk Mobile -->
                <button class="hamburger" id="hamburgerMenu" aria-label="Buka menu">
                    <i class='bx bx-menu'></i>
                </button>
            </div>
        </div>
    </header>

    <!-- Sidebar -->
    <aside class="sidebar" id="sidebar">
        <div class="sidebar__header">
            <div id="mobileUserProfileContainer"></div>
            <button class="close-sidebar-btn" id="closeSidebar" aria-label="Tutup menu">
                <i class='bx bx-chevron-right'></i>
            </button>
        </div>
        <nav class="sidebar__nav" id="sidebarNavContainer">
            <!-- Navigasi & toggle tema dimuat oleh JS -->
        </nav>
        <div class="sidebar__footer" id="sidebarFooterContainer">
            <!-- Tombol logout dimuat di sini oleh JS -->
        </div>
    </aside>
    <div class="overlay" id="overlay"></div>


    <!-- Konten Utama Aplikasi -->
    <main class="main-content">
        <!-- Halaman 1: Stok Barang -->
        <section id="stock" class="page active">
            <div class="page__header">
                <h2 class="page-title">Stok Barang</h2>
                <div class="page__actions">
                    <div class="search-bar">
                        <i class='bx bx-search'></i>
                        <input type="text" id="stockSearch" placeholder="Cari barang...">
                    </div>
                    <div class="filter-dropdown">
                        <button id="filterBtn" class="btn"><i class='bx bx-filter-alt'></i> Filter</button>
                        <ul id="filterOptions" class="filter-dropdown__menu">
                            <li data-filter="all">Semua</li>
                            <li data-filter="available">Tersedia</li>
                            <li data-filter="empty">Kosong</li>
                        </ul>
                    </div>
                </div>
            </div>
            <div id="stockGrid" class="grid-container">
                <!-- Data stok barang dimuat oleh JS -->
            </div>
        </section>

        <!-- Halaman 2: Form Peminjaman -->
        <section id="borrow" class="page">
            <div class="page__header">
                <h2 class="page-title">Form Peminjaman</h2>
                <div id="liveClock" class="live-clock"></div>
                 <?php if ($user_role === 'admin'): ?>
                <div class="page__actions">
                    <button id="borrowSettingsBtn" class="btn btn-success action-btn" title="Pengaturan Peminjaman">
                        <i class='bx bxs-cog'></i>
                    </button>
                </div>
                <?php endif; ?>
            </div>
            <div class="form-container">
                <form id="borrowForm" class="form-card">
                    <div class="form-group">
                        <label for="borrowerName">Nama Peminjam</label>
                        <input type="text" id="borrowerName" name="borrower_name" required>
                    </div>
                    <div class="form-group">
                        <label>Kelas</label>
                        <div class="custom-dropdown" id="classDropdownContainer">
                            <input type="hidden" id="borrowerClassValue" name="borrower_class" required>
                            <button type="button" class="custom-dropdown__selected" aria-haspopup="listbox" aria-expanded="false">
                                <span class="custom-dropdown__placeholder">Pilih Kelas</span>
                                <div class="custom-dropdown__value"></div>
                                <i class='bx bx-chevron-down custom-dropdown__arrow'></i>
                            </button>
                            <div class="custom-dropdown__options" role="listbox"></div>
                        </div>
                    </div>
                     <div class="form-group">
                        <label for="subject">Tujuan (Mapel)</label>
                        <input type="text" id="subject" name="subject" required>
                    </div>
                    <div class="form-group">
                        <label>Alat yang Dipinjam</label>
                        <div class="custom-dropdown" id="itemDropdownContainer">
                            <input type="hidden" id="borrowItemId" name="item_id" required>
                            <button type="button" class="custom-dropdown__selected" aria-haspopup="listbox" aria-expanded="false">
                                <span class="custom-dropdown__placeholder">Pilih Alat</span>
                                <div class="custom-dropdown__value"></div>
                                <i class='bx bx-chevron-down custom-dropdown__arrow'></i>
                            </button>
                            <div class="custom-dropdown__options" role="listbox"></div>
                        </div>
                    </div>
                    <div class="form-group">
                        <label for="borrowQuantity">Jumlah</label>
                        <input type="number" id="borrowQuantity" name="quantity" min="1" required>
                        <small id="maxQuantity" class="form-text"></small>
                    </div>
                    <button type="submit" class="btn btn-primary btn-block">Pinjam</button>
                </form>
            </div>
        </section>

        <!-- Halaman 3: Pengembalian Barang -->
        <section id="return" class="page">
            <div class="page__header">
                <h2 class="page-title">Peminjaman Aktif</h2>
                 <div class="page__actions">
                    <div class="search-bar">
                        <i class='bx bx-search'></i>
                        <input type="text" id="returnSearch" placeholder="Cari peminjaman...">
                    </div>
                </div>
            </div>
            <div id="returnGrid" class="list-container">
                <!-- Data peminjaman aktif dimuat oleh JS -->
            </div>
        </section>

        <!-- Halaman 4: Riwayat -->
        <section id="history" class="page">
             <div class="page__header">
                <h2 class="page-title">Riwayat Pengembalian</h2>
                <div class="page__actions">
                    <div class="search-bar">
                        <i class='bx bx-search'></i>
                        <input type="text" id="historySearch" placeholder="Cari riwayat...">
                    </div>
                    <?php if ($user_role === 'admin'): ?>
                    <div style="display: flex; gap: 1rem;">
                        <button id="exportHistoryBtn" class="btn btn-success action-btn" title="Ekspor Riwayat (CSV)">
                            <i class='bx bxs-file-export'></i>
                        </button>
                        <button id="flushHistoryBtn" class="btn btn-danger action-btn" title="Bersihkan Riwayat">
                            <i class='bx bxs-trash-alt'></i>
                        </button>
                    </div>
                    <?php endif; ?>
                </div>
            </div>
            <div id="historyGrid" class="list-container">
                <!-- Data riwayat dimuat oleh JS -->
            </div>
            <div id="historyLoaderContainer" class="loader-container"></div>
        </section>

        <?php if ($user_role === 'admin'): ?>
        <section id="statistics" class="page">
            <div class="page__header">
                <h2 class="page-title">Dasbor Statistik</h2>
            </div>
            <div class="stats-grid">
                <!-- Diagram Lingkaran: Peminjaman per Kelas -->
                <div class="chart-container">
                    <div class="chart-header">
                        <h3 class="chart-title">Sering Meminjam</h3>
                    </div>
                    <div class="chart-canvas-container" id="classBorrowalsChartContainer">
                        <canvas id="classBorrowalsChart"></canvas>
                    </div>
                </div>

                <!-- Diagram Batang: Peminjaman Aktif -->
                <div class="chart-container">
                    <div class="chart-header">
                        <h3 class="chart-title">Sedang Dipinjam</h3>
                        <div class="chart-filter-toggle" id="currentLoansFilter">
                            <button class="btn" data-value="name">Nama Alat</button>
                            <button class="btn active" data-value="classifier">Jenis Alat</button>
                        </div>
                    </div>
                     <div class="chart-canvas-container" id="currentLoansChartContainer">
                        <canvas id="currentLoansChart"></canvas>
                    </div>
                </div>

                <!-- Diagram Garis: Riwayat Peminjaman Teratas -->
                <div class="chart-container full-width">
                    <div class="chart-header">
                        <h3 class="chart-title"><span class="chart-title-info">Top 10</span> Sering Dipinjam</h3>
                        <div class="chart-filter-toggle" id="loanHistoryFilter">
                            <button class="btn" data-value="name">Nama Alat</button>
                            <button class="btn active" data-value="classifier">Jenis Alat</button>
                        </div>
                    </div>
                    <div class="chart-canvas-container" id="loanHistoryChartContainer">
                        <canvas id="loanHistoryChart"></canvas>
                    </div>
                </div>
            </div>
        </section>
        <?php endif; ?>
    </main>
    
    <!-- Tombol Aksi Mengambang (FAB) -->
    <?php if ($user_role === 'admin'): ?>
    <button id="fabAddItemBtn" class="fab" title="Tambah Barang Baru">
        <i class='bx bx-plus'></i>
    </button>
    <?php endif; ?>
    <button id="fabFilterDateBtn" class="fab" title="Filter Berdasarkan Tanggal">
        <i class='bx bx-calendar'></i>
    </button>

    <!-- Modal Universal -->
    <div id="modal" class="modal">
        <div class="modal-content">
            <div class="modal-header">
                <h2 id="modalTitle"></h2>
                <button class="close-modal-btn">&times;</button>
            </div>
            <div class="modal-body" id="modalBody">
                <!-- Konten modal dinamis dimuat oleh JS -->
            </div>
        </div>
    </div>
    
    <!-- Overlay Kunci Peminjaman -->
    <div id="lockOverlay" class="lock-overlay">
        <div class="lock-overlay__content">
            <i class='bx bxs-time-five lock-overlay__icon'></i>
            <h2 id="lockOverlayTitle">Peminjaman Ditutup</h2>
            <p id="lockOverlayMessage">Peminjaman akan dibuka kembali dalam:</p>
            <div class="countdown" id="countdown">
                <div class="countdown__card">
                    <span id="countdown-days">00</span>
                    <small>Hari</small>
                </div>
                <div class="countdown__card">
                    <span id="countdown-hours">00</span>
                    <small>Jam</small>
                </div>
                <div class="countdown__card">
                    <span id="countdown-minutes">00</span>
                    <small>Menit</small>
                </div>
                <div class="countdown__card">
                    <span id="countdown-seconds">00</span>
                    <small>Detik</small>
                </div>
            </div>
            <p class="lock-overlay__info">Peminjaman mulai pukul <span id="borrowingHours">00:00 - 00:00</span> WIB</p>
            <a class="back-to-login_page" href="./login.html"><i class='bx bx-arrow-back'></i> Kembali</a>
        </div>
    </div>

    <!-- Skrip Utama Aplikasi -->
    <script type="module" src="assets/js/app.js" defer></script>
</body>
</html>