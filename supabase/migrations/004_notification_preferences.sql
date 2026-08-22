-- Per-user notification preferences: master toggle + weekday selection.
-- enabled_weekdays: comma-separated ISO weekday numbers (1=Mon, ..., 7=Sun).
-- Edge Function reads this table to decide whether to send push notifications.

CREATE TABLE IF NOT EXISTS notification_preferences (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  household_id TEXT NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  notifications_enabled INTEGER NOT NULL DEFAULT 1,
  enabled_weekdays TEXT NOT NULL DEFAULT '1,2,3,4,5,6,7',
  updated_at TEXT NOT NULL
);

ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users manage own notification_preferences"
  ON notification_preferences FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
