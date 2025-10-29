<?php
// Endpoint untuk mengambil daftar akun pengguna dengan paginasi dan pencarian.

try {
    // Pengaturan Paginasi
    $page = isset($_GET['page']) ? (int)$_GET['page'] : 1;
    $limit = 30; // Jumlah item per halaman
    $offset = ($page - 1) * $limit;

    // Parameter Pencarian dan Filter
    $search = $_GET['search'] ?? '';
    $filter = $_GET['filter'] ?? 'all';

    // Persiapan Query
    $baseQuery = "FROM users u LEFT JOIN classes c ON u.kelas = c.id";
    $conditions = [];
    $params = [];

    // Kondisi untuk filter
    if ($filter === 'admin') {
        $conditions[] = "u.role = 'admin'";
    } else if ($filter !== 'all') {
        // Jika filter bukan 'all' atau 'admin', maka itu adalah nama kelas
        $conditions[] = "c.name = ?";
        $params[] = $filter;
    } else {
        // Default 'all' hanya menampilkan user, bukan admin
        $conditions[] = "u.role = 'user'";
    }
    
    // Kondisi untuk pencarian
    if (!empty($search)) {
        $conditions[] = "(u.nama LIKE ? OR u.nis LIKE ? OR u.username LIKE ? OR c.name LIKE ?)";
        $searchTerm = "%{$search}%";
        array_push($params, $searchTerm, $searchTerm, $searchTerm, $searchTerm);
    }

    $whereClause = !empty($conditions) ? " WHERE " . implode(" AND ", $conditions) : "";

    // Query untuk menghitung total data yang cocok
    $totalQuery = "SELECT COUNT(u.id) " . $baseQuery . $whereClause;
    $stmtTotal = $pdo->prepare($totalQuery);
    $stmtTotal->execute($params);
    $totalRecords = $stmtTotal->fetchColumn();

    // Query untuk mengambil data akun dengan paginasi dan pengurutan berdasarkan NIS
    $dataQuery = "SELECT u.id, u.username, u.nama, u.nis, c.name AS kelas, u.role " . $baseQuery . $whereClause . " ORDER BY CASE WHEN u.role = 'admin' THEN 0 ELSE 1 END, u.nis ASC LIMIT ? OFFSET ?";
    $dataParams = array_merge($params, [$limit, $offset]);

    $stmtData = $pdo->prepare($dataQuery);
    // Binding manual karena tipe data LIMIT/OFFSET harus integer
    foreach ($dataParams as $key => $value) {
        $stmtData->bindValue($key + 1, $value, is_int($value) ? PDO::PARAM_INT : PDO::PARAM_STR);
    }
    $stmtData->execute();
    $users = $stmtData->fetchAll(PDO::FETCH_ASSOC);

    // Mengambil semua nama kelas untuk dropdown filter di frontend
    $stmt_classes = $pdo->prepare("SELECT name FROM classes ORDER BY name ASC");
    $stmt_classes->execute();
    $class_names_for_filter = $stmt_classes->fetchAll(PDO::FETCH_COLUMN);
    
    // Mengambil data kelas lengkap untuk modal
    $stmt_classes_full = $pdo->query("SELECT id, name FROM classes ORDER BY name ASC");
    $classes_data_full = $stmt_classes_full->fetchAll(PDO::FETCH_ASSOC);

    // Menentukan apakah ada halaman berikutnya
    $hasMore = ($page * $limit) < $totalRecords;

    json_response('success', 'Data akun berhasil diambil.', [
        'records' => $users,
        'hasMore' => $hasMore,
        'classes' => $class_names_for_filter,
        'classes_full' => $classes_data_full
    ]);

} catch (PDOException $e) {
    error_log('Get Accounts Error: ' . $e->getMessage());
    json_response('error', 'Gagal mengambil data akun.');
}