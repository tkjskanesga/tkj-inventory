<?php
// Endpoint untuk MEMULAI proses backup.
// Bertugas untuk membuat daftar antrian pekerjaan (queue).

require_admin();

// Lokasi file status/antrian.
$status_file_path = dirname(dirname(__DIR__)) . '/temp/backup_status.json';
$temp_dir = dirname($status_file_path);

// Pastikan direktori 'temp' ada dan bisa ditulisi.
if (!is_dir($temp_dir)) {
    if (!@mkdir($temp_dir, 0775, true)) {
        header('Content-Type: application/json');
        json_response('error', 'Kritis: Gagal membuat direktori sementara. Periksa izin folder.');
        exit();
    }
}

// Periksa apakah sudah ada proses backup yang berjalan.
if (file_exists($status_file_path)) {
    $current_status_raw = @file_get_contents($status_file_path);
    $current_status = $current_status_raw ? json_decode($current_status_raw, true) : null;
    if ($current_status && isset($current_status['status']) && $current_status['status'] === 'running') {
        header('Content-Type: application/json');
        json_response('error', 'Proses backup lain sedang berjalan. Harap tunggu hingga selesai.');
        exit();
    }
}

try {
    // Ambil semua data riwayat untuk menemukan file bukti yang unik.
    $stmt = $pdo->query("
        SELECT COUNT(DISTINCT transaction_id) 
        FROM history 
        WHERE proof_image_url IS NOT NULL AND proof_image_url != '' AND transaction_id IS NOT NULL
    ");
    $total_files = $stmt->fetchColumn();

    if (empty($total_files) || $total_files == 0) {
        json_response('error', 'Tidak ada data riwayat dengan bukti foto untuk di-backup.');
        exit();
    }
    
    $initial_status = [
        'status' => 'running',
        'total' => (int)$total_files,
        'processed' => 0,
        'success' => 0,
        'failed' => 0,
        'page' => 1,
        'startTime' => date('c'),
        'endTime' => null,
        'csv_url' => null,
        'log' => [
            ['time' => date('H:i:s'), 'message' => "Backup dimulai. Ditemukan {$total_files} file bukti unik.", 'status' => 'info']
        ],
        'drive_urls_map' => []
    ];

    // Simpan file antrian ke disk.
    if (@file_put_contents($status_file_path, json_encode($initial_status, JSON_PRETTY_PRINT)) === false) {
        throw new Exception("Gagal menulis file status. Periksa izin folder 'temp'.");
    }

    // Kirim respons ke frontend bahwa proses telah dimulai.
    json_response('success', 'Proses backup berhasil dimulai.');

} catch (Exception $e) {
    error_log('Backup Initiation Error: ' . $e->getMessage());
    json_response('error', 'Gagal memulai proses backup: ' . $e->getMessage());
}