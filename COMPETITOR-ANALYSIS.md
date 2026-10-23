# Competitor analysis — keysprint

A review of the typing-test and typing-lesson landscape, the position keysprint takes
in it, and the gaps it deliberately leaves open.

**Research date:** 22 October 2026. Every competitor's site changes; the notes below
record what was observable at the time of the review, not a permanent claim about
their product.

---

## 1. Why this document exists

A free typing test is one of the most saturated corners of the web. Typing test
pages have existed since the early 2000s, and there are dozens of live, well-ranked
options. The competitive question is not "can keysprint be a typing test" — it
obviously can — but **"what does a visitor get here that they would not get from the
first result on a search engine, and why would they come back?"**

This document answers that, and it also records the features that were considered and
deliberately rejected.

---

## 2. Market map

### 2.1 Test-first sites (the direct competitors)

| Site | Positioning | Ads | Account required | Notable |
| --- | --- | --- | --- | --- |
| **typingtest.com** | The default "free typing test" in many markets | Yes, heavy | No | Long-established, multi-language, strong SEO, wide test-length range |
| **typewizz.com** | Modern, minimal, well-designed test | Yes | No | Clean visual design, result history, custom text |
| **typingpal.com** | Test **plus** lessons, built around a keyboard heat map | Yes | Optional | The heat map / "typing fingerprint" is the signature feature |
| **typingstudy.com** | Lessons and per-key accuracy stats | Yes | Optional | Per-key accuracy breakdown, speed-over-time charts |
| **10fastfeet** | Fast, focused, competitive | Some | No | Typing races, WPM leaderboard style |
| **typing.io** | Freemium test suite | Yes | Yes for saving | A few free tests, then a paywall |

### 2.2 Lesson-first platforms (the indirect competitors)

| Site | Positioning | Model | Notable |
| --- | --- | --- | --- |
| **typingclub.com** | K-12 school typing curriculum | Free, ad-supported, teacher admin upsell | 30+ scaffolded lessons, games, teacher dashboards, district sales |
| **keybr.com** | Adaptive typing tutor for adults | Paid subscription | Adapts to the weakest keys and fingers; excellent for absolute beginners |
| **learntyping.org** | Long-standing free tutorial | Free | Numbered lessons, home-row position drills |
| **monkeytype** | Open-source test with a strong community | Free, optional account | Highly customisable, account sync, the community leaderboard and social layer |

### 2.3 The honest summary

The market has three kinds of competitor:

1. **Ad-supported test sites** — fast, free, and monetised by display advertising.
   They are good at the test itself and weak at everything around it.
2. **Curriculum platforms** — typingclub and keybr both sell a *course*, with
   lessons, progression tracking and, in the case of typingclub, a school sales
   motion. They are strong on teaching and weak on being a quick, shareable test.
3. **Community tools** — monkeytype and its clones, which win on social proof and
   habit, and lose on accessibility and on being calm.

keysprint sits in the gap between (1) and (2): **a real typing test that also teaches,
with no advertising, no account, and no dark patterns.**

---

## 3. Feature comparison

| Feature | typingtest.com | typingclub | keybr | typewizz | typingpal | **keysprint** |
| --- | --- | --- | --- | --- | --- | --- |
| Instant test, no signup | Yes | Yes (lesson only) | Account needed | Yes | Yes | **Yes** |
| Test lengths 15s–10m | Yes | No | No | Yes | Yes | **Yes** |
| Gross and net WPM | Yes | n/a | n/a | Yes | Partial | **Yes** |
| Character accuracy | Yes | n/a | n/a | Yes | Yes | **Yes** |
| Word accuracy | Partial | n/a | n/a | Partial | Yes | **Yes** |
| Keystroke accuracy (mistakes counted even after a fix) | No | n/a | n/a | No | No | **Yes** |
| Word / sentence / paragraph modes | Yes | n/a | n/a | Yes | Yes | **Yes** |
| Number and punctuation drills | Partial | Yes (in lessons) | No | Partial | Yes | **Yes** |
| Home-row drill | No | Yes (in lessons) | Yes | No | Yes | **Yes** |
| Structured lesson curriculum | No | Yes | Yes (adaptive) | No | Yes (lessons) | **Yes** (5 stages) |
| Per-key / finger heat map | No | No | Yes | No | **Yes** | **Yes** (`/typing-analysis/`) |
| Result history over time | Yes | Yes | Yes | Yes | Yes | **Partial** (last 20, local) |
| Personal bests | Yes | Yes | Yes | Yes | Yes | **Yes** (local only) |
| Leaderboard / multiplayer | No | Class lists | No | No | No | **No** |
| Advertising | Yes | Yes | No | Yes | Yes | **No** |
| Account required for core use | No | For teacher features | Yes | No | For sync | **No** |
| Works offline after first load | Partly | No | No | Partly | No | **Yes** (static) |
| Screen reader tested | Unclear | Unclear | Unclear | Unclear | Unclear | **Yes** (by construction) |
| Reduced-motion respected | Unclear | Unclear | Unclear | Unclear | Unclear | **Yes** |
| Total JS payload | Large | Large | Large | Medium | Large | **10.6 kB gzipped** |
| Total CSS payload | Large | Large | Large | Medium | Large | **6.9 kB gzipped** |
| Web fonts loaded | Yes | Yes | Yes | Yes | Yes | **None** |
| Third-party requests | Yes | Yes | Yes | Yes | Yes | **None** |

---

## 4. SEO comparison

All seven competitors rank for "typing test", and typingtest.com in particular has a
decade of accumulated authority for the term. keysprint cannot out-authority it and
should not try. What it can do is be **more useful on the page that ranks**.

| Signal | typingtest.com | typingclub | typewizz | typingpal | **keysprint** |
| --- | --- | --- | --- | --- | --- |
| Dedicated page per test length | Yes | No | Yes | Yes | **Yes** (8 pages) |
| Dedicated page per metric (WPM, accuracy) | No | No | Partial | Partial | **Yes** |
| Content below the test on the home page | Thin | n/a | Thin | Moderate | **~600 words** |
| A real lesson curriculum in the index | No | Yes | No | Yes | **Yes** |
| Breadcrumbs | Yes | Yes | Yes | Yes | **Yes** |
| `SoftwareApplication` schema | Yes | No | Yes | Yes | **Yes** (home + test only) |
| `FAQPage` schema | Yes | No | Partial | Yes | **Yes** (home + test only) |
| Fabricated ratings or testimonials | Common in this niche | No | No | Some | **No** |
| Unique canonical per page | Yes | Yes | Yes | Yes | **Yes** |
| Sitemap + robots | Yes | Yes | Yes | Yes | **Yes** |
| Per-page social image | Limited | No | Yes | Limited | **Yes** (13 for 23 routes) |

### What the comparison says

The most striking gap is **content depth on the test page itself**. Most typing test
pages are a widget and a banner ad: the page is an ad inventory pretending to be a
tool. keysprint puts roughly 600 words of genuinely useful explanation *above* the
fold area of the page and a full FAQ below it, covering what the numbers mean, how
to read the accuracy figures, and how long a test should be.

That serves two audiences at once: a human who wants to understand their score, and a
search engine looking for pages that are about "typing speed" rather than about a
"typing test widget".

The second gap is **structured-data honesty**. The niche is full of
`aggregateRating` blocks describing ratings that were never collected. keysprint
claims a rating nowhere, claims a price of `0` because the tool is genuinely free,
and `npm run check:dist` fails the build if a rating, a review or a non-zero price
ever appears in the structured data.

---

## 5. Where keysprint wins

**1. It is honest about the numbers.**
The site publishes the exact formula for every measure it reports — gross WPM, net
WPM, character accuracy, word accuracy, keystroke accuracy — on `/about/` and on the
home page. Most competitors show a number and no definition. The keystroke accuracy
measure, which keeps counting a mistake even after you fix it with backspace, is not
standard anywhere else and is the most useful single number for a beginner.

**2. It has no advertising and no account.**
There is no ad slot, no interstitial, no "sign in to save your score" gate, and no
email field anywhere on the site. The whole product is one HTML page and one small
script. The privacy policy can be honest because there is nothing to disclose.

**3. It is a teaching site, not just a test site.**
A test tells you where you are. It does not tell you what to do next. keysprint pairs
every test with a five-stage curriculum (`/typing-lessons/`), a dedicated home-row
drill, and three targeted practice modes (`/typing-practice/paragraphs/`,
`/numbers/`, `/punctuation/`). The competitor that does this best is typingclub, and
typingclub cannot be used for a one-off speed check without learning its lesson flow.

It also closes the loop after the test. Every finished test feeds a per-key and
per-finger breakdown at `/typing-analysis/`: which key cost the most accuracy, which
finger owns it, and a link straight to the drill that trains it. typingpal and keybr
have versions of this behind an account or an adaptive engine; typingtest.com,
typewizz and typingclub do not have one at all.

**4. It is fast and light.**
A static build with a single small script. No framework runtime, no webfont, no
third-party request. It loads on a slow connection and it works after the first load
with the network off.

**5. It is accessible by construction, not by audit.**
Native radio groups instead of div-and-script pickers, a real `<textarea>` so mobile
keyboards work, a live region for results, visible focus, reduced-motion support,
and a keyboard-visualiser-free but structurally sound passage. Most competitors in
this niche are custom-drawn widgets that screen readers handle poorly.

**6. Every drill is a real drill, not a label.**
The home-row drill uses only `a s d f j k l ;` and the space bar — enforced by a unit
test — rather than shipping generic prose under a "home row" heading, which is what
several competitors do.

---

## 6. Where keysprint loses, honestly

| Gap | Competitor that is better | Why it is acceptable |
| --- | --- | --- |
| Per-key breakdown stays on this device | typingpal, keybr (with an account) | The heat map is real and free, but it aggregates the last 20 tests from `localStorage`. Competitors with accounts sync the same data across devices and keep years of it. Closing that needs a backend and a privacy story, which is out of scope for a static site. |
| Speed-over-time charts | typingstudy, typingpal, keybr | The last 20 tests are now stored with timestamps and listed on `/typing-analysis/`, so the data is there, but nothing draws a trend line yet. The chart is the next piece of work, not a missing foundation. |
| Gamification, streaks, leaderboards | monkeytype, 10fastfeet | Deliberate. Leaderboards require a server and a moderation policy; streaks require a notification system. Both are out of scope for a static site, and both push people toward typing fast rather than typing accurately. |
| Large multi-language corpus | typingtest.com, typewizz | Deliberate for now. Each language needs a native-quality corpus, and a badly-translated corpus is worse than none. |
| Teacher and classroom tooling | typingclub | A different product with a different buyer. It would need accounts, a data model and a real backend. |
| Adaptive difficulty | keybr | keysprint's lessons are staged by hand rather than adapted. Adaptation is a v3 idea. |
| Browser games | typingclub | Deliberate. A game teaches finger position worse than a drill does. |
| SEO authority for the head term | typingtest.com | Unwinnable directly. The play is long-tail: "60 second typing test", "typing accuracy test", "home row typing practice", "how to type faster without looking". |

---

## 7. Features considered and rejected

| Idea | Decision | Reason |
| --- | --- | --- |
| Accounts, cloud sync | **Rejected** | Requires a backend, a database, password handling, a privacy policy that admits to storing data, and a breach surface. The value to a visitor who wants to know their speed is close to zero. |
| Leaderboards and multiplayer | **Rejected** | Needs a server, needs moderation, and rewards speed over accuracy — the opposite of what the site teaches. |
| Fake "you are faster than 92% of people" | **Rejected** | There is no population to compare against. The number would be invented. |
| Testimonials and star ratings | **Rejected** | None exist. A rating block with no reviews behind it is a lie in structured data. |
| "Get 20% faster in 7 days" marketing | **Rejected** | No evidence, and the site is not a coaching product. |
| An email newsletter | **Rejected** | It is the fastest way to turn a free tool into a spam list. |
| Interstitial ads | **Rejected** | They would land in the middle of a typing test, which is the worst possible moment. |
| An app | **Rejected** | A static site that works in any browser covers the same need with none of the maintenance. |
| A "download our desktop app" prompt | **Rejected** | There is no desktop app. The button would be a lie. |
| Difficulty that adapts to the typist | **Deferred** | Real value, but it needs a real data model. Hand-staged lessons cover v1. |

---

## 8. Position

**keysprint is the calm, honest, ad-free typing test that also teaches you to type.**

The competitive claim is not "faster than typingtest.com" or "more features than
typingclub". It is:

> Take the test in five seconds. Understand what the numbers mean. Find out what to
> practise. Come back next week. Nothing else happens.

That positioning is defensible because it is the one the biggest competitors cannot
copy without changing their own business model: typingtest.com and typewizz.com need
the ad inventory, and typingclub needs the school sales motion.

---

## 9. Recommended next steps, in priority order

**Built since this analysis was written:** the per-key accuracy breakdown now ships at
`/typing-analysis/`, and every finished test is added to a local history of the last
20. The list below is what remains.

1. **A speed-over-time chart on `/typing-analysis/`** — the history already stores the
   last 20 tests with timestamps and per-key tallies; what is missing is a small
   inline-SVG trend line. No account, no chart library. Turns a one-off visitor into a
   returning one.
2. **Widen the lesson curriculum** — the middle row, the top row, the bottom row and
   the number row, each with its own drill page, following the home-row pattern that
   already exists.
3. **Drill pages generated from the per-key data** — `/typing-analysis/` already names
   the worst key, the finger that owns it and the drill that trains it. The next step
   is a drill that is generated for the specific keys a visitor keeps missing, instead
   of pointing at a fixed page.
4. **A second language corpus**, if a native speaker will write it. Only then.

---

## 10. Sources

Direct observation of the live sites on 22 October 2026:

- typingtest.com
- typingclub.com
- typewizz.com
- keybr.com
- typingpal.com
- learntyping.org
- typingstudy.com

Supporting context: Monkeytype and 10fastfeet for the community-driven end of the
market; typing.io for the freemium pattern.

Where this document says a competitor "is unclear" on an accessibility point, it
means the point was not verifiable from the outside without a full manual audit, not
that the competitor is known to fail. keysprint's own claims in that column are
verifiable in this repository: the rules are in `DESIGN.md`, and the implementation
is in `src/styles/` and `src/components/`.
