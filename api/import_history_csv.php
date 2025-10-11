<?php
/**
 * Endpoint untuk mengimpor riwayat dari file CSV yang dihasilkan oleh fitur backup.
 * Endpoint ini akan membaca CSV, mengunduh bukti gambar dari URL, dan menyimpannya ke database.
 * Hanya dapat diakses oleh admin.
 */

// Validasi bahwa file diunggah
if (!isset($_FILES['csv_file']) || $_FILES['csv_file']['error'] !== UPLOAD_ERR_OK) {
    json_response('error', 'File CSV tidak ditemukan atau gagal diunggah.');
}

$file = $_FILES['csv_file'];

// Validasi tipe file
$mime_type = mime_content_type($file['tmp_name']);
$allowed_mime_types = ['text/csv', 'text/plain', 'application/csv'];
if (!in_array($mime_type, $allowed_mime_types)) {
    json_response('error', 'Tipe file tidak valid. Harap unggah file .csv');
}

/**
 * Mengunduh gambar dari URL Google Drive dan menyimpannya secara lokal.
 * @param string $url URL gambar Google Drive.
 * @return string|null Path lokal gambar yang disimpan, atau null jika gagal.
 */
function download_and_save_proof_image($url) {
    // Validasi dasar dan pastikan ini adalah URL Google Drive
    if (empty($url) || !filter_var($url, FILTER_VALIDATE_URL) || strpos($url, 'drive.google.com') === false) {
        return null;
    }

    // Ekstrak FILE_ID dari URL berbagi
    $fileId = null;
    if (preg_match('/\/d\/([a-zA-Z0-9_-]+)/', $url, $matches)) {
        $fileId = $matches[1];
    }

    if (!$fileId) {
        return null; // Gagal mengekstrak ID dari URL
    }

    // Buat URL unduh langsung (direct download link)
    $directDownloadUrl = 'https://drive.google.com/uc?export=download&id=' . $fileId;

    // Gunakan cURL untuk mengunduh konten gambar
    $ch = curl_init($directDownloadUrl);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true); // Sangat penting untuk Google Drive
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false); // Diperlukan di beberapa server
    $image_content = curl_exec($ch);
    $http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    // Pastikan unduhan berhasil
    if ($http_code !== 200 || $image_content === false) {
        return null;
    }
    
    // Validasi konten sebagai gambar
    $image_info = @getimagesizefromstring($image_content);
    if ($image_info === false) {
        return null;
    }
    
    // Tentukan ekstensi dan siapkan path penyimpanan
    $extension = image_type_to_extension($image_info[2]);
    if (!$extension) {
        return null;
    }
    
    $safe_filename = 'evidence_' . uniqid() . $extension;
    $target_dir = dirname(__DIR__) . '/public/assets/evidence/';
    $target_file = $target_dir . $safe_filename;
    
    if (!is_dir($target_dir)) {
        @mkdir($target_dir, 0755, true);
    }
    
    // Simpan file
    if (file_put_contents($target_file, $image_content)) {
        return 'assets/evidence/' . $safe_filename;
    }
    
    return null;
}

try {
    $pdo->beginTransaction();

    $handle = fopen($file['tmp_name'], "r");
    if ($handle === false) {
        throw new Exception("Gagal membuka file CSV.");
    }
    
    // Lewati baris header
    fgetcsv($handle, 2000, ",");
    
    $row_count = 1;
    $success_count = 0;
    $skipped_count = 0;
    
    // Variabel untuk menyimpan data transaksi terakhir
    $last_transaction_data = [];

    // Siapkan statement untuk efisiensi
    $stmt_find_item = $pdo->prepare("SELECT id FROM items WHERE name = ? LIMIT 1");
    $stmt_insert_history = $pdo->prepare(
        "INSERT INTO history (borrowal_id, item_id, quantity, borrower_name, borrower_class, subject, borrow_date, return_date, proof_image_url, transaction_id) 
         VALUES (NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    );

    while (($data = fgetcsv($handle, 2000, ",")) !== false) {
        $row_count++;
        
        $borrower_name = $data[0] ?? null;
        $item_name = $data[3] ?? null;
        $quantity = isset($data[5]) ? (int)$data[5] : null;

        // Jika ini baris baru (ada nama peminjam), proses data transaksinya
        if (!empty($borrower_name)) {
            $local_proof_path = download_and_save_proof_image($data[8] ?? null);
            $last_transaction_data = [
                'borrower_name' => $borrower_name,
                'borrower_class' => $data[1] ?? null,
                'subject' => $data[2] ?? null,
                'borrow_date' => !empty($data[6]) ? date('Y-m-d H:i:s', strtotime($data[6])) : null,
                'return_date' => !empty($data[7]) ? date('Y-m-d H:i:s', strtotime($data[7])) : null,
                'proof_image_url' => $local_proof_path,
                'transaction_id' => 'imported-' . uniqid()
            ];
        }

        if (empty($item_name) || empty($quantity)) {
            continue;
        }

        $stmt_find_item->execute([$item_name]);
        $item_id = $stmt_find_item->fetchColumn();

        if (!$item_id) {
            $skipped_count++;
            continue;
        }
        
        $stmt_insert_history->execute([
            $item_id,
            $quantity,
            $last_transaction_data['borrower_name'],
            $last_transaction_data['borrower_class'],
            $last_transaction_data['subject'],
            $last_transaction_data['borrow_date'],
            $last_transaction_data['return_date'],
            $last_transaction_data['proof_image_url'],
            $last_transaction_data['transaction_id']
        ]);
        $success_count++;
    }
    
    fclose($handle);
    $pdo->commit();
    
    $message = "Impor selesai. {$success_count} data riwayat berhasil ditambahkan.";
    if ($skipped_count > 0) {
        $message .= " {$skipped_count} baris dilewati karena nama barang tidak ditemukan.";
    }
    
    json_response('success', $message, ['success_count' => $success_count, 'skipped_count' => $skipped_count]);

} catch (Exception $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    error_log('History CSV Import Error: ' . $e->getMessage());
    json_response('error', 'Terjadi kesalahan saat impor: ' . $e->getMessage());
}