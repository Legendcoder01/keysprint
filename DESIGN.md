# keysprint design system

The rules the interface follows, and the reasoning behind them.

Everything here is implemented in `src/styles/global.css` (tokens, base layer,
component primitives), `src/styles/typing.css` (the typing widget) and
`src/styles/analysis.css` (the keyboard heat map). This document describes what
exists — it is not a wish list.

---

## 1. Principles

**One accent, used sparingly.** The palette is a single neutral ramp plus one blue.
Accent is reserved for things the reader can act on or should look at: the active
state of a control, the caret, the current step, a link. If everything were blue,
nothing would be.

**Numbers should not move.** A typing test is a live dashboard. Every number on screen
uses `font-variant-numeric: tabular-nums` so a counter ticking from `9` to `10` does
not shove the layout sideways. Digits are also set in the monospace stack.

**Quiet by default, legible under pressure.** The reading text is high contrast
ink on a near-white canvas. The typing passage is deliberately *dimmer* than the
surrounding chrome, because the passage is the thing you are reading *and* the thing
you are looking past. As you type, the characters you have completed brighten, so the
text behind the caret stays out of the way.

**The site works without JavaScript.** Every page is readable and navigable as
static HTML. The only thing JavaScript does is drive the typing widget. There is no
hydration framework and no client-side router.

**Nothing is decorative-only.** Colour is never the only signal. An incorrect
character is coloured *and* carries `aria-invalid` *and* is counted in the error
total *and* is announced in the live region.

---

## 2. Colour

### Light theme (`:root`)

| Token | Value | Used for |
| --- | --- | --- |
| `--canvas` | `#ffffff` | Page background |
| `--surface` | `#fafafa` | Cards, the sticky header, the results panel |
| `--surface-2` | `#f4f4f5` | Hover states, nested surfaces, stat boxes |
| `--surface-3` | `#e4e4e7` | Highest-contrast neutral fill |
| `--border` | `#e4e4e7` | Hairlines, card and control borders |
| `--border-strong` | `#d4d4d8` | Secondary buttons and keyboard hints |
| `--ink` | `#18181b` | Headings and body text |
| `--ink-muted` | `#52525b` | Secondary prose, inactive controls |
| `--ink-subtle` | `#71717a` | Labels, meta text, the untyped passage |
| `--accent` | `#2563eb` | Primary actions, links, the caret, the active pill |
| `--accent-hover` | `#1d4ed8` | Primary action hover |
| `--accent-contrast` | `#ffffff` | Text on an accent fill |
| `--accent-wash` | `rgb(37 99 235 / 0.08)` | The caret's background |
| `--correct` | `#047857` | The "personal best" badge |
| `--caution` | `#92400e` | The "needs work" band on the heat map |
| `--incorrect` | `#be123c` | Incorrect characters |

### Dark theme (`.dark`)

| Token | Value |
| --- | --- |
| `--canvas` | `#09090b` |
| `--surface` | `#111113` |
| `--surface-2` | `#18181b` |
| `--surface-3` | `#27272a` |
| `--border` | `#27272a` |
| `--border-strong` | `#3f3f46` |
| `--ink` | `#fafafa` |
| `--ink-muted` | `#a1a1aa` |
| `--ink-subtle` | `#82828b` |
| `--accent` | `#60a5fa` |
| `--accent-hover` | `#93c5fd` |
| `--accent-contrast` | `#0a0a0b` |
| `--accent-wash` | `rgb(96 165 250 / 0.12)` |
| `--correct` | `#34d399` |
| `--caution` | `#fbbf24` |
| `--incorrect` | `#fb7185` |

### How theming works

The theme is a **class on `<html>`**, not a media query, so the toggle can override
the operating system setting. The tokens live on `:root` and `.dark`; a single
`@theme inline` block re-exports them as Tailwind utilities
(`bg-surface`, `text-ink-muted`, `border-border`, …). Swapping the class re-themes
every utility without a second stylesheet and without a duplicated palette.

A small script in `<head>` reads the stored preference and applies the class before
first paint, so there is no flash of the wrong theme.

Dark mode is a full re-mapping, not an inversion. The accent gets *lighter*
(`#2563eb` → `#60a5fa`) so it stays legible against a dark canvas, and the accent's
contrast colour flips to near-black so text on an accent fill stays readable.

### Contrast

Measured with the WCAG 2.x relative luminance formula.

| Pair | Light | Dark |
| --- | --- | --- |
| `--ink` on `--canvas` | 17.72:1 | 19.06:1 |
| `--ink-muted` on `--canvas` | 7.73:1 | 7.76:1 |
| `--ink-subtle` on `--canvas` | 4.83:1 | 5.22:1 |
| `--ink-subtle` on `--surface` | 4.63:1 | 4.95:1 |
| `--accent` on `--canvas` | 5.17:1 | 7.83:1 |
| `--accent-contrast` on `--accent` | 5.17:1 | 7.78:1 |
| `--incorrect` on `--canvas` | 6.29:1 | 7.39:1 |
| `--correct` on `--canvas` | 5.48:1 | 10.35:1 |

The heat map needs its own measurements, because its text sits on a tinted key rather
than on a plain surface. The tint is an 18% mix of the band colour over `--surface-2`;
the numbers below are measured against that flattened result.

| Heat-map pair | Light | Dark |
| --- | --- | --- |
| Key label (`--ink`) on the band tint | 11.84–12.56:1 | 11.37–12.84:1 |
| Percentage (`--ink-muted`) on the band tint | 5.16–5.48:1 | 4.63–5.23:1 |
| Band bar (full-strength `--correct` / `--caution` / `--incorrect`) | 3.89–4.89:1 | 4.98–7.11:1 |
| Percentage on an unused key (`--ink-muted` on `--surface-2`) | 7.03:1 | 4.65:1 |

The band bar only has to clear 3:1, because it is a graphic rather than text. The
percentage is the tightest pair at 4.63:1, which still clears AA. Unused keys
deliberately use `--ink-muted` rather than the subtler token: `--ink-subtle` measures
4.40:1 on `--surface-2`, just under the line, and the dash has to be readable.

Everything listed clears WCAG AA for normal text (4.5:1), and the body text clears AAA
(7:1) in both themes. `--ink-subtle` is the tightest pair in the system, which is why
it is used only for short uppercase labels, list markers, and the *untyped* part of
the passage — never for a paragraph of body copy.

---

## 3. Typography

**System stack, no webfont.** `--font-sans` is `ui-sans-serif, system-ui,
-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial,
'Noto Sans', sans-serif`. This costs zero bytes, makes no third-party request, causes
no layout shift, and renders with the font the reader already prefers.

`--font-mono` is `ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas,
'Liberation Mono', 'Segoe UI Mono', monospace`. It is used for the typing passage,
every measured number, and keyboard hints.

### Scale

| Role | Class | Size | Weight |
| --- | --- | --- | --- |
| Page title (`h1`) | `text-3xl sm:text-4xl lg:text-[2.75rem]` | 30 / 36 / 44px | 600 |
| Section title (`h2`) | `text-2xl sm:text-3xl` | 24 / 30px | 600 |
| Sub-section (`h3`) | `text-xl` | 20px | 600 |
| Lead paragraph | `text-base sm:text-lg` | 16 / 18px | 400 |
| Body | `text-[15px]` / `text-base` | 15 / 16px | 400 |
| Small | `text-sm` | 14px | 400 |
| Eyebrow / label | `text-xs font-semibold uppercase tracking-wider` | 12px | 600 |
| Stat label | `text-[0.6875rem] font-semibold uppercase` + `tracking-[0.06em]` | 11px | 600 |
| Stat value | `text-xl` mono, `tabular-nums` | 20px | 600 |
| Result headline | `text-[3.5rem]` mono, `tabular-nums` | 56px | 700 |

Headings are `tracking-tight` (roughly `-0.02em`) and set with `text-wrap: balance`,
so a two-line heading does not leave one orphaned word on the second line. Body copy
uses `text-wrap: pretty`, which avoids single-word last lines without the
over-spacing that `balance` can cause in long paragraphs.

### Rules

- Sentence case for headings and buttons. Uppercase only for short eyebrow labels.
- Em dashes (`—`), curly quotes (`“ ”`), and the ellipsis character (`…`) are used in
  prose. No straight quotes and no `...` in user-visible text.
- Line length for prose is capped at `max-w-3xl` (48rem) or `max-w-2xl` (42rem).

---

## 4. Layout

- **Container:** `mx-auto max-w-6xl px-4 sm:px-6` — 72rem wide, 1rem gutters on
  mobile, 1.5rem from `sm` up.
- **Prose blocks** narrow to `max-w-3xl` so the measure stays readable.
- **Vertical rhythm:** sections use `py-12 sm:py-16`. Inside content sections the
  spacing between blocks follows the same 4px-based scale as Tailwind's defaults.
- **Sticky header:** 4rem tall, `bg-canvas/80` with a backdrop blur, and a hairline
  bottom border. `scroll-padding-top: 5rem` on `html` plus `scroll-margin-top: 5rem`
  on headings keeps in-page anchors from hiding underneath it.
- **Grid:** the live statistics are a 4-column grid, collapsing to 2 columns below
  `30rem`. The results grid is `auto-fit` with a `9rem` minimum.

---

## 5. Components

### `.card`

Surface background, 1px border, `0.75rem` radius. The one container primitive.

### `.btn` / `.btn-primary` / `.btn-secondary` / `.btn-ghost`

All buttons share a base: inline-flex, centred, `0.5rem` gap, `0.5rem 1rem` padding,
`0.875rem` / 500 weight, `0.5rem` radius, `white-space: nowrap`, `user-select: none`.

| Variant | Rest | Hover |
| --- | --- | --- |
| `.btn-primary` | accent fill, contrast text | `--accent-hover` fill |
| `.btn-secondary` | canvas fill, strong border, ink text | `--surface-2` fill |
| `.btn-ghost` | transparent, muted text | `--surface-2` fill, ink text |

Disabled buttons drop to `opacity: 0.5` with a `not-allowed` cursor.

### The option pill (`.ts-pill`)

The duration and drill pickers are **native radio inputs**, visually hidden inside
real `<label>` elements that are styled as pills. The selected state uses
`.ts-pill:has(:checked)` — so the state is genuinely the form control's state, not a
class toggled by script.

- Rest: canvas fill, border, `--ink-muted` text.
- Hover: `--surface-2` fill, ink text.
- Selected: accent fill, accent border, accent-contrast text.
- Focused: a 2px accent outline with a 2px offset. When the pill is *both* selected
  and focused, the outline flips to `--ink` so it is still visible against the accent
  fill.

### The typing passage

| Element | Treatment |
| --- | --- |
| `.ts-area` | Card border around the passage; the border turns accent on `:focus-within` |
| `.ts-viewport` | Fixed height of four lines (three on small screens), `overflow: hidden` |
| `.ts-track` | The moving passage; moved with `translate3d`, `will-change: transform` |
| `.ts-block` | Monospace, `1.0625rem`, `1.85rem` line height, `--ink-subtle` |
| `.ts-char` | The untyped passage, `--ink-subtle` |
| `.ts-char.is-correct` | Typed and right: `--ink` |
| `.ts-char.is-incorrect` | Typed and wrong: `--incorrect` text on a 14% wash of the same, 2px radius |
| `.ts-char.is-current` | The caret: accent wash background plus a 2px inset accent bar on the left |

The hidden `.ts-input` is a real `<textarea>` laid over the passage with transparent
text and a transparent caret. It exists so that mobile keyboards work and so that
assistive technology sees a genuine text field. `keydown` is intercepted and the
default is prevented, so the engine remains the only writer.

### The results panel

A `.ts-results` card: an uppercase eyebrow, the net WPM in 56px monospace with
tabular figures, the unit beneath it, an optional "new personal best" badge, then a
two-column definition list of the remaining measures, then the action buttons.

The personal-best badge uses `--correct` for the text and a 40%/12% mix of it for the
border and fill, so it reads as a quiet success rather than a loud alert.

### The keyboard heat map

The board on `/typing-analysis/` is the one place where colour carries data, so it is
built to survive without it.

| Element | Treatment |
| --- | --- |
| `.kb-scroll` | Horizontal scroller, `tabindex="0"` with `role="region"` and a label, so the board can be scrolled from the keyboard |
| `.kb` | Column of rows, `width: max-content`, `--kb-key-size` 2.75rem (2.25rem below 30rem) |
| `.kb-row` | Flex row; `--kb-offset` staggers the number and top rows like a real board |
| `.kb-key` | `--surface-2` with an 18% tint of the band colour, 2px radius |
| `.kb-key-label` | The character, in `--ink` |
| `.kb-key-value` | The accuracy percentage, in `--ink-muted`, tabular figures |
| `.kb-key::after` | A 3px inset bar across the bottom in the full-strength band colour |

Accuracy falls into four bands: **good** at 95% and above (`--correct`), **fair** at
85–94.9% (`--caution`), **poor** below 85% (`--incorrect`), and **unused**, which keeps
the neutral surface and prints an em dash. The bar under each key is the redundant
channel: it uses the full colour rather than the 18% tint, so the band is still
obvious at a glance, in greyscale, and to a reader who cannot separate two pale tints.

The board is backed by a table, not replaced by one. `.ka-table` lists the worst keys
with the finger assigned to each and a drill link; `.ka-key` repeats the same key chip
and band tint so the table and the board read as one system. Below 30rem the "Presses"
column is dropped (`.ka-hide-sm`) so the five remaining columns fit a phone without a
horizontal scroll.

---

## 6. Motion

Motion exists to explain a state change, never to decorate.

- **Transitions are 150ms** on `background-color`, `border-color` and `color`, and
  **80ms linear** on the character colour so a typed character resolves instantly.
- **`transition: all` is never used.** Every transition names its properties, so a
  future property change cannot accidentally animate.
- **Only `transform` and `opacity` are animated during a test.** The passage track
  moves with `translate3d`, which stays on the compositor.
- **`prefers-reduced-motion: reduce`** sets `scroll-behavior: auto` on `html` and
  collapses every animation and transition to `0.01ms`. The result panel also stops
  using `behavior: 'smooth'` when it scrolls itself into view.
- **No entrance animations, no parallax, no auto-playing anything.** The site reads
  as a document that is already finished when it arrives.

---

## 7. Accessibility rules

These are enforced in the markup, not left to review.

1. **A skip link** is the first focusable element on every page and moves focus to
   the `<main>` landmark.
2. **Focus is always visible.** `:focus-visible` draws a 2px accent outline with a
   2px offset on everything. It is never removed, and never replaced with a colour
   change alone.
3. **Semantic elements only.** Navigation is `<nav>`, the header is `<header>`, the
   footer is `<footer>`. Every action is a `<button>`; every destination is an
   `<a href>`. There is not one clickable `<div>` in the codebase.
4. **Real form controls.** The duration and drill pickers are radio groups with
   `<fieldset>` and `<legend>`. The hidden text field is a `<textarea>` with a
   label. The copy-result button has an `aria-live` message for its outcome.
5. **Announcements.** The widget has a visually hidden `role="status"
   aria-live="polite"` region that announces the running state and the final result.
6. **`aria-current="page"`** marks the current navigation item.
7. **Landmarks and headings.** One `<h1>` per page, and heading levels that descend
   without skipping.
8. **`touch-action: manipulation`** on links, buttons, inputs, selects, textareas,
   summaries and labels removes the 300ms tap delay without blocking pinch zoom.
9. **Colour is never the only signal**, as described in §1. On the heat map every key
   prints its percentage and carries a band bar, and the same numbers appear in a
   table.
10. **Scrollable regions are reachable.** The heat-map board and both statistics
    tables carry `tabindex="0"`, `role="region"` and a label, so a keyboard user can
    scroll them with the arrow keys instead of being stuck at the edge.
11. **The 404 page is `noindex, follow`** and points its canonical at the home page,
    because `/404/` is not a real URL.
12. **Reduced motion is respected** everywhere, including the result scroll.

---

## 8. Voice

- **Plain and specific.** "Measure your words per minute" beats "Unlock your true
  potential".
- **Second person, active voice.** "Start the test", "Fixing a mistake with backspace
  removes it from the count".
- **No urgency, no gamification.** There are no streaks, no confetti, no "you are
  faster than 92% of people" — the site has no population to compare against, and
  inventing one would be a lie.
- **Honest about limits.** The page says what a number means, what it does not mean,
  and which measure to trust.
- **British/American consistency:** the site uses British spellings (*practise* as a
  verb, *learnt* avoided in favour of *learned* for clarity) and en-US punctuation
  conventions in the metadata.

---

## 9. The social images

`scripts/generate-og.mjs` draws the Open Graph images using the same palette as the
dark theme, so a shared link looks like the site. Each image has the same structure:

- A 1200×630 canvas on `--canvas`.
- A soft radial accent glow in the upper right.
- A left column: the brand mark, an uppercase accent eyebrow, a two-line headline, a
  muted sub-heading, a detail line, and an accent promise line.
- A right panel that mocks the real widget: a drill label, a countdown clock, a
  passage with one incorrect character and a caret on the third line, and three stat
  boxes for WPM, accuracy and errors.

The headline is measured, not guessed. The script renders the SVG, reads the actual
pixel bounds, shrinks the headline until it fits its column, and fails the run if any
copy or panel content escapes its frame.
