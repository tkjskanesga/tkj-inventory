<?php
// Endpoint untuk memperbarui data barang yang sudah ada.

$pdo->beginTransaction();

try {
    $id = $_POST['id'] ?? null;
    $name = isset($_POST['name']) ? sanitize_input($_POST['name']) : null;
    $total_quantity = $_POST['total_quantity'] ?? null;
    $image = $_FILES['image'] ?? null;
    $classifier = isset($_POST['classifier']) ? sanitize_input(trim($_POST['classifier'])) : null;
    $current_image_url = $_POST['current_image_url'] ?? null;

    if ($current_image_url && (strpos($current_image_url, '../') !== false || strpos($current_image_url, '..\\') !== false)) {
        json_response('error', 'URL gambar tidak valid.');
    }

    if (!$id || empty($name) || !$total_quantity) {
        json_response('error', 'ID, nama, dan jumlah total tidak boleh kosong.');
    }
    if (!filter_var($total_quantity, FILTER_VALIDATE_INT) || $total_quantity < 0) {
        json_response('error', 'Jumlah total tidak valid.');
    }

    // Pastikan barang yang sedang dipinjam tidak dapat diedit.
    $stmt_check = $pdo->prepare("SELECT COUNT(*) FROM borrowals WHERE item_id = ?");
    $stmt_check->execute([$id]);
    if ($stmt_check->fetchColumn() > 0) {
        json_response('error', 'Tidak bisa mengedit barang yang sedang dalam status dipinjam.');
    }

    $stmt = $pdo->prepare("SELECT * FROM items WHERE id = ?");
    $stmt->execute([$id]);
    $old_item = $stmt->fetch();
    if (!$old_item) {
        json_response('error', 'Barang dengan ID tersebut tidak ditemukan.');
    }
    
    // Hitung ulang stok saat ini berdasarkan perubahan total stok.
    $quantity_difference = $total_quantity - $old_item['total_quantity'];
    $new_current_quantity = $old_item['current_quantity'] + $quantity_difference;

    if ($new_current_quantity < 0) {
        json_response('error', 'Jumlah total tidak boleh kurang dari jumlah barang yang sedang dipinjam.');
    }

    $image_url = $current_image_url ?? $old_item['image_url'];

    if ($image && $image['error'] === UPLOAD_ERR_OK) {
        $upload_result = handle_secure_upload($image, 'assets/img/');
        if ($upload_result['status'] === 'error') {
            throw new Exception($upload_result['message']);
        }
        // Hapus gambar lama jika ada dan upload baru berhasil dan gambar lama bukan dummy.
        $is_dummy_image = ($old_item['image_url'] === 'assets/favicon/dummy.jpg');
        if (!empty($old_item['image_url']) && !$is_dummy_image) {
            $base_path = dirname(__DIR__);
            $file_path = $base_path . '/public/' . ltrim($old_item['image_url'], '/');

            if (file_exists($file_path) && is_file($file_path)) {
                $real_base_path = realpath($base_path . '/public/assets/img');
                $real_file_path = realpath($file_path);
                if ($real_base_path && $real_file_path && strpos($real_file_path, $real_base_path) === 0) {
                    @unlink($file_path);
                }
            }
        }
        $image_url = $upload_result['url'];
    }

    $sql = "UPDATE items SET name = ?, total_quantity = ?, current_quantity = ?, image_url = ?, classifier = ? WHERE id = ?";
    $stmt = $pdo->prepare($sql);
    // Jika classifier kosong, masukkan NULL ke database
    $stmt->execute([$name, $total_quantity, $new_current_quantity, $image_url, empty($classifier) ? null : $classifier, $id]);
    
    $pdo->commit();
    json_response('success', 'Data barang berhasil diperbarui.');

} catch (Exception $e) {
    $pdo->rollBack();
    error_log('Edit Item Error: ' . $e->getMessage());
    json_response('error', 'Gagal memperbarui data barang.');
}