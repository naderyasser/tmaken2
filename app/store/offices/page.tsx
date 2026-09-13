import type { Metadata } from 'next'
import { Building2 } from 'lucide-react'
import { store } from '@/lib/frappe-server'
import OfficesGrid from '@/components/store/offices-grid'

export const revalidate = 120

export const metadata: Metadata = {
  title: 'مكاتب وشركات العقار | تمكين العقارية',
  description: 'دليل المكاتب والشركات العقارية الموثّقة على تمكين العقارية — تصفّح حسب المدينة وعدد الإعلانات.',
}

export default async function OfficesPage() {
  const offices = (await store.offices()) || []
  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="aqar-display flex items-center gap-2 text-2xl text-[var(--aqar-green-d)]">
        <Building2 className="h-6 w-6 text-[var(--aqar-green)]" />مكاتب وشركات العقار
      </h1>
      <p className="mb-6 mt-1 text-sm text-[var(--aqar-kohl)]/60">المكاتب والمعلنون الموثّقون مرتّبون حسب عدد الإعلانات النشطة.</p>
      <OfficesGrid offices={offices as any} />
    </div>
  )
}
