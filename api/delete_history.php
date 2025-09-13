<?php
// Endpoint untuk menghapus satu entri riwayat pengembalian.

$id = $_POST['id'] ?? null;
if (!$id) {
    json_response('error', 'ID riwayat tidak ditemukan.');
}

try {
    $pdo->beginTransaction();

    // Ambil path gambar untuk dihapus dari server.
    $stmt = $pdo->prepare("SELECT proof_image_url FROM history WHERE id = ?");
    $stmt->execute([$id]);
    $image_url = $stmt->fetchColumn();

    // Hapus entri dari database.
    $stmt = $pdo->prepare("DELETE FROM history WHERE id = ?");
    $stmt->execute([$id]);
    
    // Periksa apakah baris benar-benar dihapus sebelum melanjutkan.
    if ($stmt->rowCount() === 0) {
        $pdo->rollBack();
        json_response('error', 'Riwayat dengan ID tersebut tidak ditemukan.');
    }

    // Jika entri berhasil dihapus dan ada gambar, hapus filenya.
    if ($image_url) {
        $base_path = dirname(__DIR__);
        $file_path = $base_path . '/public/' . ltrim($image_url, '/');
        if (file_exists($file_path) && is_file($file_path)) {
            // Pastikan file berada di dalam direktori 'evidence' yang diizinkan untuk keamanan.
            if (strpos(realpath($file_path), realpath($base_path . '/public/assets/evidence')) === 0) {
                @unlink($file_path);
            }
        }
    }
    
    $pdo->commit();
    json_response('success', 'Riwayat berhasil dihapus.');

} catch (Exception $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    error_log('Delete History Item Error: ' . $e->getMessage());
    json_response('error', 'Gagal menghapus riwayat.');
}