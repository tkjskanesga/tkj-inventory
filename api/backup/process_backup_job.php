<?php
// Endpoint "pekerja" yang menangani satu pekerjaan dari antrian.
// File ini akan dipanggil berulang kali oleh frontend.

// --- PENGATURAN & KEAMANAN ---
$status_file_path = dirname(dirname(__DIR__)) . '/temp/backup_status.json';
define('JOB_TIMEOUT', 180);

// Memuat helper uploader Google Drive
require_once __DIR__ . '/../helpers/google_drive_uploader.php';

// --- PROSES UTAMA ---
$fp = fopen($status_file_path, 'r+');
if (!$fp || !flock($fp, LOCK_EX)) {
    if ($fp) fclose($fp);
    http_response_code(429); // Too Many Requests
    json_response('error', 'Server sedang sibuk memproses pekerjaan lain.');
}


$status_json = stream_get_contents($fp);
$status_data = json_decode($status_json, true);

// Cari pekerjaan pertama yang masih 'pending'.
$job_to_process = null;
$job_key = -1;
foreach ($status_data['jobs'] as $key => $job) {
    if ($job['status'] === 'pending') {
        $job_to_process = $job;
        $job_key = $key;
        break;
    }
}

if ($job_to_process) {
    // --- PROSES SATU PEKERJAAN ---
    $status_data['jobs'][$job_key]['status'] = 'processing';
    $status_data['jobs'][$job_key]['timestamp'] = date('c');
    ftruncate($fp, 0); rewind($fp); fwrite($fp, json_encode($status_data, JSON_PRETTY_PRINT));
    
    $local_file_path = dirname(dirname(__DIR__)) . '/public/' . $job_to_process['local_path'];

    $logCallback = function($msg) use (&$status_data, $local_file_path) {
        if (strpos(strtolower($msg), 'gagal') !== false) {
             $status_data['log'][] = ['time' => date('H:i:s'), 'message' => $msg, 'status' => 'info'];
        }
    };
    
    $upload_result = upload_single_file_to_drive(
        $local_file_path, 
        mime_content_type($local_file_path), 
        GOOGLE_DRIVE_HISTORY_BACKUP_FOLDER_ID, 
        'bukti',
        $logCallback
    );

    if (isset($upload_result['status']) && $upload_result['status'] === 'success') {
        $status_data['jobs'][$job_key]['status'] = 'success';
        $status_data['jobs'][$job_key]['drive_url'] = $upload_result['url'];
        $status_data['success']++;
        $status_data['log'][] = ['time' => date('H:i:s'), 'message' => basename($local_file_path), 'status' => 'success'];
    } else {
        $status_data['jobs'][$job_key]['status'] = 'error';
        $status_data['jobs'][$job_key]['message'] = $upload_result['message'] ?? 'Unknown error';
        $status_data['failed']++;
        $status_data['log'][] = ['time' => date('H:i:s'), 'message' => basename($local_file_path) . ' - Gagal: ' . $status_data['jobs'][$job_key]['message'], 'status' => 'error'];
    }
    $status_data['processed']++;
    
} else if ($status_data['status'] !== 'complete' && $status_data['status'] !== 'error') {
    // --- SEMUA PEKERJAAN SELESAI, BUAT DAN UNGGAH CSV ---
    $status_data['status'] = 'finalizing';
    $status_data['log'][] = ['time' => date('H:i:s'), 'message' => 'Semua bukti selesai diunggah. Membuat file CSV...', 'status' => 'info'];
    
    $drive_urls_map = [];
    foreach ($status_data['jobs'] as $job) {
        if ($job['status'] === 'success') {
            $drive_urls_map[$job['transaction_id']] = $job['drive_url'];
        } else {
             $drive_urls_map[$job['transaction_id']] = 'GAGAL_UPLOAD: ' . ($job['message'] ?? 'N/A');
        }
    }
    
    $stmt = $pdo->query("SELECT h.id, h.transaction_id, i.name as item_name, i.classifier, h.borrower_name, h.borrower_class, h.subject, h.quantity, h.borrow_date, h.return_date, u.nis as borrower_nis FROM history h JOIN items i ON h.item_id = i.id LEFT JOIN users u ON h.user_id = u.id ORDER BY h.return_date DESC, h.transaction_id DESC");
    $history_records = $stmt->fetchAll(PDO::FETCH_ASSOC);

    $csv_data = [['NIS', 'Nama Peminjam', 'Kelas', 'Mata Pelajaran', 'Nama Barang', 'Jenis Alat', 'Jumlah', 'Tanggal Pinjam', 'Tanggal Kembali', 'Link Bukti Google Drive']];
    $last_transaction_id = null;
    foreach ($history_records as $row) {
        $drive_url = $drive_urls_map[$row['transaction_id']] ?? 'Tidak ada bukti';
        if (!empty($row['transaction_id']) && $row['transaction_id'] === $last_transaction_id) {
            $row['borrower_nis'] = ''; $row['borrower_name'] = ''; $row['borrower_class'] = ''; $row['subject'] = '';
            $row['borrow_date'] = ''; $row['return_date'] = ''; $drive_url = '';
        } else {
            $last_transaction_id = $row['transaction_id'];
        }
        $csv_data[] = [$row['borrower_nis'], $row['borrower_name'], $row['borrower_class'], $row['subject'], $row['item_name'], $row['classifier'], $row['quantity'], $row['borrow_date'], $row['return_date'], $drive_url];
    }
    
    $csv_filename = 'backup_riwayat_' . date('Y-m-d_H-i-s') . '.csv';
    $temp_csv_path = dirname($status_file_path) . '/' . $csv_filename;
    $csv_fp = fopen($temp_csv_path, 'w');
    foreach ($csv_data as $fields) fputcsv($csv_fp, $fields);
    fclose($csv_fp);
    
    $csv_upload_result = upload_single_file_to_drive($temp_csv_path, 'text/csv', GOOGLE_DRIVE_HISTORY_BACKUP_FOLDER_ID);
    if (isset($csv_upload_result['status']) && $csv_upload_result['status'] === 'success') {
        $status_data['csv_url'] = $csv_upload_result['url'];
        $status_data['log'][] = ['time' => date('H:i:s'), 'message' => 'Backup Selesai! File CSV berhasil diunggah.', 'status' => 'success'];
        $status_data['status'] = 'complete';
    } else {
        $status_data['log'][] = ['time' => date('H:i:s'), 'message' => 'Gagal mengunggah file CSV akhir: ' . ($csv_upload_result['message'] ?? ''), 'status' => 'error'];
        $status_data['status'] = 'error';
    }
    $status_data['endTime'] = date('c');
    @unlink($temp_csv_path);
}

// Simpan perubahan terakhir ke file status.
ftruncate($fp, 0);
rewind($fp);
fwrite($fp, json_encode($status_data, JSON_PRETTY_PRINT));

flock($fp, LOCK_UN);
fclose($fp);

header('Content-Type: application/json');
echo json_encode($status_data);
exit();