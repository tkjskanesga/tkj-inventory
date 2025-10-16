<?php
// Mencegah caching pada sisi klien untuk memastikan sesi selalu baru
header("Cache-Control: no-store, no-cache, must-revalidate, max-age=0");
header("Cache-Control: post-check=0, pre-check=0", false);
header("Pragma: no-cache");

if (session_status() == PHP_SESSION_NONE) {
    session_start();
}

if (!file_exists(__DIR__ . '/../config/connect.php')) {
    http_response_code(500);
    header('Content-Type: application/json');
    echo json_encode(['status' => 'error', 'message' => 'Kesalahan konfigurasi server.']);
    exit();
}
require_once __DIR__ . '/../config/connect.php';

header('Content-Type: application/json');

function json_response($status, $message, $data = null) {
    echo json_encode(['status' => $status, 'message' => $message, 'data' => $data]);
    exit();
}

function set_user_session($user_id, $username, $role) {
    session_regenerate_id(true);
    $_SESSION['user_id'] = $user_id;
    $_SESSION['username'] = $username;
    $_SESSION['role'] = $role;
}

$action = $_REQUEST['action'] ?? '';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    if ($action === 'login') {
        $username = trim($_POST['username'] ?? '');
        $password = trim($_POST['password'] ?? '');

        if (empty($username) || empty($password)) {
            json_response('error', 'Username dan password harus diisi.');
        }

        try {
            // Ambil pengguna berdasarkan username.
            // Username untuk siswa adalah NIS mereka.
            $stmt = $pdo->prepare("SELECT * FROM users WHERE username = ?");
            $stmt->execute([$username]);
            $user = $stmt->fetch(PDO::FETCH_ASSOC);

            // Verifikasi password, kemudian atur sesi dengan role dari database.
            if ($user && password_verify($password, $user['password'])) {
                // Gunakan 'nama' pengguna untuk tampilan di UI, bukan 'username'
                set_user_session($user['id'], $user['nama'], $user['role']);
                json_response('success', 'Login berhasil.');
            } else {
                json_response('error', 'Username atau password salah.');
            }
        } catch (PDOException $e) {
            error_log('Login PDO Error: ' . $e->getMessage());
            json_response('error', 'Terjadi kesalahan pada database.');
        }
    }
}

if ($action === 'logout') {
    session_unset();
    session_destroy();
    json_response('success', 'Logout berhasil.');
}

if ($action === 'get_session') {
    if (isset($_SESSION['user_id']) && isset($_SESSION['role'])) {
        json_response('success', 'Sesi aktif.', [
            'user_id' => $_SESSION['user_id'],
            'username' => $_SESSION['username'],
            'role' => $_SESSION['role']
        ]);
    } else {
        http_response_code(401);
        json_response('error', 'Tidak ada sesi aktif.');
    }
}