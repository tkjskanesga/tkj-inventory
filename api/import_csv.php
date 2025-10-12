<?php
/**
 * Endpoint untuk mengimpor barang dari file CSV.
 * Hanya dapat diakses oleh admin.
 */

// Memvalidasi bahwa file diunggah
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
 * Mengunduh gambar dari URL (termasuk link Google Drive) dan menyimpannya secara lokal.
 * @param string $url URL gambar.
 * @param string $name Nama barang (untuk fallback).
 * @return string Path lokal gambar yang disimpan.
 */
function download_and_save_image($url, $name) {
    $dummy_image = 'assets/favicon/dummy.jpg';
    if (empty($url) || !filter_var($url, FILTER_VALIDATE_URL)) {
        return $dummy_image;
    }

    $image_content = false;

    // Cek apakah ini link Google Drive
    if (strpos($url, 'drive.google.com') !== false) {
        $fileId = null;
        if (preg_match('/\/d\/([a-zA-Z0-9_-]+)/', $url, $matches)) {
            $fileId = $matches[1];
        }

        if ($fileId) {
            $directDownloadUrl = 'https://drive.google.com/uc?export=download&id=' . $fileId;
            
            $ch = curl_init($directDownloadUrl);
            curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
            curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true); // Penting untuk Google Drive
            curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false); // Diperlukan di beberapa server
            $image_content = curl_exec($ch);
            $http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
            curl_close($ch);

            if ($http_code !== 200) {
                $image_content = false;
            }
        }
    } else {
        // Logika fallback untuk link direct download biasa
        $image_content = @file_get_contents($url);
    }

    if ($image_content === false) {
        return $dummy_image;
    }
    
    // Validasi konten sebagai gambar
    $image_info = @getimagesizefromstring($image_content);
    if ($image_info === false) {
        return $dummy_image;
    }
    
    // Menentukan ekstensi yang aman
    $extension = image_type_to_extension($image_info[2]);
    if (!$extension) {
        return $dummy_image;
    }
    
    // Membuat nama file yang unik
    $safe_filename = 'item_' . uniqid() . $extension;
    $target_dir = dirname(__DIR__) . '/public/assets/img/';
    $target_file = $target_dir . $safe_filename;
    
    if (!is_dir($target_dir)) {
        mkdir($target_dir, 0775, true);
    }
    
    // Simpan file
    if (file_put_contents($target_file, $image_content)) {
        return 'assets/img/' . $safe_filename;
    }
    
    return $dummy_image;
}


try {
    $pdo->beginTransaction();

    $handle = fopen($file['tmp_name'], "r");
    if ($handle === false) {
        throw new Exception("Gagal membuka file CSV.");
    }
    
    // Lewati baris header
    fgetcsv($handle, 1000, ",");
    
    $row_count = 1;
    while (($data = fgetcsv($handle, 1000, ",")) !== false) {
        $row_count++;
        // CSV format: Nama Barang, Jenis Barang, Jumlah, Link Gambar
        $name = isset($data[0]) ? sanitize_input($data[0]) : null;
        $classifier = isset($data[1]) ? sanitize_input(trim($data[1])) : null;
        $quantity = isset($data[2]) ? (int)$data[2] : null;
        $image_url_source = isset($data[3]) ? trim($data[3]) : null;
        
        if (empty($name) || $quantity === null || $quantity < 1) {
            throw new Exception("Data tidak valid pada baris {$row_count}. Pastikan nama dan jumlah diisi dengan benar.");
        }
        
        $saved_image_path = download_and_save_image($image_url_source, $name);
        
        $sql = "INSERT INTO items (name, total_quantity, current_quantity, image_url, classifier) VALUES (?, ?, ?, ?, ?)";
        $stmt = $pdo->prepare($sql);
        $stmt->execute([$name, $quantity, $quantity, $saved_image_path, empty($classifier) ? null : $classifier]);
    }
    
    fclose($handle);
    $pdo->commit();
    
    json_response('success', 'Impor barang berhasil diselesaikan.');

} catch (Exception $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    error_log('CSV Import Error: ' . $e->getMessage());
    json_response('error', 'Terjadi kesalahan saat impor: ' . $e->getMessage());
}