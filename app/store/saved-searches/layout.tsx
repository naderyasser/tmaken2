import type { Metadata } from 'next'
import type { ReactNode } from 'react'

export const metadata: Metadata = {
  title: 'عمليات البحث المحفوظة | تمكين العقارية',
  description: 'افتح عمليات البحث المحفوظة بنفس الفلاتر وفعّل التنبيه عند نزول عقار مطابق.',
}

export default function SavedSearchesLayout({ children }: { children: ReactNode }) {
  return children
}
