# Omah Berkah — Fullstack LSM

Website LSM Omah Berkah dengan **React + Vite**, **Node.js + Express**, dan **MySQL/MariaDB (XAMPP)**.

## Struktur

```text
omah-berkah/
├─ client/                  # React + Vite
├─ server/                  # Node.js + Express REST API
│  ├─ database.sql          # Database MySQL/MariaDB
│  ├─ db.js                 # Koneksi + auto create/seed database
│  ├─ routes/               # Auth, program, galeri, testimoni, timeline, statistik, pesan, donasi
│  └─ .env.example
├─ render.yaml              # Contoh konfigurasi deploy
└─ README.md
```

## 1. Syarat

- Node.js 20+
- XAMPP dengan **Apache + MySQL/MariaDB**
- Browser

## 2. Database XAMPP

1. Buka XAMPP Control Panel.
2. Start **Apache** dan **MySQL**.
3. Buka `http://localhost/phpmyadmin/`.
4. Klik **Import**.
5. Pilih `server/database.sql`.
6. Klik **Kirim/Import**.

Database `omah_berkah` dan tabel-tabelnya akan dibuat.

> Backend juga dapat membuat database/tabel otomatis jika user MariaDB memiliki izin `CREATE DATABASE`, tetapi untuk tugas sekolah lebih mudah dan jelas: import `server/database.sql` melalui phpMyAdmin.

## 3. Backend

```bash
cd server
npm install
copy .env.example .env
```

Buka `server/.env` dan gunakan pengaturan XAMPP default:

```env
PORT=3000
DB_HOST=127.0.0.1
DB_PORT=3306
DB_NAME=omah_berkah
DB_USER=root
DB_PASSWORD=
JWT_SECRET=ganti-dengan-secret-random-panjang
ADMIN_EMAIL=admin@omahberkah.org
ADMIN_PASSWORD=admin12345
FRONTEND_URL=http://localhost:5173
```

Lalu:

```bash
npm start
```

Jika berhasil:

`http://localhost:3000/api/health`

harus mengembalikan status `ok` dan `database: connected`.

## 4. Frontend React

Buka terminal baru:

```bash
cd client
npm install
npm run dev
```

Buka:

`http://localhost:5173`

## 5. Login admin

Gunakan email/password dari `.env`:

```text
Email: admin@omahberkah.org
Password: admin12345
```

Setelah berhasil masuk sebagai admin, buka `/admin` untuk dashboard CRUD.

**Ganti password admin sebelum dipakai sungguhan.**

## 6. Fitur dinamis

- Login/register
- JWT authentication
- Role admin/user
- CRUD Program
- CRUD Galeri
- CRUD Testimoni
- CRUD Timeline
- CRUD Statistik
- Pesan kontak masuk ke database
- Pengajuan donasi masuk ke database
- Admin dapat mengubah status donasi
- Ringkasan donasi terkonfirmasi

Pengajuan donasi pada project ini **belum merupakan pembayaran online**. Untuk menerima pembayaran sungguhan, integrasikan payment gateway dan webhook.

## 7. Deploy

Frontend dan backend dapat dideploy terpisah. Backend membutuhkan database MySQL/MariaDB yang dapat diakses dari internet. Isi environment variable berikut pada layanan hosting:

```env
DB_HOST=...
DB_PORT=3306
DB_NAME=omah_berkah
DB_USER=...
DB_PASSWORD=...
JWT_SECRET=...
ADMIN_EMAIL=...
ADMIN_PASSWORD=...
FRONTEND_URL=https://domain-frontend-kamu.example
```

Frontend:

```env
VITE_API_URL=https://domain-backend-kamu.example
```

`render.yaml` hanya menjadi contoh konfigurasi service; Render tidak menyediakan MySQL lokal seperti XAMPP, sehingga database production harus memakai layanan MySQL/MariaDB yang bisa diakses oleh backend.
