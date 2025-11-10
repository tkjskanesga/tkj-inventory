<?php
// Endpoint untuk membersihkan file status impor CSV setelah selesai atau gagal.
require_admin();

$status_file_path = dirname(dirname(__DIR__)) . '/temp/import_status.json';

if (file_exists($status_file_path)) {
    // Baca nama file csv sementara sebelum menghapus file status
    $status_content = @file_get_contents($status_file_path);
    $status_data = $status_content ? json_decode($status_content, true) : null;

    if (!@unlink($status_file_path)) {
       json_response('error', 'Gagal menghapus file status impor.');
    }
    
    // Hapus juga file csv sementara jika infonya ada
    if ($status_data && isset($status_data['csv_file'])) {
        $temp_csv_path = dirname(dirname(__DIR__)) . '/temp/' . $status_data['csv_file'];
        if(file_exists($temp_csv_path)) {
            @unlink($temp_csv_path);
        }
    }
}

json_response('success', 'File impor temporer berhasil dibersihkan.');