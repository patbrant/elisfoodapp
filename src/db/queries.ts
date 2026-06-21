import type { SQLiteDatabase } from 'expo-sqlite';
import type { Component, DayActual, DeliveryForm, Event, RecipeItem, Slot, SlotType } from '../domain/types';

export type PlanVersionRow = {
  id: string;
  name: string;
  valid_from: string;
  created_at: string;
};

export type SlotRow = {
  id: string;
  plan_version_id: string;
  type: SlotType;
  title: string;
  info: string | null;
  time_minutes: number;
  sort_order: number;
  created_at: string;
};

export type DayOverrideRow = {
  id: string;
  date: string;
  slot_id: string;
  override_json: string;
  created_at: string;
};

export type EventRow = {
  id: string;
  date: string;
  slot_id: string;
  status: 'done' | 'skipped';
  created_at: string;
  note: string | null;
};

export type RecipeItemRow = {
  id: string;
  slot_id: string;
  component_id: string;
  ml: number;
  sort_order: number;
};

export type ComponentRow = {
  id: string;
  name: string;
  category: string | null;
  delivery_form: DeliveryForm | null;
  is_favorite: number;
  last_used_at: string | null;
};

export type DayActualRow = {
  id: string;
  date: string;
  slot_id: string;
  component_id: string;
  ml: number;
  updated_at: string;
};

export function mapSlot(r: SlotRow): Slot {
  return {
    id: r.id,
    planVersionId: r.plan_version_id,
    type: r.type,
    title: r.title,
    info: r.info,
    timeMinutes: r.time_minutes,
    sortOrder: r.sort_order,
  };
}

export function mapEvent(r: EventRow): Event {
  return {
    id: r.id,
    date: r.date,
    slotId: r.slot_id,
    status: r.status,
    createdAt: r.created_at,
    note: r.note,
  };
}

export function mapComponent(r: ComponentRow): Component {
  return {
    id: r.id,
    name: r.name,
    category: r.category,
    deliveryForm: r.delivery_form,
    isFavorite: r.is_favorite === 1,
    lastUsedAt: r.last_used_at,
  };
}

export function mapDayActual(r: DayActualRow): DayActual {
  return {
    id: r.id,
    date: r.date,
    slotId: r.slot_id,
    componentId: r.component_id,
    ml: r.ml,
    updatedAt: r.updated_at,
  };
}

export function mapRecipeItem(r: RecipeItemRow): RecipeItem {
  return {
    id: r.id,
    slotId: r.slot_id,
    componentId: r.component_id,
    ml: r.ml,
    sortOrder: r.sort_order,
  };
}

export function placeholders(n: number): string {
  return Array.from({ length: n }, () => '?').join(',');
}

export async function getActivePlanVersion(db: SQLiteDatabase, date: string): Promise<PlanVersionRow | null> {
  const row = await db.getFirstAsync<PlanVersionRow>(
    'SELECT * FROM plan_versions WHERE valid_from <= ? ORDER BY valid_from DESC LIMIT 1',
    [date],
  );
  return row ?? null;
}
