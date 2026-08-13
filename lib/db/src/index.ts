import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

let poolInstance: pg.Pool | null = null;
let dbInstance: NodePgDatabase<typeof schema> | null = null;

export function getPool(): pg.Pool {
  if (!poolInstance) {
    const dbUrl = process.env.DATABASE_URL || process.env.VITE_DATABASE_URL;
    if (!dbUrl) {
      throw new Error(
        "DATABASE_URL must be set. Did you forget to provision a database?",
      );
    }
    poolInstance = new Pool({
      connectionString: dbUrl,
      ssl: dbUrl.includes('supabase') || dbUrl.includes('amazonaws') || dbUrl.includes('neon')
        ? { rejectUnauthorized: false }
        : undefined,
      connectionTimeoutMillis: 10000,
      idleTimeoutMillis: 30000,
      max: 3, // Low pool size for serverless
    });
  }
  return poolInstance;
}

export function getDb(): NodePgDatabase<typeof schema> {
  if (!dbInstance) {
    dbInstance = drizzle(getPool(), { schema });
  }
  return dbInstance;
}

// Proxy exports to maintain backward compatibility AND strong types
export const pool = new Proxy({} as pg.Pool, {
  get(target, prop) {
    const instance = getPool();
    const val = Reflect.get(instance, prop);
    return typeof val === "function" ? val.bind(instance) : val;
  }
});

export const db = new Proxy({} as NodePgDatabase<typeof schema>, {
  get(target, prop) {
    const instance = getDb();
    const val = Reflect.get(instance, prop);
    return typeof val === "function" ? val.bind(instance) : val;
  }
});

export * from "./schema";
