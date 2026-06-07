 // src/routes/productos.js
const router = require('express').Router();
const db     = require('../config/db');

// GET /api/productos — listar todos con estado de stock
router.get('/', async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT * FROM v_stock_actual
    `);
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/productos/:codigo
router.get('/:codigo', async (req, res) => {
  try {
    const { rows } = await db.query(
      'SELECT * FROM productos WHERE codigo = $1',
      [req.params.codigo]
    );
    if (!rows.length)
      return res.status(404).json({ error: 'Producto no encontrado' });
    res.json(rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/productos
router.post('/', async (req, res) => {
  const {
    codigo, descripcion, proveedor_id,
    und_por_paquete, precio_venta
  } = req.body;
  try {
    const { rows } = await db.query(`
      INSERT INTO productos
        (codigo, descripcion, proveedor_id, und_por_paquete, precio_venta)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `, [codigo, descripcion, proveedor_id, und_por_paquete, precio_venta]);
    res.status(201).json(rows[0]);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// PUT /api/productos/:id
router.put('/:id', async (req, res) => {
  const { precio_venta, descripcion } = req.body;
  try {
    const { rows } = await db.query(`
      UPDATE productos
      SET precio_venta = $1,
          descripcion  = $2
      WHERE id = $3
      RETURNING *
    `, [precio_venta, descripcion, req.params.id]);
    res.json(rows[0]);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

module.exports = router;