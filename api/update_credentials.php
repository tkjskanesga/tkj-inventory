<?php
// Endpoint khusus untuk admin memperbarui kredensial login mereka.

// Memastikan hanya admin yang dapat mengakses endpoint ini.
require_admin();

$user_id = $_SESSION['user_id'] ?? null;
$new_username = isset($_POST['username']) ? sanitize_input($_POST['username']) : null;
$new_password = $_POST['password'] ?? null;

if (empty($new_username)) {
    json_response('error', 'Username tidak boleh kosong.');
}

try {
    // Cek apakah username baru sudah digunakan oleh user lain.
    $stmt_check = $pdo->prepare("SELECT id FROM users WHERE username = ? AND id != ?");
    $stmt_check->execute([$new_username, $user_id]);
    if ($stmt_check->fetch()) {
        json_response('error', 'Username tersebut sudah digunakan.');
    }

    $params = [$new_username];
    $sql = "UPDATE users SET username = ?";

    // Hanya update password jika diisi.
    if (!empty($new_password)) {
        if (strlen($new_password) < 8) {
             json_response('error', 'Password minimal harus 8 karakter.');
        }
        $hashed_password = password_hash($new_password, PASSWORD_DEFAULT);
        $sql .= ", password = ?";
        $params[] = $hashed_password;
    }
    
    $sql .= " WHERE id = ?";
    $params[] = $user_id;

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);

    // Perbarui sesi dengan username baru.
    $_SESSION['username'] = $new_username;

    json_response('success', 'Kredensial berhasil diperbarui.');

} catch (PDOException $e) {
    error_log('Update Credentials Error: ' . $e->getMessage());
    json_response('error', 'Gagal memperbarui kredensial di database.');
}