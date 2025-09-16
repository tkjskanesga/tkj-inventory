<?php
// Endpoint untuk mengambil data read-only (items, borrowals, history).

$type = $_GET['type'] ?? '';
$data = [];

try {
    switch ($type) {
        case 'items':
            $stmt_items = $pdo->query("SELECT * FROM items ORDER BY classifier ASC, name ASC");
            $items = $stmt_items->fetchAll();

            $stmt_classifiers = $pdo->query("SELECT DISTINCT classifier FROM items WHERE classifier IS NOT NULL AND classifier != '' ORDER BY classifier ASC");
            $classifiers = $stmt_classifiers->fetchAll(PDO::FETCH_COLUMN);
            
            $data = [
                'items' => $items,
                'classifiers' => $classifiers
            ];
            json_response('success', 'Data berhasil diambil.', $data);
            break;
            
        case 'borrowals':
            // Tambahkan transaction_id dan urutkan berdasarkan tanggal dan ID transaksi untuk pengelompokan
            $stmt = $pdo->query("SELECT b.*, i.name as item_name, i.image_url FROM borrowals b JOIN items i ON b.item_id = i.id ORDER BY b.borrow_date DESC, b.transaction_id DESC");
            $data = $stmt->fetchAll();
            json_response('success', 'Data berhasil diambil.', $data);
            break;
            
        case 'history':
            $page = isset($_GET['page']) ? (int)$_GET['page'] : 1;
            $limit = 15;
            $offset = ($page - 1) * $limit;
            $search = $_GET['search'] ?? '';
            $filterDate = $_GET['filterDate'] ?? '';

            $baseQuery = "FROM history h JOIN items i ON h.item_id = i.id";
            $conditions = [];
            $params = [];

            if (!empty($search)) {
                $conditions[] = "(h.borrower_name LIKE ? OR h.borrower_class LIKE ? OR i.name LIKE ? OR h.subject LIKE ?)";
                $searchTerm = "%{$search}%";
                array_push($params, $searchTerm, $searchTerm, $searchTerm, $searchTerm);
            }

            if (!empty($filterDate)) {
                $conditions[] = "(DATE(h.borrow_date) = ? OR DATE(h.return_date) = ?)";
                array_push($params, $filterDate, $filterDate);
            }

            $whereClause = '';
            if (!empty($conditions)) {
                $whereClause = " WHERE " . implode(" AND ", $conditions);
            }

            // Query untuk mendapatkan total data yang cocok (untuk menentukan `hasMore`)
            $totalQuery = "SELECT COUNT(h.id) " . $baseQuery . $whereClause;
            $stmtTotal = $pdo->prepare($totalQuery);
            $stmtTotal->execute($params);
            $totalRecords = $stmtTotal->fetchColumn();

            // Query untuk mendapatkan data dengan paginasi
            $dataQuery = "SELECT h.*, i.name as item_name, i.image_url " . $baseQuery . $whereClause . " ORDER BY h.return_date DESC, h.transaction_id DESC LIMIT ? OFFSET ?";
            $dataParams = array_merge($params, [$limit, $offset]);
            
            $stmtData = $pdo->prepare($dataQuery);
            // Binding manual karena tipe data LIMIT/OFFSET harus integer
            foreach ($dataParams as $key => $value) {
                if (is_int($value)) {
                    $stmtData->bindValue($key + 1, $value, PDO::PARAM_INT);
                } else {
                    $stmtData->bindValue($key + 1, $value, PDO::PARAM_STR);
                }
            }
            $stmtData->execute();
            $records = $stmtData->fetchAll();

            $hasMore = ($page * $limit) < $totalRecords;

            json_response('success', 'Data riwayat berhasil diambil.', [
                'records' => $records,
                'hasMore' => $hasMore
            ]);
            break;
            
        default:
            json_response('error', 'Tipe data tidak valid.');
            return;
    }
} catch (PDOException $e) {
    error_log("Get Data Error (type: $type): " . $e->getMessage());
    json_response('error', 'Gagal mengambil data dari server.');
}