# lineupcard.app × Leadoff — integration kit
*Aug 5, 2026 · Companion to WEB_HANDOFF.md (which owns tokens/schema). This kit owns the BRAND CHROME —
the pieces that make the web app feel like the same product a visitor just left on getleadoff.com.
Paste this folder into the Lineup Card App project and work the checklist top to bottom.*

## Why this exists
The marketing site's primary CTA ("Build a lineup") lands people on lineupcard.app. Today that's a
different-looking site with a different name in the URL bar. Connectedness = three layers:
1. **Same design system** — already specced in WEB_HANDOFF.md Part 1 (Crate tokens, sticker buttons, fonts). Do that first.
2. **Same brand chrome** — this kit: logo, favicon, titles, header, and links both directions.
3. **Same domain (later)** — app.getleadoff.com. See §5.

## 1. Logo placement (the rules)
- **App header, light/cream surfaces → `leadoff-logo-ink.svg`** (Version A: ink plate, white letters). Height 32–40px. It is a LINK to getleadoff.com on marketing-ish surfaces (login/signup), and the app's home button once signed in.
- **Dark mode → `leadoff-logo-white.svg`** (Version B). Never recolor, never a third colorway.
- Never render the wordmark below ~100px wide — small spots use the **L tile** (`favicon.svg`).
- "Lineup Card" survives as the FEATURE name (the printable card), not the product name. Header says LEADOFF; the tab/feature can say "Lineup card."

## 2. Favicon + titles + meta
- Replace lineupcard.app's favicon with `favicon.svg` (+ `favicon-32.png`, `favicon-180.png` as apple-touch-icon).
- Title pattern: `Leadoff — <screen>` (e.g., "Leadoff — Today's Order"). Login page: "Leadoff — the coach web app".
- og:title "Leadoff — Build a fair lineup in your browser"; og:image can reuse getleadoff.com/og.png for now.

## 3. The arrival moment (highest-leverage single screen)
The login/signup screen is what CTA-clickers actually see. Make it read as a Leadoff front door:
- Leadoff wordmark (Version A) centered, then: **"The coach web app"** as the kicker, one line under it:
  "Build the lineup here. It lands on every phone Saturday."
- Sticker buttons per Crate spec (green primary "Sign in with Apple"/whatever exists; cream secondary).
- Footer of the auth card: "New here? Leadoff is free for your first 3 players." + link to getleadoff.com/pricing.
- `header-snippet.html` in this folder is a drop-in reference implementation of the header + auth-card chrome.

## 4. Links both directions
- Web app footer (all screens): "A **Leadoff** app · getleadoff.com" (wordmark-free text is fine here).
- Marketing site already points every Build-a-lineup CTA at lineupcard.app — no change needed there.
- When a signed-in coach clicks the header logo → app home. Signed-out → getleadoff.com.

## 5. Domain consolidation (when ready — not required for launch)
Target: **app.getleadoff.com** as the canonical web-app URL (SEO_STRATEGY: getleadoff.com is the only
content domain; the app surface stays noindex). Steps when the time comes:
1. Add app.getleadoff.com as a custom domain on the web app's hosting; keep lineupcard.app serving 301s to it.
2. Swap the ~11 lineupcard.app hrefs in the marketing site (inventory lives in the wireframe's v8.5/v8.6 notes).
3. Update Firebase Auth authorized domains + any OAuth redirect URIs BEFORE flipping (login breaks otherwise).
4. Keep lineupcard.app registered ~forever (printed on old handouts).
Until then: lineupcard.app with full Leadoff chrome is perfectly fine — TeamSnap et al. run app domains too.

## 6. Definition of "connected" (acceptance checklist)
- [ ] Crate tokens live (WEB_HANDOFF Part 1)
- [ ] Leadoff logo in header (correct colorway per surface) + L-tile favicon
- [ ] Titles follow "Leadoff — <screen>"
- [ ] Login screen reads as the Leadoff front door (§3)
- [ ] Footer credit + getleadoff.com link
- [ ] A stranger clicking "Build a lineup on the web" on getleadoff.com would never wonder if they left the product.
