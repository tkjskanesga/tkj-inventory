<?php
/**
 * Helper terpusat untuk membaca, mengunci, dan menulis file status JSON.
 * Mencegah duplikasi kode dan memastikan file locking (flock) diterapkan secara konsisten.
 */

if (basename(__FILE__) == basename($_SERVER['SCRIPT_FILENAME'])) {
    die('Akses langsung tidak diizinkan.');
}

function read_status_file_content($status_file_path) {
    if (!file_exists($status_file_path)) {
        return null;
    }
    $content = @file_get_contents($status_file_path);
    return $content ?: null;
}

function lock_and_read_status($status_file_path) {
    $fp = @fopen($status_file_path, 'r+');
    if (!$fp) {
        return null;
    }

    if (!flock($fp, LOCK_EX)) {
        @fclose($fp);
        return null;
    }

    $content = @stream_get_contents($fp);
    $data = $content ? json_decode($content, true) : null;

    return ['fp' => $fp, 'data' => $data];
}

function write_and_unlock_status($fp, $data_array) {
    if (!$fp) {
        return;
    }
    @ftruncate($fp, 0);
    @rewind($fp);
    @fwrite($fp, json_encode($data_array, JSON_PRETTY_PRINT));
    @fflush($fp);
    @flock($fp, LOCK_UN);
    @fclose($fp);
}