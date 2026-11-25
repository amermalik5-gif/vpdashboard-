# NWC design system (`nwc-design-system`)

This is the one source of the NWC website look: colour and type tokens, the Neo Sans W23 fonts, logos and pattern, a Tailwind preset, the shared React components, Arabic helpers, the written rules (**[DESIGN.md](DESIGN.md)**), and the checks that keep every site identical.

**Private:** the fonts are licensed to NWC.

## What's inside

| Path | What |
|---|---|
| `src/styles/` | `tokens.css` (all values), `fonts.css`, `base.css` (base, layout and form styles), `index.css` (all three) |
| `src/assets/` | Neo Sans W23 (WOFF2), the logos (colour and white), the pattern |
| `src/tailwind-preset.ts` | The Tailwind preset. Brand colours only, the type scale, radii, shadows, screens. |
| `src/components/` | `SiteHeader`, `Section`, `SectionHeading`, `Card`, `Button`, `Badge`, `Tabs`, `FilterChips`, `Sheet`, `Dialog`, `DateInput` |
| `src/lib/` | `format` (Arabic digits and dates), `dates`, `motion`, `forms` (Arabic form messages), `focusTrap`, `scroll`, `cn` |
| `src/styleguide/` | The style-guide page every site shows at `/styleguide` |
| `reference/` | The reference images of the style guide (desktop and phone) |
| `tools/ds.mjs` | `check`, `update` and `new-site` (see below) |
| `tools/styleguide-test.ts` | The visual test every site runs |
| `starter/` | A new site, ready to build on |
| `dev/` | The package's own preview, used to make the reference images |

## How a site uses it: a locked copy

A site doesn't install the package from npm. It carries a **copy of one version** in its `design-system/` folder, and `design-system.lock.json` holds that version and a fingerprint of every file. This way:
- **Simple builds:** Railway builds the site with no GitHub token.
- **The copy can't drift:** `npm run ds:check` fails if anything in `design-system/` is edited. It runs before every build, so a site that drifts doesn't deploy.
- **Raw styling is caught:** the same check fails on raw colours (`#fff`, `rgb(…)`), fonts, or arbitrary Tailwind colours anywhere in the site's code. The one exception is the site's own semantic colours in `src/styles/site-tokens.css`, written as custom properties.
- **Looks are compared:** the site's end-to-end tests compare its `/styleguide` with `design-system/reference/`, pixel for pixel, so a site whose own CSS changes the look fails.

### Start a new site
```bash
npm install
npm run new-site -- ../my-new-site
```
This copies `starter/`, adds a locked copy of this version, and sets up `CLAUDE.md`, the checks, a Dockerfile and the Railway settings. Then, in the new folder, run `npm install`, `npm run dev`, and build the pages.

### Update a site to a new version
```bash
npm run ds:update -- v1.1.0
```
Run it in the site. It clones that version from GitHub (the tag `v1.1.0`, or else the branch `release/v1.1.0`), replaces `design-system/`, and rewrites the lock. Then run the site's tests and look at `/styleguide`. You can give a path to a local checkout instead of a tag.

### What a site sets up (the starter has all of it)
- **`tailwind.config.ts`:** `presets: [preset]` from `./design-system/src/tailwind-preset`, and `./design-system/src/**/*.{ts,tsx}` in `content`.
- **The entry CSS:** `@import` of `design-system/src/styles/index.css`, then `@tailwind base; @tailwind components; @tailwind utilities;`.
- **`main.tsx`:** imports `@fontsource/inter` 400/500/600, and wraps the app in `<MotionConfig reducedMotion="user">`.
- **Aliases:** the `@ds/*` import alias points to `design-system/src/*`, in both Vite and tsconfig.
- **`package.json`:** `"build": "node design-system/tools/ds.mjs check && …"`, plus `ds:check` and `ds:update`.
- **A `/styleguide` route** rendering `<Styleguide />`, and `e2e/design-system.spec.ts` running `styleguideTests()` in its own Playwright project with `snapshotPathTemplate: '{testDir}/../design-system/reference/{arg}{ext}'`.
- **A `CLAUDE.md`** that points every session to `design-system/DESIGN.md`.

## Working on the package
```bash
npm install
npm run dev
npm run build
npm run reference
npm test
```
- `npm run dev` previews the style guide.
- `npm run build` typechecks and builds the preview.
- `npm run reference` remakes `reference/*.png` after a design change.
- `npm test` checks the preview against `reference/`.

To release a change, see **Changing the design** in [DESIGN.md](DESIGN.md).

The reference images are made in a Linux container with Playwright's Chromium. Remake them in the same kind of environment, because fonts render slightly differently on other systems.
