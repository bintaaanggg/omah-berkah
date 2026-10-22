-- ============================================================
-- OMAH BERKAH - DATABASE MYSQL / MARIADB
-- Cocok untuk XAMPP (MariaDB) dan MySQL.
-- Bisa langsung di-import lewat phpMyAdmin.
-- ============================================================

CREATE DATABASE IF NOT EXISTS omah_berkah
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;
USE omah_berkah;

SET FOREIGN_KEY_CHECKS = 0;

DROP TABLE IF EXISTS donations;
DROP TABLE IF EXISTS messages;
DROP TABLE IF EXISTS stats;
DROP TABLE IF EXISTS timeline;
DROP TABLE IF EXISTS testimonials;
DROP TABLE IF EXISTS gallery;
DROP TABLE IF EXISTS programs;
DROP TABLE IF EXISTS users;

CREATE TABLE users (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  fullname VARCHAR(120) NOT NULL,
  email VARCHAR(190) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('admin','user') NOT NULL DEFAULT 'user',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE programs (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  title VARCHAR(150) NOT NULL,
  description TEXT NOT NULL,
  image VARCHAR(500) NULL,
  icon VARCHAR(100) NULL,
  order_index INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE gallery (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  image VARCHAR(500) NOT NULL,
  caption VARCHAR(255) NULL,
  order_index INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE testimonials (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(120) NOT NULL,
  role VARCHAR(120) NULL,
  quote TEXT NOT NULL,
  image VARCHAR(500) NULL,
  order_index INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE timeline (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  year VARCHAR(20) NOT NULL,
  title VARCHAR(150) NOT NULL,
  description TEXT NULL,
  order_index INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE stats (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  label VARCHAR(120) NOT NULL,
  value INT NOT NULL,
  suffix VARCHAR(20) NOT NULL DEFAULT '+',
  order_index INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE messages (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(120) NOT NULL,
  email VARCHAR(190) NOT NULL,
  subject VARCHAR(200) NULL,
  message TEXT NOT NULL,
  is_read TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE donations (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(120) NOT NULL,
  email VARCHAR(190) NOT NULL,
  program_id INT UNSIGNED NULL,
  amount BIGINT UNSIGNED NOT NULL,
  message TEXT NULL,
  status ENUM('pending','confirmed','cancelled') NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT fk_donations_program FOREIGN KEY (program_id) REFERENCES programs(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO programs (title, description, image, icon, order_index) VALUES
('Pendidikan', 'Mendukung pendidikan melalui beasiswa, pelatihan, dan bantuan perlengkapan sekolah.', 'asset/pendidikan.jpg', 'fa-graduation-cap', 1),
('Kesehatan', 'Pemeriksaan kesehatan dan edukasi kesehatan untuk masyarakat.', 'asset/kesehatan.jpg', 'fa-heart-pulse', 2),
('Kawi Farm', 'Pengembangan pertanian, peternakan, dan pemberdayaan ekonomi masyarakat desa.', 'asset/kawi farm.jpeg', 'fa-seedling', 3),
('Sosial & Pemberdayaan', 'Kegiatan sosial dan pemberdayaan masyarakat untuk membangun kemandirian bersama.', 'asset/omah berkah landscape.jpg', 'fa-hands-holding-heart', 4);

INSERT INTO gallery (image, caption, order_index) VALUES
('asset/galeri 1.jpg', 'Kegiatan sosial bersama warga', 1),
('asset/bocil persegi panjang.jpg', 'Bersama anak-anak binaan', 2),
('asset/bocil hadiah.jpg', 'Penyerahan bantuan pendidikan', 3),
('asset/omah berkah landscape.jpg', 'Suasana kegiatan Omah Berkah', 4),
('asset/galeri 5.jpg', 'Dokumentasi program', 5),
('asset/galeri 6.jpg', 'Dokumentasi kegiatan', 6);

INSERT INTO testimonials (name, role, quote, image, order_index) VALUES
('Habibi', 'Relawan', 'Program Omah Berkah sangat membantu masyarakat. Semoga semakin berkembang.', 'asset/user 3.jpeg', 1),
('Muhammad Habibie', 'Penerima Manfaat', 'Kegiatan sosialnya luar biasa. Saya sangat terbantu.', 'asset/user 2.jpeg', 2),
('Habibie', 'Mitra', 'Kolaborasi bersama Omah Berkah memberikan dampak positif.', 'asset/user 3.jpeg', 3);

INSERT INTO timeline (year, title, description, order_index) VALUES
('2022', 'Awal Berdiri', 'Memulai kegiatan sosial dan membangun jaringan relawan.', 1),
('2023', 'Program Pendidikan', 'Penyaluran bantuan pendidikan dan pelatihan masyarakat.', 2),
('2024', 'Kawi Farm', 'Mengembangkan program pertanian berkelanjutan bersama masyarakat.', 3),
('2025', 'Pengembangan Program', 'Memperluas kolaborasi dan dampak kegiatan sosial.', 4);

INSERT INTO stats (label, value, suffix, order_index) VALUES
('Program Sosial', 100, '+', 1),
('Penerima Manfaat', 5000, '+', 2),
('Relawan Aktif', 1000, '+', 3),
('Tahun Mengabdi', 10, '+', 4);

-- Admin dibuat otomatis oleh server dari ADMIN_EMAIL dan ADMIN_PASSWORD di .env.
-- Dengan begitu password selalu di-hash menggunakan bcrypt dan tidak ditulis mentah di SQL.

SET FOREIGN_KEY_CHECKS = 1;
