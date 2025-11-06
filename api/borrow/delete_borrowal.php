<?php
// Endpoint untuk menghapus satu item peminjaman aktif.

// Memastikan hanya admin yang bisa mengakses
if (!isset($_SESSION['role']) || $_SESSION['role'] !== 'admin') {
    http_response_code(403); // Forbidden
    json_response('error', 'Akses ditolak. Anda tidak memiliki hak akses untuk aksi ini.');
}

$id = $_POST['id'] ?? null;
if (!$id) {
    json_response('error', 'ID peminjaman tidak ditemukan.');
}

try {
    $pdo->beginTransaction();

    // 1. Ambil detail peminjaman (item_id, quantity) sebelum dihapus.
    $stmt = $pdo->prepare("SELECT item_id, quantity FROM borrowals WHERE id = ?");
    $stmt->execute([$id]);
    $borrowal = $stmt->fetch();

    if (!$borrowal) {
        $pdo->rollBack();
        json_response('error', 'Item peminjaman tidak ditemukan.');
    }

    // 2. Kembalikan stok barang ke tabel items.
    $stmt_update_item = $pdo->prepare("UPDATE items SET current_quantity = current_quantity + ? WHERE id = ?");
    $stmt_update_item->execute([$borrowal['quantity'], $borrowal['item_id']]);

    // 3. Hapus entri dari tabel borrowals.
    $stmt_delete = $pdo->prepare("DELETE FROM borrowals WHERE id = ?");
    $stmt_delete->execute([$id]);
    
    if ($stmt_delete->rowCount() === 0) {
        $pdo->rollBack();
        json_response('error', 'Gagal menghapus item peminjaman.');
    }

    $pdo->commit();
    json_response('success', 'Item peminjaman berhasil dihapus.');

} catch (Exception $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    error_log('Delete Borrowal Item Error: ' . $e->getMessage());
    json_response('error', 'Gagal menghapus item peminjaman.');
}