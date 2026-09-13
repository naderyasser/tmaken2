import Link from 'next/link'
import {
  ShieldCheck, Building2, LayoutGrid, BadgeCheck, Scale, BellRing, Map, QrCode,
  Search, MessageCircle, Handshake,
} from 'lucide-react'
import { store } from '@/lib/frappe-server'
import StoreListingCard from '@/components/store/listing-card'
import SearchAutocomplete from '@/components/store/search-autocomplete'
import SubscriptionCheck from '@/components/store/subscription-check'
import type { ListingSearchResult } from '@/lib/real-estate-api'

export const revalidate = 60

// "لماذا تختار تمكين العقارية؟" — grounded in real platform features (several are linkable)
const WHY_US = [
  { icon: LayoutGrid, title: 'عقارات متنوعة', text: 'فلل، شقق، أراضٍ، عمائر، استراحات ومزارع — في مكان واحد.', href: '/search' },
  { icon: BadgeCheck, title: 'معلنون موثّقون', text: 'وسطاء ومكاتب برخصة فال من الهيئة العامة للعقار.', href: '/offices' },
  { icon: Map, title: 'بحث على الخريطة', text: 'حدّد الحي وشاهد الأسعار مباشرة على الخريطة.', href: '/search' },
  { icon: Scale, title: 'مقارنة ذكية', text: 'قارن بين العقارات جنباً إلى جنب واختر الأنسب.', href: '/compare' },
  { icon: BellRing, title: 'تنبيهات فورية', text: 'احفظ بحثك ويصلك الجديد فور نزوله.', href: '/saved-searches' },
  { icon: QrCode, title: 'موثوقية', text: 'كل إعلان برقم ترخيص ورمز تحقق وفق نظام الهيئة.', href: '/terms' },
]

const HOW_IT_WORKS = [
  { icon: Search, step: '١', title: 'ابحث أو سجّل طلبك', text: 'تصفّح العروض على الخريطة، أو أرسل طلب عقارك وسجّل اهتمامك.' },
  { icon: MessageCircle, step: '٢', title: 'تواصل موثّق', text: 'كلمة مع المعلن مباشرة، أو يتواصل معك فريقنا لفهم احتياجك بدقة.' },
  { icon: Handshake, step: '٣', title: 'أتمم صفقتك بأمان', text: 'إعلانات مرخّصة وعقود منظّمة تساعدك حتى إتمام الصفقة.' },
]

export default async function StoreHome() {
  const [recent, categories, regionCounts] = await Promise.all([
    store.search({ sort: 'newest', limit: 12 }),
    store.categories(),
    store.regionCounts(),
  ])
  const listings: ListingSearchResult[] = (recent?.results as any) || []
  const cats = (categories || []).filter((c: any) => !c.is_group)
  const topRegions = (regionCounts || []).slice(0, 12)

  return (
    <>
      {/* Hero */}
      <section className="aqar-hero">
        <div className="mx-auto max-w-6xl px-4 py-14 text-center">
          <h1 className="aqar-display text-4xl text-[var(--aqar-green-d)] sm:text-5xl">سوقك العقاري الموثّق</h1>
          <form action="/search" className="mx-auto mt-7 flex max-w-xl items-center gap-2">
            <SearchAutocomplete
              placeholder="ابحث عن حي، مدينة، أو نوع العقار…"
              inputClassName="w-full rounded-full border border-[var(--aqar-sand-2)] bg-[var(--aqar-surface)] py-3 ps-11 pe-4 text-[var(--aqar-kohl)] outline-none focus:border-[var(--aqar-green)]"
            />
            <button className="aqar-btn">بحث</button>
          </form>
          {/* Category quick chips */}
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            {cats.slice(0, 10).map((c: any) => (
              <Link key={c.name} href={`/search?category=${encodeURIComponent(c.name)}`} className="aqar-chip">{c.category_name_ar}</Link>
            ))}
          </div>
          <Link href="/offices" className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-[var(--aqar-green)] hover:underline">
            <Building2 className="h-4 w-4" />تصفّح مكاتب وشركات العقار
          </Link>
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-4 py-10">
        {/* Recent / featured listings */}
        <div className="mb-4 flex items-center justify-between">
          <h2 className="aqar-section-title">أحدث العروض</h2>
          <Link href="/search" className="text-sm font-medium text-[var(--aqar-green)] hover:underline">عرض الكل</Link>
        </div>
        {listings.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[var(--aqar-sand-2)] p-12 text-center text-[var(--aqar-kohl)]/50">لا توجد عروض منشورة بعد</div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {listings.map((l) => <StoreListingCard key={l.name} l={l} />)}
          </div>
        )}

        {/* City quick links */}
        {topRegions.length > 0 && (
          <div className="mt-12">
            <div className="aqar-sadu-divider mb-8" aria-hidden />
            <h2 className="aqar-section-title mb-4">تصفّح حسب المنطقة</h2>
            <div className="flex flex-wrap gap-2">
              {topRegions.map((r: any) => (
                <Link key={r.name} href={`/search?region=${encodeURIComponent(r.name)}`} className="aqar-chip">
                  {r.region_name_ar}<span className="aqar-chip-count">· {r.count}</span>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Demand capture — «ما لقيت طلبك؟» */}
        <div className="mt-12 flex flex-col items-start gap-4 rounded-3xl bg-[var(--aqar-green)] p-6 text-white sm:flex-row sm:items-center sm:justify-between sm:p-8">
          <div>
            <h2 className="aqar-display text-2xl">ما لقيت طلبك؟ خلّنا ندوّر لك</h2>
            <p className="mt-1 text-sm leading-6 text-white/75">سجّل مواصفات العقار اللي تبيه — الأحياء، المساحة، الميزانية — وفريقنا يبحث ويتواصل معك.</p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <Link href="/request-property" className="rounded-full bg-white px-5 py-2.5 text-sm font-bold text-[var(--aqar-green-d)] hover:bg-white/90">اطلب عقارك</Link>
            <Link href="/interest" className="rounded-full border border-white/40 px-5 py-2.5 text-sm font-bold text-white hover:bg-white/10">سجّل اهتمامك</Link>
          </div>
        </div>

        {/* How it works */}
        <div className="mt-12">
          <div className="aqar-sadu-divider mb-8" aria-hidden />
          <h2 className="aqar-section-title mb-5">كيف نعمل؟</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {HOW_IT_WORKS.map((s) => (
              <div key={s.title} className="aqar-card relative overflow-hidden p-5">
                <span className="absolute -top-2 select-none text-6xl font-black text-[var(--aqar-sand-2)]" style={{ insetInlineEnd: '0.75rem' }} aria-hidden>{s.step}</span>
                <span className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--aqar-green)]/10 text-[var(--aqar-green-d)]"><s.icon className="h-5 w-5" /></span>
                <h3 className="mb-1 font-bold text-[var(--aqar-kohl)]">{s.title}</h3>
                <p className="text-sm leading-6 text-[var(--aqar-kohl)]/60">{s.text}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Why choose us */}
        <div className="mt-12">
          <h2 className="aqar-section-title mb-5">لماذا تختار تمكين العقارية؟</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {WHY_US.map((b) => (
              <Link key={b.title} href={b.href} className="aqar-card group p-4 transition-colors hover:border-[var(--aqar-green)]">
                <span className="mb-2.5 flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--aqar-gold)]/12 text-[var(--aqar-gold)] transition-colors group-hover:bg-[var(--aqar-green)]/10 group-hover:text-[var(--aqar-green-d)]"><b.icon className="h-5 w-5" /></span>
                <h3 className="mb-1 text-sm font-bold text-[var(--aqar-kohl)]">{b.title}</h3>
                <p className="text-xs leading-5 text-[var(--aqar-kohl)]/60">{b.text}</p>
              </Link>
            ))}
          </div>
        </div>

        {/* Membership status checker (paid broker tier groundwork) */}
        <div className="mt-12">
          <SubscriptionCheck />
        </div>

        {/* Trust strip */}
        <div className="aqar-seal mt-12 flex items-center gap-3 p-5">
          <ShieldCheck className="h-7 w-7 text-[var(--aqar-green)]" />
          <p className="text-sm text-[var(--aqar-kohl)]/80">كل إعلان يحمل رقم ترخيص إعلاني صادر عن الهيئة العامة للعقار، مع بيانات العقار حسب الرخصة ورمز التحقق (QR).</p>
        </div>
      </div>
    </>
  )
}
