<?php
// Endpoint untuk mendapatkan statistik penggunaan disk.

/**
 * Memformat byte menjadi satuan yang lebih mudah dibaca (KB, MB, GB, TB).
 * @param int $bytes Ukuran dalam byte.
 * @param int $precision Jumlah angka di belakang koma.
 * @return string Ukuran yang sudah diformat.
 */
function format_bytes($bytes, $precision = 2) {
    $units = ['B', 'KB', 'MB', 'GB', 'TB'];
    $bytes = max($bytes, 0);
    $pow = floor(($bytes ? log($bytes) : 0) / log(1024));
    $pow = min($pow, count($units) - 1);
    $bytes /= (1 << (10 * $pow));
    return round($bytes, $precision) . ' ' . $units[$pow];
}

// Menggunakan path dari direktori aplikasi untuk mendapatkan info disk yang relevan.
$path = dirname(__DIR__); 

$total_space = @disk_total_space($path);
$free_space = @disk_free_space($path);

if ($total_space === false || $free_space === false) {
    // Fungsi mungkin dinonaktifkan oleh hosting, kirim response error yang jelas.
    json_response('error', 'Tidak dapat mengambil informasi disk. Fitur mungkin dinonaktifkan di server.');
}

$used_space = $total_space - $free_space;
$used_percentage = ($total_space > 0) ? ($used_space / $total_space) * 100 : 0;

$data = [
    'total' => $total_space,
    'used' => $used_space,
    'free' => $free_space,
    'used_percentage' => round($used_percentage, 2),
    'formatted_total' => format_bytes($total_space),
    'formatted_used' => format_bytes($used_space),
    'formatted_free' => format_bytes($free_space),
];

json_response('success', 'Data penggunaan disk berhasil diambil.', $data);