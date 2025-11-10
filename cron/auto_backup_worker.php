<?php
// Worker Asynchronous. Membuat .zip, mengunggah, dan membersihkan.

// Pastikan file ini hanya bisa dijalankan dari CLI.
if (php_sapi_name() !== 'cli') {
    die('Akses ditolak. Skrip ini hanya boleh dijalankan dari CLI.');
}

set_time_limit(0);

// --- PATHS & CONFIG ---
$rootPath = realpath(dirname(__DIR__));
if (!$rootPath) {
    die("Error: Tidak dapat menentukan root path aplikasi.");
}

$tempDir = $rootPath . '/temp';
$statusFile = $tempDir . '/autobackup_status.json';

// Pastikan kita bisa menulis ke file status
if (!is_writable($tempDir) || (file_exists($statusFile) && !is_writable($statusFile))) {
    error_log("AutoBackup Worker Error: Direktori /temp atau file status tidak dapat ditulis.");
    die("Directory /temp or status file not writable.");
}

// Muat koneksi DB dan helper
require $rootPath . '/config/connect.php';
require $rootPath . '/api/helpers/google_drive_uploader.php';

// --- FILE STATUS HELPER ---
/**
 * Fungsi helper untuk memperbarui file status JSON.
 * @param string $status ('running', 'complete', 'error')
 * @param string $logMessage Pesan log baru.
 * @param string $logStatus ('info', 'success', 'error')
 */
function updateStatus($status, $logMessage, $logStatus = 'info') {
    global $statusFile;
    $statusData = ['status' => 'running', 'log' => []];
    if (file_exists($statusFile)) {
        $statusData = json_decode(@file_get_contents($statusFile), true) ?: $statusData;
    }
    
    $statusData['status'] = $status;
    if ($logMessage) {
        $statusData['log'][] = ['time' => date('H:i:s'), 'message' => $logMessage, 'status' => $logStatus];
    }
    
    @file_put_contents($statusFile, json_encode($statusData, JSON_PRETTY_PRINT));
}

// --- ZIP HELPER ---
function addFolderToZip($zip, $folderPath, $archivePath, $rootAppPath, $tempPath) {
    $realFolderPath = realpath($folderPath);
    $realRootAppPath = realpath($rootAppPath);
    $realTempPath = realpath($tempPath);

    // Pastikan folder ada dan berada di dalam root aplikasi
    if (!$realFolderPath || strpos($realFolderPath, $realRootAppPath) !== 0) {
        updateStatus('running', "Peringatan: Path folder tidak valid atau tidak aman: $folderPath", 'warning');
        return;
    }
    // Pastikan kita tidak men-zip folder temp itu sendiri
    if ($realTempPath && strpos($realFolderPath, $realTempPath) === 0) {
        updateStatus('running', "Peringatan: Melewatkan folder temp.", 'warning');
        return;
    }
    
    $zip->addEmptyDir($archivePath); // Buat direktori di dalam zip

    $files = new RecursiveIteratorIterator(
        new RecursiveDirectoryIterator($realFolderPath, RecursiveDirectoryIterator::SKIP_DOTS),
        RecursiveIteratorIterator::SELF_FIRST
    );

    foreach ($files as $file) {
        if ($file->isDir()) {
            $zip->addEmptyDir($archivePath . '/' . $files->getSubPathName());
        } else {
            $zip->addFile($file->getRealPath(), $archivePath . '/' . $files->getSubPathName());
        }
    }
    updateStatus('running', "Menambahkan folder: $archivePath", 'info');
}


// --- MAIN WORKER LOGIC ---

$zipName = 'autobackup-' . date('Y-m-d_H-i-s') . '.zip';
$zipPath = $tempDir . '/' . $zipName;
$sqlPath = $tempDir . '/db_dump.sql';
$csvHistoryPath = $tempDir . '/report-history.csv';
$csvStockPath = $tempDir . '/report-stock.csv';
$csvAccountsPath = $tempDir . '/report-accounts.csv';

// File-file ini akan dihapus di blok 'finally'
$tempFiles = [$zipPath, $sqlPath, $csvHistoryPath, $csvStockPath, $csvAccountsPath];

try {
    // --- Dump SQL ---
    updateStatus('running', 'Membuat dump database...', 'info');
    $dumpCommand = sprintf(
        "mysqldump -u %s -p%s -h %s %s > %s",
        escapeshellarg(DB_USER_CONFIG),
        escapeshellarg(DB_PASS_CONFIG),
        escapeshellarg(DB_HOST_CONFIG),
        escapeshellarg(DB_NAME_CONFIG),
        escapeshellarg($sqlPath)
    );
    shell_exec($dumpCommand);
    if (!file_exists($sqlPath) || filesize($sqlPath) === 0) {
        throw new Exception("Gagal membuat dump SQL. Periksa kredensial DB dan 'mysqldump'.");
    }

    // --- Generate 3 CSV ---
    updateStatus('running', 'Membuat laporan CSV...', 'info');
    
    // CSV Riwayat
    $csv_fp = fopen($csvHistoryPath, 'w');
    fputcsv($csv_fp, ['NIS', 'Nama Peminjam', 'Kelas', 'Mata Pelajaran', 'Nama Barang', 'Jenis Alat', 'Jumlah', 'Tanggal Pinjam', 'Tanggal Kembali', 'Link Bukti']);
    $stmt = $pdo->query("SELECT u.nis, h.borrower_name, h.borrower_class, h.subject, i.name as item_name, i.classifier, h.quantity, h.borrow_date, h.return_date, h.proof_image_url FROM history h JOIN items i ON h.item_id = i.id LEFT JOIN users u ON h.user_id = u.id ORDER BY h.return_date DESC");
    while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) { fputcsv($csv_fp, $row); }
    fclose($csv_fp);

    // CSV Stok
    $csv_fp = fopen($csvStockPath, 'w');
    fputcsv($csv_fp, ['Nama Barang', 'Jenis Barang', 'Jumlah Total', 'Jumlah Tersedia', 'Link Gambar']);
    $stmt = $pdo->query("SELECT name, classifier, total_quantity, current_quantity, image_url FROM items ORDER BY classifier, name");
    while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) { fputcsv($csv_fp, $row); }
    fclose($csv_fp);

    // CSV Akun
    $csv_fp = fopen($csvAccountsPath, 'w');
    fputcsv($csv_fp, ['NIS', 'Username', 'Nama', 'Kelas', 'Role']);
    $stmt = $pdo->query("SELECT u.nis, u.username, u.nama, c.name as kelas, u.role FROM users u LEFT JOIN classes c ON u.kelas = c.id ORDER BY u.role, u.nama");
    while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) { fputcsv($csv_fp, $row); }
    fclose($csv_fp);

    // --- Kompresi .zip ---
    updateStatus('running', 'Mengompresi file ke .zip...', 'info');
    $zip = new ZipArchive();
    if ($zip->open($zipPath, ZipArchive::CREATE) !== TRUE) {
        throw new Exception("Gagal membuat file ZIP.");
    }
    
    $zip->addFile($sqlPath, 'db_dump.sql');
    $zip->addFile($csvHistoryPath, 'laporan/report-history.csv');
    $zip->addFile($csvStockPath, 'laporan/report-stock.csv');
    $zip->addFile($csvAccountsPath, 'laporan/report-accounts.csv');
    
    // Tambahkan folder bukti dan gambar
    addFolderToZip($zip, $rootPath . '/public/assets/evidence', 'bukti_pinjam', $rootPath, $tempDir);
    addFolderToZip($zip, $rootPath . '/public/assets/img', 'gambar_barang', $rootPath, $tempDir);

    $zip->close();
    updateStatus('running', 'Kompresi ZIP selesai.', 'info');

    // --- Unggah .zip ---
    updateStatus('running', 'Mengunggah ke Google Drive...', 'info');
    $logCallback = function($msg) {
        updateStatus('running', $msg, 'info');
    };
    
    $subfolderName = null;

    $result = upload_single_file_to_drive(
        $zipPath, 
        'application/zip', 
        GOOGLE_DRIVE_AUTOBACKUP_FOLDER_ID, 
        $subfolderName,
        $logCallback
    );

    if ($result['status'] !== 'success') {
        throw new Exception('Upload gagal: ' . $result['message']);
    }

    // --- Selesai ---
    updateStatus('complete', 'Backup Selesai! URL: ' . $result['url'], 'success');
    
    // Update status di DB
    $pdo->exec("UPDATE settings SET setting_value = 'idle' WHERE setting_key = 'autobackup_status'");
    $pdo->exec("UPDATE settings SET setting_value = NOW() WHERE setting_key = 'autobackup_last_run'");

} catch (Exception $e) {
    // Tangani error
    $errorMessage = $e->getMessage();
    error_log("AutoBackup Worker Error: " . $errorMessage);
    updateStatus('error', $errorMessage, 'error');
    $pdo->exec("UPDATE settings SET setting_value = 'error' WHERE setting_key = 'autobackup_status'");

} finally {
    // --- Cleanup (Zero Footprint) ---
    foreach ($tempFiles as $file) {
        if (file_exists($file)) {
            @unlink($file);
        }
    }
}