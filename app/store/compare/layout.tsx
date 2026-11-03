import type { Metadata } from 'next'
import type { ReactNode } from 'react'

export const metadata: Metadata = {
  title: 'مقارنة العقارات | تمكين العقارية',
  description: 'قارن بين العقارات جنباً إلى جنب — السعر والمساحة والغرف وحالة الترخيص.',
}

export default function CompareLayout({ children }: { children: ReactNode }) {
  return children
}
