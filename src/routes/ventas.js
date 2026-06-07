// src/routes/ventas.js
const router = require('express').Router();
const db     = require('../config/db');

// GET /api/ventas
router.get('/', async (req, res) => {
  const { forma_pago, desde, hasta, cliente } = req.query;
  let where  = 'WHERE 1=1';
  const params = [];
  if (forma_pago) { params.push(forma_pago);       where += ` AND v.forma_pago = $${params.length}`; }
  if (desde)      { params.push(desde);             where += ` AND v.fecha >= $${params.length}`; }
  if (hasta)      { params.push(hasta);              where += ` AND v.fecha <= $${params.length}`; }
  if (cliente)    { params.push(`%${cliente}%`);    where += ` AND COALESCE(v.cliente_nombre, c.nombre) ILIKE $${params.length}`; }
  try {
    const { rows } = await db.query(`
      SELECT v.*,
             p.codigo, p.descripcion,
             a.nombre AS almacen,
             COALESCE(v.cliente_nombre, c.nombre) AS cliente
      FROM ventas v
      JOIN productos p ON p.id = v.producto_id
      JOIN almacenes a ON a.id = v.almacen_id
      LEFT JOIN clientes c ON c.id = v.cliente_id
      ${where}
      ORDER BY v.fecha DESC, v.numero DESC
      LIMIT 500
    `, params);
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/ventas — registra la venta y descuenta stock
router.post('/', async (req, res) => {
  const client = await db.getClient();
  try {
    await client.query('BEGIN');

    const {
      almacen_id, cliente_id, cliente_nombre,
      producto_id, paquetes = 0, unidades_sueltas = 0,
      total_unidades, precio_unitario,
      con_factura = false, forma_pago = 'CONTADO',
      moneda = 'PEN', num_documento, observaciones
    } = req.body;

    const subtotal = total_unidades * precio_unitario;
    const igv      = con_factura ? subtotal * 0.18 : 0;
    const total    = subtotal + igv;

    // Verificar stock disponible (bloqueo optimista)
    const { rows: [stock] } = await client.query(
      'SELECT stock_unidades FROM productos WHERE id = $1 FOR UPDATE',
      [producto_id]
    );
    if (!stock) throw new Error('Producto no encontrado');

    // Registrar la venta
    const { rows } = await client.query(`
      INSERT INTO ventas (
        almacen_id, cliente_id, cliente_nombre,
        producto_id, paquetes, unidades_sueltas,
        total_unidades, precio_unitario, subtotal,
        con_factura, igv, total, forma_pago,
        moneda, num_documento, observaciones
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
      RETURNING *
    `, [
      almacen_id, cliente_id || null, cliente_nombre,
      producto_id, paquetes, unidades_sueltas,
      total_unidades, precio_unitario, subtotal.toFixed(2),
      con_factura, igv.toFixed(2), total.toFixed(2),
      forma_pago, moneda, num_documento, observaciones
    ]);

    // Descontar stock
    await client.query(`
      UPDATE productos
      SET stock_unidades = stock_unidades - $1,
          stock_paquetes = GREATEST(
            FLOOR((stock_unidades - $1) / und_por_paquete), 0
          )
      WHERE id = $2
    `, [total_unidades, producto_id]);

    await client.query('COMMIT');
    res.status(201).json(rows[0]);

  } catch (err) {
    await client.query('ROLLBACK');
    res.status(400).json({ error: err.message });
  } finally {
    client.release();
  }
});

module.exports = router;