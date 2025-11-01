<?php
// Endpoint untuk menghapus barang dari inventaris.

$id = $_POST['id'] ?? null;
if (!$id) {
    json_response('error', 'ID barang tidak ditemukan.');
}

try {
    $pdo->beginTransaction();

    // Verifikasi bahwa barang tidak sedang dipinjam sebelum dihapus.
    $stmt = $pdo->prepare("SELECT COUNT(*) FROM borrowals WHERE item_id = ?");
    $stmt->execute([$id]);
    if ($stmt->fetchColumn() > 0) {
        $pdo->rollBack();
        json_response('error', 'Tidak bisa menghapus barang yang sedang dipinjam.');
    }

    // Ambil path gambar untuk dihapus dari server.
    $stmt = $pdo->prepare("SELECT image_url FROM items WHERE id = ?");
    $stmt->execute([$id]);
    $image_url = $stmt->fetchColumn();

    $stmt = $pdo->prepare("DELETE FROM items WHERE id = ?");
    $stmt->execute([$id]);

    $is_dummy_image = ($image_url === 'assets/favicon/dummy.jpg');
    if ($image_url && !$is_dummy_image && file_exists(dirname(__DIR__) . '/public/' . $image_url)) {
        unlink(dirname(__DIR__) . '/public/' . $image_url);
    }
    
    $pdo->commit();
    json_response('success', 'Barang berhasil dihapus.');

} catch (PDOException $e) {
    $pdo->rollBack();
    error_log('Delete Item Error: ' . $e->getMessage());
    json_response('error', 'Gagal menghapus barang.');
}