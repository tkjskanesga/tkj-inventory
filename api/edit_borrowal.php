<?php
// Endpoint untuk admin mengubah data peminjaman aktif.

$borrowal_id = $_POST['borrowal_id'] ?? null;
$new_quantity = $_POST['new_quantity'] ?? null;
$new_item_id = $_POST['new_item_id'] ?? null;

if (!$borrowal_id || !$new_quantity || !$new_item_id) {
    json_response('error', 'Data tidak lengkap.');
}
if (!filter_var($new_quantity, FILTER_VALIDATE_INT) || $new_quantity < 1) {
    json_response('error', 'Jumlah baru tidak valid.');
}

try {
    $pdo->beginTransaction();

    // Ambil data peminjaman lama (item_id dan quantity) dan kunci barisnya.
    $stmt_old = $pdo->prepare("SELECT item_id, quantity FROM borrowals WHERE id = ? FOR UPDATE");
    $stmt_old->execute([$borrowal_id]);
    $old_borrowal = $stmt_old->fetch();

    if (!$old_borrowal) {
        throw new Exception("Data peminjaman tidak ditemukan.");
    }

    $old_item_id = $old_borrowal['item_id'];
    $old_quantity = $old_borrowal['quantity'];

    $item_has_changed = ($new_item_id != $old_item_id);

    if ($item_has_changed) {

        // --- LOGIKA JIKA BARANG DIGANTI ---

        // 1. Kembalikan stok barang lama.
        $stmt_restore_stock = $pdo->prepare("UPDATE items SET current_quantity = current_quantity + ? WHERE id = ?");
        $stmt_restore_stock->execute([$old_quantity, $old_item_id]);

        // 2. Cek stok barang baru.
        $stmt_new_item_stock = $pdo->prepare("SELECT current_quantity FROM items WHERE id = ? FOR UPDATE");
        $stmt_new_item_stock->execute([$new_item_id]);
        $new_item_stock = $stmt_new_item_stock->fetchColumn();

        if ($new_item_stock === false) {
            throw new Exception("Barang baru yang dipilih tidak ditemukan.");
        }
        if ($new_quantity > $new_item_stock) {
            throw new Exception("Stok untuk barang baru tidak mencukupi. Sisa stok: " . $new_item_stock);
        }

        // 3. Kurangi stok barang baru.
        $stmt_deduct_stock = $pdo->prepare("UPDATE items SET current_quantity = current_quantity - ? WHERE id = ?");
        $stmt_deduct_stock->execute([$new_quantity, $new_item_id]);

        // 4. Update data peminjaman dengan item_id dan quantity baru.
        $stmt_update_borrowal = $pdo->prepare("UPDATE borrowals SET item_id = ?, quantity = ? WHERE id = ?");
        $stmt_update_borrowal->execute([$new_item_id, $new_quantity, $borrowal_id]);

    } else {
        
        // --- LOGIKA JIKA HANYA JUMLAH YANG BERUBAH ---
        
        $quantity_diff = $new_quantity - $old_quantity;

        if ($quantity_diff != 0) {
            // Cek stok saat ini dari barang yang sama.
            $stmt_item = $pdo->prepare("SELECT current_quantity FROM items WHERE id = ? FOR UPDATE");
            $stmt_item->execute([$old_item_id]);
            $current_stock = $stmt_item->fetchColumn();

            // Jika menambah pinjaman, pastikan stok cukup.
            if ($quantity_diff > 0 && $quantity_diff > $current_stock) {
                throw new Exception("Stok tidak mencukupi untuk penambahan. Sisa stok: " . $current_stock);
            }

            // Update stok (pengurangan `quantity_diff` akan menambah stok jika nilainya negatif).
            $stmt_update_item = $pdo->prepare("UPDATE items SET current_quantity = current_quantity - ? WHERE id = ?");
            $stmt_update_item->execute([$quantity_diff, $old_item_id]);
        }

        // Update jumlah di tabel borrowals.
        $stmt_update_borrowal = $pdo->prepare("UPDATE borrowals SET quantity = ? WHERE id = ?");
        $stmt_update_borrowal->execute([$new_quantity, $borrowal_id]);
    }

    $pdo->commit();
    json_response('success', 'Data peminjaman berhasil diperbarui.');

} catch (Exception $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    error_log('Edit Borrowal Error: ' . $e->getMessage());
    $errorMessage = (strpos($e->getMessage(), 'Stok') !== false || strpos($e->getMessage(), 'ditemukan') !== false)
        ? $e->getMessage()
        : 'Gagal memperbarui peminjaman.';
    json_response('error', $errorMessage);
}