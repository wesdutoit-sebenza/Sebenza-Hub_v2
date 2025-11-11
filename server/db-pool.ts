import pg from "pg";

export const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 30000, // Increased from 10s to 30s for Neon cold starts
  statement_timeout: 30000, // 30 second statement timeout
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle database client', err);
});

export default pool;
