<?php
// Endpoint untuk menghapus beberapa akun sekaligus.

$ids = $_POST['ids'] ?? null;
if (empty($ids) || !is_array($ids)) {
    json_response('error', 'Tidak ada ID akun yang dipilih.');
}

// Mencegah admin menghapus akunnya sendiri
$current_user_id = $_SESSION['user_id'] ?? null;
if (in_array($current_user_id, $ids)) {
    json_response('error', 'Anda tidak dapat menghapus akun Anda sendiri dari pilihan.');
}

try {
    $pdo->beginTransaction();

    // Hapus akun dari database
    $placeholders = implode(',', array_fill(0, count($ids), '?'));
    $stmt_delete = $pdo->prepare("DELETE FROM users WHERE id IN ($placeholders)");
    $stmt_delete->execute($ids);

    $rowCount = $stmt_delete->rowCount();
    $pdo->commit();

    if ($rowCount > 0) {
        json_response('success', $rowCount . ' akun berhasil dihapus.');
    } else {
        json_response('error', 'Tidak ada akun yang dihapus. Akun mungkin sudah tidak ada.');
    }

} catch (PDOException $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    error_log('Delete Multiple Accounts Error: ' . $e->getMessage());
    json_response('error', 'Gagal menghapus akun.');
}