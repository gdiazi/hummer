require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool(
  process.env.DATABASE_URL
    ? {
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false },
      }
    : {
        host:     process.env.DB_HOST     || 'localhost',
        port:     process.env.DB_PORT     || 5432,
        database: process.env.DB_NAME     || 'hummer_db',
        user:     process.env.DB_USER     || 'hummer_user',
        password: process.env.DB_PASSWORD || 'hummer2024',
      }
);

pool.on('connect', () => console.log('✅ PostgreSQL conectado'));
pool.on('error',   err => console.error('❌ Error PostgreSQL:', err.message));

module.exports = {
  query:     (text, params) => pool.query(text, params),
  getClient: ()             => pool.connect(),
};