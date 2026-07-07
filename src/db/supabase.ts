import 'react-native-url-polyfill/auto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getDb } from './index';

const SUPABASE_URL: string = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const SUPABASE_ANON_KEY: string = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

// Auth session storage backed by our existing SQLite sync_meta table.
// Avoids @react-native-async-storage which requires a native build and isn't
// available in Expo Go.
const sqliteStorage = {
  async getItem(key: string): Promise<string | null> {
    try {
      const db = await getDb();
      const row = await db.getFirstAsync<{ value: string }>(
        'SELECT value FROM sync_meta WHERE key = ?',
        [key],
      );
      return row?.value ?? null;
    } catch {
      return null;
    }
  },
  async setItem(key: string, value: string): Promise<void> {
    try {
      const db = await getDb();
      await db.runAsync(
        'INSERT INTO sync_meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
        [key, value],
      );
    } catch {
      // Silent fail — auth still works, session just won't persist across restarts
    }
  },
  async removeItem(key: string): Promise<void> {
    try {
      const db = await getDb();
      await db.runAsync('DELETE FROM sync_meta WHERE key = ?', [key]);
    } catch {
      // Silent fail
    }
  },
};

let _client: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient {
  if (!_client) {
    _client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        storage: sqliteStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    });
  }
  return _client;
}
