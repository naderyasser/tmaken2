import { getTenantBrand } from '@/lib/tenant-brand'

/** «/m» PWA manifest, per client: name and icons follow the site's tenant_brand. */
export const dynamic = 'force-dynamic'

export async function GET() {
  const b = await getTenantBrand()
  const icon = (file: string, sizes: string, purpose: string) => ({ src: `${b.pwaIconBase}/${file}`, sizes, type: 'image/png', purpose })
  const manifest = {
    id: '/m',
    name: `${b.name} — بصمة الجوال`,
    short_name: b.name,
    description: 'تسجيل الحضور والانصراف من الجوال ضمن نطاق موقع العمل',
    start_url: '/m',
    scope: '/m',
    display: 'standalone',
    orientation: 'portrait',
    dir: 'rtl',
    lang: 'ar',
    theme_color: b.themeColor,
    background_color: '#f3f6f6',
    categories: ['business', 'productivity'],
    icons: [
      icon('icon-192.png', '192x192', 'any'),
      icon('icon-512.png', '512x512', 'any'),
      icon('maskable-192.png', '192x192', 'maskable'),
      icon('maskable-512.png', '512x512', 'maskable'),
    ],
  }
  return new Response(JSON.stringify(manifest), {
    headers: { 'Content-Type': 'application/manifest+json', 'Cache-Control': 'no-store' },
  })
}
