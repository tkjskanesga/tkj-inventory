<?php
// Endpoint untuk menghasilkan dan mengunduh file CSV dari data riwayat.

header('Content-Type: text/csv; charset=utf-8');
// Nama file dinamis berdasarkan tanggal ekspor.
header('Content-Disposition: attachment; filename="riwayat_peminjaman_' . date('Y-m-d') . '.csv"');

// Buat file pointer yang terhubung ke output stream PHP.
$output = fopen('php://output', 'w');

// Membuat header tabel CSV.
fputcsv($output, [
    'Nama Peminjam',
    'Kelas',
    'Mata Pelajaran',
    'Nama Barang',
    'Jenis Alat',
    'Jumlah',
    'Tanggal Pinjam',
    'Tanggal Kembali',
    'Link Bukti'
]);

// Ambil data riwayat dari database.
try {
    $base_url = get_base_url();

    // Query SQL untuk logika ekspor.
    $stmt = $pdo->query("
        SELECT 
            h.transaction_id,
            h.borrower_name, 
            h.borrower_class, 
            h.subject,
            i.name as item_name, 
            i.classifier,
            h.quantity, 
            h.borrow_date, 
            h.return_date,
            h.proof_image_url
        FROM history h 
        JOIN items i ON h.item_id = i.id 
        ORDER BY h.return_date DESC, h.transaction_id DESC
    ");
    
    $last_transaction_id = null;
    
    while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
        if (!empty($row['proof_image_url'])) {
            $row['proof_image_url'] = $base_url . '/' . ltrim($row['proof_image_url'], '/');
        }

        if (!empty($row['transaction_id']) && $row['transaction_id'] === $last_transaction_id) {
            // Kosongkan kolom yang relevan jika ID transaksi sama.
            $row['borrower_name'] = '';
            $row['borrower_class'] = '';
            $row['subject'] = '';
            $row['borrow_date'] = '';
            $row['return_date'] = '';
            $row['proof_image_url'] = '';
        } else {
            $last_transaction_id = $row['transaction_id'];
        }

        // Hapus kolom transaction_id dari array SEBELUM menulis ke CSV.
        unset($row['transaction_id']);

        fputcsv($output, $row);
    }

} catch (PDOException $e) {
    error_log("Export History Error: " . $e->getMessage());
}

fclose($output);
exit();