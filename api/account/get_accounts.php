<?php
// Endpoint untuk mengambil daftar semua akun pengguna.

try {
    // Mengambil semua data pengguna
    $stmt_users = $pdo->prepare("SELECT id, username, nama, nis, kelas, role FROM users ORDER BY nama ASC");
    $stmt_users->execute();
    $users = $stmt_users->fetchAll(PDO::FETCH_ASSOC);

    // Mengambil daftar kelas yang unik dari pengguna (bukan admin) untuk filter dinamis
    $stmt_classes = $pdo->prepare("SELECT DISTINCT kelas FROM users WHERE role = 'user' AND kelas IS NOT NULL AND kelas != '' ORDER BY kelas ASC");
    $stmt_classes->execute();
    $classes = $stmt_classes->fetchAll(PDO::FETCH_COLUMN);

    // Mengirimkan kedua set data
    json_response('success', 'Data akun berhasil diambil.', [
        'users' => $users,
        'classes' => $classes
    ]);

} catch (PDOException $e) {
    error_log('Get Accounts Error: ' . $e->getMessage());
    json_response('error', 'Gagal mengambil data akun.');
}