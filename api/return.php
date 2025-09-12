<?php
// Endpoint untuk memproses pengembalian barang.

$borrowal_id = $_POST['borrowal_id'] ?? null;
$proof_image = $_FILES['proof_image'] ?? null;

if (!$borrowal_id) {
    json_response('error', 'ID Peminjaman harus ada.');
}

$upload_result = handle_secure_upload($proof_image, 'assets/evidence/');
if ($upload_result['status'] === 'error') {
    json_response('error', $upload_result['message']);
}
$proof_image_url = $upload_result['url'];

try {
    $pdo->beginTransaction();

    $stmt = $pdo->prepare("SELECT * FROM borrowals WHERE id = ?");
    $stmt->execute([$borrowal_id]);
    $borrowal = $stmt->fetch();
    if (!$borrowal) {
        throw new Exception("Data peminjaman tidak ditemukan.");
    }

    // Pindahkan data ke tabel riwayat.
    $sql_history = "INSERT INTO history (borrowal_id, item_id, quantity, borrower_name, borrower_class, subject, borrow_date, proof_image_url) VALUES (?, ?, ?, ?, ?, ?, ?, ?)";
    $stmt_history = $pdo->prepare($sql_history);
    $stmt_history->execute([
        $borrowal['id'], $borrowal['item_id'], $borrowal['quantity'],
        $borrowal['borrower_name'], $borrowal['borrower_class'],
        $borrowal['subject'], $borrowal['borrow_date'], $proof_image_url
    ]);

    // Kembalikan stok barang.
    $sql_update_item = "UPDATE items SET current_quantity = current_quantity + ? WHERE id = ?";
    $stmt_update_item = $pdo->prepare($sql_update_item);
    $stmt_update_item->execute([$borrowal['quantity'], $borrowal['item_id']]);

    // Hapus dari data peminjaman aktif.
    $sql_delete_borrowal = "DELETE FROM borrowals WHERE id = ?";
    $stmt_delete_borrowal = $pdo->prepare($sql_delete_borrowal);
    $stmt_delete_borrowal->execute([$borrowal_id]);

    $pdo->commit();
    json_response('success', 'Barang berhasil dikembalikan.');

} catch (Exception $e) {
    $pdo->rollBack();
    // Hapus file bukti jika transaksi database gagal.
    if (!empty($proof_image_url) && file_exists(dirname(__DIR__) . '/public/' . $proof_image_url)) {
        unlink(dirname(__DIR__) . '/public/' . $proof_image_url);
    }
    error_log('Return Item Error: ' . $e->getMessage());
    json_response('error', 'Gagal memproses pengembalian barang.');
}