import { getSupabaseClient } from '../db/supabase';
import type { HouseholdContext } from './authService';

export type NotificationPreferences = {
  notificationsEnabled: boolean;
  enabledWeekdays: number[]; // ISO weekday numbers: 1=Mon, ..., 7=Sun
};

const DEFAULT_PREFS: NotificationPreferences = {
  notificationsEnabled: true,
  enabledWeekdays: [1, 2, 3, 4, 5, 6, 7],
};

export async function loadNotificationPreferences(
  context: HouseholdContext,
): Promise<NotificationPreferences> {
  const supabase = getSupabaseClient();
  const { data } = await supabase
    .from('notification_preferences')
    .select('notifications_enabled, enabled_weekdays')
    .eq('user_id', context.userId)
    .single();

  if (!data) return DEFAULT_PREFS;

  return {
    notificationsEnabled: data.notifications_enabled === 1,
    enabledWeekdays: data.enabled_weekdays
      .split(',')
      .map(Number)
      .filter((n: number) => n >= 1 && n <= 7),
  };
}

export async function saveNotificationPreferences(
  context: HouseholdContext,
  prefs: NotificationPreferences,
): Promise<void> {
  const supabase = getSupabaseClient();
  await supabase.from('notification_preferences').upsert(
    {
      user_id: context.userId,
      household_id: context.householdId,
      notifications_enabled: prefs.notificationsEnabled ? 1 : 0,
      enabled_weekdays: prefs.enabledWeekdays.sort((a, b) => a - b).join(','),
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' },
  );
}
