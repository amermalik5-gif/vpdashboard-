# Working on the VP Priorities Dashboard

Arabic, right-to-left dashboard for NWC's VP (React + Vite + Tailwind; Express + SQLite on Railway). Changes go on a branch with screenshots; it goes live only when the owner says "make it live".

## Design: the NWC design system
This site is built on the **NWC design system** (`design-system/`, a locked copy of `amermalik5-gif/nwc-design-system`). Every NWC site must look and behave the same.

**Before any change to what people see, read `design-system/DESIGN.md` and follow it.**

- **Never edit anything in `design-system/`.** It is locked: `design-system.lock.json` holds a fingerprint of every file, and `npm run ds:check` fails the build on any change. A design change is made in the `nwc-design-system` repository and pulled here with `npm run ds:update -- vX.Y.Z`.
- **Build with the package:**
  - **Components:** `@ds/components/*` (`SiteHeader`, `Section`, `SectionHeading`, `Card`, `Button`, `Badge`, `Tabs`, `FilterChips`, `Sheet`, `Dialog`, `DateInput`).
  - **Helpers:** `@ds/lib/*` (Arabic digits and dates, motion, Arabic form messages).
  - **Classes:** the preset's Tailwind classes, `.field`, `.field-label`, `.field-hint`, `container-page`.
- **No raw colours** (`#…`, `rgb(…)`), font families or Tailwind arbitrary colours in `src/`. The board's own semantic colours (status, calendar levels, ★, two shadows) live in `src/styles/site-tokens.css` as custom properties.
- **Arabic first and right-to-left:** logical sides (`ms-`, `pe-`, `start`, `end`), Arabic-Indic digits, «—» for empty values, Arabic messages.
- **Before you finish:** `npm run build` (it runs `ds:check`) and `npm run test:e2e`. The `design-system` project compares `/styleguide` with `design-system/reference/` pixel for pixel. Never update those images from this site.

## The board
- **Roles:** visitors view only. Each role edits:
  - «الفريق»: the team fields, `TEAM_FIELDS` in `src/lib/types.ts`
  - «نائب الرئيس»: everything
  - «مشرف»: also accounts, settings, backups and the change log
- **The server enforces the same rules** (`server/routes.ts`).
- **Tests:** `npm run test:e2e`. The board's tests share one database and run in order.
