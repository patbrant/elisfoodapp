import * as Crypto from 'expo-crypto';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { getDb } from '../db';
import { getSupabaseClient } from '../db/supabase';

export type HouseholdContext = {
  householdId: string;
  userId: string;
  role: 'admin' | 'caregiver';
};

export type SyncMetaKey = 'household_id' | 'user_id' | 'role' | 'last_pull_at';

// ---- sync_meta helpers ----

export async function readSyncMeta(key: SyncMetaKey): Promise<string | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ value: string }>(
    'SELECT value FROM sync_meta WHERE key = ?',
    [key],
  );
  return row?.value ?? null;
}

async function writeSyncMeta(key: SyncMetaKey, value: string): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    'INSERT INTO sync_meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    [key, value],
  );
}

async function clearSyncMeta(): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM sync_meta');
}

// ---- public API ----

export async function getLocalHouseholdContext(): Promise<HouseholdContext | null> {
  const householdId = await readSyncMeta('household_id');
  const userId = await readSyncMeta('user_id');
  const role = await readSyncMeta('role');
  if (!householdId || !userId || !role) return null;
  return { householdId, userId, role: role as 'admin' | 'caregiver' };
}

async function persistContext(ctx: HouseholdContext): Promise<void> {
  await writeSyncMeta('household_id', ctx.householdId);
  await writeSyncMeta('user_id', ctx.userId);
  await writeSyncMeta('role', ctx.role);
}

function generateJoinCode(): string {
  const bytes = Crypto.getRandomBytes(4);
  const num = (bytes[0] << 24) | (bytes[1] << 16) | (bytes[2] << 8) | bytes[3];
  return Math.abs(num).toString(36).toUpperCase().slice(0, 6).padStart(6, '0');
}

export async function createHousehold(name = 'Familie'): Promise<{ joinCode: string; context: HouseholdContext }> {
  const supabase = getSupabaseClient();

  const { data: authData, error: authErr } = await supabase.auth.signInAnonymously();
  if (authErr || !authData.user) throw new Error(authErr?.message ?? 'Anmeldung fehlgeschlagen');
  const userId = authData.user.id;

  const joinCode = generateJoinCode();
  const householdId = Crypto.randomUUID();

  const { error: hhErr } = await supabase.from('households').insert({
    id: householdId,
    name,
    join_code: joinCode,
    timezone: 'Europe/Zurich',
    created_at: new Date().toISOString(),
  });
  if (hhErr) throw new Error(`Haushalt erstellen: ${hhErr.message}`);

  const { error: memberErr } = await supabase.from('household_members').insert({
    id: Crypto.randomUUID(),
    household_id: householdId,
    user_id: userId,
    role: 'admin',
    joined_at: new Date().toISOString(),
  });
  if (memberErr) throw new Error(`Mitglied eintragen: ${memberErr.message}`);

  const context: HouseholdContext = { householdId, userId, role: 'admin' };
  await persistContext(context);
  return { joinCode, context };
}

export async function joinHousehold(joinCode: string): Promise<HouseholdContext> {
  const supabase = getSupabaseClient();
  const code = joinCode.trim().toUpperCase();

  const { data: authData, error: authErr } = await supabase.auth.signInAnonymously();
  if (authErr || !authData.user) throw new Error(authErr?.message ?? 'Anmeldung fehlgeschlagen');
  const userId = authData.user.id;

  // Use a SECURITY DEFINER RPC so the lookup bypasses RLS —
  // the joining user is not yet a household member, so a direct SELECT would return 0 rows.
  const { data: householdId, error: hhErr } = await supabase.rpc('get_household_id_by_code', { code });
  if (hhErr) throw new Error(hhErr.message);
  if (!householdId) throw new Error('Ungültiger Code');

  const { error: memberErr } = await supabase.from('household_members').insert({
    id: Crypto.randomUUID(),
    household_id: householdId,
    user_id: userId,
    role: 'caregiver',
    joined_at: new Date().toISOString(),
  });
  // Ignore duplicate-member error (user already joined)
  if (memberErr && !/duplicate|UNIQUE/i.test(memberErr.message)) {
    throw new Error(`Beitreten: ${memberErr.message}`);
  }

  const context: HouseholdContext = { householdId, userId, role: 'caregiver' };
  await persistContext(context);

  // Remove local seed data so pullAll can fill SQLite cleanly from Supabase.
  // Without this, Device B has two plan_versions (own seed + Supabase) and
  // getActivePlanVersion returns the wrong one.
  const db = await getDb();
  await db.runAsync('DELETE FROM meal_recipe_items');
  await db.runAsync('DELETE FROM day_actuals');
  await db.runAsync('DELETE FROM day_overrides');
  await db.runAsync('DELETE FROM events');
  await db.runAsync('DELETE FROM slots');
  await db.runAsync('DELETE FROM components');
  await db.runAsync('DELETE FROM plan_versions');

  return context;
}

export async function leaveHousehold(): Promise<void> {
  await clearSyncMeta();
  const supabase = getSupabaseClient();
  await supabase.auth.signOut();
}

export async function promoteMember(targetUserId: string, householdId: string): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from('household_members')
    .update({ role: 'admin' })
    .eq('household_id', householdId)
    .eq('user_id', targetUserId);
  if (error) throw new Error(error.message);
}

export async function registerPushToken(context: HouseholdContext): Promise<void> {
  const { status } = await Notifications.requestPermissionsAsync();
  if (status !== 'granted') return;

  const projectId: string = Constants.expoConfig?.extra?.eas?.projectId ?? '';
  const token = await Notifications.getExpoPushTokenAsync({ projectId });

  const supabase = getSupabaseClient();
  await supabase.from('push_tokens').upsert(
    {
      id: Crypto.randomUUID(),
      household_id: context.householdId,
      user_id: context.userId,
      expo_token: token.data,
      device_name: Device.deviceName ?? 'Gerät',
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'household_id,user_id' },
  );
}

export async function pushSeedData(context: HouseholdContext): Promise<void> {
  const db = await getDb();
  const supabase = getSupabaseClient();
  const hid = context.householdId;

  const pvRows = await db.getAllAsync<Record<string, unknown>>('SELECT * FROM plan_versions');
  if (pvRows.length > 0) {
    await supabase.from('plan_versions').upsert(
      pvRows.map((r) => ({ ...r, household_id: hid })),
      { onConflict: 'id' },
    );
  }

  const slotRows = await db.getAllAsync<Record<string, unknown>>('SELECT * FROM slots');
  if (slotRows.length > 0) {
    await supabase.from('slots').upsert(
      slotRows.map((r) => ({ ...r, household_id: hid })),
      { onConflict: 'id' },
    );
  }

  const compRows = await db.getAllAsync<Record<string, unknown>>(
    'SELECT id, name, category FROM components',
  );
  if (compRows.length > 0) {
    await supabase.from('components').upsert(
      compRows.map((r) => ({ ...r, household_id: hid })),
      { onConflict: 'id' },
    );
  }

  const mriRows = await db.getAllAsync<Record<string, unknown>>('SELECT * FROM meal_recipe_items');
  if (mriRows.length > 0) {
    await supabase.from('meal_recipe_items').upsert(
      mriRows.map((r) => ({ ...r, household_id: hid })),
      { onConflict: 'id' },
    );
  }
}
