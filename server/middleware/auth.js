const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET;

function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: 'Token tidak ditemukan. Silakan masuk kembali.' });
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload; // { id, fullname, email, role }
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Sesi tidak valid atau kedaluwarsa. Silakan masuk kembali.' });
  }
}

function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Akses ditolak. Hanya admin yang bisa melakukan ini.' });
  }
  next();
}

// Optional auth: attaches req.user if a valid token is present, but never blocks the request
function optionalAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (token) {
    try {
      req.user = jwt.verify(token, JWT_SECRET);
    } catch (err) {
      // ignore invalid token for optional auth
    }
  }
  next();
}

module.exports = { requireAuth, requireAdmin, optionalAuth };
