export type SlotType = 'meal' | 'med';
export type EventStatus = 'done' | 'skipped';

export type Slot = {
  id: string;
  planVersionId: string;
  type: SlotType;
  title: string;
  info?: string | null;
  timeMinutes: number;
  sortOrder: number;
};

export type Component = {
  id: string;
  name: string;
  category?: string | null;
  isFavorite: boolean;
  lastUsedAt?: string | null;
};

export type RecipeItem = {
  id: string;
  slotId: string;
  componentId: string;
  ml: number;
  sortOrder: number;
};

export type OverrideRecipeSnapshot = {
  recipeItems: Array<{ componentId: string; ml: number; sortOrder: number }>;
};

export type Event = {
  id: string;
  date: string;
  slotId: string;
  status: EventStatus;
  createdAt: string;
  note?: string | null;
};

export type TodayItem = {
  slot: Slot;
  effectiveRecipe?: Array<{ componentId: string; name: string; ml: number; sortOrder: number }>;
  totalMl?: number;
  event?: Event;
};
