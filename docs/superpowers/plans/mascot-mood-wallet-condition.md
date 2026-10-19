# Plan: Map the 8-emotion otter set to the user's wallet condition

Status: proposed
Scope: `master` tree only — `C:/Users/cubeb/OneDrive/Documents/coding/projects/dompet-bareng`
Assets: `C:/Users/cubeb/OneDrive/Gambar/dompetbareng_otter_set/` (8 × 1254×1254 RGBA, transparent)

---

## 1. Why

The app currently has four moods derived from a single number — the
expense-to-income ratio:

```ts
// lib/companion.ts:61-70
if (ratio > 1 || snap.balance < 0)      mood = 'PANIC';
else if (ratio >= 0.75)                 mood = 'WARNING';
else if (ratio >= 0.5)                  mood = 'NEUTRAL';
else                                    mood = 'HAPPY';
```

The new asset set ships eight expressions. Four replace what exists
(`Happy`, `sleeping`, `crying`, `panic`); four are new (`rich`, `reminder`,
`thinking`, `welcome`). Adding them means the mascot can reflect situations the
ratio alone cannot express — and one of those situations fixes a visible bug:

```ts
// lib/companion.ts:50-53
function expenseRatio(income: number, expense: number): number {
  if (income <= 0) return expense > 0 ? 2 : 0;   // <-- returns 2
  return expense / income;
}
```

A workspace that has recorded expenses but no income yet scores `2`, which is
`> 1`, which yields **PANIC**. A brand-new workspace shows a screaming otter
before the user has done anything wrong. `thinking` and `welcome` exist precisely
for these two states.

## 2. What the new assets actually depict

Verified visually, not by filename:

| file | expression / pose | object drawn |
|---|---|---|
| `Happy.png` | eyes shut, grin, one arm pumped | wallet spilling green bills + gold coins, confetti, sparkles |
| `sleeping.png` | lying on belly, content | blue `Z z z` above head |
| `crying.png` | wailing mouth, paws at cheeks | blue teardrops spraying from each eye |
| `panic.png` | wide eyes, gasping, paws at cheeks | three blue sweat drops, no prop |
| `rich.png` | laughing, hugging a bag | green **Rp** money bag + gold coins + sparkles |
| `reminder.png` | smiling, index finger raised | yellow exclamation burst |
| `thinking.png` | pensive, paw at chin | yellow question mark |
| `welcome.png` | open smile, waving | pink heart + orange motion lines |

`rich` and `reminder` carry fine detail (money bag label, burst lines). They are
the two most likely to mush at render size — see §7.

## 3. Mood model — two axes, eight values

`MascotMood` becomes an eight-member union. The eight resolve through a
**priority-ordered evaluation**, not an equality of importance:

```ts
export type MascotMood =
  | 'WELCOME' | 'THINKING' | 'PANIC' | 'REMINDER'
  | 'WARNING' | 'RICH' | 'NEUTRAL' | 'HAPPY';
```

| # | mood | trigger | reads as |
|---|---|---|---|
| 1 | `WELCOME` | `count === 0` (workspace has never had a transaction) | first run / nothing to judge |
| 2 | `THINKING` | `income <= 0 && expense > 0` (spent but never recorded income) | cannot evaluate yet |
| 3 | `PANIC` | `ratio > 1 \|\| balance < 0` | overspending, negative balance |
| 4 | `REMINDER` | `safeDays <= 3` (runway non-zero but short) **or** budget utilisation `>= 0.9` | nudge, act soon |
| 5 | `WARNING` | `ratio >= 0.75` | caution |
| 6 | `RICH` | `ratio <= 0.25` **and** `surplus >= max(500_000, 0.2 * income)` | genuine surplus |
| 7 | `NEUTRAL` | `ratio >= 0.5` | stable |
| 8 | `HAPPY` | otherwise | healthy and frugal |

Design notes:

- **Severity beats nudge.** `REMINDER` sits below `PANIC` and above `WARNING`.
  When a workspace is genuinely overspending, that state wins — two moods would
  fight over the same sprite and the fix is not a tiebreak rule, it is a
  priority order. `REMINDER` only surfaces in the healthy-to-caution band, where
  short runway or a near-exhausted budget is the most useful thing to say.
- **`RICH` requires money, not merely low spend.** Ratio `<= 0.25` on a trivial
  income is not wealth. The absolute-plus-relative floor stops a workspace with
  Rp 20k income from being handed a money bag.
- **`RICH` splits `HAPPY` at `0.25`; every other threshold is unchanged.** The
  existing `0.5 / 0.75 / 1.0` bands survive, so behaviour for existing users
  moves only in the top quartile. Low regression risk.
- **`THINKING` fixes the `ratio = 2` misfire.** It is ordered above `PANIC`
  deliberately: "no income recorded" and "overspent" are different facts and the
  code currently cannot tell them apart.

### Data available for these triggers

`FinancialSnapshot` (`lib/companion.ts:19-27`) already carries `income`,
`expense`, `balance`, `count`, `byCategory`. `calcSafeDays(expense, balance)`
(`:30-39`) gives runway. Budget figures exist (`supabase/add_realtime_budgets.sql`).

There is **no bills or due-date table** — schema is `workspaces`,
`workspace_members`, `transactions`, `workspace_invites`. So `REMINDER` maps to
derived signals (runway, budget utilisation), **not** to "a bill is due".
Building `REMINDER` around bill dates would require a new table and is out of
scope for this plan.

## 4. Touch points — every site keyed by `MascotMood`

The type appears in `Record<MascotMood, …>` throughout, so TypeScript will
refuse to build until each is filled. That exhaustiveness is the safety net —
do not silence it with casts or `as any`.

**`lib/companion.ts`** (435 lines)

| line | what |
|---|---|
| `6` | `MascotMood` union → eight members |
| `55-70` | `evaluateCompanion` → priority-ordered evaluation of §3 |
| `72` | `moodLabels` id/en ×8 |
| `87` | `configs` — `emoji`, `color`, `softColor` ×8 |
| `94` | `greetings` — id/en ×8 |
| `151` | `statusLabels` id/en ×8 |
| `196` | `MASCOT_IMAGES` ×8 |
| `257` / `302` | `templatesId` / `templatesEn` per `QuickChipId` ×8 |
| `382` / `391` | `tipsEn` / `genericEn` ×8 |
| `418` / `428` | `tips` / `generic` id ×8 |

`evaluateCompanion` computes `safeDays` at `:57` but does not currently use it
in the mood decision — that is the hook for `REMINDER`, so no new computation is
needed.

**`lib/widgetPayload.ts`** (214 lines)

| line | what |
|---|---|
| `13` | `WidgetPayload.mood: MascotMood` — flows through unchanged |
| `98` | `buildWidgetSuggestion` switch → four new branches |
| `177` | `mood: companion.mood` — already generic |
| `208` | default payload `mood: 'NEUTRAL'` — keep |

**`widgets/widgetDesign.ts:16`** — `WIDGET_THEMES: Record<MascotMood, WidgetTheme>`
→ four new palettes: `background`, `surface`, `decoration`, `border`, plus
`accent`, `muted`, `ink` as defined at `:7`.

**`widgets/*.tsx`** — `SmallOtterWidget`, `MediumOtterWidget`,
`LargeOtterWidget`. `MediumOtterWidget:29` already renders
`MASCOT_IMAGES[payload.mood]`; **no change needed for the image itself**. What may
need attention is `mascotSize` / `mascotLeft` / `mascotTop` from
`getWidgetLayout` for art with a wide silhouette (the `rich` money bag).

**`components/MascotOverlay.tsx`** — `MASCOT_SIZE = 72`. Image source comes from
the same `MASCOT_IMAGES`; halo colour resolves per mood in `constants/theme.ts`.

**`constants/theme.ts`** — four new halo/soft colours, kept in sync with
`configs[].softColor`.

### Proposed palette

Family-matched to the existing claymorphism tones
(`HAPPY #E8F9F1`, `NEUTRAL #EFF6FF`, `WARNING #FFF8E7`, `PANIC #FFF0F1`):

| mood | `color` | `softColor` (app halo) | widget `background` |
|---|---|---|---|
| `WELCOME` | `#F97316` | `#FFF1E6` | `#FFE3CC` |
| `THINKING` | `#7C83DB` | `#EEEEFC` | `#E4E4FB` |
| `RICH` | `#E8A400` | `#FFF6DC` | `#FFE9A8` |
| `REMINDER` | `#0EA5A5` | `#E2F7F6` | `#CFEFEA` |

These are starting values — treat them as placeholders to be tuned against the
actual artwork, since `WIDGET_THEMES` colours sit behind the mascot as a
`decoration` disc.

## 5. Asset pipeline

**Use the existing script — do not hand-roll a resize.**
`scripts/prepare_widget_mascots.py` (187 lines, Pillow only) already does this
job properly:

- erases only *edge-connected* near-white pixels, so enclosed white eyes and
  muzzles stay opaque instead of punching holes in the face;
- unmatts a 3px exterior fringe against the local outline colour, so
  antialiased edges do not carry a white halo onto a coloured card;
- fits the artwork into a transparent **1024** canvas (92% of longest side,
  bottom aligned);
- **returns already-transparent input unchanged** — which is exactly what this
  batch is, so running it here is a no-op pass-through rather than a risk;
- groups identical PNGs by SHA-256 and processes each once.

Steps:

1. Run `python scripts/prepare_widget_mascots.py --contact-sheet <sheet>` over
   the eight files.
2. Name outputs to match the `MASCOT_IMAGES` keys exactly: `otter-welcome.png`,
   `otter-thinking.png`, `otter-rich.png`, `otter-reminder.png`, plus the four
   replacements.
3. Copy into **`master`'s** `mascot/`, never into a worktree.
4. Drop the four `cute-flat-chibi-*` files if still present.

There is no black-background case in this batch (all eight are already
transparent), so the `01_panik` flood-fill procedure does not apply here — it is
documented in the `dompet-bareng-ota` skill for if a future export repeats it.

Do not regenerate artwork — the visuals are hand-made and current.

## 6. Deployment

Load skill `dompet-bareng-ota` before running any of this. Two rules from it are
load-bearing here:

- **Publish `eas update` only from `master`.** The `faishaltsq/vodyanoy`
  worktree has no `widgets/`, no `widget-registration.ts`, and no
  `react-native-android-widget` dependency. Publishing from there replaces the
  whole JS bundle with one that never registers the widget — the widget goes
  blank. It has already happened once.
- **Match `runtimeVersion` to the installed build.** Policy is `appVersion`;
  `master` currently sits at `1.3.0` while the device is on `1.2.0`. A mismatch
  means `checkForUpdateAsync()` returns `isAvailable:false` and nothing happens.
  Read `app.json` fresh before publishing; there is no `--runtime-version` flag.

Assets ride the update — `ImageWidget` resolves `require()` to a `file://` URI in
a release bundle and `ResourceUtils.getBitmap()` decodes it with `decodeFile`.
Only a scheme-less value is looked up as a baked `R.drawable`. So replacing PNGs
does **not** require a new APK, but the JS changes above do arrive via OTA only
when the update is published from `master`.

## 7. Verification — judge at render size, not at 1024

This is the lesson from the last mascot pass. `MASCOT_SIZE = 72` means the app
sprite is **~66×66 px** in the mood halo, **48 px** in the sheet header, and the
widget's `mascotSize` is comparable or smaller. Detail tuned for a 1024 canvas is
invisible at that size.

- Build a strip at 66 px and 48 px for all eight, composited over each mood's
  `softColor`, and have it reviewed before shipping.
- Pay particular attention to `rich` (money bag label + coins),
  `reminder` (burst lines), and `thinking` (question mark) — the small glyphs
  are the first things to disappear.
- Check the small widget separately; it is the smallest surface in the product.

## 8. Tests

Existing suites are keyed by mood and will fail to compile once the union grows —
that is intended, it forces each case to be addressed:

- `lib/__tests__/widgetVariants.test.ts`
- `lib/__tests__/widgetVisual.test.ts`
- `lib/__tests__/OtterWidget.test.ts`
- `lib/__tests__/widgetPayload.test.ts`
- `lib/__tests__/widgetEntry.test.ts`
- `lib/__tests__/widgetTaskHandler.test.ts`
- `lib/__tests__/useWidgetSync.test.ts`

Add coverage for the new triggers, especially the two that fix real bugs:

- `income = 0, expense > 0` → `THINKING`, **not** `PANIC`
- `count = 0` → `WELCOME`
- low ratio with trivial income → not `RICH`
- `safeDays <= 3` in the healthy band → `REMINDER`
- `safeDays <= 3` with `ratio > 1` → `PANIC` still wins

Run with `vitest`. The config has migrated from `vitest.config.ts` (tracked,
now deleted from disk) to `vitest.config.mts` (present, still untracked).
Confirm which one `npm test` resolves to before trusting a green run — and note
the shell here exports `NODE_ENV=production`, so a bare `npm install` prunes
`vitest` and `typescript` out of `node_modules`. Reinstall with
`npm install --include=dev --no-audit --no-fund` if the runner vanishes.

## 9. Risks

| risk | note |
|---|---|
| Exhaustive records cascade | One union change touches ~12 records. Expect a long single pass of compile errors; fix them all rather than widening types. |
| Greeting seed shifts | `companion.ts:172` hashes `mood` characters to pick a greeting. New members change hashes → existing users may see a different greeting after update. Cosmetic, not a bug. |
| `REMINDER` vs `WARNING` overlap | Both fire in the `0.75` band. Order decides; do not add a tiebreak rule. |
| Small-size illegibility | §7. The most likely source of a "looks bad" report. |
| Publishing from the wrong tree | §6. Widget blank, whole bundle. |
| Concurrent edits on `master` | Other agents are working here; `app.json` version moved from `1.2.0` to `1.3.0` mid-session. Re-read before every publish. |

## 10. Suggested order

1. Assets: resize, name, place in `master/mascot/`.
2. `MascotMood` union + `evaluateCompanion` priority chain (§3).
3. Clear the compile cascade across `companion.ts` records.
4. Widget: `WIDGET_THEMES` + suggestion branches.
5. Palette tuning against real artwork.
6. Tests (§8).
7. Render-size review (§7).
8. Commit **only** mascot + mood changes; leave other in-flight work alone.
9. Publish OTA from `master`, runtime matched to device (§6).
