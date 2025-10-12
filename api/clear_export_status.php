<?php
// Endpoint untuk membersihkan file status ekspor stok setelah selesai atau gagal.

$temp_dir = dirname(__DIR__) . '/temp/';
$status_file_path = $temp_dir . 'export_status.json';
$all_cleaned = true;

if (file_exists($status_file_path)) {
    if (!@unlink($status_file_path)) {
        $all_cleaned = false;
    }
}

// Hapus juga file CSV temporer jika ada
$csv_files = glob($temp_dir . 'ekspor_stok_*.csv');
foreach ($csv_files as $csv_file) {
    if (file_exists($csv_file)) {
        if (!@unlink($csv_file)) {
            $all_cleaned = false;
        }
    }
}

if ($all_cleaned) {
    json_response('success', 'Semua file ekspor temporer berhasil dibersihkan.');
} else {
    json_response('error', 'Gagal menghapus beberapa file ekspor temporer.');
}