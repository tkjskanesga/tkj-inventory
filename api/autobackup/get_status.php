<?php
// Endpoint untuk UI membaca file status JSON auto-backup.
// Keamanan (require_admin) sudah ditangani oleh api.php

require_once dirname(__DIR__, 2) . '/api/helpers/process_status_helper.php';

$status_file_path = dirname(__DIR__, 2) . '/temp/autobackup_status.json';
$status_content = read_status_file_content($status_file_path);

if ($status_content === null) {
    echo json_encode(['status' => 'idle']);
} else {
    echo $status_content;
}

exit();