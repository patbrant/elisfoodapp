# [SPEC.md](http://SPEC.md) — Eli’s Food App (Expo MVP)

> **Ziel:** Unterstützen, nicht kontrollieren. Schnell “sehen → erinnern → abhaken”.
> 

> **Kernregeln:** “Done” final, kein Nachtragen, keine Soll-/Ist-Kontrolle, Mahlzeiten ohne Total-Ziel.
> 

---

## 0) Non‑Negotiables (Product Rules)

- Status pro Item: `open | done | skipped` (**kein** `unclear`)
- **“done” ist final**: kein Edit, kein Undo, kein Backdate
- **keine Erfassung** von Menge/Methode/effektiver Zeit beim Abhaken
- `skipped` kann eine **optionale Notiz** haben (done optional ebenfalls ok, aber nicht nötig)
- Mahlzeiten:
    - Komponentenliste in **ml** (flexibel, kann wechseln)
    - **kein Total-Ziel**; nur **Summe (Info)** = `sum(components.ml)` ohne Warnungen/Soll-Ist
- **keine Auswertungen/Compliance/Streaks**, keine “wer hat vergessen”

---

## 1) Tech Stack

- Expo SDK (TypeScript)
- Navigation/Routing: `expo-router`
- Local DB: `expo-sqlite`
- Notifications: `expo-notifications`
- Validation/Types: `zod`
- Date utils: `date-fns` + `date-fns-tz` (optional, empfohlen)

### Install

```bash
npx create-expo-app -t expo-template-blank-typescript elis-food-app
cd elis-food-app

npx expo install expo-router expo-notifications expo-device expo-constants expo-sqlite
npm i zod date-fns date-fns-tz
```

---

## 2) App Routes (expo-router)

```
/today              (default)
/plan
/plan/slot/[slotId]
/history
/settings
```

### Screen Summary

- **Today**: Timeline + Done/Skipped + optional Note + “Reminders today ON/OFF”
- **Plan**: Plan-Version & Slots (meal/med), grob editierbar
- **Slot Editor**: Zeit, Titel, Info, Rezept-Komponenten (nur meal)
- **History**: Tages-Rückblick + Notizen
- **Settings**: Notification Defaults, Step Sizes

---

## 3) SQLite Schema (Local-first)

### Notes

- Zeiten als `time_minutes` (Minuten seit Mitternacht)
- `events` sind **insert-only**
- `day_overrides` speichert Snapshot JSON (einfacher als Delta)

### Migration 001 (schema)

```sql
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS plan_versions (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  valid_from TEXT NOT NULL,         -- YYYY-MM-DD
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS slots (
  id TEXT PRIMARY KEY,
  plan_version_id TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('meal','med')),
  title TEXT NOT NULL,
  info TEXT,
  time_minutes INTEGER NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  FOREIGN KEY(plan_version_id) REFERENCES plan_versions(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS components (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT,
  is_favorite INTEGER NOT NULL DEFAULT 0,
  last_used_at TEXT
);

CREATE TABLE IF NOT EXISTS meal_recipe_items (
  id TEXT PRIMARY KEY,
  slot_id TEXT NOT NULL,
  component_id TEXT NOT NULL,
  ml INTEGER NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY(slot_id) REFERENCES slots(id) ON DELETE CASCADE,
  FOREIGN KEY(component_id) REFERENCES components(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS day_overrides (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL,               -- YYYY-MM-DD
  slot_id TEXT NOT NULL,
  override_json TEXT NOT NULL,      -- JSON snapshot
  created_at TEXT NOT NULL,
  UNIQUE(date, slot_id),
  FOREIGN KEY(slot_id) REFERENCES slots(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL,               -- YYYY-MM-DD
  slot_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('done','skipped')),
  created_at TEXT NOT NULL,         -- ISO datetime now()
  note TEXT,
  FOREIGN KEY(slot_id) REFERENCES slots(id) ON DELETE CASCADE,
  UNIQUE(date, slot_id)             -- final: max 1 event per slot per day
);

CREATE TABLE IF NOT EXISTS notification_jobs (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL,               -- YYYY-MM-DD
  slot_id TEXT NOT NULL,
  notification_id TEXT NOT NULL,    -- expo-notifications id
  type TEXT NOT NULL CHECK (type IN ('pre','followup')),
  created_at TEXT NOT NULL,
  UNIQUE(date, slot_id, type)
);

CREATE TABLE IF NOT EXISTS day_settings (
  date TEXT PRIMARY KEY,            -- YYYY-MM-DD
  reminders_enabled INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
```

---

## 4) TypeScript Types + Zod

### `src/domain/types.ts`

```tsx
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
  date: string;     // YYYY-MM-DD
  slotId: string;
  status: EventStatus;
  createdAt: string; // ISO
  note?: string | null;
};

export type TodayItem = {
  slot: Slot;
  effectiveRecipe?: Array<{ componentId: string; name: string; ml: number; sortOrder: number }>;
  totalMl?: number; // info only
  event?: Event;
};
```

### `src/domain/schemas.ts`

```tsx
import { z } from 'zod';

export const ISODateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
export const ISODateTimeSchema = z.string().min(10);

export const OverrideRecipeSnapshotSchema = z.object({
  recipeItems: z.array(z.object({
    componentId: z.string(),
    ml: z.number().int().min(0),
    sortOrder: z.number().int().min(0),
  })).min(0),
});
```

---

## 5) Folder / Module Structure

```
app/
  _layout.tsx
  today.tsx
  plan/index.tsx
  plan/slot/[slotId].tsx
  history.tsx
  settings.tsx

src/
  db/
    index.ts
    migrations.ts
    queries.ts
  domain/
    types.ts
    schemas.ts
    time.ts
  services/
    todayService.ts
    overrideService.ts
    eventService.ts
    notificationService.ts
  ui/
    TimelineItemCard.tsx
    RecipeCard.tsx
    Stepper.tsx
    NoteModal.tsx
    ComponentPicker.tsx
```

---

## 6) Time Helpers (minutes <-> datetime)

### `src/domain/time.ts`

```tsx
export function minutesToHHMM(m: number) {
  const hh = Math.floor(m / 60).toString().padStart(2, '0');
  const mm = (m % 60).toString().padStart(2, '0');
  return `${hh}:${mm}`;
}

export function hhmmToMinutes(hhmm: string) {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}
```

(Ergänze nach Bedarf `toLocalISODate(now)`.)

---

## 7) Today Aggregation Spec

### Algorithmus (source of truth)

1. `todayDate = YYYY-MM-DD (local)`
2. **Active Plan Version**:
    - `SELECT * FROM plan_versions WHERE valid_from <= todayDate ORDER BY valid_from DESC LIMIT 1`
3. Slots laden:
    - `SELECT * FROM slots WHERE plan_version_id = ? ORDER BY time_minutes ASC, sort_order ASC`
4. Overrides laden:
    - `SELECT * FROM day_overrides WHERE date = todayDate`
5. Events laden:
    - `SELECT * FROM events WHERE date = todayDate`
6. For each slot:
    - if `slot.type === 'meal'`:
        - effective recipe:
            - override exists => parse `override_json`
            - else load from `meal_recipe_items`
        - join component names
        - `totalMl = sum(ml)` (Info)
    - attach `event` if exists

### `src/services/todayService.ts` (signature)

```tsx
export async function getTodayItems(date: string): Promise<TodayItem[]> { /* ... */ }
```

---

## 8) Events (Final)

### `src/services/eventService.ts`

**createEvent(date, slotId, status, note?)**

- if exists `events(date, slotId)` => reject
- insert event with `created_at = now()`
- cancel notifications for `(date, slotId)` (`pre` + `followup`)
- return inserted event

**Rules**

- No update endpoint for events in codebase.
- UI disables actions if event exists.

---

## 9) “Heute anpassen” Overrides (Meal only)

### UX rules

- Default: Änderungen gelten **nur heute**
- Stepper pro Komponente: `-10`, `-5`, `+5`, `+10` (konfigurierbar)
- Komponenten ersetzen/hinzufügen über Picker: **Favorites + Recent + Search**
- Total zeigt nur Summe (Info)

### Override storage strategy

- On first change for `(date, slotId)`:
    - create snapshot from plan recipe into `day_overrides.override_json`
- Every change:
    - update snapshot JSON (upsert)
- `ml` is clamped `>= 0`
- Remove component: delete entry from snapshot (oder `ml=0` und hide; empfohlen: delete)

### `src/services/overrideService.ts` (signatures)

```tsx
export async function upsertOverrideSnapshot(date: string, slotId: string, snapshot: OverrideRecipeSnapshot): Promise<void>;

export async function adjustMl(date: string, slotId: string, componentId: string, delta: number): Promise<void>;

export async function replaceComponent(date: string, slotId: string, oldComponentId: string, newComponentId: string): Promise<void>;

export async function addComponent(date: string, slotId: string, componentId: string, initialMl: number): Promise<void>;

export async function removeComponent(date: string, slotId: string, componentId: string): Promise<void>;
```

---

## 10) Components Picker (Favorites/Recent)

### Query rules

- Favorites:
    - `SELECT * FROM components WHERE is_favorite = 1 ORDER BY name ASC`
- Recent:
    - `SELECT * FROM components WHERE last_used_at IS NOT NULL ORDER BY last_used_at DESC LIMIT 10`
- Search:
    - `SELECT * FROM components WHERE name LIKE ? ORDER BY name ASC LIMIT 50`

### On selection:

- `UPDATE components SET last_used_at = now() WHERE id = ?`

---

## 11) Notifications Spec (Local notifications, MVP)

### Settings keys (`app_settings`)

- `preMinutes` default `"10"`
- `followupMinutes` default `"25"`

### Day toggle

- `day_settings.reminders_enabled` (default ON)
- Today screen toggles it and calls `syncTodayNotifications(date)`

### Scheduling contract

- We schedule only for **today** (MVP; optional tomorrow pre-schedule later)
- We track every scheduled notification in `notification_jobs`
- When a slot is completed, cancel associated notifications and delete `notification_jobs` rows

### `src/services/notificationService.ts`

```tsx
export async function syncTodayNotifications(date: string): Promise<void>;
export async function cancelSlotNotifications(date: string, slotId: string): Promise<void>;
export async function cancelAllNotificationsForDate(date: string): Promise<void>;
```

### `syncTodayNotifications(date)` algorithm

1. if `day_settings.reminders_enabled == 0`:
    - cancel all jobs for date; clear `notification_jobs` for date; return
2. load today slots + events
3. for each slot without event:
    - compute fire times:
        - `preTime = slotTime - preMinutes`
        - `followTime = slotTime + followupMinutes` (simpler, neutral)
    - if time is in the past: skip scheduling for that job type
    - schedule local notifications, store IDs in `notification_jobs`
4. cancel jobs that exist in DB but are no longer needed (slot completed / reminders off / time passed)

### Neutral notification content

- meal: `"{HH:MM} Mahlzeit ist dran"`
- med:  `"{HH:MM} Medikament: {title}"`

---

## 12) First Launch Seed

On first launch:

- Create plan_version:
    - name: `Aktuell`
    - valid_from: today
- Create slots (meals):
    - 07:00, 11:00, 15:00, 18:15, 21:30
- Medication slots initially empty (or seed example placeholders if desired)
- Components library starts empty; user adds via “Neu anlegen”

---

## 13) Acceptance Tests (MVP)

1. Slot can be completed at most once per day (`UNIQUE(date, slot_id)`).
2. After `done`/`skipped`, UI prevents any further action (no edit path exists).
3. “Heute anpassen” creates `day_overrides` only for today; plan recipe stays unchanged.
4. No “Total target” appears anywhere; only `sum(ml)` is displayed (Info).
5. “Reminders today OFF” cancels all scheduled notifications for today.
6. Completing a slot cancels its notifications.
7. `skipped` allows optional note; `done` note optional (if implemented).

---

## 14) Optional Enhancements (Post-MVP)

- “Save as standard” (write snapshot back to plan recipe)
- Plan-versioning: creating new version “valid_from = tomorrow”
- Drag & drop shift / merge (today-only vs from tomorrow)
- Multi-device sync (Supabase) after local app is solid

---

If du willst, kann ich als nächstes **konkrete Beispiel-Queries** (`SELECT`/`INSERT` helpers) und ein kleines **migration runner**-Snippet für `expo-sqlite` ergänzen (damit Claude direkt Code generieren kann, statt nur Spec zu lesen).