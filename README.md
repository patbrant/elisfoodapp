# Elis Food App

A local-first mobile app for managing a baby's feeding plan across multiple caregivers. Built with Expo (React Native) and Supabase for real-time multi-device sync.

---

## Features

### Today View (`Heute`)
- Displays all meal and medication slots for the current day in chronological order
- Per-slot recipe components with live amount input (ml)
- **Restmenge-Hero**: automatically calculates and prominently displays how much of the last component still needs to be given, based on how much of the earlier components was consumed
- Mark a slot as done (`Erledigt`) with an optional note
- Reset individual or all done slots (with confirmation)
- Syncs in real time across devices — changes appear on other phones without manual refresh

### Plan View (`Plan`)
- Shows all slots (meals and medications) of the currently active plan version
- Admins can add, edit, and delete slots and their recipe items
- Each recipe component has a configurable amount (ml) and delivery method (Flasche / Sondomat / Spritze)
- **Plan versioning**: create a new plan version from the current one via `+ Version`, effective from a chosen date — the old version is preserved in history

### History View (`Verlauf`)
- Lists all plan versions sorted by date, newest first
- Shows which version is currently active
- Tap any version to expand and view its slots

### Multi-Device Sync
- Household-based: one device creates a household and shares a join code with others
- All caregivers share the same feeding plan and see each other's `Erledigt` marks in real time
- Local-first: all reads and writes go to the on-device SQLite database first; Supabase receives changes via an outbox queue, meaning the app works offline and syncs when connectivity returns

---

## Architecture

### Local-First with SQLite + Supabase Outbox

Every write is committed to the local **SQLite** database immediately, then queued in a `sync_outbox` table. A background drain function pushes outbox entries to **Supabase** (PostgreSQL) one by one. Reads always come from SQLite, so the UI is instant and works offline.

```
UI action
  └─ Service (planService / eventService / actualsService)
       ├─ SQLite INSERT / UPDATE / DELETE  (instant, local)
       └─ enqueueOutbox()
            └─ drainOutbox()  (async, background)
                 └─ Supabase upsert / delete
```

On app start and on foreground resume, `pullAll()` fetches all household data from Supabase and upserts it locally. For plan tables (`plan_versions`, `slots`, `components`, `meal_recipe_items`) it also deletes any local rows that are no longer present remotely, keeping Supabase as the authoritative source for plan data.

Supabase Realtime subscriptions push INSERT / UPDATE / DELETE events to all connected devices, so changes propagate without polling.

### Module Layout

```
app/                        # Expo Router screens
  today.tsx                 # Today view
  history.tsx               # Plan version history
  plan/
    index.tsx               # Plan slot list
    slot/[slotId].tsx       # Slot detail & recipe editor
  settings.tsx
  setup.tsx                 # Household create / join

src/
  db/
    index.ts                # DB open, migrations, seed
    migrations.ts           # SQL migration runner
    queries.ts              # Row types, mappers, getActivePlanVersion
    seed.ts                 # First-launch seed (5 default slots)
    supabase.ts             # Supabase client singleton

  domain/
    types.ts                # Slot, Event, TodayItem, …
    schemas.ts              # Zod schemas
    time.ts                 # minutesToHHMM, toLocalISODate
    actualsMath.ts          # suggestedRemainingMl, totalPercentage

  services/
    planService.ts          # Slot / recipe CRUD + plan versioning
    todayService.ts         # getTodayItems (plan + overrides + events + actuals)
    eventService.ts         # createEvent, deleteEvent
    actualsService.ts       # setActualMl, removeActual, removeAllActualsForSlot
    overrideService.ts      # Day-level recipe overrides
    syncService.ts          # pullAll, drainOutbox, enqueueOutbox, realtime
    authService.ts          # Household create / join / logout

  ui/
    TimelineItemCard.tsx    # Meal slot card (today view)
    RecipeCard.tsx          # Component list + Restmenge hero
    SlotRow.tsx             # Plan slot row
    NoteModal.tsx           # Reusable note input modal
    DeliveryBadge.tsx       # Flasche / Sondomat / Spritze badge
    theme.ts                # Colors, radius, shadow

  context/
    HouseholdContext.tsx    # React context: isAdmin, householdId

  hooks/
    useSyncEffect.ts        # pullAll + drainOutbox on foreground resume

supabase/
  migrations/               # SQL applied to the remote Supabase project
```

### Key Design Decisions

| Decision | Rationale |
|---|---|
| SQLite as primary store | Instant reads, full offline support, no loading states for local data |
| Insert-only `events` table (with admin delete) | Prevents accidental data loss; delete path exists for correction but is not default |
| `day_actuals` separate from `events` | Amount entry during a meal is independent of marking it done |
| `day_overrides` stores full JSON snapshot | Simpler than a delta; makes "Heute anpassen" self-contained |
| `valid_from` on plan versions | Allows scheduling future plan changes without losing history |
| `PRAGMA foreign_keys = ON` per connection | SQLite disables FK enforcement by default; enabled explicitly on every open |

---

## Contributing

### Prerequisites

- Node.js 20+
- [Expo CLI](https://docs.expo.dev/get-started/installation/) (`npm install -g expo-cli`)
- [Expo Go](https://expo.dev/go) on a physical device, or an iOS/Android simulator
- A Supabase project with the migrations in `supabase/migrations/` applied

### Setup

```bash
git clone https://github.com/patbrant/elisfoodapp.git
cd elisfoodapp
npm install

# Copy the env template and fill in your Supabase credentials
cp .env.local.example .env.local   # or create .env.local manually
# EXPO_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
# EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJ...
```

### Running locally

```bash
npm start          # Start Metro bundler, scan QR code with Expo Go
npm run ios        # Run on iOS simulator
npm run android    # Run on Android emulator
```

### Supabase migrations

Apply all SQL files in `supabase/migrations/` to your Supabase project in filename order, either via the Supabase dashboard SQL editor or:

```bash
npx supabase db push
```

### Workflow

The project is built in vertical slices. Before starting work:

1. Check the open issues / current slice scope
2. Create a feature branch off `develop`
3. Run `npx tsc --noEmit` before committing — no type errors allowed
4. Test on a physical device with Expo Go (the simulator does not replicate real sync timing)
5. Open a PR against `develop`; squash-merge when approved

### Commit style

```
type(scope): short description

feat(today): add reset button for done slots
fix(sync):   pullAll now removes stale local plan rows
chore:       update expo-sqlite to 16.0.10
```

Types: `feat`, `fix`, `refactor`, `chore`, `debug`, `docs`

### Non-negotiable product rules (SPEC §0)

Before implementing any feature, verify it does not violate these constraints:

- Slot status is `open | done | skipped` only — no `unclear`
- No analytics, compliance reports, streaks, or progress bars
- Meal component amounts are in `ml` with no enforced total target
- German UI strings; English code identifiers and commit messages
