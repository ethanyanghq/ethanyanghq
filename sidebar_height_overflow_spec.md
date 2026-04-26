# Sidebar Height-Overflow Fix Spec

A focused fix for one bug in the existing site. Build only what is described here. Do not refactor surrounding code, restyle visible elements, or alter behavior on viewports where the bug doesn't manifest.

This spec assumes the current implementation in `src/layouts/SiteLayout.astro` and `src/styles/global.css` as the baseline.

---

## 1. Bug being fixed

On viewports shorter than approximately 660px in height, the sidebar's nav links (`BUILDING`, `WRITING`, `ABOUT`) overlap the footer link row (`email / linkedin / substack / github`), and the body region's bottom border rule visually slices through nav text.

Reproduce: open the homepage at viewport `1400 × 600` and observe `ABOUT` colliding with the footer text, and the horizontal rule cutting through `WRITING`.

### Root cause

```css
.sidebar-body  { position: relative; flex: 1; border-bottom: 1px solid var(--rule); }
.sidebar-intro { position: absolute; top: var(--intro-top, 64px);  /* fixed */ }
.sidebar-nav   { position: absolute; top: var(--nav-top,   325px); /* fixed */ }
```

The intro and nav are absolutely positioned with hard-coded `top` values calibrated against a `1400 × 900` design frame. They do not participate in the body region's flex sizing, so when the viewport (and therefore the body region's height) shrinks, the absolute children continue to occupy the same coordinates and overflow the body's bottom edge into the footer zone. The shell uses `height: 100vh; overflow: hidden`, so this overflow is clipped instead of producing a scrollbar — but the overlap is visible because nothing is hidden, just stacked.

The intrinsic minimum content height of the sidebar at the current type scale is approximately 658px (84 masthead + 64 intro padding + 29 heading + 32 paragraph margin + 104 paragraph + 96 inter-group gap + 148 nav + 101 footer). Below that viewport height, no layout strategy that keeps the entire sidebar inside `100vh` can avoid the overlap.

---

## 2. Goal

Preserve the existing visual composition on the design viewport (1400 × 900) and any taller viewport. Allow the page to scroll naturally when the viewport is shorter than the sidebar's intrinsic content height. The sidebar should remain visually anchored ("sticky") while the user scrolls.

The fix must not alter the visible layout, type, color, or interaction behavior on the design viewport. A pixel diff against the current `1400 × 900` render should show no differences.

---

## 3. Required changes

### 3.1 Convert intro and nav to natural document flow

Remove `position: absolute` from `.sidebar-intro` and `.sidebar-nav`. They should participate in normal flow as block siblings inside `.sidebar-body`.

The visual y-positions on the design viewport should match the current render:

- Intro group sits 64px below the top of the body region.
- Nav group sits 96px below the bottom of the intro paragraph (this approximates the current `nav-top: 325px` minus the intro group's natural end at ~229px).

Implement using padding and margin, not `top`:

```css
.sidebar-body {
  /* unchanged: flex: 1; border-bottom; padding-left/right */
  padding-top: var(--intro-top);   /* was applied via .sidebar-intro top */
}

.sidebar-intro {
  /* drop position: absolute, top, left, right */
}

.sidebar-nav {
  /* drop position: absolute, top, left, right */
  margin-top: var(--nav-gap);      /* new token; see §4 */
}
```

The `--intro-top` and `--nav-gap` tokens fully describe the vertical composition. Tune `--nav-gap` until the rendered position of `BUILDING` at 1400 × 900 matches the current build (around y=409 from sidebar top, which is y=325 from body top).

### 3.2 Allow whole-page scroll when content exceeds viewport

Change the shell from a fixed-height clipped container to a min-height container that grows with content:

```css
.shell {
  /* was: height: 100vh; overflow: hidden; */
  min-height: 100vh;
  /* keep: display: grid; grid-template-columns: auto 1fr; background */
}
```

### 3.3 Sidebar stays sticky with an overflow safety net

The sidebar must remain visually fixed during right-pane scroll on tall viewports, and gracefully scroll its own content on viewports too short to display the full sidebar:

```css
.sidebar {
  position: sticky;
  top: 0;
  /* was: height: 100vh; */
  max-height: 100vh;
  overflow-y: auto;
  /* keep: display: flex; flex-direction: column; width: min-content; background; border-right */
}
```

Combined behavior:
- Tall viewport (sidebar content ≤ 100vh): sidebar fills the viewport vertically, sticks to the top, no internal scrollbar appears.
- Short viewport (sidebar content > 100vh): sidebar caps at 100vh and scrolls internally. The overall page also becomes scrollable because the right pane now has its own height behavior (see §3.4).

The sidebar's internal scrollbar should be styled to be invisible by default and only appear on user interaction (the browser default on macOS already behaves this way; no custom scrollbar styling is required).

### 3.4 Right pane

The right pane currently uses `min-height: 0; overflow-y: auto` so it can scroll independently when its content exceeds the viewport. Under the new shell rules, it should fall back to natural document flow with the page-level scroll handling overflow:

```css
.right-pane {
  min-height: 100vh;
  /* drop overflow-y: auto */
}
```

If a future page renders content taller than the viewport, the page (not the right pane) scrolls. The sidebar's `position: sticky` keeps the sidebar visible.

### 3.5 Mobile breakpoint (≤767px)

The mobile breakpoint already overrides `.shell` to `display: block` and the sidebar to `position: static; height: auto`. Verify that the intro/nav natural-flow changes work in this context — the existing mobile rules `.sidebar-intro, .sidebar-nav { position: static; top: auto; left: auto; right: auto; }` will become no-ops once §3.1 is applied. They can be removed or left as defensive resets.

The mobile sidebar must continue to grow naturally with its content (no `max-height` cap; no internal scroll). Override the new desktop rules in the mobile media query:

```css
@media (max-width: 767px) {
  .sidebar {
    max-height: none;
    overflow-y: visible;
    position: static;
  }
}
```

---

## 4. New design token

Add to `:root`:

```css
--nav-gap: 96px;   /* vertical distance between intro paragraph and first nav link */
```

This replaces the implicit gap that `--nav-top: 325px` used to produce. The token should be tuned during implementation by overlaying the render at 1400 × 900 against the previous build until `BUILDING` lands at the same y-coordinate (±1px). The token `--nav-top` itself is no longer used and should be removed.

---

## 5. What must not change

Do not modify:

- Typography (font family, weight, size, line-height) — anywhere.
- Color tokens.
- Sidebar width derivation (it remains `width: min-content` driven by the masthead).
- Masthead structure, hover effect, or `transition:persist` behavior.
- Footer structure or content.
- Page routes (`/`, `/building`, `/writing`, `/about`).
- Mobile masthead height/font-size/padding overrides.
- The favicon, head metadata, or view transitions config.
- Any markup in `SiteLayout.astro`. This fix is CSS-only.

Do not introduce:

- New JavaScript.
- Container queries.
- A custom scrollbar style.
- A "compact" mode toggle.
- Any visible UI affordance indicating scrollability.

---

## 6. Acceptance criteria

Test at the following viewport sizes. The first column is the most critical — that's the design viewport, and it must be visually identical to the previous build.

| Viewport (W × H) | Expected behavior |
|---|---|
| 1400 × 900 | **Pixel-identical to current build.** No page scrollbar. Sidebar fills viewport. Right pane fills viewport. No internal sidebar scrollbar. |
| 1400 × 800 | No page scrollbar. Sidebar fills viewport. Composition unchanged. |
| 1400 × 700 | No page scrollbar (sidebar content fits in 700px). Composition unchanged. |
| 1400 × 600 | **Page becomes scrollable.** Sidebar caps at 600px and is internally scrollable. Footer is reachable by scrolling either the page or the sidebar. Nav links never overlap the footer. The body's bottom border rule never visibly cuts through nav text. |
| 1400 × 500 | Same as 1400 × 600. Sidebar internally scrollable; page scrollable. No overlapping text anywhere. |
| 768 × 1024 | Desktop layout active (sidebar at min-content width, fixed left). Composition unchanged. |
| 767 × 900 | Mobile layout active. Sidebar stacks above right pane. No max-height on sidebar. No internal scroll. Footer reachable by page scroll. |
| 375 × 812 | Mobile layout active. Single-column stack. No horizontal scroll. Footer at the bottom of the document. |

Additional checks:

- At 1400 × 900, the rendered y-coordinate of `BUILDING` must match the current build within ±1px. This is the tuning target for `--nav-gap`.
- Hover effect on the masthead (fill + invert text wipe) must remain visually identical at all viewport sizes.
- Keyboard focus order: masthead → BUILDING → WRITING → ABOUT → email → linkedin → substack → github. Unchanged.
- No console errors at any viewport size.
- No layout shift (CLS) introduced by font loading.
- Sidebar scrollbar (when it appears at short viewports) must not visually obstruct any content.

---

## 7. Implementation notes for the builder

- The change is small (≈10 lines of CSS modified, ≈3 lines added). Resist the urge to refactor adjacent rules.
- After making the changes, the simplest verification is to open the homepage at `1400 × 600` and confirm: (a) you can scroll the page, (b) the footer is reachable, (c) `ABOUT` and the footer text never visually overlap, and (d) the body border rule never crosses nav text.
- Then immediately re-verify `1400 × 900` looks identical to the previous build. If `BUILDING` has shifted, tune `--nav-gap`.
- The `position: sticky` on the sidebar will silently fail if any ancestor has `overflow: hidden`. Removing `overflow: hidden` from `.shell` (per §3.2) is what enables sticky to work — these two changes are coupled and must be made together.
- Do not use `position: fixed` for the sidebar as a fallback. The grid + sticky pattern is intentional and integrates with the right pane's column layout.
