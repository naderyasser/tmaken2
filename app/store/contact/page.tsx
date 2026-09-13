import type { Metadata } from 'next'
import { Phone, MapPin, Clock } from 'lucide-react'
import { store } from '@/lib/frappe-server'
import { SocialLinks } from '@/components/store/social-icons'
import LeadForm from '@/components/store/lead-form'

export const revalidate = 300

export const metadata: Metadata = {
  title: 'اتصل بنا — تمكين العقارية',
  description: 'تواصل مع فريق تمكين العقارية — هاتف، واتساب، وقنواتنا الاجتماعية، أو أرسل استفسارك عبر النموذج وسنرد عليك في وقتك المفضّل.',
  alternates: { canonical: '/contact' },
}

// fallback when the backend flag endpoint is unreachable (matches backend defaults)
const DEFAULT_CHANNELS: Record<string, string> = {
  phone: '+966553275000',
  whatsapp: 'https://wa.me/966553275000',
}

export default async function ContactPage() {
  const channels = (await store.contactChannels().catch(() => null)) || DEFAULT_CHANNELS
  const phoneDisplay = (channels.phone || '').replace('+966', '0')

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="aqar-display mb-2 text-3xl text-[var(--aqar-green-d)]">اتصل بنا</h1>
      <p className="mb-6 leading-7 text-[var(--aqar-kohl)]/60">
        فريق تمكين العقارية جاهز للإجابة على استفساراتك — عن الإعلانات، الطلبات، التسويق، أو أي خدمة أخرى.
      </p>

      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {channels.phone && (
          <a href={`tel:${channels.phone}`} className="aqar-card flex items-center gap-3 p-4 hover:border-[var(--aqar-green)]">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--aqar-green)]/10 text-[var(--aqar-green-d)]"><Phone className="h-5 w-5" /></span>
            <span>
              <span className="block text-sm font-bold text-[var(--aqar-kohl)]">اتصال مباشر</span>
              <span className="block text-sm text-[var(--aqar-kohl)]/60" dir="ltr">{phoneDisplay}</span>
            </span>
          </a>
        )}
        <div className="aqar-card flex items-center gap-3 p-4">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--aqar-green)]/10 text-[var(--aqar-green-d)]"><Clock className="h-5 w-5" /></span>
          <span>
            <span className="block text-sm font-bold text-[var(--aqar-kohl)]">أوقات التواصل</span>
            <span className="block text-sm text-[var(--aqar-kohl)]/60">يومياً ٧ صباحاً – ١٠ مساءً</span>
          </span>
        </div>
      </div>

      {/* branded social strip */}
      <div className="mb-8 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-[var(--aqar-green)] p-4 text-white">
        <p className="text-sm font-bold">تابعنا وتواصل معنا عبر قنواتنا:</p>
        <SocialLinks channels={channels} />
      </div>

      <div className="aqar-card p-5">
        <h2 className="aqar-section-title mb-4 text-lg">أرسل استفسارك</h2>
        <LeadForm
          topic="Other"
          requireName
          showName
          showMessage
          nameLabel="الاسم"
          namePlaceholder="اسمك الكامل"
          messageLabel="رسالتك"
          messagePlaceholder="اكتب استفسارك أو ملاحظتك…"
          submitLabel="إرسال"
          successText="استلمنا رسالتك وسنرد عليك في وقتك المفضّل. شكراً لتواصلك."
        />
      </div>

      <p className="mt-6 flex items-center gap-1.5 text-sm text-[var(--aqar-kohl)]/55">
        <MapPin className="h-4 w-4" />الرياض، المملكة العربية السعودية
      </p>
    </div>
  )
}
