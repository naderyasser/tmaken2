import type { Metadata } from 'next'
import { Wallet, FileCheck2, Wrench, BarChart3 } from 'lucide-react'
import LeadForm from '@/components/store/lead-form'

export const metadata: Metadata = {
  title: 'إدارة الأملاك العقارية | تمكين العقارية',
  description: 'خدمة إدارة أملاك متكاملة: تحصيل الإيجارات، عقود موثّقة، صيانة وتشغيل، وتقارير دورية للملاك.',
}

const FEATURES = [
  { icon: Wallet, title: 'تحصيل الإيجارات', desc: 'متابعة الدفعات وتحصيلها في مواعيدها، مع تنبيهات آلية للملاك والمستأجرين.' },
  { icon: FileCheck2, title: 'عقود موثّقة', desc: 'إعداد وتوثيق عقود الإيجار وفق الأنظمة، وحفظ سجلٍّ كاملٍ لكل وحدة.' },
  { icon: Wrench, title: 'الصيانة والتشغيل', desc: 'إدارة طلبات الصيانة والتعاقد مع مزوّدي الخدمة ومتابعة الإنجاز.' },
  { icon: BarChart3, title: 'تقارير دورية', desc: 'كشوفات دخل ومصروفات ومؤشّرات إشغال واضحة، تصلك دورياً.' },
]

export default function PropertyManagementPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:py-16">
      {/* Hero */}
      <div className="text-center">
        <div className="mb-4 flex justify-center">
          <span className="aqar-chip border-[var(--aqar-green)]/40 text-[var(--aqar-green-d)]">خدمة</span>
        </div>
        <h1 className="aqar-display text-3xl text-[var(--aqar-green-d)] sm:text-4xl">إدارة الأملاك العقارية</h1>
        <p className="mx-auto mt-4 max-w-2xl leading-8 text-[var(--aqar-kohl)]/70">
          ندير عقاراتك نيابةً عنك — من تحصيل الإيجارات وتوثيق العقود إلى الصيانة والتقارير — لتحصل على عائدٍ مستقرٍّ
          وراحةِ بالٍ تامّة، على منظومةٍ متوافقةٍ مع نظام الهيئة العامة للعقار.
        </p>
      </div>

      {/* Value props */}
      <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {FEATURES.map((f) => (
          <div key={f.title} className="flex gap-4 rounded-2xl border border-[var(--aqar-border)] bg-[var(--aqar-surface)] p-5">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--aqar-green)]/10 text-[var(--aqar-green)]">
              <f.icon className="h-5 w-5" />
            </span>
            <div>
              <h3 className="font-semibold text-[var(--aqar-kohl)]">{f.title}</h3>
              <p className="mt-1 text-sm leading-7 text-[var(--aqar-kohl)]/65">{f.desc}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Lead form */}
      <div className="mx-auto mt-12 max-w-2xl rounded-2xl border border-[var(--aqar-border)] bg-[var(--aqar-surface)] p-6 shadow-sm sm:p-8">
        <h2 className="aqar-section-title text-xl">اطلب الخدمة</h2>
        <p className="mt-1.5 text-sm text-[var(--aqar-kohl)]/65">اترك بياناتك وسيتواصل معك فريقنا لمناقشة احتياج إدارة عقارك.</p>
        <div className="mt-5">
          <LeadForm topic="Property Management" submitLabel="أرسل الطلب" />
        </div>
      </div>
    </div>
  )
}
