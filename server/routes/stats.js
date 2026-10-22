const express = require('express');
const db = require('../db');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const router = express.Router();
router.get('/', async (req,res)=>{try{res.json({items:await db.query('SELECT * FROM stats ORDER BY order_index ASC, id ASC')});}catch{res.status(500).json({error:'Gagal mengambil statistik.'});}});
router.put('/:id', requireAuth, requireAdmin, async (req,res)=>{try{const [existing]=await db.query('SELECT * FROM stats WHERE id = ?',[req.params.id]);if(!existing)return res.status(404).json({error:'Statistik tidak ditemukan.'});const {label,value,suffix,order_index}=req.body||{};const newValue=value===undefined?existing.value:Number(value);if(Number.isNaN(newValue))return res.status(400).json({error:'Nilai harus berupa angka.'});await db.execute('UPDATE stats SET label=?, value=?, suffix=?, order_index=? WHERE id=?',[label??existing.label,newValue,suffix??existing.suffix,order_index??existing.order_index,req.params.id]);const [updated]=await db.query('SELECT * FROM stats WHERE id=?',[req.params.id]);res.json({item:updated});}catch{res.status(500).json({error:'Gagal memperbarui statistik.'});}});
module.exports=router;
