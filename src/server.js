require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const morgan  = require('morgan');
const db      = require('./config/db');

const app = express();

app.use(cors());
app.use(morgan('dev'));
app.use(express.json());

app.get('/', (req, res) => {
  res.json({ sistema: 'Grupo Hummer S.A.C.', estado: 'OK' });
});

app.use('/api/auth',      require('./routes/auth'));
app.use('/api/productos', require('./routes/productos'));
app.use('/api/clientes',  require('./routes/clientes'));
app.use('/api/entradas',  require('./routes/entradas'));
app.use('/api/ventas',    require('./routes/ventas'));
// app.use('/api/facturas',  require('./routes/facturas'));
// app.use('/api/guias',     require('./routes/guias'));

app.get('/api/almacenes', async (req, res) => {
  try {
    const { rows } = await db.query('SELECT * FROM almacenes ORDER BY nombre');
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/proveedores', async (req, res) => {
  try {
    const { rows } = await db.query('SELECT * FROM proveedores ORDER BY nombre');
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/dashboard', async (req, res) => {
  try {
    const [prod, ventas, stock, neg, bajo] = await Promise.all([
      db.query('SELECT COUNT(*) FROM productos WHERE activo = TRUE'),
      db.query('SELECT COUNT(*) FROM ventas'),
      db.query('SELECT COALESCE(SUM(stock_unidades * precio_venta),0) AS total FROM productos WHERE activo = TRUE'),
      db.query('SELECT COUNT(*) FROM productos WHERE stock_unidades < 0'),
      db.query('SELECT COUNT(*) FROM productos WHERE stock_paquetes <= 2 AND stock_unidades >= 0'),
    ]);
    res.json({
      total_productos: parseInt(prod.rows[0].count),
      total_ventas:    parseInt(ventas.rows[0].count),
      valor_stock:     parseFloat(stock.rows[0].total).toFixed(2),
      stock_negativo:  parseInt(neg.rows[0].count),
      stock_bajo:      parseInt(bajo.rows[0].count),
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.use((req, res) => {
  res.status(404).json({ error: 'Ruta no encontrada: ' + req.path });
});

app.use((err, req, res, next) => {
  console.error('Error:', err.message);
  res.status(500).json({ error: err.message });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('Servidor Hummer SAC corriendo en puerto ' + PORT);
});