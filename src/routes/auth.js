// src/routes/auth.js
const router   = require('express').Router();
const bcrypt   = require('bcryptjs');
const jwt      = require('jsonwebtoken');

// Usuarios en memoria para MVP
// En producción: guardar en tabla usuarios de PostgreSQL
const USUARIOS = [
  {
    id: 1,
    nombre: 'Administrador',
    email: 'admin@grupohummer.com',
    password: bcrypt.hashSync('hummer2024', 10),
    rol: 'admin'
  },
  {
    id: 2,
    nombre: 'Vendedor',
    email: 'vendedor@grupohummer.com',
    password: bcrypt.hashSync('hummer2024', 10),
    rol: 'vendedor'
  },
];

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = USUARIOS.find(u => u.email === email);
    if (!user)
      return res.status(401).json({ error: 'Usuario no encontrado' });

    const ok = await bcrypt.compare(password, user.password);
    if (!ok)
      return res.status(401).json({ error: 'Contraseña incorrecta' });

    const token = jwt.sign(
      { id: user.id, nombre: user.nombre, rol: user.rol },
      process.env.JWT_SECRET || 'hummer_secret',
      { expiresIn: '8h' }
    );

    res.json({
      token,
      user: { id: user.id, nombre: user.nombre, rol: user.rol }
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/auth/me — verificar token
router.get('/me', require('../middleware/auth'), (req, res) => {
  res.json(req.user);
});

module.exports = router;