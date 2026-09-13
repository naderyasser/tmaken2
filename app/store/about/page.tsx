import type { Metadata } from 'next'
import Link from 'next/link'
import {
  ShieldCheck, Map, TrendingUp, Building2, FileText, Gavel, Search, Handshake, Sparkles, Phone,
} from 'lucide-react'

export const metadata: Metadata = {
  title: 'من نحن — تمكين العقارية',
  description:
    'تمكين العقارية منصة عقارية سعودية موثّقة وفق نظام الهيئة العامة للعقار — بحث بالخريطة، إعلانات مرخّصة برخصة فال، تحليلات استثمارية، إدارة أملاك، مزادات، وإدارة عقود.',
  alternates: { canonical: '/about' },
}

const PILLARS = [
  { icon: ShieldCheck, title: 'الالتزام النظامي أولاً', text: 'كل إعلان يحمل رقم ترخيص إعلاني صادر من الهيئة العامة للعقار، مع بيانات العقار حسب الرخصة ورمز تحقق (QR). ووسطاؤنا يحملون رخصة فال.' },
  { icon: Map, title: 'بحث ذكي بالخريطة', text: 'ابحث وتصفّح العروض على الخريطة مباشرة، مع فلاتر دقيقة، تنبيهات للبحوث المحفوظة، وأداة مقارنة بين العقارات.' },
  { icon: TrendingUp, title: 'قرار مبني على بيانات', text: 'تحليلات استثمارية لكل عقار: سعر المتر، العائد الإجمالي والصافي، ومقارنة بمتوسّط السوق في الحي، مع حاسبة تمويل عقاري.' },
]

const SERVICES = [
  { icon: Search, title: 'البحث والتصفّح', text: 'خريطة تفاعلية، فلاتر، وبحوث محفوظة بتنبيهات.', href: '/search' },
  { icon: Building2, title: 'أضف إعلانك', text: 'نشر موثّق بخطوات، بشرط ترخيص إعلاني ساري.', href: '/post' },
  { icon: TrendingUp, title: 'الاستثمار العقاري', text: 'مؤشرات العائد ومتوسّطات الأحياء.', href: '/investment' },
  { icon: Building2, title: 'إدارة الأملاك', text: 'تحصيل الإيجار، توثيق العقود، والصيانة.', href: '/property-management' },
  { icon: FileText, title: 'إدارة العقود', text: 'عقود سكنية وتجارية وبيع ووساطة.', href: '/contracts' },
  { icon: Gavel, title: 'المزادات العقارية', text: 'خارطة طريق المزادات وشراكات المنظّمين.', href: '/auctions' },
  { icon: Search, title: 'اطلب عقارك', text: 'نبحث لك عن العقار المطابق لطلبك.', href: '/request-property' },
  { icon: Sparkles, title: 'سجّل اهتمامك', text: 'انضم لقائمتنا حسب صفتك واهتماماتك.', href: '/interest' },
]

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="aqar-display mb-2 text-3xl text-[var(--aqar-green-d)]">من نحن</h1>
      <p className="mb-8 leading-8 text-[var(--aqar-kohl)]/70">
        <b className="text-[var(--aqar-green-d)]">تمكين العقارية</b> منصة عقارية سعودية تجمع الباحثين والملاك
        والوسطاء والمطوّرين في مكان واحد موثوق. مهمّتنا أن نجعل التعامل العقاري أوضح وأأمن وأسرع — من العرض
        والبحث، إلى التحليل والتفاوض، حتى إتمام الصفقة — بما يتوافق مع نظام الهيئة العامة للعقار.
      </p>

      {/* pillars */}
      <div className="mb-10 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {PILLARS.map((p) => (
          <div key={p.title} className="aqar-card p-5">
            <span className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--aqar-green)]/10 text-[var(--aqar-green-d)]"><p.icon className="h-5 w-5" /></span>
            <h2 className="mb-1 font-bold text-[var(--aqar-kohl)]">{p.title}</h2>
            <p className="text-sm leading-6 text-[var(--aqar-kohl)]/60">{p.text}</p>
          </div>
        ))}
      </div>

      {/* compliance statement */}
      <section className="aqar-seal mb-10 flex items-start gap-3 p-5">
        <ShieldCheck className="mt-0.5 h-6 w-6 shrink-0 text-[var(--aqar-green)]" />
        <div>
          <h2 className="mb-1 font-bold text-[var(--aqar-green-d)]">موثوقية وامتثال</h2>
          <p className="text-sm leading-7 text-[var(--aqar-kohl)]/80">
            نلتزم بنظام الهيئة العامة للعقار: لا يُنشر أي إعلان عقاري دون رقم ترخيص إعلاني ساري المفعول،
            وتُراجع الإعلانات قبل نشرها. تظهر على كل إعلان بياناته حسب الرخصة (رقم الترخيص وتاريخه، الصك،
            المخطط، القطعة) مع رمز التحقق، وتوثيق المعلن عبر نفاذ ورخصة فال للوسطاء — لتتعامل بثقة.
          </p>
        </div>
      </section>

      {/* services */}
      <h2 className="aqar-section-title mb-5">خدماتنا</h2>
      <div className="mb-10 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {SERVICES.map((s) => (
          <Link key={s.href} href={s.href} className="aqar-card flex items-start gap-3 p-4 transition-colors hover:border-[var(--aqar-green)]">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--aqar-gold)]/12 text-[var(--aqar-gold)]"><s.icon className="h-5 w-5" /></span>
            <span>
              <span className="block text-sm font-bold text-[var(--aqar-kohl)]">{s.title}</span>
              <span className="block text-xs leading-5 text-[var(--aqar-kohl)]/60">{s.text}</span>
            </span>
          </Link>
        ))}
      </div>

      {/* contact CTA */}
      <div className="flex flex-col items-start gap-4 rounded-3xl bg-[var(--aqar-green)] p-6 text-white sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="aqar-display text-2xl">عندك سؤال أو فرصة عقارية؟</h2>
          <p className="mt-1 text-sm leading-6 text-white/75">فريقنا جاهز لمساعدتك — تواصل معنا في الوقت الذي يناسبك.</p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Link href="/contact" className="inline-flex items-center gap-1.5 rounded-full bg-white px-5 py-2.5 text-sm font-bold text-[var(--aqar-green-d)] hover:bg-white/90"><Phone className="h-4 w-4" />اتصل بنا</Link>
          <Link href="/interest" className="inline-flex items-center gap-1.5 rounded-full border border-white/40 px-5 py-2.5 text-sm font-bold text-white hover:bg-white/10"><Handshake className="h-4 w-4" />سجّل اهتمامك</Link>
        </div>
      </div>
    </div>
  )
}
