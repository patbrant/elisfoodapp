import type { SQLiteDatabase } from 'expo-sqlite';
import { getDb } from '../db';
import {
  type ComponentRow,
  type DayActualRow,
  type DayOverrideRow,
  type EventRow,
  type RecipeItemRow,
  type SlotRow,
  getActivePlanVersion,
  mapComponent,
  mapEvent,
  mapSlot,
  placeholders,
} from '../db/queries';
import { OverrideRecipeSnapshotSchema } from '../domain/schemas';
import type { TodayItem, TodayRecipeItem } from '../domain/types';

async function loadPlanRecipeItems(
  db: SQLiteDatabase,
  slotIds: string[],
): Promise<Map<string, RecipeItemRow[]>> {
  const map = new Map<string, RecipeItemRow[]>();
  if (slotIds.length === 0) return map;
  const rows = await db.getAllAsync<RecipeItemRow>(
    `SELECT * FROM meal_recipe_items WHERE slot_id IN (${placeholders(slotIds.length)}) ORDER BY sort_order ASC`,
    slotIds,
  );
  for (const r of rows) {
    const list = map.get(r.slot_id);
    if (list) list.push(r);
    else map.set(r.slot_id, [r]);
  }
  return map;
}

async function loadComponentsByIds(db: SQLiteDatabase, ids: string[]): Promise<Map<string, ComponentRow>> {
  const map = new Map<string, ComponentRow>();
  if (ids.length === 0) return map;
  const rows = await db.getAllAsync<ComponentRow>(
    `SELECT * FROM components WHERE id IN (${placeholders(ids.length)})`,
    ids,
  );
  for (const r of rows) map.set(r.id, r);
  return map;
}

type SnapshotRecipeItem = {
  componentId: string;
  ml: number;
  sortOrder: number;
  deliveryForm?: import('../domain/types').DeliveryForm | null;
};

function parseOverride(json: string, slotId: string): SnapshotRecipeItem[] | null {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch (err) {
    console.warn(`[today] override_json parse failed for slot ${slotId}:`, err);
    return null;
  }
  const parsed = OverrideRecipeSnapshotSchema.safeParse(raw);
  if (!parsed.success) {
    console.warn(`[today] override schema invalid for slot ${slotId}:`, parsed.error.message);
    return null;
  }
  return parsed.data.recipeItems;
}

export async function getTodayItems(date: string): Promise<TodayItem[]> {
  const db = await getDb();

  const planVersion = await getActivePlanVersion(db, date);
  if (!planVersion) return [];

  const slotRows = await db.getAllAsync<SlotRow>(
    'SELECT * FROM slots WHERE plan_version_id = ? ORDER BY time_minutes ASC, sort_order ASC',
    [planVersion.id],
  );
  if (slotRows.length === 0) return [];

  const [overrideRows, eventRows, actualRows] = await Promise.all([
    db.getAllAsync<DayOverrideRow>('SELECT * FROM day_overrides WHERE date = ?', [date]),
    db.getAllAsync<EventRow>('SELECT * FROM events WHERE date = ?', [date]),
    db.getAllAsync<DayActualRow>('SELECT * FROM day_actuals WHERE date = ?', [date]),
  ]);
  const overridesBySlot = new Map(overrideRows.map((r) => [r.slot_id, r]));
  const eventsBySlot = new Map(eventRows.map((r) => [r.slot_id, r]));
  const actualsBySlotComponent = new Map<string, number>();
  for (const a of actualRows) {
    actualsBySlotComponent.set(`${a.slot_id}:${a.component_id}`, a.ml);
  }

  const mealSlotIds = slotRows.filter((s) => s.type === 'meal').map((s) => s.id);
  const planRecipeBySlot = await loadPlanRecipeItems(db, mealSlotIds);

  const componentIds = new Set<string>();
  for (const items of planRecipeBySlot.values()) {
    for (const r of items) componentIds.add(r.component_id);
  }
  const parsedOverrides = new Map<string, SnapshotRecipeItem[]>();
  for (const ov of overrideRows) {
    const items = parseOverride(ov.override_json, ov.slot_id);
    if (items) {
      parsedOverrides.set(ov.slot_id, items);
      for (const it of items) componentIds.add(it.componentId);
    }
  }
  const componentsById = await loadComponentsByIds(db, [...componentIds]);

  return slotRows.map((slotRow) => {
    const slot = mapSlot(slotRow);
    const eventRow = eventsBySlot.get(slot.id);
    const item: TodayItem = {
      slot,
      event: eventRow ? mapEvent(eventRow) : undefined,
    };

    if (slot.type !== 'meal') return item;

    const overrideItems = parsedOverrides.get(slot.id);
    const recipeItems: SnapshotRecipeItem[] = overrideItems
      ?? (planRecipeBySlot.get(slot.id) ?? []).map((r) => ({
        componentId: r.component_id,
        ml: r.ml,
        sortOrder: r.sort_order,
        deliveryForm: r.delivery_form,
      }));

    const sorted: TodayRecipeItem[] = recipeItems
      .slice()
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((r) => {
        const comp = componentsById.get(r.componentId);
        const actualMl = actualsBySlotComponent.get(`${slot.id}:${r.componentId}`);
        return {
          componentId: r.componentId,
          name: comp ? mapComponent(comp).name : '(unbekannt)',
          deliveryForm: r.deliveryForm ?? null,
          ml: r.ml,
          actualMl: actualMl ?? null,
          sortOrder: r.sortOrder,
        };
      });

    item.effectiveRecipe = sorted;
    item.totalMl = sorted.reduce((sum, r) => sum + r.ml, 0);

    return item;
  });
}
