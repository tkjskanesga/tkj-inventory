<?php
// Endpoint untuk memproses peminjaman barang.

$item_id = $_POST['item_id'] ?? null;
$quantity = $_POST['quantity'] ?? null;
$borrower_name = isset($_POST['borrower_name']) ? sanitize_input($_POST['borrower_name']) : null;
$borrower_class = isset($_POST['borrower_class']) ? sanitize_input($_POST['borrower_class']) : null;
$subject = isset($_POST['subject']) ? sanitize_input($_POST['subject']) : null;

if (!$item_id || !$quantity || empty($borrower_name) || empty($borrower_class)) {
    json_response('error', 'Semua data peminjaman harus diisi.');
}
if (!filter_var($quantity, FILTER_VALIDATE_INT) || $quantity < 1) {
    json_response('error', 'Jumlah tidak valid.');
}

try {
    $pdo->beginTransaction();

    // Cek apakah peminjaman yang identik sudah ada
    $stmt_check = $pdo->prepare("SELECT id FROM borrowals WHERE item_id = ? AND borrower_name = ? AND borrower_class = ? AND subject = ?");
    $stmt_check->execute([$item_id, $borrower_name, $borrower_class, $subject]);
    $existing_borrowal_id = $stmt_check->fetchColumn();

    // Kunci baris item untuk mencegah race condition saat stok diperbarui.
    $stmt_item = $pdo->prepare("SELECT current_quantity FROM items WHERE id = ? FOR UPDATE");
    $stmt_item->execute([$item_id]);
    $current_quantity = $stmt_item->fetchColumn();

    if ($current_quantity === false) {
        throw new Exception("Barang tidak ditemukan.");
    }
    if ($quantity > $current_quantity) {
        throw new Exception("Stok tidak mencukupi. Sisa stok: " . $current_quantity);
    }

    // Kurangi stok dari tabel items terlebih dahulu
    $stmt_update_item = $pdo->prepare("UPDATE items SET current_quantity = current_quantity - ? WHERE id = ?");
    $stmt_update_item->execute([$quantity, $item_id]);

    if ($existing_borrowal_id) {
        // Jika sudah ada, tambahkan jumlahnya (konsolidasi)
        $sql = "UPDATE borrowals SET quantity = quantity + ? WHERE id = ?";
        $stmt = $pdo->prepare($sql);
        $stmt->execute([$quantity, $existing_borrowal_id]);
    } else {
        // Jika belum ada, buat entri baru
        $sql = "INSERT INTO borrowals (item_id, quantity, borrower_name, borrower_class, subject) VALUES (?, ?, ?, ?, ?)";
        $stmt = $pdo->prepare($sql);
        $stmt->execute([$item_id, $quantity, $borrower_name, $borrower_class, $subject]);
    }

    $pdo->commit();
    json_response('success', 'Barang berhasil dipinjam.');

} catch (Exception $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    error_log('Borrow Item Error: ' . $e->getMessage());
    // Kirim pesan error yang lebih spesifik jika aman.
    if (strpos($e->getMessage(), 'Stok tidak mencukupi') !== false) {
        json_response('error', $e->getMessage());
    } else {
        json_response('error', 'Gagal memproses peminjaman.');
    }
}