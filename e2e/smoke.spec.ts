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
  await page.getByRole('button', { name: 'إضافة المهمة' }).click()
  // first save asks for a name
  await page.getByLabel('الاسم').fill('سارة')
  await page.getByRole('button', { name: 'متابعة الحفظ' }).click()
  await expect(page.locator('table').getByText('مهمة اختبار')).toBeVisible()

  await page.locator('table').getByText('مهمة اختبار').click()
  await page.getByLabel('المسؤول', { exact: true }).fill('فريق الاتصال')
  await page.getByRole('button', { name: 'حفظ التعديلات' }).click()
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
