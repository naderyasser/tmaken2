import type { Metadata, Viewport } from 'next'

import { MobileShell } from '@/components/m/mobile-shell'

export const metadata: Metadata = {
  title: 'Masar Time — بصمة الجوال',
  description: 'تسجيل الحضور والانصراف من الجوال',
  manifest: '/m/manifest.webmanifest',
  icons: {
    icon: '/m/icon-192.png',
    apple: '/m/apple-touch-icon.png',
  },
  appleWebApp: { capable: true, title: 'Masar Time', statusBarStyle: 'black-translucent' },
  robots: { index: false, follow: false },
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
