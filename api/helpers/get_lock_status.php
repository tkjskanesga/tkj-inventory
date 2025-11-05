<?php
/**
 * File helper terpusat untuk mengambil dan menghitung status lock aplikasi.
 * Ini akan digunakan oleh get_settings.php (untuk load awal) dan sse_lock_status.php (untuk polling).
 */

if (!function_exists('get_lock_status')) {
    /**
     * @param ?PDO $pdo Instance koneksi PDO (Opsional).
     * @return array Array berisi semua data status.
     * @throws Throwable Jika terjadi error database atau kalkulasi.
     */
    function get_lock_status($pdo = null) {
        
        try {
            if ($pdo === null) {
                require_once dirname(__DIR__) . '/../config/connect.php'; 
                if (!isset($pdo)) {
                    throw new \Exception("Gagal terhubung ke database di dalam helper.");
                }
            }

            $stmt = $pdo->query("SELECT setting_key, setting_value FROM settings WHERE setting_key IN ('is_manually_locked', 'borrow_start_time', 'borrow_end_time')");
            $settings = $stmt->fetchAll(PDO::FETCH_KEY_PAIR);

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
                    throw new Exception("Invalid time format in database settings.");
                }

                if ($now < $start_time || $now > $end_time) {
                    $is_locked_by_schedule = true;
                }
            } catch (Exception $e) {
                error_log("Time calculation error in get_lock_status: " . $e->getMessage());
                $is_locked_by_schedule = true;
            }
            
            $is_app_locked = $is_manually_locked || $is_locked_by_schedule;
            
            $lock_reason = 'open';
            if ($is_manually_locked) {
                $lock_reason = 'manual';
            } else if ($is_locked_by_schedule) {
                $lock_reason = 'schedule';
            }
            
            $settings['is_manually_locked'] = $is_manually_locked;
            $settings['is_app_locked'] = $is_app_locked;
            $settings['lock_reason'] = $lock_reason;

            return $settings;
        
        } catch (Throwable $e) {
            error_log("Fatal error in get_lock_status helper: " . $e->getMessage());
            throw $e;
        }
    }
}
?>