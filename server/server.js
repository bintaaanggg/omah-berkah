require('dotenv').config();

if (!process.env.JWT_SECRET) {
  console.error('FATAL: JWT_SECRET belum diatur. Salin .env.example menjadi .env dan isi secret.');
  process.exit(1);
}

const path = require('path');
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const db = require('./db');

const authRoutes = require('./routes/auth');
const programRoutes = require('./routes/programs');
const galleryRoutes = require('./routes/gallery');
const testimonialRoutes = require('./routes/testimonials');
const timelineRoutes = require('./routes/timeline');
const statsRoutes = require('./routes/stats');
const messageRoutes = require('./routes/messages');
const donationRoutes = require('./routes/donations');
const uploadRoutes = require('./routes/upload');

const app = express();
const PORT = Number(process.env.PORT || 3000);

app.set('trust proxy', 1);
const allowedOrigins = process.env.FRONTEND_URL ? process.env.FRONTEND_URL.split(',').map(v => v.trim()).filter(Boolean) : true;
app.use(cors({ origin: allowedOrigins, credentials: false }));
app.use(express.json({ limit: '200kb' }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/api', rateLimit({ windowMs: 60 * 1000, max: 120 }));

app.get('/api/health', async (req,res)=>{
  try {
    await db.query('SELECT 1 AS ok');
    res.json({ status:'ok', database:'connected', time:new Date().toISOString() });
  } catch (err) {
    res.status(503).json({ status:'error', database:'disconnected' });
  }
});
app.use('/api/auth', authRoutes);
app.use('/api/programs', programRoutes);
app.use('/api/gallery', galleryRoutes);
app.use('/api/testimonials', testimonialRoutes);
app.use('/api/timeline', timelineRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/donations', donationRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api', (req,res)=>res.status(404).json({error:'Endpoint tidak ditemukan.'}));

async function start(){
  try {
    await db.initDatabase();
    app.listen(PORT, ()=>console.log(`Omah Berkah API berjalan di http://localhost:${PORT}`));
  } catch (err) {
    console.error('Gagal terhubung ke MySQL/MariaDB.');
    console.error(err.message);
    process.exit(1);
  }
}
start();
