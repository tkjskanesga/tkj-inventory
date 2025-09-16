<?php
// Endpoint untuk memproses peminjaman barang.

// Menerima array item (multi-item)
$items = $_POST['items'] ?? null;
$borrower_name = isset($_POST['borrower_name']) ? sanitize_input($_POST['borrower_name']) : null;
$borrower_class = isset($_POST['borrower_class']) ? sanitize_input($_POST['borrower_class']) : null;
$subject = isset($_POST['subject']) ? sanitize_input($_POST['subject']) : null;

// Validasi input dasar
if (empty($items) || !is_array($items) || empty($borrower_name) || empty($borrower_class)) {
    json_response('error', 'Semua data peminjaman harus diisi dengan lengkap.');
}

try {
    $pdo->beginTransaction();

    // Buat satu ID transaksi unik untuk seluruh peminjaman ini
    $transaction_id = uniqid('trx-', true);

    foreach ($items as $item_data) {
        $item_id = $item_data['id'] ?? null;
        $quantity = $item_data['quantity'] ?? null;

        // Validasi setiap item dalam array
        if (!$item_id || !$quantity || !filter_var($quantity, FILTER_VALIDATE_INT) || $quantity < 1) {
            // Jika ada data item yang tidak valid, batalkan seluruh transaksi
            throw new Exception("Data item yang dikirim tidak valid.");
        }

        // Kunci baris item untuk mencegah race condition saat stok diperbarui.
        $stmt_item = $pdo->prepare("SELECT current_quantity FROM items WHERE id = ? FOR UPDATE");
        $stmt_item->execute([$item_id]);
        $current_quantity = $stmt_item->fetchColumn();

        if ($current_quantity === false) {
            throw new Exception("Salah satu barang tidak ditemukan.");
        }
        if ($quantity > $current_quantity) {
            throw new Exception("Stok untuk salah satu barang tidak mencukupi. Sisa stok: " . $current_quantity);
        }

        // Kurangi stok dari tabel items
        $stmt_update_item = $pdo->prepare("UPDATE items SET current_quantity = current_quantity - ? WHERE id = ?");
        $stmt_update_item->execute([$quantity, $item_id]);

        // Buat entri baru di borrowals untuk setiap item dengan transaction_id yang sama
        $sql = "INSERT INTO borrowals (transaction_id, item_id, quantity, borrower_name, borrower_class, subject) VALUES (?, ?, ?, ?, ?, ?)";
        $stmt = $pdo->prepare($sql);
        $stmt->execute([$transaction_id, $item_id, $quantity, $borrower_name, $borrower_class, $subject]);
    }

    $pdo->commit();
    json_response('success', 'Barang berhasil dipinjam.');

} catch (Exception $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    error_log('Borrow Item Error: ' . $e->getMessage());
    // Kirim pesan error yang lebih spesifik jika aman.
    if (strpos($e->getMessage(), 'Stok') !== false || strpos($e->getMessage(), 'ditemukan') !== false) {
        json_response('error', $e->getMessage());
    } else {
        json_response('error', 'Gagal memproses peminjaman.');
    }
}