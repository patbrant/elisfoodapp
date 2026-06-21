import * as SQLite from 'expo-sqlite';
import { runMigrations } from './migrations';
import { seedIfEmpty } from './seed';

const DB_NAME = 'elisfood.db';

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

export function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = openAndInit();
  }
  return dbPromise;
}

async function openAndInit(): Promise<SQLite.SQLiteDatabase> {
  const db = await SQLite.openDatabaseAsync(DB_NAME);
  await db.execAsync('PRAGMA foreign_keys = ON');
  await runMigrations(db);
  await seedIfEmpty(db);

  if (__DEV__) {
    const tables = await db.getAllAsync<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
    );
    console.log('[db] tables:', tables.map((t) => t.name).join(', '));
  }

  return db;
}
