# لوحة أولويات نائب الرئيس

لوحة مشتركة للمهام والفعاليات في جدول واحد: يحدد نائب الرئيس **النوع (فعالية، إطلاق، خبر، إعلان داخلي، إعلان على الموقع، أخرى) والمستوى ودرجة الأهمية ومستوى الاستعجال والتاريخ والملاحظات**، ويحدّث الفريق **الجهد ونسبة الإنجاز والحالة**، وكل ذلك يُعدَّل مباشرة في الجدول، فتظهر الصورة في:

- **مصفوفة الأهمية والاستعجال**: كل بند فقاعة مرقّمة، حجمها يمثل الجهد ولونها يمثل الحالة: رمادي لم تبدأ، أخضر فاتح على المسار، برتقالي متأخرة قليلًا، أحمر متأخرة (ويصبح كذلك تلقائيًا ما فات تاريخه)، أخضر مكتملة. البنود التي لم تُقيَّم بعد تنتظر أسفل المصفوفة، وتُسحب إليها لتحديد أهميتها واستعجالها.
- **المهام المتأخرة**: كل بند غير مكتمل تجاوز تاريخه تظهر بشارة «متأخرة» في الجدول والمصفوفة والخط الزمني، وبعدّاد في الشريط العلوي.
- **المهام والفعاليات**: جدول واحد، لكل بند نوع (فعالية / إطلاق / أخرى) وفئة.
- **الخط الزمني**: كل بند في يومه وفي مسار نوعه، بلون حالته، والبنود التي بلا تاريخ في صف خاص بها.
- **سجل التعديلات** (للمشرف فقط): يُسجَّل فيه من غيّر ماذا ومتى.

الصلاحيات:

| | الجميع (من لديه الرابط) | المشرف |
|---|---|---|
| إضافة المهام والفعاليات وتعديلها وسحب الفقاعات | ✓ | ✓ |
| حذف المهام والفعاليات | | ✓ |
| تغيير قائمة المستويات | | ✓ |
| عرض سجل التعديلات واسترجاع قيمة سابقة أو عنصر محذوف | | ✓ |
| اعتماد قيم نائب الرئيس المقترحة كما هي («تأكيد القيم») | | ✓ |
| تنزيل نسخة احتياطية والاسترجاع منها | | ✓ |

يُطلب من كل شخص اسمه مرة واحدة عند أول حفظ، ليظهر في سجل التعديلات الذي يراه المشرف. يدخل المشرف بكلمة المرور المحفوظة في `ADMIN_PASSWORD`.

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

### Backups

- **Automatic:** a copy of the database is written once a day to `/data/backups/daily-*.db` on the same volume (newest 14 kept).
- **Manual:** the admin downloads a JSON backup from the board settings and can restore it there; the server first saves `/data/backups/before-restore-*.db`.
- **Off-site:** download a JSON backup regularly, since the daily copies live on the same volume as the database.

## API

All routes are under `/api`. Writes need an `x-editor` header (URL-encoded display name).

| Method | Path | Who |
|---|---|---|
| GET | `/state`, `/stream` | everyone |
| GET | `/audit?limit=50`, `/backup`, `/backup/tasks.csv` | admin |
| POST, PATCH | `/tasks`, `/tasks/:id`, `/events`, `/events/:id` | everyone (rate limited) |
| DELETE | `/tasks/:id`, `/events/:id` | admin |
| PUT | `/settings` | admin |
| POST | `/audit/:id/restore`, `/backup/restore` | admin |
| POST | `/login`, `/logout` | admin session (httpOnly signed cookie, 12 h) |
