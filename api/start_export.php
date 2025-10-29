<?php
// Endpoint untuk MEMULAI proses ekspor (Stok atau Akun).
// Bertugas untuk membuat daftar antrian pekerjaan (queue).

$export_type = $_POST['export_type'] ?? null;

if (empty($export_type) || !in_array($export_type, ['stock', 'accounts'])) {
    json_response('error', 'Tipe ekspor tidak valid.');
}

$status_file_path = dirname(__DIR__) . '/temp/export_status.json';
$temp_dir = dirname($status_file_path);

if (!is_dir($temp_dir)) {
    if (!@mkdir($temp_dir, 0775, true)) {
        json_response('error', 'Kritis: Gagal membuat direktori sementara. Periksa izin folder.');
    }
}

if (file_exists($status_file_path)) {
    $current_status_raw = @file_get_contents($status_file_path);
    $current_status = $current_status_raw ? json_decode($current_status_raw, true) : null;
    if ($current_status && isset($current_status['status']) && $current_status['status'] === 'running') {
        json_response('error', 'Proses ekspor lain sedang berjalan. Harap tunggu hingga selesai.');
    }
}

try {
    $jobs = [];
    $log_message = '';

    if ($export_type === 'stock') {
        // Logika untuk ekspor stok
        $stmt = $pdo->query("SELECT id, image_url FROM items WHERE image_url IS NOT NULL AND image_url != '' AND image_url != 'assets/favicon/dummy.jpg'");
        $items_with_images = $stmt->fetchAll(PDO::FETCH_ASSOC);

        if (empty($items_with_images)) {
            json_response('error', 'Tidak ada barang dengan gambar untuk diekspor.');
        }

        foreach ($items_with_images as $item) {
            $jobs[] = [
                'type' => 'image',
                'id' => uniqid('job_'),
                'item_id' => $item['id'],
                'local_path' => ltrim($item['image_url'], '/'),
                'status' => 'pending', 'drive_url' => null, 'message' => null, 'timestamp' => null
            ];
        }
        $log_message = "Ekspor stok dimulai. Ditemukan " . count($jobs) . " file gambar.";
    } elseif ($export_type === 'accounts') {
        // Logika baru untuk ekspor akun
        $stmt = $pdo->query("SELECT COUNT(*) FROM users WHERE role = 'user'");
        if ($stmt->fetchColumn() == 0) {
            json_response('error', 'Tidak ada akun siswa untuk diekspor.');
        }
        // Untuk ekspor akun, tidak ada pekerjaan upload file individual, hanya pembuatan CSV di akhir.
        $jobs = [];
        $log_message = "Ekspor akun siswa dimulai...";
    }
    
    $total_jobs = count($jobs);
    $initial_status = [
        'status' => 'running',
        'export_type' => $export_type,
        'total' => $total_jobs,
        'processed' => 0,
        'success' => 0,
        'failed' => 0,
        'startTime' => date('c'),
        'endTime' => null,
        'csv_url' => null,
        'log' => [['time' => date('H:i:s'), 'message' => $log_message, 'status' => 'info']],
        'jobs' => $jobs
    ];

    if (@file_put_contents($status_file_path, json_encode($initial_status, JSON_PRETTY_PRINT)) === false) {
        throw new Exception("Gagal menulis file status. Periksa izin folder 'temp'.");
    }

    json_response('success', 'Proses ekspor berhasil dimulai.');

} catch (Exception $e) {
    error_log('Export Initiation Error: ' . $e->getMessage());
    json_response('error', 'Gagal memulai proses ekspor: ' . $e->getMessage());
}