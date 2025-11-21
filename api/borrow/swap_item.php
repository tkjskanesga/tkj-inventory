<?php
// Endpoint untuk memproses penukaran barang (Swap).

$borrowal_id = $_POST['borrowal_id'] ?? null;
$new_item_id = $_POST['new_item_id'] ?? null;
$condition = $_POST['condition'] ?? 'good'; // 'good' atau 'bad'
$remark = $_POST['remark'] ?? null;

if (!$borrowal_id || !$new_item_id) {
    json_response('error', 'Data penukaran tidak lengkap.');
}

// Jika kondisi rusak, wajib ada alasannya
if ($condition === 'bad' && empty($remark)) {
    json_response('error', 'Harap isi kendala/penyebab kerusakan barang.');
}

try {
    $pdo->beginTransaction();

    // Ambil data peminjaman saat ini (Barang Lama)
    $stmt = $pdo->prepare("SELECT * FROM borrowals WHERE id = ? FOR UPDATE");
    $stmt->execute([$borrowal_id]);
    $current_borrowal = $stmt->fetch();

    if (!$current_borrowal) {
        throw new Exception("Data peminjaman tidak ditemukan.");
    }

    $old_item_id = $current_borrowal['item_id'];
    
    // Cek stok barang pengganti
    $stmt_new_item = $pdo->prepare("SELECT current_quantity FROM items WHERE id = ? FOR UPDATE");
    $stmt_new_item->execute([$new_item_id]);
    $new_item_stock = $stmt_new_item->fetchColumn();

    if ($new_item_stock === false) {
        throw new Exception("Barang pengganti tidak ditemukan.");
    }
    
    if ($current_borrowal['quantity'] > $new_item_stock) {
        throw new Exception("Stok barang pengganti tidak mencukupi.");
    }

    // Proses Barang LAMA -> History
    $sql_history = "INSERT INTO history (borrowal_id, transaction_id, item_id, quantity, borrower_name, borrower_class, subject, borrow_date, return_date, item_condition, condition_remark, user_id, is_swap, swap_new_item_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?, ?, ?, 1, ?)";
    $stmt_history = $pdo->prepare($sql_history);
    $stmt_history->execute([
        $current_borrowal['id'], 
        $current_borrowal['transaction_id'], 
        $old_item_id, 
        $current_borrowal['quantity'],
        $current_borrowal['borrower_name'], 
        $current_borrowal['borrower_class'],
        $current_borrowal['subject'], 
        $current_borrowal['borrow_date'],
        $condition, 
        $remark,
        $current_borrowal['user_id'],
        $new_item_id
    ]);

    // Kembalikan stok barang lama
    $stmt_restore_stock = $pdo->prepare("UPDATE items SET current_quantity = current_quantity + ? WHERE id = ?");
    $stmt_restore_stock->execute([$current_borrowal['quantity'], $old_item_id]);

    // Proses Barang Baru
    $stmt_deduct_stock = $pdo->prepare("UPDATE items SET current_quantity = current_quantity - ? WHERE id = ?");
    $stmt_deduct_stock->execute([$current_borrowal['quantity'], $new_item_id]);

    $stmt_check_existing = $pdo->prepare("SELECT id, quantity FROM borrowals WHERE transaction_id = ? AND item_id = ? AND id != ?");
    $stmt_check_existing->execute([$current_borrowal['transaction_id'], $new_item_id, $borrowal_id]);
    $existing_item = $stmt_check_existing->fetch();

    if ($existing_item) {
        $new_quantity = $existing_item['quantity'] + $current_borrowal['quantity'];
        $stmt_merge = $pdo->prepare("UPDATE borrowals SET quantity = ? WHERE id = ?");
        $stmt_merge->execute([$new_quantity, $existing_item['id']]);

        $stmt_delete_old = $pdo->prepare("DELETE FROM borrowals WHERE id = ?");
        $stmt_delete_old->execute([$borrowal_id]);
    } else {
        $stmt_update_borrowal = $pdo->prepare("UPDATE borrowals SET item_id = ?, item_condition = 'good', condition_remark = NULL WHERE id = ?");
        $stmt_update_borrowal->execute([$new_item_id, $borrowal_id]);
    }

    $pdo->commit();
    json_response('success', 'Barang berhasil ditukar.');

} catch (Exception $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    error_log('Swap Item Error: ' . $e->getMessage());
    json_response('error', $e->getMessage());
}