import * as Crypto from 'expo-crypto';
import { getDb } from '../db';
import {
  type RecipeItemRow,
  type SlotRow,
  getActivePlanVersion,
  mapRecipeItem,
  mapSlot,
} from '../db/queries';
import { toLocalISODate } from '../domain/time';
import type { DeliveryForm, RecipeItem, Slot, SlotType } from '../domain/types';

const DEFAULT_RECIPE_ML = 30;

export type SlotPatch = Partial<{
  title: string;
  info: string | null;
  timeMinutes: number;
  type: SlotType;
}>;

export type RecipeItemWithMeta = RecipeItem & {
  name: string;
};

export async function getActivePlanVersionId(): Promise<string | null> {
  const db = await getDb();
  const today = toLocalISODate(new Date());
  const pv = await getActivePlanVersion(db, today);
  return pv?.id ?? null;
}

export async function listSlots(planVersionId: string): Promise<Slot[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<SlotRow>(
    'SELECT * FROM slots WHERE plan_version_id = ? ORDER BY time_minutes ASC, sort_order ASC',
    [planVersionId],
  );
  return rows.map(mapSlot);
}

export async function getSlot(slotId: string): Promise<Slot | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<SlotRow>('SELECT * FROM slots WHERE id = ?', [slotId]);
  return row ? mapSlot(row) : null;
}

export async function createSlot(
  planVersionId: string,
  partial: { type: SlotType; title: string; timeMinutes: number; info?: string | null },
): Promise<Slot> {
  const db = await getDb();
  const id = Crypto.randomUUID();
  const createdAt = new Date().toISOString();

  const maxRow = await db.getFirstAsync<{ next: number }>(
    'SELECT COALESCE(MAX(sort_order), -1) + 1 AS next FROM slots WHERE plan_version_id = ?',
    [planVersionId],
  );
  const sortOrder = maxRow?.next ?? 0;

  await db.runAsync(
    'INSERT INTO slots (id, plan_version_id, type, title, info, time_minutes, sort_order, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [id, planVersionId, partial.type, partial.title, partial.info ?? null, partial.timeMinutes, sortOrder, createdAt],
  );

  return {
    id,
    planVersionId,
    type: partial.type,
    title: partial.title,
    info: partial.info ?? null,
    timeMinutes: partial.timeMinutes,
    sortOrder,
  };
}

export async function updateSlot(slotId: string, patch: SlotPatch): Promise<void> {
  const db = await getDb();
  const sets: string[] = [];
  const values: (string | number | null)[] = [];

  if (patch.title !== undefined) {
    sets.push('title = ?');
    values.push(patch.title);
  }
  if (patch.info !== undefined) {
    sets.push('info = ?');
    values.push(patch.info);
  }
  if (patch.timeMinutes !== undefined) {
    sets.push('time_minutes = ?');
    values.push(patch.timeMinutes);
  }
  if (patch.type !== undefined) {
    sets.push('type = ?');
    values.push(patch.type);
  }

  if (sets.length === 0) return;

  values.push(slotId);
  await db.runAsync(`UPDATE slots SET ${sets.join(', ')} WHERE id = ?`, values);
}

export async function deleteSlot(slotId: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM slots WHERE id = ?', [slotId]);
}

export async function listRecipeItems(slotId: string): Promise<RecipeItemWithMeta[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<RecipeItemRow & { name: string }>(
    `SELECT mri.*, c.name AS name
       FROM meal_recipe_items mri
       JOIN components c ON c.id = mri.component_id
      WHERE mri.slot_id = ?
      ORDER BY mri.sort_order ASC`,
    [slotId],
  );
  return rows.map((r) => ({
    ...mapRecipeItem(r),
    name: r.name,
  }));
}

export async function addRecipeItem(
  slotId: string,
  componentId: string,
  ml: number = DEFAULT_RECIPE_ML,
  deliveryForm: DeliveryForm | null = null,
): Promise<RecipeItem> {
  const db = await getDb();
  const id = Crypto.randomUUID();
  const clamped = Math.max(0, Math.floor(ml));

  const maxRow = await db.getFirstAsync<{ next: number }>(
    'SELECT COALESCE(MAX(sort_order), -1) + 1 AS next FROM meal_recipe_items WHERE slot_id = ?',
    [slotId],
  );
  const sortOrder = maxRow?.next ?? 0;

  await db.runAsync(
    'INSERT INTO meal_recipe_items (id, slot_id, component_id, ml, sort_order, delivery_form) VALUES (?, ?, ?, ?, ?, ?)',
    [id, slotId, componentId, clamped, sortOrder, deliveryForm],
  );

  return { id, slotId, componentId, ml: clamped, sortOrder, deliveryForm };
}

export async function updateRecipeItemDeliveryForm(
  itemId: string,
  deliveryForm: DeliveryForm | null,
): Promise<void> {
  const db = await getDb();
  await db.runAsync('UPDATE meal_recipe_items SET delivery_form = ? WHERE id = ?', [deliveryForm, itemId]);
}

export async function updateRecipeItemMl(itemId: string, ml: number): Promise<void> {
  const db = await getDb();
  const clamped = Math.max(0, Math.floor(ml));
  await db.runAsync('UPDATE meal_recipe_items SET ml = ? WHERE id = ?', [clamped, itemId]);
}

export async function removeRecipeItem(itemId: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM meal_recipe_items WHERE id = ?', [itemId]);
}
