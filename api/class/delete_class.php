<?php
// Endpoint untuk menghapus kelas.

$id = $_POST['id'] ?? null;

if (empty($id)) {
    json_response('error', 'ID kelas tidak ditemukan.');
}

try {
    // Cek apakah kelas sedang digunakan sebelum menghapus.
    $stmt_check_users = $pdo->prepare("SELECT COUNT(*) FROM users WHERE kelas = ?");
    $stmt_check_users->execute([$id]);
    if ($stmt_check_users->fetchColumn() > 0) {
        json_response('error', 'Gagal menghapus kelas karena digunakan oleh beberapa akun.');
    }

    $stmt_check_borrowals = $pdo->prepare("SELECT COUNT(*) FROM borrowals WHERE borrower_class = (SELECT name FROM classes WHERE id = ?)");
    $stmt_check_borrowals->execute([$id]);
    if ($stmt_check_borrowals->fetchColumn() > 0) {
        json_response('error', 'Gagal menghapus kelas karena digunakan pada peminjaman aktif.');
    }
    
    $stmt = $pdo->prepare("DELETE FROM classes WHERE id = ?");
    $stmt->execute([$id]);

    if ($stmt->rowCount() > 0) {
        json_response('success', 'Kelas berhasil dihapus.');
    } else {
        json_response('error', 'Kelas tidak ditemukan atau sudah dihapus.');
    }
} catch (PDOException $e) {
    error_log('Delete Class Error: ' . $e->getMessage());
    json_response('error', 'Gagal menghapus kelas.');
}