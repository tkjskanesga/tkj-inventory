<?php
/**
 * Endpoint "pekerja" yang menangani satu pekerjaan dari antrian impor CSV.
 * Memastikan hanya string path gambar (bukan array) yang disimpan ke database.
 */

$status_file_path = dirname(__DIR__) . '/temp/import_status.json';

if (!file_exists($status_file_path)) {
    json_response('error', 'File status impor tidak ditemukan.');
}

// --- Fungsi Helper untuk Download Gambar ---
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
                    
                    if (empty($name) || $quantity === null || $quantity < 1) throw new Exception("Data tidak valid (nama/jumlah).");
                    
                    $image_result = download_image_from_url($image_url_source, $status_data['import_type']);
                    $saved_image_path = $image_result['path'] ?? 'assets/favicon/dummy.jpg'; // Fallback ke dummy jika gagal/skip

                    if ($image_result['status'] === 'error') {
                        $status_data['log'][] = ['time' => date('H:i:s'), 'message' => "{$name}: " . $image_result['message'] . ". Menggunakan gambar default.", 'status' => 'warning'];
                    }
                    
                    $sql = "INSERT INTO items (name, total_quantity, current_quantity, image_url, classifier) VALUES (?, ?, ?, ?, ?)";
                    $stmt = $pdo->prepare($sql);
                    $stmt->execute([$name, $quantity, $quantity, $saved_image_path, empty($classifier) ? null : $classifier]);

                } elseif ($status_data['import_type'] === 'history') {
                    // --- LOGIKA IMPOR RIWAYAT DENGAN URUTAN BARU ---
                    $borrower_nis = isset($data[0]) ? trim($data[0]) : null;
                    $borrower_name = $data[1] ?? null;
                    $borrower_class = $data[2] ?? null;
                    $subject = $data[3] ?? null;
                    $item_name = $data[4] ?? null;
                    $quantity = isset($data[6]) ? (int)$data[6] : null;
                    $borrow_date_str = $data[7] ?? null;
                    $return_date_str = $data[8] ?? null;
                    $proof_url = $data[9] ?? null;

                    $user_id = null;
                    if (!empty($borrower_nis)) {
                        $stmt_find_user = $pdo->prepare("SELECT id FROM users WHERE nis = ? LIMIT 1");
                        $stmt_find_user->execute([$borrower_nis]);
                        $user_id = $stmt_find_user->fetchColumn();
                    }

                    // Jika ada NIS atau Nama Peminjam, anggap ini baris transaksi baru
                    if (!empty($borrower_nis) || !empty($borrower_name)) {
                        $image_result = download_image_from_url($proof_url, $status_data['import_type']);
                        $image_path_for_db = $image_result['path'];

                        if ($image_result['status'] === 'error') {
                            $status_data['log'][] = ['time' => date('H:i:s'), 'message' => "{$borrower_name} ({$item_name}): " . $image_result['message'], 'status' => 'warning'];
                        }

                        $last_transaction_data = [
                            'borrower_name'   => $borrower_name,
                            'borrower_class'  => $borrower_class,
                            'subject'         => $subject,
                            'borrow_date'     => !empty($borrow_date_str) ? date('Y-m-d H:i:s', strtotime($borrow_date_str)) : null,
                            'return_date'     => !empty($return_date_str) ? date('Y-m-d H:i:s', strtotime($return_date_str)) : null,
                            'proof_image_url' => $image_path_for_db,
                            'transaction_id'  => 'imported-' . uniqid(),
                            'user_id'         => $user_id
                        ];
                        $status_data['last_transaction_data'] = $last_transaction_data;
                    }

                    if (empty($item_name) || empty($quantity)) throw new Exception("Nama barang atau jumlah kosong.");

                    $stmt_find_item = $pdo->prepare("SELECT id FROM items WHERE name = ? LIMIT 1");
                    $stmt_find_item->execute([$item_name]);
                    $item_id = $stmt_find_item->fetchColumn();

                    if (!$item_id) throw new Exception("Barang '{$item_name}' tidak ditemukan di database.");
                    
                    $stmt_insert = $pdo->prepare("INSERT INTO history (item_id, quantity, borrower_name, borrower_class, subject, borrow_date, return_date, proof_image_url, transaction_id, user_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
                    $stmt_insert->execute([
                        $item_id, $quantity,
                        $last_transaction_data['borrower_name'],
                        $last_transaction_data['borrower_class'],
                        $last_transaction_data['subject'],
                        $last_transaction_data['borrow_date'],
                        $last_transaction_data['return_date'],
                        $last_transaction_data['proof_image_url'],
                        $last_transaction_data['transaction_id'],
                        $last_transaction_data['user_id']
                    ]);

                } elseif ($status_data['import_type'] === 'accounts') {
                    // --- LOGIKA IMPOR AKUN ---
                    $nis = isset($data[0]) ? trim($data[0]) : null;
                    $password_from_csv = $data[1] ?? null;
                    $nama = isset($data[2]) ? sanitize_input(trim($data[2])) : null;
                    $kelas_nama = isset($data[3]) ? trim($data[3]) : null;

                    if (empty($nis) || empty($password_from_csv) || empty($nama)) {
                        throw new Exception("Data tidak lengkap (NIS/Password/Nama).");
                    }
                    
                    $stmt_check = $pdo->prepare("SELECT id FROM users WHERE nis = ?");
                    $stmt_check->execute([$nis]);
                    if ($stmt_check->fetch()) {
                        throw new Exception("NIS '{$nis}' sudah terdaftar.");
                    }
                    
                    $password_info = password_get_info($password_from_csv);
                    if ($password_info['algo']) {
                        $password_to_store = $password_from_csv;
                    } else {
                        if (strlen($password_from_csv) < 8) {
                            throw new Exception("Password minimal 8 karakter.");
                        }
                        $password_to_store = password_hash($password_from_csv, PASSWORD_DEFAULT);
                    }

                    // Logika "Get or Create" untuk kelas
                    $class_id = null;
                    if (!empty($kelas_nama)) {
                        // Cek apakah kelas sudah ada
                        $stmt_find_class = $pdo->prepare("SELECT id FROM classes WHERE name = ?");
                        $stmt_find_class->execute([$kelas_nama]);
                        $class_id = $stmt_find_class->fetchColumn();

                        // Jika tidak ada, buat kelas baru
                        if (!$class_id) {
                            $stmt_create_class = $pdo->prepare("INSERT INTO classes (name) VALUES (?)");
                            $stmt_create_class->execute([$kelas_nama]);
                            $class_id = $pdo->lastInsertId();
                        }
                    }

                    // Untuk user (siswa), username disamakan dengan NIS
                    $stmt = $pdo->prepare("INSERT INTO users (username, password, role, nama, nis, kelas) VALUES (?, ?, 'user', ?, ?, ?)");
                    $stmt->execute([$nis, $password_to_store, $nama, $nis, $class_id]); // Gunakan $class_id
                }

                $job_succeeded = true;
            } catch (PDOException $e) {
                 if ($e->getCode() == 23000) {
                    $error_message = "Data duplikat (NIS atau Username sudah ada).";
                } else {
                    $error_message = "Database error: " . $e->getMessage();
                }
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