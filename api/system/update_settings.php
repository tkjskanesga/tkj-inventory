<?php
// Endpoint untuk admin memperbarui pengaturan peminjaman.

$start_time_update = $_POST['start_time'] ?? null;
$end_time_update = $_POST['end_time'] ?? null;
// Menggunakan filter untuk memastikan nilai 'is_locked' adalah boolean (0 atau 1)
$is_locked_update = isset($_POST['is_locked']) ? filter_var($_POST['is_locked'], FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE) : null;

// Pastikan setidaknya ada satu pengaturan yang dikirim untuk diupdate.
if ($start_time_update === null && $end_time_update === null && $is_locked_update === null) {
    json_response('error', 'Tidak ada data pengaturan yang dikirim.');
}

try {
    $pdo->beginTransaction();

    $schedule_changed = ($start_time_update !== null || $end_time_update !== null);

    // Admin memperbarui JADWAL.
    if ($schedule_changed) {
        if ($start_time_update !== null) {
            $stmt = $pdo->prepare("INSERT INTO settings (setting_key, setting_value) VALUES ('borrow_start_time', ?) ON DUPLICATE KEY UPDATE setting_value = ?");
            $stmt->execute([$start_time_update, $start_time_update]);
        }
        
        if ($end_time_update !== null) {
            $stmt = $pdo->prepare("INSERT INTO settings (setting_key, setting_value) VALUES ('borrow_end_time', ?) ON DUPLICATE KEY UPDATE setting_value = ?");
            $stmt->execute([$end_time_update, $end_time_update]);
        }
    } 
    // Admin mengklik tombol KUNCI/BUKA MANUAL.
    else if ($is_locked_update !== null) {
        $lock_value = $is_locked_update ? '1' : '0';
        $stmt = $pdo->prepare("INSERT INTO settings (setting_key, setting_value) VALUES ('is_manually_locked', ?) ON DUPLICATE KEY UPDATE setting_value = ?");
        $stmt->execute([$lock_value, $lock_value]);
    }

    $pdo->commit();
    json_response('success', 'Pengaturan berhasil diperbarui.');

} catch (Exception $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    error_log('Update Settings Error: ' . $e->getMessage());
    json_response('error', 'Gagal memperbarui pengaturan.');
}