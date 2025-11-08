<?php
// Endpoint untuk mengambil konfigurasi auto-backup dari DB untuk modal UI.
// Keamanan (require_admin) sudah ditangani oleh api.php

try {
    $stmt = $pdo->query("SELECT setting_key, setting_value FROM settings WHERE setting_key LIKE 'autobackup_%'");
    
    // Menggunakan FETCH_KEY_PAIR untuk mendapatkan hasil sebagai [key => value]
    $config = $stmt->fetchAll(PDO::FETCH_KEY_PAIR);

    // Jika tidak ada data, kirim array kosong
    if ($config === false) {
        $config = [];
    }
    
    // Kirim respons sukses
    json_response('success', 'Konfigurasi diambil.', $config);

} catch (PDOException $e) {
    error_log('Get AutoBackup Config Error: ' . $e->getMessage());
    json_response('error', 'Gagal mengambil konfigurasi dari database.');
}