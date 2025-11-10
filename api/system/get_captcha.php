<?php
// Endpoint untuk menghasilkan gambar CAPTCHA.

$characters = '23456789abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ';
$captcha_string = '';
$length = 6;

for ($i = 0; $i < $length; $i++) {
    $captcha_string .= $characters[rand(0, strlen($characters) - 1)];
}

// Simpan jawaban captcha di session untuk validasi.
$_SESSION['captcha_answer'] = $captcha_string;

// Konfigurasi pembuatan gambar.
$width = 250;
$height = 90;
$image = imagecreatetruecolor($width, $height);
$bg_color = imagecolorallocate($image, 241, 243, 244);
$text_colors = [imagecolorallocate($image, 30, 30, 30), imagecolorallocate($image, 70, 70, 70)];
$noise_colors = [imagecolorallocate($image, 200, 200, 200), imagecolorallocate($image, 180, 180, 180)];

// Gambar latar belakang, noise, dan garis acak.
imagefilledrectangle($image, 0, 0, $width, $height, $bg_color);
for ($i = 0; $i < 2000; $i++) {
    imagesetpixel($image, rand(0, $width), rand(0, $height), $noise_colors[array_rand($noise_colors)]);
}
for ($i = 0; $i < 8; $i++) {
    imageline($image, rand(0, $width), rand(0, $height), rand(0, $width), rand(0, $height), $noise_colors[array_rand($noise_colors)]);
}

// Tulis teks captcha ke gambar dengan distorsi posisi.
$font_size = 20;
$x_spacing = ($width - 60) / $length;
for ($i = 0; $i < $length; $i++) {
    $char = $captcha_string[$i];
    $x = 40 + ($i * $x_spacing) + rand(-5, 5);
    $y = ($height / 2) - (imagefontheight($font_size) / 2) + rand(-10, 10);
    imagestring($image, $font_size, $x, $y, $char, $text_colors[array_rand($text_colors)]);
}

// Tangkap output gambar dan konversi ke base64.
ob_start();
imagepng($image);
$image_data = ob_get_clean();
imagedestroy($image);

json_response('success', 'Captcha generated', [
    'image' => 'data:image/png;base64,' . base64_encode($image_data)
]);