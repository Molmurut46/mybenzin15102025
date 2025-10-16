import { drizzle } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client';
import * as schema from '@/db/schema';

let dbInstance: ReturnType<typeof drizzle> | null = null;

function getDb() {
  if (!dbInstance) {
    const url = process.env.TURSO_CONNECTION_URL;
    const authToken = process.env.TURSO_AUTH_TOKEN;

    // Во время сборки (build time) возвращаем заглушку
    if (!url || !authToken || url === 'undefined' || authToken === 'undefined') {
      console.warn('⚠️ Database credentials not available during build. Using mock database instance.');
      // Возвращаем mock объект для успешной сборки
      return {} as ReturnType<typeof drizzle>;
    }

    const client = createClient({
      url,
      authToken,
    });

    dbInstance = drizzle(client, { schema });
  }
  return dbInstance;
}

export const db = new Proxy({} as ReturnType<typeof drizzle>, {
  get: (target, prop) => {
    const instance = getDb();
    return instance[prop as keyof typeof instance];
  }
});

export type Database = ReturnType<typeof drizzle>;