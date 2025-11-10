<?php
// Endpoint untuk memproses pengembalian barang berdasarkan ID Transaksi.

$transaction_id = $_POST['transaction_id'] ?? null;
$proof_image = $_FILES['proof_image'] ?? null;
$current_user_id = $_SESSION['user_id'] ?? null;
$current_user_role = $_SESSION['role'] ?? 'user';

if (!$transaction_id) {
    json_response('error', 'ID Transaksi harus ada.');
}

$upload_result = handle_secure_upload($proof_image, 'assets/evidence/');
if ($upload_result['status'] === 'error') {
    json_response('error', $upload_result['message']);
}
$proof_image_url = $upload_result['url'];

try {
    $pdo->beginTransaction();

    // Ambil semua item yang terkait dengan ID transaksi ini, termasuk user_id
    $sql = "SELECT * FROM borrowals WHERE transaction_id = ?";
    $params = [$transaction_id];

    // Jika yang mengembalikan adalah 'user', pastikan transaksi itu miliknya
    if ($current_user_role === 'user') {
        $sql .= " AND user_id = ?";
        $params[] = $current_user_id;
    }

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $borrowals = $stmt->fetchAll();

    if (empty($borrowals)) {
        throw new Exception("Data peminjaman tidak ditemukan untuk transaksi ini.");
    }

    foreach ($borrowals as $borrowal) {
        // Pindahkan data ke tabel riwayat, termasuk user_id.
        $sql_history = "INSERT INTO history (borrowal_id, transaction_id, item_id, quantity, borrower_name, borrower_class, subject, borrow_date, proof_image_url, user_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";
        $stmt_history = $pdo->prepare($sql_history);
        $stmt_history->execute([
            $borrowal['id'], $borrowal['transaction_id'], $borrowal['item_id'], $borrowal['quantity'],
            $borrowal['borrower_name'], $borrowal['borrower_class'],
            $borrowal['subject'], $borrowal['borrow_date'], $proof_image_url,
            $borrowal['user_id']
        ]);

        // Kembalikan stok barang.
        $sql_update_item = "UPDATE items SET current_quantity = current_quantity + ? WHERE id = ?";
        $stmt_update_item = $pdo->prepare($sql_update_item);
        $stmt_update_item->execute([$borrowal['quantity'], $borrowal['item_id']]);
    }

    // Hapus semua data peminjaman aktif untuk transaksi ini.
    $sql_delete_borrowal = "DELETE FROM borrowals WHERE transaction_id = ?";
    $stmt_delete_borrowal = $pdo->prepare($sql_delete_borrowal);
    $stmt_delete_borrowal->execute([$transaction_id]);

    $pdo->commit();
    json_response('success', 'Barang berhasil dikembalikan.');

} catch (Exception $e) {
    $pdo->rollBack();
    // Hapus file bukti jika transaksi database gagal.
    if (!empty($proof_image_url) && file_exists(dirname(dirname(__DIR__)) . '/public/' . $proof_image_url)) {
        unlink(dirname(dirname(__DIR__)) . '/public/' . $proof_image_url);
    }
    error_log('Return Item Error: ' . $e->getMessage());
    json_response('error', 'Gagal memproses pengembalian barang.');
}