<?php
// Endpoint untuk membersihkan/menghapus file status backup dan file CSV temporer setelah selesai atau gagal.

$temp_dir = dirname(__DIR__) . '/temp/';
$status_file_path = $temp_dir . 'backup_status.json';
$all_cleaned = true;

// Hapus file status JSON
if (file_exists($status_file_path)) {
    if (!@unlink($status_file_path)) {
        $all_cleaned = false;
    }
}

// Hapus file CSV temporer yang spesifik untuk backup riwayat
$csv_files = glob($temp_dir . 'backup_riwayat_*.csv');
if ($csv_files) {
    foreach ($csv_files as $csv_file) {
        if (file_exists($csv_file)) {
            if (!@unlink($csv_file)) {
                $all_cleaned = false;
            }
        }
    }
}

if ($all_cleaned) {
    json_response('success', 'Semua file backup temporer berhasil dibersihkan.');
} else {
    // Memberikan pesan error jika salah satu file gagal dihapus
    json_response('error', 'Gagal menghapus beberapa file backup temporer. Periksa izin folder.');
}