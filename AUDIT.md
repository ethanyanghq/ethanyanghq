# UI/UX Audit — eyanghq.com

Dogfooded with Playwright across 8 viewport configurations (320, 360, 390, 820, 1024×500, 1280, 1440, 1920). Screenshots, DOM dumps, and console logs in `/tmp/audit/`.

The site is in good shape. The De Stijl + Collison instinct is real and largely intact. The bugs below are mostly edges (small viewports) and a11y. The style notes are about pushing the De Stijl reference further without losing your minimalism.

---

## Part 1 — Usability & bug audit

### Critical

**1. Header "you are here" state disappears when the cursor leaves the box.** `src/main.ts:1925–2046, 2370–2445`
The active page (WORK / MORE / NAME) is signalled only via `progress` (filled hover-rect width). On click → `setState({page})` → full re-render → new DOM with `progress=0`. The page indicator only "sticks" because the cursor happens to still be over the box and re-fires `pointerenter`. Move the mouse away (very common after a click on mobile/touch) and there is *no visual indication of what page you're on*. See `desktop-1440-work-published.png` — WORK header has no fill even though we're on the work page.
**Fix:** drive `progress` from a derived state — `progress = isActive ? 1 : hover ? 1 : 0` — and rebuild it each render based on `state.page === headerKeyToPage(key)`. Or render an "active" persistent fill rect separate from the hover rect.

**2. Header navigation is invisible to screen readers and keyboards.** `src/main.ts:2026–2046`
The hit `<rect>` for NAME / WORK / MORE has no `role`, no `aria-label`, no `tabindex`, no keydown handler. Tab order skips the entire navigation. Only the 4 contact buttons + the work-section chevron are focusable (audit reports `focusables count: 6` on desktop, `4` on mobile).
**Fix:** mirror what you did on the chevron — `role="button"`, `tabindex="0"`, `aria-label="Go to work"` + Enter/Space keydown. Also add `aria-current="page"` on the active one.

**3. Diamond and circle are anchor links to off-site pages with no text/aria affordance.** `src/main.ts:2136–2143, 2161–2165`
The pink diamond opens armada.build, the blue circle opens cornellclaude.club. These are decorative shapes with no visible text — a sighted user has no way to know they are links, and a screen-reader user gets no label at all (the `<a>` wraps an unlabeled polygon/circle). They register as a11y violations.
**Fix:** add `aria-label="Armada (current project)"` etc. via `<title>` children on the `<a>` (SVG-native tooltip + accessible name). Optionally a tiny static "↗" or label that fades in on hover so sighted users know they're interactive.

**4. Narrow viewport (≤320 px) cannot reach the work-section toggle.** Confirmed via scroll test:
```
narrow info: { bodySH:635, htmlSH:568, innerH:568, svgH:635 }
after scrollTo: { scrollY:0, docY:0, bodyY:0 }
```
The SVG height grows past the viewport, but `html { height:100% }` clamps `documentElement.scrollHeight` to viewport. The JS tries to flip `overflowY` to `auto`, but with html forced to 100% height the page is unscrollable. So on a 320-wide phone the chevron at y≈572 is partly cut off and *cannot be revealed*. Toggle to "published" is unreachable on the smallest devices.
**Fix:** drop `html, body { height: 100% }` and instead set `min-height: 100dvh` on the body; let document height grow naturally when `shouldScroll` is true.

**5. ETHAN YANG header text overlaps the WORK box on narrow viewports.** See `narrow-320-work-built.png`. At 320 px, NAME box width = 160 px but the title text + padding is ~170 px. The "G" of "YANG" disappears under the WORK rectangle.
**Fix:** at compact width, either (a) shrink the title further (`titleSize` already scales but the box ratio doesn't), (b) swap to "ETHAN" only (drop "YANG") under some breakpoint, or (c) re-allocate header widths so NAME gets ≥55% on narrow.

**6. Right-edge text clipping on narrow.** `narrow-320-work-built.png` — "Visualizing $65M in participatory budg…" runs off the right edge. The `stackedWidth` clamp lets the text exceed the container at the smallest width because `availableWidth` doesn't account for the actual text measure.
**Fix:** wrap long detail strings, or reduce `t.body.size` further at compact widths, or reduce `stackedInset` minimum.

**7. Memory/CPU leak: chevron pulse interval is never cleared.** `src/main.ts:1500–1524`
The `setInterval` for the idle chevron nudge is supposed to be cleaned up by a `MutationObserver` watching `parent` (infoGroup). But `render()` calls `svg.replaceChildren()` (line 1878) which detaches infoGroup whole — its child list never mutates again, so the observer never fires, and the 1-second interval keeps running. Every navigation to work + back leaves another interval behind. Animates `chevronGroup` even after it's detached.
**Fix:** return a cleanup function from `renderManifestoPreview` and call it from `commitRender` (alongside `cleanupInteractions?.()`). Or skip the MutationObserver entirely and tie the interval to a `setupInteractions` cleanup.

### Significant

**8. The De Stijl composition vanishes on mobile.** `src/main.ts:2280` — when stacked + compact, `contentGroup.opacity = 0`. On a 390-wide phone, the diamond, circle, panel, and diagonals are completely gone. The site loses its identity on the device most people will see it on.
**Fix:** show a *condensed* composition on mobile — a single small diamond+circle motif anchored to the top-right or as a header background watermark. See style notes below.

**9. Spotify embed appears to anchor incorrectly after the SVG re-flows.** `desktop-1440-more-spotify.png` shows the Homage row hidden but no visible iframe at the expected spot. The overlay uses fixed positioning computed once from `svg.getBoundingClientRect()` — if the SVG re-paints between click and iframe-load, the embed lands off-spot. Also the embed uses absolute `position: fixed` without any offset compensation for scrolled documents on tall viewports.
**Fix:** position the iframe as an SVG `<foreignObject>` inside the same coordinate space, or re-anchor on `resize`/`scroll`.

**10. "thinking?" cursive text is partially behind the blue circle and partially behind the diagonal line.** This appears intentional but on every viewport the word reads as "thi**ki**ng?" because the circle and the diagonal both clip glyph centers. See `desktop-1440-home.png` — "ki" of "thinking?" is half-eaten.
**Fix:** raise `text` order above `circle` (it's already after, but the soft filter makes it look like it's behind), OR reduce the soft-shadow opacity, OR shift `thinkingOffsetXFromCircleCenter` so the word reads cleanly. As-is, the easter egg is muddy rather than mysterious.

**11. Tablet (768–1079 px) renders the composition at 14% opacity *behind* the centered text.** See `tablet-820-home.png`. The ghost diamond bleeds into the body copy, decorations float in a dead zone, and there's massive empty space below. It feels like a layout in transition — the 14% trick works at 1024×500 (the composition becomes wallpaper) but fails at 820×1180 because the tall canvas exposes too much background.
**Fix:** at tablet portrait, either (a) restore full-opacity composition aligned to one corner, or (b) suppress it entirely (compact treatment) and use the saved space for richer content.

**12. Custom green cursor is forced on every element via `!important`.** `index.html:42–44`. Fine for the playful aesthetic, but: it overrides browser/OS accessibility cursors (high contrast, large pointer) which is a real concern; and the `1 1` hotspot is off (the visible arrow tip is at ~`11,8` of the 12×16 viewBox, not at `1,1`), so clicks may register pixel-offset from where users think they're aiming.
**Fix:** drop `!important`, fix the hotspot to match the polygon tip, and respect `prefers-contrast` / forced-colors mode.

**13. Empty-state vertical space on mobile home.** `mobile-390-home.png` shows ~70% of the screen blank below the social icons. With the composition removed, the page reads as "thin" even though there's plenty of content to potentially surface (work, more).
**Fix:** push hero down to vertically center, or add a small mobile-only "↓ work / more" affordance beneath the icons.

### Minor

- **No SEO/social meta beyond `<title>` and `description`.** Missing `og:image`, `og:title`, `twitter:card`, canonical URL. Sharing on X/LinkedIn (your own contact links) will render an unstyled card.
- **Title is just "Ethan Yang"** — consider "Ethan Yang — builder & writer at Cornell" or letting it change per page (e.g., `Ethan Yang · Work`) to help bookmarks.
- **No `apple-touch-icon`** — saved-to-home-screen on iOS will get a generic blob.
- **`http://github.com/...`** at line 882 — should be `https://`. The redirect adds a needless hop.
- **No `prefers-color-scheme: dark` handling.** The cream-on-cream palette is dark-mode-hostile but doesn't even acknowledge dark mode; consider a graceful inverted palette with the same shapes.
- **Reduced-motion path is partial** — the chevron's idle `setInterval` pulse fires regardless. A viewer with reduced-motion preference still sees it nudge every second.
- **`ETHAN YANG` is 100% letter-tight at 70px** — consider `letter-spacing: -0.01em` for the title.
- **Diagonal lines use `vector-effect: non-scaling-stroke`** which is great, but on Retina displays the 1px stroke can render at 0.5 device-px and look anti-aliased to invisibility against `#FAF7F3`. Bump to `1.25` or pin via `stroke-width` in CSS pixels.

### What works well (don't change)

- Email copy fallback handles the no-clipboard-API path correctly. Tested: `Copied email`, clipboard contained `ethanyanghq@gmail.com` on every viewport.
- `<noscript>` fallback exists.
- 44×44 minimum touch targets are respected on the email and social buttons.
- `aria-live` announcer for copy feedback is a really nice touch.
- `preserveAspectRatio="none"` + viewBox tied to the actual viewport prevents horizontal scrollbar at every width tested ≥360.
- Reduced-motion respected for fade/translate animations on work items.

---

## Part 2 — Style audit (De Stijl × Collison-minimalism)

You're already 70% of the way there. The hardest part — the *attitude* — is right. The composition reads as Doesburg's *Counter-Composition V* (1924) translated to CSS: 45° diagonals, a primary-color polygon, a circle, a rectangle, set against a light field. The text column is pure Collison: one column of left-aligned copy, no chrome, no gradients, no glassmorphism, italic for citation, period.

But you're hedging in two ways that flatten both references. Doesburg was *bold* — he picked four colors and four shapes and committed. Collison is *bare* — he doesn't decorate. You're between them: the palette is muted (so the De Stijl reads as "antique illustration" rather than "modernist statement"), and the page is busy enough (diamond + circle + panel + diagonals + diagonal-cursor + cursive ghost text + bold sans hero) that the Collison restraint slips.

Pick a side per element and the whole composition tightens.

### Color

**Current:** `#FAF7F3` cream, `#3A3530` warm-black, `#CFA39C` dusty rose, `#8A99B7` slate blue, `#EEEEEE` neutral grey, `#9AAF97` sage cursor.

This is a *Pinterest De Stijl*. Doesburg's actual palette is unforgiving: lead white, ivory black, a very specific bus-stop red (close to RAL 3020), a cobalt-leaning ultramarine, and a chrome yellow. Your dusty rose reads as bedroom-decor rather than constructivist. The slate blue is closer but still tonally close to your background.

**Two viable directions:**

(a) **Quiet De Stijl** (lean into your current move). Keep the cream + warm-black + soft shapes, but commit to *one* color holding the energy. Drop the slate blue circle entirely (move the circle to a flat dark outline), make the diamond either fully `#CFA39C` or replace with a muted Mondrian-yellow `#E2C66B`. Result: cleaner hierarchy, less competition.

(b) **Loud De Stijl** (push closer to the source). Background stays cream. Diamond becomes saturated `#C8351F` (Doesburg red), circle stays present but in `#1F3F8C` (cobalt). Title in pure `#1A1816`. The thinking-cursive softens it. Result: a strong manifesto page that still uses Collison's information density.

I'd pick (b) and let *one* element be loud — the diamond — keeping all type and lines exactly as they are. The contrast between manifesto-color and Helvetica-density is the joke.

### Geometry

The composition is the strongest part. Three tweaks would push it from "pleasant" to "Doesburg-quoting":

1. **The diagonals should land on the page edges, not midair.** Doesburg's *Counter-Compositions* are about the diagonal as an organizing tension — extending edge-to-edge. Your top diagonal already runs from header-junction down-and-right to the bottom edge (good); the upper-left segment terminates at the SVG left edge (also good). But the 0-px branch, the diamond, and the circle cluster all sit roughly at one-third — visually they read as "stuck on" rather than constructed. Either (i) extend a third orthogonal element across the right side (a faint full-width horizontal at, say, y = 38vh), or (ii) make the existing diagonal continue past the diamond rather than stopping at it.

2. **The terminal panel should be primary-colored or removed.** Right now it's `#EEEEEE` — a neutral on a cream — which gives it the visual weight of a dropshadow rather than a Doesburg block. In *Counter-Composition VI* the small rectangle is the only saturated red. Make this panel `#1F3F8C` (cobalt) or `#1A1816` (warm black) and let the `...|` cursor be cream. It becomes the punchline of the composition rather than a wash.

3. **Lock the diamond to a 45° square** — visually it already is, but its bounding box should be expressible as a rotated square, not a four-point polygon, so future tweaks don't accidentally elongate it.

### Typography

You've got two families: Space Grotesk (sans, body+title) + Cormorant Garamond (serif, "thinking?"). This is good — the serif works as a single decorative gesture, not a recurring element. Don't add a third.

Tightening:

- **Hero "Hello. I'm Ethan."** at 700/40px is solid. Consider 600 weight + slightly tighter `letter-spacing: -0.012em`. Collison's headers run lighter than this.
- **Body text at 22px regular** is exactly right for Collison's column-of-copy aesthetic. Don't shrink it.
- **Page headings "Things I'm working on."** at 33px, 400 weight is correctly subordinate — keep.
- **The italic-for-author** treatment ("Mild High Club", "Hayek") is perfectly editorial. Same family, italic, slightly muted color would tighten it further; right now it's the same `t.colors.body` as the title, so visually only the *italic* differentiates.
- **"thinking?"** — the Cormorant cursive is the right choice. But the soft-blur layer (`filter: url(#thinking-soften)`) plus 0.78 opacity plus the circle eating it makes it read as a smudge. Either (a) drop the blur and make it crisp at 0.4 opacity, or (b) keep blurred but remove the crisp duplicate underneath — currently you have both and they fight.

### Asymmetry / composition rhythm

De Stijl's whole point is *dynamic equilibrium*: heavy on one side, balanced by emptiness on the other. Your home view at 1440 nails this — composition cluster on the left, text on the right, diagonal connecting them, a clean right-margin emptiness. **Don't lose this.**

Where it slips: the **work** and **more** pages put the same composition cluster on the left and shift the text into the middle. The cluster becomes a side-decoration rather than a counter-weight. The pages feel less Doesburg-structural and more "page with art."

**Suggestion:** when you navigate to work/more, *re-stage* the composition. Have the diamond drift to a different position, the circle reposition, the panel disappear and a new horizontal block appear. Three tableaux instead of one. This is the single biggest move available — it would make the navigation itself feel like a Doesburg painting in motion, which is exactly the right reference for someone who lists Theo van Doesburg as their favorite artist.

If that's too much code, the cheaper version: change the **diagonal angle** per page (45° on home, slight pivot on work, mirror on more). The composition becomes a state.

### Microinteractions

- Custom green cursor is on-brand if the green matches the palette. Currently `#9AAF97` is a forest-sage that doesn't appear anywhere else. Make it `#1F3F8C` (cobalt) or `#3A3530` (warm-black) so the cursor is *part of* the composition, not a fifth color.
- The "...|" terminal is a great touch but the typewriter ghost-character animation (`/`, `_`, `:`, `~`, `=`) is more "early-aughts blog" than De Stijl. Consider replacing with cycling between `|`, `/`, `—`, `\` — i.e. rotating through the orthogonal/diagonal vocabulary of the page itself. Makes it feel composed rather than random.
- The chevron pulse-every-second on the work page is a "look here!" signal at the cost of restraint. Patrick Collison wouldn't pulse anything. Consider a one-time nudge on first render only; if the user hasn't toggled within 5s, *then* one more nudge.

### One more idea worth trying

Doesburg's "Manifesto I of De Stijl" (1918) was set as a wall of text in Helvetica-precursor sans, with the headings staircased diagonally. You could lift this directly: the small label "WORK" / "MORE" in the header, instead of being uppercase sans inside a box, could be set on a 45° diagonal line — a literal Doesburg quote. Probably doesn't ship (it would hurt usability) but worth prototyping for the home-only state.

---

## Top 5 fixes I'd ship first

1. Add `role="button"` + `aria-label` + keyboard handlers to NAME / WORK / MORE (a11y baseline).
2. Make the active-page header fill *persist* across re-renders (#1 above) — visible "you are here."
3. Remove `html, body { height: 100% }` so narrow viewports can scroll to the chevron (#4).
4. Clean up the chevron-pulse `setInterval` leak (#7).
5. Pick a color direction and commit (style #color above) — either drop the slate blue circle or paint the terminal panel cobalt. Either move strengthens the De Stijl read immediately.
