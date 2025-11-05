<?php
/**
 * Endpoint Server-Sent Events (SSE) untuk status lock.
 * File ini dipanggil oleh public/api.php
 */

// Set header khusus untuk SSE
header('Content-Type: text/event-stream');
header('Cache-Control: no-cache');
header('Connection: keep-alive');
header('X-Accel-Buffering: no');

if (function_exists('apache_setenv')) {
    @apache_setenv('no-gzip', 1);
}
@ini_set('zlib.output_compression', 0);
@ini_set('implicit_flush', 1);
while (ob_get_level() > 0) {
    ob_end_flush();
}
ob_implicit_flush(1);

require_once __DIR__ . '/get_lock_status.php'; 

/**
 * @return array Status lock.
 * @throws Throwable Jika database error.
 */
function get_cached_lock_status() {
    static $cache_file = null;
    if ($cache_file === null) {
        $temp_dir = dirname(__DIR__) . '/../temp';
        if (!is_dir($temp_dir)) {
            @mkdir($temp_dir, 0775, true);
        }
        $cache_file = $temp_dir . '/lock_status.json';
    }
    $cache_lifetime_seconds = 2;

    if (file_exists($cache_file) && (time() - @filemtime($cache_file) < $cache_lifetime_seconds)) {
        $data = @file_get_contents($cache_file);
        if ($data) {
            $decoded = json_decode($data, true);
            if ($decoded) return $decoded;
        }
    }

    $fp = fopen($cache_file, 'c+');

    if (!$fp) {
        global $pdo;
        return get_lock_status($pdo); 
    }
    
    if (!flock($fp, LOCK_EX | LOCK_NB, $would_block)) {
        fclose($fp);

        if ($would_block) {
            usleep(100000);
            $data = @file_get_contents($cache_file);
            if ($data) {
                $decoded = json_decode($data, true);
                if ($decoded) return $decoded;
            }
        }
        global $pdo;
        return get_lock_status($pdo);
    }
    
    fseek($fp, 0);
    $data = stream_get_contents($fp);
    if (!empty($data) && (time() - fstat($fp)['mtime'] < $cache_lifetime_seconds)) {
        $decoded = json_decode($data, true);
        if ($decoded) {
            flock($fp, LOCK_UN);
            fclose($fp);
            return $decoded;
        }
    }
    
    try {
        global $pdo;
        $current_status = get_lock_status($pdo);
    } catch (Throwable $e) {
        flock($fp, LOCK_UN);
        fclose($fp);
        throw $e;
    }

    ftruncate($fp, 0);
    fseek($fp, 0);
    fwrite($fp, json_encode($current_status));
    
    flock($fp, LOCK_UN);
    fclose($fp);
    
    return $current_status;
}


$last_status_json = "";

$max_runtime = 30;
$start_time = time();

try {
    while (time() - $start_time < $max_runtime) {
        
        if (connection_aborted()) {
            break;
        }

        $current_status = get_cached_lock_status();
        $current_status_json = json_encode($current_status);

        if ($current_status_json !== $last_status_json) {
            echo "event: lock_update\n";
            echo "data: " . $current_status_json . "\n\n";
            
            flush();
            
            $last_status_json = $current_status_json;
        }
        
        sleep(1);
    }
} catch (Throwable $e) {
    error_log("SSE Fatal Error: " . $e->getMessage());
    echo "event: error\n";
    echo "data: " . json_encode(['message' => 'Koneksi server terputus: ' . $e->getMessage()]) . "\n\n";
    flush();
}

exit();
?>