<?php
// Task Dispatcher. Dijalankan oleh cronjob sistem.
// Pastikan file ini hanya bisa dijalankan dari Command Line Interface (CLI).

if (php_sapi_name() !== 'cli') {
    die('Akses ditolak. Skrip ini hanya boleh dijalankan dari CLI.');
}

$rootPath = realpath(dirname(__DIR__));
if (!$rootPath) {
    die("Error: Tidak dapat menentukan root path aplikasi.");
}

require $rootPath . '/config/connect.php';

try {
    $tempDir = $rootPath . '/temp';
    if (!is_dir($tempDir)) {
        @mkdir($tempDir, 0775, true);
    }
    $statusFile = $tempDir . '/autobackup_status.json';

    // Cek file status/lock. Jika 'running', keluar.
    if (file_exists($statusFile)) {
        $statusDataRaw = @file_get_contents($statusFile);
        if ($statusDataRaw) {
            $statusData = json_decode($statusDataRaw, true);
            if (isset($statusData['status']) && $statusData['status'] === 'running') {
                // Proses lain sedang berjalan, keluar secara diam-diam.
                exit;
            }
        }
    }

    // Ambil semua pengaturan auto-backup dari DB
    $stmt = $pdo->query("SELECT setting_key, setting_value FROM settings WHERE setting_key LIKE 'autobackup_%'");
    $settings = $stmt->fetchAll(PDO::FETCH_KEY_PAIR);

    // Cek apakah fitur diaktifkan atau sedang error/running di DB
    if (empty($settings['autobackup_enabled']) || $settings['autobackup_enabled'] == '0') {
        exit;
    }
    if (isset($settings['autobackup_status']) && $settings['autobackup_status'] === 'running') {
        exit;
    }

    // Cek apakah sudah waktunya backup
    if (isTimeForBackup($settings)) {
        
        // Set status di DB ke 'running' (mencegah double run)
        $pdo->exec("UPDATE settings SET setting_value = 'running' WHERE setting_key = 'autobackup_status'");
        
        // Buat file status JSON
        $initialStatus = [
            'status' => 'pending',
            'log' => [
                ['time' => date('H:i:s'), 'message' => 'Backup terjadwal (' . $settings['autobackup_frequency'] . ') dimulai...', 'status' => 'info']
            ]
        ];
        @file_put_contents($statusFile, json_encode($initialStatus, JSON_PRETTY_PRINT));

        // Tentukan path worker dan picu secara asynchronous
        $workerPath = $rootPath . '/cron/auto_backup_worker.php';
        $phpPath = 'php';

        // Perintah shell untuk Windows atau Linux (non-blocking)
        if (strtoupper(substr(PHP_OS, 0, 3)) === 'WIN') {
            // Windows: Gunakan 'start /B'
            shell_exec("start /B $phpPath $workerPath > nul 2> nul");
        } else {
            // Linux/macOS: Gunakan output redirection dan '&'
            shell_exec("$phpPath $workerPath > /dev/null 2>&1 &");
        }
    }

} catch (Exception $e) {
    error_log("Cron Scheduler Error: " . $e->getMessage());
    // Jika terjadi error, set status di DB ke 'error' agar admin tahu
    if (isset($pdo)) {
        $pdo->exec("UPDATE settings SET setting_value = 'error' WHERE setting_key = 'autobackup_status'");
    }
    die($e->getMessage());
}

/**
 * Helper untuk mengecek logika penjadwalan.
 * @param array $settings Pengaturan dari database.
 * @return bool True jika waktunya backup, false jika tidak.
 */
function isTimeForBackup($settings) {
    try {
        $now = new DateTime();
        $backupTime = new DateTime($settings['autobackup_time'] ?? '03:00');
        
        // Cek apakah waktu saat ini sudah melewati waktu backup yang ditentukan
        if ($now->format('H:i') < $backupTime->format('H:i')) {
            return false;
        }

        $lastRun = null;
        if (!empty($settings['autobackup_last_run'])) {
            $lastRun = new DateTime($settings['autobackup_last_run']);
        }
        
        if ($lastRun === null) {
            return true;
        }
        
        if ($lastRun->format('Y-m-d') === $now->format('Y-m-d')) {
            return false;
        }

        // Cek frekuensi
        switch ($settings['autobackup_frequency']) {
            case 'daily':
                return true;
            
            case 'weekly':
                $dayOfWeek = (int)($settings['autobackup_day'] ?? 1);
                return (int)$now->format('N') === $dayOfWeek;
            
            case 'monthly':
                $dayOfMonth = (int)($settings['autobackup_day'] ?? 1);
                return (int)$now->format('j') === $dayOfMonth;
        }

    } catch (Exception $e) {
        error_log("isTimeForBackup Error: " . $e->getMessage());
        return false;
    }
    return false;
}

exit;