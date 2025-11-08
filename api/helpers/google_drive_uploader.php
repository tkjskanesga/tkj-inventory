<?php
// File helper terpusat untuk mengunggah file ke Google Drive dengan retry logic.

// Pastikan file ini tidak dieksekusi secara langsung
if (basename(__FILE__) == basename($_SERVER['SCRIPT_FILENAME'])) {
    die('Akses langsung tidak diizinkan.');
}

// Konfigurasi retry
if (!defined('MAX_RETRIES')) {
    define('MAX_RETRIES', 3); // Jumlah percobaan ulang maksimum
}
if (!defined('RETRY_DELAY')) {
    define('RETRY_DELAY', 5); // Delay sebelum coba lagi
}

function upload_single_file_to_drive($filePath, $mimeType, $folderId, $subfolder = null, $logCallback = null) {
    if (!file_exists($filePath) || !is_readable($filePath)) {
        return ['status' => 'error', 'message' => 'File lokal tidak ada atau tidak bisa dibaca: ' . basename($filePath)];
    }

    $retries = 0;
    $last_error_message = '';
    $fileName = basename($filePath);

    while ($retries < MAX_RETRIES) {
        $postData = [
            'secret'   => GOOGLE_SCRIPT_SECRET,
            'folderId' => $folderId,
            'file'     => base64_encode(file_get_contents($filePath)),
            'filename' => $fileName,
            'mimetype' => $mimeType
        ];
        if ($subfolder) {
            $postData['subfolder'] = $subfolder;
        }

        $ch = curl_init(GOOGLE_SCRIPT_URL);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => 1,
            CURLOPT_POST => 1,
            CURLOPT_POSTFIELDS => $postData,
            CURLOPT_FOLLOWLOCATION => true,
            CURLOPT_TIMEOUT => 90
        ]);
        $response = curl_exec($ch);
        $error = curl_error($ch);
        curl_close($ch);

        // Cek kegagalan cURL
        if ($error) {
            $last_error_message = 'cURL Error: ' . $error;
            $retries++;
            if ($logCallback) {
                $logCallback("($fileName) Gagal mengunggah (" . $retries . "/" . MAX_RETRIES . "): " . $last_error_message . ". Mencoba lagi...");
            }
            if ($retries < MAX_RETRIES) {
                sleep(RETRY_DELAY);
            }
        } else {
            // Cek respons dari Apps Script
            $decoded_response = json_decode($response, true);
            if (json_last_error() === JSON_ERROR_NONE && isset($decoded_response['status'])) {
                if ($decoded_response['status'] === 'success') {
                    if ($logCallback) {
                         $logCallback("($fileName) Berhasil diunggah.");
                    }
                    return $decoded_response;
                } else {
                    $last_error_message = $decoded_response['message'] ?? 'Apps Script mengembalikan error.';
                }
            } else {
                $last_error_message = 'Respons tidak valid dari Google Apps Script.';
            }

            $retries++;
            if ($logCallback) {
                $logCallback("($fileName) Gagal merespons (" . $retries . "/" . MAX_RETRIES . "): " . $last_error_message . ". Mencoba lagi...");
            }
            if ($retries < MAX_RETRIES) {
                sleep(RETRY_DELAY);
            }
        }
    }

    return ['status' => 'error', 'message' => $last_error_message];
}