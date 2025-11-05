<?php
// Endpoint untuk menghapus beberapa barang dari inventaris sekaligus.

$ids = $_POST['ids'] ?? null;
if (empty($ids) || !is_array($ids)) {
    json_response('error', 'Tidak ada ID barang yang dipilih.');
}

try {
    $pdo->beginTransaction();

    $borrowed_items = [];
    $image_urls_to_delete = [];

    // Verifikasi semua item dan kumpulkan data
    foreach ($ids as $id) {
        $sanitized_id = filter_var($id, FILTER_VALIDATE_INT);
        if (!$sanitized_id) {
            throw new Exception("ID barang tidak valid terdeteksi.");
        }

        // Cek apakah barang sedang dipinjam.
        $stmt_check = $pdo->prepare("SELECT COUNT(*) FROM borrowals WHERE item_id = ?");
        $stmt_check->execute([$sanitized_id]);
        if ($stmt_check->fetchColumn() > 0) {
            // Jika ada yang dipinjam, kumpulkan namanya untuk pesan error.
            $stmt_name = $pdo->prepare("SELECT name FROM items WHERE id = ?");
            $stmt_name->execute([$sanitized_id]);
            $borrowed_items[] = $stmt_name->fetchColumn();
        }

        // Ambil path gambar untuk dihapus nanti.
        $stmt_img = $pdo->prepare("SELECT image_url FROM items WHERE id = ?");
        $stmt_img->execute([$sanitized_id]);
        $image_url = $stmt_img->fetchColumn();
        if ($image_url) {
            $image_urls_to_delete[] = $image_url;
        }
    }

    // Jika ada barang yang sedang dipinjam, batalkan seluruh operasi.
    if (!empty($borrowed_items)) {
        $pdo->rollBack();
        $error_message = 'Gagal: Barang berikut sedang dipinjam: ' . implode(', ', $borrowed_items) . '.';
        json_response('error', $error_message);
    }

    // Hapus item dari database
    $placeholders = implode(',', array_fill(0, count($ids), '?'));
    $stmt_delete = $pdo->prepare("DELETE FROM items WHERE id IN ($placeholders)");
    $stmt_delete->execute($ids);

    // Hapus file gambar dari server
    foreach ($image_urls_to_delete as $url) {
        if (empty($url) || $url === 'assets/favicon/dummy.jpg') {
            continue;
        }

        $base_path = dirname(__DIR__);
        $file_path = $base_path . '/public/' . ltrim($url, '/');

        if (file_exists($file_path) && is_file($file_path)) {
            $real_base_path = realpath($base_path . '/public/assets/img');
            $real_file_path = realpath($file_path);

            if ($real_base_path && $real_file_path && strpos($real_file_path, $real_base_path) === 0) {
                @unlink($file_path);
            }
        }
    }
    
    $pdo->commit();
    json_response('success', count($ids) . ' barang berhasil dihapus.');

} catch (Exception $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    error_log('Delete Multiple Items Error: ' . $e->getMessage());
    json_response('error', 'Gagal menghapus barang.');
}