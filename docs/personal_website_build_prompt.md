# Personal Website Build Prompt — Ethan Yang

Build a minimalist personal website for Ethan Yang using the attached Figma screenshot as the singular visual source of truth.

The site should be implemented as a static personal website shell. Do not add extra content, animations, CMS behavior, visual flourishes, or interpretation beyond what is specified here.

The reference design is a desktop Figma mockup at `1400 × 900`. All source measurements below are derived from that frame. The desktop implementation should be visually faithful to the screenshot. Mobile behavior is a practical responsive adaptation, not something directly specified by the desktop mockup.

---

## 1. Technology

Use:

- Astro 4
- Tailwind CSS 3
- Fontsource for local font loading

Do not use:

- Google Fonts CDN
- Meyer reset CDN
- External CSS resets from a CDN
- A CMS
- MDX
- Analytics
- Dark mode
- Extra route content beyond the stubs described here

The site should have the following structure:

```txt
src/
├── layouts/
│   └── SiteLayout.astro
├── pages/
│   ├── index.astro
│   ├── building.astro
│   ├── writing.astro
│   └── about.astro
└── styles/
    └── global.css
```

---

## 2. Visual source of truth

The screenshot is the source of truth for the desktop composition.

The page consists of:

1. A fixed-width/proportional left sidebar.
2. A mostly empty right pane.
3. A warm off-white background everywhere.
4. Thin gray dividing rules.
5. Large display masthead text.
6. A short intro paragraph.
7. Three stacked navigation links.
8. A tiny footer link row.

The design should feel quiet, spare, editorial, and exact. Do not make it look like a generic portfolio template.

---

## 3. Design tokens

Define these tokens in `tailwind.config.mjs`.

### Colors

Use these as the starting values:

```js
colors: {
  paper: "#FAF7F3",
  ink: "#3A3530",
  rule: "#B9B6B1",
  muted: "#D2CFCA"
}
```

Usage:

- `paper`: page background.
- `ink`: all primary text.
- `rule`: vertical and horizontal dividers.
- `muted`: nonessential muted states only.

Important: do not use `ink` for dividers. The screenshot’s dividers are visibly lighter than the text.

Do not use `muted` as the only hover color for essential links if it makes the link too low-contrast.

### Typography

Use Fontsource imports in the Astro layout or global entry point.

Required fonts:

```js
import "@fontsource/space-grotesk/700.css";
import "@fontsource/rubik/400.css";
import "@fontsource/rubik/500.css";
```

Typography usage:

```js
fontFamily: {
  display: ["Space Grotesk", "sans-serif"],
  sans: ["Rubik", "sans-serif"]
}
```

- Masthead: Space Grotesk, weight 700.
- All other text: Rubik.
- Body paragraph: Rubik 400.
- Intro heading and nav links: Rubik 500.
- Footer: Rubik 400.

### Spacing

Define reusable layout spacing:

```js
spacing: {
  grid: "50px",
  "grid-half": "25px",
  "grid-2": "100px",
  "grid-3": "150px"
}
```

Use Tailwind spacing tokens for reusable layout spacing.

For exact screenshot-derived coordinates, use named CSS custom properties in component CSS rather than scattering anonymous arbitrary Tailwind values through the markup.

Allowed pattern:

```css
:root {
  --sidebar-width-ratio: 27.86%;
  --sidebar-min-width: 360px;
  --sidebar-pad-x: 50px;
  --masthead-height: 98px;
  --footer-height: 101px;
  --intro-top: 64px;
  --nav-top: 325px;
}
```

Avoid patterns like:

```html
<div class="top-[325px] left-[50px]">
```

The values may be tuned after a screenshot comparison pass.

---

## 4. Global CSS

In `global.css`, include Tailwind directives and only the project-level reset rules needed.

Use:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

* {
  box-sizing: border-box;
}

html,
body {
  margin: 0;
  min-height: 100%;
  background: theme("colors.paper");
}

body {
  font-family: theme("fontFamily.sans");
  color: theme("colors.ink");
  -webkit-font-smoothing: antialiased;
  text-rendering: optimizeLegibility;
}

a {
  color: inherit;
}

a:focus-visible {
  outline: 2px solid theme("colors.ink");
  outline-offset: 4px;
}
```

Do not import Meyer reset.

Do not globally remove all link decoration for future content pages unless sidebar/content link styles are separated. For this shell, sidebar nav and footer links should have no underline by default.

---

## 5. Desktop layout

Desktop applies at `min-width: 768px`.

The root layout should fill the viewport:

```txt
height: 100vh
background: paper
overflow: hidden
display: grid
```

Use a two-column grid:

```css
grid-template-columns: minmax(360px, 27.86%) 1fr;
```

The `27.86%` value is derived from an approximately `390px` sidebar on a `1400px` canvas.

The sidebar should remain visually fixed while the right pane scrolls.

Preferred implementation:

```txt
outer shell: h-screen overflow-hidden grid
sidebar: sticky top-0 h-screen border-r border-rule
right pane: min-h-0 overflow-y-auto
```

Do not use `position: fixed` for the sidebar unless you also compensate for it in the right-pane layout. Sticky inside the grid is simpler and more robust.

The right pane should share the same `paper` background. No shadow, card, tint, or additional boundary should be added.

---

## 6. Sidebar geometry

The sidebar has three vertical zones:

1. Masthead
2. Body
3. Footer

Use fixed masthead and footer heights. The body absorbs remaining height.

Approximate source geometry from the desktop mockup:

```txt
Sidebar width: about 390px on a 1400px frame
Masthead height: about 98px
Footer height: about 101px
Body height: remaining viewport height
Horizontal padding: 50px
```

Implementation:

```txt
.sidebar
  display: flex
  flex-direction: column
  height: 100vh
  background: paper
  border-right: 1px solid rule

.masthead
  height: 98px
  border-bottom: 1px solid rule

.body
  flex: 1
  position: relative
  border-bottom: 1px solid rule
  padding-left: 50px
  padding-right: 50px

.footer
  height: 101px
```

Do not use viewport-height units for masthead and footer heights. They should not grow taller on large monitors. Only the body zone should absorb extra height.

---

## 7. Masthead

The masthead contains exactly one visible text element:

```txt
ETHAN YANG
```

Visual requirements:

```txt
Font: Space Grotesk
Weight: 700
Size: 50px
Line height: 1
Letter spacing: 0
Color: ink
```

The masthead text is centered vertically and horizontally within the masthead zone.

Because the text itself is wide, centering it visually results in roughly equal left and right whitespace inside the sidebar. Do not align it to the same 50px left padding as the body content unless screenshot comparison shows that is closer.

Do not use `-webkit-text-stroke`.

---

## 8. Sidebar body content

The body contains two groups:

1. Intro group
2. Navigation group

For desktop, use source-coordinate positioning inside the sidebar body. This is intentional: the vertical placement of the intro and nav is part of the composition.

Recommended CSS model:

```css
.sidebar-body {
  position: relative;
  padding-left: var(--sidebar-pad-x);
  padding-right: var(--sidebar-pad-x);
}

.sidebar-intro {
  position: absolute;
  top: var(--intro-top);
  left: var(--sidebar-pad-x);
  right: var(--sidebar-pad-x);
}

.sidebar-nav {
  position: absolute;
  top: var(--nav-top);
  left: var(--sidebar-pad-x);
  right: var(--sidebar-pad-x);
}
```

Initial tuning values:

```css
--intro-top: 64px;
--nav-top: 325px;
```

These values should be adjusted only after comparing the rendered page against the screenshot at `1400 × 900`.

### Intro heading

Text:

```txt
Hello. I’m Ethan.
```

Use the curly apostrophe.

Style:

```txt
Font: Rubik
Weight: 500
Size: 26px
Line height: normal, approximately 1.2
Color: ink
```

### Intro paragraph

Text:

```txt
Currently studying systems and institutions at scale: how they're designed, how they fail, and how AI is remaking them.
```

Use the straight apostrophe in `they're`, matching the screenshot/spec text.

Style:

```txt
Font: Rubik
Weight: 400
Size: 18px
Line height: 30px
Color: ink
Width: available sidebar content width, approximately 290px
```

The paragraph should wrap into multiple short lines, matching the mockup. Do not widen it beyond the sidebar content column.

Spacing between heading and paragraph should match the screenshot visually. Do not rely on browser default margins. Set margins explicitly.

Recommended starting point:

```css
.intro-heading {
  margin: 0;
}

.intro-paragraph {
  margin: 40px 0 0;
}
```

Tune after screenshot comparison.

---

## 9. Navigation

The navigation contains exactly three links:

```txt
BUILDING
WRITING
ABOUT
```

Routes:

```txt
BUILDING → /building
WRITING  → /writing
ABOUT    → /about
```

Style:

```txt
Font: Rubik
Weight: 500
Size: 26px
Line height: normal
Letter spacing: 0
Text transform: none; the source text is already uppercase
Color: ink
No underline by default
```

The nav links should be stacked vertically with generous spacing.

Recommended structure:

```html
<nav aria-label="Primary">
  <a href="/building">BUILDING</a>
  <a href="/writing">WRITING</a>
  <a href="/about">ABOUT</a>
</nav>
```

Recommended layout:

```css
.sidebar-nav {
  display: flex;
  flex-direction: column;
  gap: 44px;
}
```

Tune the gap after screenshot comparison. The screenshot shows the nav items around these vertical bands:

```txt
BUILDING: upper 400s
WRITING: around 500
ABOUT: around 580
```

The nav links should be text links, not full-width button blocks with visible boxes.

For hover:

- Do not add underline by default.
- Do not shift layout.
- Prefer subtle opacity change or a darker accessible hover treatment.
- Do not use low-contrast gray as the only hover state.

Example:

```css
.sidebar-nav a {
  text-decoration: none;
  transition: opacity 150ms ease;
}

.sidebar-nav a:hover {
  opacity: 0.65;
}
```

For current page state:

- Use `aria-current="page"` on the active route.
- Do not add a visible active style unless requested later. The screenshot does not show one.

---

## 10. Footer

The footer contains a single centered horizontal row:

```txt
email / linkedin / substack / github
```

Each word is a link. The slashes are plain text.

Markup pattern:

```html
<footer>
  <a href="mailto:...">email</a>
  <span> / </span>
  <a href="...">linkedin</a>
  <span> / </span>
  <a href="...">substack</a>
  <span> / </span>
  <a href="...">github</a>
</footer>
```

Use real URLs if available. If not available, use safe placeholders temporarily and mark them clearly in code comments.

Footer style:

```txt
Font: Rubik
Weight: 400
Size: 12px
Line height: normal
Color: ink
Centered horizontally
Centered vertically
No underline by default
```

The footer row should appear tiny and quiet, as in the mockup.

---

## 11. Right pane

On the homepage `/`, the right pane is intentionally empty on desktop.

Do not render:

- Placeholder text
- Cards
- Decorative graphics
- “Coming soon”
- Extra whitespace wrappers
- A visible heading

The empty right pane is part of the design.

For `/building`, `/writing`, and `/about`, render only a stub heading for now.

Example:

```html
<h1>Building</h1>
```

Stub heading style:

```txt
Font: Space Grotesk
Weight: 700
Size: text-3xl or equivalent
Color: ink
Padding top: 50px
Padding left: 100px
```

Do not build out page content yet.

---

## 12. Mobile behavior

Mobile applies below `768px`.

The desktop screenshot does not define a mobile design. Implement a practical single-column adaptation that preserves the identity of the page without pretending to be pixel-derived from the desktop mockup.

Mobile layout:

```txt
- Single column
- Sidebar becomes a normal top section
- Right pane appears below it only when it has content
- No vertical border
- Horizontal dividers remain between masthead, body, and footer
- No horizontal scrolling
```

Important homepage behavior:

```txt
On mobile homepage, do not render an empty right-pane region below the footer.
The page should end after the sidebar/footer content.
```

Mobile masthead:

```txt
Height: 98px
Font size: 36px
Centered vertically and horizontally
```

Mobile body:

```txt
Positioning switches from absolute to normal document flow.
Padding: 32px left/right, or 24px on very narrow screens.
Intro group appears first.
Nav appears below intro with generous spacing.
```

Mobile type:

```txt
Intro heading: 22px
Nav links: 22px
Paragraph: 18px, 30px line-height
Footer: 12px
```

Mobile nav:

```txt
Stacked vertically
No absolute positioning
No overlap
No horizontal overflow
```

---

## 13. Accessibility requirements

Use semantic landmarks:

```txt
aside or header region for sidebar shell
nav with aria-label="Primary"
main for right pane content
footer for footer links
```

Document requirements:

```txt
html lang="en"
viewport meta tag
descriptive page titles
visible keyboard focus state on all links
aria-current="page" on active nav item
```

Do not remove focus outlines globally.

Do not rely on hover-only interaction states.

Color contrast:

- Primary text must meet WCAG contrast requirements.
- Hover states must not reduce essential link text below accessible contrast unless the non-hover state remains visually clear and the hover state is not the only affordance.

Motion:

- If using Astro view transitions, respect reduced motion.
- Do not add extra animations.

---

## 14. View transitions / route behavior

The sidebar should not visibly flicker between route changes.

Use Astro’s route transition mechanism appropriate for Astro 4. If preserving the sidebar element across page navigations is supported in the chosen implementation, apply the relevant persistence directive to the sidebar shell.

The route transition should be minimal. Do not add page animations beyond preventing sidebar flicker.

---

## 15. Implementation constraints

Do not add arbitrary visual embellishments.

Do not add:

```txt
- Cards
- Gradients
- Drop shadows
- Icons
- Avatars
- Decorative images
- Social logos
- Extra copy
- Loading states
- Background patterns
- Dark mode
```

The design should remain flat, sparse, and typographic.

Use exact text content:

```txt
ETHAN YANG

Hello. I’m Ethan.

Currently studying systems and institutions at scale: how they're designed, how they fail, and how AI is remaking them.

BUILDING
WRITING
ABOUT

email / linkedin / substack / github
```

---

## 16. Verification checklist

Test at these viewport sizes:

```txt
1400 × 900
1440 × 900
1280 × 800
1024 × 768
768 × 1024
390 × 844
375 × 812
```

Desktop acceptance criteria:

```txt
- Background is warm off-white, not pure white.
- Sidebar ratio visually matches the screenshot.
- Sidebar dividers are light gray, not dark near-black.
- Masthead is bold, large, centered, and visually close to the screenshot.
- Intro block appears in the upper body area.
- Paragraph wraps into short lines similar to the screenshot.
- Nav appears in the middle-left band, with large empty space below.
- Footer is tiny and centered.
- Right pane is empty on homepage.
- No document-level scrolling on desktop homepage.
- Right pane can scroll independently on interior pages if content is later added.
```

Mobile acceptance criteria:

```txt
- No horizontal scrolling.
- Sidebar content stacks naturally.
- Desktop absolute positioning is disabled.
- Homepage ends after the footer; there is no blank empty right-pane scroll region.
- Links remain tappable and keyboard focusable.
```

Technical acceptance criteria:

```txt
- No console errors.
- No external Google Fonts requests.
- No external reset CSS request.
- No layout shift caused by late font loading.
- Keyboard focus is visible on all links.
- Lighthouse accessibility score should be at least 95.
- CLS should be below 0.1.
```

---

## 17. Final instruction

Prioritize fidelity to the screenshot over generic portfolio-site conventions.

When in doubt:

```txt
Choose less.
Add nothing.
Preserve the empty space.
Keep the typography and rules exact.
```
