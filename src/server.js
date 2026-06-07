// src/server.js
require('dotenv').config();
const express      = require('express');
const cors         = require('cors');
const morgan       = require('morgan');
// const path         = require('path');
const errorHandler = require('./middleware/errorHandler');

const app = express();

// ── Middleware global ──────────────────────────────────
app.use(cors());
app.use(morgan('dev'));
app.use(express.json());

// ── Rutas API ──────────────────────────────────────────
app.use('/api/auth',      require('./routes/auth'));
app.use('/api/productos', require('./routes/productos'));
app.use('/api/clientes',  require('./routes/clientes'));
app.use('/api/entradas',  require('./routes/entradas'));
app.use('/api/ventas',    require('./routes/ventas'));
// app.use('/api/facturas',  require('./routes/facturas'));
// app.use('/api/guias',     require('./routes/guias'));

// Rutas simples para catálogos
const db = require('./config/db');

app.get('/api/almacenes', async (req, res) => {
  const { rows } = await db.query(
    'SELECT * FROM almacenes WHERE activo = TRUE ORDER BY nombre'
  );
  res.json(rows);
});

app.get('/api/proveedores', async (req, res) => {
  const { rows } = await db.query(
    'SELECT * FROM proveedores WHERE activo = TRUE ORDER BY nombre'
  );
  res.json(rows);
});

// Dashboard KPIs
app.get('/api/dashboard', async (req, res) => {
  try {
    const [prod, ventas, stock, fac] = await Promise.all([
      db.query('SELECT COUNT(*) FROM productos WHERE activo = TRUE'),
      db.query('SELECT COUNT(*) FROM ventas'),
      db.query(`
        SELECT COALESCE(SUM(stock_unidades * precio_venta), 0) AS total
        FROM productos WHERE activo = TRUE
      `),
      db.query('SELECT COUNT(*) FROM documentos WHERE anulado = FALSE'),
    ]);
    res.json({
      total_productos: parseInt(prod.rows[0].count),
      total_ventas:    parseInt(ventas.rows[0].count),
      valor_stock:     parseFloat(stock.rows[0].total).toFixed(2),
      total_facturas:  parseInt(fac.rows[0].count),
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Ruta raíz ──────────────────────────────────────────
app.get('/', (req, res) => {
  res.json({
    sistema:  'Grupo Hummer S.A.C.',
    version:  '1.0.0',
    estado:   '✅ Backend funcionando',
    endpoints: [
      '/api/almacenes',
      '/api/proveedores',
      '/api/clientes',
      '/api/productos',
      '/api/entradas',
      '/api/ventas',
      '/api/facturas',
      '/api/guias',
      '/api/dashboard',
    ]
  });
});

// ── Servir frontend React (en producción) ─────────────
// app.use(express.static(path.join(__dirname, '../../frontend/dist')));
// app.get('*', (req, res) => {
//   if (!req.path.startsWith('/api')) {
//     res.sendFile(path.join(__dirname, '../../frontend/dist/index.html'));
//   }
// });

// ── Manejador de errores (siempre al final) ───────────
// app.use(errorHandler);

// ── Arrancar servidor ──────────────────────────────────
// const PORT = process.env.PORT || 3000;
// app.listen(PORT, () => {
//   console.log(`\n🚀  Servidor Grupo Hummer S.A.C.`);
//   console.log(`📡  http://localhost:${PORT}`);
//   console.log(`📊  API: http://localhost:${PORT}/api/productos`);
//   console.log(`🔑  Login: POST http://localhost:${PORT}/api/auth/login\n`);
// });