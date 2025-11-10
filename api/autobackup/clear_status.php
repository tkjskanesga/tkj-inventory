<?php
// Endpoint untuk UI menghapus file status JSON setelah log dilihat.
// Keamanan (require_admin dan CSRF check) sudah ditangani oleh api.php

$status_file_path = dirname(__DIR__, 2) . '/temp/autobackup_status.json';

if (file_exists($status_file_path)) {
    $base_dir = realpath(dirname(__DIR__, 2) . '/temp');
    $real_file_path = realpath($status_file_path);

    // Mencegah penghapusan file di luar direktori /temp
    if ($real_file_path && $base_dir && strpos($real_file_path, $base_dir) === 0 && basename($real_file_path) === 'autobackup_status.json') {
        if (!@unlink($status_file_path)) {
            json_response('error', 'Gagal menghapus file status. Periksa izin folder temp.');
        }
    } else {
        json_response('error', 'Operasi tidak diizinkan.');
        exit();
    }
}

json_response('success', 'Status dibersihkan.');