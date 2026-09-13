import type { Metadata } from 'next'
import { Megaphone, Users, Camera, LineChart } from 'lucide-react'
import MarketingForm from '@/components/store/marketing-form'

export const metadata: Metadata = {
  title: 'التسويق العقاري — تمكين العقارية',
  description:
    'سجّل مشروعك العقاري وابدأ بالوصول لآلاف الباحثين والمستثمرين — تسويق موثّق وفق نظام الهيئة العامة للعقار، من العرض إلى البيع بأقصر الطرق.',
  alternates: { canonical: '/marketing' },
}

const PERKS = [
  { icon: Users, title: 'وصول أوسع', text: 'آلاف الباحثين والمستثمرين يتصفّحون المنصة — مشروعك يظهر لهم مباشرة.' },
  { icon: Camera, title: 'عرض احترافي', text: 'محتوى تسويقي منظّم وموثّق برخصة إعلانية وفق نظام الهيئة العامة للعقار.' },
  { icon: LineChart, title: 'من العرض إلى البيع', text: 'متابعة الطلبات والاهتمامات وربطها بمشروعك حتى إتمام الصفقة.' },
]

export default function MarketingPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="aqar-display mb-2 flex items-center gap-2 text-3xl text-[var(--aqar-green-d)]"><Megaphone className="h-7 w-7" />التسويق العقاري</h1>
      <p className="mb-6 leading-7 text-[var(--aqar-kohl)]/60">
        سجّل مشروعك الآن وابدأ بالوصول لآلاف المهتمين — لننقلك من العرض إلى البيع بأقصر الطرق.
      </p>

      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {PERKS.map((p) => (
          <div key={p.title} className="aqar-card p-4">
            <span className="mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--aqar-green)]/10 text-[var(--aqar-green-d)]"><p.icon className="h-5 w-5" /></span>
            <h2 className="mb-1 text-sm font-bold text-[var(--aqar-kohl)]">{p.title}</h2>
            <p className="text-xs leading-5 text-[var(--aqar-kohl)]/60">{p.text}</p>
          </div>
        ))}
      </div>

      <MarketingForm />
    </div>
  )
}
