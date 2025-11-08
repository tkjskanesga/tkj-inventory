<?php
// Endpoint untuk UI membaca file status JSON auto-backup.
// Keamanan (require_admin) sudah ditangani oleh api.php

$status_file_path = dirname(__DIR__, 2) . '/temp/autobackup_status.json';

if (file_exists($status_file_path)) {
    // Ambil konten file
    $status_content = @file_get_contents($status_file_path);
    
    // Periksa apakah pembacaan berhasil
    if ($status_content === false) {
        json_response('error', 'Gagal membaca file status. Periksa izin folder temp.');
    } else {
        echo $status_content;
    }
} else {
    echo json_encode(['status' => 'idle']);
}

exit();