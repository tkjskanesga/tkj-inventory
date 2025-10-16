<?php
// Endpoint untuk menambahkan akun baru.

$role = $_POST['role'] ?? 'user';
$nama = isset($_POST['nama']) ? sanitize_input($_POST['nama']) : null;
$password = $_POST['password'] ?? null;

// Variabel spesifik untuk role
$nis = $_POST['nis'] ?? null;
$kelas_name = $_POST['kelas'] ?? null; // Nama kelas dari form
$username = $_POST['username'] ?? null;

if (empty($nama) || empty($password) || empty($role)) {
    json_response('error', 'Nama, password, dan role wajib diisi.');
}

if (strlen($password) < 8) {
    json_response('error', 'Password minimal harus 8 karakter.');
}

try {
    $hashedPassword = password_hash($password, PASSWORD_DEFAULT);

    if ($role === 'admin') {
        if (empty($username)) {
            json_response('error', 'Username untuk admin wajib diisi.');
        }

        // Cek duplikasi username untuk admin
        $stmt_check = $pdo->prepare("SELECT id FROM users WHERE username = ?");
        $stmt_check->execute([$username]);
        if ($stmt_check->fetch()) {
            json_response('error', 'Username sudah digunakan. Gunakan username yang lain.');
        }

        $stmt = $pdo->prepare("INSERT INTO users (username, password, role, nama, nis, kelas) VALUES (?, ?, ?, ?, NULL, NULL)");
        $stmt->execute([$username, $hashedPassword, 'admin', $nama]);

    } else { // Role adalah 'user'
        if (empty($nis) || empty($kelas_name)) {
            json_response('error', 'NIS dan Kelas untuk siswa wajib diisi.');
        }

        // Cek duplikasi NIS untuk user
        $stmt_check_nis = $pdo->prepare("SELECT id FROM users WHERE nis = ?");
        $stmt_check_nis->execute([$nis]);
        if ($stmt_check_nis->fetch()) {
            json_response('error', 'NIS sudah terdaftar. Gunakan NIS yang lain.');
        }
        
        // Dapatkan ID kelas dari namanya
        $stmt_class_id = $pdo->prepare("SELECT id FROM classes WHERE name = ?");
        $stmt_class_id->execute([$kelas_name]);
        $class_id = $stmt_class_id->fetchColumn();

        if (!$class_id) {
            json_response('error', 'Kelas yang dipilih tidak valid.');
        }

        // Untuk user, username disamakan dengan NIS
        $stmt = $pdo->prepare("INSERT INTO users (username, password, role, nama, nis, kelas) VALUES (?, ?, ?, ?, ?, ?)");
        $stmt->execute([$nis, $hashedPassword, 'user', $nama, $nis, $class_id]);
    }

    json_response('success', 'Akun berhasil ditambahkan.');

} catch (PDOException $e) {
    error_log('Add Account Error: ' . $e->getMessage());
    if ($e->getCode() == 23000) { // Integrity constraint violation
        if (strpos($e->getMessage(), 'username') !== false) {
             json_response('error', 'Username sudah digunakan.');
        }
         if (strpos($e->getMessage(), 'nis') !== false) {
             json_response('error', 'NIS sudah terdaftar.');
        }
    }
    json_response('error', 'Gagal menambahkan akun ke database.');
}