# Design: Quillstone Advisor Desk

This pack shows advisor account pages served straight from Snowflake, so the app is about one
thing: **how fast each part of the page comes back, and from where**. The design treats timing as
the main visual material, the way a race clock or a network waterfall does.

## Brand

- **Name:** Quillstone Advisor Desk, a fictional advisor platform at a fictional firm. A web
  search for "Quillstone" in wealth and advisory turned up no firm using it.
- **Logo mark:** a stopwatch crown on a rounded square, inline SVG (no image files):

```svg
<svg viewBox="0 0 32 32" aria-hidden="true">
  <rect x="1" y="1" width="30" height="30" rx="9" fill="#F2A93B"/>
  <rect x="13" y="4" width="6" height="3" rx="1.5" fill="#15171B"/>
  <circle cx="16" cy="18" r="9" fill="none" stroke="#15171B" stroke-width="2.6"/>
  <path d="M16 18 L21 13" stroke="#15171B" stroke-width="2.6" stroke-linecap="round"/>
</svg>
```

- **Wordmark:** "Quillstone" in the heading face, "Advisor Desk" in small caps tracking beside it.
- **Voice:** calm, precise, operational. Numbers first, short labels, timings always state where
  they came from ("captured", "live", warehouse size, row count). No hype and no savings claims.
  The audience is the advisor (fast, plain account facts), the platform engineer (latency and
  concurrency) and the data platform owner (one fewer system, reconciliation).

## Design direction: "instrument panel"

### Palette (dark first; light theme follows the OS)

| Token | Dark | Light | Use |
| --- | --- | --- | --- |
| `--bg` | `#111317` | `#F3F1EC` | Page |
| `--panel` | `#1A1D23` | `#FFFFFF` | Panels |
| `--panel-2` | `#22262E` | `#ECE9E2` | Insets, table headers |
| `--line` | `#2E333D` | `#DAD5CA` | Hairlines |
| `--ink` | `#ECEAE4` | `#17191D` | Primary text |
| `--ink-2` | `#A8ACB5` | `#4A4E57` | Secondary text |
| `--saffron` | `#F2A93B` | `#965700` | Brand, timing, focus, primary actions |
| `--mint` | `#3DD6B5` | `#0B7A63` | Single-source / healthy / fast |
| `--coral` | `#FF7A66` | `#B83A26` | Reconciliation break / slow / error |
| `--sky` | `#7FB2FF` | `#2F5FB3` | Benchmark lines, info |
| `--plum` | `#C99BFF` | `#6B3FB0` | AI only |

Saffron on graphite is the signature. Text pairs were checked against WCAG AA (4.5:1 for body
text): saffron `#F2A93B` on `#1A1D23` is 8.5:1, mint 9.2:1, coral 6.6:1, `--ink-2` 7.4:1; in light
mode `#965700` on `#F3F1EC` is 5.1:1, mint `#0B7A63` and coral `#B83A26` are at least 4.6:1, and
`--ink-2` is 8.3:1 on white. Ink `#15171B` on a saffron button is 9.0:1.

### Typography

- Headings: **Space Grotesk** (self-hosted through `next/font`, no CDN at runtime), tight tracking.
- Body: **Inter**.
- Timings, IDs and figures: **JetBrains Mono** with tabular numerals, so latency chips line up.

### Layout model

- **Top navigation, no sidebar.** A 56 px graphite bar: logo and wordmark, four tabs
  (Account desk, Architecture, Load lab, Cost model), the "Viewing as" advisor chip, and a
  Sample/Live switch with an environment badge.
- Under the bar, a thin **timing strip**: the page's last load as a segmented bar (one segment per
  widget query), so every screen opens with its own speed.
- **Account desk is master-detail:** a 360 px book rail (search, sort, status pills) on the left,
  the account on the right. At 390 px the rail becomes a full-width list and the account opens as
  a sheet with a Back control.
- Other screens use a 12-column grid of panels with 1 px hairlines rather than floating cards
  with shadows.

### Density

Medium-high, like a trading or operations tool: 13–14 px body, 32–36 px table rows, numbers right
aligned. KPI tiles are compact strips, not large cards.

### Signature components

- **Latency chip** on every widget: stopwatch icon, mono timing, and source (`live · XS
  interactive` or `captured`). Colour runs mint (< 150 ms) to saffron to coral (> 600 ms).
- **Query waterfall:** the four account-page queries drawn as parallel bars on a shared ms axis.
- **Before/after rail diagram** on Architecture: systems as nodes on a horizontal rail, data
  packets animating along it; the duplicate path shows a coral break marker on the copy step.
- **Percentile ladder** on Load lab: p50/p95/p99 as stepped rungs over the latency timeline.

### Charts (Recharts)

Thin 1.5 px lines, no drop shadows, dotted 1 px grid, mono axis ticks, tooltips on every chart,
legends where there is more than one series. Account value is an area with a saffron gradient fill;
benchmark is a sky dashed line; histograms use mint bars with a coral tail past p95.

### Motion

Short and purposeful: 160 ms fades and slides on panel and drawer changes; skeleton shimmer while a
widget loads; latency chips count up from 0 to the measured value; packets move along the
architecture rail; AI briefs reveal word by word. All motion respects `prefers-reduced-motion`.

## How this pack differs from the live catalog

I looked at the Try apps and landing pages of Loss Triangle Suite, Workforce Intelligence,
Auto Finance Portfolio Analytics (Odometer), Wealth Advisor Assistant, Cross-Border & FX,
Card Fraud Console, Cyber Risk Copilot and Site Selection, plus the in-progress Tallyward (pack 05)
direction.

| Pack | Their look | What this pack avoids |
| --- | --- | --- |
| Loss Triangle Suite | Dark violet sidebar, purple pill nav, rounded cards | Left sidebar; purple accents |
| Workforce Intelligence | Cream canvas, indigo sidebar, serif display headline with gradient words, pastel blobs on KPI cards | Serif display type; gradient text; decorative blobs |
| Auto Finance (Odometer) | Deep green/teal sidebar, big gradient hero banner with stat tiles, grid-paper background | Hero banner; green-teal palette; sidebar |
| Wealth Advisor Assistant | Navy sidebar, Snowflake-blue gradient banner, white list cards | Snowflake blue; banner; same advisor-list card pattern (same audience, so the difference matters most here) |
| Cross-Border & FX | White page, blue header, form-left/report-right | Plain white report layout |
| Card Fraud / Cyber / Site Selection | Light Streamlit-style or blue-grey dashboards | Generic dashboard grid |
| Tallyward (05, in progress) | Ink, paper and red audit-workpaper look | Paper textures; red as brand colour |

So this pack is the only one with **top navigation and no sidebar**, a **graphite and saffron**
palette, a **master-detail rail** as its main layout, **mono timing chips** as the visual motif,
and **no hero banner** (the app opens straight into the advisor's book, and the landing page leads
with a stopwatch-style timing graphic rather than a screenshot hero).

## Landing page (docs/index.html)

Its own identity in the same brand: graphite page, saffron rule lines, a hero that is an animated
CSS "timing strip" with real captured timings, then a problem-first headline, the four story beats
as numbered panels with captioned screenshots, a before/after table, setup facts (time, cost,
edition), docs links and the disclaimer. Light mode follows the OS. No scripts from a CDN; fonts
fall back to system faces on the static page.
