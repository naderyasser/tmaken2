import type { Metadata } from 'next'
import type { ReactNode } from 'react'

// Page-specific title (the page itself is a client component, so metadata lives in the route layout).
export const metadata: Metadata = {
  title: 'المفضلة | تمكين العقارية',
  description: 'العقارات التي حفظتها للرجوع إليها لاحقاً على منصة تمكين العقارية.',
}

export default function FavoritesLayout({ children }: { children: ReactNode }) {
  return children
}
