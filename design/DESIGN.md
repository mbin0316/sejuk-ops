# Sejuk Ops — UI/UX design spec

Reference spec for building the Sejuk Sejuk Service internal operations app. Follow it for every screen. The look: **midnight navy on a cool off-white, soft rounded corners, a periwinkle accent, Lexend type.**

- Visual references: `screens/*.png`. Open `screens/*.html` in a browser to inspect exact markup and styles.
- Token values: `tokens/tokens.css` (CSS variables), `tokens/tailwind.config.js`, `tokens/tokens.json`.
- If anything here conflicts with the reference HTML, this spec wins.

---

## 1. Product context

| | |
|---|---|
| Company | Sejuk Sejuk Service Sdn Bhd: aircon installation, servicing and repair |
| Scale | 5 branches (KL, PJ, Shah Alam, JB, Penang), 40+ technician teams |
| Admin users | Desktop, all day. Need density, filters and fast scanning |
| Technicians | Phones in the field, often in sunlight, one hand. Need big targets and few words |
| Core workflow | **Order → Assignment → Service completion → Manager / accounts review** |

Two surfaces share one design language:

1. **Admin web app** (desktop-first, responsive down to phone)
2. **Technician app** (mobile-first, 390px reference width)

---

## 2. Design principles

1. **Navy, not black.** Dark surfaces are `--navy-900` (#1E2A44). Never use #000 or near-black greys.
2. **Soft corners everywhere.** No square corners on any visible container or control.
3. **One dark panel per screen** (plus the sidebar or tab bar). Everything else is white cards on the off-white page.
4. **One highlighted card per screen at most** (`--accent-strong` fill). Use it for the single thing that needs action, e.g. "Waiting for review".
5. **Status colour is consistent everywhere.** A job status has the same colour in a badge, chart, dot, calendar or map pin. Always pair the colour with a text label.
6. **Separate with colour and space, not shadows or borders.** Cards sit on `--page` with no border. Shadow is optional and at most `--shadow-card`.
7. **Two font weights only:** 400 and 500. No bold 600/700.

---

## 3. Tokens

### Colour

| Token | Hex | Use |
|---|---|---|
| `--navy-900` | #1E2A44 | Sidebar, hero chart panel, technician summary card, bottom tab bar, dark primary button ("Assign new job") |
| `--navy-800` | #33415E | Inactive nav icon chips, segmented-toggle track, chart baseline, "later" progress segments (all inside navy) |
| `--page` | #F3F6FB | App background |
| `--surface` | #FFFFFF | Cards, inputs, list rows |
| `--border` | #E3E8F0 | Input and outline-button borders, dividers, "New" badge bg |
| `--ink` | #1A2235 | Primary text |
| `--ink-muted` | #5B6478 | Secondary text, labels, captions, inline icons |
| `--on-navy` | #FFFFFF | Text and active icons on navy |
| `--on-navy-muted` | #A9B4C8 | Axis labels and captions on navy |
| `--on-navy-soft` | #C9D1E0 | Inactive nav icons and legend text on navy |
| `--accent` | #6C7CF0 | Progress fills, "assigned / next" marks, logo second square. **Never behind body text** |
| `--accent-strong` | #4F5FD6 | Primary CTA buttons ("Start job"), the highlight card |
| `--accent-text` | #3F4FC4 | Links ("View all"), accent text, avatar initials |
| `--accent-tint` | #E8EBFD | Progress track, avatar and team chip bg, "Assigned" badge bg |

### Job status mapping (single source of truth)

| Status | Mark / chart | Badge bg | Badge text | Label |
|---|---|---|---|---|
| New order | `--ink-muted` | `--border` | `--ink-muted` | "New" |
| Assigned / in progress | `--accent` | `--accent-tint` | `--accent-text` | "Assigned" / "In progress" |
| Pending review (manager / accounts) | `--warning` #F5B544 | `--warning-tint` | `--warning-text` | "In review" |
| Completed / approved | `--success` #3FC1A5 | `--success-tint` | `--success-text` | "Completed" |
| Overdue / rejected | `--danger` #F07A6A | `--danger-tint` | `--danger-text` | "Overdue" / "Rejected" |

`--success`, `--danger` and `--warning` are for marks (bars, dots, segments). Never use them as text colour on light backgrounds; use the `-text` variants.

### Typography: Lexend (Google Fonts), weights 400 and 500

| Style | Size / line height | Weight | Use |
|---|---|---|---|
| hero | 36 / 40 | 500 | Big number in a navy panel ("210", "3 of 5") |
| metric | 32 / 38 | 500 | KPI tile numbers |
| title | 24 / 32 | 500 | Page title (desktop). Mobile header: 20/26 |
| heading | 18 / 26 | 500 | Card headings. Mobile card heading: 16/22 |
| body | 14–15 / 21–22 | 400 | Default text, list primary lines |
| label | 13 / 18 | 400–500 | Form labels, buttons, toggles, subtitles |
| caption | 12 / 16 | 400 | Timestamps, axis labels, percentages, badge text (500) |

Money: `RM 1,250.00` in tables, `RM 86.2K` on KPI tiles. Dates: `19 Nov 2026, 3:45 PM`. Job IDs: `SJ-1042`. Teams: `Team KL-03`, short code `KL3`.

### Spacing and radius

- Spacing scale: 4, 8, 12, 16, 24, 32 px.
- Grid gap between cards: **16px**. Card padding: **24px** desktop, **20px** mobile (KPI tiles 20px).
- Radius:

| Token | Value | Applies to |
|---|---|---|
| `--radius-sm` | 10px | Inputs, selects, search field |
| `--radius-btn` | 12px | Buttons, icon chips, nav items, team code chips |
| `--radius-md` | 16px | Cards, KPI tiles, list rows |
| `--radius-lg` | 22px | Sidebar, hero panel, highlight card, team workload card, technician summary card, bottom tab bar |
| `--radius-pill` | 999px | Badges, segmented toggles, avatars, progress bars, legend dots |

- Chart bars have rounded ends: 6px at the free end, 3px at the baseline end.

---

## 4. Components

### Sidebar (admin, desktop)
- 72px wide, full height, `--navy-900`, radius 22px, 16px gap from the window edge and content.
- Top: logo mark (two rounded squares: white 20px and `--accent` 18px, offset diagonally, radius 7px).
- Middle: nav items as 44×44 links, radius 12px, 10px gap. Active: white bg + navy icon, `aria-current="page"`. Inactive: `--navy-800` bg + `--on-navy-soft` icon.
- Bottom: Settings, Sign out.
- Nav order: Overview, Job orders, Technician teams, Schedule, Reports.
- At ≤760px it becomes a horizontal bar above the content.
- Icons: outline, 1.8px stroke, round caps and joins, 20px (Tabler or Lucide).

### Top bar (admin)
- Left: page title (24px) and a muted subtitle ("Thursday, 19 Nov 2026 · Updated 3:59 PM").
- Right: Branch `<select>` with a visible label, a search field (280px, placeholder "Search job no., customer or phone"), a notification icon button with a coral unread dot, and an initials avatar.
- All controls are 44px tall, white, with a 1px `--border` and radius 10–12px. Wraps on small screens.

### Hero chart panel
- `--navy-900`, radius 22px, padding 24px.
- Header: heading "Service performance", a hero number and a muted descriptor; a segmented toggle on the right (1W / 1M / 3M / 1Y).
- Segmented toggle: track `--navy-800` pill with 4px padding. Active segment: white pill with navy text, 500 weight, `aria-pressed="true"`. Inactive: white text.
- Legend row: 10px dots with labels in `--on-navy-soft`.
- Chart: a diverging bar chart over a baseline (`--navy-800`, 1px). Completed bars go up (`--success`, 14px per job), overdue bars go down (`--danger`). Bars are max 12px wide with a 6px gap. Y-axis labels and every 5th date label in `--on-navy-muted`, 12px.
- Wrap the chart in `role="img"` with a descriptive `aria-label`, and allow horizontal scroll under 480px.

### KPI tile
- White, radius 16px, padding 20px, min-height 150px. Label row at the top, value row at the bottom (`justify-content: space-between`).
- Label: 18px muted outline icon and 14px text.
- Value: 32px metric, optionally followed by a delta chip (a status tint pill, 12px, e.g. "+4 vs yesterday" in success colours) or a muted 12px qualifier ("per job").

### Status breakdown card ("Jobs by status")
- White, radius 16px, spans two rows of the KPI grid.
- Total (metric) and "this month".
- Segmented bar: 28px tall, 3px gaps, segments sized by count, outer ends 10px radius, inner 4px.
- Legend list: 14px rounded-square swatch, name, % caption, count right-aligned.

### Team workload card
- White, radius 22px, padding 24px. Heading with a "All 42 teams" link.
- Each row: 44px `--accent-tint` code chip (radius 12px, `--accent-text`, 13px 500), team name and muted branch, an 8px progress bar (`--accent` on `--accent-tint` track, pill), and "5/6 jobs" with a % caption.
- Footer: full-width dark button "+ Assign new job", 48px, `--navy-900`, radius 12px.

### Activity list
- Rows: primary line (job ID · job type) and a muted secondary line (team or customer · time), with a status badge on the right.
- Status badge: pill, 12px, weight 500, padding 4×10, colours from the status table.

### Highlight / action card
- `--accent-strong` bg, radius 22px, padding 24px, white heading and body.
- Full-width white button with navy text, 48px, radius 12px.
- Only one per screen.

### Buttons

| Variant | Style | Example |
|---|---|---|
| Primary | `--accent-strong` bg, white text, 500 | "Start job" |
| Dark | `--navy-900` bg, white text | "Assign new job" |
| On-accent | white bg, navy text | "Review jobs" |
| Outline | white bg, 1px `--border`, `--ink` text | "Navigate", "Call" icon button |
| Icon | 44×44, outline style, `aria-label` required | notifications |

- Height 48px (desktop CTAs), 52px (technician actions). Never smaller than 44×44.
- Radius 12px. Text 14–15px, weight 500, sentence case.

### Technician app components
- **Header:** 44px initials avatar, "Good afternoon," (13px muted) above the team name (20px), and a notification button.
- **Summary card:** navy, radius 22px. Date and branch, hero "3 of 5 jobs done", a segmented progress row (one 10px pill per job: done = `--success`, next = `--accent`, later = `--navy-800`), and a legend.
- **Next job card:** white, radius 16px. Status badge, "SJ-1047 · 4:30 – 6:00 PM", customer name (18px 500), then icon rows for address, job type and units, and the customer note (muted, in quotes). Actions row: Call (52px square, outline), Navigate (outline), Start job (primary, wider).
- **Job row:** white, radius 16px. Time block (16px 500 time and 12px AM/PM) with a divider, job type and place, and a chevron. The whole row is a link.
- **Bottom tab bar:** navy, radius 22px, padding 8px, pinned at the bottom with 16px inset. Active tab: white pill with icon and label. Inactive: icon only, `--on-navy-soft`, with `aria-label`. Tabs: Jobs, Schedule, Photos and reports, Profile.

---

## 5. Layouts

### Admin: operations overview (`screens/admin-operations-overview.png`)

```
┌──────┬───────────────────────────────────────────────────────────────┐
│      │ Title + subtitle          Branch ▾ | Search | 🔔 | Avatar     │
│ Side │ ┌──────────────────────────────────────┐ ┌──────────────────┐ │
│ bar  │ │ Hero chart panel (navy)              │ │ Team workload    │ │
│ navy │ │                                      │ │ + Assign new job │ │
│      │ └──────────────────────────────────────┘ ├──────────────────┤ │
│      │ ┌────────────┐ ┌──────────┐ ┌──────────┐ │ Recent activity  │ │
│      │ │ Jobs by    │ │ KPI      │ │ KPI      │ ├──────────────────┤ │
│      │ │ status     │ ├──────────┤ ├──────────┤ │ Highlight card   │ │
│      │ │ (2 rows)   │ │ KPI      │ │ KPI      │ │ (accent-strong)  │ │
│      │ └────────────┘ └──────────┘ └──────────┘ └──────────────────┘ │
└──────┴───────────────────────────────────────────────────────────────┘
```

- Main grid: `minmax(0, 2.3fr) minmax(0, 1fr)`, 16px gap. The lower-left area is a 3-column grid; the status card spans 2 rows.
- Page padding 16px. Sidebar and main sit in a wrapping flex row: main is `flex: 999 1 560px; min-width: 0`.
- **≤1100px:** right column drops below (single column).
- **≤760px:** lower grid becomes single column; sidebar becomes a horizontal bar (see `screens/admin-operations-overview-mobile.png`).

### Technician: today's jobs (`screens/technician-today.png`)
- 390px reference width, 16px side padding, 14px vertical gaps.
- Order: header → navy summary card → next job card → "Later today" list → bottom tab bar.

### Screens still to design (same system)
- **Admin:** job order list (table: filters, status badges, sortable), create order form, assignment (pick team by branch, date and slot with a workload preview), job detail (timeline Order → Assigned → Completed → Reviewed), review queue (approve or reject with reason).
- **Technician:** job detail, service completion form (checklist, before/after photos, parts used, customer signature, payment collected), schedule.
- Reuse the components above. Tables: white card, radius 16px, 52px rows, `--border` row dividers, badges for status, and horizontal scroll inside the card on small screens.

---

## 6. Accessibility (checked contrast)

| Pair | Ratio |
|---|---|
| `--ink` on `--page` | 14.6:1 |
| `--ink-muted` on `--surface` / `--page` / `--border` | 5.9 / 5.5 / 4.8:1 |
| `--on-navy` on `--navy-900` | 14.3:1 |
| `--on-navy-muted` on `--navy-900` | 6.8:1 |
| `--on-navy-soft` on `--navy-800` | 6.7:1 |
| white on `--accent-strong` | 5.3:1 |
| `--accent-text` on white / `--accent-tint` | 6.7 / 5.7:1 |
| Badge text on tints (success / danger / warning) | 4.7 / 4.9 / 5.4:1 |
| ⚠ white on `--accent` #6C7CF0 | 3.6:1. Only for 24px+ text or decorative use |

- Use real `<button>`, `<a href>`, `<input>` and `<label>` elements. Icon-only controls get an `aria-label`. Charts get `role="img"` and a summary label.
- Touch targets are at least 44×44 (technician actions 52px).
- Never rely on colour alone: status always has a text label.

---

## 7. Do and don't

| Do | Don't |
|---|---|
| Navy `#1E2A44` for dark surfaces | Black or charcoal |
| Radius 10–22px, pills for badges | Square or 2–4px corners on containers |
| White cards on `#F3F6FB` with no border | Heavy shadows, grey page bg, card borders |
| One highlight card per screen | Several accent-filled cards competing |
| Status colours from the table | New ad-hoc colours for statuses |
| Lexend 400/500 | Bold 600/700, mixed font families |
| Sentence case labels | Title Case or ALL CAPS |
| Outline icons, 1.8px stroke | Filled icons, emoji |
