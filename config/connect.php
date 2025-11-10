<?php
// Path ke file konfigurasi yang terpisah.
$config_file = __DIR__ . '/config.ini.php';

// Periksa apakah file konfigurasi ada sebelum memuatnya.
if (!file_exists($config_file)) {
    $error_message = 'Kesalahan Internal Server';
    error_log($error_message);
    http_response_code(500); // Internal Server Error
    header('Content-Type: application/json');
    echo json_encode(['status' => 'error', 'message' => $error_message]);
    exit();
}

require_once $config_file;

if (defined('APP_TIMEZONE') && function_exists('date_default_timezone_set')) {
    date_default_timezone_set(APP_TIMEZONE);
}

// Pengaturan koneksi database menggunakan konstanta dari config.ini.php
$db_host = defined('DB_HOST_CONFIG') ? DB_HOST_CONFIG : 'localhost';
$db_name = defined('DB_NAME_CONFIG') ? DB_NAME_CONFIG : 'db_name';
$db_user = defined('DB_USER_CONFIG') ? DB_USER_CONFIG : 'db_username';
$db_pass = defined('DB_PASS_CONFIG') ? DB_PASS_CONFIG : 'db_password';
$db_charset = defined('DB_CHARSET_CONFIG') ? DB_CHARSET_CONFIG : 'utf8mb4';

$options = [
    PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    PDO::ATTR_EMULATE_PREPARES   => false,
];

$dsn = "mysql:host={$db_host};dbname={$db_name};charset={$db_charset}";

try {
    // Inisialisasi koneksi PDO.
    $pdo = new PDO($dsn, $db_user, $db_pass, $options);
} catch (\PDOException $e) {
    error_log('Database Connection Error: ' . $e->getMessage());

    header('Content-Type: application/json');
    http_response_code(500); // Internal Server Error
    echo json_encode(['status' => 'error', 'message' => 'Tidak dapat terhubung ke server.']);
    exit();
}