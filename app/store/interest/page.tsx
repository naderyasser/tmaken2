import type { Metadata } from 'next'
import InterestForm from '@/components/store/interest-form'

export const metadata: Metadata = {
  title: 'سجّل اهتمامك — تمكين العقارية',
  description:
    'سجّل بياناتك واهتماماتك العقارية — شراء، استثمار، مزادات، مشاريع على الخارطة — وسنتواصل معك بما يناسبك. للأفراد والوسطاء والمطوّرين وكل شركاء السوق العقاري.',
  alternates: { canonical: '/interest' },
}

export default function InterestPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="aqar-display mb-2 text-3xl text-[var(--aqar-green-d)]">سجّل اهتمامك</h1>
      <p className="mb-6 leading-7 text-[var(--aqar-kohl)]/60">
        سواء كنت باحثاً عن سكن، مستثمراً، وسيطاً، مطوّراً، أو جهة تمويلية — سجّل اهتمامك
        وسنوافيك بالعروض والفرص والفعاليات التي تناسبك.
      </p>
      <InterestForm />
    </div>
  )
}
