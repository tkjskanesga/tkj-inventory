<?php
// Endpoint untuk admin mengubah jumlah peminjaman aktif.

$borrowal_id = $_POST['borrowal_id'] ?? null;
$new_quantity = $_POST['new_quantity'] ?? null;
$item_id = $_POST['item_id'] ?? null; // Validasi stok

if (!$borrowal_id || !$new_quantity || !$item_id) {
    json_response('error', 'Data tidak lengkap.');
}
if (!filter_var($new_quantity, FILTER_VALIDATE_INT) || $new_quantity < 1) {
    json_response('error', 'Jumlah baru tidak valid.');
}

try {
    $pdo->beginTransaction();

    // Ambil data peminjaman lama
    $stmt_old = $pdo->prepare("SELECT quantity FROM borrowals WHERE id = ?");
    $stmt_old->execute([$borrowal_id]);
    $old_quantity = $stmt_old->fetchColumn();

    if ($old_quantity === false) {
        throw new Exception("Data peminjaman tidak ditemukan.");
    }

    $quantity_diff = $new_quantity - $old_quantity;

    // Kunci baris item untuk transaksi yang aman
    $stmt_item = $pdo->prepare("SELECT current_quantity FROM items WHERE id = ? FOR UPDATE");
    $stmt_item->execute([$item_id]);
    $current_stock = $stmt_item->fetchColumn();
    
    // Jika menambah pinjaman, cek stok
    if ($quantity_diff > 0) {
        if ($quantity_diff > $current_stock) {
            throw new Exception("Stok tidak mencukupi untuk penambahan. Sisa stok: " . $current_stock);
        }
    }
    
    // Update stok di tabel items
    $stmt_update_item = $pdo->prepare("UPDATE items SET current_quantity = current_quantity - ? WHERE id = ?");
    $stmt_update_item->execute([$quantity_diff, $item_id]);

    // Update jumlah di tabel borrowals
    $stmt_update_borrowal = $pdo->prepare("UPDATE borrowals SET quantity = ? WHERE id = ?");
    $stmt_update_borrowal->execute([$new_quantity, $borrowal_id]);

    $pdo->commit();
    json_response('success', 'Jumlah peminjaman berhasil diperbarui.');

} catch (Exception $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    error_log('Edit Borrowal Error: ' . $e->getMessage());
    $errorMessage = strpos($e->getMessage(), 'Stok tidak mencukupi') !== false 
        ? $e->getMessage() 
        : 'Gagal memperbarui peminjaman.';
    json_response('error', $errorMessage);
}