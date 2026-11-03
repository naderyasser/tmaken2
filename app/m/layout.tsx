import type { Metadata, Viewport } from 'next'

import { MobileShell } from '@/components/m/mobile-shell'
import { getTenantBrand } from '@/lib/tenant-brand'

export async function generateMetadata(): Promise<Metadata> {
  const brand = await getTenantBrand()
  return {
    title: `${brand.name} — بصمة الجوال`,
    description: 'تسجيل الحضور والانصراف من الجوال',
    manifest: '/m/manifest.webmanifest',
    icons: { icon: `${brand.pwaIconBase}/icon-192.png`, apple: brand.appleIcon },
    appleWebApp: { capable: true, title: brand.name, statusBarStyle: 'black-translucent' },
    robots: { index: false, follow: false },
  }
}

export const viewport: Viewport = {
  themeColor: '#1d4d56',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  viewportFit: 'cover',
}

export default function MobileLayout({ children }: { children: React.ReactNode }) {
  return <MobileShell>{children}</MobileShell>
}
