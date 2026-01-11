import { Pool, PoolClient } from 'pg';
import { environment } from '../environments/environment';

class DatabaseConnection {
  private pool: Pool;

  constructor() {
    this.pool = new Pool({
      host: environment.database.host,
      port: environment.database.port,
      user: environment.database.username,
      password: environment.database.password,
      database: environment.database.database,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });

    this.pool.on('error', (err: any) => {
      console.error('Unexpected error on idle client', err);
      process.exit(-1);
    });
  }

  async getClient(): Promise<PoolClient> {
    return this.pool.connect();
  }

  async query(text: string, params?: any[]): Promise<any> {
    const client = await this.getClient();
    try {
      const result = await client.query(text, params);
      return result;
    } finally {
      client.release();
    }
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}

export const db = new DatabaseConnection();