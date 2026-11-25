# Changelog

## 1.0.0 (25 Nov 2026)

The first version as a shared package. It is taken from the VP Priorities Dashboard (`vpdashboard-`), which built on the **NWC Design System V3** (`it-strategy`, branch `design-system`).

**Changed from V3:**
- **New token `--tertiary-650`** (`#5f7487`), 4.8:1 on white.
- **`--fg-tertiary` (captions) uses it now**, instead of `--tertiary-500` (3.1:1).
- **`--fg-muted` is now `--neutral-500`** (4.7:1) instead of `--neutral-400` (3.2:1).
- **Why:** small text has to pass WCAG AA, 4.5:1.

**Added:**
- **`base.css` form fields:** `.field`, `.field-label`, `.field-hint`.
- **New components:**
  - `SiteHeader`, the navy 72px header with the scroll line and the site's own controls
  - `DateInput`, an Arabic date display over the native picker
- **New helpers:** `lib/format` (Arabic digits and dates), `lib/dates`, `lib/forms` (Arabic form messages).
- **The rules (`DESIGN.md`).**
- **The style guide, its reference images and `styleguide-test.ts`.**
- **`tools/ds.mjs`** (`check`, `update`, `new-site`), and the `starter/` site.
