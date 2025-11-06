<?php
// Endpoint untuk mendapatkan status ekspor stok saat ini.

if (session_status() == PHP_SESSION_NONE) {
    session_start();
}
header('Content-Type: application/json');

if (!isset($_SESSION['user_id'])) {
    http_response_code(401);
    echo json_encode(['status' => 'error', 'message' => 'Unauthorized']);
    exit();
}

$status_file_path = dirname(dirname(__DIR__)) . '/temp/export_status.json';

if (file_exists($status_file_path)) {
    $status_content = @file_get_contents($status_file_path);
    echo $status_content ?: json_encode(['status' => 'error', 'message' => 'Gagal membaca file status.']);
} else {
    echo json_encode(['status' => 'idle']);
}

exit();