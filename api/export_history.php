<?php
// Endpoint untuk menghasilkan dan mengunduh file CSV dari data riwayat.

header('Content-Type: text/csv; charset=utf-8');
// Nama file dinamis berdasarkan tanggal ekspor.
header('Content-Disposition: attachment; filename="riwayat_peminjaman_' . date('Y-m-d') . '.csv"');

// Buat file pointer yang terhubung ke output stream PHP.
$output = fopen('php://output', 'w');

// Tulis baris header untuk file CSV (judul kolom).
fputcsv($output, [
    'Nama Peminjam',
    'Kelas',
    'Mata Pelajaran',
    'Nama Barang',
    'Jumlah',
    'Tanggal Pinjam',
    'Tanggal Kembali',
    'Link Bukti'
]);

// Ambil data riwayat dari database.
try {
    // Dapatkan Base URL yang dinamis dari fungsi helper.
    $base_url = get_base_url();

    $stmt = $pdo->query("
        SELECT 
            h.borrower_name, 
            h.borrower_class, 
            h.subject,
            i.name as item_name, 
            h.quantity, 
            h.borrow_date, 
            h.return_date,
            h.proof_image_url
        FROM history h 
        JOIN items i ON h.item_id = i.id 
        ORDER BY h.return_date DESC
    ");
    
    // Loop melalui setiap baris data dan tulis ke file CSV.
    while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
        // Buat URL absolut untuk bukti gambar.
        $proof_full_url = $base_url . '/' . ltrim($row['proof_image_url'], '/');
        
        // Ganti path relatif dengan URL absolut di dalam array.
        $row['proof_image_url'] = $proof_full_url;

        fputcsv($output, $row);
    }

} catch (PDOException $e) {
    error_log("Export History Error: " . $e->getMessage());
}

fclose($output);
exit();