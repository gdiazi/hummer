// ============================================================
// GRUPO HUMMER S.A.C. — Base de datos PostgreSQL
// Archivo: database/init.js
// Uso:     node database/init.js
// ============================================================

require('dotenv').config();
const { Pool } = require('pg');

// ── Conexión ──────────────────────────────────────────────
const pool = new Pool({
  host:     process.env.DB_HOST     || 'localhost',
  port:     process.env.DB_PORT     || 5432,
  database: process.env.DB_NAME     || 'hummer_db',
  user:     process.env.DB_USER     || 'postgres',
  password: process.env.DB_PASSWORD || 'guille1234',
});

// ── Helper para ejecutar SQL con log ─────────────────────
async function run(client, sql, nombre) {
  try {
    await client.query(sql);
    console.log(`  ✅  ${nombre}`);
  } catch (err) {
    console.error(`  ❌  ${nombre} → ${err.message}`);
    throw err;
  }
}

// ── Script principal ──────────────────────────────────────
async function init() {
  const client = await pool.connect();

  try {
    console.log('\n╔══════════════════════════════════════════╗');
    console.log('║  GRUPO HUMMER S.A.C. — Init base de datos  ║');
    console.log('╚══════════════════════════════════════════╝\n');
    console.log('🔌 Conectado a PostgreSQL\n');
    console.log('── Creando tablas en orden correcto... ──\n');

    // ════════════════════════════════════
    // 1. EXTENSIONES
    // ════════════════════════════════════
    await run(client, `
      CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
    `, 'extensión uuid-ossp');

    // ════════════════════════════════════
    // 2. ALMACENES (sin dependencias)
    // ════════════════════════════════════
    await run(client, `
      CREATE TABLE IF NOT EXISTS almacenes (
        id         SERIAL PRIMARY KEY,
        nombre     VARCHAR(100) NOT NULL,
        direccion  VARCHAR(200),
        ciudad     VARCHAR(80)  DEFAULT 'Lima',
        activo     BOOLEAN      DEFAULT TRUE,
        created_at TIMESTAMPTZ  DEFAULT NOW()
      );
    `, 'tabla almacenes');

    // ════════════════════════════════════
    // 3. PROVEEDORES (sin dependencias)
    // ════════════════════════════════════
    await run(client, `
      CREATE TABLE IF NOT EXISTS proveedores (
        id      SERIAL PRIMARY KEY,
        nombre  VARCHAR(100) NOT NULL,
        ruc     VARCHAR(11),
        pais    VARCHAR(50)  DEFAULT 'Perú',
        activo  BOOLEAN      DEFAULT TRUE
      );
    `, 'tabla proveedores');

    // ════════════════════════════════════
    // 4. CLIENTES (sin dependencias)
    // ════════════════════════════════════
    await run(client, `
      CREATE TABLE IF NOT EXISTS clientes (
        id         SERIAL PRIMARY KEY,
        nombre     VARCHAR(200) NOT NULL,
        ruc_dni    VARCHAR(11),
        direccion  VARCHAR(300),
        telefono   VARCHAR(20),
        email      VARCHAR(100),
        tipo       VARCHAR(20)  DEFAULT 'EMPRESA',
        activo     BOOLEAN      DEFAULT TRUE,
        created_at TIMESTAMPTZ  DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_clientes_nombre
        ON clientes(nombre);
    `, 'tabla clientes');

    // ════════════════════════════════════
    // 5. PRODUCTOS (depende de proveedores)
    // ════════════════════════════════════
    await run(client, `
      CREATE TABLE IF NOT EXISTS productos (
        id              SERIAL PRIMARY KEY,
        codigo          VARCHAR(20)   UNIQUE NOT NULL,
        descripcion     VARCHAR(150)  NOT NULL,
        proveedor_id    INT           REFERENCES proveedores(id),
        und_por_paquete INT           NOT NULL DEFAULT 1,
        precio_venta    NUMERIC(10,2) NOT NULL DEFAULT 0,
        stock_paquetes  INT           NOT NULL DEFAULT 0,
        stock_unidades  INT           NOT NULL DEFAULT 0,
        activo          BOOLEAN       DEFAULT TRUE,
        created_at      TIMESTAMPTZ   DEFAULT NOW(),
        updated_at      TIMESTAMPTZ   DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_productos_codigo
        ON productos(codigo);
      CREATE INDEX IF NOT EXISTS idx_productos_activo
        ON productos(activo);
    `, 'tabla productos');

    // ════════════════════════════════════
    // 6. ENTRADAS (depende de almacenes + productos + proveedores)
    // ════════════════════════════════════
    await run(client, `
      CREATE SEQUENCE IF NOT EXISTS seq_entradas START 58;

      CREATE TABLE IF NOT EXISTS entradas (
        id               SERIAL PRIMARY KEY,
        numero           INT           UNIQUE NOT NULL
                         DEFAULT nextval('seq_entradas'),
        fecha            DATE          NOT NULL DEFAULT CURRENT_DATE,
        almacen_id       INT           REFERENCES almacenes(id),
        producto_id      INT           REFERENCES productos(id),
        proveedor_id     INT           REFERENCES proveedores(id),
        paquetes         INT           NOT NULL DEFAULT 0,
        unidades_sueltas INT           NOT NULL DEFAULT 0,
        total_unidades   INT           NOT NULL DEFAULT 0,
        precio_unitario  NUMERIC(10,2) NOT NULL DEFAULT 0,
        subtotal         NUMERIC(12,2),
        con_factura      BOOLEAN       DEFAULT FALSE,
        igv              NUMERIC(12,2) DEFAULT 0,
        total            NUMERIC(12,2),
        num_documento    VARCHAR(30),
        observaciones    TEXT,
        created_at       TIMESTAMPTZ   DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_entradas_fecha
        ON entradas(fecha DESC);
      CREATE INDEX IF NOT EXISTS idx_entradas_producto
        ON entradas(producto_id);
    `, 'tabla entradas + secuencia seq_entradas');

    // ════════════════════════════════════
    // 7. VENTAS (depende de almacenes + productos + clientes)
    // ════════════════════════════════════
    await run(client, `
      CREATE SEQUENCE IF NOT EXISTS seq_ventas START 32;

      CREATE TABLE IF NOT EXISTS ventas (
        id               SERIAL PRIMARY KEY,
        numero           INT           UNIQUE NOT NULL
                         DEFAULT nextval('seq_ventas'),
        fecha            DATE          NOT NULL DEFAULT CURRENT_DATE,
        almacen_id       INT           REFERENCES almacenes(id),
        cliente_id       INT           REFERENCES clientes(id),
        cliente_nombre   VARCHAR(200),
        producto_id      INT           REFERENCES productos(id),
        paquetes         INT           DEFAULT 0,
        unidades_sueltas INT           DEFAULT 0,
        total_unidades   INT           NOT NULL,
        precio_unitario  NUMERIC(10,2) NOT NULL,
        subtotal         NUMERIC(12,2) NOT NULL,
        con_factura      BOOLEAN       DEFAULT FALSE,
        igv              NUMERIC(12,2) DEFAULT 0,
        total            NUMERIC(12,2) NOT NULL,
        moneda           VARCHAR(3)    DEFAULT 'PEN',
        forma_pago       VARCHAR(20)   DEFAULT 'CONTADO'
                         CHECK (forma_pago IN ('CONTADO','FIADO','CREDITO')),
        num_documento    VARCHAR(30),
        observaciones    TEXT,
        created_at       TIMESTAMPTZ   DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_ventas_fecha
        ON ventas(fecha DESC);
      CREATE INDEX IF NOT EXISTS idx_ventas_cliente
        ON ventas(cliente_id);
      CREATE INDEX IF NOT EXISTS idx_ventas_forma_pago
        ON ventas(forma_pago);
    `, 'tabla ventas + secuencia seq_ventas');

    // ════════════════════════════════════
    // 8. DOCUMENTOS — facturas y boletas
    // ════════════════════════════════════
    await run(client, `
      CREATE SEQUENCE IF NOT EXISTS seq_facturas START 2390;
      CREATE SEQUENCE IF NOT EXISTS seq_boletas  START 1;

      CREATE TABLE IF NOT EXISTS documentos (
        id               SERIAL PRIMARY KEY,
        serie            VARCHAR(10)   NOT NULL,
        numero           INT           NOT NULL,
        tipo             VARCHAR(10)   NOT NULL
                         CHECK (tipo IN ('FACTURA','BOLETA')),
        fecha_emision    DATE          NOT NULL DEFAULT CURRENT_DATE,
        moneda           VARCHAR(3)    DEFAULT 'PEN',
        forma_pago       VARCHAR(30)   DEFAULT 'Contado',
        emisor_ruc       VARCHAR(11)   DEFAULT '20546845509',
        emisor_razon     TEXT          DEFAULT 'GRUPO HUMMER S.A.C.',
        emisor_dir       TEXT,
        cliente_nombre   VARCHAR(200)  NOT NULL,
        cliente_ruc_dni  VARCHAR(11),
        cliente_dir      TEXT,
        guia_remision    VARCHAR(20),
        orden_compra     VARCHAR(30),
        subtotal         NUMERIC(12,2) NOT NULL DEFAULT 0,
        igv              NUMERIC(12,2) NOT NULL DEFAULT 0,
        total            NUMERIC(12,2) NOT NULL DEFAULT 0,
        det_porcentaje   NUMERIC(5,2)  DEFAULT 4.00,
        det_monto        NUMERIC(12,2) DEFAULT 0,
        det_cta_bn       VARCHAR(20)   DEFAULT '00016104414',
        estado           VARCHAR(20)   DEFAULT 'PENDIENTE'
                         CHECK (estado IN (
                           'PENDIENTE','ENVIADO',
                           'ACEPTADO','RECHAZADO','ANULADO'
                         )),
        xml_firmado      TEXT,
        cdr_response     TEXT,
        hash_cpe         VARCHAR(100),
        observaciones    TEXT,
        anulado          BOOLEAN       DEFAULT FALSE,
        created_at       TIMESTAMPTZ   DEFAULT NOW(),
        updated_at       TIMESTAMPTZ   DEFAULT NOW(),
        UNIQUE(serie, numero)
      );

      CREATE INDEX IF NOT EXISTS idx_doc_tipo
        ON documentos(tipo);
      CREATE INDEX IF NOT EXISTS idx_doc_fecha
        ON documentos(fecha_emision DESC);
      CREATE INDEX IF NOT EXISTS idx_doc_cliente
        ON documentos(cliente_nombre);
      CREATE INDEX IF NOT EXISTS idx_doc_estado
        ON documentos(estado);
    `, 'tabla documentos + secuencias seq_facturas / seq_boletas');

    // ════════════════════════════════════
    // 9. DOCUMENTOS DETALLE (depende de documentos + productos)
    // ════════════════════════════════════
    await run(client, `
      CREATE TABLE IF NOT EXISTS documentos_detalle (
        id              SERIAL PRIMARY KEY,
        documento_id    INT           NOT NULL
                        REFERENCES documentos(id)
                        ON DELETE CASCADE,
        linea           INT           NOT NULL,
        producto_id     INT           REFERENCES productos(id),
        descripcion     TEXT          NOT NULL,
        unidad_medida   VARCHAR(20)   DEFAULT 'NIU',
        cantidad        NUMERIC(12,3) NOT NULL,
        precio_unitario NUMERIC(14,6) NOT NULL,
        subtotal        NUMERIC(12,2) NOT NULL,
        igv_linea       NUMERIC(12,2) DEFAULT 0,
        total_linea     NUMERIC(12,2) NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_det_documento
        ON documentos_detalle(documento_id);
    `, 'tabla documentos_detalle');

    // ════════════════════════════════════
    // 10. DOCUMENTOS CUOTAS (depende de documentos)
    // ════════════════════════════════════
    await run(client, `
      CREATE TABLE IF NOT EXISTS documentos_cuotas (
        id           SERIAL PRIMARY KEY,
        documento_id INT           NOT NULL
                     REFERENCES documentos(id)
                     ON DELETE CASCADE,
        numero_cuota INT           NOT NULL,
        fecha_venc   DATE          NOT NULL,
        monto        NUMERIC(12,2) NOT NULL
      );
    `, 'tabla documentos_cuotas');

    // ════════════════════════════════════
    // 11. GUIAS REMISION (depende de almacenes + documentos)
    // ════════════════════════════════════
    await run(client, `
      CREATE SEQUENCE IF NOT EXISTS seq_guias START 1488;

      CREATE TABLE IF NOT EXISTS guias_remision (
        id                  SERIAL PRIMARY KEY,
        serie               VARCHAR(10)   DEFAULT 'EG07',
        numero              INT           NOT NULL,
        fecha_traslado      DATE          NOT NULL DEFAULT CURRENT_DATE,
        motivo_codigo       VARCHAR(5)    DEFAULT '01',
        motivo_descripcion  VARCHAR(80)   DEFAULT 'Venta',
        destinatario_nombre VARCHAR(200),
        destinatario_ruc    VARCHAR(11),
        dir_destino         TEXT,
        almacen_id          INT           REFERENCES almacenes(id),
        dir_origen          TEXT,
        transportista       VARCHAR(150),
        transportista_dni   VARCHAR(8),
        placa_vehiculo      VARCHAR(10),
        peso_bruto          NUMERIC(10,3),
        unidad_peso         VARCHAR(10)   DEFAULT 'KGM',
        documento_id        INT           REFERENCES documentos(id),
        modalidad           VARCHAR(20)   DEFAULT 'Privado',
        anulado             BOOLEAN       DEFAULT FALSE,
        created_at          TIMESTAMPTZ   DEFAULT NOW(),
        UNIQUE(serie, numero)
      );

      CREATE INDEX IF NOT EXISTS idx_guias_fecha
        ON guias_remision(fecha_traslado DESC);
    `, 'tabla guias_remision + secuencia seq_guias');

    // ════════════════════════════════════
    // 12. GUIAS DETALLE (depende de guias_remision + productos)
    // ════════════════════════════════════
    await run(client, `
      CREATE TABLE IF NOT EXISTS guias_detalle (
        id            SERIAL PRIMARY KEY,
        guia_id       INT           NOT NULL
                      REFERENCES guias_remision(id)
                      ON DELETE CASCADE,
        producto_id   INT           REFERENCES productos(id),
        descripcion   TEXT          NOT NULL,
        cantidad      NUMERIC(12,3) NOT NULL,
        unidad_medida VARCHAR(20)   DEFAULT 'NIU',
        codigo_sunat  VARCHAR(20),
        codigo_gtin   VARCHAR(20)
      );
    `, 'tabla guias_detalle');

    // ════════════════════════════════════
    // 13. COBROS (depende de ventas + clientes)
    // ════════════════════════════════════
    await run(client, `
      CREATE TABLE IF NOT EXISTS cobros (
        id            SERIAL PRIMARY KEY,
        fecha         DATE          NOT NULL DEFAULT CURRENT_DATE,
        venta_id      INT           REFERENCES ventas(id),
        cliente_id    INT           REFERENCES clientes(id),
        total_fiado   NUMERIC(12,2) NOT NULL,
        monto_cobrado NUMERIC(12,2) NOT NULL,
        saldo         NUMERIC(12,2)
                      GENERATED ALWAYS AS
                      (total_fiado - monto_cobrado) STORED,
        estado        VARCHAR(15)
                      GENERATED ALWAYS AS (
                        CASE WHEN total_fiado - monto_cobrado <= 0
                             THEN 'PAGADO'
                             ELSE 'PENDIENTE'
                        END
                      ) STORED,
        forma_cobro   VARCHAR(30)   DEFAULT 'EFECTIVO',
        observaciones TEXT,
        created_at    TIMESTAMPTZ   DEFAULT NOW()
      );
    `, 'tabla cobros');

    // ════════════════════════════════════
    // 14. RESIDUOS (depende de almacenes)
    // ════════════════════════════════════
    await run(client, `
      CREATE TABLE IF NOT EXISTS residuos (
        id          SERIAL PRIMARY KEY,
        fecha       DATE        NOT NULL DEFAULT CURRENT_DATE,
        almacen_id  INT         REFERENCES almacenes(id),
        tipo        VARCHAR(30) DEFAULT 'RETAZOS'
                    CHECK (tipo IN ('RETAZOS','ASERRIN','VIRUTA','COSTANERAS')),
        accion      VARCHAR(20) DEFAULT 'VENTA'
                    CHECK (accion IN ('VENTA','DESCARTE')),
        cliente     VARCHAR(200),
        cantidad    NUMERIC(10,2) NOT NULL DEFAULT 0,
        unidad      VARCHAR(20)   DEFAULT 'KG',
        precio_unit NUMERIC(10,2) DEFAULT 0,
        total       NUMERIC(12,2) DEFAULT 0,
        con_factura BOOLEAN       DEFAULT FALSE,
        num_doc     VARCHAR(30),
        created_at  TIMESTAMPTZ   DEFAULT NOW()
      );
    `, 'tabla residuos');

    // ════════════════════════════════════
    // 15. TRIGGERS
    // ════════════════════════════════════
    await run(client, `
      CREATE OR REPLACE FUNCTION set_updated_at()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = NOW();
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;

      DROP TRIGGER IF EXISTS trg_productos_updated ON productos;
      CREATE TRIGGER trg_productos_updated
        BEFORE UPDATE ON productos
        FOR EACH ROW EXECUTE FUNCTION set_updated_at();

      DROP TRIGGER IF EXISTS trg_doc_updated ON documentos;
      CREATE TRIGGER trg_doc_updated
        BEFORE UPDATE ON documentos
        FOR EACH ROW EXECUTE FUNCTION set_updated_at();
    `, 'triggers updated_at');

    // ════════════════════════════════════
    // 16. VISTAS
    // ════════════════════════════════════
    await run(client, `
      CREATE OR REPLACE VIEW v_stock_actual AS
      SELECT
        p.id,
        p.codigo,
        p.descripcion,
        pr.nombre           AS proveedor,
        p.und_por_paquete,
        p.precio_venta,
        p.stock_paquetes,
        p.stock_unidades,
        ROUND(p.stock_unidades * p.precio_venta, 2) AS valor_stock,
        CASE
          WHEN p.stock_unidades < 0  THEN 'NEGATIVO'
          WHEN p.stock_paquetes <= 2 THEN 'BAJO'
          ELSE 'OK'
        END AS estado_stock
      FROM productos p
      LEFT JOIN proveedores pr ON pr.id = p.proveedor_id
      WHERE p.activo = TRUE
      ORDER BY valor_stock DESC;
    `, 'vista v_stock_actual');

    await run(client, `
      CREATE OR REPLACE VIEW v_ventas_resumen AS
      SELECT
        v.id,
        v.numero,
        v.fecha,
        a.nombre            AS almacen,
        COALESCE(v.cliente_nombre, c.nombre) AS cliente,
        p.codigo            AS producto_codigo,
        p.descripcion       AS producto_desc,
        v.total_unidades,
        v.subtotal,
        v.igv,
        v.total,
        v.forma_pago,
        v.moneda,
        v.num_documento
      FROM ventas v
      LEFT JOIN almacenes a ON a.id = v.almacen_id
      LEFT JOIN clientes  c ON c.id = v.cliente_id
      LEFT JOIN productos p ON p.id = v.producto_id
      ORDER BY v.fecha DESC, v.numero DESC;
    `, 'vista v_ventas_resumen');

    await run(client, `
      CREATE OR REPLACE VIEW v_documentos_resumen AS
      SELECT
        d.id,
        d.serie || '-' || LPAD(d.numero::TEXT, 4, '0') AS serie_completa,
        d.tipo,
        d.fecha_emision,
        d.cliente_nombre,
        d.cliente_ruc_dni,
        d.moneda,
        d.subtotal,
        d.igv,
        d.total,
        d.estado,
        d.forma_pago,
        d.guia_remision,
        d.anulado,
        d.created_at
      FROM documentos d
      WHERE d.anulado = FALSE
      ORDER BY d.fecha_emision DESC, d.numero DESC;
    `, 'vista v_documentos_resumen');

    // ════════════════════════════════════
    // 17. DATOS INICIALES
    // ════════════════════════════════════
    console.log('\n── Cargando datos iniciales... ──\n');

    await run(client, `
      INSERT INTO almacenes (nombre, direccion) VALUES
        ('CAMPOY (CALLE 14)', 'Calle 14 s/n, Campoy, San Juan de Lurigancho'),
        ('CAMPOY (CALLE 16)', 'Calle 16 s/n, Campoy, San Juan de Lurigancho'),
        ('CAMPOY (CALLE 22)', 'Calle 22 s/n, Campoy, San Juan de Lurigancho'),
        ('HUACHIPA (BRYSON)', 'Av. Bryson s/n, Huachipa, Lurigancho')
      ON CONFLICT DO NOTHING;
    `, '4 almacenes');

    await run(client, `
      INSERT INTO proveedores (nombre, ruc, pais) VALUES
        ('MASISA', '20100000001', 'Chile'),
        ('LLASA',  '20100000002', 'Chile'),
        ('APM',    '20100000003', 'Perú'),
        ('ANDINA', '20100000004', 'Perú')
      ON CONFLICT DO NOTHING;
    `, '4 proveedores');

    await run(client, `
      INSERT INTO clientes (nombre, ruc_dni, direccion) VALUES
        ('PRODUCTOS PARAISO DEL PERU S.A.C.',
         '20100014395',
         'AV. ARGENTINA 5495 PROV. CONST. DEL CALLAO, CALLAO'),
        ('PREVENCION & FABRICACION PERU S.A.C.',
         '20608963112',
         'CAL. 22 ASC. 3ERA ETAPA CAMPOY MZA. C LOTE. 4, LIMA'),
        ('RVR AGRO S.R.L.',
         '20535747424',
         'JR. LAS CASCADAS 325 URB. LA ENSENADA INT. 3, LA MOLINA'),
        ('AGROINDUSTRIAS FRUTOS DEL VALLE S.A.C.',
         '20613942026',
         'CAL. 22 ASC. 3ERA ETAPA CAMPOY MZA. C LOTE. 4, LIMA'),
        ('AGRICOLA DON RICARDO S.A.C.',
         '20293718220',
         'CAS. STA ROSA MZA. A LOTE. 77, ICA'),
        ('GRUPO ROMA PERU S.A.C.',
         '20611677503',
         'CAL. 22 ASC. 3ERA ETAPA CAMPOY MZA. C LOTE. 4, LIMA'),
        ('TITO DIPAZ ZAMIRA ROMINA',
         '10769670021',
         'PARQUE INDUSTRIAL NRO1 MZ G, ATE, LIMA'),
        ('DORIS',           NULL, NULL),
        ('SIXTO HUAMAN',    NULL, NULL),
        ('ANGEL VENTANILLA',NULL, NULL),
        ('FAVIAN',          NULL, NULL),
        ('FERNANDO CABRERA',NULL, NULL),
        ('YOJAN',           NULL, NULL),
        ('WARY',            NULL, NULL),
        ('ANTAURO',         NULL, NULL)
      ON CONFLICT DO NOTHING;
    `, '15 clientes');

    await run(client, `
      INSERT INTO productos
        (codigo, descripcion, proveedor_id, und_por_paquete,
         precio_venta, stock_paquetes, stock_unidades)
      VALUES
        ('M0',  '5/8X6X13',    1, 448, 13.00,  1,   408),
        ('M5',  '1X6X13',      1, 322, 20.80,  0,   -13),
        ('M6',  '1.5X5X13',    1, 224, 26.00, 36,  7590),
        ('M7',  '1X8X13',      1, 225, 27.73,  0,     0),
        ('M10', '1.5X6X13',    1, 224, 31.20, 11,  2424),
        ('M11', '5/8X8X13',    1, 350, 17.33, 12,  4161),
        ('M12', '1X4X8',       1, 630, 27.73,  1,   630),
        ('M13', '3/4X8X13',    1, 285, 20.80,  8,  2140),
        ('M14', '5/8X6X10.5',  1, 448, 10.50,  2,   896),
        ('M15', '3/4X6X13',    1, 399, 15.60, 16,  6384),
        ('M16', '3X3X13',      1, 196, 31.20,  1,   196),
        ('M17', '1.5X6X13',    1, 189, 31.20,  9,  1701),
        ('M18', '4X4X13',      1, 100, 55.47, 20,  1895),
        ('M21', '2X10X13',     1,  92, 69.33,  8,   629),
        ('M22', '3/4X10X13',   1, 228, 26.00,  6,  1368),
        ('M23', '2X8X13',      1, 115, 55.47,  5,   575),
        ('M28', '3/4X8X10.5',  1, 185, 16.80,  4,   740),
        ('M31', '1X10X10.5',   1, 176, 28.00, 12,  2105),
        ('M33', '1X2X10.5',    1,1012,  5.60,  1,  1012),
        ('M39', '1X4X13',      1, 572, 13.87,  2,  1144),
        ('M42', '1X6X10.5',    1, 322, 16.80, 23,  7406),
        ('M47', '1X8X10.5',    1, 225, 22.40,  1,   225),
        ('M55', '3/4X4X13',    1, 285, 10.40, 21,  5985),
        ('LL1', '3/4X6X13',    2, 420, 15.60,  1,   420),
        ('LL3', '5/8X6X13',    2, 420, 13.00,  3,  1260),
        ('A0',  '1X8X13',      4, 206, 27.73,  5,   959),
        ('P3',  '1X4X10.5',    3, 470, 69.33, 11,  5170)
      ON CONFLICT (codigo) DO NOTHING;
    `, '27 productos del Kardex');

    // ════════════════════════════════════
    // 18. VERIFICACIÓN FINAL
    // ════════════════════════════════════
    console.log('\n── Verificando tablas creadas... ──\n');

    const { rows: tablas } = await client.query(`
      SELECT tablename
      FROM pg_tables
      WHERE schemaname = 'public'
        AND tablename NOT LIKE 'pg_%'
      ORDER BY tablename;
    `);

    const { rows: conteos } = await client.query(`
      SELECT
        'almacenes'  AS tabla, COUNT(*) AS registros FROM almacenes
      UNION ALL SELECT 'proveedores', COUNT(*) FROM proveedores
      UNION ALL SELECT 'clientes',    COUNT(*) FROM clientes
      UNION ALL SELECT 'productos',   COUNT(*) FROM productos
      ORDER BY tabla;
    `);

    console.log('  Tablas creadas:');
    tablas.forEach(t => console.log(`    📋 ${t.tablename}`));

    console.log('\n  Registros iniciales:');
    conteos.forEach(r =>
      console.log(`    📊 ${r.tabla.padEnd(14)} ${r.registros} registros`)
    );

    // Mostrar top 5 productos por valor
    const { rows: topStock } = await client.query(`
      SELECT codigo, descripcion, stock_unidades, valor_stock, estado_stock
      FROM v_stock_actual
      LIMIT 5;
    `);

    console.log('\n  Top 5 productos por valor de stock:');
    topStock.forEach(p =>
      console.log(
        `    📦 ${p.codigo.padEnd(6)} ${p.descripcion.padEnd(15)} ` +
        `und: ${String(p.stock_unidades).padStart(5)} | ` +
        `S/ ${p.valor_stock} | ${p.estado_stock}`
      )
    );

    console.log('\n╔══════════════════════════════════════════╗');
    console.log('║  ✅  Base de datos lista para usar        ║');
    console.log('╚══════════════════════════════════════════╝\n');
    console.log('📌  Siguiente paso: npm run dev\n');

  } catch (err) {
    console.error('\n❌  Error al crear las tablas:', err.message);
    console.error('   Revisa que PostgreSQL esté corriendo y');
    console.error('   que las credenciales en .env sean correctas.\n');
    process.exit(1);

  } finally {
    client.release();
    await pool.end();
  }
}

// Ejecutar
init();