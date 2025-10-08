<?php
// Endpoint "pekerja" yang menangani satu pekerjaan dari antrian.
// File ini akan dipanggil berulang kali oleh frontend.

require_admin();

// --- PENGATURAN & KEAMANAN ---
set_time_limit(120); // Batas waktu 2 menit untuk satu pekerjaan.
$status_file_path = dirname(__DIR__) . '/temp/backup_status.json';
define('JOB_TIMEOUT', 180); // Detik sebelum pekerjaan 'processing' dianggap macet (3 menit).
define('MAX_RETRIES', 3); // Jumlah percobaan ulang maksimum untuk setiap file.
define('RETRY_DELAY', 5); // Detik untuk menunggu sebelum mencoba lagi.

if (!file_exists($status_file_path)) {
    json_response('error', 'File status backup tidak ditemukan. Proses mungkin sudah selesai atau belum dimulai.');
}

// --- FUNGSI UNTUK MENGUNGGAH SATU FILE DENGAN MEKANISME RETRY UNIVERSAL ---
function upload_single_file_to_drive($filePath, $mimeType) {
    if (!file_exists($filePath) || !is_readable($filePath)) {
        return ['status' => 'error', 'message' => 'File lokal tidak ada atau tidak bisa dibaca: ' . basename($filePath)];
    }

    $retries = 0;
    $last_error_message = '';

    while ($retries < MAX_RETRIES) {
        $postData = [
            'secret'   => GOOGLE_SCRIPT_SECRET,
            'file'     => base64_encode(file_get_contents($filePath)),
            'filename' => basename($filePath),
            'mimetype' => $mimeType
        ];
        $ch = curl_init(GOOGLE_SCRIPT_URL);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => 1, CURLOPT_POST => 1, CURLOPT_POSTFIELDS => $postData,
            CURLOPT_FOLLOWLOCATION => true, CURLOPT_TIMEOUT => 90
        ]);
        $response = curl_exec($ch);
        $error = curl_error($ch);
        curl_close($ch);

        // Cek kegagalan cURL (e.g., 'Could not resolve host', 'Connection timed out', dll.)
        if ($error) {
            $last_error_message = 'cURL Error: ' . $error;
            $retries++;
            if ($retries < MAX_RETRIES) {
                sleep(RETRY_DELAY);
                continue; // Coba lagi
            }
        } else {
            // Jika cURL berhasil, cek respons dari Apps Script
            $decoded_response = json_decode($response, true);
            if (json_last_error() === JSON_ERROR_NONE && isset($decoded_response['status'])) {
                if ($decoded_response['status'] === 'success') {
                    return $decoded_response; // BERHASIL, langsung keluar dari fungsi
                } else {
                    // Apps Script mengembalikan pesan error (e.g., secret key salah)
                    $last_error_message = $decoded_response['message'] ?? 'Apps Script returned an error.';
                }
            } else {
                // Respons dari Apps Script bukan JSON yang valid
                $last_error_message = 'Respons tidak valid dari Google Apps Script.';
            }

            // Jika sampai di sini, berarti ada error dari Apps Script atau JSON tidak valid
            $retries++;
            if ($retries < MAX_RETRIES) {
                sleep(RETRY_DELAY);
                continue; // Coba lagi
            }
        }
    }

    // Jika loop selesai tanpa return sukses, berarti semua percobaan gagal.
    return ['status' => 'error', 'message' => $last_error_message];
}


// --- PROSES UTAMA ---
$fp = fopen($status_file_path, 'r+');
if (!$fp) {
    json_response('error', 'Tidak bisa membuka file status.');
}

// Kunci file untuk mencegah race condition.
if (flock($fp, LOCK_EX)) {
    $status_json = stream_get_contents($fp);
    $status_data = json_decode($status_json, true);
    
    // Cek dan reset pekerjaan yang macet (stuck in 'processing').
    $now = time();
    $jobs_reset = false;
    foreach ($status_data['jobs'] as $key => &$job) { // Gunakan reference (&) untuk modifikasi langsung.
        if ($job['status'] === 'processing' && isset($job['timestamp'])) {
            $job_start_time = strtotime($job['timestamp']);
            if ($job_start_time && ($now - $job_start_time) > JOB_TIMEOUT) {
                $job['status'] = 'pending'; // Reset status.
                $job['message'] = 'Pekerjaan direset karena timeout.';
                $status_data['log'][] = ['time' => date('H:i:s'), 'message' => 'Mereset pekerjaan macet untuk file: ' . basename($job['local_path']), 'status' => 'info'];
                $jobs_reset = true;
            }
        }
    }
    unset($job); // Hapus reference setelah loop.
    
    if ($jobs_reset) {
        ftruncate($fp, 0);
        rewind($fp);
        fwrite($fp, json_encode($status_data, JSON_PRETTY_PRINT));
        rewind($fp);
        $status_json = stream_get_contents($fp);
        $status_data = json_decode($status_json, true);
    }
    
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

        ftruncate($fp, 0);
        rewind($fp);
        fwrite($fp, json_encode($status_data, JSON_PRETTY_PRINT));
        
        $local_file_path = dirname(__DIR__) . '/public/' . $job_to_process['local_path'];
        $upload_result = upload_single_file_to_drive($local_file_path, mime_content_type($local_file_path));

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
        
    } else {
        // --- SEMUA PEKERJAAN SELESAI, BUAT DAN UNGGAH CSV ---
        if ($status_data['status'] !== 'complete' && $status_data['status'] !== 'finalizing') {
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
            
            $stmt = $pdo->query("SELECT h.id, h.transaction_id, i.name as item_name, i.classifier, h.borrower_name, h.borrower_class, h.subject, h.quantity, h.borrow_date, h.return_date FROM history h JOIN items i ON h.item_id = i.id ORDER BY h.return_date DESC, h.transaction_id DESC");
            $history_records = $stmt->fetchAll(PDO::FETCH_ASSOC);

            $csv_data = [['Nama Peminjam', 'Kelas', 'Mata Pelajaran', 'Nama Barang', 'Jenis Alat', 'Jumlah', 'Tanggal Pinjam', 'Tanggal Kembali', 'Link Bukti Google Drive']];
            $last_transaction_id = null;
            foreach ($history_records as $row) {
                $drive_url = $drive_urls_map[$row['transaction_id']] ?? 'Tidak ada bukti';
                if (!empty($row['transaction_id']) && $row['transaction_id'] === $last_transaction_id) {
                    $row['borrower_name'] = ''; $row['borrower_class'] = ''; $row['subject'] = '';
                    $row['borrow_date'] = ''; $row['return_date'] = ''; $drive_url = '';
                } else {
                    $last_transaction_id = $row['transaction_id'];
                }
                $csv_data[] = [$row['borrower_name'], $row['borrower_class'], $row['subject'], $row['item_name'], $row['classifier'], $row['quantity'], $row['borrow_date'], $row['return_date'], $drive_url];
            }
            
            $csv_filename = 'backup_riwayat_' . date('Y-m-d_H-i-s') . '.csv';
            $temp_csv_path = dirname($status_file_path) . '/' . $csv_filename;
            $csv_fp = fopen($temp_csv_path, 'w');
            foreach ($csv_data as $fields) fputcsv($csv_fp, $fields);
            fclose($csv_fp);
            
            $csv_upload_result = upload_single_file_to_drive($temp_csv_path, 'text/csv');
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

} else {
    fclose($fp);
    http_response_code(429); // Too Many Requests
    json_response('error', 'Server sedang sibuk memproses pekerjaan lain.');
}