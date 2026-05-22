# PacePay

> Spend freely. Stay on pace.

A simple daily spending pace tracker for discretionary money.
Answers one question: **how much can I safely spend today?**

---

## File structure

```
pacepay/
│
├── index.html              ← Home screen (main entry point)
│
├── css/
│   ├── variables.css       ← Design tokens: colours, fonts, spacing, motion
│   ├── base.css            ← Reset, body, layout utilities
│   ├── components.css      ← Reusable: cards, buttons, inputs, sheets
│   └── home.css            ← Home screen specific styles
│   └── settings.css        ← Settings page specific styles
│
├── js/
│   ├── state.js            ← All data, localStorage, calculations (no DOM)
│   ├── ui.js               ← DOM rendering, colour logic, sheet helpers
│   └── app.js              ← Init, event binding, home screen handlers
│
├── pages/
│   ├── settings.html       ← Settings screen
│   └── settings.js         ← Settings screen logic
│
└── assets/
    └── icons/              ← SVG icons (currently inline; move here if needed)
```

---

## Architecture

**State** (`js/state.js`) is completely decoupled from the DOM.
It exposes `window.PacePay` with pure functions for calculations and actions.

**UI** (`js/ui.js`) reads from state and writes to the DOM.
It exposes `window.PacePayUI` for rendering helpers.

**App** (`js/app.js`) wires events to state actions + UI renders.
Each page has its own page-level JS file in `/pages/`.

---

## State shape

```js
{
  budget:           number | null,   // total budget for the period
  startDate:        string | null,   // 'YYYY-MM-DD'
  endDate:          string | null,   // 'YYYY-MM-DD' (payday)
  warnThreshold:    number,          // £/day: amber threshold (default 15)
  dangerThreshold:  number,          // £/day: red threshold (default 10)
  spends: [
    { id: string, date: string, amount: number }
  ]
}
```

Persisted to `localStorage` under key `pacepay_v1`.

---

## Pace colours

| State  | Condition                    | Background          |
|--------|------------------------------|---------------------|
| Green  | daily ≥ warnThreshold        | Soft sage green     |
| Amber  | dangerThreshold ≤ daily < warn | Warm amber          |
| Red    | daily < dangerThreshold      | Soft muted red      |

Background colour is set via CSS custom properties on `:root`
(`--pace-bg`, `--pace-accent`, `--pace-text`) so the entire app
transitions smoothly between states.

---

## TODO / next steps

- [ ] Onboarding flow (first-run budget setup)
- [ ] Payday reset screen (with roll-over option)
- [ ] Backdated spend entry
- [ ] Remaining balance manual override in settings
- [ ] Subtle number animation when daily amount updates
- [ ] PWA manifest + service worker (offline support)
- [ ] iOS home screen icon
