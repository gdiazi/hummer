// src/routes/clientes.js
const router = require('express').Router();
const db     = require('../config/db');

// GET /api/clientes
router.get('/', async (req, res) => {
  try {
    const { q } = req.query;
    let sql    = 'SELECT * FROM clientes WHERE activo = TRUE';
    const params = [];
    if (q) {
      params.push(`%${q}%`);
      sql += ` AND (nombre ILIKE $1 OR ruc_dni ILIKE $1)`;
    }
    sql += ' ORDER BY nombre LIMIT 50';
    const { rows } = await db.query(sql, params);
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/clientes
router.post('/', async (req, res) => {
  const { nombre, ruc_dni, direccion, telefono, email } = req.body;
  try {
    const { rows } = await db.query(`
      INSERT INTO clientes (nombre, ruc_dni, direccion, telefono, email)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `, [nombre, ruc_dni, direccion, telefono, email]);
    res.status(201).json(rows[0]);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

module.exports = router;