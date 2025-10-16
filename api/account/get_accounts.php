<?php
// Endpoint untuk mengambil daftar semua akun pengguna.

try {
    // Mengambil semua data pengguna dengan JOIN ke tabel classes untuk mendapatkan nama kelas
    $stmt_users = $pdo->prepare("
        SELECT 
            u.id, 
            u.username, 
            u.nama, 
            u.nis, 
            c.name AS kelas, -- Mengambil nama kelas dari tabel classes
            u.role 
        FROM users u
        LEFT JOIN classes c ON u.kelas = c.id
        ORDER BY 
            CASE WHEN u.role = 'admin' THEN 0 ELSE 1 END, -- Mengelompokkan admin di atas
            CASE WHEN u.role = 'admin' THEN u.nama END ASC, -- Mengurutkan admin berdasarkan nama
            CASE WHEN u.role = 'user' THEN CAST(u.nis AS UNSIGNED) END ASC, -- Mengurutkan user berdasarkan NIS sebagai angka
            u.nama ASC -- Pengurutan cadangan
    ");
    $stmt_users->execute();
    $users = $stmt_users->fetchAll(PDO::FETCH_ASSOC);

    // Mengambil daftar kelas dari tabel 'classes' untuk filter dan dropdown
    $stmt_classes = $pdo->prepare("SELECT id, name FROM classes ORDER BY name ASC");
    $stmt_classes->execute();
    $classes_data = $stmt_classes->fetchAll(PDO::FETCH_ASSOC);
    
    // Pisahkan data untuk kompatibilitas filter dan dropdown
    $class_names_for_filter = array_column($classes_data, 'name');

    // Mengirimkan kedua set data
    json_response('success', 'Data akun berhasil diambil.', [
        'users' => $users,
        'classes' => $class_names_for_filter, // Untuk filter (hanya nama)
        'classes_full' => $classes_data // Untuk dropdown (id dan nama)
    ]);

} catch (PDOException $e) {
    error_log('Get Accounts Error: ' . $e->getMessage());
    json_response('error', 'Gagal mengambil data akun.');
}