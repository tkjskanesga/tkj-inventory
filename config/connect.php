<?php
// Pengaturan koneksi database.
define('DB_HOST', 'localhost');
define('DB_NAME', 'tkj_inventory');
define('DB_USER', 'admin');
define('DB_PASS', 'admin');
define('DB_CHARSET', 'utf8mb4');

// Koneksi PDO untuk keamanan dan efisiensi.
$options = [
    PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    PDO::ATTR_EMULATE_PREPARES   => false,
];

$dsn = "mysql:host=" . DB_HOST . ";dbname=" . DB_NAME . ";charset=" . DB_CHARSET;

try {
    // Inisialisasi koneksi PDO.
    $pdo = new PDO($dsn, DB_USER, DB_PASS, $options);
} catch (\PDOException $e) {
    error_log('Database Connection Error: ' . $e->getMessage());

    header('Content-Type: application/json');
    http_response_code(500); // Internal Server Error
    echo json_encode(['status' => 'error', 'message' => 'Tidak dapat terhubung ke server.']);
    exit();
}
