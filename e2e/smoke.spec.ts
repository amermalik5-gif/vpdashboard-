import { readFileSync } from 'node:fs'
import { expect, test, type APIRequestContext, type Page } from '@playwright/test'

/* the board is read-only for visitors: every change needs a signed-in account */
const ADMIN = { username: 'admin', password: 'e2e-secret' }
type Who = { username: string; password: string }

/** Sign in through the header, as the built-in admin unless told otherwise. */
async function signIn(page: Page, who: Who = ADMIN) {
  await page.getByRole('button', { name: 'تسجيل الدخول' }).click()
  await page.getByLabel('اسم المستخدم').fill(who.username)
  await page.getByLabel('كلمة المرور').fill(who.password)
  await page.getByRole('button', { name: 'دخول', exact: true }).click()
  await expect(page.getByRole('button', { name: 'تسجيل الدخول' })).toHaveCount(0)
  await expect(page.getByRole('dialog')).toHaveCount(0)
}
/** Sign an API context in (it keeps the session cookie for the following calls). */
async function apiSignIn(request: APIRequestContext, who: Who = ADMIN) {
  expect((await request.post('/api/login', { data: who })).status()).toBe(200)
}
const iso = (days: number) => new Date(Date.now() + days * 864e5).toISOString().slice(0, 10)
const tasksOf = async (request: APIRequestContext) => (await (await request.get('/api/state')).json()).tasks as Record<string, unknown>[]

test('renders right-to-left with the seeded board and no errors', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto('/')
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl')
  await expect(page.getByRole('heading', { name: 'لوحة أولويات نائب الرئيس' })).toBeVisible()
  await expect(page.locator('table').getByText('اليوم الرقمي', { exact: true })).toBeVisible()
  // the separate events panel and the capacity meter are gone: one list of items
  await expect(page.getByText('الطاقة الاستيعابية')).toHaveCount(0)
  expect(errors).toEqual([])
})

test('the matrix comes first, then the timeline, and the table last', async ({ page }) => {
  await page.goto('/')
  const order = await page.evaluate(() => Array.from(document.querySelectorAll('main section[id]'), (s) => s.id))
  expect(order).toEqual(['top', 'matrix', 'timeline', 'register'])
  await expect(page.getByRole('navigation', { name: 'أقسام اللوحة' }).getByRole('link')).toHaveText(['المصفوفة', 'الخط الزمني', 'المهام والفعاليات'])
})

test('visitors can only view: no editing controls, and every write is refused', async ({ page, request }) => {
  await page.goto('/')
  await expect(page.getByText('للعرض فقط').first()).toBeVisible()
  await expect(page.getByRole('button', { name: 'إضافة مهمة أو فعالية' })).toHaveCount(0)
  await expect(page.locator('table select, table input:not([type=checkbox])')).toHaveCount(0)
  await expect(page.locator('table input[type=checkbox]').first()).toBeDisabled()
  await expect(page.getByRole('button', { name: /^تغيير ترتيب/ })).toHaveCount(0)
  // an item opens as read-only details
  await page.locator('table').getByRole('button', { name: 'اليوم الرقمي' }).click()
  await expect(page.getByRole('heading', { name: 'تفاصيل البند' })).toBeVisible()
  await expect(page.getByLabel('المهمة / الفعالية', { exact: true })).toBeDisabled()
  await expect(page.getByRole('button', { name: 'حفظ', exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'حذف', exact: true })).toHaveCount(0)
  await page.getByRole('button', { name: 'إغلاق', exact: true }).last().click()

  const id = (await tasksOf(request))[0].id
  expect((await request.post('/api/tasks', { data: { title: 'زائر' } })).status()).toBe(401)
  expect((await request.patch(`/api/tasks/${id}`, { data: { notes: 'x' } })).status()).toBe(401)
  expect((await request.post(`/api/tasks/${id}/move`, { data: { to: 2 } })).status()).toBe(401)
  expect((await request.delete(`/api/tasks/${id}`)).status()).toBe(401)
  // a name typed into the old header is no credential
  expect((await request.patch(`/api/tasks/${id}`, { headers: { 'x-editor': encodeURIComponent('المشرف') }, data: { notes: 'x' } })).status()).toBe(401)
})

test('the admin creates the VP’s account; the VP signs in, edits, and the log names him', async ({ page, browser }) => {
  await page.goto('/')
  await signIn(page)
  await page.getByLabel('الاسم (يظهر في السجل)').fill('نائب الرئيس')
  await page.locator('#u-username').fill('vp')
  await page.locator('#u-password').fill('vp-pass-123')
  await expect(page.locator('#u-role')).toHaveValue('team')
  await page.locator('#u-role').selectOption('vp')
  await page.getByRole('button', { name: 'إضافة حساب' }).click()
  await expect(page.locator('#admin').getByRole('cell', { name: 'نائب الرئيس', exact: true })).toBeVisible()

  const vp = await browser.newPage()
  await vp.goto('/')
  // a wrong password is refused
  await vp.getByRole('button', { name: 'تسجيل الدخول' }).click()
  await vp.getByLabel('اسم المستخدم').fill('vp')
  await vp.getByLabel('كلمة المرور').fill('wrong-password')
  await vp.getByRole('button', { name: 'دخول', exact: true }).click()
  await expect(vp.getByText('اسم المستخدم أو كلمة المرور غير صحيحة.')).toBeVisible()
  await vp.getByLabel('كلمة المرور').fill('vp-pass-123')
  await vp.getByRole('button', { name: 'دخول', exact: true }).click()
  await expect(vp.getByRole('button', { name: 'تسجيل الدخول' })).toHaveCount(0)
  await expect(vp.getByRole('dialog')).toHaveCount(0)
  // the VP is no admin: no settings
  await expect(vp.getByRole('heading', { name: 'إعدادات اللوحة' })).toHaveCount(0)
  await vp.getByLabel('ملاحظات — حفل نهاية السنة', { exact: true }).fill('يحدد المكان لاحقًا')
  await vp.getByLabel('ملاحظات — حفل نهاية السنة', { exact: true }).press('Enter')

  await page.reload()
  await expect(page.locator('#activity')).toContainText('نائب الرئيس غيّر الملاحظات في البند «حفل نهاية السنة»')
  await expect(page.locator('#activity')).toContainText('المشرف أنشأ حساب «نائب الرئيس»')
})

test('a new password or a stopped account ends that account’s sessions', async ({ page, playwright }) => {
  await page.goto('/')
  await signIn(page)
  const admin = page.request
  const made = await (await admin.post('/api/users', { data: { username: 'temp.user', name: 'مؤقت', role: 'team', password: 'first-pass-1' } })).json()
  const temp = await playwright.request.newContext({ baseURL: 'http://localhost:3099' })
  await apiSignIn(temp, { username: 'temp.user', password: 'first-pass-1' })
  const id = (await tasksOf(temp))[0].id
  expect((await temp.patch(`/api/tasks/${id}`, { data: { owner: 'مؤقت' } })).status()).toBe(200)
  // the admin resets the password: the old session no longer works
  expect((await admin.patch(`/api/users/${made.id}`, { data: { password: 'second-pass-2' } })).status()).toBe(200)
  expect((await temp.patch(`/api/tasks/${id}`, { data: { owner: 'مؤقت ٢' } })).status()).toBe(401)
  // a stopped account can't sign in
  expect((await admin.patch(`/api/users/${made.id}`, { data: { active: false } })).status()).toBe(200)
  expect((await temp.post('/api/login', { data: { username: 'temp.user', password: 'second-pass-2' } })).status()).toBe(401)
  // only the admin manages accounts; nobody can take the built-in name
  expect((await temp.get('/api/users')).status()).toBe(401)
  expect((await admin.post('/api/users', { data: { username: 'admin', name: 'x', role: 'admin', password: 'xxxxxxxx' } })).status()).toBe(400)
  await temp.dispose()
})

test('a VP-level account adds and edits an item; the change log names them', async ({ page }) => {
  await page.goto('/')
  await signIn(page)
  await page.request.post('/api/users', { data: { username: 'sara', name: 'سارة', role: 'vp', password: 'sara-pass-1' } })
  await page.getByRole('button', { name: /المشرف/ }).first().click() // sign out
  await signIn(page, { username: 'sara', password: 'sara-pass-1' })

  await page.locator('#register').getByRole('button', { name: 'إضافة مهمة' }).click()
  await page.getByLabel('المهمة / الفعالية', { exact: true }).fill('مهمة اختبار')
  // one classification only (31 Oct 2026): no separate category any more
  const kind = page.getByLabel('النوع', { exact: true })
  await expect(kind.locator('option', { hasText: 'إعلان داخلي' })).toHaveCount(1)
  await kind.selectOption('news')
  await expect(page.getByLabel('الفئة', { exact: true })).toHaveCount(0)
  await page.getByRole('button', { name: 'إضافة', exact: true }).click()
  await expect(page.locator('table').getByText('مهمة اختبار')).toBeVisible()

  await page.locator('table').getByText('مهمة اختبار').click()
  await page.getByLabel('المسؤول', { exact: true }).fill('فريق الاتصال')
  await page.getByRole('button', { name: 'حفظ', exact: true }).click()

  // the change log is the admin's only, on the page and in the API
  await expect(page.locator('#activity')).toHaveCount(0)
  await expect(page.getByRole('link', { name: 'سجل التعديلات' })).toHaveCount(0)
  expect((await page.request.get('/api/audit')).status()).toBe(401)

  await page.getByRole('button', { name: /سارة/ }).first().click() // sign out
  await signIn(page)
  await expect(page.locator('#activity')).toContainText('سارة غيّر المسؤول في البند «مهمة اختبار»')
})

test('a team account updates only the team\u2019s fields', async ({ page, request }) => {
  await apiSignIn(request)
  expect((await request.post('/api/users', { data: { username: 'noor', name: 'نور (الفريق)', role: 'team', password: 'noor-pass-1' } })).status()).toBe(201)
  await page.goto('/')
  await signIn(page, { username: 'noor', password: 'noor-pass-1' })
  // (renamed later by the live-update test)
  const name = 'فيديو جيرا'
  // the team's columns are editable, the VP's are plain text
  await expect(page.getByLabel(`الجهد — ${name}`, { exact: true })).toHaveJSProperty('tagName', 'SELECT')
  await expect(page.getByLabel(`الحالة — ${name}`, { exact: true })).toHaveJSProperty('tagName', 'SELECT')
  await expect(page.getByLabel(`درجة الأهمية — ${name}`, { exact: true })).toHaveJSProperty('tagName', 'SPAN')
  await expect(page.getByLabel(`ملاحظات — ${name}`, { exact: true })).toHaveJSProperty('tagName', 'SPAN')
  await expect(page.getByLabel(`جاهز للإطلاق — ${name}`, { exact: true })).toBeEnabled()
  // no adding, deleting or dragging
  await expect(page.getByRole('button', { name: 'إضافة مهمة أو فعالية' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: /^تغيير ترتيب/ })).toHaveCount(0)
  await page.getByLabel(`نسبة الإنجاز — ${name}`, { exact: true }).selectOption('40')
  await expect.poll(async () => (await tasksOf(request)).find((t) => t.title === name)!.progress).toBe(40)
  // the form: the VP's part is locked, the team's part saves
  await page.locator('table').getByRole('button', { name }).click()
  await expect(page.getByRole('heading', { name: 'تحديث حقول الفريق' })).toBeVisible()
  await expect(page.getByLabel('المهمة / الفعالية', { exact: true })).toBeDisabled()
  await expect(page.getByLabel('النوع', { exact: true })).toBeDisabled()
  await expect(page.getByRole('button', { name: 'حذف', exact: true })).toHaveCount(0)
  await page.getByLabel('المسؤول', { exact: true }).fill('نور')
  await page.getByRole('button', { name: 'حفظ', exact: true }).click()
  await expect.poll(async () => (await tasksOf(request)).find((t) => t.title === name)!.owner).toBe('نور')
  // and the server holds the line
  const id = (await tasksOf(request)).find((t) => t.title === name)!.id
  const team = page.request
  expect((await team.patch(`/api/tasks/${id}`, { data: { priority: 9 } })).status()).toBe(403)
  expect((await team.patch(`/api/tasks/${id}`, { data: { notes: 'x' } })).status()).toBe(403)
  expect((await team.post('/api/tasks', { data: { title: 'من الفريق' } })).status()).toBe(403)
  expect((await team.post(`/api/tasks/${id}/move`, { data: { to: 1 } })).status()).toBe(403)
  expect((await team.delete(`/api/tasks/${id}`)).status()).toBe(403)
  expect((await team.patch(`/api/tasks/${id}`, { data: { status: 'on-track', effort: 3 } })).status()).toBe(200)
})

test('a VP-level account deletes an item; settings need the admin', async ({ page, request }) => {
  await apiSignIn(request)
  const added = await (await request.post('/api/tasks', { data: { title: 'بند للحذف' } })).json()
  await request.post('/api/users', { data: { username: 'deleter', name: 'محرر', role: 'vp', password: 'del-pass-1' } })

  await page.goto('/')
  await signIn(page, { username: 'deleter', password: 'del-pass-1' })
  await page.locator('table').getByRole('button', { name: 'بند للحذف' }).click()
  await page.getByRole('button', { name: 'حذف', exact: true }).click()
  await page.getByRole('button', { name: 'نعم، احذف' }).click()
  await expect(page.locator('table').getByText('بند للحذف')).toHaveCount(0)
  expect((await tasksOf(request)).some((t) => t.id === added.id)).toBe(false)
  // an editor is not the admin
  expect((await page.request.put('/api/settings', { data: { weeklyCapacity: 30 } })).status()).toBe(401)
  expect((await page.request.get('/api/backup')).status()).toBe(401)
  expect((await request.put('/api/settings', { data: { weeklyCapacity: 30 } })).status()).toBe(200)
})

test('a save in one tab shows up live in another', async ({ browser }) => {
  const a = await browser.newPage()
  const b = await browser.newPage()
  await a.goto('/')
  await b.goto('/')
  await expect(b.getByText('مباشر', { exact: true })).toBeVisible()
  await apiSignIn(a.request)
  const t = (await tasksOf(a.request)).find((x) => x.title === 'فيديو جيرا')!
  await a.request.patch(`/api/tasks/${t.id}`, { data: { title: 'فيديو جيرا محدّث' } })
  await expect(b.locator('table').getByText('فيديو جيرا محدّث')).toBeVisible({ timeout: 10_000 })
})

test('admin can download a full backup and a tasks spreadsheet', async ({ page, request }) => {
  expect((await request.get('/api/backup')).status()).toBe(401)
  expect((await request.get('/api/backup/tasks.csv')).status()).toBe(401)

  await page.goto('/')
  await signIn(page)

  const [json] = await Promise.all([page.waitForEvent('download'), page.getByRole('link', { name: /نسخة احتياطية كاملة/ }).click()])
  expect(json.suggestedFilename()).toMatch(/^vp-dashboard-backup-\d{4}-\d{2}-\d{2}\.json$/)
  const backup = JSON.parse(readFileSync(await json.path(), 'utf8'))
  expect(backup.tasks.length).toBeGreaterThan(0)
  expect(backup.settings.labels.length).toBe(5)
  expect(Array.isArray(backup.audit)).toBe(true)
  // accounts and password hashes are never in a backup file
  expect(JSON.stringify(backup)).not.toContain('scrypt$')

  const [csv] = await Promise.all([page.waitForEvent('download'), page.getByRole('link', { name: /Excel/ }).click()])
  const text = readFileSync(await csv.path(), 'utf8')
  expect(text.charCodeAt(0)).toBe(0xfeff)
  expect(text).toContain('النوع')
  expect(text).toContain('اليوم الرقمي')
})

test('an overdue task stays visible with a badge and a count', async ({ page, request }) => {
  await apiSignIn(request)
  await request.post('/api/tasks', { data: { title: 'مهمة متأخرة للاختبار', priority: 9, urgency: 9, effort: 6, progress: 30, start: iso(-60), end: iso(-10) } })
  await page.goto('/')
  await expect(page.locator('table').getByText('مهمة متأخرة للاختبار')).toBeVisible()
  await expect(page.locator('table tr', { hasText: 'مهمة متأخرة للاختبار' }).getByText(/متأخرة \d|متأخرة [٠-٩]/)).toBeVisible()
  const tile = page.locator('#top dl > div').filter({ has: page.locator('dt', { hasText: /^متأخرة$/ }) })
  await expect(tile.locator('dd')).not.toHaveText('٠')
  await expect(page.locator('#timeline').getByText('مهمة متأخرة للاختبار')).toBeVisible()
})

test('team saves keep the VP draft flag; the VP confirms it', async ({ request, playwright }) => {
  await apiSignIn(request, { username: 'noor', password: 'noor-pass-1' })
  const [first, second] = (await tasksOf(request)).filter((t) => t.draft)
  // a team save: the draft flag stays, and the team can't clear it
  expect((await request.patch(`/api/tasks/${first.id}`, { data: { progress: 15 } })).status()).toBe(200)
  expect((await request.patch(`/api/tasks/${first.id}`, { data: { draft: false } })).status()).toBe(403)
  const after = (await tasksOf(request)).find((t) => t.id === first.id)!
  expect(after.draft).toBe(true)
  expect(after.updatedBy).toBe('نور (الفريق)')
  // the VP's own values confirm it; so does the VP's «تأكيد القيم» on its own
  const vp = await playwright.request.newContext({ baseURL: 'http://localhost:3099' })
  await apiSignIn(vp, { username: 'sara', password: 'sara-pass-1' })
  await vp.patch(`/api/tasks/${first.id}`, { data: { priority: 3, draft: false } })
  await vp.patch(`/api/tasks/${second.id}`, { data: { draft: false } })
  const now = await tasksOf(request)
  expect(now.find((t) => t.id === first.id)!.draft).toBe(false)
  expect(now.find((t) => t.id === second.id)!.draft).toBe(false)
  await vp.dispose()
})

test('admin settings being typed survive someone else saving a task', async ({ page, request }) => {
  await page.goto('/')
  await signIn(page)
  await page.getByLabel('اسم أخرى', { exact: true }).fill('مستوى قيد الكتابة')
  await apiSignIn(request, { username: 'sara', password: 'sara-pass-1' })
  await request.patch(`/api/tasks/${(await tasksOf(request))[0].id}`, { data: { owner: `x-${Date.now()}` } })
  await page.waitForTimeout(1500)
  await expect(page.getByLabel('اسم مستوى قيد الكتابة', { exact: true })).toHaveValue('مستوى قيد الكتابة')
})

test('a downloaded backup can be restored', async ({ page }) => {
  await page.goto('/')
  await signIn(page)
  const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('link', { name: /نسخة احتياطية كاملة/ }).click()])
  const file = await dl.path()
  const before = JSON.parse(readFileSync(file, 'utf8')).tasks.map((t: { title: string }) => t.title).sort()
  // change the board, then restore
  const added = await page.request.post('/api/tasks', { data: { title: 'ستختفي بعد الاسترجاع' } })
  expect(added.status()).toBe(201)
  await page.locator('#restore-file').setInputFiles(file)
  await page.getByRole('button', { name: 'نعم، استرجع' }).click()
  await expect(page.getByText('تم الاسترجاع من النسخة الاحتياطية')).toBeVisible()
  const now = (await tasksOf(page.request)).map((t) => t.title as string).sort()
  expect(now).toEqual(before)
  // accounts are untouched by a restore
  expect((await (await page.request.get('/api/users')).json()).some((u: { username: string }) => u.username === 'vp')).toBe(true)
})

test('two quick saves in a row both reach another open screen', async ({ browser }) => {
  const a = await browser.newPage()
  const b = await browser.newPage()
  await b.goto('/')
  await expect(b.getByText('مباشر', { exact: true })).toBeVisible()
  // the watching screen is signed in too, so the notes are editable boxes
  await apiSignIn(b.request)
  await b.reload()
  await apiSignIn(a.request)
  const t = (await tasksOf(a.request))[0]
  await a.request.patch(`/api/tasks/${t.id}`, { data: { notes: 'أولى' } })
  await a.request.patch(`/api/tasks/${t.id}`, { data: { notes: 'الثانية' } })
  await expect(b.getByLabel(`ملاحظات — ${t.title}`)).toHaveValue('الثانية', { timeout: 10_000 })
})

test('the VP edits importance, urgency, date and notes straight from the table', async ({ page, request }) => {
  await page.goto('/')
  await signIn(page, { username: 'vp', password: 'vp-pass-123' })
  const name = 'فيديو الدرونز'
  await page.getByLabel(`درجة الأهمية — ${name}`).selectOption('3')
  await page.getByLabel(`مستوى الاستعجال — ${name}`).selectOption('9')
  await page.getByLabel(`النوع — ${name}`).selectOption('launch')
  await page.getByLabel(`التاريخ — ${name}`).fill('2026-12-01')
  await page.getByLabel(`ملاحظات — ${name}`).fill('بعد اعتماد السيناريو')
  await page.getByLabel(`ملاحظات — ${name}`).press('Enter')
  await expect
    .poll(async () => {
      const t = (await tasksOf(request)).find((x) => x.title === name)!
      return [t.priority, t.urgency, t.kind, t.end, t.notes, t.updatedBy].join('|')
    })
    .toBe('3|9|launch|2026-12-01|بعد اعتماد السيناريو|نائب الرئيس')
  // undated items are listed under the timeline instead of being guessed
  await expect(page.locator('#timeline')).toContainText('بلا تاريخ')
})

test('matrix bubbles are numbered like the table, with a numbered key beside them', async ({ page }) => {
  await page.goto('/')
  const key = page.getByRole('list', { name: 'أرقام البنود في المصفوفة' })
  // the VP's own list keeps its numbering: item 9 is the CEO's visit
  await expect(key.getByRole('button', { name: /^٩ زيارة الرئيس لجامعة الأميرة نورة/ })).toBeVisible()
  await expect(page.locator('table tr', { hasText: 'زيارة الرئيس لجامعة الأميرة نورة' }).locator('td').first()).toHaveText('٩')
  await expect(page.locator('#matrix svg g[role="button"]', { hasText: '٩' }).first()).toBeVisible()
})

test('every item is in the matrix and on the timeline; awards sit at the president level', async ({ page, request }) => {
  const tasks = await tasksOf(request)
  expect(tasks.find((t) => t.title === 'جائزة أزري')?.label).toBe('ceo')
  expect(tasks.find((t) => t.title === 'جوائز Gartner')!.label).toBe('ceo')
  await page.goto('/')
  // every item has a numbered bubble: the unscored ones wait in the tray under the plot
  await expect(page.locator('#matrix svg g[role="button"]')).toHaveCount(tasks.length)
  await expect(page.getByRole('group', { name: 'مصفوفة المهام حسب درجة الأهمية ومستوى الاستعجال' })).toContainText('لم تُقيَّم بعد')
  await expect(page.getByRole('list', { name: 'أرقام البنود في المصفوفة' }).getByRole('listitem')).toHaveCount(tasks.length)
  // the legend has the colours only
  await expect(page.locator('#matrix')).not.toContainText('الجهد غير محدد')
  await expect(page.locator('#matrix')).not.toContainText('بانتظار الموافقة')
  // undated items get their own row on the timeline
  await expect(page.getByLabel('بنود بلا تاريخ').getByRole('button', { name: 'جائزة أزري' })).toBeVisible()
})

test('the team sets the status, and the colour follows it', async ({ page, request }) => {
  await page.goto('/')
  await signIn(page, { username: 'noor', password: 'noor-pass-1' })
  const name = 'فيديو الذكاء الاصطناعي'
  const status = page.getByLabel(`الحالة — ${name}`, { exact: true })
  await expect(status).toHaveValue('not-started')
  await status.selectOption('at-risk')
  await expect.poll(async () => (await tasksOf(request)).find((t) => t.title === name)!.status).toBe('at-risk')
  // complete is always green, and fills the progress
  await status.selectOption('done')
  await expect
    .poll(async () => {
      const t = (await tasksOf(request)).find((x) => x.title === name)!
      return `${t.status}|${t.progress}`
    })
    .toBe('done|100')
  expect((await page.request.patch(`/api/tasks/${(await tasksOf(request))[0].id}`, { data: { status: 'nope' } })).status()).toBe(400)
})

test('a VP-level account drags the list beside the matrix to change the order and the numbers', async ({ page, request }) => {
  await page.goto('/')
  await signIn(page, { username: 'sara', password: 'sara-pass-1' })
  const key = page.getByRole('list', { name: 'أرقام البنود في المصفوفة' })
  const order = async () => (await tasksOf(request)).sort((a, b) => (a.position as number) - (b.position as number)).map((t) => t.title as string)
  const before = await order()
  // keyboard: the up arrow on item 3's grip makes it item 2
  await key.getByRole('button', { name: `تغيير ترتيب «${before[2]}»` }).press('ArrowUp')
  await expect.poll(order).toEqual([before[0], before[2], before[1], ...before.slice(3)])
  // the table (in list order) and the bubbles follow
  const row2 = page.locator('table tbody tr').nth(1)
  await expect(row2.locator('td').first()).toHaveText('٢')
  await expect(row2).toContainText(before[2])
  await expect(key.getByRole('button', { name: new RegExp(`^٢ ${before[2]}`) })).toBeVisible()

  // mouse: drag item 1 below item 4
  const now = await order()
  const grip = (await key.getByRole('button', { name: `تغيير ترتيب «${now[0]}»` }).boundingBox())!
  const target = (await key.getByRole('listitem').nth(3).boundingBox())!
  const x = grip.x + grip.width / 2
  const y0 = grip.y + grip.height / 2
  const y1 = target.y + target.height * 0.8
  await page.mouse.move(x, y0)
  await page.mouse.down()
  // a hand-paced drag: the list reorders frame by frame
  for (let i = 1; i <= 20; i++) {
    await page.mouse.move(x, y0 + ((y1 - y0) * i) / 20)
    await page.waitForTimeout(16)
  }
  await page.mouse.up()
  await expect.poll(async () => (await order()).indexOf(now[0])).toBe(3)
  // numbers stay 1…n with no gaps
  const positions = (await tasksOf(request)).map((t) => t.position as number).sort((a, b) => a - b)
  expect(positions).toEqual(positions.map((_, i) => i + 1))
})

test('the timeline can switch to a month calendar', async ({ page, request }) => {
  await apiSignIn(request)
  await request.post('/api/tasks', { data: { title: 'فعالية في التقويم', kind: 'event', end: iso(0) } })
  await page.goto('/')
  const tl = page.locator('#timeline')
  await tl.getByRole('tab', { name: 'تقويم' }).click()
  const cal = tl.getByRole('region', { name: /^تقويم/ })
  // the calendar: the CEO's items red, events green, the rest by level (the timeline: by status)
  await expect(tl.getByLabel('دليل الألوان')).toContainText('الرئيس التنفيذي')
  await expect(tl.getByLabel('دليل الألوان')).toContainText('فعالية')
  const chip = cal.getByRole('button', { name: 'فعالية في التقويم' })
  await expect(chip).toHaveCSS('border-inline-start-color', 'rgb(21, 162, 96)')
  await expect(cal.getByRole('button', { name: 'فعالية في التقويم' })).toBeVisible()
  await tl.getByRole('button', { name: 'الشهر التالي' }).click()
  await expect(cal.getByRole('button', { name: 'فعالية في التقويم' })).toHaveCount(0)
  await tl.getByRole('button', { name: 'اليوم', exact: true }).click()
  await cal.getByRole('button', { name: 'فعالية في التقويم' }).click()
  await expect(page.getByLabel('المهمة / الفعالية', { exact: true })).toHaveValue('فعالية في التقويم')
  // the choice is remembered on this browser
  await page.reload()
  await expect(page.locator('#timeline').getByRole('tab', { name: 'تقويم' })).toHaveAttribute('aria-selected', 'true')
})

test('the calendar shows a whole year, and exports as a PDF', async ({ page }) => {
  await page.goto('/')
  const tl = page.locator('#timeline')
  await tl.getByRole('tab', { name: 'تقويم' }).click()
  await tl.getByRole('tab', { name: 'سنة' }).click()
  const year = new Date().getFullYear()
  const cal = tl.getByRole('region', { name: /^تقويم/ })
  // January to December, each with its items listed under the month
  await expect(cal.locator('section')).toHaveCount(12)
  await expect(cal.locator('section').first()).toHaveAccessibleName(/^يناير/)
  const thisMonth = cal.locator('section').nth(new Date().getMonth())
  await expect(thisMonth.getByRole('button', { name: /فعالية في التقويم/ })).toBeVisible()
  // the PDF: a real file, for visitors too
  const [pdf] = await Promise.all([page.waitForEvent('download'), tl.getByRole('button', { name: 'تصدير PDF' }).click()])
  expect(pdf.suggestedFilename()).toBe(`vp-calendar-${year}.pdf`)
  expect(readFileSync(await pdf.path()).subarray(0, 5).toString()).toBe('%PDF-')
  // clicking a month's name opens it
  await cal.locator('section').nth(0).getByRole('button', { name: 'يناير' }).click()
  await expect(tl.getByRole('tab', { name: 'شهر' })).toHaveAttribute('aria-selected', 'true')
  await expect(tl.getByRole('heading', { name: new RegExp('يناير') })).toBeVisible()
})

test('the team marks an item ready for launch: a star by it, and a tile that lists the ready ones', async ({ page, request }) => {
  const name = 'فيديو الدرونز'
  const ready = async () => (await tasksOf(request)).find((t) => t.title === name)!.ready
  await page.goto('/')
  await signIn(page, { username: 'noor', password: 'noor-pass-1' })
  const tile = page.locator('#top dl > div').filter({ has: page.locator('dt', { hasText: 'جاهزة للإطلاق' }) })
  await expect(tile.locator('dd')).toHaveText('٠')
  // tick it straight in the table, as a team account
  await page.getByLabel(`جاهز للإطلاق — ${name}`, { exact: true }).check()
  await expect.poll(ready).toBe(true)
  await expect(tile.locator('dd')).toHaveText('١')
  // a star next to it in the table and in the list beside the matrix
  await expect(page.locator('table tr', { hasText: name }).locator('[title="جاهز للإطلاق"]')).toHaveCount(1)
  await expect(page.getByRole('list', { name: 'أرقام البنود في المصفوفة' }).getByRole('button', { name: new RegExp(`${name}.*جاهز للإطلاق`) })).toHaveCount(1)
  // the tile shows just the ready items, until «عرض الكل»
  await tile.getByRole('link').click()
  await expect(page.locator('table tbody tr')).toHaveCount(1)
  await page.getByRole('button', { name: 'عرض الكل' }).click()
  await expect.poll(async () => page.locator('table tbody tr').count()).toBeGreaterThan(1)
  // the form shows it ticked; unticking takes the star away
  await page.locator('table').getByRole('button', { name }).click()
  const box = page.getByRole('checkbox', { name: 'جاهز للإطلاق', exact: true })
  await expect(box).toBeChecked()
  await box.uncheck()
  await page.getByRole('button', { name: 'حفظ', exact: true }).click()
  await expect.poll(ready).toBe(false)
  await expect(tile.locator('dd')).toHaveText('٠')
})

test('in the calendar, dragging an item to another day changes its date', async ({ page, request }) => {
  const title = 'فعالية للسحب'
  const day = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  const now = new Date()
  // a day in the same week, so it is always in the grid on screen
  const next = new Date(now)
  next.setDate(now.getDate() + (now.getDay() === 6 ? -1 : 1))
  await apiSignIn(request)
  await request.post('/api/tasks', { data: { title, kind: 'event', end: day(now) } })
  const end = async () => (await tasksOf(request)).find((t) => t.title === title)!.end

  // tall enough that the month and the undated row are both on screen while dragging
  await page.setViewportSize({ width: 1280, height: 1400 })
  await page.goto('/')
  await signIn(page, { username: 'sara', password: 'sara-pass-1' })
  const tl = page.locator('#timeline')
  await tl.getByRole('tab', { name: 'تقويم' }).click()
  await tl.getByRole('tab', { name: 'شهر' }).click()
  await tl.scrollIntoViewIfNeeded()
  const cal = tl.getByRole('region', { name: /^تقويم/ })
  await cal.getByRole('button', { name: title }).dragTo(cal.locator(`[data-day="${day(next)}"]`))
  await expect.poll(end).toBe(day(next))
  await expect(cal.locator(`[data-day="${day(next)}"]`).getByRole('button', { name: title })).toBeVisible()

  // onto «بلا تاريخ بعد»: the date goes; from there onto a day: it comes back
  await cal.getByRole('button', { name: title }).dragTo(tl.getByLabel('بنود بلا تاريخ'))
  await expect.poll(end).toBe('')
  await tl.getByLabel('بنود بلا تاريخ').getByRole('button', { name: title }).dragTo(cal.locator(`[data-day="${day(now)}"]`))
  await expect.poll(end).toBe(day(now))
})
