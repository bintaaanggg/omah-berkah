const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');

const config = {
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'omah_berkah',
  waitForConnections: true,
  connectionLimit: Number(process.env.DB_CONNECTION_LIMIT || 10),
  queueLimit: 0,
  charset: 'utf8mb4',
  multipleStatements: true
};

let pool;

async function initDatabase() {
  // Create the database automatically if the configured MySQL/MariaDB user has permission.
  const bootstrap = await mysql.createConnection({
    host: config.host,
    port: config.port,
    user: config.user,
    password: config.password,
    charset: 'utf8mb4'
  });
  await bootstrap.query(
    `CREATE DATABASE IF NOT EXISTS \`${config.database.replace(/`/g, '')}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
  );
  await bootstrap.end();

  pool = mysql.createPool(config);

  // Tables are also ensured here so a deployment can start without manually importing SQL.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      fullname VARCHAR(120) NOT NULL,
      email VARCHAR(190) NOT NULL UNIQUE,
      password_hash VARCHAR(255) NOT NULL,
      role ENUM('admin','user') NOT NULL DEFAULT 'user',
      phone VARCHAR(30) NULL,
      domicile VARCHAR(120) NULL,
      interest VARCHAR(60) NULL,
      member_no VARCHAR(20) NULL UNIQUE,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

    CREATE TABLE IF NOT EXISTS programs (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      title VARCHAR(150) NOT NULL,
      description TEXT NOT NULL,
      image VARCHAR(500) NULL,
      icon VARCHAR(100) NULL,
      target_amount BIGINT UNSIGNED NULL,
      order_index INT NOT NULL DEFAULT 0,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

    CREATE TABLE IF NOT EXISTS gallery (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      image VARCHAR(500) NOT NULL,
      caption VARCHAR(255) NULL,
      order_index INT NOT NULL DEFAULT 0,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

    CREATE TABLE IF NOT EXISTS testimonials (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      name VARCHAR(120) NOT NULL,
      role VARCHAR(120) NULL,
      quote TEXT NOT NULL,
      image VARCHAR(500) NULL,
      order_index INT NOT NULL DEFAULT 0,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

    CREATE TABLE IF NOT EXISTS timeline (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      year VARCHAR(20) NOT NULL,
      title VARCHAR(150) NOT NULL,
      description TEXT NULL,
      order_index INT NOT NULL DEFAULT 0,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

    CREATE TABLE IF NOT EXISTS stats (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      label VARCHAR(120) NOT NULL,
      value INT NOT NULL,
      suffix VARCHAR(20) NOT NULL DEFAULT '+',
      order_index INT NOT NULL DEFAULT 0,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

    CREATE TABLE IF NOT EXISTS messages (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      name VARCHAR(120) NOT NULL,
      email VARCHAR(190) NOT NULL,
      subject VARCHAR(200) NULL,
      message TEXT NOT NULL,
      is_read TINYINT(1) NOT NULL DEFAULT 0,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

    CREATE TABLE IF NOT EXISTS donations (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      name VARCHAR(120) NOT NULL,
      email VARCHAR(190) NOT NULL,
      program_id INT UNSIGNED NULL,
      user_id INT UNSIGNED NULL,
      amount BIGINT UNSIGNED NOT NULL,
      message TEXT NULL,
      status ENUM('pending','confirmed','cancelled') NOT NULL DEFAULT 'pending',
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      CONSTRAINT fk_donations_program FOREIGN KEY (program_id) REFERENCES programs(id) ON DELETE SET NULL,
      CONSTRAINT fk_donations_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  // Backward-compatible migration for databases created before user_id existed.
  try {
    const [col] = await pool.query(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'donations' AND COLUMN_NAME = 'user_id'`,
      [config.database]
    );
    if (!col.length) {
      await pool.query(`ALTER TABLE donations ADD COLUMN user_id INT UNSIGNED NULL AFTER program_id`);
      await pool.query(`ALTER TABLE donations ADD CONSTRAINT fk_donations_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL`);
    }
  } catch (err) { /* ignore if already migrated or lacking ALTER privilege */ }

  // Backward-compatible migration for databases created before membership fields existed.
  try {
    const [cols] = await pool.query(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'users' AND COLUMN_NAME IN ('phone','domicile','interest','member_no')`,
      [config.database]
    );
    const existingCols = cols.map(c => c.COLUMN_NAME);
    if (!existingCols.includes('phone')) await pool.query(`ALTER TABLE users ADD COLUMN phone VARCHAR(30) NULL`);
    if (!existingCols.includes('domicile')) await pool.query(`ALTER TABLE users ADD COLUMN domicile VARCHAR(120) NULL`);
    if (!existingCols.includes('interest')) await pool.query(`ALTER TABLE users ADD COLUMN interest VARCHAR(60) NULL`);
    if (!existingCols.includes('member_no')) {
      await pool.query(`ALTER TABLE users ADD COLUMN member_no VARCHAR(20) NULL UNIQUE`);
      const [existingUsers] = await pool.query('SELECT id, created_at FROM users ORDER BY id ASC');
      for (const u of existingUsers) {
        const year = new Date(u.created_at).getFullYear();
        const seq = String(u.id).padStart(5, '0');
        await pool.query('UPDATE users SET member_no = ? WHERE id = ?', [`OB-${year}-${seq}`, u.id]);
      }
    }
  } catch (err) { /* ignore if already migrated or lacking ALTER privilege */ }

  // Backward-compatible migration for databases created before programs.target_amount existed.
  try {
    const [col] = await pool.query(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'programs' AND COLUMN_NAME = 'target_amount'`,
      [config.database]
    );
    if (!col.length) await pool.query(`ALTER TABLE programs ADD COLUMN target_amount BIGINT UNSIGNED NULL AFTER icon`);
  } catch (err) { /* ignore if already migrated or lacking ALTER privilege */ }

  await seedData();
  return pool;
}

async function seedData() {
  const [programs] = await pool.query('SELECT COUNT(*) AS c FROM programs');
  if (Number(programs[0].c) === 0) {
    await pool.query(
      `INSERT INTO programs (title, description, image, icon, order_index) VALUES
       (?, ?, ?, ?, ?), (?, ?, ?, ?, ?), (?, ?, ?, ?, ?), (?, ?, ?, ?, ?)`,
      [
        'Pendidikan', 'Mendukung pendidikan melalui beasiswa, pelatihan, dan bantuan perlengkapan sekolah.', 'asset/pendidikan.jpg', 'fa-graduation-cap', 1,
        'Kesehatan', 'Pemeriksaan kesehatan dan edukasi kesehatan untuk masyarakat.', 'asset/kesehatan.jpg', 'fa-heart-pulse', 2,
        'Kawi Farm', 'Pengembangan pertanian, peternakan, dan pemberdayaan ekonomi masyarakat desa.', 'asset/kawi farm.jpeg', 'fa-seedling', 3,
        'Sosial & Pemberdayaan', 'Kegiatan sosial dan pemberdayaan masyarakat untuk membangun kemandirian bersama.', 'asset/omah berkah landscape.jpg', 'fa-hands-holding-heart', 4
      ]
    );
  }

  const [gallery] = await pool.query('SELECT COUNT(*) AS c FROM gallery');
  if (Number(gallery[0].c) === 0) {
    await pool.query(
      `INSERT INTO gallery (image, caption, order_index) VALUES
       (?, ?, ?), (?, ?, ?), (?, ?, ?), (?, ?, ?), (?, ?, ?), (?, ?, ?)`,
      [
        'asset/galeri 1.jpg', 'Kegiatan sosial bersama warga', 1,
        'asset/bocil persegi panjang.jpg', 'Bersama anak-anak binaan', 2,
        'asset/bocil hadiah.jpg', 'Penyerahan bantuan pendidikan', 3,
        'asset/omah berkah landscape.jpg', 'Suasana kegiatan Omah Berkah', 4,
        'asset/galeri 5.jpg', 'Dokumentasi program', 5,
        'asset/galeri 6.jpg', 'Dokumentasi kegiatan', 6
      ]
    );
  }

  const [testimonials] = await pool.query('SELECT COUNT(*) AS c FROM testimonials');
  if (Number(testimonials[0].c) === 0) {
    await pool.query(
      `INSERT INTO testimonials (name, role, quote, image, order_index) VALUES
       (?, ?, ?, ?, ?), (?, ?, ?, ?, ?), (?, ?, ?, ?, ?)`,
      [
        'Habibi', 'Relawan', 'Program Omah Berkah sangat membantu masyarakat. Semoga semakin berkembang.', 'asset/user 3.jpeg', 1,
        'Muhammad Habibie', 'Penerima Manfaat', 'Kegiatan sosialnya luar biasa. Saya sangat terbantu.', 'asset/user 2.jpeg', 2,
        'Habibie', 'Mitra', 'Kolaborasi bersama Omah Berkah memberikan dampak positif.', 'asset/user 3.jpeg', 3
      ]
    );
  }

  const [timeline] = await pool.query('SELECT COUNT(*) AS c FROM timeline');
  if (Number(timeline[0].c) === 0) {
    await pool.query(
      `INSERT INTO timeline (year, title, description, order_index) VALUES
       (?, ?, ?, ?), (?, ?, ?, ?), (?, ?, ?, ?), (?, ?, ?, ?)`,
      [
        '2022', 'Awal Berdiri', 'Memulai kegiatan sosial dan membangun jaringan relawan.', 1,
        '2023', 'Program Pendidikan', 'Penyaluran bantuan pendidikan dan pelatihan masyarakat.', 2,
        '2024', 'Kawi Farm', 'Mengembangkan program pertanian berkelanjutan bersama masyarakat.', 3,
        '2025', 'Pengembangan Program', 'Memperluas kolaborasi dan dampak kegiatan sosial.', 4
      ]
    );
  }

  const [stats] = await pool.query('SELECT COUNT(*) AS c FROM stats');
  if (Number(stats[0].c) === 0) {
    await pool.query(
      `INSERT INTO stats (label, value, suffix, order_index) VALUES
       (?, ?, ?, ?), (?, ?, ?, ?), (?, ?, ?, ?), (?, ?, ?, ?)`,
      ['Program Sosial', 100, '+', 1, 'Penerima Manfaat', 5000, '+', 2, 'Relawan Aktif', 1000, '+', 3, 'Tahun Mengabdi', 10, '+', 4]
    );
  }

  const [admins] = await pool.query("SELECT COUNT(*) AS c FROM users WHERE role = 'admin'");
  if (Number(admins[0].c) === 0) {
    const email = (process.env.ADMIN_EMAIL || 'admin@omahberkah.org').trim().toLowerCase();
    const password = process.env.ADMIN_PASSWORD || 'admin12345';
    const hash = bcrypt.hashSync(password, 10);
    await pool.query(
      'INSERT INTO users (fullname, email, password_hash, role) VALUES (?, ?, ?, \'admin\')',
      ['Admin Omah Berkah', email, hash]
    );
    console.log(`[seed] Admin dibuat: ${email}`);
    if (!process.env.ADMIN_PASSWORD) console.log('[seed] Password default: admin12345 — segera ganti di .env.');
  }
}

function getDb() {
  if (!pool) throw new Error('Database belum diinisialisasi.');
  return pool;
}

async function query(sql, params = []) {
  const [rows] = await getDb().query(sql, params);
  return rows;
}

async function execute(sql, params = []) {
  const [result] = await getDb().execute(sql, params);
  return result;
}

async function close() {
  if (pool) await pool.end();
}

module.exports = { initDatabase, query, execute, close };
