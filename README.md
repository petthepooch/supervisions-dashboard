# Supervisions Dashboard

A clickable prototype of the myAko supervisions dashboard for registered
managers: compliance at a glance, what needs chasing or signing off, the
team's supervision cycle, calendar, league table and trend.

No build step, no dependencies. Serve the folder and open it:

```bash
npx -y serve .
```

## Files

| File | Purpose |
| --- | --- |
| `index.html` | App shell: nav, top bar, page area, side panel |
| `dashboard.css` | Design tokens (light and dark), layout and every component |
| `data.js` | The team, their supervision history, flags, messages. **Edit this to change the story.** |
| `avatars.js` | Placeholder avatars as data URIs. Replace any entry with a staff photo (URL or data URI); missing entries fall back to initials |
| `app.js` | Routing, two-level nav, section tabs with scroll-spy, side panel, and `derive()` which turns the data into every figure on screen |

## How it works

- **Navigation.** Parents in the left nav (Supervisions, Development,
  Safeguarding, Reports) expand to show their children. One is open at a
  time and the open group follows the route, so deep links work.
- **Section tabs.** Sticky under the page title. Clicking scrolls to the
  section; a scroll-spy keeps the active tab correct when scrolling by hand.
- **Side panel.** Messages, a person's profile (click any name) and
  prototype notes (the info button). Pushes the content on wide screens,
  overlays it below 1360px. Escape closes it.
- **One source of truth.** Nothing on screen is hand-typed. `derive()` in
  `app.js` computes each person's status from their history and the policy
  in `data.js`: a supervision every quarter and no more than 12 weeks
  apart, probation reviews within 3 months, staff on leave paused and
  excluded from the compliance denominator.
- **Actions update the model.** Sign off, chase, book, book a return
  supervision and triage decisions change the data and everything
  recalculates.
- Press `D` to toggle dark mode. `⌘K` focuses search.

The date is fixed at Wednesday 2 September 2026 (`TODAY` in `data.js`)
so the sample story stays coherent.

Avatars are illustrated placeholders generated with [DiceBear](https://www.dicebear.com/)
"personas" (Draftbit, CC BY 4.0). Production should use staff photos with consent.
