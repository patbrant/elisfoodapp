// Supabase Edge Function: send-meal-reminders
// Triggered by pg_cron every minute.
// Finds meal slots starting in ~15 minutes and sends Expo push notifications
// to all registered devices in the household.
//
// Deploy: supabase functions deploy send-meal-reminders
// Set env in dashboard: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const REMINDER_MINUTES = 15;
const WINDOW_MINUTES = 1; // fire if slot is between 14–16 minutes away

Deno.serve(async (_req: Request) => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const supabase = createClient(supabaseUrl, serviceKey);

  const now = new Date();

  // Load all households with their timezones
  const { data: households, error: hhErr } = await supabase
    .from('households')
    .select('id, timezone');

  if (hhErr || !households) {
    return new Response(JSON.stringify({ error: hhErr?.message }), { status: 500 });
  }

  const results: string[] = [];

  for (const household of households) {
    const hhId: string = household.id;
    const tz: string = household.timezone ?? 'Europe/Zurich';

    // Compute current local time in the household's timezone as minutes since midnight
    const localNow = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hour: 'numeric',
      minute: 'numeric',
      hour12: false,
    }).format(now);

    const [hStr, mStr] = localNow.split(':');
    const localMinutes = parseInt(hStr, 10) * 60 + parseInt(mStr, 10);
    const targetMinutes = localMinutes + REMINDER_MINUTES;

    // Local date in household timezone
    const localDate = new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(now); // YYYY-MM-DD

    // Load slots for this household where time_minutes ≈ targetMinutes (±WINDOW_MINUTES)
    const { data: slots } = await supabase
      .from('slots')
      .select('id, title, time_minutes, type')
      .eq('household_id', hhId)
      .eq('type', 'meal')
      .gte('time_minutes', targetMinutes - WINDOW_MINUTES)
      .lte('time_minutes', targetMinutes + WINDOW_MINUTES);

    if (!slots || slots.length === 0) continue;

    // Check if reminders are enabled for today
    const { data: daySetting } = await supabase
      .from('day_settings')
      .select('reminders_enabled')
      .eq('date', localDate)
      .single();

    if (daySetting && daySetting.reminders_enabled === 0) continue;

    // Filter out already-done slots
    const slotIds: string[] = slots.map((s: { id: string }) => s.id);
    const { data: doneEvents } = await supabase
      .from('events')
      .select('slot_id')
      .eq('household_id', hhId)
      .eq('date', localDate)
      .eq('status', 'done')
      .in('slot_id', slotIds);

    const doneSlotIds = new Set((doneEvents ?? []).map((e: { slot_id: string }) => e.slot_id));
    const pendingSlots = slots.filter((s: { id: string }) => !doneSlotIds.has(s.id));
    if (pendingSlots.length === 0) continue;

    // Load push tokens for this household
    const { data: tokens } = await supabase
      .from('push_tokens')
      .select('expo_token')
      .eq('household_id', hhId);

    if (!tokens || tokens.length === 0) continue;

    const expoTokens: string[] = tokens.map((t: { expo_token: string }) => t.expo_token);

    // Build notification messages
    for (const slot of pendingSlots) {
      const hh = Math.floor(slot.time_minutes / 60).toString().padStart(2, '0');
      const mm = (slot.time_minutes % 60).toString().padStart(2, '0');

      const messages = expoTokens.map((token) => ({
        to: token,
        title: 'Vorbereitung',
        body: `${hh}:${mm} ${slot.title} — in ${REMINDER_MINUTES} Min.`,
        sound: 'default',
        data: { slotId: slot.id, date: localDate },
      }));

      const response = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(messages),
      });

      const result = await response.json();
      results.push(`${hhId}/${slot.id}: ${JSON.stringify(result)}`);
    }
  }

  return new Response(JSON.stringify({ sent: results.length, results }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
