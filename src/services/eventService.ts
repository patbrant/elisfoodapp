import * as Crypto from 'expo-crypto';
import { getDb } from '../db';
import type { Event, EventStatus } from '../domain/types';

export class EventAlreadyExistsError extends Error {
  constructor(date: string, slotId: string) {
    super(`Event already exists for slot ${slotId} on ${date}`);
    this.name = 'EventAlreadyExistsError';
  }
}

export async function createEvent(
  date: string,
  slotId: string,
  status: EventStatus,
  note?: string | null,
): Promise<Event> {
  const db = await getDb();

  const existing = await db.getFirstAsync<{ one: number }>(
    'SELECT 1 AS one FROM events WHERE date = ? AND slot_id = ?',
    [date, slotId],
  );
  if (existing) throw new EventAlreadyExistsError(date, slotId);

  const id = Crypto.randomUUID();
  const createdAt = new Date().toISOString();
  const cleanNote = note?.trim() || null;

  try {
    await db.runAsync(
      'INSERT INTO events (id, date, slot_id, status, created_at, note) VALUES (?, ?, ?, ?, ?, ?)',
      [id, date, slotId, status, createdAt, cleanNote],
    );
  } catch (err) {
    if (err instanceof Error && /UNIQUE constraint failed/i.test(err.message)) {
      throw new EventAlreadyExistsError(date, slotId);
    }
    throw err;
  }

  // TODO(slice-5): notificationService.cancelSlotNotifications(date, slotId)

  return {
    id,
    date,
    slotId,
    status,
    createdAt,
    note: cleanNote,
  };
}
