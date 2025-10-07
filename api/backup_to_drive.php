<?php
// Endpoint untuk proses backup riwayat dan file bukti ke Google Drive, menggunakan streaming response + status file.

require_admin();

// --- SETUP FILE STATUS ---
$status_file_path = dirname(__DIR__) . '/temp/backup_status.json';
$temp_dir = dirname($status_file_path);

if (!is_dir($temp_dir)) {
    if (!@mkdir($temp_dir, 0775, true)) {
        header('Content-Type: application/json');
        json_response('error', 'Gagal membuat direktori sementara untuk status backup.');
    }
}

if (file_exists($status_file_path)) {
    $current_status_raw = @file_get_contents($status_file_path);
    $current_status = $current_status_raw ? json_decode($current_status_raw, true) : null;
    if ($current_status && isset($current_status['status']) && $current_status['status'] === 'running') {
        header('Content-Type: application/json');
        json_response('error', 'Proses backup lain sedang berjalan. Harap tunggu hingga selesai.');
    }
}

// --- SETUP STREAMING HEADERS ---
header('Content-Type: application/json');
header('X-Content-Type-Options: nosniff');
header('Cache-Control: no-cache');
header('X-Accel-Buffering: no');

@ini_set('zlib.output_compression', 0);
@ini_set('implicit_flush', 1);
@ob_end_clean();
set_time_limit(0);
ob_implicit_flush(true);

function update_and_stream_status($data) {
    global $status_file_path;
    $current_status_raw = @file_get_contents($status_file_path);
    $current_status = $current_status_raw ? json_decode($current_status_raw, true) : [];
    
    // Gabungkan data baru ke status saat ini
    $updated_status = array_merge($current_status, $data);

    // Jika ada log_entry baru, tambahkan ke array log utama
    if (isset($data['log_entry'])) {
        if (!isset($updated_status['log'])) $updated_status['log'] = [];
        $updated_status['log'][] = $data['log_entry'];
        // Hapus log_entry individu karena sudah masuk ke array log
        unset($updated_status['log_entry']);
    }
    
    // Simpan status yang sudah lengkap ke file
    @file_put_contents($status_file_path, json_encode($updated_status, JSON_PRETTY_PRINT));

    // Kirim status yang sudah lengkap ke client
    echo json_encode($updated_status) . "\n";
    ob_flush();
    flush();
}


function upload_file_to_drive($filePath) {
    if (!file_exists($filePath) || !is_readable($filePath)) {
        return ['status' => 'error', 'message' => 'File lokal tidak ditemukan atau tidak bisa dibaca.'];
    }
    $postData = [
        'secret'   => GOOGLE_SCRIPT_SECRET,
        'file'     => base64_encode(file_get_contents($filePath)),
        'filename' => basename($filePath),
        'mimetype' => mime_content_type($filePath)
    ];
    $ch = curl_init(GOOGLE_SCRIPT_URL);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => 1, CURLOPT_POST => 1, CURLOPT_POSTFIELDS => $postData,
        CURLOPT_FOLLOWLOCATION => true, CURLOPT_TIMEOUT => 300 // Timeout 5 menit
    ]);
    $response = curl_exec($ch);
    $error = curl_error($ch);
    curl_close($ch);
    if ($error) return ['status' => 'error', 'message' => 'cURL Error: ' . $error];
    return json_decode($response, true);
}

// --- PROSES UTAMA BACKUP ---
$csv_filename = 'backup_riwayat_' . date('Y-m-d_H-i-s') . '.csv';
$temp_csv_path = $temp_dir . '/' . $csv_filename;

try {
    $initial_status = ['status' => 'running', 'progress' => 0, 'total' => 0, 'log' => [], 'startTime' => date('c'), 'csv_url' => null, 'error' => null];
    @file_put_contents($status_file_path, json_encode($initial_status, JSON_PRETTY_PRINT));

    // Menggunakan urutan yang sama persis dengan fitur ekspor CSV untuk konsistensi.
    $stmt = $pdo->query("SELECT h.id, h.transaction_id, h.proof_image_url, i.name as item_name, i.classifier, h.borrower_name, h.borrower_class, h.subject, h.quantity, h.borrow_date, h.return_date FROM history h JOIN items i ON h.item_id = i.id ORDER BY h.return_date DESC, h.transaction_id DESC");
    $history_records = $stmt->fetchAll(PDO::FETCH_ASSOC);

    if (empty($history_records)) {
        throw new Exception("Tidak ada data riwayat untuk di-backup.");
    }
    
    $unique_proofs = [];
    foreach ($history_records as $record) {
        if (!empty($record['transaction_id']) && !empty($record['proof_image_url'])) {
            $unique_proofs[$record['transaction_id']] = $record['proof_image_url'];
        }
    }
    
    $total_files = count($unique_proofs);
    update_and_stream_status(['type' => 'start', 'total' => $total_files, 'log_entry' => ['time' => date('H:i:s'), 'message' => "Ditemukan {$total_files} file bukti unik.", 'status' => 'info']]);

    $processed_files = 0;
    $drive_urls_by_transaction = [];

    foreach ($unique_proofs as $transaction_id => $proof_url) {
        $processed_files++;
        $local_path = dirname(__DIR__) . '/public/' . ltrim($proof_url, '/');
        $upload_result = upload_file_to_drive($local_path);
        
        $log_entry = [];
        if (isset($upload_result['status']) && $upload_result['status'] === 'success') {
            $drive_urls_by_transaction[$transaction_id] = $upload_result['url'];
            $log_entry = ['time' => date('H:i:s'), 'message' => basename($local_path), 'status' => 'success'];
        } else {
            $error_message = $upload_result['message'] ?? 'Unknown error';
            $drive_urls_by_transaction[$transaction_id] = 'GAGAL_UPLOAD: ' . $error_message;
            $log_entry = ['time' => date('H:i:s'), 'message' => basename($local_path) . " - Gagal: " . $error_message, 'status' => 'error'];
        }
        update_and_stream_status(['type' => 'progress', 'current' => $processed_files, 'total' => $total_files, 'progress' => $processed_files, 'log_entry' => $log_entry]);
    }

    update_and_stream_status(['type' => 'log', 'log_entry' => ['time' => date('H:i:s'), 'message' => 'Semua bukti selesai diunggah. Membuat file CSV...', 'status' => 'info']]);
    
    $csv_data = [['Nama Peminjam', 'Kelas', 'Mata Pelajaran', 'Nama Barang', 'Jenis Alat', 'Jumlah', 'Tanggal Pinjam', 'Tanggal Kembali', 'Link Bukti Google Drive']];
    $last_transaction_id = null;

    foreach ($history_records as $row) {
        $drive_url = $drive_urls_by_transaction[$row['transaction_id']] ?? 'Tidak ada bukti';
        if (!empty($row['transaction_id']) && $row['transaction_id'] === $last_transaction_id) {
            $row['borrower_name'] = ''; $row['borrower_class'] = ''; $row['subject'] = '';
            $row['borrow_date'] = ''; $row['return_date'] = ''; $drive_url = '';
        } else {
            $last_transaction_id = $row['transaction_id'];
        }
        $csv_data[] = [$row['borrower_name'], $row['borrower_class'], $row['subject'], $row['item_name'], $row['classifier'], $row['quantity'], $row['borrow_date'], $row['return_date'], $drive_url];
    }
    
    $fp = @fopen($temp_csv_path, 'w');
    if ($fp === false) {
        throw new Exception("Gagal membuat file CSV sementara. Periksa izin folder 'tools/temp'.");
    }
    foreach ($csv_data as $fields) fputcsv($fp, $fields);
    fclose($fp);
    
    update_and_stream_status(['type' => 'log', 'log_entry' => ['time' => date('H:i:s'), 'message' => 'File CSV berhasil dibuat. Mengunggah...', 'status' => 'info']]);
    
    $csv_upload_result = upload_file_to_drive($temp_csv_path);

    if (isset($csv_upload_result['status']) && $csv_upload_result['status'] === 'success') {
         update_and_stream_status(['type' => 'complete', 'status' => 'complete', 'csv_url' => $csv_upload_result['url'], 'log_entry' => ['time' => date('H:i:s'), 'message' => 'Backup Selesai!', 'status' => 'success']]);
         exit;
    } else {
         throw new Exception('Gagal mengunggah file CSV akhir. ' . ($csv_upload_result['message'] ?? ''));
    }

} catch (Exception $e) {
    error_log('Streaming Backup Error: ' . $e->getMessage());
    update_and_stream_status(['type' => 'error', 'status' => 'error', 'message' => $e->getMessage(), 'error' => $e->getMessage()]);
    exit;
} finally {
    if (file_exists($temp_csv_path)) {
        @unlink($temp_csv_path);
    }
}