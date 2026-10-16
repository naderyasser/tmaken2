'use client'

import { Suspense, useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Check, Copy, CreditCard, Loader2, Mail, XCircle } from 'lucide-react'

import { HelpWidget } from '@/components/landing/help-widget'
import { sar } from '@/components/landing/pricing'
import { CONTACT } from '@/lib/site-contact'
import { ORDER_BOOK_KEY } from '@/lib/store-api'

/** Order follow-up: payment → copy being built → ready (login details). */
export default function OrderDonePage() {
  return (
    <Suspense>
      <OrderStatus />
    </Suspense>
  )
}

interface Status {
  order: string
  status: 'awaiting_payment' | 'awaiting_manual' | 'provisioning' | 'cancelled'
  company: string
  code: string
  package: string
  amount: { total: number }
  pay_url: string | null
  entry: string
  job?: { state: string; error?: string; code?: string; admin_user?: string; admin_password?: string | null; steps: string[] }
}

const STEPS = ['تجهيز النسخة', 'إنشاء قاعدة البيانات', 'الشعار والإعدادات', 'بيانات الشركة وحساب المدير', 'تفعيل رمز الشركة', 'النطاق', 'فحص أخير']

function OrderStatus() {
  const order = useSearchParams().get('order') || ''
  const [s, setS] = useState<Status | null>(null)
  const [error, setError] = useState('')

  const token = useCallback(() => {
    try {
      return JSON.parse(localStorage.getItem(ORDER_BOOK_KEY) || '{}')[order] || ''
    } catch {
      return ''
    }
  }, [order])

  useEffect(() => {
    let stop = false
    let timer: ReturnType<typeof setTimeout>
    const tick = async () => {
      const r = await fetch('/subscribe/api/order_status', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ order, token: token() }) })
      const j = await r.json().catch(() => ({}))
      if (stop) return
      if (!r.ok) {
        setError(j.error || 'تعذّر العثور على الطلب')
        return
      }
      setS(j.data)
      const done = j.data.job && ['done', 'failed'].includes(j.data.job.state)
      if (!done && j.data.status !== 'cancelled') timer = setTimeout(tick, j.data.status === 'provisioning' ? 4000 : 8000)
    }
    tick()
    return () => {
      stop = true
      clearTimeout(timer)
    }
  }, [order, token])

  const loginUrl = s ? `https://${s.entry}/company-select?code=${encodeURIComponent(s.code)}&next=/login` : '#'
  const at = s?.job ? s.job.steps.length - 1 : -1

  return (
    <div dir="rtl" lang="ar" className="min-h-screen bg-[#f4f8f8] text-[#163d44]" style={{ fontFamily: 'var(--font-kufi), var(--font-arabic), system-ui, sans-serif' }}>
      <header className="bg-[#163d44]">
        <div className="mx-auto flex h-16 max-w-3xl items-center px-4">
          <Link href="/" aria-label="الرئيسية">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/branding/masar/masar-logo-white.png" alt="Masar Time" className="h-9 w-auto" />
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-12">
        {error && <Card><p className="text-center text-[15px] text-[#a1350f]">{error}</p></Card>}
        {!s && !error && <Card><div className="flex justify-center py-8"><Loader2 className="h-7 w-7 animate-spin text-[#24817f]" /></div></Card>}

        {s && s.status === 'awaiting_payment' && (
          <Card>
            <CreditCard className="mx-auto h-10 w-10 text-[#24817f]" />
            <h1 className="mt-4 text-center text-[22px] font-extrabold">بانتظار الدفع</h1>
            <p className="mt-2 text-center text-[15px] text-[#5b7a7f]">طلب {s.package} لشركة {s.company} — الإجمالي {sar(s.amount.total)}</p>
            {s.pay_url && (
              <a href={s.pay_url} className="mx-auto mt-6 flex h-12 max-w-xs items-center justify-center rounded-xl bg-[#24817f] text-[16px] font-bold text-white hover:bg-[#1d6b69]">إتمام الدفع</a>
            )}
            <p className="mt-4 text-center text-[13px] text-[#7b9396]">إذا أتممت الدفع للتو، ستتحدث هذه الصفحة تلقائياً خلال لحظات.</p>
          </Card>
        )}

        {s && s.status === 'awaiting_manual' && (
          <Card>
            <Mail className="mx-auto h-10 w-10 text-[#24817f]" />
            <h1 className="mt-4 text-center text-[22px] font-extrabold">استلمنا طلبك</h1>
            <p className="mt-3 text-center text-[15px] leading-8 text-[#2c4a50]">
              طلب {s.package} لشركة <b>{s.company}</b> بإجمالي <b>{sar(s.amount.total)}</b>.<br />
              سيتواصل معك فريقنا لإتمام الدفع، وتُنشأ نسختك فور تأكيده — وستجدها على هذه الصفحة.
            </p>
            <p className="mt-4 text-center text-[13px] text-[#7b9396]">رقم الطلب: <span dir="ltr">{s.order}</span></p>
            <div className="mt-5 flex flex-wrap justify-center gap-2 text-[14px]">
              <a href={`${CONTACT.whatsappHref}?text=${encodeURIComponent('طلب اشتراك Masar Time رقم ' + s.order)}`} target="_blank" rel="noopener"
                className="rounded-xl bg-[#1f9d55] px-4 py-2.5 font-bold text-white hover:bg-[#188a49]">تواصل معنا على واتساب</a>
              <a href={CONTACT.phoneHref} className="rounded-xl border border-[#dbe5e6] px-4 py-2.5 font-bold" dir="ltr">{CONTACT.phoneDisplay}</a>
            </div>
          </Card>
        )}

        {s && s.status === 'cancelled' && (
          <Card><p className="text-center text-[15px]">تم إلغاء هذا الطلب.</p></Card>
        )}

        {s && s.job && s.job.state !== 'done' && s.job.state !== 'failed' && (
          <Card>
            <h1 className="text-center text-[22px] font-extrabold">جاري تجهيز نسختك…</h1>
            <p className="mt-2 text-center text-[14.5px] text-[#5b7a7f]">يستغرق ذلك نحو 3 دقائق — يمكنك البقاء على هذه الصفحة.</p>
            <ol className="mx-auto mt-6 max-w-sm space-y-2.5 text-[14.5px]">
              {STEPS.map((t, i) => (
                <li key={t} className={`flex items-center gap-2.5 ${i < at ? 'text-[#2f9e6f]' : i === at ? 'font-bold' : 'text-[#9fb3b6]'}`}>
                  {i < at ? <Check className="h-4 w-4" /> : i === at ? <Loader2 className="h-4 w-4 animate-spin" /> : <span className="h-4 w-4 rounded-full border border-current" />}
                  {t}
                </li>
              ))}
            </ol>
          </Card>
        )}

        {s && s.job?.state === 'failed' && (
          <Card>
            <XCircle className="mx-auto h-10 w-10 text-[#c2410c]" />
            <h1 className="mt-4 text-center text-[20px] font-extrabold">تعذّر إنشاء النسخة</h1>
            <p className="mt-2 text-center text-[14.5px] text-[#5b7a7f]">فريقنا اطّلع على المشكلة وسيتواصل معك. رقم الطلب: <span dir="ltr">{s.order}</span></p>
          </Card>
        )}

        {s && s.job?.state === 'done' && (
          <Card>
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#e7f6ee]"><Check className="h-7 w-7 text-[#2f9e6f]" /></span>
            <h1 className="mt-4 text-center text-[24px] font-extrabold">نسختك جاهزة</h1>
            <p className="mt-2 text-center text-[15px] text-[#5b7a7f]">احفظ بيانات الدخول التالية:</p>
            <dl className="mx-auto mt-6 max-w-md divide-y divide-[#eef3f3] rounded-xl border border-[#dbe5e6] text-[15px]">
              <Row label="رابط الدخول" value={s.entry} />
              <Row label="رمز الشركة" value={s.code} />
              <Row label="اسم المستخدم" value={s.job.admin_user || 'Administrator'} />
              {s.job.admin_password && <Row label="كلمة المرور" value={s.job.admin_password} />}
            </dl>
            {!s.job.admin_password && <p className="mt-3 text-center text-[13px] text-[#7b9396]">كلمة المرور هي التي اخترتها عند الطلب.</p>}
            <a href={loginUrl} className="mx-auto mt-6 flex h-12 max-w-xs items-center justify-center rounded-xl bg-[#24817f] text-[16px] font-bold text-white hover:bg-[#1d6b69]">ادخل إلى نظامك</a>
            <p className="mt-4 text-center text-[13px] text-[#7b9396]">تطبيق الجوال لموظفيك: <span dir="ltr">{s.entry}/m</span> — بنفس رمز الشركة.</p>
          </Card>
        )}
      </main>
      <HelpWidget />
    </div>
  )
}

function Card({ children }: { children: React.ReactNode }) {
  return <div className="rounded-2xl border border-[#dbe5e6] bg-white p-8 shadow-[0_24px_60px_-40px_rgba(15,42,47,.45)]">{children}</div>
}

function Row({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <dt className="w-28 shrink-0 text-[#5b7a7f]">{label}</dt>
      <dd className="flex-1 font-bold" dir="ltr">{value}</dd>
      <button type="button" aria-label={`نسخ ${label}`} onClick={() => { navigator.clipboard?.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 1500) }}
        className="text-[#7b9396] hover:text-[#24817f]">
        {copied ? <Check className="h-4 w-4 text-[#2f9e6f]" /> : <Copy className="h-4 w-4" />}
      </button>
    </div>
  )
}
