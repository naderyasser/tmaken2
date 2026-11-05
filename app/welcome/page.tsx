import type { Metadata } from 'next'
import Link from 'next/link'
import {
  BarChart3, Building2, CalendarClock, ClipboardCheck, Fingerprint, MapPin, MonitorSmartphone, ShieldCheck, Smartphone, Zap,
} from 'lucide-react'

import { HelpWidget } from '@/components/landing/help-widget'
import { Pricing } from '@/components/landing/pricing'
import { CONTACT, CONTACTS } from '@/lib/site-contact'
import { storeCall, type PackageInfo } from '@/lib/store-api'

/**
 * Public landing page of the HR product on the shared entry
 * (masar.base.meena.sa/ for visitors without a session — see middleware).
 * Packages and prices are read live from the store's price list.
 */
export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Masar Time — نظام الحضور والانصراف والموارد البشرية',
  description: 'نظام سحابي للحضور والانصراف مربوط بأجهزة البصمة وتطبيق الجوال، بفروع متعددة وتقارير تفصيلية. جرّبه مجاناً لمدة شهر.',
}

const FEATURES = [
  { icon: Fingerprint, title: 'ربط مباشر بأجهزة البصمة', text: 'أجهزة ZKTeco الداعمة لخاصية ADMS ترسل الحركات إلى السحابة لحظياً، بلا برامج وسيطة ولا أجهزة كمبيوتر في الفروع.' },
  { icon: Smartphone, title: 'تطبيق جوال للموظفين', text: 'بصمة الحضور والانصراف من الجوال داخل نطاق موقع العمل فقط، مع تأكيد بصمة الإصبع أو الوجه على الجهاز نفسه.' },
  { icon: CalendarClock, title: 'دوامات بكل أشكالها', text: 'دوام ثابت وفترتين ومفتوح ومتغيّر بالورديات، ودوام خاص لشهر رمضان، مع قواعد التأخير والخروج المبكر.' },
  { icon: Building2, title: 'فروع متعددة', text: 'كل فرع بأجهزته وموظفيه ومواقعه، وصلاحيات لكل مدير على فروعه فقط.' },
  { icon: BarChart3, title: 'تقارير تفصيلية وإجمالية', text: 'تقارير الحضور والغياب والتأخير والإجازات لموظف أو مجموعة أو كل الشركة، قابلة للطباعة والتصدير.' },
  { icon: ClipboardCheck, title: 'الطلبات والاعتمادات', text: 'طلبات الإجازات والأذونات والخطابات بمسار اعتماد واضح، ومتابعة حالة كل طلب.' },
  { icon: ShieldCheck, title: 'المخالفات والجزاءات', text: 'لائحة جزاءات قابلة للتعديل وإنذارات تُحتسب تلقائياً من سجل الحضور.' },
  { icon: MonitorSmartphone, title: 'من أي جهاز', text: 'يعمل على الكمبيوتر والتابلت والجوال من المتصفح، بواجهة عربية سهلة.' },
]

const STEPS = [
  { n: '1', title: 'اختر باقتك', text: 'حسب عدد موظفيك، أو ابدأ بالتجربة المجانية.' },
  { n: '2', title: 'أرسل طلبك', text: 'يتواصل معك فريقنا لتأكيد الطلب وإتمام الدفع بالتحويل البنكي.' },
  { n: '3', title: 'نسختك جاهزة خلال دقائق', text: 'فور تأكيد الدفع تُنشأ نسختك بقاعدة بيانات مستقلة، وتدخل برمز شركتك مباشرة.' },
]

const FAQ = [
  { q: 'ما أجهزة البصمة المدعومة؟', a: 'أجهزة ZKTeco التي تدعم خاصية ADMS (دفع البيانات إلى السيرفر). يكفي توصيل الجهاز بالإنترنت وإضافة رقمه التسلسلي من شاشة الأجهزة.' },
  { q: 'هل يحتاج الموظف لجهاز بصمة؟', a: 'لا يشترط. يمكن تفعيل البصمة من تطبيق الجوال لموظفين محددين، ولا تُقبل إلا داخل نطاق مواقع العمل التي تحددها.' },
  { q: 'هل بيانات شركتي منفصلة عن غيرها؟', a: 'نعم، كل شركة لها قاعدة بيانات مستقلة تماماً، والدخول برمز الشركة واسم مستخدم وكلمة مرور.' },
  { q: 'كيف تعمل التجربة المجانية؟', a: 'نسخة كاملة على الباقة البرونزية لمدة شهر بدون دفع. تُنشأ خلال دقائق، ويمكنك بعدها الاشتراك في الباقة المناسبة.' },
  { q: 'هل الأسعار شاملة الضريبة؟', a: 'نعم، الأسعار بالريال السعودي وشاملة ضريبة القيمة المضافة. رسوم التأسيس تُدفع مرة واحدة فقط.' },
  { q: 'ماذا لو زاد عدد موظفيّ؟', a: 'يمكنك الترقية إلى الباقة الأعلى في أي وقت، ويُحسب سعر الموظف حسب الباقة الجديدة.' },
]

export default async function WelcomePage() {
  const info = await storeCall<PackageInfo>('get_packages')
  const packages = info.ok ? info.data.packages : null

  return (
    <div dir="rtl" lang="ar" className="min-h-screen bg-[#f4f8f8] text-[#163d44]" style={{ fontFamily: 'var(--font-kufi), var(--font-arabic), system-ui, sans-serif' }}>
      {/* ── nav ── */}
      <header className="sticky top-0 z-30 border-b border-white/10 bg-[#163d44]/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/branding/masar/masar-logo-white.png" alt="Masar Time" className="h-8 w-auto shrink-0 sm:h-9" />
          <nav className="hidden flex-1 items-center gap-6 text-[14px] text-white/80 md:flex">
            <a href="#features" className="hover:text-white">المميزات</a>
            <a href="#pricing" className="hover:text-white">الباقات والأسعار</a>
            <a href="#faq" className="hover:text-white">الأسئلة الشائعة</a>
          </nav>
          <div className="ms-auto flex items-center gap-2">
            <a href={CONTACT.phoneHref} className="hidden text-[14px] text-white/80 hover:text-white lg:block" dir="ltr">{CONTACT.phoneDisplay}</a>
            <Link href="/login" className="h-9 whitespace-nowrap rounded-lg px-2 text-[13.5px] leading-9 text-white/85 hover:text-white sm:px-3 sm:text-[14px]">تسجيل الدخول</Link>
            <Link href="/subscribe?package=trial" className="h-9 whitespace-nowrap rounded-lg bg-[#6cc196] px-3 text-[13.5px] font-bold leading-9 text-[#0f2a2f] hover:bg-[#7fd1a8] sm:px-4 sm:text-[14px]">جرّب مجاناً</Link>
          </div>
        </div>
      </header>

      {/* ── hero ── */}
      <section className="relative overflow-hidden bg-gradient-to-b from-[#163d44] to-[#1d4d56] text-white">
        <div aria-hidden className="absolute -left-40 -top-40 h-[480px] w-[480px] rounded-full bg-[#2c9c9a]/20 blur-3xl" />
        <div className="relative mx-auto grid max-w-6xl items-center gap-10 px-4 pb-20 pt-14 lg:grid-cols-[1.05fr_1fr]">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-[13px] text-[#a9e3c6]">
              <Zap className="h-3.5 w-3.5" /> سحابي — بدون سيرفرات ولا برامج تُثبَّت
            </span>
            <h1 className="mt-5 text-[34px] font-extrabold leading-[1.35] md:text-[44px]">
              الحضور والانصراف والموارد البشرية
              <span className="block text-[#7fd1a8]">في نظام واحد مربوط بالبصمة</span>
            </h1>
            <p className="mt-5 max-w-xl text-[16.5px] leading-8 text-white/75">
              أجهزة البصمة في كل فروعك ترسل الحركات مباشرة إلى Masar Time، وموظفوك يبصمون من الجوال داخل موقع العمل،
              وتقاريرك جاهزة لحظة ما تحتاجها.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/subscribe?package=trial" className="flex h-12 items-center rounded-xl bg-[#6cc196] px-6 text-[16px] font-bold text-[#0f2a2f] hover:bg-[#7fd1a8]">
                ابدأ تجربتك المجانية — شهر كامل
              </Link>
              <a href="#pricing" className="flex h-12 items-center rounded-xl border border-white/25 px-6 text-[16px] font-bold hover:bg-white/10">الباقات والأسعار</a>
            </div>
            <p className="mt-4 text-[13px] text-white/50">بدون بطاقة ائتمان للتجربة — نسختك جاهزة خلال دقائق.</p>
          </div>
          <div className="relative">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/landing/dashboard.webp" alt="لوحة القيادة في Masar Time"
              className="w-full rounded-2xl border border-white/10 shadow-[0_40px_90px_-30px_rgba(0,0,0,.7)]" />
            <div className="absolute -bottom-6 -right-4 hidden w-44 overflow-hidden rounded-2xl border border-white/10 shadow-2xl sm:block">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/branding/product/login-photo.webp" alt="" className="h-40 w-full object-cover" />
            </div>
          </div>
        </div>
      </section>

      {/* ── features ── */}
      <section id="features" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-20">
        <h2 className="text-center text-[28px] font-extrabold">كل ما تحتاجه لإدارة حضور موظفيك</h2>
        <p className="mx-auto mt-3 max-w-2xl text-center text-[15.5px] leading-7 text-[#5b7a7f]">من جهاز البصمة على الحائط إلى التقرير الشهري — بدون أوراق ولا جداول يدوية.</p>
        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map(({ icon: Icon, title, text }) => (
            <div key={title} className="rounded-2xl border border-[#dbe5e6] bg-white p-5">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#e6f4f2] text-[#24817f]"><Icon className="h-5 w-5" /></span>
              <h3 className="mt-4 text-[16px] font-bold">{title}</h3>
              <p className="mt-2 text-[14px] leading-7 text-[#5b7a7f]">{text}</p>
            </div>
          ))}
        </div>

        <div className="mt-16 grid items-center gap-10 lg:grid-cols-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/landing/employees.webp" alt="شاشة الموظفين" className="w-full rounded-2xl border border-[#dbe5e6] shadow-[0_30px_70px_-40px_rgba(15,42,47,.5)]" />
          <div>
            <h3 className="text-[24px] font-extrabold">بيانات موظفيك في مكان واحد</h3>
            <ul className="mt-5 space-y-3 text-[15px] leading-7 text-[#2c4a50]">
              <li className="flex gap-3"><MapPin className="mt-1 h-5 w-5 shrink-0 text-[#24817f]" />حدّد مواقع العمل على الخريطة ونطاق كل موقع بالمتر، واختر لكل موظف المواقع المسموح له البصمة منها.</li>
              <li className="flex gap-3"><CalendarClock className="mt-1 h-5 w-5 shrink-0 text-[#24817f]" />اربط كل موظف بدوامه وفرعه وإدارته، وغيّر الدوام لأي فترة بضغطة.</li>
              <li className="flex gap-3"><BarChart3 className="mt-1 h-5 w-5 shrink-0 text-[#24817f]" />لوحة قيادة لحظية: الحضور والغياب والإجازات وحركات اليوم لكل فرع.</li>
            </ul>
          </div>
        </div>
      </section>

      {/* ── how ── */}
      <section className="bg-white py-20">
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="text-center text-[28px] font-extrabold">ابدأ في ثلاث خطوات</h2>
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {STEPS.map((s) => (
              <div key={s.n} className="rounded-2xl bg-[#f4f8f8] p-6">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#163d44] text-[17px] font-bold text-white">{s.n}</span>
                <h3 className="mt-4 text-[17px] font-bold">{s.title}</h3>
                <p className="mt-2 text-[14.5px] leading-7 text-[#5b7a7f]">{s.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── pricing ── */}
      <section id="pricing" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-20">
        <h2 className="text-center text-[28px] font-extrabold">باقات تناسب حجم شركتك</h2>
        <p className="mx-auto mt-3 max-w-2xl text-center text-[15.5px] text-[#5b7a7f]">اشتراك سنوي حسب عدد الموظفين، وكلما زاد العدد قلّ سعر الموظف.</p>
        <div className="mt-10">
          {packages ? <Pricing packages={packages} /> : <p className="text-center text-[#5b7a7f]">تعذّر تحميل الأسعار الآن — حدّث الصفحة.</p>}
        </div>
        <div className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-dashed border-[#24817f]/50 bg-[#e6f4f2] p-6">
          <div>
            <h3 className="text-[18px] font-bold">جرّب قبل أن تشترك</h3>
            <p className="mt-1 text-[14.5px] text-[#2c4a50]">نسخة كاملة على الباقة البرونزية لمدة شهر — مجاناً وبدون بطاقة.</p>
          </div>
          <Link href="/subscribe?package=trial" className="flex h-11 items-center rounded-xl bg-[#163d44] px-6 text-[15px] font-bold text-white hover:bg-[#1d4d56]">ابدأ التجربة المجانية</Link>
        </div>
      </section>

      {/* ── faq ── */}
      <section id="faq" className="scroll-mt-20 bg-white py-20">
        <div className="mx-auto max-w-3xl px-4">
          <h2 className="text-center text-[28px] font-extrabold">الأسئلة الشائعة</h2>
          <div className="mt-10 divide-y divide-[#e5eeee] rounded-2xl border border-[#dbe5e6]">
            {FAQ.map((f) => (
              <details key={f.q} className="group p-5 [&_summary::-webkit-details-marker]:hidden">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-[15.5px] font-bold">
                  {f.q}
                  <span className="text-[20px] text-[#24817f] transition group-open:rotate-45">+</span>
                </summary>
                <p className="mt-3 text-[14.5px] leading-7 text-[#5b7a7f]">{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ── cta + footer ── */}
      <section className="bg-[#163d44] py-16 text-center text-white">
        <h2 className="text-[26px] font-extrabold">جاهز تبدأ؟</h2>
        <p className="mt-2 text-white/70">نسختك من Masar Time تعمل خلال دقائق.</p>
        <div className="mt-7 flex flex-wrap justify-center gap-3">
          <Link href="/subscribe?package=trial" className="flex h-12 items-center rounded-xl bg-[#6cc196] px-6 text-[16px] font-bold text-[#0f2a2f] hover:bg-[#7fd1a8]">ابدأ مجاناً</Link>
          <a href="#pricing" className="flex h-12 items-center rounded-xl border border-white/25 px-6 text-[16px] font-bold hover:bg-white/10">اختر باقتك</a>
        </div>
      </section>
      <footer className="bg-[#0f2a2f] py-8 text-center text-[13px] text-white/60">
        <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
          <span className="text-white/80">خدمة العملاء:</span>
          {CONTACTS.map((c) => (
            <span key={c.phoneHref} className="flex items-center gap-2">
              <span>{c.company}</span>
              <a href={c.phoneHref} className="hover:text-white" dir="ltr">{c.phoneDisplay}</a>
              <a href={c.whatsappHref} target="_blank" rel="noopener" className="hover:text-white">واتساب</a>
            </span>
          ))}
          <a href={`mailto:${CONTACT.email}`} className="hover:text-white" dir="ltr">{CONTACT.email}</a>
        </div>
        <p className="mt-4 text-[12.5px] text-white/40">© {new Date().getFullYear()} Masar Time — نظام الحضور والانصراف والموارد البشرية</p>
      </footer>
      <HelpWidget />
    </div>
  )
}
