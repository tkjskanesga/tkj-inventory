<?php
// Endpoint untuk membersihkan seluruh riwayat pengembalian.

$user_captcha = $_POST['captcha'] ?? '';
if (empty($user_captcha) || !isset($_SESSION['captcha_answer']) || strtolower($user_captcha) !== strtolower($_SESSION['captcha_answer'])) {
    unset($_SESSION['captcha_answer']);
    json_response('error', 'Captcha yang Anda masukkan salah.');
}
// Bersihkan captcha setelah digunakan untuk mencegah replay attack.
unset($_SESSION['captcha_answer']);

try {
    $pdo->beginTransaction();
    
    // Ambil semua URL gambar bukti untuk dihapus dari server.
    $stmt = $pdo->query("SELECT proof_image_url FROM history WHERE proof_image_url IS NOT NULL AND proof_image_url != ''");
    $image_urls = $stmt->fetchAll(PDO::FETCH_COLUMN);
    
    $base_path = dirname(dirname(__DIR__));
    foreach ($image_urls as $url) {
        $file_path = $base_path . '/public/' . ltrim($url, '/');
        // Pastikan file ada dan berada di dalam direktori 'evidence' sebelum dihapus.
        if (file_exists($file_path) && is_file($file_path)) {
            if (strpos(realpath($file_path), realpath($base_path . '/public/assets/evidence')) === 0) {
                @unlink($file_path);
            }
        }
    }

    // Hapus semua entri dari tabel riwayat.
    $pdo->exec("DELETE FROM history");
    
    $pdo->commit();
    json_response('success', 'Semua riwayat berhasil dibersihkan.');

} catch (Exception $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    error_log('Flush History Error: ' . $e->getMessage());
    json_response('error', 'Gagal membersihkan riwayat.');
}