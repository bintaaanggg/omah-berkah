const express = require('express');
const rateLimit = require('express-rate-limit');
const db = require('../db');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const router = express.Router();
const contactLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 10, message: { error: 'Terlalu banyak pesan terkirim. Coba lagi nanti.' }, standardHeaders: true, legacyHeaders: false });
const isValidEmail = value => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

router.post('/', contactLimiter, async (req, res) => {
  try {
    const { name, email, subject, message } = req.body || {};
    if (!name || String(name).trim().length < 2) return res.status(400).json({ error: 'Nama wajib diisi.' });
    if (!email || !isValidEmail(email)) return res.status(400).json({ error: 'Format email tidak valid.' });
    if (!message || String(message).trim().length < 5) return res.status(400).json({ error: 'Pesan terlalu pendek.' });
    const result = await db.execute('INSERT INTO messages (name, email, subject, message) VALUES (?, ?, ?, ?)', [String(name).trim(), String(email).trim(), subject ? String(subject).trim() : null, String(message).trim()]);
    res.status(201).json({ id: result.insertId, success: true });
  } catch (err) { res.status(500).json({ error: 'Gagal mengirim pesan.' }); }
});
router.get('/', requireAuth, requireAdmin, async (req, res) => { try { res.json({ items: await db.query('SELECT * FROM messages ORDER BY created_at DESC') }); } catch { res.status(500).json({ error: 'Gagal mengambil pesan.' }); } });
router.patch('/:id', requireAuth, requireAdmin, async (req, res) => { try { const [existing] = await db.query('SELECT id FROM messages WHERE id = ?', [req.params.id]); if (!existing) return res.status(404).json({ error: 'Pesan tidak ditemukan.' }); await db.execute('UPDATE messages SET is_read = ? WHERE id = ?', [req.body?.is_read ? 1 : 0, req.params.id]); res.json({ success: true }); } catch { res.status(500).json({ error: 'Gagal memperbarui pesan.' }); } });
router.delete('/:id', requireAuth, requireAdmin, async (req, res) => { try { const [existing] = await db.query('SELECT id FROM messages WHERE id = ?', [req.params.id]); if (!existing) return res.status(404).json({ error: 'Pesan tidak ditemukan.' }); await db.execute('DELETE FROM messages WHERE id = ?', [req.params.id]); res.json({ success: true }); } catch { res.status(500).json({ error: 'Gagal menghapus pesan.' }); } });
module.exports = router;
