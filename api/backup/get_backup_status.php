<?php
// Endpoint untuk mendapatkan status backup saat ini.

if (session_status() == PHP_SESSION_NONE) {
    session_start();
}

require_once dirname(__DIR__) . '/helpers/process_status_helper.php';

header('Content-Type: application/json');

// Pengguna harus login untuk melihat status, tetapi tidak perlu menjadi admin.
if (!isset($_SESSION['user_id'])) {
    http_response_code(401);
    echo json_encode(['status' => 'error', 'message' => 'Unauthorized']);
    exit();
}

$status_file_path = dirname(dirname(__DIR__)) . '/temp/backup_status.json';
$status_content = read_status_file_content($status_file_path);

if ($status_content === null) {
    echo json_encode(['status' => 'idle']);
} else {
    echo $status_content;
}

exit();