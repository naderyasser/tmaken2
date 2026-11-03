import type { Metadata } from 'next'
import Link from 'next/link'
import { Gavel, UserCheck, Wallet, BadgeCheck, KeyRound, Handshake, ShieldCheck, Layers, MapPin, ArrowLeft } from 'lucide-react'
import LeadForm from '@/components/store/lead-form'
import AuctionCountdown from '@/components/store/auction-countdown'
import { BrandMark } from '@/components/store/brand-mark'

export const metadata: Metadata = {
  title: 'حراج العقارات | تمكين العقارية',
  description: 'مزادات عقارية موثّقة عبر منظّمين مرخّصين ومُقيّمين معتمدين — قريباً. سجّل اهتمامك كمزايد أو مالك، أو انضم كشريك منظّم مرخّص.',
}

const STEPS = [
  { icon: UserCheck, t: 'التسجيل', d: 'إنشاء حساب موثّق والاطّلاع على شروط المزاد.' },
  { icon: Wallet, t: 'دفع مبلغ الجدية', d: 'تأمينٌ مستردّ يؤهّلك للمزايدة على العقار.' },
  { icon: Gavel, t: 'المزايدة', d: 'تقديم العروض خلال وقت المزاد المعلن.' },
  { icon: BadgeCheck, t: 'الترسية', d: 'فوز صاحب أعلى عرض واعتماد النتيجة.' },
  { icon: KeyRound, t: 'السداد ونقل الملكية', d: 'إتمام السداد وإفراغ الصك ونقل الملكية.' },
]

export default function AuctionsPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      {/* Hero */}
      <section className="text-center">
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--aqar-green)]/10 text-[var(--aqar-green)]">
          <Gavel className="h-8 w-8" />
        </div>
        <div className="mb-3 flex justify-center">
          <span className="aqar-chip border-[var(--aqar-green)]/40 text-[var(--aqar-green-d)]">قريباً</span>
        </div>
        <h1 className="aqar-display text-3xl text-[var(--aqar-green-d)] sm:text-4xl">حراج العقارات</h1>
        <p className="mx-auto mt-4 max-w-2xl leading-8 text-[var(--aqar-kohl)]/70">
          مزاداتٌ عقاريةٌ موثّقة تُدار عبر <b>منظّمين مرخّصين</b> ومُقيّمين معتمدين، وفق لائحة المزادات لدى الهيئة العامة للعقار.
          نبني المنصّة الآن — سجّل اهتمامك، أو انضم كشريكٍ منظّم.
        </p>
      </section>

      {/* c — How it works */}
      <section className="mt-12">
        <h2 className="aqar-section-title text-xl">كيف يعمل المزاد</h2>
        <ol className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {STEPS.map((s, i) => (
            <li key={s.t} className="rounded-2xl border border-[var(--aqar-border)] bg-[var(--aqar-surface)] p-4">
              <div className="flex items-center justify-between">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--aqar-green)]/10 text-[var(--aqar-green)]"><s.icon className="h-5 w-5" /></span>
                <span className="text-2xl font-bold tabular-nums text-[var(--aqar-sand-2)]">{i + 1}</span>
              </div>
              <h3 className="mt-2 font-bold text-[var(--aqar-kohl)]">{s.t}</h3>
              <p className="mt-1 text-xs leading-6 text-[var(--aqar-kohl)]/60">{s.d}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* d — Sample auction cards (preview only) */}
      <section className="mt-12">
        <div className="mb-4 flex items-center gap-2">
          <h2 className="aqar-section-title text-xl">نماذج من بطاقات المزادات</h2>
          <span className="rounded-full bg-[var(--aqar-clay)]/10 px-2 py-0.5 text-[11px] font-medium text-[var(--aqar-clay)]">نموذج توضيحي</span>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <SampleCard status="live" city="الرياض" assets={12} hours={52} />
          <SampleCard status="upcoming" city="جدة" assets={7} />
          <SampleCard status="ended" city="الدمام" assets={20} />
        </div>
      </section>

      {/* a + b — Interest (buyer/owner) + Partner */}
      <section className="mt-12 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-[var(--aqar-border)] bg-[var(--aqar-surface)] p-6">
          <h2 className="aqar-section-title text-xl">سجّل اهتمامك</h2>
          <p className="mt-1.5 text-sm text-[var(--aqar-kohl)]/65">اختر صفتك ونُعلمك فور إطلاق أول مزاد.</p>
          <div className="mt-5">
            <LeadForm
              topic="Auctions"
              compact
              intents={[{ value: 'Bidder', label: 'مزايد / مشتري' }, { value: 'Owner', label: 'مالك عقار يريد البيع بالمزاد' }]}
              submitLabel="سجّل اهتمامي"
            />
          </div>
        </div>

        <div className="rounded-2xl border border-[var(--aqar-espresso-fill)]/15 bg-[var(--aqar-espresso-fill)]/5 p-6">
          <h2 className="aqar-section-title flex items-center gap-2 text-xl"><Handshake className="h-5 w-5 text-[var(--aqar-green)]" />كن شريكًا</h2>
          <p className="mt-1.5 text-sm text-[var(--aqar-kohl)]/65">لشركات المزادات والوسطاء <b>المرخّصين</b> — انضم كمنظّمٍ معتمد وأدرج مزاداتك على المنصّة.</p>
          <div className="mt-5">
            <LeadForm
              topic="Auctions"
              intent="Partner"
              requireName
              nameLabel="اسم الشركة / المنشأة"
              namePlaceholder="اسم شركة المزادات"
              messageLabel="رقم السجل التجاري / رخصة فال للمزادات"
              messagePlaceholder="مثال: 1010xxxxxx"
              submitLabel="أرسل طلب الشراكة"
              successText="شكراً لك — سيتواصل فريق الشراكات لمراجعة بيانات الترخيص."
            />
          </div>
        </div>
      </section>

      {/* e — Compliance */}
      <section className="mt-12">
        <div className="rounded-2xl border border-[var(--aqar-border)] bg-[var(--aqar-surface)] p-6">
          <h2 className="aqar-section-title flex items-center gap-2 text-xl"><ShieldCheck className="h-5 w-5 text-[var(--aqar-green)]" />الامتثال والتنظيم</h2>
          <p className="mt-2 text-sm leading-7 text-[var(--aqar-kohl)]/70">
            تُدار المزادات وفق <b>لائحة المزادات العقارية</b> لدى الهيئة العامة للعقار، عبر <b>منظّمين مرخّصين</b> (رخصة فال للمزادات)
            و<b>مُقيّمين معتمدين</b> من الهيئة السعودية للمقيّمين المعتمدين (تقييم). تخضع كل إعلانات المزادات لضوابط الإعلان العقاري والتحقّق من الترخيص.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl border border-dashed border-[var(--aqar-sand-2)] p-3 text-xs text-[var(--aqar-kohl)]/50">
            <ShieldCheck className="h-4 w-4 text-[var(--aqar-green)]/60" />
            مساحةٌ مخصّصة لعرض رقم ترخيص المزاد وضوابط الإعلان — تُفعّل عند ربط المنظّم المرخّص.
          </div>
        </div>
      </section>

      {/* f — Roadmap */}
      <section className="mt-12">
        <h2 className="aqar-section-title flex items-center gap-2 text-xl"><Layers className="h-5 w-5 text-[var(--aqar-green)]" />قريبًا على المنصّة</h2>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
          {[
            { t: 'إدراج المزادات الحيّة', d: 'عرض المزادات الحالية والقادمة من المنظّمين المرخّصين.' },
            { t: 'المزايدة المباشرة', d: 'تقديم العروض لحظيًّا مع عدّاد زمني للمزاد.' },
            { t: 'إدارة مبلغ الجدية', d: 'تحصيل التأمين واسترداده عبر مزوّد دفع مرخّص.' },
          ].map((x) => (
            <div key={x.t} className="rounded-2xl border border-dashed border-[var(--aqar-sand-2)] bg-[var(--aqar-surface)]/60 p-5">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-[var(--aqar-kohl)]">{x.t}</h3>
                <span className="rounded-full bg-[var(--aqar-sand-2)] px-2 py-0.5 text-[10px] text-[var(--aqar-kohl)]/55">قريباً</span>
              </div>
              <p className="mt-2 text-sm leading-7 text-[var(--aqar-kohl)]/60">{x.d}</p>
            </div>
          ))}
        </div>
        <Link href="/search" className="mt-8 inline-flex items-center gap-1.5 text-sm font-medium text-[var(--aqar-green)] hover:underline">
          تصفّح العروض الحالية <ArrowLeft className="h-4 w-4" />
        </Link>
      </section>
    </div>
  )
}

const STATUS: Record<string, { label: string; cls: string }> = {
  live: { label: 'الحالية', cls: 'bg-[var(--aqar-green)] text-white' },
  upcoming: { label: 'القادمة', cls: 'bg-[var(--aqar-gold)] text-white' },
  ended: { label: 'المنتهية', cls: 'bg-[var(--aqar-sand-2)] text-[var(--aqar-kohl)]/55' },
}

/** Static preview of an auction card anatomy — image, city, organizer slot, countdown, asset
 *  count, status. Decorative "نموذج" only; there is no live auction data or engine. */
function SampleCard({ status, city, assets, hours }: { status: 'live' | 'upcoming' | 'ended'; city: string; assets: number; hours?: number }) {
  const st = STATUS[status]
  return (
    <div className="aqar-card flex flex-col">
      <div className="relative flex h-36 items-center justify-center bg-[var(--aqar-sand-2)]">
        <BrandMark className="h-10 w-10 text-[var(--aqar-kohl)]/15" />
        <span className="absolute top-2 rounded-full bg-[var(--aqar-clay)]/90 px-2 py-0.5 text-[10px] font-bold text-white" style={{ insetInlineStart: '0.5rem' }}>نموذج</span>
        <span className={`absolute top-2 rounded-full px-2.5 py-0.5 text-[11px] font-bold ${st.cls}`} style={{ insetInlineEnd: '0.5rem' }}>{st.label}</span>
      </div>
      <div className="flex flex-1 flex-col p-3">
        <div className="flex items-center gap-2">
          {/* organizing-company logo slot */}
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-dashed border-[var(--aqar-sand-2)] text-[8px] text-[var(--aqar-kohl)]/40">شعار</span>
          <p className="text-sm font-bold text-[var(--aqar-kohl)]">مزاد عقاري — {city}</p>
        </div>
        <p className="mt-1 flex items-center gap-1 text-xs text-[var(--aqar-kohl)]/55"><MapPin className="h-3.5 w-3.5" />{city}</p>
        <div className="mt-3 flex items-center justify-between">
          {status === 'live' ? <AuctionCountdown hours={hours} />
            : status === 'upcoming' ? <span className="rounded-full bg-[var(--aqar-gold)]/15 px-2.5 py-1 text-xs font-medium text-[var(--aqar-gold)]">يبدأ قريبًا</span>
            : <span className="rounded-full bg-[var(--aqar-sand-2)] px-2.5 py-1 text-xs font-medium text-[var(--aqar-kohl)]/50">انتهى المزاد</span>}
          <span className="text-xs font-medium text-[var(--aqar-kohl)]/60">{assets} عقار</span>
        </div>
      </div>
    </div>
  )
}
