'use client'

import { Suspense, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Check, Loader2, X } from 'lucide-react'

import { HelpWidget } from '@/components/landing/help-widget'
import { sar } from '@/components/landing/pricing'
import { ORDER_BOOK_KEY, type PackageInfo } from '@/lib/store-api'

/** Self-service subscribe form on the shared entry → site_creator.hr_store. */
export default function SubscribePage() {
  return (
    <Suspense>
      <SubscribeForm />
    </Suspense>
  )
}

const ORDER = ['trial', 'silver', 'gold', 'diamond']

async function store<T>(method: string, args: Record<string, unknown>): Promise<T> {
  const r = await fetch(`/subscribe/api/${method}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(args) })
  const j = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(j.error || 'حصل خطأ، حاول مرة أخرى')
  return j.data as T
}

function rememberOrder(order: string, token: string) {
  try {
    const book = JSON.parse(localStorage.getItem(ORDER_BOOK_KEY) || '{}')
    book[order] = token
    localStorage.setItem(ORDER_BOOK_KEY, JSON.stringify(book))
  } catch {
    /* private mode: the done page then only shows the public status */
  }
}

function SubscribeForm() {
  const q = useSearchParams()
  const [info, setInfo] = useState<PackageInfo | null>(null)
  const [pkg, setPkg] = useState(ORDER.includes(q.get('package') || '') ? q.get('package')! : 'silver')
  const [employees, setEmployees] = useState(Math.max(1, Number(q.get('employees')) || 10))
  const [years, setYears] = useState(Math.min(3, Math.max(1, Number(q.get('years')) || 1)))
  const [f, setF] = useState({ company: '', site: '', contact_name: '', email: '', phone: '', admin_user: '', admin_password: '' })
  const [code, setCode] = useState<'idle' | 'checking' | 'ok' | 'taken' | 'invalid'>('idle')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    store<PackageInfo>('get_packages', {}).then(setInfo).catch(() => setError('تعذّر تحميل الباقات'))
  }, [])

  // keep the employee count inside the chosen package
  const p = info?.packages[pkg]
  useEffect(() => {
    if (!p || pkg === 'trial') return
    if (employees < p.min) setEmployees(p.min)
    else if (p.max && employees > p.max) setEmployees(p.max)
  }, [pkg, p]) // eslint-disable-line react-hooks/exhaustive-deps

  const price = useMemo(() => {
    if (!p || pkg === 'trial') return null
    const annual = Math.round(p.rate * employees * 100) / 100
    return { annual, total: Math.round((annual * years + p.setup) * 100) / 100 }
  }, [p, pkg, employees, years])

  // live «is the company code free?»
  useEffect(() => {
    const s = f.site.trim().toLowerCase()
    if (!s) return setCode('idle')
    if (!/^[a-z][a-z0-9-]{1,30}$/.test(s)) return setCode('invalid')
    setCode('checking')
    const t = setTimeout(() => {
      store<{ ok: boolean; reason?: string }>('check_code', { site: s })
        .then((r) => setCode(r.ok ? 'ok' : r.reason === 'invalid' ? 'invalid' : 'taken'))
        .catch(() => setCode('idle'))
    }, 400)
    return () => clearTimeout(t)
  }, [f.site])

  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value })

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (code === 'taken' || code === 'invalid') return setError('اختر رمز شركة آخر')
    setBusy(true)
    try {
      const r = await store<{ order: string; token: string; next: string; pay_url?: string }>('start_order', {
        ...f, site: f.site.trim().toLowerCase(), package: pkg, employees, years,
      })
      rememberOrder(r.order, r.token)
      if (r.next === 'pay' && r.pay_url) window.location.href = r.pay_url
      else window.location.href = `/subscribe/done?order=${encodeURIComponent(r.order)}`
    } catch (err) {
      setError(err instanceof Error ? err.message : 'حصل خطأ')
      setBusy(false)
    }
  }

  const input = 'h-11 w-full rounded-xl border border-[#dbe5e6] bg-white px-3 text-[15px] outline-none focus:border-[#24817f] focus:ring-2 focus:ring-[#24817f]/15'
  const label = 'mb-1.5 block text-[13.5px] font-bold text-[#2c4a50]'

  return (
    <div dir="rtl" lang="ar" className="min-h-screen bg-[#f4f8f8] text-[#163d44]" style={{ fontFamily: 'var(--font-kufi), var(--font-arabic), system-ui, sans-serif' }}>
      <header className="bg-[#163d44]">
        <div className="mx-auto flex h-16 max-w-5xl items-center px-4">
          <Link href="/" aria-label="الرئيسية">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/branding/masar/masar-logo-white.png" alt="Masar Time" className="h-9 w-auto" />
          </Link>
          <Link href="/login" className="ms-auto text-[14px] text-white/80 hover:text-white">لديك حساب؟ تسجيل الدخول</Link>
        </div>
      </header>

      <form onSubmit={submit} className="mx-auto grid max-w-5xl gap-6 px-4 py-10 lg:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          <h1 className="text-[26px] font-extrabold">{pkg === 'trial' ? 'ابدأ تجربتك المجانية' : 'اشترك في Masar Time'}</h1>

          <section className="rounded-2xl border border-[#dbe5e6] bg-white p-5">
            <h2 className="mb-4 text-[16px] font-bold">الباقة</h2>
            <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4">
              {ORDER.filter((k) => info?.packages[k]).map((k) => {
                const pk = info!.packages[k]
                return (
                  <button type="button" key={k} onClick={() => setPkg(k)}
                    className={`rounded-xl border p-3 text-start transition ${pkg === k ? 'border-[#24817f] bg-[#e6f4f2] ring-1 ring-[#24817f]' : 'border-[#dbe5e6] hover:border-[#24817f]'}`}>
                    <b className="block text-[14.5px]">{k === 'trial' ? 'تجربة مجانية' : `الباقة ${pk.label}`}</b>
                    <span className="mt-1 block text-[12.5px] text-[#5b7a7f]">
                      {k === 'trial' ? 'شهر — البرونزية' : `${pk.rate} ر.س / موظف سنوياً`}
                    </span>
                  </button>
                )
              })}
              {!info && <div className="col-span-4 h-16 animate-pulse rounded-xl bg-[#eef3f3]" />}
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <label className={label} htmlFor="s-emp">عدد الموظفين</label>
                <input id="s-emp" type="number" min={p?.min || 1} max={p?.max || undefined} value={employees}
                  onChange={(e) => setEmployees(Math.max(1, +e.target.value || 1))} className={`${input} tabular-nums`} dir="ltr" />
                {p && pkg !== 'trial' && <p className="mt-1 text-[12.5px] text-[#7b9396]">{p.max ? `من ${p.min} إلى ${p.max} موظف` : `${p.min} موظف فأكثر`}</p>}
              </div>
              {pkg !== 'trial' && (
                <div>
                  <span className={label}>مدة الاشتراك</span>
                  <div className="flex gap-2">
                    {[1, 2, 3].map((y) => (
                      <button type="button" key={y} onClick={() => setYears(y)}
                        className={`h-11 flex-1 rounded-xl text-[14px] font-bold ${years === y ? 'bg-[#163d44] text-white' : 'bg-[#eef3f3]'}`}>
                        {y === 1 ? 'سنة' : y === 2 ? 'سنتان' : '3 سنوات'}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </section>

          <section className="rounded-2xl border border-[#dbe5e6] bg-white p-5">
            <h2 className="mb-4 text-[16px] font-bold">بيانات الشركة</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className={label} htmlFor="s-co">اسم الشركة</label>
                <input id="s-co" required maxLength={120} value={f.company} onChange={set('company')} className={input} placeholder="مثال: شركة الأفق للتجارة" />
                <p className="mt-1 text-[12.5px] text-[#7b9396]">يظهر كاسم للنظام عند موظفيك.</p>
              </div>
              <div className="sm:col-span-2">
                <label className={label} htmlFor="s-code">رمز الشركة</label>
                <div className="relative">
                  <input id="s-code" required maxLength={31} value={f.site} onChange={set('site')} className={`${input} pe-10`} dir="ltr" placeholder="alofoq"
                    autoCapitalize="none" autoCorrect="off" spellCheck={false} />
                  <span className="absolute end-3 top-1/2 -translate-y-1/2">
                    {code === 'checking' && <Loader2 className="h-4 w-4 animate-spin text-[#7b9396]" />}
                    {code === 'ok' && <Check className="h-4 w-4 text-[#2f9e6f]" />}
                    {(code === 'taken' || code === 'invalid') && <X className="h-4 w-4 text-[#c2410c]" />}
                  </span>
                </div>
                <p className={`mt-1 text-[12.5px] ${code === 'taken' || code === 'invalid' ? 'text-[#c2410c]' : 'text-[#7b9396]'}`}>
                  {code === 'taken' ? 'الرمز مستخدم — اختر رمزاً آخر'
                    : code === 'invalid' ? 'حروف إنجليزية صغيرة وأرقام وشرطة، ويبدأ بحرف'
                      : <>يكتبه موظفوك في أول خانة عند الدخول على <span dir="ltr">{info?.entry || 'masar.base.meena.sa'}</span></>}
                </p>
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-[#dbe5e6] bg-white p-5">
            <h2 className="mb-4 text-[16px] font-bold">حساب المدير وبيانات التواصل</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className={label} htmlFor="s-user">اسم المستخدم</label>
                <input id="s-user" required minLength={3} maxLength={60} pattern="[A-Za-z0-9._@\-]{3,60}" value={f.admin_user} onChange={set('admin_user')}
                  className={input} dir="ltr" autoComplete="username" placeholder="admin" title="حروف إنجليزية وأرقام و . _ @ -" />
              </div>
              <div>
                <label className={label} htmlFor="s-pass">كلمة المرور</label>
                <input id="s-pass" required type="password" minLength={8} maxLength={64} pattern="\S{8,64}" value={f.admin_password} onChange={set('admin_password')}
                  className={input} dir="ltr" autoComplete="new-password" title="8 أحرف على الأقل وبدون مسافات" />
              </div>
              <div>
                <label className={label} htmlFor="s-name">اسم المسؤول</label>
                <input id="s-name" required maxLength={80} value={f.contact_name} onChange={set('contact_name')} className={input} autoComplete="name" />
              </div>
              <div>
                <label className={label} htmlFor="s-phone">رقم الجوال</label>
                <input id="s-phone" required type="tel" value={f.phone} onChange={set('phone')} className={input} dir="ltr" placeholder="05xxxxxxxx" autoComplete="tel" />
              </div>
              <div className="sm:col-span-2">
                <label className={label} htmlFor="s-email">البريد الإلكتروني</label>
                <input id="s-email" required type="email" value={f.email} onChange={set('email')} className={input} dir="ltr" autoComplete="email" />
              </div>
            </div>
          </section>
        </div>

        <aside className="lg:pt-14">
          <div className="sticky top-6 rounded-2xl border border-[#dbe5e6] bg-white p-5">
            <h2 className="text-[16px] font-bold">ملخص الطلب</h2>
            {p && (
              <dl className="mt-4 space-y-2.5 text-[14px]">
                <div className="flex justify-between"><dt className="text-[#5b7a7f]">الباقة</dt><dd className="font-bold">{pkg === 'trial' ? 'تجربة مجانية (شهر)' : p.label}</dd></div>
                <div className="flex justify-between"><dt className="text-[#5b7a7f]">الموظفون</dt><dd className="font-bold tabular-nums">{employees}</dd></div>
                {price && (
                  <>
                    <div className="flex justify-between"><dt className="text-[#5b7a7f]">الاشتراك ({years === 1 ? 'سنة' : years === 2 ? 'سنتان' : '3 سنوات'})</dt><dd className="tabular-nums">{sar(price.annual * years)}</dd></div>
                    <div className="flex justify-between"><dt className="text-[#5b7a7f]">رسوم التأسيس</dt><dd className="tabular-nums">{sar(p.setup)}</dd></div>
                    <div className="flex justify-between border-t border-[#eef3f3] pt-3 text-[16px]"><dt className="font-bold">الإجمالي</dt><dd className="font-extrabold text-[#24817f] tabular-nums">{sar(price.total)}</dd></div>
                    <p className="text-[12px] text-[#7b9396]">شامل ضريبة القيمة المضافة</p>
                  </>
                )}
                {pkg === 'trial' && <div className="flex justify-between border-t border-[#eef3f3] pt-3 text-[16px]"><dt className="font-bold">الإجمالي</dt><dd className="font-extrabold text-[#24817f]">مجاناً</dd></div>}
              </dl>
            )}
            {error && <p role="alert" className="mt-4 rounded-lg bg-[#fdf0ec] px-3 py-2 text-[13.5px] text-[#a1350f]">{error}</p>}
            <button disabled={busy || !info} className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#24817f] text-[16px] font-bold text-white hover:bg-[#1d6b69] disabled:opacity-60">
              {busy && <Loader2 className="h-5 w-5 animate-spin" />}
              {pkg === 'trial' ? 'أنشئ نسختي التجريبية' : info?.online_payment ? 'المتابعة إلى الدفع' : 'إرسال الطلب'}
            </button>
            {pkg !== 'trial' && (
              <p className="mt-3 text-center text-[12px] leading-5 text-[#7b9396]">
                {info?.online_payment ? 'الدفع عبر بوابة آمنة: مدى، فيزا، ماستركارد، Apple Pay' : 'يتواصل معك فريقنا لإتمام الدفع بالتحويل البنكي، وتُنشأ نسختك فور تأكيده'}
              </p>
            )}
          </div>
        </aside>
      </form>
      <HelpWidget />
    </div>
  )
}
