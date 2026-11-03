import type { Metadata } from 'next'
import { Handshake, Landmark, TrendingUp, ShieldCheck } from 'lucide-react'
import PartnershipForm from '@/components/store/partnership-form'

export const metadata: Metadata = {
  title: 'تحالفات عقارية — تمكين العقارية',
  description:
    'تملك أرضاً؟ نوصلك بمطوّرين ومستثمرين موثوقين لتحويل أرضك إلى مشروع عقاري نوعي — بالبيع أو الشراكة أو التطوير. قدّم طلبك وسيتواصل معك فريق التحالفات.',
  alternates: { canonical: '/partnership' },
}

const PILLARS = [
  { icon: Landmark, title: 'أرضك هي رأس المال', text: 'ندرس موقع أرضك وإمكاناتها التطويرية ونقترح النموذج الأنسب: بيع، شراكة، أو تطوير.' },
  { icon: Handshake, title: 'شبكة مطوّرين موثوقة', text: 'نوصلك بمطوّرين ومستثمرين مرخّصين بسجل أعمال واضح — ونختصر عليك المسافة.' },
  { icon: TrendingUp, title: 'قيمة أعلى لأرضك', text: 'المشروع النوعي يحقق عائداً أفضل من البيع المباشر في كثير من الحالات.' },
]

export default function PartnershipPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="aqar-display mb-2 text-3xl text-[var(--aqar-green-d)]">تحالفات عقارية</h1>
      <p className="mb-6 leading-7 text-[var(--aqar-kohl)]/60">
        لأننا نمتلك شبكة واسعة من المطوّرين العقاريين والمستثمرين الموثوقين، نختصر عليك المسافة:
        إذا كنت تملك أرضاً، نساعدك على تحويلها إلى مشروع عقاري نوعي.
      </p>

      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {PILLARS.map((p) => (
          <div key={p.title} className="aqar-card p-4">
            <span className="mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--aqar-green)]/10 text-[var(--aqar-green-d)]"><p.icon className="h-5 w-5" /></span>
            <h2 className="mb-1 text-sm font-bold text-[var(--aqar-kohl)]">{p.title}</h2>
            <p className="text-xs leading-5 text-[var(--aqar-kohl)]/60">{p.text}</p>
          </div>
        ))}
      </div>

      <PartnershipForm />

      <p className="aqar-seal mt-4 flex items-start gap-2 p-3 text-xs leading-6 text-[var(--aqar-kohl)]/75">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[var(--aqar-green)]" />
        بيانات أرضك سرية وتُعرض على الشركاء المحتملين فقط بعد موافقتك.
      </p>
    </div>
  )
}
