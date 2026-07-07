-- ============================================================
-- Eli's Food App — Supabase cloud schema
-- Run this in the Supabase SQL editor (Dashboard → SQL Editor → New query)
-- ============================================================

-- ---- HOUSEHOLDS ----
CREATE TABLE IF NOT EXISTS households (
  id         TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name       TEXT NOT NULL DEFAULT 'Familie',
  join_code  TEXT NOT NULL UNIQUE,
  timezone   TEXT NOT NULL DEFAULT 'Europe/Zurich',
  created_at TEXT NOT NULL DEFAULT (now() AT TIME ZONE 'UTC')::text
);

-- ---- HOUSEHOLD MEMBERS ----
CREATE TABLE IF NOT EXISTS household_members (
  id           TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  household_id TEXT NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role         TEXT NOT NULL DEFAULT 'caregiver' CHECK (role IN ('admin', 'caregiver')),
  joined_at    TEXT NOT NULL DEFAULT (now() AT TIME ZONE 'UTC')::text,
  UNIQUE(household_id, user_id)
);

-- ---- PLAN VERSIONS ----
CREATE TABLE IF NOT EXISTS plan_versions (
  id           TEXT PRIMARY KEY,
  household_id TEXT NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  valid_from   TEXT NOT NULL,
  created_at   TEXT NOT NULL
);

-- ---- SLOTS ----
CREATE TABLE IF NOT EXISTS slots (
  id              TEXT PRIMARY KEY,
  household_id    TEXT NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  plan_version_id TEXT NOT NULL REFERENCES plan_versions(id) ON DELETE CASCADE,
  type            TEXT NOT NULL CHECK (type IN ('meal', 'med')),
  title           TEXT NOT NULL,
  info            TEXT,
  time_minutes    INTEGER NOT NULL,
  sort_order      INTEGER NOT NULL DEFAULT 0,
  created_at      TEXT NOT NULL
);

-- ---- COMPONENTS (name + category only; is_favorite / last_used_at are local-only) ----
CREATE TABLE IF NOT EXISTS components (
  id           TEXT PRIMARY KEY,
  household_id TEXT NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  category     TEXT
);

-- ---- MEAL RECIPE ITEMS ----
CREATE TABLE IF NOT EXISTS meal_recipe_items (
  id            TEXT PRIMARY KEY,
  household_id  TEXT NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  slot_id       TEXT NOT NULL REFERENCES slots(id) ON DELETE CASCADE,
  component_id  TEXT NOT NULL REFERENCES components(id) ON DELETE RESTRICT,
  ml            INTEGER NOT NULL,
  sort_order    INTEGER NOT NULL DEFAULT 0,
  delivery_form TEXT CHECK (delivery_form IS NULL OR delivery_form IN ('flasche', 'sondomat', 'spritze'))
);

-- ---- EVENTS (insert-only; server UNIQUE enforces first-write-wins) ----
CREATE TABLE IF NOT EXISTS events (
  id           TEXT PRIMARY KEY,
  household_id TEXT NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  date         TEXT NOT NULL,
  slot_id      TEXT NOT NULL REFERENCES slots(id) ON DELETE CASCADE,
  status       TEXT NOT NULL CHECK (status IN ('done', 'skipped')),
  created_at   TEXT NOT NULL,
  note         TEXT,
  UNIQUE(household_id, date, slot_id)
);

-- ---- DAY ACTUALS (last-write-wins by updated_at) ----
CREATE TABLE IF NOT EXISTS day_actuals (
  id           TEXT PRIMARY KEY,
  household_id TEXT NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  date         TEXT NOT NULL,
  slot_id      TEXT NOT NULL REFERENCES slots(id) ON DELETE CASCADE,
  item_key     TEXT NOT NULL,
  component_id TEXT NOT NULL REFERENCES components(id) ON DELETE CASCADE,
  ml           INTEGER NOT NULL CHECK (ml >= 0),
  updated_at   TEXT NOT NULL,
  UNIQUE(household_id, date, slot_id, item_key)
);

-- ---- DAY OVERRIDES ----
CREATE TABLE IF NOT EXISTS day_overrides (
  id            TEXT PRIMARY KEY,
  household_id  TEXT NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  date          TEXT NOT NULL,
  slot_id       TEXT NOT NULL REFERENCES slots(id) ON DELETE CASCADE,
  override_json TEXT NOT NULL,
  created_at    TEXT NOT NULL,
  UNIQUE(household_id, date, slot_id)
);

-- ---- PUSH TOKENS ----
CREATE TABLE IF NOT EXISTS push_tokens (
  id           TEXT PRIMARY KEY,
  household_id TEXT NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  expo_token   TEXT NOT NULL,
  device_name  TEXT,
  updated_at   TEXT NOT NULL,
  UNIQUE(household_id, user_id)
);

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_plan_versions_household   ON plan_versions(household_id);
CREATE INDEX IF NOT EXISTS idx_slots_household           ON slots(household_id);
CREATE INDEX IF NOT EXISTS idx_slots_plan_version        ON slots(plan_version_id);
CREATE INDEX IF NOT EXISTS idx_components_household      ON components(household_id);
CREATE INDEX IF NOT EXISTS idx_recipe_items_slot         ON meal_recipe_items(slot_id);
CREATE INDEX IF NOT EXISTS idx_events_household_date     ON events(household_id, date);
CREATE INDEX IF NOT EXISTS idx_day_actuals_household_date ON day_actuals(household_id, date);
CREATE INDEX IF NOT EXISTS idx_day_overrides_household_date ON day_overrides(household_id, date);
CREATE INDEX IF NOT EXISTS idx_household_members_user    ON household_members(user_id);

-- ============================================================
-- RLS HELPER FUNCTIONS
-- ============================================================
-- Lookup a household by join code without RLS (SECURITY DEFINER).
-- Used by the join flow before the user is a member of the household.
CREATE OR REPLACE FUNCTION get_household_id_by_code(code TEXT)
RETURNS TEXT LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT id FROM households WHERE join_code = upper(trim(code)) LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION is_household_member(hh_id TEXT)
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM household_members
    WHERE household_id = hh_id AND user_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION is_household_admin(hh_id TEXT)
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM household_members
    WHERE household_id = hh_id AND user_id = auth.uid() AND role = 'admin'
  );
$$;

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE households          ENABLE ROW LEVEL SECURITY;
ALTER TABLE household_members   ENABLE ROW LEVEL SECURITY;
ALTER TABLE plan_versions       ENABLE ROW LEVEL SECURITY;
ALTER TABLE slots               ENABLE ROW LEVEL SECURITY;
ALTER TABLE components          ENABLE ROW LEVEL SECURITY;
ALTER TABLE meal_recipe_items   ENABLE ROW LEVEL SECURITY;
ALTER TABLE events              ENABLE ROW LEVEL SECURITY;
ALTER TABLE day_actuals         ENABLE ROW LEVEL SECURITY;
ALTER TABLE day_overrides       ENABLE ROW LEVEL SECURITY;
ALTER TABLE push_tokens         ENABLE ROW LEVEL SECURITY;

-- HOUSEHOLDS
CREATE POLICY "members read own household"
  ON households FOR SELECT USING (is_household_member(id));

CREATE POLICY "authenticated users create household"
  ON households FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- HOUSEHOLD_MEMBERS
CREATE POLICY "members read memberships"
  ON household_members FOR SELECT
  USING (user_id = auth.uid() OR is_household_member(household_id));

CREATE POLICY "self join household"
  ON household_members FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "admin promote member"
  ON household_members FOR UPDATE
  USING (is_household_admin(household_id))
  WITH CHECK (is_household_admin(household_id));

-- PLAN VERSIONS: members read; admins write
CREATE POLICY "members read plan_versions"   ON plan_versions FOR SELECT USING (is_household_member(household_id));
CREATE POLICY "admins insert plan_versions"  ON plan_versions FOR INSERT WITH CHECK (is_household_admin(household_id));
CREATE POLICY "admins update plan_versions"  ON plan_versions FOR UPDATE USING (is_household_admin(household_id));
CREATE POLICY "admins delete plan_versions"  ON plan_versions FOR DELETE USING (is_household_admin(household_id));

-- SLOTS
CREATE POLICY "members read slots"   ON slots FOR SELECT USING (is_household_member(household_id));
CREATE POLICY "admins insert slots"  ON slots FOR INSERT WITH CHECK (is_household_admin(household_id));
CREATE POLICY "admins update slots"  ON slots FOR UPDATE USING (is_household_admin(household_id));
CREATE POLICY "admins delete slots"  ON slots FOR DELETE USING (is_household_admin(household_id));

-- COMPONENTS
CREATE POLICY "members read components"   ON components FOR SELECT USING (is_household_member(household_id));
CREATE POLICY "admins insert components"  ON components FOR INSERT WITH CHECK (is_household_admin(household_id));
CREATE POLICY "admins update components"  ON components FOR UPDATE USING (is_household_admin(household_id));
CREATE POLICY "admins delete components"  ON components FOR DELETE USING (is_household_admin(household_id));

-- MEAL RECIPE ITEMS
CREATE POLICY "members read meal_recipe_items"   ON meal_recipe_items FOR SELECT USING (is_household_member(household_id));
CREATE POLICY "admins insert meal_recipe_items"  ON meal_recipe_items FOR INSERT WITH CHECK (is_household_admin(household_id));
CREATE POLICY "admins update meal_recipe_items"  ON meal_recipe_items FOR UPDATE USING (is_household_admin(household_id));
CREATE POLICY "admins delete meal_recipe_items"  ON meal_recipe_items FOR DELETE USING (is_household_admin(household_id));

-- EVENTS: all members can insert; no updates or deletes (insert-only)
CREATE POLICY "members read events"   ON events FOR SELECT USING (is_household_member(household_id));
CREATE POLICY "members insert events" ON events FOR INSERT WITH CHECK (is_household_member(household_id));

-- DAY ACTUALS: all members read/write
CREATE POLICY "members read day_actuals"   ON day_actuals FOR SELECT USING (is_household_member(household_id));
CREATE POLICY "members insert day_actuals" ON day_actuals FOR INSERT WITH CHECK (is_household_member(household_id));
CREATE POLICY "members update day_actuals" ON day_actuals FOR UPDATE USING (is_household_member(household_id));
CREATE POLICY "members delete day_actuals" ON day_actuals FOR DELETE USING (is_household_member(household_id));

-- DAY OVERRIDES: admins write; all read
CREATE POLICY "members read day_overrides"   ON day_overrides FOR SELECT USING (is_household_member(household_id));
CREATE POLICY "admins insert day_overrides"  ON day_overrides FOR INSERT WITH CHECK (is_household_admin(household_id));
CREATE POLICY "admins update day_overrides"  ON day_overrides FOR UPDATE USING (is_household_admin(household_id));

-- PUSH TOKENS: each user manages their own token
CREATE POLICY "members manage own push_token"
  ON push_tokens FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ============================================================
-- REALTIME
-- ============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE events;
ALTER PUBLICATION supabase_realtime ADD TABLE day_actuals;
ALTER PUBLICATION supabase_realtime ADD TABLE day_overrides;
ALTER PUBLICATION supabase_realtime ADD TABLE plan_versions;
ALTER PUBLICATION supabase_realtime ADD TABLE slots;
ALTER PUBLICATION supabase_realtime ADD TABLE components;
ALTER PUBLICATION supabase_realtime ADD TABLE meal_recipe_items;

-- ============================================================
-- pg_cron: 15-minute meal reminder (run separately after enabling extensions)
-- Uncomment and fill in your project ref + service role key:
-- ============================================================
-- CREATE EXTENSION IF NOT EXISTS pg_cron;
-- CREATE EXTENSION IF NOT EXISTS pg_net;
-- SELECT cron.schedule(
--   'meal-reminders',
--   '* * * * *',
--   $$
--   SELECT net.http_post(
--     url := 'https://<YOUR_PROJECT_REF>.supabase.co/functions/v1/send-meal-reminders',
--     headers := '{"Authorization": "Bearer <YOUR_SERVICE_ROLE_KEY>", "Content-Type": "application/json"}'::jsonb,
--     body := '{}'::jsonb
--   );
--   $$
-- );
