export type SlotType = 'meal' | 'med';
export type EventStatus = 'done' | 'skipped';
export type DeliveryForm = 'flasche' | 'sondomat' | 'spritze';

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
  deliveryForm: DeliveryForm | null;
};

export type OverrideRecipeSnapshot = {
  recipeItems: Array<{
    componentId: string;
    ml: number;
    sortOrder: number;
    deliveryForm?: DeliveryForm | null;
  }>;
};

export type Event = {
  id: string;
  date: string;
  slotId: string;
  status: EventStatus;
  createdAt: string;
  note?: string | null;
};

export type TodayRecipeItem = {
  itemId: string;
  componentId: string;
  name: string;
  deliveryForm: DeliveryForm | null;
  ml: number;
  actualMl: number | null;
  sortOrder: number;
};

export type TodayItem = {
  slot: Slot;
  effectiveRecipe?: TodayRecipeItem[];
  totalMl?: number;
  event?: Event;
};

export type DayActual = {
  id: string;
  date: string;
  slotId: string;
  itemKey: string;
  componentId: string;
  ml: number;
  updatedAt: string;
};
