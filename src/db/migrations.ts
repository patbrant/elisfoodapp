import type { SQLiteDatabase } from 'expo-sqlite';

const MIGRATION_001 = `
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS plan_versions (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  valid_from TEXT NOT NULL,
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
  date TEXT NOT NULL,
  slot_id TEXT NOT NULL,
  override_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE(date, slot_id),
  FOREIGN KEY(slot_id) REFERENCES slots(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL,
  slot_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('done','skipped')),
  created_at TEXT NOT NULL,
  note TEXT,
  FOREIGN KEY(slot_id) REFERENCES slots(id) ON DELETE CASCADE,
  UNIQUE(date, slot_id)
);

CREATE TABLE IF NOT EXISTS notification_jobs (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL,
  slot_id TEXT NOT NULL,
  notification_id TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('pre','followup')),
  created_at TEXT NOT NULL,
  UNIQUE(date, slot_id, type)
);

CREATE TABLE IF NOT EXISTS day_settings (
  date TEXT PRIMARY KEY,
  reminders_enabled INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
`;

const MIGRATION_002 = `
ALTER TABLE components ADD COLUMN delivery_form TEXT
  CHECK (delivery_form IS NULL OR delivery_form IN ('flasche', 'sonde'));
`;

const MIGRATION_003 = `
CREATE TABLE IF NOT EXISTS day_actuals (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL,
  slot_id TEXT NOT NULL,
  component_id TEXT NOT NULL,
  ml INTEGER NOT NULL CHECK (ml >= 0),
  updated_at TEXT NOT NULL,
  UNIQUE(date, slot_id, component_id),
  FOREIGN KEY(slot_id) REFERENCES slots(id) ON DELETE CASCADE,
  FOREIGN KEY(component_id) REFERENCES components(id) ON DELETE CASCADE
);
`;

const MIGRATION_004 = `
ALTER TABLE meal_recipe_items ADD COLUMN delivery_form TEXT
  CHECK (delivery_form IS NULL OR delivery_form IN ('flasche', 'sonde'));
UPDATE meal_recipe_items SET delivery_form = (
  SELECT delivery_form FROM components WHERE components.id = meal_recipe_items.component_id
);
ALTER TABLE components DROP COLUMN delivery_form;
`;

const MIGRATION_005 = `
CREATE TABLE meal_recipe_items_new (
  id TEXT PRIMARY KEY,
  slot_id TEXT NOT NULL,
  component_id TEXT NOT NULL,
  ml INTEGER NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  delivery_form TEXT CHECK (delivery_form IS NULL OR delivery_form IN ('flasche', 'sondomat', 'spritze')),
  FOREIGN KEY(slot_id) REFERENCES slots(id) ON DELETE CASCADE,
  FOREIGN KEY(component_id) REFERENCES components(id) ON DELETE RESTRICT
);
INSERT INTO meal_recipe_items_new
  SELECT id, slot_id, component_id, ml, sort_order,
    CASE delivery_form WHEN 'sonde' THEN 'sondomat' ELSE delivery_form END
  FROM meal_recipe_items;
DROP TABLE meal_recipe_items;
ALTER TABLE meal_recipe_items_new RENAME TO meal_recipe_items;
`;

const MIGRATIONS: ReadonlyArray<string> = [MIGRATION_001, MIGRATION_002, MIGRATION_003, MIGRATION_004, MIGRATION_005];

export async function runMigrations(db: SQLiteDatabase): Promise<void> {
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const currentVersion = row?.user_version ?? 0;

  for (let i = currentVersion; i < MIGRATIONS.length; i++) {
    await db.execAsync(MIGRATIONS[i]);
    await db.execAsync(`PRAGMA user_version = ${i + 1}`);
  }
}
