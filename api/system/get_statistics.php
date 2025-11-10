<?php
// Endpoint untuk mengambil data statistik untuk chart.

// Memastikan hanya admin yang dapat mengakses endpoint ini.
if (!isset($_SESSION['role']) || $_SESSION['role'] !== 'admin') {
    http_response_code(403);
    json_response('error', 'Akses ditolak.');
}

$type = $_GET['type'] ?? '';
$groupBy = $_GET['groupBy'] ?? 'name'; // 'name' or 'classifier'

// Validasi groupBy untuk keamanan
if (!in_array($groupBy, ['name', 'classifier'])) {
    $groupBy = 'name';
}

try {
    switch ($type) {
        // Data untuk diagram lingkaran (Kelas mana yang paling sering meminjam).
        case 'class_borrowals':
            $stmt = $pdo->query("
                SELECT borrower_class as label, COUNT(*) as count 
                FROM history 
                WHERE borrower_class IS NOT NULL AND borrower_class != ''
                GROUP BY borrower_class 
                ORDER BY count DESC
            ");
            $data = $stmt->fetchAll(PDO::FETCH_ASSOC);
            break;

        // Data untuk diagram batang (Alat apa saja yang sedang dipinjam).
        case 'current_loans':
            $query = "";
            if ($groupBy === 'classifier') {
                $query = "
                    SELECT i.classifier as label, SUM(b.quantity) as count
                    FROM borrowals b
                    JOIN items i ON b.item_id = i.id
                    WHERE i.classifier IS NOT NULL AND i.classifier != ''
                    GROUP BY i.classifier
                    ORDER BY count DESC
                ";
            } else { // group by name
                $query = "
                    SELECT i.name as label, SUM(b.quantity) as count, i.image_url
                    FROM borrowals b
                    JOIN items i ON b.item_id = i.id
                    WHERE i.name IS NOT NULL AND i.name != ''
                    GROUP BY i.name, i.image_url
                    ORDER BY count DESC
                ";
            }
            $stmt = $pdo->prepare($query);
            $stmt->execute();
            $data = $stmt->fetchAll(PDO::FETCH_ASSOC);
            break;

        // Data untuk diagram garis (Alat apa saja yang paling sering dipinjam dari riwayat).
        case 'loan_history':
            $query = "";
            if ($groupBy === 'classifier') {
                $query = "
                    SELECT i.classifier as label, COUNT(h.id) as count
                    FROM history h
                    JOIN items i ON h.item_id = i.id
                    WHERE i.classifier IS NOT NULL AND i.classifier != ''
                    GROUP BY i.classifier
                    ORDER BY count DESC
                    LIMIT 10
                ";
            } else { // group by name
                $query = "
                    SELECT i.name as label, COUNT(h.id) as count, i.image_url
                    FROM history h
                    JOIN items i ON h.item_id = i.id
                    WHERE i.name IS NOT NULL AND i.name != ''
                    GROUP BY i.name, i.image_url
                    ORDER BY count DESC
                    LIMIT 10
                ";
            }
            $stmt = $pdo->prepare($query);
            $stmt->execute();
            $data = $stmt->fetchAll(PDO::FETCH_ASSOC);
            break;

        default:
            json_response('error', 'Tipe statistik tidak valid.');
            return;
    }

    json_response('success', 'Data statistik berhasil diambil.', $data);

} catch (PDOException $e) {
    error_log("Get Statistics Error (type: $type): " . $e->getMessage());
    json_response('error', 'Gagal mengambil data statistik dari server.');
}