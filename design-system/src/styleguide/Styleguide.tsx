import { useState, type ReactNode } from 'react'
import { Check, Download, Plus, Trash2 } from 'lucide-react'
import pattern from '../assets/brand/bg-pattern.webp'
import logoColor from '../assets/brand/logos/logo-colorful-horizontal-ar.svg'
import logoWhite from '../assets/brand/logos/logo-white-horizontal-ar.svg'
import { Badge, type BadgeTone } from '../components/Badge'
import { Button } from '../components/Button'
import { Card } from '../components/Card'
import { DateInput } from '../components/DateInput'
import { FilterChips } from '../components/FilterChips'
import { SectionHeading } from '../components/SectionHeading'
import { SiteHeader } from '../components/SiteHeader'
import { Tabs } from '../components/Tabs'
import { toArabicDigits } from '../lib/format'
import VERSION from '../../VERSION?raw'

/**
 * Every token and component of the NWC design system on one page. Each site shows it at
 * /styleguide, and a screenshot test compares it with the package's reference images
 * (reference/styleguide-*.png): any difference in a site's look fails the test.
 * Everything here is fixed (no today's date, no data), so the page never changes by itself.
 */
const RAMPS: { name: string; prefix: string; steps: (number | string)[] }[] = [
  { name: 'الأزرق (العلامة)', prefix: 'nwc-blue', steps: [50, 100, 200, 300, 400, 500, 600, 700, 800, 900] },
  { name: 'الأخضر المائي (ثانوي)', prefix: 'nwc-green', steps: [50, 100, 200, 300, 400, 500, 600, 700, 800, 900] },
  { name: 'نجاح', prefix: 'success', steps: [50, 100, 300, 500, 700, 900] },
  { name: 'تحذير', prefix: 'warning', steps: [50, 100, 300, 500, 700, 900] },
  { name: 'خطر', prefix: 'danger', steps: [50, 100, 300, 500, 700, 900] },
  { name: 'معلومات', prefix: 'info', steps: [50, 100, 300, 500, 700, 900] },
  { name: 'الرمادي', prefix: 'neutral', steps: [0, 25, 50, 100, 200, 300, 400, 500, 600, 700, 800, 900] },
  { name: 'الرمادي المزرق', prefix: 'tertiary', steps: [500, 600, 650, 700, 900] },
]
const TEXT: { cls: string; name: string }[] = [
  { cls: 'text-fg-primary', name: 'نص أساسي (fg-primary)' },
  { cls: 'text-fg-secondary', name: 'نص ثانوي (fg-secondary)' },
  { cls: 'text-fg-tertiary', name: 'تعليق (fg-tertiary)' },
  { cls: 'text-fg-muted', name: 'نص خافت (fg-muted)' },
  { cls: 'text-brand', name: 'رابط أو إجراء (brand)' },
]
const SIZES = ['text-display-lg', 'text-display-md', 'text-display-sm', 'text-display-xs', 'text-xl', 'text-lg', 'text-md', 'text-sm', 'text-xs', 'text-2xs']
const TONES: BadgeTone[] = ['blue', 'teal', 'neutral', 'info', 'success', 'warning', 'danger', 'navy']

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border-t border-line-subtle py-8">
      <h2 className="mb-4 text-xl font-medium">{title}</h2>
      {children}
    </section>
  )
}

export function Styleguide() {
  const [tab, setTab] = useState<'month' | 'year'>('month')
  const [chips, setChips] = useState<string[]>(['ceo'])
  const [date, setDate] = useState('2025-03-01')
  return (
    <div className="min-h-screen bg-page">
      <SiteHeader placement="static" navLabel="أقسام الدليل" nav={[{ id: 'colours', label: 'الألوان' }, { id: 'type', label: 'الخطوط' }, { id: 'components', label: 'المكوّنات' }]}>
        <Button variant="onbrand" size="sm" icon={<Plus size={16} aria-hidden />}>
          إجراء
        </Button>
      </SiteHeader>

      <div className="relative isolate overflow-hidden bg-blue-900 py-10 text-white">
        <div aria-hidden className="pattern-watermark absolute inset-0 -z-10 opacity-[0.06]" style={{ ['--pattern-url' as string]: `url(${pattern})` }} />
        <div className="container-page">
          <p className="text-sm text-blue-200">نظام التصميم، الإصدار {toArabicDigits(VERSION.trim())}</p>
          <h1 className="mt-1 text-display-sm font-medium">دليل التصميم لمواقع شركة المياه الوطنية</h1>
          <p className="mt-2 max-w-prose text-md text-white/80">كل لون وخط ومكوّن مسموح به في موقع واحد. أي موقع يختلف شكله عن هذه الصفحة لا يمر من الفحص.</p>
        </div>
      </div>

      <main className="container-page pb-16">
        <Block title="الألوان">
          <div id="colours" className="flex flex-col gap-5">
            {RAMPS.map((r) => (
              <div key={r.prefix}>
                <p className="mb-2 text-sm font-medium text-fg-secondary">{r.name}</p>
                <div className="flex flex-wrap gap-2">
                  {r.steps.map((s) => (
                    <div key={s} className="w-[88px]">
                      <div className="h-12 rounded-md border border-line-subtle" style={{ background: `var(--${r.prefix}-${s})` }} />
                      <p className="mt-1 font-ui text-2xs text-fg-tertiary" dir="ltr">
                        {r.prefix}-{s}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
            <div className="flex flex-wrap gap-x-8 gap-y-2">
              {TEXT.map((t) => (
                <p key={t.cls} className={`text-md ${t.cls}`}>
                  {t.name}
                </p>
              ))}
            </div>
          </div>
        </Block>

        <Block title="الخطوط">
          <div id="type" className="flex flex-col gap-3">
            {SIZES.map((s) => (
              <p key={s} className={`${s} text-fg-primary`}>
                <span className="font-medium">شركة المياه الوطنية</span> <span className="font-ui text-xs text-fg-tertiary" dir="ltr">{s}</span>
              </p>
            ))}
            <p className="text-md">
              <span className="font-light">خفيف ٣٠٠</span>، <span className="font-normal">عادي ٤٠٠</span>، <span className="font-medium">متوسط ٥٠٠</span>، <span className="font-bold">عريض ٧٠٠</span>
            </p>
            <p className="flex flex-wrap gap-x-8 gap-y-1 text-md tabular">
              <span>الأرقام العربية ٠١٢٣٤٥٦٧٨٩</span>
              <span>نسبة ١٢٫٥٪</span>
              <span className="font-ui" dir="ltr">
                Inter 0123456789
              </span>
            </p>
          </div>
        </Block>

        <Block title="المكوّنات">
          <div id="components" className="flex flex-col gap-8">
            <div>
              <p className="mb-3 text-sm font-medium text-fg-secondary">الأزرار</p>
              <div className="flex flex-wrap items-center gap-3">
                <Button icon={<Check size={18} aria-hidden />}>حفظ</Button>
                <Button variant="outline" icon={<Download size={18} aria-hidden />}>
                  تنزيل
                </Button>
                <Button variant="ghost">إلغاء</Button>
                <Button variant="ghost" className="text-danger-700 hover:bg-danger-50" icon={<Trash2 size={16} aria-hidden />}>
                  حذف
                </Button>
                <Button size="sm">صغير</Button>
                <Button size="lg">كبير</Button>
                <Button disabled>غير متاح</Button>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-3 rounded-lg bg-blue-900 p-4">
                <Button variant="onbrand">على الأزرق</Button>
                <Button variant="onbrandGhost">ثانوي على الأزرق</Button>
              </div>
            </div>

            <div>
              <p className="mb-3 text-sm font-medium text-fg-secondary">الشارات</p>
              <div className="flex flex-wrap gap-2">
                {TONES.map((t) => (
                  <Badge key={t} tone={t}>
                    {t}
                  </Badge>
                ))}
                <Badge tone="danger" size="xs">
                  متأخرة ٣ أيام
                </Badge>
                <Badge tone="warning" size="xs">
                  بانتظار الموافقة
                </Badge>
              </div>
            </div>

            <div>
              <p className="mb-3 text-sm font-medium text-fg-secondary">التبويب والتصفية</p>
              <div className="flex flex-wrap items-center gap-4">
                <Tabs
                  label="عرض"
                  items={[
                    { id: 'month', label: 'شهر' },
                    { id: 'year', label: 'سنة' },
                  ]}
                  value={tab}
                  onChange={setTab}
                />
                <FilterChips
                  label="تصفية"
                  allLabel="الكل"
                  multiple
                  value={chips}
                  onChange={setChips}
                  chips={[
                    { id: 'ceo', label: 'الرئيس التنفيذي', count: 4 },
                    { id: 'vp', label: 'نائب الرئيس', count: 2 },
                    { id: 'internal', label: 'داخلي', count: 0 },
                  ]}
                />
              </div>
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              <Card padding="none" className="p-4 md:p-6">
                <SectionHeading title="عنوان قسم" note="ملاحظة قصيرة بجانب العنوان" />
                <p className="text-sm text-fg-secondary">بطاقة: خلفية بيضاء، حد رفيع، زوايا ١٢ بكسل، وظل خفيف. داخلها ما يخص القسم.</p>
              </Card>
              <Card interactive>
                <p className="font-medium">بطاقة قابلة للنقر</p>
                <p className="mt-1 text-sm text-fg-tertiary">ترتفع قليلًا عند المرور عليها.</p>
              </Card>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <label htmlFor="sg-text" className="field-label">
                  حقل نصي
                </label>
                <input id="sg-text" className="field" defaultValue="نص مكتوب" />
                <p className="field-hint">ملاحظة تحت الحقل.</p>
              </div>
              <div>
                <label htmlFor="sg-select" className="field-label">
                  قائمة
                </label>
                <select id="sg-select" className="field" defaultValue="b">
                  <option value="a">الخيار الأول</option>
                  <option value="b">الخيار الثاني</option>
                </select>
              </div>
              <div>
                <label htmlFor="sg-date" className="field-label">
                  تاريخ
                </label>
                <DateInput id="sg-date" look="field" value={date} onChange={setDate} />
              </div>
              <div className="md:col-span-2">
                <label htmlFor="sg-area" className="field-label">
                  نص طويل
                </label>
                <textarea id="sg-area" rows={2} className="field" defaultValue="ملاحظات الفريق" />
              </div>
              <div>
                <label htmlFor="sg-off" className="field-label">
                  حقل مقفل
                </label>
                <input id="sg-off" className="field" disabled defaultValue="للعرض فقط" />
              </div>
            </div>

            <div>
              <p className="mb-3 text-sm font-medium text-fg-secondary">الشعار</p>
              <div className="flex flex-wrap items-center gap-6">
                <div className="rounded-lg border border-line-subtle bg-surface p-4">
                  <img src={logoColor} alt="شعار شركة المياه الوطنية الملوّن" className="h-11 w-auto" />
                </div>
                <div className="rounded-lg bg-blue-900 p-4">
                  <img src={logoWhite} alt="شعار شركة المياه الوطنية الأبيض" className="h-11 w-auto" />
                </div>
              </div>
            </div>
          </div>
        </Block>
      </main>
    </div>
  )
}
