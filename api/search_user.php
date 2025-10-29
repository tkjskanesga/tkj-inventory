<?php
// Endpoint untuk mencari pengguna (role 'user') berdasarkan nama untuk fitur autocomplete.

$query = $_GET['query'] ?? '';

if (strlen($query) < 2) {
    json_response('success', 'Query is too short.', []);
}

try {
    // Cari pengguna dengan role 'user' yang namanya cocok dengan query
    $stmt = $pdo->prepare("
        SELECT
            u.id,
            u.nama,
            c.name AS kelas
        FROM users u
        LEFT JOIN classes c ON u.kelas = c.id
        WHERE u.role = 'user' AND u.nama LIKE ?
        LIMIT 10
    ");
    $stmt->execute(["%{$query}%"]);
    $users = $stmt->fetchAll(PDO::FETCH_ASSOC);

    json_response('success', 'Users found', $users);

} catch (PDOException $e) {
    error_log('Search User Error: ' . $e->getMessage());
    json_response('error', 'Gagal mencari data pengguna.');
}