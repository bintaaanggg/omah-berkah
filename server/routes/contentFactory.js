const express = require('express');
const db = require('../db');
const { requireAuth, requireAdmin } = require('../middleware/auth');

function buildContentRouter(table, fields, opts = {}) {
  const router = express.Router();
  const requiredFields = opts.requiredFields || fields;

  router.get('/', async (req, res) => {
    try {
      const rows = opts.withRaised
        ? await db.query(`SELECT ${table}.*, COALESCE(SUM(CASE WHEN donations.status='confirmed' THEN donations.amount ELSE 0 END),0) AS raised_amount FROM ${table} LEFT JOIN donations ON donations.program_id = ${table}.id GROUP BY ${table}.id ORDER BY ${table}.order_index ASC, ${table}.id ASC`)
        : await db.query(`SELECT * FROM ${table} ORDER BY order_index ASC, id ASC`);
      res.json({ items: rows });
    } catch (err) { res.status(500).json({ error: 'Gagal mengambil data.' }); }
  });

  router.post('/', requireAuth, requireAdmin, async (req, res) => {
    try {
      const body = req.body || {};
      for (const f of requiredFields) {
        if (body[f] === undefined || body[f] === null || String(body[f]).trim() === '') {
          return res.status(400).json({ error: `Field "${f}" wajib diisi.` });
        }
      }
      const cols = [...fields, 'order_index'];
      const placeholders = cols.map(() => '?').join(', ');
      const values = fields.map(f => body[f] === undefined ? null : body[f]);
      values.push(body.order_index ?? 0);
      const result = await db.execute(`INSERT INTO ${table} (${cols.join(', ')}) VALUES (${placeholders})`, values);
      const [created] = await db.query(`SELECT * FROM ${table} WHERE id = ?`, [result.insertId]);
      res.status(201).json({ item: created });
    } catch (err) { res.status(500).json({ error: 'Gagal menyimpan data.' }); }
  });

  router.put('/:id', requireAuth, requireAdmin, async (req, res) => {
    try {
      const [existing] = await db.query(`SELECT * FROM ${table} WHERE id = ?`, [req.params.id]);
      if (!existing) return res.status(404).json({ error: 'Data tidak ditemukan.' });
      const body = req.body || {};
      const cols = [...fields, 'order_index'];
      const values = fields.map(f => body[f] === undefined ? existing[f] : body[f]);
      values.push(body.order_index === undefined ? existing.order_index : body.order_index);
      values.push(req.params.id);
      const setClause = cols.map(c => `${c} = ?`).join(', ');
      await db.execute(`UPDATE ${table} SET ${setClause} WHERE id = ?`, values);
      const [updated] = await db.query(`SELECT * FROM ${table} WHERE id = ?`, [req.params.id]);
      res.json({ item: updated });
    } catch (err) { res.status(500).json({ error: 'Gagal memperbarui data.' }); }
  });

  router.delete('/:id', requireAuth, requireAdmin, async (req, res) => {
    try {
      const [existing] = await db.query(`SELECT id FROM ${table} WHERE id = ?`, [req.params.id]);
      if (!existing) return res.status(404).json({ error: 'Data tidak ditemukan.' });
      await db.execute(`DELETE FROM ${table} WHERE id = ?`, [req.params.id]);
      res.json({ success: true });
    } catch (err) { res.status(500).json({ error: 'Gagal menghapus data.' }); }
  });

  return router;
}

module.exports = buildContentRouter;
