<?php
// Endpoint untuk menambahkan akun baru.

// Memastikan hanya admin yang dapat mengakses
require_admin();

$nis = $_POST['nis'] ?? null;
$nama = isset($_POST['nama']) ? sanitize_input($_POST['nama']) : null;
$kelas = $_POST['kelas'] ?? null;
$password = $_POST['password'] ?? null;
$role = $_POST['role'] ?? 'user';

if (empty($nis) || empty($nama) || empty($kelas) || empty($password) || empty($role)) {
    json_response('error', 'Semua kolom wajib diisi.');
}

if (strlen($password) < 8) {
    json_response('error', 'Password minimal harus 8 karakter.');
}

try {
    // Cek apakah NIS sudah ada
    $stmt_check = $pdo->prepare("SELECT id FROM users WHERE nis = ?");
    $stmt_check->execute([$nis]);
    if ($stmt_check->fetch()) {
        json_response('error', 'NIS sudah terdaftar. Gunakan NIS yang lain.');
    }

    $hashedPassword = password_hash($password, PASSWORD_DEFAULT);

    $stmt = $pdo->prepare("INSERT INTO users (nis, nama, kelas, password, role, username) VALUES (?, ?, ?, ?, ?, ?)");
    // Username di-set sama dengan NIS secara default
    $stmt->execute([$nis, $nama, $kelas, $hashedPassword, $role, $nis]);

    json_response('success', 'Akun berhasil ditambahkan.');

} catch (PDOException $e) {
    error_log('Add Account Error: ' . $e->getMessage());
    json_response('error', 'Gagal menambahkan akun ke database.');
}