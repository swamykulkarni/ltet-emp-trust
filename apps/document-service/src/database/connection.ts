import { Pool, PoolClient } from 'pg';
import { environment } from '../environments/environment';

class Database {
  private pool: Pool;

  constructor() {
    this.pool = new Pool({
      host: environment.database.host,
      port: environment.database.port,
      database: environment.database.database,
      user: environment.database.username,
      password: environment.database.password,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });

    this.pool.on('error', (err) => {
      console.error('Unexpected error on idle client', err);
    });
  }

  async query(text: string, params?: any[]): Promise<any> {
    const start = Date.now();
    try {
      const res = await this.pool.query(text, params);
      const duration = Date.now() - start;
      
      if (!environment.production) {
        console.log('Executed query', { text, duration, rows: res.rowCount });
      }
      
      return res;
    } catch (error) {
      console.error('Database query error:', error);
      throw error;
    }
  }

  async getClient(): Promise<PoolClient> {
    return this.pool.connect();
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}

export const db = new Database();