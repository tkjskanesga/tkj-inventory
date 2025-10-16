<?php
// Endpoint "pekerja" yang menangani satu pekerjaan dari antrian ekspor stok atau akun.
$status_file_path = dirname(__DIR__) . '/temp/export_status.json';
define('JOB_TIMEOUT', 180);
define('MAX_RETRIES', 3);
define('RETRY_DELAY', 5);

if (!file_exists($status_file_path)) {
    json_response('error', 'File status ekspor tidak ditemukan.');
}

function upload_single_file_to_drive($filePath, $mimeType, $folderId, $subfolder = null) {
    if (!file_exists($filePath) || !is_readable($filePath)) {
        return ['status' => 'error', 'message' => 'File lokal tidak ada: ' . basename($filePath)];
    }

    $retries = 0;
    $last_error_message = '';
    while ($retries < MAX_RETRIES) {
        $postData = [
            'secret'   => GOOGLE_SCRIPT_SECRET,
            'folderId' => $folderId,
            'file'     => base64_encode(file_get_contents($filePath)),
            'filename' => basename($filePath),
            'mimetype' => $mimeType
        ];
        if ($subfolder) {
            $postData['subfolder'] = $subfolder;
        }

        $ch = curl_init(GOOGLE_SCRIPT_URL);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => 1, CURLOPT_POST => 1, CURLOPT_POSTFIELDS => $postData,
            CURLOPT_FOLLOWLOCATION => true, CURLOPT_TIMEOUT => 90
        ]);
        $response = curl_exec($ch);
        $error = curl_error($ch);
        curl_close($ch);

        if ($error) {
            $last_error_message = 'cURL Error: ' . $error;
            $retries++;
            if ($retries < MAX_RETRIES) sleep(RETRY_DELAY);
            continue;
        }
        
        $decoded_response = json_decode($response, true);
        if (json_last_error() === JSON_ERROR_NONE && isset($decoded_response['status'])) {
            if ($decoded_response['status'] === 'success') {
                return $decoded_response;
            }
            $last_error_message = $decoded_response['message'] ?? 'Apps Script returned an error.';
        } else {
            $last_error_message = 'Respons tidak valid dari Google Apps Script.';
        }
        $retries++;
        if ($retries < MAX_RETRIES) sleep(RETRY_DELAY);
    }
    return ['status' => 'error', 'message' => $last_error_message];
}

$fp = fopen($status_file_path, 'r+');
if (!$fp || !flock($fp, LOCK_EX)) {
    if ($fp) fclose($fp);
    http_response_code(429);
    json_response('error', 'Server sedang sibuk memproses pekerjaan lain.');
}

$status_json = stream_get_contents($fp);
$status_data = json_decode($status_json, true);
$export_type = $status_data['export_type'] ?? 'stock';

// Cari pekerjaan 'pending'
$job_to_process = null;
$job_key = -1;
foreach ($status_data['jobs'] as $key => $job) {
    if ($job['status'] === 'pending') {
        $job_to_process = $job;
        $job_key = $key;
        break;
    }
}

if ($job_to_process && $export_type === 'stock') {
    // --- PROSES UPLOAD GAMBAR STOK ---
    $status_data['jobs'][$job_key]['status'] = 'processing';
    $status_data['jobs'][$job_key]['timestamp'] = date('c');
    ftruncate($fp, 0); rewind($fp); fwrite($fp, json_encode($status_data, JSON_PRETTY_PRINT));

    $local_file_path = dirname(__DIR__) . '/public/' . $job_to_process['local_path'];
    $upload_result = upload_single_file_to_drive($local_file_path, mime_content_type($local_file_path), GOOGLE_DRIVE_STOCK_EXPORT_FOLDER_ID, 'gambar_stok');

    if ($upload_result['status'] === 'success') {
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
    // --- BUAT DAN UPLOAD CSV ---
    $status_data['status'] = 'finalizing';
    $csv_filename = '';
    $csv_data = [];
    $folder_id = '';
    $subfolder = null;

    if ($export_type === 'stock') {
        $status_data['log'][] = ['time' => date('H:i:s'), 'message' => 'Semua gambar selesai diunggah. Membuat file CSV stok...', 'status' => 'info'];
        $drive_urls_map = [];
        foreach ($status_data['jobs'] as $job) {
            if ($job['status'] === 'success') {
                $drive_urls_map[$job['item_id']] = $job['drive_url'];
            }
        }
        $stmt = $pdo->query("SELECT id, name, classifier, total_quantity, image_url FROM items ORDER BY classifier, name");
        $items = $stmt->fetchAll(PDO::FETCH_ASSOC);
        $csv_data = [['Nama Barang', 'Jenis Barang', 'Jumlah', 'Link Gambar']];
        foreach ($items as $item) {
            $image_link = $drive_urls_map[$item['id']] ?? '';
            $csv_data[] = [$item['name'], $item['classifier'], $item['total_quantity'], $image_link];
        }
        $csv_filename = 'ekspor_stok_' . date('Y-m-d_H-i-s') . '.csv';
        $folder_id = GOOGLE_DRIVE_STOCK_EXPORT_FOLDER_ID;

    } elseif ($export_type === 'accounts') {
        $status_data['log'][] = ['time' => date('H:i:s'), 'message' => 'Membuat file CSV akun...', 'status' => 'info'];
        
        // Menggunakan LEFT JOIN untuk mendapatkan nama kelas, bukan ID.
        $stmt = $pdo->query("
            SELECT u.nis, u.password, u.nama, c.name AS kelas 
            FROM users u
            LEFT JOIN classes c ON u.kelas = c.id
            WHERE u.role = 'user' 
            ORDER BY c.name, u.nama
        ");
        $users = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        $csv_data = [['NIS', 'Password', 'Nama', 'Kelas']];
        foreach ($users as $user) {
            // Memasukkan nama kelas (hasil join) ke dalam CSV.
            $csv_data[] = [$user['nis'], $user['password'], $user['nama'], $user['kelas']];
        }

        $csv_filename = 'ekspor_akun_siswa_' . date('Y-m-d_H-i-s') . '.csv';
        $folder_id = GOOGLE_DRIVE_ACCOUNTS_EXPORT_FOLDER_ID;
        $status_data['processed'] = 1; // Hanya ada 1 pekerjaan (membuat CSV)
        $status_data['total'] = 1;
    }

    if (!empty($csv_data) && count($csv_data) > 1) {
        $temp_csv_path = dirname($status_file_path) . '/' . $csv_filename;
        $csv_fp = fopen($temp_csv_path, 'w');
        foreach ($csv_data as $fields) fputcsv($csv_fp, $fields);
        fclose($csv_fp);
        
        $csv_upload_result = upload_single_file_to_drive($temp_csv_path, 'text/csv', $folder_id, $subfolder);
        if ($csv_upload_result['status'] === 'success') {
            $status_data['csv_url'] = $csv_upload_result['url'];
            $status_data['log'][] = ['time' => date('H:i:s'), 'message' => 'Ekspor Selesai! File CSV berhasil diunggah.', 'status' => 'success'];
            $status_data['status'] = 'complete';
        } else {
            $status_data['log'][] = ['time' => date('H:i:s'), 'message' => 'Gagal mengunggah file CSV akhir: ' . ($csv_upload_result['message'] ?? ''), 'status' => 'error'];
            $status_data['status'] = 'error';
        }
        @unlink($temp_csv_path);
    } else {
        $status_data['status'] = 'error';
        $status_data['message'] = 'Tidak ada data untuk diekspor ke CSV.';
        $status_data['log'][] = ['time' => date('H:i:s'), 'message' => 'Tidak ada data untuk ditulis ke CSV.', 'status' => 'error'];
    }
    $status_data['endTime'] = date('c');
}

ftruncate($fp, 0); rewind($fp); fwrite($fp, json_encode($status_data, JSON_PRETTY_PRINT));
flock($fp, LOCK_UN); fclose($fp);

header('Content-Type: application/json');
echo json_encode($status_data);
exit();