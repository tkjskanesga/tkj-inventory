<?php
/**
 * Gerbang utama untuk semua permintaan API.
 * Bertanggung jawab untuk routing, keamanan (CSRF), dan memuat endpoint.
 */

if (session_status() == PHP_SESSION_NONE) {
    session_start();
}

// Untuk permintaan non-ekspor, tipe konten adalah JSON.
if (!isset($_GET['action']) || $_GET['action'] !== 'export_history') {
    header('Content-Type: application/json');
}
header('Cache-Control: no-cache, must-revalidate');


// --- FUNGSI HELPER UNTUK OTORISASI ---
/**
 * Memastikan pengguna sudah login sebelum melanjutkan.
 */
function require_login() {
    if (!isset($_SESSION['user_id'])) {
        http_response_code(401); // Unauthorized
        json_response('error', 'Akses ditolak. Anda harus login terlebih dahulu.');
    }
}

/**
 * Memastikan pengguna memiliki peran 'admin'.
 */
function require_admin() {
    if (!isset($_SESSION['role']) || $_SESSION['role'] !== 'admin') {
        http_response_code(403); // Forbidden
        json_response('error', 'Akses ditolak. Anda tidak memiliki hak akses untuk aksi ini.');
    }
}

/**
 * Memvalidasi apakah peminjaman diizinkan.
 */
function validate_borrowing_access($pdo) {
    // Admin selalu diizinkan.
    if (isset($_SESSION['role']) && $_SESSION['role'] === 'admin') {
        return;
    }

    try {
        $stmt = $pdo->query("SELECT setting_key, setting_value FROM settings WHERE setting_key IN ('is_manually_locked', 'borrow_start_time', 'borrow_end_time')");
        $settings = $stmt->fetchAll(PDO::FETCH_KEY_PAIR);

        // Cek kunci manual dari admin.
        if (!empty($settings['is_manually_locked']) && (bool)$settings['is_manually_locked']) {
            json_response('error', 'Aplikasi sedang ditutup oleh admin. Coba lagi nanti.');
        }

        // Cek jadwal peminjaman.
        $start_time_str = $settings['borrow_start_time'] ?? '06:30';
        $end_time_str = $settings['borrow_end_time'] ?? '17:00';

        $timezone = new DateTimeZone('Asia/Jakarta');
        $now = new DateTime('now', $timezone);
        $start_time = DateTime::createFromFormat('H:i', $start_time_str, $timezone);
        $end_time = DateTime::createFromFormat('H:i', $end_time_str, $timezone);

        if ($now < $start_time || $now > $end_time) {
            json_response('error', "Peminjaman hanya dapat dilakukan antara jam $start_time_str - $end_time_str WIB.");
        }

    } catch (Exception $e) {
        error_log('Borrowing Access Validation Error: ' . $e->getMessage());
        json_response('error', 'Gagal memvalidasi status aplikasi.');
    }
}


function get_base_url() {
    $protocol = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? "https://" : "http://";
    $host = $_SERVER['HTTP_HOST'];
    // Ambil path direktori dari skrip saat ini dan hapus nama file 'api.php'
    $path = rtrim(dirname($_SERVER['SCRIPT_NAME']), '/\\');
    // Hapus '/public' jika ada, untuk mendapatkan root aplikasi
    $path = str_replace('/public', '', $path);
    return $protocol . $host . $path;
}

function json_response($status, $message, $data = null) {
    $response = ['status' => $status, 'message' => $message];
    if ($data !== null) {
        $response['data'] = $data;
    }
    echo json_encode($response, JSON_PRETTY_PRINT);
    exit();
}

function sanitize_input($input) {
    return htmlspecialchars(trim($input), ENT_QUOTES, 'UTF-8');
}

function handle_secure_upload($file_input, $target_subdirectory) {
    if (!$file_input || $file_input['error'] !== UPLOAD_ERR_OK) {
        return ['status' => 'error', 'message' => 'Tidak ada file yang diunggah atau terjadi error.'];
    }
    $max_file_size = 20 * 1024 * 1024;
    if ($file_input['size'] > $max_file_size) {
        return ['status' => 'error', 'message' => 'Ukuran file tidak boleh lebih dari 20MB.'];
    }
    $allowed_types = [
        'image/jpeg' => 'jpg', 'image/png'  => 'png',
        'image/webp' => 'webp', 'image/gif'  => 'gif'
    ];
    $file_info = finfo_open(FILEINFO_MIME_TYPE);
    $mime_type = finfo_file($file_info, $file_input['tmp_name']);
    finfo_close($file_info);
    if (!isset($allowed_types[$mime_type])) {
        return ['status' => 'error', 'message' => 'Tipe file tidak valid. Hanya JPG, PNG, WEBP dan GIF yang diizinkan.'];
    }
    $extension = $allowed_types[$mime_type];
    $safe_filename = uniqid('file_', true) . '.' . $extension;
    $target_dir = dirname(__DIR__) . '/public/' . $target_subdirectory;
    $target_file = $target_dir . $safe_filename;
    if (!is_dir($target_dir)) {
        mkdir($target_dir, 0775, true);
    }
    if (move_uploaded_file($file_input['tmp_name'], $target_file)) {
        return ['status' => 'success', 'url' => $target_subdirectory . $safe_filename];
    } else {
        return ['status' => 'error', 'message' => 'Gagal memindahkan file yang diunggah.'];
    }
}


// --- ROUTING & KEAMANAN ---

$action = $_REQUEST['action'] ?? '';
if (empty($action)) {
    json_response('error', 'Parameter action tidak ditemukan.');
}

// Endpoint 'get_csrf_token' harus dipanggil sebelum login
if ($action === 'get_csrf_token') {
    if (empty($_SESSION['csrf_token'])) {
        $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
    }
    json_response('success', 'Token retrieved', ['token' => $_SESSION['csrf_token']]);
}

// Semua endpoint memerlukan login
require_login();


// --- PROTEKSI CSRF ---

$unprotected_actions = ['get_data', 'get_captcha', 'export_history', 'get_settings', 'get_statistics', 'get_disk_usage'];
if (!in_array($action, $unprotected_actions)) {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        json_response('error', 'Metode request tidak valid.');
    }
    $token = $_POST['csrf_token'] ?? '';
    if (empty($token) || !isset($_SESSION['csrf_token']) || !hash_equals($_SESSION['csrf_token'], $token)) {
        http_response_code(403);
        json_response('error', 'Sesi tidak valid atau telah kedaluwarsa. Silakan muat ulang halaman.');
    }
}

require_once __DIR__ . '/../config/connect.php';
if (!isset($pdo)) {
    json_response('error', 'Koneksi database tidak tersedia.');
}

// --- OTORISASI BERBASIS PERAN DAN JADWAL ---

$admin_only_actions = [
    'add_item', 
    'edit_item', 
    'delete_item', 
    'flush_history',
    'update_credentials',
    'delete_history_item',
    'update_settings',
    'edit_borrowal',
    'get_statistics',
    'get_disk_usage'
];
if (in_array($action, $admin_only_actions)) {
    require_admin();
}

// Panggil validasi "kunci"
$user_write_actions = ['borrow_item', 'return_item'];
if (in_array($action, $user_write_actions)) {
    validate_borrowing_access($pdo);
}

// --- EKSEKUSI ENDPOINT ---

$api_dir = dirname(__DIR__) . '/api/';
$action_map = [
    'get_data'            => 'get_data.php',    
    'add_item'            => 'input.php',
    'edit_item'           => 'edit.php',      
    'delete_item'         => 'delete.php',
    'borrow_item'         => 'borrow.php',    
    'return_item'         => 'return.php',
    'flush_history'       => 'flush_history.php', 
    'get_captcha'         => 'captcha.php',
    'export_history'      => 'export_history.php',
    'update_credentials'  => 'update_credentials.php',
    'delete_history_item' => 'delete_history.php',
    'get_settings'        => 'get_settings.php',
    'update_settings'     => 'update_settings.php',
    'edit_borrowal'       => 'edit_borrowal.php',
    'get_statistics'      => 'get_statistics.php',
    'get_disk_usage'      => 'get_disk_usage.php'
];

if (!isset($action_map[$action])) {
    json_response('error', 'Action tidak valid: ' . htmlspecialchars($action));
}
$file = $api_dir . $action_map[$action];
if (!file_exists($file)) {
    json_response('error', 'Endpoint API tidak ditemukan.');
}
try {
    require $file;
} catch (Exception $e) {
    error_log('API Error for action ' . $action . ': ' . $e->getMessage());
    json_response('error', 'Terjadi kesalahan sistem.');
}