<?php
/**
 * Endpoint "pekerja" yang menangani satu pekerjaan dari antrian impor CSV.
 * PERBAIKAN: Memastikan hanya string path gambar (bukan array) yang disimpan ke database.
 */

$status_file_path = dirname(__DIR__) . '/temp/import_status.json';

if (!file_exists($status_file_path)) {
    json_response('error', 'File status impor tidak ditemukan.');
}

// --- Fungsi Helper untuk Download Gambar (disempurnakan agar tidak memakai variabel global) ---
function download_image_from_url($url, $import_type) {
    if (empty($url) || !filter_var($url, FILTER_VALIDATE_URL)) {
        return ['status' => 'skip', 'path' => null];
    }

    $image_content = false;
    // Cek jika ini link Google Drive
    if (strpos($url, 'drive.google.com') !== false) {
        $fileId = null;
        if (preg_match('/\/d\/([a-zA-Z0-9_-]+)/', $url, $matches)) {
            $fileId = $matches[1];
        }
        if ($fileId) {
            $directDownloadUrl = 'https://drive.google.com/uc?export=download&id=' . $fileId;
            $ch = curl_init($directDownloadUrl);
            curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_FOLLOWLOCATION => true, CURLOPT_SSL_VERIFYPEER => false, CURLOPT_TIMEOUT => 60]);
            $image_content = curl_exec($ch);
            $http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
            curl_close($ch);
            if ($http_code !== 200) $image_content = false;
        }
    } else {
        // Untuk URL direct download lainnya
        $image_content = @file_get_contents($url);
    }

    if ($image_content === false) return ['status' => 'error', 'message' => 'Gagal mengunduh gambar dari URL.'];
    
    $image_info = @getimagesizefromstring($image_content);
    if ($image_info === false) return ['status' => 'error', 'message' => 'URL bukan gambar yang valid.'];
    
    $extension = image_type_to_extension($image_info[2]);
    if (!$extension) return ['status' => 'skip', 'path' => null]; // Jika ekstensi tidak dikenali, lewati saja.
    
    // Tentukan direktori target berdasarkan tipe impor
    $sub_dir = ($import_type === 'history') ? 'assets/evidence/' : 'assets/img/';
    
    $safe_filename = uniqid('import_', true) . $extension;
    $target_dir = dirname(__DIR__) . '/public/' . $sub_dir;
    $target_file = $target_dir . $safe_filename;
    
    if (!is_dir($target_dir)) @mkdir($target_dir, 0775, true);
    
    if (file_put_contents($target_file, $image_content)) {
        return ['status' => 'success', 'path' => $sub_dir . $safe_filename];
    }
    
    return ['status' => 'error', 'message' => 'Gagal menyimpan gambar ke server.'];
}


// --- PROSES UTAMA ---
$fp = fopen($status_file_path, 'r+');
if (!$fp || !flock($fp, LOCK_EX)) {
    if ($fp) fclose($fp);
    http_response_code(429);
    json_response('error', 'Server sedang sibuk memproses pekerjaan lain.');
}

$status_json = stream_get_contents($fp);
$status_data = json_decode($status_json, true);

$last_transaction_data = $status_data['last_transaction_data'] ?? [];

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

if ($job_to_process) {
    // --- PROSES SATU PEKERJAAN ---
    $status_data['jobs'][$job_key]['status'] = 'processing';
    ftruncate($fp, 0); rewind($fp); fwrite($fp, json_encode($status_data));

    $temp_csv_path = dirname($status_file_path) . '/' . $status_data['csv_file'];
    $job_succeeded = false;
    $error_message = 'Gagal membaca baris dari file CSV.';

    if (($handle = fopen($temp_csv_path, "r")) !== FALSE) {
        for ($i = 0; $i <= $job_to_process['row_number']; $i++) $data = fgetcsv($handle, 2000, ",");
        fclose($handle);

        if ($data !== false) {
            try {
                if ($status_data['import_type'] === 'stock') {
                    // --- LOGIKA IMPOR STOK ---
                    $name = isset($data[0]) ? sanitize_input($data[0]) : null;
                    $classifier = isset($data[1]) ? sanitize_input(trim($data[1])) : null;
                    $quantity = isset($data[2]) ? (int)$data[2] : null;
                    $image_url_source = isset($data[3]) ? trim($data[3]) : null;
                    
                    if (empty($name) || $quantity === null || $quantity < 1) throw new Exception("Data tidak valid.");
                    
                    $image_result = download_image_from_url($image_url_source, $status_data['import_type']);
                    $saved_image_path = $image_result['path'] ?? 'assets/favicon/dummy.jpg'; // Fallback ke dummy jika gagal/skip

                    if ($image_result['status'] === 'error') {
                        $status_data['log'][] = ['time' => date('H:i:s'), 'message' => "{$name}: " . $image_result['message'] . ". Menggunakan gambar default.", 'status' => 'warning'];
                    }
                    
                    $sql = "INSERT INTO items (name, total_quantity, current_quantity, image_url, classifier) VALUES (?, ?, ?, ?, ?)";
                    $stmt = $pdo->prepare($sql);
                    $stmt->execute([$name, $quantity, $quantity, $saved_image_path, empty($classifier) ? null : $classifier]);

                } elseif ($status_data['import_type'] === 'history') {
                    // --- LOGIKA IMPOR RIWAYAT ---
                    $borrower_name = $data[0] ?? null;
                    $item_name = $data[3] ?? null;
                    $quantity = isset($data[5]) ? (int)$data[5] : null;

                    if (!empty($borrower_name)) {
                        // Panggil fungsi download dan langsung proses hasilnya.
                        $image_result = download_image_from_url($data[8] ?? null, $status_data['import_type']);
                        $image_path_for_db = $image_result['path'];

                        if ($image_result['status'] === 'error') {
                            $status_data['log'][] = ['time' => date('H:i:s'), 'message' => "{$borrower_name} ({$item_name}): " . $image_result['message'], 'status' => 'warning'];
                        }

                        $last_transaction_data = [
                            'borrower_name'   => $borrower_name,
                            'borrower_class'  => $data[1] ?? null,
                            'subject'         => $data[2] ?? null,
                            'borrow_date'     => !empty($data[6]) ? date('Y-m-d H:i:s', strtotime($data[6])) : null,
                            'return_date'     => !empty($data[7]) ? date('Y-m-d H:i:s', strtotime($data[7])) : null,
                            'proof_image_url' => $image_path_for_db,
                            'transaction_id'  => 'imported-' . uniqid()
                        ];
                        $status_data['last_transaction_data'] = $last_transaction_data;
                    }

                    if (empty($item_name) || empty($quantity)) throw new Exception("Nama barang atau jumlah kosong.");

                    $stmt_find_item = $pdo->prepare("SELECT id FROM items WHERE name = ? LIMIT 1");
                    $stmt_find_item->execute([$item_name]);
                    $item_id = $stmt_find_item->fetchColumn();

                    if (!$item_id) throw new Exception("Barang '{$item_name}' tidak ditemukan di database.");
                    
                    $stmt_insert = $pdo->prepare("INSERT INTO history (item_id, quantity, borrower_name, borrower_class, subject, borrow_date, return_date, proof_image_url, transaction_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)");
                    $stmt_insert->execute([
                        $item_id, $quantity,
                        $last_transaction_data['borrower_name'],
                        $last_transaction_data['borrower_class'],
                        $last_transaction_data['subject'],
                        $last_transaction_data['borrow_date'],
                        $last_transaction_data['return_date'],
                        $last_transaction_data['proof_image_url'],
                        $last_transaction_data['transaction_id']
                    ]);
                }
                $job_succeeded = true;
            } catch (Exception $e) {
                $error_message = $e->getMessage();
            }
        }
    }

    // --- Update Status Pekerjaan ---
    if ($job_succeeded) {
        $status_data['jobs'][$job_key]['status'] = 'success';
        $status_data['success']++;
        $status_data['log'][] = ['time' => date('H:i:s'), 'message' => $job_to_process['data_preview'], 'status' => 'success'];
    } else {
        $status_data['jobs'][$job_key]['status'] = 'error';
        $status_data['jobs'][$job_key]['message'] = $error_message;
        $status_data['failed']++;
        $status_data['log'][] = ['time' => date('H:i:s'), 'message' => $job_to_process['data_preview'] . ' - Gagal: ' . $error_message, 'status' => 'error'];
    }
    $status_data['processed']++;

} else {
    // --- SEMUA PEKERJAAN SELESAI ---
    if ($status_data['status'] === 'running') {
        $status_data['status'] = 'complete';
        $status_data['endTime'] = date('c');
        $status_data['log'][] = ['time' => date('H:i:s'), 'message' => 'Impor Selesai!', 'status' => 'info'];
        unset($status_data['last_transaction_data']);
        $temp_csv_to_delete = dirname($status_file_path) . '/' . $status_data['csv_file'];
        if(file_exists($temp_csv_to_delete)) @unlink($temp_csv_to_delete);
    }
}

ftruncate($fp, 0); rewind($fp); fwrite($fp, json_encode($status_data, JSON_PRETTY_PRINT));
flock($fp, LOCK_UN); fclose($fp);

header('Content-Type: application/json');
echo json_encode($status_data);
exit();