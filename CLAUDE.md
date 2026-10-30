# Lineup Card — Claude Code Project Notes

**Lineup Card** (lineupcard.app) is a vanilla HTML/JS web companion to the Lineup DJ iOS app for youth baseball/softball lineup management. The whole web app lives in one file: `app.html`. There are also `index.html` (marketing), `pricing.html`, and `success.html`.

Tech stack: vanilla HTML/CSS/JavaScript (no framework), Firebase + Firestore (shared with iOS), Firebase Auth (Google + Apple Sign-In), Stripe Checkout via Netlify Functions, Netlify hosting with Pretty URLs enabled (clean paths like `/pricing`, never `/pricing.html` in internal links).

## Critical safety: never interfere with the iOS app

The iOS app is the primary product with paying users. The web shares Firestore data and **must never cause data loss**. Rules for any Firestore write from the web:

- **Always use `{ merge: true }`.** Never plain `set()`. Merge leaves unknown fields alone.
- Only write fields the web is authoritative for, and only the ones changed in this session (write contract v2 below). Never echo back fields we loaded (`walkoutSong`, `voiceIntro`, song/intro fields are iOS-only).
- **Never diff-delete player docs.** Don't list server docs and remove anything "not in state" — that races with iOS-side additions. Only delete via the explicit `_pendingPlayerDeletes` set populated from `removePlayer()` in the current session.
- Always verify ownership (`teamDoc.data().ownerId === currentUser.uid`) before writing.
- Prefer scoped writes (e.g. `saveRosterOnlyToFirestore()`) over whole-team writes.
- Firestore security rules live in the Firebase console / iOS repo, not in this web repo.

## Web ↔ iOS sync (live both ways since Oct 30 2026)

Dan asked for iOS and web to be "fully synced at all times". iOS already listens live, so web writes show up there right away. The web now listens too (read-only `onSnapshot`, see LIVE SYNC in app.html):

- Your teams (owned + joined queries): sidebar, All teams, roles, Team Settings and League Rules forms follow iOS edits.
- The open team's players: the Players table and side panel update live, including players added or deleted on iOS.
- The open schedule's lineups: lineups saved on iOS appear on Schedule.

Local unsaved edits win: a field being edited on the web keeps its value until saved (player fields via `_rosterDirty`, Team Settings via `_settingsDirtyKeys`, League Rules while the save bar is up). The lineup builder keeps its session and re-reads on entry. Listeners never write.

**Write contract v2:** the web writes only the fields a coach changed here (`markPlayerDirty`, `queueRosterWrites`). Clears match iOS: `number` / `namePronunciation` cleared with `FieldValue.delete()` (iOS `clearedPlayerFields`), `prefPos: []`, `fieldPriority: 'both'` and 5/5/5 `battingSkills` written as values (iOS `updateCoachAttributes`). Team Settings writes only edited core fields (`saveTeamSettingsToFirestore`), never players or rules.

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
- "Save as Image" modal: canvas PNG/JPEG export in the Leadoff share look (cream mat, white sheet, logo, green header row), two presets: Phone (640 css px, "First L." names) and Wide (1200 css px, full names). Drawn in `renderLineupImageToCanvas`; keep it matching the printout's screen look.
- **Field view** toggle in step 4: SVG diamond with click-to-pick and drag-and-drop player swaps (HTML5 DnD; click-to-pick is the touch fallback).
- **All Innings** view: grid of mini-fields, one card per inning. Its Print button prints the Field by Inning printout (see Printouts).
- Polish: animated flying clones for drag-and-drop swaps (Web Animations API), data-attrs on bubbles for post-render lookups.

## Printouts (shared with the iOS app, Oct 30 2026)

- One design for every lineup printout and share image: `print-template.html` (Player List) and `print-template-allinnings.html` (Field by Inning) at the site root. **Generated**: edit `print-templates/` (print.css, list.html, allinnings.html, finish.js) and run `node print-templates/build.js`. Never hand-edit the two outputs.
- The live iOS app (3.1+) fetches these exact files from `lineupcard.app/print-template*.html` (newer builds: `app.getleadoff.com`) for Print AND the share image/PDF, fills the `{{GAME}} {{OPPONENT}} {{DATE}} {{FIELD}}` + `{{THEAD}} {{TBODY}}` / `{{BATTING}} {{CARDS}}` tokens, and snapshots 1056x816 about 250ms after load. So: keep the token names, keep each file self-contained (fonts and logo inlined, nothing loads late), and keep both URLs resolving on both domains. A broken template breaks printing for every iPhone at once: render it through `loFillList` / `loFillAllInnings` before pushing.
- The web fills the same templates the same way (`loFillList` / `loFillAllInnings` in app.html mirror Swift's `LineupPrintTemplate`), injects `.lo-print` into `#print-sheet` and `#lo-css` as a print-only style, and runs `#lo-finish` (bench shading, roster density, field spots). Buttons, Cmd+P in the builder or a saved lineup, and File > Print (warm template) all go through `printLineupSheet`.
- Anything that lands on paper is black and neutral gray only (R = G = B, pure #000 ink, bench innings hatched, conflicts marked "P!"), so printers never use color ink (Dan, Oct 30 2026). That is print media, plus `html.lo-paper` for a PDF rendered on screen (iOS adds it before "Share as PDF"). Only the share image (screen media) gets color: cream mat, warm Crate inks, green header row, pennant red. Verify with a saturation check on a print render (max HSL saturation must be 0). The app's colored Crate field (`FIELD_*_CRATE`) is screen-only; printouts use the template's line-art field.
- Sizing (Oct 30 2026): the paper sheet is drawn like an image, always 100 wide by 68 tall (`aspect-ratio` on `.lo-print`), and every size is a multiple of `--u` (1/960 of the sheet width, container units). Print engines disagree on margins and px-per-inch (iOS prints at the printer's own margins and shrinks to its own scale, about 82 CSS px per inch), but they scale width and height together, so the sheet fits one landscape page on Letter (margins up to ~.5in) and A4. Never set a fixed px or inch height on the sheet again. Player List rows split a fixed budget (`--lo-avail` / `--lo-rows`, capped at 40) and the type scales with the row, so 16 players (up to ~20) fit one page; notes take any spare height and drop at 17+. UTL1-3 sit in the field's foul corners, not in a row under it.
- The iOS app bundles copies in `Resources/PrintTemplates/` for offline use: copy the two built files over before each iOS release.

## Mobile

The primary user is a parent, not a coach. Mobile experience matters — test touch device styles via `@media (pointer: coarse)`. The lineup list view uses `pointer: coarse` rules to remove chevrons, center position text, fix inning column widths, and stick the player name column.

## Related project (different repo!)

There's also `lineupdj.app` (marketing site for the iOS app) in a separate repo (`lineup-dj-site`). Different paths, different conventions:
- Workspace: `~/Desktop/Lineup\ DJ/Claude/Lineup\ DJ/lineup-dj-site-main/`
- Git repo: `~/Desktop/lineup-dj-site/`
- A `cp` step IS required for that project (workspace folder `team-builder/` maps to repo folder `lineup-builder/`).

Don't mix the two.
