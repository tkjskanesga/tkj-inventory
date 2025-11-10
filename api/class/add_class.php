<?php
// Endpoint untuk menambahkan kelas baru.

$name = isset($_POST['name']) ? sanitize_input(trim($_POST['name'])) : null;

if (empty($name)) {
    json_response('error', 'Nama kelas tidak boleh kosong.');
}

try {
    $stmt = $pdo->prepare("INSERT INTO classes (name) VALUES (?)");
    $stmt->execute([$name]);

    $new_class_id = $pdo->lastInsertId();
    
    // Mengembalikan data kelas baru agar bisa langsung dipakai di frontend
    json_response('success', 'Kelas berhasil ditambahkan.', ['id' => $new_class_id, 'name' => $name]);

} catch (PDOException $e) {
    error_log('Add Class Error: ' . $e->getMessage());
    if ($e->getCode() == 23000) {
        json_response('error', 'Nama kelas sudah ada.');
    }
    json_response('error', 'Gagal menambahkan kelas ke database.');
}