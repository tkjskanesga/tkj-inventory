<?php
// Endpoint untuk mengedit data akun.

$id = $_POST['id'] ?? null;
$role = $_POST['role'] ?? 'user';
$nama = isset($_POST['nama']) ? sanitize_input($_POST['nama']) : null;
$password = $_POST['password'] ?? null;

// Variabel spesifik untuk role, dengan sanitasi input
$nis = isset($_POST['nis']) ? sanitize_input(trim($_POST['nis'])) : null;
$kelas_name = isset($_POST['kelas']) ? sanitize_input(trim($_POST['kelas'])) : null;
$username = isset($_POST['username']) ? sanitize_input(trim($_POST['username'])) : null;


if (empty($id) || empty($nama) || empty($role)) {
    json_response('error', 'ID, Nama, dan Role tidak boleh kosong.');
}

try {
    $params = ['id' => $id, 'nama' => $nama, 'role' => $role];
    $sql_parts = ['nama = :nama', 'role = :role'];

    // Cek apakah password diubah
    if (!empty($password)) {
        if (strlen($password) < 8) {
            json_response('error', 'Password baru minimal harus 8 karakter.');
        }
        $sql_parts[] = 'password = :password';
        $params['password'] = password_hash($password, PASSWORD_DEFAULT);
    }

    if ($role === 'admin') {
        if (empty($username)) {
            json_response('error', 'Username untuk admin wajib diisi.');
        }
        // Cek duplikasi username, kecuali untuk user yang sedang diedit
        $stmt_check = $pdo->prepare("SELECT id FROM users WHERE username = ? AND id != ?");
        $stmt_check->execute([$username, $id]);
        if ($stmt_check->fetch()) {
            json_response('error', 'Username sudah digunakan oleh akun lain.');
        }
        
        $sql_parts[] = 'username = :username';
        $sql_parts[] = 'nis = NULL';
        $sql_parts[] = 'kelas = NULL';
        $params['username'] = $username;

    } else { // Role adalah 'user'
        if (empty($nis) || empty($kelas_name)) {
            json_response('error', 'NIS dan Kelas untuk siswa wajib diisi.');
        }
        // Cek duplikasi NIS, kecuali untuk user yang sedang diedit
        $stmt_check_nis = $pdo->prepare("SELECT id FROM users WHERE nis = ? AND id != ?");
        $stmt_check_nis->execute([$nis, $id]);
        if ($stmt_check_nis->fetch()) {
            json_response('error', 'NIS sudah digunakan oleh akun lain.');
        }
        
        // Dapatkan ID kelas dari namanya
        $stmt_class_id = $pdo->prepare("SELECT id FROM classes WHERE name = ?");
        $stmt_class_id->execute([$kelas_name]);
        $class_id = $stmt_class_id->fetchColumn();

        if (!$class_id) {
            json_response('error', 'Kelas yang dipilih tidak valid.');
        }
        
        // Untuk user, username disamakan dengan NIS
        $sql_parts[] = 'username = :username';
        $sql_parts[] = 'nis = :nis';
        $sql_parts[] = 'kelas = :kelas_id';
        $params['username'] = $nis;
        $params['nis'] = $nis;
        $params['kelas_id'] = $class_id;
    }
    
    $sql = "UPDATE users SET " . implode(', ', $sql_parts) . " WHERE id = :id";
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);

    json_response('success', 'Akun berhasil diperbarui.');

} catch (PDOException $e) {
    error_log('Edit Account Error: ' . $e->getMessage());
     if ($e->getCode() == 23000) { // Integrity constraint violation
        if (strpos($e->getMessage(), 'username') !== false) {
             json_response('error', 'Username tersebut sudah digunakan.');
        }
         if (strpos($e->getMessage(), 'nis') !== false) {
             json_response('error', 'NIS tersebut sudah digunakan.');
        }
    }
    json_response('error', 'Gagal memperbarui akun.');
}