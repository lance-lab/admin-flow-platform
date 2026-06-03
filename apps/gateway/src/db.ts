import pg from 'pg';
import { config } from './config.js';

export const pool = new pg.Pool({
  connectionString: config.databaseUrl
});

export async function query<T extends pg.QueryResultRow>(sql: string, params: unknown[] = []) {
  const result = await pool.query<T>(sql, params);
  return result.rows;
}
