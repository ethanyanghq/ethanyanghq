# /about Design Audit

Audit weighted toward minimalism, with De Stijl as flavor rather than directive. The goal: remove what doesn't earn its place, sharpen what's left.

## What works

- **Restrained palette.** Warm off-white `#FAF7F3` paper + near-black `#3A3530` ink + a single hairline rule color. Nothing fights for attention.
- **Two-typeface system.** Space Grotesk for display, Rubik for everything else. Disciplined and consistent across `notes-link`, `notes-list a`, and body copy.
- **Hairline divider** between hero and notes (`about.astro:161`) carries hierarchy without ornament — exactly the right minimalist move.
- **Kicker → title → copy stack.** The uppercase "About" eyebrow (`about.astro:37`) at 12px / 0.08em letter-spacing earns its place: it labels without shouting.
- **Restraint in interactions.** Hover states are opacity shifts, not color changes. Consistent with the rest of the system.

## What doesn't work

**1. Placeholder copy shipped to production.** "Short thesis placeholder." plus "this section will become…" (`about.astro:38, 41–47`) is the loudest issue on the page. Minimalism amplifies content — when there's nothing else to look at, the words have to carry everything. Right now they don't.

**2. The notes "grid" isn't a grid.** `.notes-grid` is declared `display: grid` (`about.astro:181`) but has no `grid-template-columns`, so Artist/Music/Books stack in one column. Either commit to the single column (and remove the grid scaffolding) or actually use the columns. The current state is half-built.

**3. Visual hierarchy is flat between sections.** `.notes-heading h2` at 1.2rem (`about.astro:167`) is barely larger than body copy. The hero goes to 2.8rem, then the next heading drops almost to body size — there's no middle tier. A reader's eye has nothing to land on between hero and content.

**4. Page width math is dead code.** `.about-page` is 680px with 144px of horizontal padding (~536px usable), but `.about-hero` and `.about-notes` are capped at 560px (`about.astro:119`) — a cap that can never be reached. Pick one measure and delete the other. Minimalism is allergic to redundancy.

**5. Two list rendering paths for nearly identical data.** Music uses `.notes-list` with anchors; Books uses `.notes-list--static` with spans. The styling is duplicated. One list component handling both linked and unlinked items would be tidier.

**6. External links have no affordance.** Every Spotify/MoMA link is `target="_blank"` with no visual cue. Hover is just `opacity: 0.68` (`about.astro:202–204`) — same as a non-link's hover would be. In a low-ornament page, the *one* place to spend a typographic mark is on link affordance: a thin underline, or a trailing `↗` that doubles as the "external" signal.

**7. No caption on the Composition image.** Alt text identifies it for screen readers but the page itself doesn't name the work. In a minimalist layout where the image is one of three things on the page, leaving it unlabeled reads as careless rather than clean.

**8. Three single-word headings + redundant `aria-labelledby`.** Artist / Music / Books each get an `<h3>` *and* an `aria-labelledby` on their parent `<section>` (`about.astro:58–59`, `:78`, `:94`). The IDs (`favorite-artist`, etc.) suggest longer labels that aren't there. Either commit to "Favorite Artist / Favorite Music / Favorite Books" or drop the section wrapper and let the h3 do the work alone.

**9. Dead CSS.** `.notes-section { padding-top: 0 }` (`about.astro:188`) is a no-op. Small thing, but minimalism is hygiene.

**10. Long titles will collide on mid widths.** "Ballade No. 1 in G Minor" against an `auto` artist column (`about.astro:230`) is a tight squeeze between ~560px and the 767px breakpoint where the layout reflows.

## Suggested improvements (ranked)

1. **Ship real copy or hide the page.** Placeholder text in production is the single biggest violation of the design language. Everything else is secondary until this is fixed.
2. **Establish a third type tier.** Pick one — bump `.notes-heading h2` to ~1.5–1.7rem, *or* replace size with a top rule + uppercase eyebrow that mirrors the hero kicker. The latter is more minimalist: structure replaces weight.
3. **Decide on the grid, then commit.** If single-column, delete `.notes-grid` and use plain block flow with consistent vertical rhythm (e.g., 48px between sections). If multi-column, give it real `grid-template-columns` at ≥768px. Don't ship the half-built version.
4. **Collapse to one width token.** Remove the 560px caps, settle on a single `--measure` (~36rem) on `.about-page`, delete the redundant cap on hero and notes.
5. **Add link affordance.** A trailing `↗` after external links, or a 1px underline on hover. One mark, used consistently — that's the minimalist budget for "this is interactive."
6. **Caption the image.** A small `<figcaption>` — *Theo van Doesburg, Composition VIII, 1918* — in 12px small-caps at 0.6 opacity. One line, no ornament.
7. **Unify the two list components.** One list, two render branches (linked vs static). Removes the duplicate `.notes-list--static` selector and its near-identical styles.
8. **Reconcile section labels.** Either rename the headings to two-word phrases ("Favorite Artist") or drop the `aria-labelledby` wrappers and let the h3s stand alone.
9. **Delete the dead `padding-top: 0` rule.**
10. **Tighten the music list grid.** Set `grid-template-columns: minmax(0, 1fr) max-content` and let the artist column reserve space, or drop the two-column treatment entirely on the desktop range and just use a soft separator (en-dash, dot) between title and artist.

## On De Stijl, briefly

A De Stijl accent (one primary-color block, one asymmetric break) would *connect the page's content to its form* — but it's optional, and it competes with the minimalist instinct. If you do add a color, spend it once and globally (a single masthead mark, or the `aria-current` indicator), not on the /about page specifically. Otherwise, lean fully into the warm-paper-and-ink palette and let the van Doesburg reference live entirely inside the image.

## Glaring issue, one-liner

The placeholder hero copy is the largest problem; the unbuilt grid and flat heading hierarchy are the next two. Fix those three and the page snaps into focus without adding a single new element.
