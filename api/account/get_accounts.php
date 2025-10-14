<?php
// Endpoint untuk mengambil daftar semua akun pengguna.

// Memastikan hanya admin yang dapat mengakses
require_admin();

try {
    // Mengambil semua user kecuali admin yang sedang login, diurutkan berdasarkan nama
    $stmt = $pdo->prepare("SELECT id, nis, nama, kelas, role FROM users ORDER BY nama ASC");
    $stmt->execute();
    $users = $stmt->fetchAll(PDO::FETCH_ASSOC);

    json_response('success', 'Data akun berhasil diambil.', $users);

} catch (PDOException $e) {
    error_log('Get Accounts Error: ' . $e->getMessage());
    json_response('error', 'Gagal mengambil data akun.');
}