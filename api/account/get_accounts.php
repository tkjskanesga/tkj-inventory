<?php
// Endpoint untuk mengambil daftar semua akun pengguna.

try {
    // Mengambil semua data pengguna dengan pengurutan baru
    // Admin diurutkan berdasarkan nama (A-Z)
    // User (siswa) diurutkan berdasarkan NIS (numerik)
    $stmt_users = $pdo->prepare("
        SELECT id, username, nama, nis, kelas, role 
        FROM users 
        ORDER BY 
            CASE WHEN role = 'admin' THEN 0 ELSE 1 END, -- Mengelompokkan admin di atas
            CASE WHEN role = 'admin' THEN nama END ASC, -- Mengurutkan admin berdasarkan nama
            CASE WHEN role = 'user' THEN CAST(nis AS UNSIGNED) END ASC, -- Mengurutkan user berdasarkan NIS sebagai angka
            nama ASC -- Pengurutan cadangan jika ada NIS yang sama atau kosong
    ");
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