import * as Crypto from 'expo-crypto';
import { getDb } from '../db';
import {
  type PlanVersionRow,
  type RecipeItemRow,
  type SlotRow,
  getActivePlanVersion,
  mapRecipeItem,
  mapSlot,
} from '../db/queries';
import { toLocalISODate } from '../domain/time';
import type { DeliveryForm, RecipeItem, Slot, SlotType } from '../domain/types';
import { getLocalHouseholdContext } from './authService';
import { drainOutbox, enqueueOutbox } from './syncService';

function syncPush(tableName: Parameters<typeof enqueueOutbox>[0], rowId: string, op: Parameters<typeof enqueueOutbox>[2], payload: Record<string, unknown>): void {
  enqueueOutbox(tableName, rowId, op, payload)
    .then(() => getLocalHouseholdContext())
    .then((ctx) => { if (ctx) drainOutbox(ctx).catch(console.warn); })
    .catch(console.warn);
}

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

  const slot: Slot = {
    id,
    planVersionId,
    type: partial.type,
    title: partial.title,
    info: partial.info ?? null,
    timeMinutes: partial.timeMinutes,
    sortOrder,
  };
  syncPush('slots', id, 'upsert', { id, plan_version_id: planVersionId, type: slot.type, title: slot.title, info: slot.info, time_minutes: slot.timeMinutes, sort_order: slot.sortOrder, created_at: createdAt });
  return slot;
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

  const updated = await db.getFirstAsync<SlotRow>('SELECT * FROM slots WHERE id = ?', [slotId]);
  if (updated) {
    syncPush('slots', slotId, 'upsert', { id: slotId, plan_version_id: updated.plan_version_id, type: updated.type, title: updated.title, info: updated.info, time_minutes: updated.time_minutes, sort_order: updated.sort_order, created_at: updated.created_at });
  }
}

export async function deleteSlot(slotId: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM slots WHERE id = ?', [slotId]);
  syncPush('slots', slotId, 'delete', { id: slotId });
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

  const item: RecipeItem = { id, slotId, componentId, ml: clamped, sortOrder, deliveryForm };
  syncPush('meal_recipe_items', id, 'upsert', { id, slot_id: slotId, component_id: componentId, ml: clamped, sort_order: sortOrder, delivery_form: deliveryForm });
  return item;
}

export async function updateRecipeItemDeliveryForm(
  itemId: string,
  deliveryForm: DeliveryForm | null,
): Promise<void> {
  const db = await getDb();
  await db.runAsync('UPDATE meal_recipe_items SET delivery_form = ? WHERE id = ?', [deliveryForm, itemId]);
  const row = await db.getFirstAsync<RecipeItemRow>('SELECT * FROM meal_recipe_items WHERE id = ?', [itemId]);
  if (row) syncPush('meal_recipe_items', itemId, 'upsert', { id: itemId, slot_id: row.slot_id, component_id: row.component_id, ml: row.ml, sort_order: row.sort_order, delivery_form: deliveryForm });
}

export async function updateRecipeItemMl(itemId: string, ml: number): Promise<void> {
  const db = await getDb();
  const clamped = Math.max(0, Math.floor(ml));
  await db.runAsync('UPDATE meal_recipe_items SET ml = ? WHERE id = ?', [clamped, itemId]);
  const row = await db.getFirstAsync<RecipeItemRow>('SELECT * FROM meal_recipe_items WHERE id = ?', [itemId]);
  if (row) syncPush('meal_recipe_items', itemId, 'upsert', { id: itemId, slot_id: row.slot_id, component_id: row.component_id, ml: clamped, sort_order: row.sort_order, delivery_form: row.delivery_form });
}

export async function removeRecipeItem(itemId: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM meal_recipe_items WHERE id = ?', [itemId]);
  syncPush('meal_recipe_items', itemId, 'delete', { id: itemId });
}

export type PlanVersionWithCount = PlanVersionRow & { slotCount: number };

export async function listAllPlanVersions(): Promise<PlanVersionWithCount[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<PlanVersionRow & { slot_count: number }>(
    `SELECT pv.*, COUNT(s.id) AS slot_count
     FROM plan_versions pv
     LEFT JOIN slots s ON s.plan_version_id = pv.id
     GROUP BY pv.id
     ORDER BY pv.valid_from DESC`,
  );
  return rows.map((r) => ({ ...r, slotCount: r.slot_count }));
}

export async function createNewPlanVersion(name: string, validFrom: string): Promise<PlanVersionRow> {
  const db = await getDb();
  const today = toLocalISODate(new Date());
  const currentPv = await getActivePlanVersion(db, today);

  const newVersionId = Crypto.randomUUID();
  const createdAt = new Date().toISOString();
  const trimmedName = name.trim() || `Plan ab ${validFrom}`;

  await db.runAsync(
    'INSERT INTO plan_versions (id, name, valid_from, created_at) VALUES (?, ?, ?, ?)',
    [newVersionId, trimmedName, validFrom, createdAt],
  );
  await enqueueOutbox('plan_versions', newVersionId, 'upsert', {
    id: newVersionId, name: trimmedName, valid_from: validFrom, created_at: createdAt,
  });

  if (currentPv) {
    const currentSlots = await db.getAllAsync<SlotRow>(
      'SELECT * FROM slots WHERE plan_version_id = ? ORDER BY sort_order ASC',
      [currentPv.id],
    );
    for (const slot of currentSlots) {
      const newSlotId = Crypto.randomUUID();
      await db.runAsync(
        'INSERT INTO slots (id, plan_version_id, type, title, info, time_minutes, sort_order, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [newSlotId, newVersionId, slot.type, slot.title, slot.info, slot.time_minutes, slot.sort_order, createdAt],
      );
      await enqueueOutbox('slots', newSlotId, 'upsert', {
        id: newSlotId, plan_version_id: newVersionId, type: slot.type, title: slot.title,
        info: slot.info, time_minutes: slot.time_minutes, sort_order: slot.sort_order, created_at: createdAt,
      });

      const items = await db.getAllAsync<RecipeItemRow>(
        'SELECT * FROM meal_recipe_items WHERE slot_id = ?',
        [slot.id],
      );
      for (const item of items) {
        const newItemId = Crypto.randomUUID();
        await db.runAsync(
          'INSERT INTO meal_recipe_items (id, slot_id, component_id, ml, sort_order, delivery_form) VALUES (?, ?, ?, ?, ?, ?)',
          [newItemId, newSlotId, item.component_id, item.ml, item.sort_order, item.delivery_form],
        );
        await enqueueOutbox('meal_recipe_items', newItemId, 'upsert', {
          id: newItemId, slot_id: newSlotId, component_id: item.component_id,
          ml: item.ml, sort_order: item.sort_order, delivery_form: item.delivery_form,
        });
      }
    }
  }

  getLocalHouseholdContext().then((ctx) => { if (ctx) drainOutbox(ctx).catch(console.warn); });
  return { id: newVersionId, name: trimmedName, valid_from: validFrom, created_at: createdAt };
}
