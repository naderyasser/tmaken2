import type { Metadata } from 'next'
import RequestPropertyForm from '@/components/store/request-property-form'

export const metadata: Metadata = {
  title: 'اطلب عقارك — تمكين العقارية',
  description:
    'ما لقيت عقارك؟ سجّل طلبك: المدينة والأحياء المفضلة، المساحة والميزانية، كاش أو تمويل — وفريقنا يبحث لك ويتواصل معك فور توفّر المناسب.',
  alternates: { canonical: '/request-property' },
}

export default function RequestPropertyPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="aqar-display mb-2 text-3xl text-[var(--aqar-green-d)]">اطلب عقارك</h1>
      <p className="mb-6 leading-7 text-[var(--aqar-kohl)]/60">
        حدّد مواصفات العقار اللي تبحث عنه — النوع، الأحياء، المساحة، والميزانية — ودعنا نبحث لك.
        الخدمة متاحة للباحثين عن عقار وللوسطاء المرخّصين (بعقد وساطة).
      </p>
      <RequestPropertyForm />
    </div>
  )
}
