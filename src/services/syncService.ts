import * as Crypto from 'expo-crypto';
import type { SQLiteBindParams } from 'expo-sqlite';
import { DeviceEventEmitter } from 'react-native';
import { getDb } from '../db';
import { getSupabaseClient } from '../db/supabase';
import { readSyncMeta } from './authService';
import type { HouseholdContext } from './authService';

export const SYNC_PULLED_EVENT = 'sync:pulled';

type SyncTable =
  | 'plan_versions'
  | 'slots'
  | 'components'
  | 'meal_recipe_items'
  | 'events'
  | 'day_actuals'
  | 'day_overrides';

type OutboxOperation = 'upsert' | 'delete';

// ---- Outbox ----

// Module-level cooldown prevents repeated drain attempts after a connection-level error.
let _drainCooldownUntil = 0;

export async function enqueueOutbox(
  tableName: SyncTable,
  rowId: string,
  operation: OutboxOperation,
  payload: Record<string, unknown>,
): Promise<void> {
  const db = await getDb();
  const id = Crypto.randomUUID();
  const payloadJson = JSON.stringify(payload);
  const createdAt = new Date().toISOString();
  await db.runAsync(
    `INSERT INTO sync_outbox (id, table_name, row_id, operation, payload, created_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(table_name, row_id, operation) DO UPDATE SET payload = excluded.payload, created_at = excluded.created_at`,
    [id, tableName, rowId, operation, payloadJson, createdAt],
  );
}

export async function drainOutbox(context: HouseholdContext): Promise<void> {
  if (Date.now() < _drainCooldownUntil) {
    console.log('[outbox] skipping drain — cooldown active');
    return;
  }

  const db = await getDb();
  const supabase = getSupabaseClient();
  const rows = await db.getAllAsync<{
    id: string;
    table_name: string;
    row_id: string;
    operation: string;
    payload: string;
  }>('SELECT * FROM sync_outbox ORDER BY created_at ASC LIMIT 100');

  if (rows.length === 0) return;
  console.log(`[outbox] draining ${rows.length} entries`);

  for (const row of rows) {
    const payload = JSON.parse(row.payload) as Record<string, unknown>;
    const table = row.table_name as SyncTable;

    try {
      if (row.operation === 'upsert') {
        const remotePayload = { ...payload, household_id: context.householdId };
        const { error } = await supabase.from(table).upsert(remotePayload, { onConflict: 'id' });
        if (error) {
          if (isRetryable(error.code)) {
            _drainCooldownUntil = Date.now() + 30_000;
            console.warn(`[outbox] ${table} retryable error — pausing 30s: ${error.code} ${error.message}`);
            break;
          }
          console.warn(`[outbox] ${table} dropped (non-retryable): ${error.code} ${error.message}`);
        } else {
          console.log(`[outbox] ${table} pushed ok: ${row.row_id}`);
        }
      } else {
        const { error } = await supabase.from(table).delete().eq('id', row.row_id);
        if (error && isRetryable(error.code)) {
          _drainCooldownUntil = Date.now() + 30_000;
          console.warn(`[outbox] ${table} delete retryable error — pausing 30s: ${error.code} ${error.message}`);
          break;
        }
        if (error) console.warn(`[outbox] ${table} delete dropped: ${error.code} ${error.message}`);
        else console.log(`[outbox] ${table} deleted ok: ${row.row_id}`);
      }
    } catch (e) {
      _drainCooldownUntil = Date.now() + 30_000;
      console.warn('[outbox] network error — pausing 30s:', e);
      break;
    }

    await db.runAsync('DELETE FROM sync_outbox WHERE id = ?', [row.id]);
  }
}

function isRetryable(code: string | undefined): boolean {
  if (!code) return true;
  // 23xxx = constraint violation, 42xxx = permission/syntax — drop the entry
  // 25xxx = transaction aborted (connection-level) — pause and retry later
  const dropErrors = ['23', '42'];
  return !dropErrors.some((prefix) => code.startsWith(prefix));
}

// ---- Pull ----

// For these tables Supabase is the single source of truth. Local rows whose IDs
// are absent from the remote response are stale (deleted or never pushed) and must
// be removed so they don't surface in the UI.
const PLAN_TABLES: ReadonlySet<SyncTable> = new Set([
  'plan_versions',
  'slots',
  'components',
  'meal_recipe_items',
]);

const LOCAL_UPSERT_SQL: Record<SyncTable, string> = {
  plan_versions:
    'INSERT INTO plan_versions (id, name, valid_from, created_at) VALUES (?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET name=excluded.name, valid_from=excluded.valid_from',
  slots:
    'INSERT INTO slots (id, plan_version_id, type, title, info, time_minutes, sort_order, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET type=excluded.type, title=excluded.title, info=excluded.info, time_minutes=excluded.time_minutes, sort_order=excluded.sort_order',
  components:
    'INSERT INTO components (id, name, category) VALUES (?, ?, ?) ON CONFLICT(id) DO UPDATE SET name=excluded.name, category=excluded.category',
  meal_recipe_items:
    'INSERT INTO meal_recipe_items (id, slot_id, component_id, ml, sort_order, delivery_form) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET ml=excluded.ml, sort_order=excluded.sort_order, delivery_form=excluded.delivery_form',
  events:
    'INSERT INTO events (id, date, slot_id, status, created_at, note) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(date, slot_id) DO NOTHING',
  day_actuals:
    'INSERT INTO day_actuals (id, date, slot_id, item_key, component_id, ml, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT(date, slot_id, item_key) DO UPDATE SET ml=excluded.ml, updated_at=excluded.updated_at WHERE excluded.updated_at > day_actuals.updated_at',
  day_overrides:
    'INSERT INTO day_overrides (id, date, slot_id, override_json, created_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(date, slot_id) DO UPDATE SET override_json=excluded.override_json',
};

type RemoteRow = Record<string, unknown>;
type BindVal = string | number | null;

function v(x: unknown): BindVal { return (x ?? null) as BindVal; }

function rowToParams(table: SyncTable, r: RemoteRow): SQLiteBindParams {
  switch (table) {
    case 'plan_versions':
      return [v(r.id), v(r.name), v(r.valid_from), v(r.created_at)];
    case 'slots':
      return [v(r.id), v(r.plan_version_id), v(r.type), v(r.title), v(r.info), v(r.time_minutes), v(r.sort_order), v(r.created_at)];
    case 'components':
      return [v(r.id), v(r.name), v(r.category)];
    case 'meal_recipe_items':
      return [v(r.id), v(r.slot_id), v(r.component_id), v(r.ml), v(r.sort_order), v(r.delivery_form)];
    case 'events':
      return [v(r.id), v(r.date), v(r.slot_id), v(r.status), v(r.created_at), v(r.note)];
    case 'day_actuals':
      return [v(r.id), v(r.date), v(r.slot_id), v(r.item_key), v(r.component_id), v(r.ml), v(r.updated_at)];
    case 'day_overrides':
      return [v(r.id), v(r.date), v(r.slot_id), v(r.override_json), v(r.created_at)];
  }
}

export async function pullAll(context: HouseholdContext): Promise<void> {
  const supabase = getSupabaseClient();
  const { data: { session } } = await supabase.auth.getSession();
  console.log(`[pullAll] uid=${session?.user?.id ?? 'null'} household=${context.householdId}`);

  const db = await getDb();
  const tables: SyncTable[] = [
    'plan_versions',
    'slots',
    'components',
    'meal_recipe_items',
    'events',
    'day_actuals',
    'day_overrides',
  ];

  for (const table of tables) {
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .eq('household_id', context.householdId);

    if (error) {
      console.warn(`[pullAll] ${table}: ${error.code} ${error.message}`);
      continue;
    }
    if (!data) continue;
    console.log(`[pullAll] ${table}: ${data.length} rows`);

    const sql = LOCAL_UPSERT_SQL[table];
    let upserted = 0;
    for (const row of data as RemoteRow[]) {
      try {
        await db.runAsync(sql, rowToParams(table, row));
        upserted++;
      } catch (e) {
        console.warn(`[pullAll] ${table} upsert failed:`, e);
      }
    }
    if (upserted !== data.length) {
      console.warn(`[pullAll] ${table}: only ${upserted}/${data.length} rows upserted`);
    }

    // Remove local rows that no longer exist in Supabase (plan tables only).
    // FK CASCADE on slots handles dependent meal_recipe_items/events/actuals automatically.
    if (PLAN_TABLES.has(table)) {
      const remoteIds = (data as RemoteRow[])
        .map((r) => r.id)
        .filter((id): id is string => typeof id === 'string');
      if (remoteIds.length > 0) {
        const placeholders = remoteIds.map(() => '?').join(',');
        const deleted = await db.runAsync(
          `DELETE FROM ${table} WHERE id NOT IN (${placeholders})`,
          remoteIds,
        );
        if (deleted.changes > 0) {
          console.log(`[pullAll] ${table}: removed ${deleted.changes} stale local rows`);
        }
      } else {
        const deleted = await db.runAsync(`DELETE FROM ${table}`);
        if (deleted.changes > 0) {
          console.log(`[pullAll] ${table}: remote empty — cleared ${deleted.changes} local rows`);
        }
      }
    }
  }

  const now = new Date().toISOString();
  await db.runAsync(
    'INSERT INTO sync_meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    ['last_pull_at', now],
  );

  DeviceEventEmitter.emit(SYNC_PULLED_EVENT);
}

// ---- Realtime ----

export function subscribeToHousehold(
  context: HouseholdContext,
  onError: (err: Error) => void,
): () => void {
  const supabase = getSupabaseClient();
  const tables: SyncTable[] = [
    'events',
    'day_actuals',
    'day_overrides',
    'plan_versions',
    'slots',
    'components',
    'meal_recipe_items',
  ];

  const channel = supabase.channel(`household:${context.householdId}`);

  for (const table of tables) {
    channel.on(
      'postgres_changes' as Parameters<typeof channel.on>[0],
      {
        event: '*',
        schema: 'public',
        table,
        filter: `household_id=eq.${context.householdId}`,
      },
      (payload: { eventType: string; new: RemoteRow; old: { id?: string } }) => {
        handleRealtimeChange(table, payload).catch(onError);
      },
    );
  }

  channel.subscribe((status: string) => {
    if (status === 'CHANNEL_ERROR') {
      onError(new Error('Realtime channel error'));
    }
  });

  return () => { supabase.removeChannel(channel); };
}

async function handleRealtimeChange(
  table: SyncTable,
  payload: { eventType: string; new: RemoteRow; old: { id?: string } },
): Promise<void> {
  const db = await getDb();
  const { eventType, new: newRow, old: oldRow } = payload;

  if (eventType === 'INSERT' || eventType === 'UPDATE') {
    const sql = LOCAL_UPSERT_SQL[table];
    const params = rowToParams(table, newRow);
    await db.runAsync(sql, params);
  } else if (eventType === 'DELETE' && oldRow.id) {
    await db.runAsync(`DELETE FROM ${table} WHERE id = ?`, [oldRow.id]);
  }
}

// ---- Init ----

export async function initSync(context: HouseholdContext): Promise<() => void> {
  console.log('[initSync] starting, role=', context.role);
  const supabase = getSupabaseClient();
  await supabase.auth.getSession();
  await pullAll(context).catch((e) => console.warn('[initSync] pullAll error:', e));
  const unsubscribe = subscribeToHousehold(context, (e) => console.warn('[realtime]', e));
  return unsubscribe;
}

// ---- Re-export context loader for convenience ----
export { readSyncMeta };
