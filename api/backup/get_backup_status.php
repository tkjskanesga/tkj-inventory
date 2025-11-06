<?php
// Endpoint untuk mendapatkan status backup saat ini.

if (session_status() == PHP_SESSION_NONE) {
    session_start();
}
header('Content-Type: application/json');

// Pengguna harus login untuk melihat status, tetapi tidak perlu menjadi admin.
if (!isset($_SESSION['user_id'])) {
    http_response_code(401);
    echo json_encode(['status' => 'error', 'message' => 'Unauthorized']);
    exit();
}

$status_file_path = dirname(dirname(__DIR__)) . '/temp/backup_status.json';

if (file_exists($status_file_path)) {
    $status_content = @file_get_contents($status_file_path);
    // Langsung keluarkan konten, klien akan menanganinya
    echo $status_content ?: json_encode(['status' => 'error', 'message' => 'Gagal membaca file status.']);
} else {
    // Tidak ada file berarti tidak ada proses backup
    echo json_encode(['status' => 'idle']);
}

exit();