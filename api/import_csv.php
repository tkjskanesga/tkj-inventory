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

// Helper function untuk mengunduh dan menyimpan gambar
function download_and_save_image($url, $name) {
    // Jika URL kosong atau tidak valid, langsung gunakan gambar dummy
    if (empty($url) || !filter_var($url, FILTER_VALIDATE_URL)) {
        return 'assets/favicon/dummy.jpg';
    }

    // Mengambil konten gambar dari URL
    $image_content = @file_get_contents($url);
    if ($image_content === false) {
        return 'assets/favicon/dummy.jpg';
    }
    
    // Validasi konten sebagai gambar
    $image_info = @getimagesizefromstring($image_content);
    if ($image_info === false) {
        return 'assets/favicon/dummy.jpg';
    }
    
    // Menentukan ekstensi yang aman berdasarkan tipe MIME
    $extension = image_type_to_extension($image_info[2]);
    if (!$extension) {
        return 'assets/favicon/dummy.jpg';
    }
    
    // Membuat nama file yang unik dan aman
    $safe_filename = 'item_' . uniqid() . $extension;
    $target_dir = dirname(__DIR__) . '/public/assets/img/';
    $target_file = $target_dir . $safe_filename;
    
    // Pastikan direktori ada
    if (!is_dir($target_dir)) {
        mkdir($target_dir, 0775, true);
    }
    
    // Simpan file
    if (file_put_contents($target_file, $image_content)) {
        return 'assets/img/' . $safe_filename;
    }
    
    return 'assets/favicon/dummy.jpg';
}


try {
    $pdo->beginTransaction();

    $handle = fopen($file['tmp_name'], "r");
    if ($handle === false) {
        throw new Exception("Gagal membuka file CSV.");
    }
    
    // Lewati baris header jika ada
    fgetcsv($handle, 1000, ",");
    
    $row_count = 1;
    while (($data = fgetcsv($handle, 1000, ",")) !== false) {
        $row_count++;
        // CSV format: Nama Barang, Jenis Barang, Jumlah, Link Gambar
        $name = isset($data[0]) ? sanitize_input($data[0]) : null;
        $classifier = isset($data[1]) ? sanitize_input(trim($data[1])) : null;
        $quantity = isset($data[2]) ? (int)$data[2] : null;
        $image_url_source = isset($data[3]) ? trim($data[3]) : null;
        
        // Validasi data
        if (empty($name) || $quantity === null || $quantity < 1) {
            throw new Exception("Data tidak valid pada baris {$row_count}. Pastikan nama dan jumlah diisi dengan benar.");
        }
        
        // Unduh gambar
        $saved_image_path = download_and_save_image($image_url_source, $name);
        
        // Masukkan ke database
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