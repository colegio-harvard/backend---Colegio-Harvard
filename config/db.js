const { Pool } = require('pg');
require('dotenv').config();

// --- Pool de conexiones pg ---
// LOCAL: conecta a PostgreSQL en localhost (db_colegio_fernando)
// RAILWAY: conecta a la DB de Railway usando las variables de su dashboard
const pool = new Pool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT,
});

// Forzar UTC en cada conexion para consistencia con Prisma
pool.on('connect', (client) => {
  client.query("SET timezone = 'UTC'");
});

module.exports = pool;
