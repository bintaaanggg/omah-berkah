const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = '7d';
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 30, message: { error: 'Terlalu banyak percobaan. Coba lagi beberapa saat lagi.' }, standardHeaders: true, legacyHeaders: false });
const isValidEmail = value => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
const signToken = user => jwt.sign({ id: user.id, fullname: user.fullname, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
const INTEREST_OPTIONS = ['pendidikan', 'kesehatan', 'lingkungan', 'kawi-farm', 'umum'];

router.post('/register', authLimiter, async (req, res) => {
  try {
    const { fullname, email, password, phone, domicile, interest } = req.body || {};
    if (!fullname || String(fullname).trim().length < 3) return res.status(400).json({ error: 'Nama minimal 3 karakter.' });
    if (!email || !isValidEmail(email)) return res.status(400).json({ error: 'Format email tidak valid.' });
    if (!password || String(password).length < 8) return res.status(400).json({ error: 'Kata sandi minimal 8 karakter.' });
    if (phone && !/^[0-9+\-\s]{8,20}$/.test(String(phone))) return res.status(400).json({ error: 'Format nomor WhatsApp tidak valid.' });
    const interestValue = interest && INTEREST_OPTIONS.includes(interest) ? interest : 'umum';
    const emailKey = String(email).trim().toLowerCase();
    const [existing] = await db.query('SELECT id FROM users WHERE email = ?', [emailKey]);
    if (existing) return res.status(409).json({ error: 'Email ini sudah terdaftar. Silakan masuk.' });
    const hash = await bcrypt.hash(password, 10);
    const result = await db.execute(
      'INSERT INTO users (fullname, email, password_hash, role, phone, domicile, interest) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [String(fullname).trim(), emailKey, hash, 'user', phone ? String(phone).trim() : null, domicile ? String(domicile).trim() : null, interestValue]
    );
    const memberNo = `OB-${new Date().getFullYear()}-${String(result.insertId).padStart(5, '0')}`;
    await db.execute('UPDATE users SET member_no = ? WHERE id = ?', [memberNo, result.insertId]);
    const user = { id: result.insertId, fullname: String(fullname).trim(), email: emailKey, role: 'user', member_no: memberNo, interest: interestValue, domicile: domicile || null };
    res.status(201).json({ token: signToken(user), user });
  } catch (err) { res.status(500).json({ error: 'Gagal membuat akun.' }); }
});

router.post('/login', authLimiter, async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !isValidEmail(email)) return res.status(400).json({ error: 'Format email tidak valid.' });
    if (!password) return res.status(400).json({ error: 'Kata sandi wajib diisi.' });
    const emailKey = String(email).trim().toLowerCase();
    const [row] = await db.query('SELECT * FROM users WHERE email = ?', [emailKey]);
    if (!row || !(await bcrypt.compare(password, row.password_hash))) return res.status(401).json({ error: 'Email atau kata sandi salah.' });
    const user = { id: row.id, fullname: row.fullname, email: row.email, role: row.role, member_no: row.member_no, interest: row.interest, domicile: row.domicile };
    res.json({ token: signToken(user), user });
  } catch (err) { res.status(500).json({ error: 'Gagal masuk.' }); }
});

router.get('/me', requireAuth, async (req, res) => {
  try {
    const [row] = await db.query('SELECT id, fullname, email, role, phone, domicile, interest, member_no, created_at FROM users WHERE id = ?', [req.user.id]);
    if (!row) return res.status(404).json({ error: 'Pengguna tidak ditemukan.' });
    res.json({ user: row });
  } catch (err) { res.status(500).json({ error: 'Gagal mengambil profil.' }); }
});

module.exports = router;
