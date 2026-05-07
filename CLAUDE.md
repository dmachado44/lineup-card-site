# Lineup Card — Claude Code Project Notes

**Lineup Card** (lineupcard.app) is a vanilla HTML/JS web companion to the Lineup DJ iOS app for youth baseball/softball lineup management. The whole web app lives in one file: `app.html`. There are also `index.html` (marketing), `pricing.html`, and `success.html`.

Tech stack: vanilla HTML/CSS/JavaScript (no framework), Firebase + Firestore (shared with iOS), Firebase Auth (Google + Apple Sign-In), Stripe Checkout via Netlify Functions, Netlify hosting with Pretty URLs enabled (clean paths like `/pricing`, never `/pricing.html` in internal links).

## Critical safety: never interfere with the iOS app

The iOS app is the primary product with paying users. The web shares Firestore data and **must never cause data loss**. Rules for any Firestore write from the web:

- **Always use `{ merge: true }`.** Never plain `set()`. Merge leaves unknown fields alone.
- Only write fields the web is authoritative for. Don't echo back fields we loaded but don't manage (`walkoutSong`, `voiceIntro`, `jerseyNumber` are iOS-only).
- **Never diff-delete player docs.** Don't list server docs and remove anything "not in state" — that races with iOS-side additions. Only delete via the explicit `_pendingPlayerDeletes` set populated from `removePlayer()` in the current session.
- Always verify ownership (`teamDoc.data().ownerId === currentUser.uid`) before writing.
- Prefer scoped writes (e.g. `saveRosterOnlyToFirestore()`) over whole-team writes.
- Firestore security rules live in the Firebase console / iOS repo, not in this web repo.

## Web ↔ iOS sync boundaries (intentional, not bugs)

- iOS → web is **not** live-sync. Web does a one-shot `.get()`, not `onSnapshot()`. Changes only appear after refresh.
- Deleting a player in iOS does **not** remove them from web until manual refresh. The web auto-save will not propagate iOS-side deletes.

Do not "fix" these without an explicit request. If live sync is needed, it's a standalone design conversation.

## Project layout

- `app.html` — the entire web app (CSS in inline `<style>`, JS in inline `<script>`)
- `index.html` — marketing/landing
- `pricing.html` — pricing page
- `success.html` — post-checkout (`noindex`)
- `_redirects` — explicit 301s for `.html` → clean paths (Netlify)
- `sitemap.xml`, `robots.txt`
- `assets/` — icons, images
- `netlify/functions/` — Stripe checkout backend (env vars `STRIPE_MONTHLY_PRICE_ID`, `STRIPE_YEARLY_PRICE_ID`)

## Local preview

For UI-only work (most changes), zero-dependency:
```
python3 -m http.server 8000
```
Then open http://localhost:8000/app.

For full preview including Stripe checkout / Netlify Functions, install Netlify CLI once (`npm i -g netlify-cli`) then:
```
netlify dev
```

## Git push — repo lives in iCloud Desktop, NOT `~/Desktop`

The user has iCloud Desktop & Documents sync enabled. The actual repo path is the iCloud copy:

```
cd "$HOME/Library/Mobile Documents/com~apple~CloudDocs/desktop/lineup-card-site" && git add <files> && git commit -m "..." && git push
```

Quote the path with `$HOME` so the inner `~` characters in `com~apple~CloudDocs` aren't expanded by the shell. Do NOT use `~/Desktop/lineup-card-site` — it doesn't exist on this machine.

The Cowork mount IS the git repo — there's no separate copy step.

End every code-change response with a ready-to-paste push command in this format.

## Recently added features (for context)

The Cowork session built out, in order:

- Auto-saved local **drafts** per game (`localStorage`, key `lineupDJ_drafts_v1`), with explicit "Save Draft & Exit" buttons in steps 3 and 4 and "Draft in progress" badges on the schedule view.
- "Edit Lineup" path that loads a saved Firestore lineup back into the builder; subsequent saves merge into the same doc via `state.editingLineupDocId`.
- "Import from Previous" modal in step 4 — pick a past lineup as a starting point.
- "Save as Image" modal — Canvas-based PNG/JPEG export, two presets (mobile 580px, web 1200px).
- **Field view** toggle in step 4: SVG diamond with click-to-pick and drag-and-drop player swaps (HTML5 DnD; click-to-pick is the touch fallback).
- **All Innings** view: grid of mini-fields, one card per inning. Print works via dedicated `#print-allinnings-sheet`. Header markup is shared with the list-view print sheet.
- Polish: animated flying clones for drag-and-drop swaps (Web Animations API), data-attrs on bubbles for post-render lookups.

## Mobile

The primary user is a parent, not a coach. Mobile experience matters — test touch device styles via `@media (pointer: coarse)`. The lineup list view uses `pointer: coarse` rules to remove chevrons, center position text, fix inning column widths, and stick the player name column.

## Related project (different repo!)

There's also `lineupdj.app` (marketing site for the iOS app) in a separate repo (`lineup-dj-site`). Different paths, different conventions:
- Workspace: `~/Desktop/Lineup\ DJ/Claude/Lineup\ DJ/lineup-dj-site-main/`
- Git repo: `~/Desktop/lineup-dj-site/`
- A `cp` step IS required for that project (workspace folder `team-builder/` maps to repo folder `lineup-builder/`).

Don't mix the two.
