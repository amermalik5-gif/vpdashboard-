import { readFileSync } from 'node:fs'
import { expect, test } from '@playwright/test'

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

test('anyone can add and edit an item; the change log names them', async ({ page }) => {
  await page.goto('/')
  await page.locator('#register').getByRole('button', { name: 'إضافة مهمة' }).click()
  await page.getByLabel('المهمة / الفعالية', { exact: true }).fill('مهمة اختبار')
  // one classification only (31 Oct 2026): no separate category any more
  const kind = page.getByLabel('النوع', { exact: true })
  await expect(kind.locator('option', { hasText: 'إعلان داخلي' })).toHaveCount(1)
  await kind.selectOption('news')
  await expect(page.getByLabel('الفئة', { exact: true })).toHaveCount(0)
  await page.getByRole('button', { name: 'إضافة', exact: true }).click()
  // first save asks for a name
  await page.getByLabel('الاسم').fill('سارة')
  await page.getByRole('button', { name: 'متابعة الحفظ' }).click()
  await expect(page.locator('table').getByText('مهمة اختبار')).toBeVisible()

  await page.locator('table').getByText('مهمة اختبار').click()
  await page.getByLabel('المسؤول', { exact: true }).fill('فريق الاتصال')
  await page.getByRole('button', { name: 'حفظ', exact: true }).click()

  // the change log is hidden from visitors, on the page and in the API
  await expect(page.locator('#activity')).toHaveCount(0)
  await expect(page.getByRole('link', { name: 'سجل التعديلات' })).toHaveCount(0)
  expect((await page.request.get('/api/audit')).status()).toBe(401)

  // the admin sees who made the change
  await page.getByRole('button', { name: 'دخول المشرف' }).click()
  await page.getByLabel('كلمة المرور').fill('e2e-secret')
  await page.getByRole('button', { name: 'دخول', exact: true }).click()
  await expect(page.locator('#activity')).toContainText('سارة غيّر المسؤول في البند «مهمة اختبار»')
})

test('anyone can delete an item; settings need the admin', async ({ page, request }) => {
  const headers = { 'x-editor': 'test' }
  // a visitor deletes an item from the form, after confirming
  const added = await (await request.post('/api/tasks', { headers, data: { title: 'بند للحذف' } })).json()
  await page.goto('/')
  await page.locator('table').getByRole('button', { name: 'بند للحذف' }).click()
  await page.getByRole('button', { name: 'حذف', exact: true }).click()
  await page.getByRole('button', { name: 'نعم، احذف' }).click()
  await page.getByLabel('الاسم').fill('زائر')
  await page.getByRole('button', { name: 'متابعة الحفظ' }).click()
  await expect(page.locator('table').getByText('بند للحذف')).toHaveCount(0)
  expect((await (await request.get('/api/state')).json()).tasks.some((t: { id: string }) => t.id === added.id)).toBe(false)
  expect((await request.put('/api/settings', { headers, data: { weeklyCapacity: 30 } })).status()).toBe(401)
  expect((await request.post('/api/login', { data: { password: 'wrong' } })).status()).toBe(401)

  await page.goto('/')
  await page.getByRole('button', { name: 'دخول المشرف' }).click()
  await page.getByLabel('كلمة المرور').fill('e2e-secret')
  await page.getByRole('button', { name: 'دخول', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'إعدادات اللوحة' })).toBeVisible()
  const res = await page.request.put('/api/settings', { headers, data: { weeklyCapacity: 30 } })
  expect(res.status()).toBe(200)
})

test('a save in one tab shows up live in another', async ({ browser }) => {
  const a = await browser.newPage()
  const b = await browser.newPage()
  await a.goto('/')
  await b.goto('/')
  await expect(b.getByText('مباشر', { exact: true })).toBeVisible()
  const state = await (await a.request.get('/api/state')).json()
  const t = state.tasks.find((x: { title: string }) => x.title === 'فيديو جيرا')
  await a.request.patch(`/api/tasks/${t.id}`, { headers: { 'x-editor': 'live' }, data: { title: 'فيديو جيرا محدّث' } })
  await expect(b.locator('table').getByText('فيديو جيرا محدّث')).toBeVisible({ timeout: 10_000 })
})

test('admin can download a full backup and a tasks spreadsheet', async ({ page, request }) => {
  expect((await request.get('/api/backup')).status()).toBe(401)
  expect((await request.get('/api/backup/tasks.csv')).status()).toBe(401)

  await page.goto('/')
  await page.getByRole('button', { name: 'دخول المشرف' }).click()
  await page.getByLabel('كلمة المرور').fill('e2e-secret')
  await page.getByRole('button', { name: 'دخول', exact: true }).click()

  const [json] = await Promise.all([page.waitForEvent('download'), page.getByRole('link', { name: /نسخة احتياطية كاملة/ }).click()])
  expect(json.suggestedFilename()).toMatch(/^vp-dashboard-backup-\d{4}-\d{2}-\d{2}\.json$/)
  const backup = JSON.parse(readFileSync(await json.path(), 'utf8'))
  expect(backup.tasks.length).toBeGreaterThan(0)
  expect(backup.settings.labels.length).toBe(5)
  expect(Array.isArray(backup.audit)).toBe(true)

  const [csv] = await Promise.all([page.waitForEvent('download'), page.getByRole('link', { name: /Excel/ }).click()])
  const text = readFileSync(await csv.path(), 'utf8')
  expect(text.charCodeAt(0)).toBe(0xfeff)
  expect(text).toContain('النوع')
  expect(text).toContain('اليوم الرقمي')
})

const admin = async (page: import('@playwright/test').Page) => {
  await page.getByRole('button', { name: 'دخول المشرف' }).click()
  await page.getByLabel('كلمة المرور').fill('e2e-secret')
  await page.getByRole('button', { name: 'دخول', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'إعدادات اللوحة' })).toBeVisible()
}
const iso = (days: number) => new Date(Date.now() + days * 864e5).toISOString().slice(0, 10)

test('an overdue task stays visible with a badge and a count', async ({ page, request }) => {
  await request.post('/api/tasks', { headers: { 'x-editor': 'qa' }, data: { title: 'مهمة متأخرة للاختبار', priority: 9, urgency: 9, effort: 6, progress: 30, start: iso(-60), end: iso(-10) } })
  await page.goto('/')
  await expect(page.locator('table').getByText('مهمة متأخرة للاختبار')).toBeVisible()
  await expect(page.locator('table tr', { hasText: 'مهمة متأخرة للاختبار' }).getByText(/متأخرة \d|متأخرة [٠-٩]/)).toBeVisible()
  const tile = page.locator('#top dl > div').filter({ has: page.locator('dt', { hasText: /^متأخرة$/ }) })
  await expect(tile.locator('dd')).not.toHaveText('٠')
  await expect(page.locator('#timeline').getByText('مهمة متأخرة للاختبار')).toBeVisible()
})

test('a typed «(مشرف)» is not trusted, and team saves keep the VP draft flag', async ({ page, request }) => {
  const state = await (await request.get('/api/state')).json()
  const draft = state.tasks.find((t: { draft: boolean }) => t.draft)
  // progress-only save from a visitor: the draft flag must stay
  await request.patch(`/api/tasks/${draft.id}`, { headers: { 'x-editor': encodeURIComponent('سامي (مشرف)') }, data: { progress: 15, draft: false } })
  const after = (await (await request.get('/api/state')).json()).tasks.find((t: { id: string }) => t.id === draft.id)
  expect(after.draft).toBe(true)
  expect(after.updatedBy).toBe('سامي')
  // a VP field change confirms it
  await request.patch(`/api/tasks/${draft.id}`, { headers: { 'x-editor': 'vp' }, data: { priority: 3, draft: false } })
  expect((await (await request.get('/api/state')).json()).tasks.find((t: { id: string }) => t.id === draft.id).draft).toBe(false)
  await page.goto('/')
})

test('admin settings being typed survive someone else saving a task', async ({ page, request }) => {
  await page.goto('/')
  await admin(page)
  await page.getByLabel('اسم أخرى', { exact: true }).fill('مستوى قيد الكتابة')
  const state = await (await request.get('/api/state')).json()
  await request.patch(`/api/tasks/${state.tasks[0].id}`, { headers: { 'x-editor': 'other' }, data: { owner: `x-${Date.now()}` } })
  await page.waitForTimeout(1500)
  await expect(page.getByLabel('اسم مستوى قيد الكتابة', { exact: true })).toHaveValue('مستوى قيد الكتابة')
})

test('a downloaded backup can be restored', async ({ page }) => {
  await page.goto('/')
  await admin(page)
  const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('link', { name: /نسخة احتياطية كاملة/ }).click()])
  const file = await dl.path()
  const before = JSON.parse(readFileSync(file, 'utf8')).tasks.map((t: { title: string }) => t.title).sort()
  // change the board, then restore
  const added = await page.request.post('/api/tasks', { headers: { 'x-editor': 'qa' }, data: { title: 'ستختفي بعد الاسترجاع' } })
  expect(added.status()).toBe(201)
  await page.locator('#restore-file').setInputFiles(file)
  await page.getByRole('button', { name: 'نعم، استرجع' }).click()
  // a restore is recorded under the admin's name: the first save asks for it
  await page.getByLabel('الاسم').fill('المشرف')
  await page.getByRole('button', { name: 'متابعة الحفظ' }).click()
  await expect(page.getByText('تم الاسترجاع من النسخة الاحتياطية')).toBeVisible()
  const now = (await (await page.request.get('/api/state')).json()).tasks.map((t: { title: string }) => t.title).sort()
  expect(now).toEqual(before)
})

test('two quick saves in a row both reach another open screen', async ({ browser }) => {
  const a = await browser.newPage()
  const b = await browser.newPage()
  await b.goto('/')
  await expect(b.getByText('مباشر', { exact: true })).toBeVisible()
  const state = await (await a.request.get('/api/state')).json()
  const t = state.tasks[0]
  await a.request.patch(`/api/tasks/${t.id}`, { headers: { 'x-editor': 'q' }, data: { notes: 'أولى' } })
  await a.request.patch(`/api/tasks/${t.id}`, { headers: { 'x-editor': 'q' }, data: { notes: 'الثانية' } })
  await expect(b.getByLabel(`ملاحظات — ${t.title}`)).toHaveValue('الثانية', { timeout: 10_000 })
})

test('the VP edits importance, urgency, date and notes straight from the table', async ({ page, request }) => {
  await page.goto('/')
  const name = 'فيديو الدرونز'
  await page.getByLabel(`درجة الأهمية — ${name}`).selectOption('3')
  await page.getByLabel('الاسم').fill('نائب الرئيس')
  await page.getByRole('button', { name: 'متابعة الحفظ' }).click()
  await page.getByLabel(`مستوى الاستعجال — ${name}`).selectOption('9')
  await page.getByLabel(`النوع — ${name}`).selectOption('launch')
  await page.getByLabel(`التاريخ — ${name}`).fill('2026-12-01')
  await page.getByLabel(`ملاحظات — ${name}`).fill('بعد اعتماد السيناريو')
  await page.getByLabel(`ملاحظات — ${name}`).press('Enter')
  await expect
    .poll(async () => {
      const t = (await (await request.get('/api/state')).json()).tasks.find((x: { title: string }) => x.title === name)
      return [t.priority, t.urgency, t.kind, t.end, t.notes].join('|')
    })
    .toBe('3|9|launch|2026-12-01|بعد اعتماد السيناريو')
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
  const { tasks } = await (await request.get('/api/state')).json()
  const azri = tasks.find((t: { title: string }) => t.title === 'جائزة أزري')
  expect(azri?.label).toBe('ceo')
  expect(tasks.find((t: { title: string }) => t.title === 'جوائز Gartner').label).toBe('ceo')
  await page.goto('/')
  // every item has a numbered bubble: the unscored ones wait in the tray under the plot
  await expect(page.locator('#matrix svg g[role="button"]')).toHaveCount(tasks.length)
  await expect(page.locator('#matrix svg')).toContainText('لم تُقيَّم بعد')
  await expect(page.getByRole('list', { name: 'أرقام البنود في المصفوفة' }).getByRole('listitem')).toHaveCount(tasks.length)
  // the legend has the colours only
  await expect(page.locator('#matrix')).not.toContainText('الجهد غير محدد')
  await expect(page.locator('#matrix')).not.toContainText('بانتظار الموافقة')
  // undated items get their own row on the timeline
  await expect(page.getByLabel('بنود بلا تاريخ').getByRole('button', { name: 'جائزة أزري' })).toBeVisible()
})

test('the team sets the status, and the colour follows it', async ({ page, request }) => {
  await page.goto('/')
  const name = 'فيديو الذكاء الاصطناعي'
  const status = page.getByLabel(`الحالة — ${name}`, { exact: true })
  await expect(status).toHaveValue('not-started')
  await status.selectOption('at-risk')
  await page.getByLabel('الاسم').fill('الفريق')
  await page.getByRole('button', { name: 'متابعة الحفظ' }).click()
  await expect.poll(async () => (await (await request.get('/api/state')).json()).tasks.find((t: { title: string }) => t.title === name).status).toBe('at-risk')
  // complete is always green, and fills the progress
  await status.selectOption('done')
  await expect
    .poll(async () => {
      const t = (await (await request.get('/api/state')).json()).tasks.find((x: { title: string }) => x.title === name)
      return `${t.status}|${t.progress}`
    })
    .toBe('done|100')
  expect((await request.patch(`/api/tasks/${(await (await request.get('/api/state')).json()).tasks[0].id}`, { headers: { 'x-editor': 'x' }, data: { status: 'nope' } })).status()).toBe(400)
})
