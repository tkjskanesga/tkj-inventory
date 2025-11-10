<?php
// Endpoint untuk menyimpan konfigurasi auto-backup dari modal UI ke DB.
// Keamanan (require_admin dan CSRF check) sudah ditangani oleh api.php

// Whitelist untuk key yang boleh disimpan dari $_POST
$allowed_keys = [
    'autobackup_enabled',
    'autobackup_frequency',
    'autobackup_day',
    'autobackup_time'
];

try {
    $pdo->beginTransaction();

    $sql = "INSERT INTO settings (setting_key, setting_value) VALUES (?, ?) 
            ON DUPLICATE KEY UPDATE setting_value = ?";
    $stmt = $pdo->prepare($sql);

    foreach ($allowed_keys as $key) {
        if (isset($_POST[$key])) {
            $value = sanitize_input($_POST[$key]);
            
            // --- Validasi ---
            if ($key === 'autobackup_enabled' && !in_array($value, ['0', '1'])) {
                throw new Exception("Nilai 'enabled' tidak valid.");
            }
            if ($key === 'autobackup_frequency' && !in_array($value, ['daily', 'weekly', 'monthly'])) {
                throw new Exception("Nilai 'frequency' tidak valid.");
            }
            if ($key === 'autobackup_day' && (!filter_var($value, FILTER_VALIDATE_INT) || $value < 1 || $value > 31)) {
                throw new Exception("Nilai 'day' tidak valid.");
            }
            // Validasi format waktu HH:MM
            if ($key === 'autobackup_time' && !preg_match('/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/', $value)) {
                 throw new Exception("Format 'time' tidak valid.");
            }

            // Eksekusi prepared statement
            $stmt->execute([$key, $value, $value]);
        }
    }

    $pdo->commit();
    json_response('success', 'Konfigurasi auto backup berhasil disimpan.');

} catch (PDOException $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    error_log('Save AutoBackup Config PDO Error: ' . $e->getMessage());
    json_response('error', 'Gagal menyimpan konfigurasi ke database.');
} catch (Exception $e) {
     if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    error_log('Save AutoBackup Config Error: ' . $e->getMessage());
    json_response('error', $e->getMessage());
}