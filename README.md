# لوحة أولويات نائب الرئيس

لوحة مشتركة للمهام والفعاليات في جدول واحد: يحدد نائب الرئيس **النوع (فعالية، إطلاق، خبر، إعلان داخلي، إعلان على الموقع، أخرى) والمستوى ودرجة الأهمية ومستوى الاستعجال والتاريخ والملاحظات**، ويحدّث الفريق **الجهد ونسبة الإنجاز والحالة و«جاهز للإطلاق»** (تظهر نجمة ★ بجانب البند الجاهز في كل مكان، وخانة في الشريط العلوي تعرضها وحدها في الجدول)، وكل ذلك يُعدَّل مباشرة في الجدول، فتظهر الصورة في:

- **مصفوفة الأهمية والاستعجال**: كل بند فقاعة مرقّمة، حجمها يمثل الجهد ولونها يمثل الحالة: رمادي لم تبدأ، أخضر فاتح على المسار، برتقالي متأخرة قليلًا، أحمر متأخرة (ويصبح كذلك تلقائيًا ما فات تاريخه)، أخضر مكتملة. البنود التي لم تُقيَّم بعد تنتظر أسفل المصفوفة، وتُسحب إليها لتحديد أهميتها واستعجالها. وبجانبها قائمة البنود بأرقامها، ويمكن لمن سجّل الدخول سحب أي بند فيها (من مقبض ⋮⋮) لتغيير ترتيبه ورقمه، فيتغيّر الرقم في الفقاعات والجدول أيضًا.
- **المهام المتأخرة**: كل بند غير مكتمل تجاوز تاريخه تظهر بشارة «متأخرة» في الجدول والمصفوفة والخط الزمني، وبعدّاد في الشريط العلوي.
- **الخط الزمني والتقويم**: كل بند في يومه وفي مسار نوعه، بلون حالته، ويمكن التبديل إلى التقويم (شهر، أو سنة كاملة من يناير إلى ديسمبر بتقويم صغير لكل شهر وقائمة بنوده)، مع زر «تصدير PDF» يُنزّل التقويم المعروض في صفحة A4 أفقية. وألوانه: بنود الرئيس التنفيذي بالأحمر، والفعاليات بالأخضر، وغيرها بلون مستواه (نائب الرئيس التنفيذي، نائب الرئيس، داخلي…)، ويمكن سحب أي بند فيه إلى يوم آخر لتغيير تاريخه (أو من صف «بلا تاريخ بعد» إلى يوم، أو إليه لإزالة التاريخ، ويتغيّر الشهر عند إبقاء البند فوق السهم)، والأيام تظهر كقائمة على الجوال. البنود التي بلا تاريخ في صف خاص بها.
- **المهام والفعاليات** (آخر قسم): جدول واحد يُعدَّل مباشرة، لكل بند نوع واحد ومستوى وحالة.
- **سجل التعديلات** (للمشرف فقط): يُسجَّل فيه من غيّر ماذا ومتى، باسم صاحب الحساب.

الصلاحيات:

| | الزائر (من لديه الرابط) | حساب «تعديل البنود» | حساب «مشرف» |
|---|---|---|---|
| عرض اللوحة والتقويم وتصدير PDF | ✓ | ✓ | ✓ |
| إضافة البنود وتعديلها وحذفها والسحب (الفقاعات، الترتيب، التقويم) | | ✓ | ✓ |
| إدارة الحسابات وقائمة المستويات | | | ✓ |
| عرض سجل التعديلات واسترجاع قيمة سابقة أو عنصر محذوف | | | ✓ |
| اعتماد قيم نائب الرئيس المقترحة كما هي («تأكيد القيم») | | | ✓ |
| تنزيل نسخة احتياطية والاسترجاع منها | | | ✓ |

الرابط للعرض فقط لكل من لا يسجّل الدخول. يُنشئ المشرف حسابًا شخصيًا لكل من يعدّل (نائب الرئيس، أعضاء الفريق) من «إعدادات اللوحة ← المستخدمون»: اسم يظهر في السجل، واسم مستخدم، وكلمة مرور (٨ أحرف على الأقل، تُحفظ مشفّرة)، وصلاحية. تغيير كلمة المرور أو إيقاف الحساب ينهي جلساته فورًا. الحساب المدمج `admin` بكلمة المرور المحفوظة في `ADMIN_PASSWORD` يبقى دائمًا حتى لا تُغلق اللوحة على أحد. عشر محاولات دخول خاطئة من العنوان نفسه توقف الدخول ربع ساعة.

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

All routes are under `/api`. Writes need a signed-in account (an httpOnly signed `vp_session` cookie, 30 days); the change log records that account's name.

| Method | Path | Who |
|---|---|---|
| GET | `/state`, `/stream` | everyone (`state.user` is the signed-in account, or null) |
| POST, PATCH, DELETE | `/tasks`, `/tasks/:id`, `/tasks/:id/move`, `/events`, `/events/:id` | any account (rate limited) |
| GET | `/audit?limit=50`, `/backup`, `/backup/tasks.csv`, `/users` | admin |
| POST, PATCH, DELETE | `/users`, `/users/:id` | admin |
| PUT | `/settings` | admin |
| DELETE | `/events/:id` | admin |
| POST | `/audit/:id/restore`, `/backup/restore` | admin |
| POST | `/login` `{username, password}`, `/logout` | everyone (10 failed attempts lock an address out for 15 minutes) |
