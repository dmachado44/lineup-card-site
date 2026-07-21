# Lineup DJ Web — Implementation Strategy

**Companion to:** `WEB_HANDOFF.md` (iOS → web handoff, v1.0)
**Date:** July 21, 2026
**Grounded in:** an audit of `app.html` as of this date (9,654 lines)

---

## 0. Where we actually are (audit summary)

The handoff's work is smaller than it looks, because the current codebase already has the right bones:

| Handoff requirement | Current state | Gap size |
|---|---|---|
| Crate reskin (Part 1) | CSS custom properties already exist in one `:root` block (~line 72); styling is ~99% class-based (only ~66 inline styles, mostly `display:none` toggles); one 2,900-line `<style>` block | **Medium** — token swap + fonts + new component classes + dark mode (net-new) |
| Roster-ID fix (2.3) | Roster saves already strip the local `imp_`/`p_` prefixes to get Firestore doc IDs; **lineup saves don't** — `saveLineupToFirestore` writes the raw local ID | **Tiny** — one mapping at the lineup-save site + re-stamp `p_*` ids after roster save |
| Engine parity (2.4) | Rules editor UI + state + Firestore plumbing for all 7 `leagueRules` fields already exist and round-trip correctly. Engine consumes `activePositions` / `maxSamePosition` / `allowBackToBack` only | **Small** — engine-only change for `allPlayersBat` cap, `pitcherCanReturn`, `maxInningsPitched` |
| Targeted writes contract | Already compliant: every write uses `{merge:true}`, ownership-gated, conditional field writes, deletes only via `_pendingPlayerDeletes` | **None** — preserve it |
| Three-tab IA + coach gating (Part 3) | Current IA is dashboard → per-team pages (players / schedule / lineups / settings) + a 5-step builder wizard. No role model at all — only `ownerId` gating | **Large** — IA restructure + roles |
| Team management (invite codes, members) | Greenfield. Invite-code lookup exists only as orphaned dead code; teams load from `users/{uid}.ownedTeamIds` + `memberTeamIds` doc lists, not queries | **Large** — new feature work |
| Subscriptions | Stripe via Netlify function; gate at builder step 4; fail-open on read error | Leave as-is until Team Pass design lands |

Two codebase facts worth keeping in mind throughout:

- **`users/{uid}` field mismatch:** team docs store `memberIds`, but the web loads teams from `users/{uid}.memberTeamIds`. iOS queries `memberIds array_contains`. When membership work starts (Phase 4), converge on the handoff's query pattern (owned = `ownerId ==`, joined = `memberIds array_contains`) rather than the user-doc ID lists.
- **Engine magic numbers are load-bearing** (25 attempts, jitter max 5, bias ≥ 0.75 repair gate, ×10000 violation score). Parity work adds constraints *inside* the existing legality/repair structure; it does not refactor it.

---

## 1. Phasing

Ordering principle (agreed): **close the live data-contract gaps first** — they affect paying customers on both clients today and are tiny — then do the visible work. Branding decision (agreed): **app.html reskins to Crate and may adopt Lineup DJ naming; index / pricing / for-leagues marketing pages are a later, separate pass.**

### Phase 1 — Contract fixes (ship first, one small commit) ✅ this session

**1a. Roster-ID fix (handoff 2.3 — "the single most important web fix").**
- At lineup save, map every `players[].playerId` through the same prefix-strip the roster save uses (`replace(/^(imp_|p_)/, '')`), so saved lineups carry the shared roster doc IDs and iOS's exact-ID resolution works without falling back to name matching.
- After a roster save creates docs for `p_*` (locally-added) players, re-stamp the in-memory player ids to `imp_<docId>` so the rest of the session — including any lineup built afterwards — references the canonical ID.
- Guard rail from the July 19 incident: never save a lineup whose players resolved to zero roster IDs — but note web builds lineups *from* its roster state, so post-fix the IDs are correct by construction.

**1b. Engine parity (handoff 2.4).** All three inside the existing structure:
- `allPlayersBat` OFF → cap the generated batting order at `activePositions.count`. Everyone still fields via rotation; no batting slot beyond the cap. Match the iOS nuance: the decode default is `false` but ON is the shipped norm — the cap applies through the builder's effective-rules path only (don't "clean it up").
- `pitcherCanReturn` OFF → a player's innings at P must form one contiguous stint. Enforced as a legality/violation rule so the candidate-scoring + repair passes respect it.
- `maxInningsPitched` N → per-player cap on total innings at P (0 = unlimited), same treatment.
- Surface violations in the existing conflict-highlight UI so manual edits get the same feedback as generated grids.

Risk: near-zero for 1a (write-shape unchanged, values corrected). Low for 1b (engine is client-side; worst case is a suboptimal grid, not bad data). Test with the throwaway-team round-trip before pushing (iOS "Set as game day order" against a web-saved lineup must resolve all players by exact ID).

### Phase 2 — Crate reskin (highest visible payoff, zero data risk)

Do it as a layered sweep of the single `<style>` block, not a rewrite:

1. **Tokens first.** Replace the current `:root` values with the Part 1.1 palette verbatim, keeping existing custom-property *names* where they map cleanly and adding the new ones (`--page`, `--panel`, `--ink`, `--accent-down`, `--on-accent`, sticker chrome, pennant, washes). Add the dark-mode `@media (prefers-color-scheme: dark)` block — net-new; the current app has no dark mode. Audit the `--accent`-as-team-color override (line ~99): team color must not fight the one-signature-color rule — likely demote team color to emblem/badge use.
2. **Fonts.** Add Google Fonts (Barlow Semi Condensed 500/600/700; Sofia Sans Extra Condensed 900) with `font-display: swap`; retire the SF/system stack; apply the type scale from 1.3.
3. **Components.** Add `.sticker` (with the correct press mechanics — face translates 4px into a shadow that never moves), the two-tier card classes (`.card` hairline / `.card--emph`, radius 20px, one emphasis per screen), tertiary hairline buttons, the pennant kicker, `EmptyStateCard`, text-field treatment. Then migrate existing `.btn*` call sites onto them; retire pill radius for actionable buttons (keep for badges/chips).
4. **Rules sweep.** The six coherence rules + locked decisions: `--page` on `<body>` and `--panel` on cards (the #1 reskin miss), never white text on green, section headers 17px semibold sentence-case *outside* panels, all-caps only for tabs/kickers/sticker labels, motion tokens (snappy/quick springs, staggered entrances, `prefers-reduced-motion`).
5. **Per-screen pass** over the 7 views (auth, dashboard, paywall, lineups, schedule, players, builder) choosing each screen's one emphasis element and one pennant.

Verification: side-by-side screenshots against iOS; contrast receipts are pre-computed in the handoff — don't re-litigate, just apply the fill-only / step-down rules.

### Phase 3 — Consolidation, not restructure (REVISED July 21, per Dan)

**Decision: the web's existing IA (sidebar + dashboard + per-team pages) stays.** It predates the handoff's three-tab prescription and works well; we adopt from iOS only what genuinely cleans things up:

- **Past Lineups folds into Schedule** (shipped) — one consolidated Schedule page for every team, calendar-linked or not: upcoming games (with NEXT GAME pennant on the soonest), past games, and saved lineups that don't match a calendar game. The separate Past Lineups nav entry is gone; `#/team/:id/lineups` redirects to the schedule; the lineup-detail route survives for deep links.
- **iOS vocabulary** (shipped) — "Build Lineup" replaces "Create Lineup" everywhere; schedule sections are sentence-case.
- **Gate at the door** (shipped) — the subscription gate moved from builder step 4 to the single `enterBuilder` entry point (settings mode never gated); step-4 check remains as a backstop.
- Today's Order and the full three-tab mirror are NOT being adopted for now.

**📌 PINNED — roles need a design solve before implementation.** Open questions: what do members/parents see on web (Today's Order equivalent? read-only Players?); how does a member even reach a team on web before invite codes exist (Phase 4); does `isCoach` gating hide pages or disable actions; how do web-only teams (owner-only today) migrate. Firestore rules already enforce the write side (coach-only player fields via affectedKeys), so this is purely a UX/product design question. Revisit alongside Phase 4 invite codes.

### Phase 4 — Team management parity

- **Invite codes:** generate the 8-char uppercase code on web team creation, backfill for existing web-created teams (they have none — the blank-code misjoin incident), and guard the join flow against empty codes. Join = the `where('inviteCode','==',code).limit(1)` lookup the rules already support.
- **Members list with roles**, coach promotion (`coachIds` writable by owner only), `memberNames` map upkeep.
- **League settings editor** stays payload-identical to iOS (it already is — keep the write-contract shape pinned; consider porting a few of iOS's seeded engine tests to a small JS test file to pin both engine and payload).
- Converge team loading on `ownerId ==` / `memberIds array_contains` queries here.

### Phase 5 — Web-native bonuses

Print/PDF via a first-class `@media print` stylesheet (the current image-export code can remain as a fallback), shared-lineup polish ("First L." name privacy default carries to all public surfaces), read-only big-type TV/scoreboard view of Today's Order. Team Pass waits for the entitlement design; marketing-page rebrand is its own pass.

---

## 2. Standing rules for every phase

These never relax, and they're already true of the codebase — the job is not to regress them:

1. Merge-only, targeted writes; never echo iOS-owned fields (announcer, game intro, offline, playlist families; players' DJ family).
2. Deletes only via session-scoped `_pendingPlayerDeletes`; never diff-delete.
3. iOS → web stays one-shot `.get()` — no `onSnapshot` without an explicit product decision.
4. `updatedAt` server-timestamped on team saves.
5. Rules deploys: console-diff first, always (deployed set has drifted ahead of the repo before).
6. "Design decisions that look like bugs" (jersey-number full-accent, `coEd` no-op, `allPlayersBat` decode default) stay as designed.
7. Throwaway-team round-trip test before any commit that touches a write path.

---

## 3. Sequencing summary

| Phase | Scope | Risk | Est. size |
|---|---|---|---|
| 1 | Roster-ID fix + engine parity | Low (write-shape unchanged; engine client-side) | Small — this session |
| 2 | Crate reskin (tokens → fonts → components → rules → screens) | None to data; visual regressions possible | Medium — one focused pass, screen-by-screen commits |
| 3 | Three-tab IA + roles + gate-at-the-door | Medium (navigation rewrite) | Medium-large |
| 4 | Invite codes, members, settings parity, query convergence | Medium (touches membership writes) | Medium |
| 5 | Print, TV view, share polish | Low | Small, incremental |
