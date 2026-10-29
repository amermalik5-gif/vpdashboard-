# لوحة أولويات نائب الرئيس

لوحة مشتركة للمهام والفعاليات: يحدد نائب الرئيس **درجة الأهمية (مهمة) ودرجة الطوارئ (طارئة) والمدة المتوقعة**، ويحدّث الفريق **الجهد ونسبة الإنجاز**، فتظهر الصورة في:

- **مصفوفة الأهمية والطوارئ**: كل مهمة فقاعة. حجمها يمثل الجهد، ولونها يمثل نسبة الإنجاز: أحمر أقل من ٢٠٪، أصفر من ٢٠ إلى ٣٩٪، أخضر ٤٠٪ فأكثر. يمكن سحب الفقاعة لتغيير ترتيبها.
- **مؤشر الطاقة الاستيعابية**: حِمل هذا الأسبوع مقارنةً بطاقة الفريق الأسبوعية التي يحددها المشرف.
- **الفعاليات والمحطات** و**سجل المهام** و**الخط الزمني** بمسار لكل مستوى.
- **سجل التعديلات**: يُسجَّل فيه من غيّر ماذا ومتى.

الصلاحيات:

| | الجميع (من لديه الرابط) | المشرف |
|---|---|---|
| إضافة المهام والفعاليات وتعديلها وسحب الفقاعات | ✓ | ✓ |
| حذف المهام والفعاليات | | ✓ |
| تغيير الطاقة الأسبوعية وقوائم المستويات والفئات وأنواع الفعاليات | | ✓ |
| استرجاع قيمة سابقة أو عنصر محذوف من سجل التعديلات | | ✓ |

يُطلب من كل شخص اسمه مرة واحدة عند أول حفظ، ليظهر في سجل التعديلات. يدخل المشرف بكلمة المرور المحفوظة في `ADMIN_PASSWORD`.

The design language (tokens, Neo Sans W23, logos, pattern, Button / Card / FilterChips / Tabs / Sheet) is ported from the NWC IT Strategy booklet site (`amermalik5-gif/it-strategy`).

## Stack

- **App:** React 18, Vite, TypeScript and Tailwind (`src/`). The app is Arabic and right-to-left.
- **Server:** Express with SQLite through better-sqlite3 (`server/`). It serves the built app and a JSON API under `/api`.
- **Live updates:** every open screen refreshes over Server-Sent Events (`/api/stream`) when anyone saves.

## Run locally

```bash
npm install
```

```bash
cp .env.example .env
```

Set `ADMIN_PASSWORD` in your shell or in `.env`, then start both servers:

```bash
ADMIN_PASSWORD=change-me npm run dev
```

The app runs at http://localhost:5173 and the API at http://localhost:3001. The database file is `./data/vp.db`. On first run it is seeded with the items from the kickoff meeting, all marked «بانتظار التأكيد» (awaiting confirmation).

## Tests

```bash
npm run build
```

```bash
npx playwright install chromium
```

```bash
npm run test:e2e
```

## Deploy on Railway

1. Create a project and add a service from this GitHub repo. It builds with the included `Dockerfile` (`railway.json`).
2. Add a **volume** mounted at `/data`. The database lives at `/data/vp.db`, so it survives redeploys.
3. Set these variables:
   - `ADMIN_PASSWORD`: a long password for the admin.
   - `SESSION_SECRET`: a random string, for example from `openssl rand -hex 32`.
4. Generate a domain and share the link.

Health check: `GET /healthz`.

## API

All routes are under `/api`. Writes need an `x-editor` header (URL-encoded display name).

| Method | Path | Who |
|---|---|---|
| GET | `/state`, `/audit?limit=50`, `/stream` | everyone |
| POST, PATCH | `/tasks`, `/tasks/:id`, `/events`, `/events/:id` | everyone (rate limited) |
| DELETE | `/tasks/:id`, `/events/:id` | admin |
| PUT | `/settings` | admin |
| POST | `/audit/:id/restore` | admin |
| POST | `/login`, `/logout` | admin session (httpOnly signed cookie, 12 h) |
