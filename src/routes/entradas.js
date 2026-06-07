// src/routes/entradas.js
const router = require('express').Router();
const db     = require('../config/db');

// GET /api/entradas
router.get('/', async (req, res) => {
  const { desde, hasta, producto_id } = req.query;
  let where  = 'WHERE 1=1';
  const params = [];
  if (desde)       { params.push(desde);       where += ` AND e.fecha >= $${params.length}`; }
  if (hasta)       { params.push(hasta);        where += ` AND e.fecha <= $${params.length}`; }
  if (producto_id) { params.push(producto_id);  where += ` AND e.producto_id = $${params.length}`; }
  try {
    const { rows } = await db.query(`
      SELECT e.*,
             p.codigo,
             p.descripcion,
             p.und_por_paquete,
             a.nombre AS almacen,
             pr.nombre AS proveedor
      FROM entradas e
      JOIN productos  p  ON p.id  = e.producto_id
      JOIN almacenes  a  ON a.id  = e.almacen_id
      LEFT JOIN proveedores pr ON pr.id = e.proveedor_id
      ${where}
      ORDER BY e.fecha DESC, e.numero DESC
      LIMIT 200
    `, params);
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/entradas — registra la entrada y actualiza stock
router.post('/', async (req, res) => {
  const client = await db.getClient();
  try {
    await client.query('BEGIN');

    const {
      almacen_id, producto_id, proveedor_id,
      paquetes, unidades_sueltas = 0,
      precio_unitario, con_factura = false,
      num_documento, observaciones
    } = req.body;

    // Obtener und_por_paquete del producto
    const { rows: [prod] } = await client.query(
      'SELECT und_por_paquete FROM productos WHERE id = $1',
      [producto_id]
    );
    if (!prod) throw new Error('Producto no encontrado');

    const upq           = prod.und_por_paquete;
    const total_und     = paquetes * upq + unidades_sueltas;
    const subtotal      = total_und * precio_unitario;
    const igv           = con_factura ? subtotal * 0.18 : 0;
    const total         = subtotal + igv;

    // Insertar entrada
    const { rows } = await client.query(`
      INSERT INTO entradas (
        almacen_id, producto_id, proveedor_id,
        paquetes, unidades_sueltas, total_unidades,
        precio_unitario, subtotal, con_factura,
        igv, total, num_documento, observaciones
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
      RETURNING *
    `, [
      almacen_id, producto_id, proveedor_id || null,
      paquetes, unidades_sueltas, total_und,
      precio_unitario, subtotal.toFixed(2), con_factura,
      igv.toFixed(2), total.toFixed(2),
      num_documento, observaciones
    ]);

    // Actualizar stock del producto
    await client.query(`
      UPDATE productos
      SET stock_unidades = stock_unidades + $1,
          stock_paquetes = FLOOR((stock_unidades + $1) / und_por_paquete)
      WHERE id = $2
    `, [total_und, producto_id]);

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