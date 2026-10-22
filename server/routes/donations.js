const express = require('express');
const rateLimit = require('express-rate-limit');
const db = require('../db');
const { requireAuth, requireAdmin, optionalAuth } = require('../middleware/auth');
const router = express.Router();
const donationLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 15, message: { error: 'Terlalu banyak pengajuan. Coba lagi nanti.' }, standardHeaders: true, legacyHeaders: false });
const isValidEmail = value => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
router.post('/', donationLimiter, optionalAuth, async (req, res) => {
  try {
    const loggedIn = req.user || null;
    const name = loggedIn ? loggedIn.fullname : (req.body || {}).name;
    const email = loggedIn ? loggedIn.email : (req.body || {}).email;
    const { program_id, amount, message } = req.body || {};
    if (!name || String(name).trim().length < 2) return res.status(400).json({ error: 'Nama wajib diisi.' });
    if (!email || !isValidEmail(email)) return res.status(400).json({ error: 'Format email tidak valid.' });
    const numAmount = Number(amount); if (!Number.isSafeInteger(numAmount) || numAmount <= 0) return res.status(400).json({ error: 'Nominal donasi tidak valid.' });
    let programId = null;
    if (program_id) { const [program] = await db.query('SELECT id FROM programs WHERE id = ?', [program_id]); if (program) programId = program.id; }
    const result = await db.execute('INSERT INTO donations (name, email, program_id, user_id, amount, message, status) VALUES (?, ?, ?, ?, ?, ?, ?)', [String(name).trim(), String(email).trim(), programId, loggedIn ? loggedIn.id : null, numAmount, message ? String(message).trim() : null, 'pending']);
    res.status(201).json({ id: result.insertId, success: true });
  } catch { res.status(500).json({ error: 'Gagal menyimpan pengajuan donasi.' }); }
});
router.get('/summary', async (req, res) => { try { const [row] = await db.query("SELECT COALESCE(SUM(amount), 0) AS total, COUNT(*) AS count FROM donations WHERE status = 'confirmed'"); res.json(row); } catch { res.status(500).json({ error: 'Gagal mengambil ringkasan donasi.' }); } });
router.get('/mine', requireAuth, async (req, res) => { try { const items = await db.query(`SELECT donations.*, programs.title AS program_title FROM donations LEFT JOIN programs ON donations.program_id = programs.id WHERE donations.user_id = ? ORDER BY donations.created_at DESC`, [req.user.id]); res.json({ items }); } catch { res.status(500).json({ error: 'Gagal mengambil riwayat donasi.' }); } });
router.get('/impact', optionalAuth, async (req, res) => {
  try {
    const rows = await db.query(`SELECT programs.id, programs.title, COALESCE(SUM(CASE WHEN donations.status='confirmed' THEN donations.amount ELSE 0 END),0) AS total, COUNT(CASE WHEN donations.status='confirmed' THEN donations.id END) AS donor_count FROM programs LEFT JOIN donations ON donations.program_id = programs.id GROUP BY programs.id, programs.title ORDER BY total DESC`);
    const [totals] = await db.query("SELECT COALESCE(SUM(amount),0) AS total, COUNT(*) AS donor_count FROM donations WHERE status = 'confirmed'");
    if (!req.user) return res.json({ locked: true, total: totals.total, donor_count: totals.donor_count, programs: rows.map(r => ({ id: r.id, title: r.title })) });
    res.json({ locked: false, total: totals.total, donor_count: totals.donor_count, programs: rows });
  } catch { res.status(500).json({ error: 'Gagal mengambil laporan dampak.' }); }
});
router.get('/', requireAuth, requireAdmin, async (req, res) => { try { const items = await db.query(`SELECT donations.*, programs.title AS program_title FROM donations LEFT JOIN programs ON donations.program_id = programs.id ORDER BY donations.created_at DESC`); res.json({ items }); } catch { res.status(500).json({ error: 'Gagal mengambil data donasi.' }); } });
router.patch('/:id', requireAuth, requireAdmin, async (req, res) => { try { const [existing] = await db.query('SELECT id FROM donations WHERE id = ?', [req.params.id]); if (!existing) return res.status(404).json({ error: 'Donasi tidak ditemukan.' }); const { status } = req.body || {}; if (!['pending','confirmed','cancelled'].includes(status)) return res.status(400).json({ error: 'Status tidak valid.' }); await db.execute('UPDATE donations SET status = ? WHERE id = ?', [status, req.params.id]); res.json({ success: true }); } catch { res.status(500).json({ error: 'Gagal memperbarui donasi.' }); } });
module.exports = router;
