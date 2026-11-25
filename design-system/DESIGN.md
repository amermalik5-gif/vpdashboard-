# NWC design rules

Every NWC website built on this package follows these rules. The code enforces most of them (`ds:check` and the style-guide test). This page covers the ones code can't check, and says how to use what the package provides. When something isn't covered here, match the dashboard (`amermalik5-gif/vpdashboard-`), the first site built on this package.

## 1. Language and direction
- **Arabic first.** Every page is `<html lang="ar" dir="rtl">`. Write the Arabic text first, and put an English term or acronym in brackets after it: «خدمات القطاع التجاري (CSR)».
- **Logical sides only.** Use `start/end`, `ms-/me-` and `ps-/pe-`, never `left/right` or `ml-/mr-`. A page must be correct right-to-left without special cases.
- **Latin inside Arabic.** Wrap Latin text or codes in `<bdi dir="ltr">`, so the order doesn't flip.

## 2. Numbers and dates
- **Arabic-Indic digits** (٠١٢٣) everywhere people read numbers. Use `toArabicDigits()`, and `٪` for percent.
- **Dates** come from `src/lib/format.ts`:
  - `fmtDay`: «١٩ نوفمبر»
  - `fmtDate`: «١٩ نوفمبر ٢٠٢٦»
  - `fmtWhen`: the year only when it isn't this year
  - `fmtTime`
- **Gregorian calendar only.** Never write a date by hand.
- **Date fields** use `DateInput`. It shows the Arabic date whatever the browser's language, and keeps the native picker.
- **Columns of numbers** take the `tabular` class.
- **Empty values** show «—», never «-» or «–».

## 3. Type
- **Neo Sans W23** (`font-sans`, the default) for all text, at 300 / 400 / 500 / 700. **Inter** (`font-ui`) only for Latin numbers in data.
- **Sizes** only from the scale:
  - display: `text-display-2xl` … `text-display-xs`
  - text: `text-xl` / `lg` / `md` / `sm` / `xs` / `2xs`
- **Headings** are 500 weight. A page has one `h1`, and every section gets a heading (`SectionHeading`).

## 4. Colour
- **Only the tokens.** Use Tailwind colour classes from the preset, or `var(--token)` in SVG and inline styles. The preset has no other colours. `ds:check` fails on raw colour codes.
- **What each colour means:**
  - **Brand blue (`brand`, `blue-500`):** actions and links.
  - **Navy (`blue-900`):** the header and the summary band.
  - **Teal:** small accents, such as the scroll line or a live dot.
  - **Success, warning and danger:** status only, never decoration.
- **Text colours:**
  - `fg-primary`: body text
  - `fg-secondary`: supporting text
  - `fg-tertiary`: captions
  - `fg-muted`: placeholders and «—»
- **Contrast:** at least 4.5:1 for small text, 3:1 for large text and icons. On coloured circles, numbers use navy on light colours and white on dark ones. Check any new pairing before using it.
- **Colours a site needs that the package doesn't have** (e.g. the dashboard's status colours) go in the site's `src/styles/site-tokens.css`. Write them as named custom properties (`--status-late: var(--danger-500);`), built from the tokens whenever possible.

## 5. Layout
- **Page width:** content sits in `container-page` (1280px, with the design-system margins).
- **Header:** `SiteHeader` on every site, navy and 72px. The page starts below it (`pt-[var(--header-h)]` on the first band).
- **Sections:** `Section` and `SectionHeading`, with `py-8` between working sections and `py-16 md:py-24` for story pages.
- **Cards:** `Card`, white, 1px `line-subtle` border, radius `xl`, shadow `xsm`. No other shadows or radii than the scale.
- **Every screen size:** a phone at 390px wide and a 13" laptop at 1280px must both work. Wide tables scroll sideways with the first columns pinned. On phones, use cards instead of tables.

## 6. Components: which one for what

| Need | Use |
|---|---|
| The main action | `Button` (primary), **one per area** |
| A second action | `Button variant="outline"` |
| A quiet action, cancel, or delete | `Button variant="ghost"`. For delete, add `text-danger-700 hover:bg-danger-50`, and ask for confirmation in place. |
| An action on navy | `Button variant="onbrand"` / `"onbrandGhost"` |
| A status, label or count | `Badge`. Tone by meaning: danger for late, warning for waiting, success for done. |
| Switching between views of the same thing | `Tabs` |
| Filtering a list | `FilterChips` |
| Editing one item in full | `Sheet` (the drawer) |
| A short question, or sign-in | `Dialog` |
| Text, list and long-text fields | `.field`, with a `.field-label` above and an optional `.field-hint` below |
| A date | `DateInput` |

- **Icons:** `lucide-react`, 16–18px, always `aria-hidden` next to text. An icon on its own needs an `aria-label`.
- **Logo and pattern:** only from `src/assets/brand/`. The white logo goes on navy, the colour logo on white. The pattern watermark sits at 6–15% opacity, once, on the end side.

## 7. Writing
- **Tone:** short, direct and polite Arabic. Buttons are verbs: «حفظ»، «إضافة»، «إلغاء»، «تنزيل».
- **Punctuation:** Arabic marks «،» «؛» «؟» and the quotes «». Never put «·» next to digits, because it reads like a zero.
- **Messages** say what happened and what to do next: «اكتب المسؤول عن البند: من يتابعه نائب الرئيس معه.»
- **Form messages** are in Arabic: use `arabicCheck()` from `src/lib/forms.ts`, never the browser's own wording.

## 8. Motion
- **Source:** motion comes only from `src/lib/motion.ts` (`EASE`, `DUR`, `fadeUp`…). It is calm: fades and moves of 8px or less, at 150 / 200 / 350 ms, with no springs.
- **Reduced motion:** wrap the app in `<MotionConfig reducedMotion="user">`.

## 9. Accessibility
- **Focus:** the focus ring comes from `base.css`. Never remove it.
- **Labels:** every control has a visible label or an `aria-label`. A dialog or drawer traps focus and closes with Esc; the package components do this.
- **Touch:** targets are 44px on touch screens (the `coarse:` variant).

## 10. Privacy of the package
The Neo Sans W23 fonts are licensed to NWC. This package, and every site repository that carries it, stays **private**.

## Changing the design
Change it here, in `nwc-design-system`, never inside a site:
1. **Make the change.** Run `npm run reference` to remake the reference images, and look at them.
2. **Release it:** bump `VERSION` and `package.json`, add a `CHANGELOG.md` entry, and push the branch `release/vX.Y.Z` (a tag `vX.Y.Z` works too). Never change a released version: make a new one.
3. **Update each site** with `npm run ds:update -- vX.Y.Z`, run its tests, and look at its style guide (`/styleguide`).
