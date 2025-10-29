<?php
/**
 * Endpoint untuk MEMULAI proses impor CSV (Stok, Riwayat, atau Akun).
 * Bertugas memvalidasi file, mendeteksi tipe CSV berdasarkan header,
 * dan membuat file antrian pekerjaan (queue).
 */

// Lokasi file status/antrian.
$status_file_path = dirname(__DIR__) . '/temp/import_status.json';
$temp_dir = dirname($status_file_path);

// --- Validasi Awal ---
if (!isset($_FILES['csv_file']) || $_FILES['csv_file']['error'] !== UPLOAD_ERR_OK) {
    json_response('error', 'File CSV tidak ditemukan atau gagal diunggah.');
}

// Ambil tipe impor yang diharapkan dari frontend.
$expected_type = $_POST['import_type'] ?? null;
if (empty($expected_type) || !in_array($expected_type, ['stock', 'history', 'accounts'])) {
    // Hapus file sementara jika ada sebelum mengirim respons error
    if (isset($_FILES['csv_file']['tmp_name']) && file_exists($_FILES['csv_file']['tmp_name'])) {
        @unlink($_FILES['csv_file']['tmp_name']);
    }
    json_response('error', 'Tipe impor tidak spesifik atau tidak valid. Silakan coba lagi.');
}

// Pastikan direktori 'temp' ada dan bisa ditulisi.
if (!is_dir($temp_dir)) {
    if (!@mkdir($temp_dir, 0775, true)) {
        json_response('error', 'Kritis: Gagal membuat direktori sementara. Periksa izin folder.');
    }
}

// Periksa apakah sudah ada proses impor yang berjalan.
if (file_exists($status_file_path)) {
    $current_status_raw = @file_get_contents($status_file_path);
    $current_status = $current_status_raw ? json_decode($current_status_raw, true) : null;
    if ($current_status && isset($current_status['status']) && $current_status['status'] === 'running') {
        json_response('error', 'Proses impor lain sedang berjalan. Harap tunggu hingga selesai.');
    }
}

$file = $_FILES['csv_file'];

// Validasi tipe file
$mime_type = mime_content_type($file['tmp_name']);
$allowed_mime_types = ['text/csv', 'text/plain', 'application/csv'];
if (!in_array($mime_type, $allowed_mime_types)) {
    json_response('error', 'Tipe file tidak valid. Harap unggah file .csv');
}

// Pindahkan file yang diunggah ke lokasi sementara
$temp_csv_filename = 'import_queue_' . uniqid() . '.csv';
$temp_csv_path = $temp_dir . '/' . $temp_csv_filename;

if (!move_uploaded_file($file['tmp_name'], $temp_csv_path)) {
    json_response('error', 'Gagal memindahkan file CSV ke direktori sementara.');
}


try {
    // --- Deteksi Tipe CSV Berdasarkan Header ---
    $handle = fopen($temp_csv_path, "r");
    if ($handle === false) {
        throw new Exception("Gagal membuka file CSV sementara.");
    }
    $header = fgetcsv($handle);
    fclose($handle); // Tutup file setelah membaca header

    $detected_type = null;
    // Header untuk impor stok (4 kolom)
    $stock_header = ['Nama Barang', 'Jenis Barang', 'Jumlah', 'Link Gambar'];
    // Header untuk impor riwayat (10 kolom dengan urutan baru)
    $history_header = ['NIS', 'Nama Peminjam', 'Kelas', 'Mata Pelajaran', 'Nama Barang', 'Jenis Alat', 'Jumlah', 'Tanggal Pinjam', 'Tanggal Kembali', 'Link Bukti Google Drive'];
    // Header untuk impor akun (4 kolom)
    $account_header = ['NIS', 'Password', 'Nama', 'Kelas'];


    // Lakukan perbandingan sederhana
    if (is_array($header) && count($header) === count($stock_header) && !array_diff($header, $stock_header)) {
        $detected_type = 'stock';
    } elseif (is_array($header) && count($header) === count($history_header) && !array_diff($header, $history_header)) {
        $detected_type = 'history';
    } elseif (is_array($header) && count($header) === count($account_header) && !array_diff($header, $account_header)) {
        $detected_type = 'accounts';
    }
    
    // Validasi tipe file yang diunggah.
    if ($detected_type === null) {
        @unlink($temp_csv_path);
        json_response('error', 'Format CSV tidak dikenali. Pastikan header file sesuai dengan template.');
    }

    if ($detected_type !== $expected_type) {
        @unlink($temp_csv_path);
        $type_map = ['stock' => 'Stok Barang', 'history' => 'Riwayat', 'accounts' => 'Akun'];
        $expected_name = $type_map[$expected_type] ?? 'Tidak Dikenali';
        $detected_name = $type_map[$detected_type] ?? 'Tidak Dikenali';
        json_response('error', "File salah! Anda mencoba mengunggah file '{$detected_name}' ke dalam fitur impor '{$expected_name}'.");
    }

    // Jika validasi lolos, lanjutkan dengan tipe yang terdeteksi.
    $import_type = $detected_type;

    // --- Buat Antrian Pekerjaan ---
    $handle = fopen($temp_csv_path, "r");
    fgetcsv($handle); // Lewati header lagi
    
    $jobs = [];
    $row_number = 1;
    while (($data = fgetcsv($handle, 2000, ",")) !== false) {
        if (!empty(array_filter($data))) {
            $jobs[] = [
                'id' => uniqid('job_'),
                'row_number' => $row_number,
                'data_preview' => $data[1] ?? ($data[0] ?? 'N/A'), // Gunakan nama jika ada, jika tidak, NIS
                'status' => 'pending',
                'message' => null,
            ];
        }
        $row_number++;
    }
    fclose($handle);

    if (empty($jobs)) {
        @unlink($temp_csv_path);
        json_response('error', 'File CSV kosong atau tidak memiliki data yang valid.');
    }
    
    $total_rows = count($jobs);
    $initial_status = [
        'status' => 'running',
        'import_type' => $import_type,
        'csv_file' => $temp_csv_filename,
        'total' => $total_rows,
        'processed' => 0,
        'success' => 0,
        'failed' => 0,
        'startTime' => date('c'),
        'endTime' => null,
        'log' => [
            ['time' => date('H:i:s'), 'message' => "Impor {$import_type} dimulai. Ditemukan {$total_rows} baris data.", 'status' => 'info']
        ],
        'jobs' => $jobs
    ];

    if (@file_put_contents($status_file_path, json_encode($initial_status, JSON_PRETTY_PRINT)) === false) {
        throw new Exception("Gagal menulis file status. Periksa izin folder 'temp'.");
    }

    json_response('success', 'Proses impor berhasil dimulai.');

} catch (Exception $e) {
    if (file_exists($temp_csv_path)) @unlink($temp_csv_path);
    error_log('CSV Import Initiation Error: ' . $e->getMessage());
    json_response('error', 'Gagal memulai proses impor: ' . $e->getMessage());
}