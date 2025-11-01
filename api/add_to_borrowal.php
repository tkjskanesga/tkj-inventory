<?php
// Endpoint untuk menambahkan item baru ke peminjaman yang sudah ada.

// Menerima array item (multi-item)
$items = $_POST['items'] ?? null;
$transaction_id = $_POST['transaction_id'] ?? null;
$current_user_id = $_SESSION['user_id'] ?? null;
$current_user_role = $_SESSION['role'] ?? 'user';

// Validasi input dasar
if (empty($items) || !is_array($items) || empty($transaction_id)) {
    json_response('error', 'Data peminjaman tidak lengkap.');
}

try {
    $pdo->beginTransaction();

    // Ambil data peminjam dan user_id dari transaksi yang ada.
    $sql = "SELECT borrower_name, borrower_class, subject, user_id FROM borrowals WHERE transaction_id = ? LIMIT 1";
    $params = [$transaction_id];

    // Jika yang menambahkan adalah 'user', pastikan transaksi itu miliknya
    if ($current_user_role === 'user') {
        $sql = "SELECT borrower_name, borrower_class, subject, user_id FROM borrowals WHERE transaction_id = ? AND user_id = ? LIMIT 1";
        $params = [$transaction_id, $current_user_id];
    }

    $stmt_borrower = $pdo->prepare($sql);
    $stmt_borrower->execute($params);
    $borrower_info = $stmt_borrower->fetch();

    if (!$borrower_info) {
        throw new Exception("Transaksi peminjaman tidak ditemukan.");
    }
    $borrower_name = $borrower_info['borrower_name'];
    $borrower_class = $borrower_info['borrower_class'];
    $subject = $borrower_info['subject'];
    $user_id_to_insert = $borrower_info['user_id'];

    foreach ($items as $item_data) {
        $item_id = $item_data['id'] ?? null;
        $quantity = $item_data['quantity'] ?? null;

        // Validasi setiap item dalam array
        if (!$item_id || !$quantity || !filter_var($quantity, FILTER_VALIDATE_INT) || $quantity < 1) {
            throw new Exception("Data item yang dikirim tidak valid.");
        }

        // Kunci baris item untuk mencegah race condition.
        $stmt_item = $pdo->prepare("SELECT current_quantity FROM items WHERE id = ? FOR UPDATE");
        $stmt_item->execute([$item_id]);
        $current_quantity = $stmt_item->fetchColumn();

        if ($current_quantity === false) {
            throw new Exception("Salah satu barang tidak ditemukan.");
        }
        if ($quantity > $current_quantity) {
            throw new Exception("Stok untuk salah satu barang tidak mencukupi. Sisa stok: " . $current_quantity);
        }
        
        // Cek apakah item yang sama sudah ada di transaksi ini.
        $stmt_check_existing = $pdo->prepare("SELECT id, quantity FROM borrowals WHERE transaction_id = ? AND item_id = ?");
        $stmt_check_existing->execute([$transaction_id, $item_id]);
        $existing_borrowal = $stmt_check_existing->fetch();

        if ($existing_borrowal) {
            // Jika sudah ada, update quantity-nya saja.
            $new_total_quantity = $existing_borrowal['quantity'] + $quantity;
            $stmt_update_existing = $pdo->prepare("UPDATE borrowals SET quantity = ? WHERE id = ?");
            $stmt_update_existing->execute([$new_total_quantity, $existing_borrowal['id']]);
        } else {
            // Jika belum ada, buat entri baru di borrowals.
            $sql = "INSERT INTO borrowals (transaction_id, item_id, quantity, borrower_name, borrower_class, subject, user_id) VALUES (?, ?, ?, ?, ?, ?, ?)";
            $stmt = $pdo->prepare($sql);
            $stmt->execute([$transaction_id, $item_id, $quantity, $borrower_name, $borrower_class, $subject, $user_id_to_insert]);
        }

        // Kurangi stok dari tabel items
        $stmt_update_item = $pdo->prepare("UPDATE items SET current_quantity = current_quantity - ? WHERE id = ?");
        $stmt_update_item->execute([$quantity, $item_id]);
    }

    $pdo->commit();
    json_response('success', 'Alat berhasil ditambahkan.');

} catch (Exception $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    error_log('Add to Borrowal Error: ' . $e->getMessage());
    if (strpos($e->getMessage(), 'Stok') !== false || strpos($e->getMessage(), 'ditemukan') !== false) {
        json_response('error', $e->getMessage());
    } else {
        json_response('error', 'Gagal memproses penambahan alat.');
    }
}