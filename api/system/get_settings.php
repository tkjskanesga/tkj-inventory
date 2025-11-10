<?php
// Endpoint untuk mengambil semua data pengaturan.

$helper_path = __DIR__ . '/../helpers/get_lock_status.php';
require_once $helper_path;

try {
    if (!function_exists('get_lock_status')) {
        json_response('error', 'Kesalahan internal server.');
        exit;
    }

    $settings = get_lock_status($pdo);
    
    json_response('success', 'Pengaturan berhasil diambil.', $settings);

} catch (Exception $e) {
    error_log("Get Settings Error: " . $e->getMessage());
    json_response('error', 'Gagal mengambil pengaturan dari server: ' . $e->getMessage());
}
?>