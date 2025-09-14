<?php
// Endpoint untuk mengambil semua data pengaturan.

try {
    $stmt = $pdo->query("SELECT setting_key, setting_value FROM settings");
    $settings = $stmt->fetchAll(PDO::FETCH_KEY_PAIR);

    // Nilai default jika tidak ada di database
    $is_manually_locked = isset($settings['is_manually_locked']) ? (bool)$settings['is_manually_locked'] : false;
    $start_time_str = $settings['borrow_start_time'] ?? '06:30';
    $end_time_str = $settings['borrow_end_time'] ?? '17:00';
    
    $settings['borrow_start_time'] = $start_time_str;
    $settings['borrow_end_time'] = $end_time_str;

    $is_locked_by_schedule = false;
    try {
        $timezone = new DateTimeZone('Asia/Jakarta');
        $now = new DateTime('now', $timezone);
        $start_time = DateTime::createFromFormat('H:i', $start_time_str, $timezone);
        $end_time = DateTime::createFromFormat('H:i', $end_time_str, $timezone);

        if (!$start_time || !$end_time) {
            throw new Exception("Invalid time format in settings.");
        }

        if ($now < $start_time || $now > $end_time) {
            $is_locked_by_schedule = true;
        }
    } catch (Exception $e) {
        error_log("Time calculation error in get_settings.php: " . $e->getMessage());
        $is_locked_by_schedule = true;
    }
    
    $is_app_locked = $is_manually_locked || $is_locked_by_schedule;
    
    // Tentukan alasan yang jelas untuk client
    $lock_reason = 'open';
    if ($is_manually_locked) {
        $lock_reason = 'manual';
    } else if ($is_locked_by_schedule) {
        $lock_reason = 'schedule';
    }
    
    // Kirim status yang sudah dihitung dan jelas ke client
    $settings['is_manually_locked'] = $is_manually_locked;
    $settings['is_app_locked'] = $is_app_locked;
    $settings['lock_reason'] = $lock_reason;

    json_response('success', 'Pengaturan berhasil diambil.', $settings);

} catch (PDOException $e) {
    error_log("Get Settings Error: " . $e->getMessage());
    json_response('error', 'Gagal mengambil pengaturan dari server.');
}