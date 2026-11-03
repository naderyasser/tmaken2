import Link from 'next/link'
import { Home, Search } from 'lucide-react'
import { BrandMark } from '@/components/store/brand-mark'

export default function StoreNotFound() {
  return (
    <div className="mx-auto flex max-w-xl flex-col items-center px-4 py-24 text-center">
      <BrandMark className="h-16 w-16 text-[var(--aqar-green)]/30" />
      <p className="aqar-display mt-6 text-5xl text-[var(--aqar-green-d)]">٤٠٤</p>
      <h1 className="aqar-section-title mt-2 text-xl">الصفحة غير موجودة</h1>
      <p className="mt-2 text-[var(--aqar-kohl)]/60">
        قد يكون الرابط غير صحيح، أو أن الإعلان/المدينة لم يعد متاحاً.
      </p>
      <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
        <Link href="/" className="aqar-btn"><Home className="h-4 w-4" />الرئيسية</Link>
        <Link href="/search" className="aqar-btn aqar-btn-outline"><Search className="h-4 w-4" />تصفّح العقارات</Link>
      </div>
    </div>
  )
}
