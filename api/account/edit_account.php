<?php
// Endpoint untuk mengedit data akun.

// Memastikan hanya admin yang dapat mengakses
require_admin();

$id = $_POST['id'] ?? null;
$nis = $_POST['nis'] ?? null;
$nama = isset($_POST['nama']) ? sanitize_input($_POST['nama']) : null;
$kelas = $_POST['kelas'] ?? null;
$password = $_POST['password'] ?? null;
$role = $_POST['role'] ?? 'user';

if (empty($id) || empty($nis) || empty($nama) || empty($kelas) || empty($role)) {
    json_response('error', 'Data tidak lengkap.');
}

try {
    // Cek duplikasi NIS, kecuali untuk user yang sedang diedit
    $stmt_check = $pdo->prepare("SELECT id FROM users WHERE nis = ? AND id != ?");
    $stmt_check->execute([$nis, $id]);
    if ($stmt_check->fetch()) {
        json_response('error', 'NIS sudah digunakan oleh akun lain.');
    }

    $params = [
        'nis' => $nis,
        'nama' => $nama,
        'kelas' => $kelas,
        'role' => $role,
        'username' => $nis,
        'id' => $id
    ];

    // Cek apakah password diubah
    if (!empty($password)) {
        if (strlen($password) < 8) {
            json_response('error', 'Password baru minimal harus 8 karakter.');
        }
        $sql = "UPDATE users SET nis = :nis, nama = :nama, kelas = :kelas, role = :role, password = :password, username = :username WHERE id = :id";
        $params['password'] = password_hash($password, PASSWORD_DEFAULT);
    } else {
        $sql = "UPDATE users SET nis = :nis, nama = :nama, kelas = :kelas, role = :role, username = :username WHERE id = :id";
    }

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);

    json_response('success', 'Akun berhasil diperbarui.');

} catch (PDOException $e) {
    error_log('Edit Account Error: ' . $e->getMessage());
    json_response('error', 'Gagal memperbarui akun.');
}