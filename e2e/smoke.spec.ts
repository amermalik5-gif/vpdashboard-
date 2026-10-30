import { readFileSync } from 'node:fs'
import { expect, test } from '@playwright/test'

test('renders right-to-left with the seeded board and no errors', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto('/')
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl')
  await expect(page.getByRole('heading', { name: 'لوحة أولويات نائب الرئيس' })).toBeVisible()
  await expect(page.locator('table').getByText('اليوم الرقمي ١٠')).toBeVisible()
  expect(errors).toEqual([])
})

test('anyone can add and edit a task; the change log names them', async ({ page }) => {
  await page.goto('/')
  await page.locator('#register').getByRole('button', { name: 'إضافة مهمة' }).click()
  await page.getByLabel('عنوان المهمة').fill('مهمة اختبار')
  // the category is a drop-down of the team's services
  const category = page.getByLabel('الفئة')
  await expect(category).toHaveJSProperty('tagName', 'SELECT')
  await expect(category.locator('option', { hasText: 'تصميم العروض' })).toHaveCount(1)
  await category.selectOption('تصميم العروض')
  await page.getByRole('button', { name: 'إضافة المهمة' }).click()
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
  await expect(page.locator('#activity')).toContainText('سارة غيّر المسؤول في المهمة «مهمة اختبار»')
})

test('delete and settings need the admin', async ({ page, request }) => {
  const state = await (await request.get('/api/state')).json()
  const id = state.tasks[0].id
  const headers = { 'x-editor': 'test' }
  expect((await request.delete(`/api/tasks/${id}`, { headers })).status()).toBe(401)
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
  await expect(b.getByText('مباشر')).toBeVisible()
  const state = await (await a.request.get('/api/state')).json()
  const t = state.tasks.find((x: { title: string }) => x.title === 'فيلم توعوي')
  await a.request.patch(`/api/tasks/${t.id}`, { headers: { 'x-editor': 'live' }, data: { title: 'فيلم توعوي محدّث' } })
  await expect(b.locator('table').getByText('فيلم توعوي محدّث')).toBeVisible({ timeout: 10_000 })
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
  expect(text).toContain('تاريخ الإطلاق')
  expect(text).toContain('اليوم الرقمي ١٠')
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
  const tile = page.locator('#top dl > div', { hasText: 'متأخرة' })
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
  await page.getByLabel('الطاقة الأسبوعية (نقاط جهد)').fill('35')
  const state = await (await request.get('/api/state')).json()
  await request.patch(`/api/tasks/${state.tasks[0].id}`, { headers: { 'x-editor': 'other' }, data: { owner: `x-${Date.now()}` } })
  await page.waitForTimeout(1500)
  await expect(page.getByLabel('الطاقة الأسبوعية (نقاط جهد)')).toHaveValue('35')
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
  await expect(b.getByText('مباشر')).toBeVisible()
  const state = await (await a.request.get('/api/state')).json()
  const t = state.tasks[0]
  await a.request.patch(`/api/tasks/${t.id}`, { headers: { 'x-editor': 'q' }, data: { owner: 'أولى' } })
  await a.request.patch(`/api/tasks/${t.id}`, { headers: { 'x-editor': 'q' }, data: { owner: 'الثانية' } })
  await expect(b.locator('table tr', { hasText: t.title }).getByText('الثانية')).toBeVisible({ timeout: 10_000 })
})
