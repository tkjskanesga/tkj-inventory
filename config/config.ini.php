<?php
// --- FILE KONFIGURASI DATABASE ---

// Mencegah file diakses secara langsung melalui URL browser,
if (basename(__FILE__) == basename($_SERVER['SCRIPT_FILENAME'])) {
    die('Akses langsung tidak diizinkan.');
}

// Kredensial Database
define('DB_HOST_CONFIG', 'localhost');
define('DB_NAME_CONFIG', 'database_name');
define('DB_USER_CONFIG', 'your_username');
define('DB_PASS_CONFIG', 'your_password');
define('DB_CHARSET_CONFIG', 'utf8mb4');