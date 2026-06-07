// src/config/db.js
require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  host:     process.env.DB_HOST     || 'localhost',
  port:     process.env.DB_PORT     || 5432,
  database: process.env.DB_NAME     || 'hummer_db',
  user:     process.env.DB_USER     || 'postgres',
  password: process.env.DB_PASSWORD || 'guille1234',
  max:                 10,
  idleTimeoutMillis:   30000,
  connectionTimeoutMillis: 2000,
});

pool.on('connect', () => {
  console.log('✅  PostgreSQL conectado');
});

pool.on('error', (err) => {
  console.error('❌  Error en pool PostgreSQL:', err.message);
});

module.exports = {
  query:     (text, params) => pool.query(text, params),
  getClient: ()             => pool.connect(),
};