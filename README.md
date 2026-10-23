# keysprint

A free online typing test, typing speed measurement and touch-typing lesson platform.

keysprint measures words per minute and accuracy in the browser, then gets out of the
way. There is no account, no email address, no download and no upsell. The typing
engine runs entirely on the client, so a score never leaves the device.

- **Live site:** <https://keysprint.onrender.com>
- **Stack:** Astro 7 (static output) + Tailwind CSS 4 + TypeScript, with a small
  hand-written typing engine and Vitest for the scoring maths.

---

## Contents

- [What is on the site](#what-is-on-the-site)
- [Running it locally](#running-it-locally)
- [Scripts](#scripts)
- [Environment variables](#environment-variables)
- [Project structure](#project-structure)
- [How the typing test works](#how-the-typing-test-works)
- [Scoring definitions](#scoring-definitions)
- [The per-key breakdown](#the-per-key-breakdown)
- [Text corpus and licensing](#text-corpus-and-licensing)
- [SEO](#seo)
- [Accessibility](#accessibility)
- [Testing](#testing)
- [Deploying to Render](#deploying-to-render)
- [Regenerating the social images](#regenerating-the-social-images)
- [Browser support](#browser-support)
- [Design system](#design-system)

---

## What is on the site

32 routes, all statically generated:

| Area | Routes |
| --- | --- |
| Home | `/` |
| Typing tests | `/typing-test/` and one page per length: `/typing-test/15-second/`, `/typing-test/30-second/`, `/typing-test/1-minute/`, `/typing-test/3-minute/`, `/typing-test/5-minute/`, `/typing-test/10-minute/` |
| Typing tests by metric | `/typing-test/words-per-minute/`, `/typing-test/accuracy/` |
| Learn | `/learn-typing/`, `/typing-lessons/` and one page per lesson: `/typing-lessons/home-row/`, `/typing-lessons/index-fingers/`, `/typing-lessons/middle-fingers/`, `/typing-lessons/ring-fingers/`, `/typing-lessons/little-fingers/`, `/typing-lessons/upper-row/`, `/typing-lessons/lower-row/`, `/typing-lessons/capitals-shift/`, `/typing-lessons/numbers-punctuation/`, `/typing-lessons/mixed-practice/` |
| Practice | `/typing-practice/`, `/typing-practice/paragraphs/`, `/typing-practice/numbers/`, `/typing-practice/punctuation/` |
| Analysis | `/typing-analysis/` — the per-key and per-finger heat map |
| Site pages | `/about/`, `/contact/`, `/privacy-policy/`, `/terms/` |
| Error page | `/404.html` |

Every page with a test embeds the same widget. Changing the duration, the drill or
the difficulty swaps the text and resets the test in place — there is no page reload
mid-test, and no layout shift.

Each test opens on a **Ready** screen: the passage is blurred behind a translucent
overlay with a **Start Test** button, and the timer sits at its full length. Start
lifts the blur and focuses the typing input, but the clock does not begin until the
first accepted keystroke, so positioning your hands costs nothing. Restarting, or
changing a setting mid-run, returns to the Ready screen with the new text. A
**Full Screen** button on the toolbar puts the test on the whole display — Escape or
the same button returns to the page, and the run is never interrupted or reset.

The ten lesson pages use a different layout from the timed test widget: a two-column
studio with the passage on the left and a virtual keyboard, finger guide and live
metrics on the right. The curriculum runs from the home row to mixed paragraphs, and
each lesson's completion is stored in the browser (see *Lesson progress* below).

## Lesson progress

Each lesson keeps its own record under `keysprint.lesson.v1` and its own in-progress
draft under `keysprint.lesson-draft.v1`, both in `localStorage`. A lesson is passed when
the passage is finished (or, for the timed mixed lesson, when the clock runs out) at or
above that lesson's accuracy threshold.

A draft is saved as you type, so a reload mid-lesson does not lose the attempt. A
restored attempt reopens **paused**, with a note that it was picked up and a Resume
button — reading time while you get your bearings is not counted against you.

Restarting a lesson clears only that lesson's draft and attempt. It never touches the
other nine lessons, your best scores or your theme.

The teaching lessons are untimed sequences, so a speed number would be meaningless while
you are still learning where the keys are. Those lessons show elapsed time and progress
but no live WPM; only the timed mixed-practice lesson reports speed. See
`/typing-lessons/#scoring` for the full scoring explanation.

## Key sounds

Each keystroke plays a short recorded sample, so the drill sounds like a keyboard:

| Moment | Sample |
| --- | --- |
| An ordinary key | InspectorJ — "Computer Keyboard Pressing Single Key Releasing" |
| The space bar | Audio Falcon — "Single Keyboard Click Spacebar" |
| A wrong character | Marcello Del Monaco — "wrong answer" |

Exactly one sample plays per keystroke, and Backspace is silent. The samples live in
`public/sounds/` as `.m4a`, `.ogg` and `.mp3`, and are played from a small pool of
preloaded `Audio` elements so a fast typist never waits on a file load. Repeated
keystrokes in the same burst are tapered slightly and detuned at random so a long run
does not sound mechanical; the mistake sound is deliberately left at a constant volume
and pitch so that every mistake reads as the same event.

Audio is entirely optional: every failure is swallowed, so a browser that blocks autoplay
or cannot decode the files simply plays the drill silently. `npm run check:dist` fails the
build if any of the nine sound files is missing or empty, because they are loaded from
JavaScript and would otherwise never be checked.


## Running it locally

Requires **Node.js 22.23.4 or newer** (see `engines` in `package.json`).

```bash
npm install
npm run dev
```

The dev server starts on <http://localhost:4321>.

To check the production build locally:

```bash
npm run build
npm run preview
```

## Scripts

| Script | What it does |
| --- | --- |
| `npm run dev` | Astro dev server with hot reload. |
| `npm run build` | Static build into `dist/`. |
| `npm run preview` | Serves the built `dist/` locally. |
| `npm run check` | `astro check` — TypeScript and Astro template diagnostics. |
| `npm run test` | Vitest unit tests for the typing engine and scoring maths. |
| `npm run test:watch` | Vitest in watch mode. |
| `npm run og` | Regenerates the Open Graph PNGs (needs `sharp`, see below). |
| `npm run check:dist` | Audits the built site in `dist/`. |
| `npm run verify` | `check` → `test` → `build` → `check:dist`. Use this before shipping. |

`npm run check:dist` runs against the *output* rather than the source, so it catches
the things a source review cannot: a link to a page that was renamed, a social image
referenced in a meta tag that was never generated, a canonical URL pointing at the
wrong route, duplicate titles or descriptions, malformed JSON-LD, a structured-data
claim of a rating or a price the site does not have, an empty heading, a skipped
heading level, an image without an `alt` attribute, a missing skip link, or a page
missing from the XML sitemap.

## Environment variables

| Variable | Default | Purpose |
| --- | --- | --- |
| `SITE_URL` | `https://keysprint.onrender.com` | The production origin. Used for canonical URLs, Open Graph URLs, the XML sitemap and `robots.txt`. |

Copy `.env.example` to `.env` and set it if you are running on another domain:

```bash
SITE_URL=https://keysprint.example
```

Set it in the hosting provider's environment settings for production builds — the
value is baked in at build time, so changing it requires a rebuild. The GitHub
Pages workflow supplies it automatically (see below).

> `robots.txt` is generated as an Astro route (`src/pages/robots.txt.ts`) rather than
> a static file in `public/`, so the sitemap address it advertises always matches the
> configured origin. There is no second copy of the domain to keep in sync.

## Project structure

```
.
├── astro.config.ts          Site config: origin, sitemap, Tailwind, trailing slashes
├── scripts/
│   ├── generate-og.mjs      Draws the Open Graph images (SVG → PNG)
│   └── check-dist.mjs       Post-build audit of dist/
├── src/
│   ├── config/site.ts       Site name, tagline, origin, absoluteUrl(), nav
│   ├── layouts/BaseLayout.astro
│   │                         Document shell: meta tags, JSON-LD, skip link, theme
│   ├── components/          Header, Footer, Breadcrumbs, Faq, Callout, PageHero,
│   │   │                     ContentSection
│   │   ├── analysis/        KeyboardHeatmap
│   │   └── typing/          OptionGroup, ResultsPanel, TypingTest
│   ├── lib/
│   │   ├── storage.ts       localStorage helpers (best scores, history, theme)
│   │   └── typing/
│   │       ├── types.ts     Shared types
│   │       ├── scoring.ts   The formulas the site reports
│   │       ├── engine.ts    The DOM-free typing engine
│   │       ├── keys.ts      The keyboard model and the per-key statistics
│   │       ├── drills.ts    Drill names and drill kinds
│   │       ├── selection.ts Builds the text for a test
│   │       └── texts.ts     The original text corpus
│   ├── pages/               One directory per route
│   ├── scripts/
│   │   ├── typing-widget.ts The client script: engine ↔ DOM bridge
│   │   └── typing-analysis.ts
│   │                         The client script: history → heat map
│   └── styles/
│       ├── global.css       Design tokens, base layer, component primitives
│       ├── typing.css       The typing widget
│       └── analysis.css     The heat map and the statistics tables
├── tests/                   Vitest unit tests
└── public/                  favicon.svg and the generated social images
```

## How the typing test works

The engine (`src/lib/typing/engine.ts`) knows nothing about the DOM. It accepts
characters and a clock, and reports state. The widget script
(`src/scripts/typing-widget.ts`) is the only part that touches the page.

1. **Text is built** by `buildText()` in `selection.ts`, from the corpus in `texts.ts`.
   The budget is 20 characters per second of test time, with a floor of 320
   characters so a 15-second test still has something to read. A seed makes the
   selection reproducible, which is what the tests rely on.
2. **Input is captured** by a hidden `<textarea>` that sits over the passage. Keeping a
   real text field in the DOM is what makes the on-screen keyboard work on a phone;
   the field's own text and caret are transparent, and `keydown` is intercepted so the
   engine stays in control.
3. **Each keystroke** updates the engine, which returns the character states. Only the
   characters that actually changed are written to the DOM, so a keystroke is a
   constant amount of work no matter how long the passage is. Finished blocks collapse
   back into a single text node to keep the document small.
4. **The caret** is marked with `is-current` and kept in view by translating the
   passage track with `translate3d`. The offset only changes when the caret moves to
   a new line, so the text does not jitter on every keystroke, and the transform stays
   on the compositor.
5. **The clock** is injected, and the test finishes on the *deadline*, not on the
   timestamp of the late frame. A tab that is backgrounded for a minute therefore
   cannot inflate the elapsed time.
6. **Results** are computed from the buffer at the moment the clock runs out, shown in
   the results panel, and announced through an `aria-live` region.

The duration, drill and level are reflected in the URL with `history.replaceState`
(`?duration=60&mode=paragraphs&difficulty=easy`) so a test can be linked to, without
adding a history entry for every click. The URL is only rewritten when a control
changes, so a shared link loads exactly the test it describes. The dedicated
duration pages set `syncDuration={false}`, and the widget then ignores
`?duration=` on load — a page and its test never disagree about how long they are.

## Scoring definitions

Every formula below is implemented in `src/lib/typing/scoring.ts`, unit tested, and
explained on `/about/` and on the home page.

| Measure | Definition |
| --- | --- |
| Gross WPM | `(characters / 5) / minutes` |
| Net WPM | `((characters − errors) / 5) / minutes` |
| Character accuracy | `(characters − errors) / characters × 100` |
| Word accuracy | `correctWords / words × 100` |
| Keystroke accuracy | `correctKeystrokes / keystrokes × 100` |
| Error count | Characters in the buffer that differ from the target |

One word is five characters. Character accuracy looks at the buffer as it stands, so
fixing a mistake with backspace restores the score. Keystroke accuracy does not: it
keeps counting a mistake even after you delete and fix it, which is the honest measure
of raw keyboard accuracy. Net WPM is the number to trust, because it rewards accuracy
rather than speed.

## The per-key breakdown

`/typing-analysis/` answers the question a single WPM number cannot: *which keys are
costing me accuracy, and which finger is responsible?*

1. **Each finished test records its keystrokes.** The engine keeps a tally per
   character: how many times it was pressed, how many of those presses were correct,
   and how many times it was the expected character but something else was typed.
2. **The test is saved locally.** `src/lib/storage.ts` keeps the last 20 results in
   `localStorage` under `keysprint.history.v1`, together with their tallies and a
   timestamp. Nothing is uploaded; the clear button on the page, or the browser's
   site data, removes it.
3. **The board is a data model, not a picture.** `src/lib/typing/keys.ts` describes a US
   QWERTY layout with the standard touch-typing finger assignment. A shifted form folds
   into the same physical key, so a capital `A` is charged to the `a` key. Characters
   that are not on the board (the `£` and `—` in the punctuation corpus) are still
   counted by the engine and simply do not appear on the map.
4. **Accuracy per key** is `correct / (pressed + missed)`. A key that is always skipped
   therefore shows 0% instead of disappearing, which is the whole point of the page.
5. **The page renders on the server.** The board, the legend and the explanation exist
   in the HTML; the script only paints the percentages and fills the two tables. With
   no stored history the page is a complete explanation plus an invitation to take a
   test, not an empty shell.

## Text corpus and licensing

Every passage in `src/lib/typing/texts.ts` was written for keysprint. Nothing is
scraped, quoted or adapted from a third party, so the site ships without attribution
obligations or licence conditions.

The corpus is organised by difficulty — `easy`, `medium`, `hard`, `paragraphs` and
`punctuation` — plus a `numbers` drill and a `homeRow` drill that uses only the eight
home-row keys and the space bar. The home-row corpus is verified by a unit test that
asserts every character matches `/^[asdfjkl; ]+$/`.

The ten lesson sequences in `src/lib/lessons.ts` are written the same way. A unit test
walks every lesson and asserts that each character is one the on-screen keyboard guide
can point at, so a lesson can never ask for a key the keyboard does not show.

The keystroke sounds in `public/sounds/` are third-party recordings, trimmed to the
click itself and encoded into three formats. They are **not** covered by the same
"written for keysprint" claim as the text: check the licence of each source before
shipping this site commercially, and in particular note that InspectorJ's samples
require attribution unless you hold their attribution-free licence. The credits are
listed in the *Key sounds* section above.

## SEO

- Every page has a unique title, a unique meta description, a self-referencing
  canonical URL, and Open Graph and Twitter card tags.
- `WebSite` and `Organization` structured data appear on every page;
  `BreadcrumbList` appears on every page below the home page; `SoftwareApplication`
  and `FAQPage` appear only on the home page and `/typing-test/`, where the markup
  matches content that is visible on the page.
- No ratings, reviews or prices are claimed anywhere. The only price in the structured
  data is `0`, which is accurate: the tool is free. `npm run check:dist` fails the
  build if that ever stops being true.
- An XML sitemap is generated at build time by `@astrojs/sitemap`, and `robots.txt`
  points at it.
- Each page has a 1200×630 social image in `public/og/` — thirteen images cover all
  23 routes, with `default.png` as the shared fallback for site pages.

## Accessibility

- A skip link to the main content is the first focusable element on every page.
- Focus is always visible: `:focus-visible` draws a 2px accent outline with a 2px
  offset, on every interactive element.
- The typing test announces its state through an `aria-live` region, so the result
  is not a purely visual event.
- Every control is a real `<button>` or `<input>`; nothing is a clickable `<div>`.
  The duration and drill pickers are radio groups with real labels.
- `prefers-reduced-motion: reduce` disables smooth scrolling and cuts animation and
  transition durations to near zero.
- `touch-action: manipulation` on interactive controls removes the 300ms tap delay on
  mobile.
- Numbers use `font-variant-numeric: tabular-nums`, so a live counter does not shift
  as the digits change.
- Colour is never the only signal: incorrect characters are also marked
  `aria-invalid`, and the caret carries a text alternative.
- On the heat map, every key prints its accuracy as a number as well as a colour, and
  the same information is repeated in a table. Scrollable regions (the keyboard and the
  tables) are focusable and labelled, so they can be scrolled from the keyboard.

## Testing

```bash
npm run test
```

75 unit tests cover the scoring maths (including the edge cases — zero characters,
zero elapsed time, errors past the end of the text), the engine (typing, backspace,
correcting a mistake, the clock crossing the deadline, per-key tallies), text
selection (the character budget, the seed, the home-row corpus), and the analysis
(merging tallies across tests, the keyboard layout, accuracy bands, weakest keys,
finger summaries, and the storage format including damaged data).

The tests run in Vitest against the same modules the browser uses. The engine takes
its clock as an argument, so the tests never wait for real time to pass.

### Browser checks

The built site was also driven through a real headless browser, in both themes and
at both a 1440 px and a 390 px viewport:

- **Every route** was checked for horizontal overflow, exactly one `<h1>`, skipped
  heading levels, missing `alt` attributes, unlabelled form controls, buttons and
  links without an accessible name, and a present skip link.
- **axe-core 4.10.2** reports **0 violations** on all 32 pages, in both themes at
  1440 px and 375 px. The only "incomplete" results are colour-contrast checks that
  axe cannot compute: a transparent `<textarea>` over the passage, and the heat-map
  keys whose tint is a `color-mix()`. Every such pair was measured by hand with the
  WCAG formula instead (see [DESIGN.md](./DESIGN.md)).
- **The lesson studio** was driven through the real curriculum: the next-key highlight
  and finger guidance follow the cursor, a correct character marks the virtual key
  `is-correct` and a wrong one `is-incorrect`, restoring a draft reopens the lesson
  paused, and a wrong keystroke is counted in the error total rather than swallowed.
- **The keystroke sounds** were played through a real browser with `HTMLMediaElement.play`
  instrumented: a correct letter calls it once with `key-press`, the space bar once with
  `key-space`, and a wrong character once with `key-wrong`. `Backspace` never calls it.
  All three files were fetched and decoded (`canplaythrough`) in each format before the
  test, so the check is not just "the request 404s".
- **The widget** was exercised end to end: 30 correct characters produce 30 correct
  spans and a caret at index 30; a wrong character produces one `is-incorrect` span,
  one `aria-invalid="true"` and a dropped accuracy; `Backspace` clears the error and
  restores the score; the clock counts down; the test ends on the deadline and
  fills the results panel; the live region announces the result.
- **The URL** round-trips: changing a control writes `?duration=…&mode=…&difficulty=…`,
  and loading that URL restores the same test.
- **The analysis page** was taken through the whole loop: a real 15-second test with
  two deliberate mistakes wrote exactly one history entry with 17 key tallies, and
  `/typing-analysis/` then painted those keys, listed the test, and offered the right
  drill links. The clear button removed the stored history, reset the board to
  "unused" and announced the result.
- **The theme toggle** flips the `.dark` class, updates the `theme-color` meta tag,
  and the choice survives a reload.
- **Reduced motion** is honoured: with `prefers-reduced-motion: reduce` the scroll
  behaviour becomes `auto` and every transition and animation collapses to 0.01 ms.

## Deploying to GitHub Pages

The site is a static build, and the included workflow at
`.github/workflows/deploy.yml` publishes it with GitHub Actions.

1. Create a repository named `<username>.github.io` (for example,
   `legendcoder01.github.io`). This is a GitHub Pages **user site**, so it is
   served from the domain root and every root-absolute link keeps working.
2. Push the project with `main` as the default branch.
3. In the repository, open **Settings → Pages** and set **Source** to
   **GitHub Actions**. The workflow can enable this on its first run, but the
   setting is the authoritative switch.
4. Push to `main` (or run the workflow manually). It verifies, tests and builds
   the site, then publishes `dist/`.
5. The workflow sets `SITE_URL` to `https://<username>.github.io` automatically.
   To use a custom domain instead, add it under **Settings → Pages**, put the
   domain in a file at `public/CNAME`, and create a repository **variable**
   named `SITE_URL` with the same origin.

> A **project site** (`https://<username>.github.io/<repo>/`) is not supported
> by this configuration as-is: internal links and assets are root-absolute.
> Use a user site, a custom domain, or add an Astro `base` path first.

## Deploying to Render

The site is a static build, so any static host works. On Render:

1. Create a **Static Site** service pointing at this repository.
2. Build command: `npm run build`
3. Publish directory: `dist`
4. Add `SITE_URL` in the environment, set to the service URL — or to the custom
   domain once one is attached.
5. Set the Node version to 22.23.4 or newer in `package.json` (`engines`).

`sharp` is deliberately *not* a dependency. The social images are committed to
`public/og/`, so the build never needs a native binary, and a failed install cannot
take the site down.

## Regenerating the social images

The Open Graph images are an optional step, so `sharp` is not in `package.json`:

```bash
npm i -D sharp
npm run og
```

This writes thirteen 1200×630 PNGs into `public/og/`. The script draws them as SVG and
rasterises them, then measures the rendered pixels to check that no headline overflows
its column and that no panel content escapes its frame — it fails the run rather than
writing a broken image.

## Browser support

Current Chrome, Edge, Firefox and Safari, on desktop and mobile. The site uses
`IntersectionObserver`-free, framework-free, plain TypeScript in the browser, so the
JavaScript payload is one small script per page with no dependencies.

## Design system

See [DESIGN.md](./DESIGN.md) for the tokens, typography scale, component primitives
and the rules the interface follows.

[COMPETITOR-ANALYSIS.md](./COMPETITOR-ANALYSIS.md) records the competitive review
that shaped the feature set.
