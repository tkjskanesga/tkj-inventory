<?php
// Endpoint untuk mengedit nama kelas.

$id = $_POST['id'] ?? null;
$name = isset($_POST['name']) ? sanitize_input(trim($_POST['name'])) : null;

if (empty($id) || empty($name)) {
    json_response('error', 'ID dan nama kelas baru tidak boleh kosong.');
}

try {
    // Ambil nama kelas lama untuk proses update referensi
    $stmt_old_name = $pdo->prepare("SELECT name FROM classes WHERE id = ?");
    $stmt_old_name->execute([$id]);
    $old_name = $stmt_old_name->fetchColumn();

    if (!$old_name) {
        json_response('error', 'Kelas yang akan diedit tidak ditemukan.');
    }

    // Cek duplikasi nama baru, kecuali jika sama dengan nama lama (case-insensitive)
    if (strcasecmp($old_name, $name) !== 0) {
        $stmt_check = $pdo->prepare("SELECT id FROM classes WHERE name = ?");
        $stmt_check->execute([$name]);
        if ($stmt_check->fetch()) {
            json_response('error', 'Nama kelas baru sudah digunakan.');
        }
    }
    
    $pdo->beginTransaction();

    // Update nama di tabel utama 'classes'
    $stmt_update = $pdo->prepare("UPDATE classes SET name = ? WHERE id = ?");
    $stmt_update->execute([$name, $id]);

    // Update semua referensi di tabel 'users'
    $stmt_update_users = $pdo->prepare("UPDATE users SET kelas = ? WHERE kelas = ?");
    $stmt_update_users->execute([$name, $old_name]);

    // Update semua referensi di tabel 'borrowals'
    $stmt_update_borrowals = $pdo->prepare("UPDATE borrowals SET borrower_class = ? WHERE borrower_class = ?");
    $stmt_update_borrowals->execute([$name, $old_name]);
    
    // Update semua referensi di tabel 'history'
    $stmt_update_history = $pdo->prepare("UPDATE history SET borrower_class = ? WHERE borrower_class = ?");
    $stmt_update_history->execute([$name, $old_name]);

    $pdo->commit();

    json_response('success', 'Kelas berhasil diperbarui di seluruh sistem.');

} catch (PDOException $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    error_log('Edit Class Error: ' . $e->getMessage());
    json_response('error', 'Gagal memperbarui kelas.');
}