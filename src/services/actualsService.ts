import * as Crypto from 'expo-crypto';
import { getDb } from '../db';
import { type DayActualRow, mapDayActual } from '../db/queries';
import type { DayActual } from '../domain/types';
import { getLocalHouseholdContext } from './authService';
import { drainOutbox, enqueueOutbox } from './syncService';

export async function setActualMl(
  date: string,
  slotId: string,
  itemKey: string,
  componentId: string,
  ml: number,
): Promise<DayActual> {
  const db = await getDb();
  const clamped = Math.max(0, Math.floor(ml));
  const updatedAt = new Date().toISOString();
  const id = Crypto.randomUUID();

  await db.runAsync(
    `INSERT INTO day_actuals (id, date, slot_id, item_key, component_id, ml, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(date, slot_id, item_key) DO UPDATE SET ml = excluded.ml, updated_at = excluded.updated_at`,
    [id, date, slotId, itemKey, componentId, clamped, updatedAt],
  );

  const row = await db.getFirstAsync<DayActualRow>(
    'SELECT * FROM day_actuals WHERE date = ? AND slot_id = ? AND item_key = ?',
    [date, slotId, itemKey],
  );
  if (!row) throw new Error('day_actual missing after upsert');
  const actual = mapDayActual(row);

  await enqueueOutbox('day_actuals', actual.id, 'upsert', {
    id: actual.id, date, slot_id: slotId, item_key: itemKey, component_id: componentId, ml: clamped, updated_at: updatedAt,
  });
  getLocalHouseholdContext().then((ctx) => { if (ctx) drainOutbox(ctx).catch(console.warn); });

  return actual;
}

export async function removeActual(date: string, slotId: string, itemKey: string): Promise<void> {
  const db = await getDb();
  const existing = await db.getFirstAsync<{ id: string }>(
    'SELECT id FROM day_actuals WHERE date = ? AND slot_id = ? AND item_key = ?',
    [date, slotId, itemKey],
  );
  if (existing) {
    await enqueueOutbox('day_actuals', existing.id, 'delete', { id: existing.id });
  }
  await db.runAsync(
    'DELETE FROM day_actuals WHERE date = ? AND slot_id = ? AND item_key = ?',
    [date, slotId, itemKey],
  );
  getLocalHouseholdContext().then((ctx) => { if (ctx) drainOutbox(ctx).catch(console.warn); });
}

export async function listActuals(date: string, slotId: string): Promise<DayActual[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<DayActualRow>(
    'SELECT * FROM day_actuals WHERE date = ? AND slot_id = ?',
    [date, slotId],
  );
  return rows.map(mapDayActual);
}

export async function listActualsByDate(date: string): Promise<DayActual[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<DayActualRow>(
    'SELECT * FROM day_actuals WHERE date = ?',
    [date],
  );
  return rows.map(mapDayActual);
}
