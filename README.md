# TKJ Inventory
TKJ Inventory is a responsive web application that streamlines equipment management for vocational schools, especially for Computer and Network Engineering (TKJ) departments. It simplifies tracking, borrowing, and returning items through an intuitive interface.

<p align="center">
A modern, framework-free web application to streamline equipment tracking, borrowing, and returns for vocational school IT departments.
</p>

---

## ✨ Features

- 📦 **Dynamic Stock Management**: Easily add, edit, and delete items with image uploads for clear visual identification.  
- 🔄 **Effortless Borrowing & Returning**: A streamlined workflow for lending and receiving items, including a feature to upload photo proof upon return.  
- 📚 **Comprehensive History**: Maintain a detailed log of all transactions. The history is searchable, can be filtered by date, and exported to a CSV file.  
- 🔑 **Role-Based Access Control**: Separate views and permissions for Admins (full control) and Students (borrowing access), ensuring secure and organized management.  
- 📱 **Fully Responsive UI**: A user-friendly interface that works seamlessly on desktops, tablets, and mobile devices.  
- 🎨 **Light & Dark Modes**: A comfortable viewing experience in any lighting condition, with themes that adapt to user preferences.  

---

## 🛠️ Built From Scratch With

This project is built with a passion for simplicity and performance, using only native technologies without any frameworks.

- **Backend**: Vanilla PHP  
- **Frontend**: Vanilla JavaScript (ES6+), HTML5, CSS3  
- **Database**: MySQL / MariaDB  

---

## ❤️ A Note from the Creator

I'm not a professional programmer, but I am an IT enthusiast with a deep passion for exploring technology.  
This project was born out of a desire to learn and create something useful from the ground up.  

Every line of code, every design choice, and the entire application structure is the result of my personal effort and exploration.  
I hope you find it useful!  

---

## ⚙️ Getting Started: Deployment Guide

### Prerequisites
- A **LEMP Stack** (Linux, Nginx, MySQL/MariaDB, PHP) is required.  

**Nginx Configuration**  
- In your server block (e.g., `/etc/nginx/sites-available/default`), set:
  ```
  client_max_body_size 20M;
  ```
- (Recommended) For better upload performance, configure Nginx to write directly to disk without buffering:
  ```
  proxy_request_buffering off;
  ```

**PHP Configuration**  
- Set your timezone in both php.ini files:  

  - `/etc/php/<version>/fpm/php.ini`  
  - `/etc/php/<version>/cli/php.ini`  

- Find the line `;date.timezone =` and set it to your location, e.g.:  
  ```
  date.timezone = Asia/Jakarta
  ```

---

### Installation Steps

**1. Clone the Repository**
```bash
git clone https://github.com/aleafarrel-id/tkj-inventory.git
```

**2. Move to Web Directory**
```bash
sudo mv tkj-inventory /var/www/html/
```

**3. Configure Nginx Web Root**  
Edit your Nginx server block configuration file:  

```nginx
server {
    listen 80;
    server_name your_domain.com;
    root /var/www/html/tkj-inventory/public; # <-- Point here

    index index.php index.html;

    location / {
        try_files $uri $uri/ /index.php?$query_string;
    }

    location ~ \.php$ {
        include snippets/fastcgi-php.conf;
        fastcgi_pass unix:/var/run/php/php<your-version>-fpm.sock;
    }
}
```

Restart Nginx to apply changes:
```bash
sudo systemctl restart nginx
```

**4. Set Up the Database**
```sql
CREATE DATABASE tkj_inventory;
```

Import the SQL file:
```bash
mysql -u your_username -p tkj_inventory < /var/www/html/tkj-inventory/tkj_inventory.sql
```

**5. Update Database Credentials**  
Edit `config/connect.php` and update:
```php
const DB_USER = 'your_username';
const DB_PASS = 'your_password';
```

**6. Set Permissions**
```bash
sudo chown -R www-data:www-data /var/www/html/tkj-inventory
sudo chmod -R 755 /var/www/html/tkj-inventory
```

Now, open your browser and access the application! 🎉

---

## 📄 License

Copyright (c) 2025 **Alea Farrel**  
All Rights Reserved.  

This project is **proprietary and closed source**.  
You may **not** use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software without explicit permission from the copyright holder.
