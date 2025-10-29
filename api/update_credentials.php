<?php
// Endpoint untuk pengguna (admin/user) memperbarui info profil mereka sendiri.

$user_id = $_SESSION['user_id'] ?? null;
$role = $_SESSION['role'] ?? 'user';

$new_password = $_POST['password'] ?? null;
$confirm_password = $_POST['confirm_password'] ?? null;

try {
    $sql_parts = [];
    $params = [];

    // --- Bagian yang sama untuk Admin dan User: Update Password ---
    if (!empty($new_password)) {
        if (strlen($new_password) < 8) {
            json_response('error', 'Password minimal harus 8 karakter.');
        }
        if ($new_password !== $confirm_password) {
            json_response('error', 'Konfirmasi password tidak cocok.');
        }
        $hashed_password = password_hash($new_password, PASSWORD_DEFAULT);
        $sql_parts[] = "password = ?";
        $params[] = $hashed_password;
    }

    // --- Bagian khusus Admin: Update Nama & Username ---
    if ($role === 'admin') {
        $new_username = isset($_POST['username']) ? sanitize_input($_POST['username']) : null;
        $new_nama = isset($_POST['nama']) ? sanitize_input($_POST['nama']) : null;

        if (empty($new_username) || empty($new_nama)) {
            // Jika admin tidak mengubah password, dan nama/username kosong, anggap tidak ada perubahan
            if (empty($new_password)) {
                 json_response('success', 'Tidak ada perubahan yang disimpan.');
            }
            json_response('error', 'Nama dan Username tidak boleh kosong untuk admin.');
        }

        // Cek apakah username baru sudah digunakan oleh user lain.
        $stmt_check = $pdo->prepare("SELECT id FROM users WHERE username = ? AND id != ?");
        $stmt_check->execute([$new_username, $user_id]);
        if ($stmt_check->fetch()) {
            json_response('error', 'Username tersebut sudah digunakan.');
        }

        $sql_parts[] = "username = ?";
        $params[] = $new_username;

        $sql_parts[] = "nama = ?";
        $params[] = $new_nama;
    }

    // --- Eksekusi Query Jika Ada Perubahan ---
    if (!empty($sql_parts)) {
        $sql = "UPDATE users SET " . implode(', ', $sql_parts) . " WHERE id = ?";
        $params[] = $user_id;

        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);

        $responseData = null;
        // Perbarui sesi jika ada perubahan relevan
        if ($role === 'admin' && isset($new_nama)) {
            $_SESSION['username'] = $new_nama;
            $_SESSION['login_username'] = $new_username;
            // Kirim kembali data baru agar frontend bisa update tanpa refresh
            $responseData = ['new_nama' => $new_nama, 'new_login_username' => $new_username];
        }

        json_response('success', 'Profil berhasil diperbarui.', $responseData);

    } else {
        json_response('success', 'Tidak ada perubahan yang disimpan.');
    }

} catch (PDOException $e) {
    error_log('Update Credentials Error: ' . $e->getMessage());
    json_response('error', 'Gagal memperbarui kredensial di database.');
}