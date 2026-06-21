import * as Crypto from 'expo-crypto';
import type { SQLiteDatabase } from 'expo-sqlite';
import { toLocalISODate } from '../domain/time';

const DEFAULT_MEAL_TIMES_HHMM: ReadonlyArray<string> = ['07:00', '11:00', '15:00', '18:15', '21:30'];

export async function seedIfEmpty(db: SQLiteDatabase): Promise<void> {
  const existing = await db.getFirstAsync<{ count: number }>('SELECT COUNT(*) AS count FROM plan_versions');
  if ((existing?.count ?? 0) > 0) {
    if (__DEV__) console.log('[seed] skipped (plan_versions not empty)');
    return;
  }

  const today = toLocalISODate(new Date());
  const nowIso = new Date().toISOString();
  const planVersionId = Crypto.randomUUID();

  await db.withTransactionAsync(async () => {
    await db.runAsync(
      'INSERT INTO plan_versions (id, name, valid_from, created_at) VALUES (?, ?, ?, ?)',
      [planVersionId, 'Aktuell', today, nowIso],
    );

    for (let i = 0; i < DEFAULT_MEAL_TIMES_HHMM.length; i++) {
      const hhmm = DEFAULT_MEAL_TIMES_HHMM[i];
      const [h, m] = hhmm.split(':').map(Number);
      const timeMinutes = h * 60 + m;
      await db.runAsync(
        'INSERT INTO slots (id, plan_version_id, type, title, info, time_minutes, sort_order, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [Crypto.randomUUID(), planVersionId, 'meal', `Mahlzeit ${hhmm}`, null, timeMinutes, i, nowIso],
      );
    }
  });

  if (__DEV__) {
    console.log(`[seed] inserted plan_version "Aktuell" + ${DEFAULT_MEAL_TIMES_HHMM.length} meal slots`);
  }
}
