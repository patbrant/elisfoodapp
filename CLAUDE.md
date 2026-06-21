# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Current Repo State

Bootstrap (Slice 0) is complete: Expo SDK 56 project lives **in-place at the repo root**, all SPEC §1 deps installed (`expo-router`, `expo-notifications`, `expo-device`, `expo-constants`, `expo-sqlite`, `expo-crypto`, `zod`, `date-fns`, `date-fns-tz`), all 5 routes from SPEC §2 exist as placeholders, Migration 001 from SPEC §3 runs on first launch, first-launch seed from SPEC §12 creates `plan_version "Aktuell"` + 5 meal slots.

**Read `SPEC.md` first.** It is the source of truth for product rules, schema, routes, services, and acceptance tests. Sections referenced below map directly to numbered headings in that file.

**Expo SDK 56 docs**: https://docs.expo.dev/versions/v56.0.0/ — consult before using any Expo API, since SDK semantics shift across versions.

## Slicing & Workflow

The app is built in **7 vertical slices** after the horizontal Slice 0 bootstrap. Each slice has its own planning round (plan-mode), implementation, code-review, single commit, and Expo Go verification before the next slice starts. The full workflow plan lives in the conversation history; recall it if you need to know what comes next or what a slice's scope is.

## Tooling Notes

- `.npmrc` sets `legacy-peer-deps=true` — required because Expo SDK 56's transitive deps (react-dom 19.2.7 vs react 19.2.3) trip strict peer resolution. Don't remove.
- `expo-crypto.randomUUID()` is the canonical ID generator for `id TEXT PRIMARY KEY` rows.
- `PRAGMA foreign_keys = ON` must be set **per connection** (not just in the migration) — done in `src/db/index.ts::openAndInit`.

## Non-Negotiable Product Rules (SPEC §0)

These rules constrain the entire design and must not be violated:

- Item status is **only** `open | done | skipped`. There is no `unclear`.
- **`done` is final** — no edit, no undo, no backdate. The DB enforces this via `UNIQUE(date, slot_id)` on `events`, and the UI must disable actions once an event exists for a slot.
- When checking off an item, **do not capture** quantity, method, or effective time.
- Meal components are tracked in `ml` with **no total target** — only an informational `sum(ml)` is shown. Never add Soll/Ist comparisons, warnings, or compliance indicators.
- No analytics, compliance reports, streaks, or "who forgot what" surfaces.
- `skipped` may have an optional note; `done` note is optional.

These rules are product-level, not stylistic. If a feature request seems to violate one, surface the conflict before implementing.

## Architecture (SPEC §3, §5, §7)

The app is **local-first** with SQLite as the source of truth. Key architectural decisions:

- **`events` is insert-only.** One row per `(date, slot_id)`. No update path exists in the codebase.
- **`day_overrides` stores a full snapshot JSON**, not a delta, for the meal recipe on a given day. This makes "Heute anpassen" simpler at the cost of some redundancy — keep it this way.
- **Times are stored as `time_minutes`** (minutes since midnight), not as `HH:MM` strings or timestamps. Convert at the UI boundary using helpers in `src/domain/time.ts`.
- **Plan versions are time-anchored** via `valid_from`. The "active" plan version on any given date is the one with the latest `valid_from <= date`.

### The Today Aggregation (SPEC §7)

`getTodayItems(date)` is the central read-path and the only place where plan + override + event data are joined. Its algorithm is specified precisely in SPEC.md §7 — follow it exactly:

1. Resolve active plan version for the date.
2. Load that version's slots (sorted by `time_minutes ASC, sort_order ASC`).
3. Load `day_overrides` and `events` for the date.
4. For each meal slot, the effective recipe is the override snapshot if one exists, otherwise the slot's `meal_recipe_items`.
5. `totalMl` is informational only.

### Notifications (SPEC §11)

- Scheduled only for **today** in MVP (no pre-scheduling tomorrow).
- Every scheduled notification is mirrored in `notification_jobs` so we can cancel deterministically.
- `syncTodayNotifications(date)` is the single entry point — call it after any change that affects what should fire (event created, reminders toggled, plan edited, override applied).
- Completing a slot must cancel its `pre` and `followup` notifications.

### Module Layout (SPEC §5)

```
app/                      # expo-router screens
src/
  db/                     # migrations, queries, sqlite handle
  domain/                 # types.ts, schemas.ts (zod), time.ts
  services/               # todayService, overrideService, eventService, notificationService
  ui/                     # presentational components
```

Services own write operations and the cross-table logic; screens call services, not `db/queries.ts` directly.

## Language

The product spec is written in **German**; user-facing strings are German (e.g., `"{HH:MM} Mahlzeit ist dran"`). Code identifiers, comments, and commit messages should remain in English unless matching an existing convention.

## Acceptance Tests (SPEC §13)

Before declaring a feature done, verify against the seven acceptance tests in SPEC.md §13. They encode the non-negotiables as concrete checks.
