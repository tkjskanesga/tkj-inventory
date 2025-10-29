<?php
// Endpoint untuk menghapus akun.

// Memastikan hanya admin yang dapat mengakses
require_admin();

$id = $_POST['id'] ?? null;

if (empty($id)) {
    json_response('error', 'ID akun tidak ditemukan.');
}

// Mencegah admin menghapus akunnya sendiri
if (isset($_SESSION['user_id']) && $id == $_SESSION['user_id']) {
    json_response('error', 'Anda tidak dapat menghapus akun Anda sendiri.');
}

try {
    $stmt = $pdo->prepare("DELETE FROM users WHERE id = ?");
    $stmt->execute([$id]);

    if ($stmt->rowCount() > 0) {
        json_response('success', 'Akun berhasil dihapus.');
    } else {
        json_response('error', 'Akun tidak ditemukan atau sudah dihapus.');
    }
} catch (PDOException $e) {
    error_log('Delete Account Error: ' . $e->getMessage());
    json_response('error', 'Gagal menghapus akun.');
}