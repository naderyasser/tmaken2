'use client'

// Ported from egarsys src/components/ui/company-header-logo.tsx.
// Shows the active company's logo next to a page <h1>; renders nothing when the
// tenant has no uploaded logo (the common case on the mirror), exactly like
// egarsys for a logo-less company.
import { useRentalsShell } from '@/components/rentals/egarsys/store'

export function CompanyHeaderLogo({ className = '' }: { className?: string }) {
  const { companyLogo, companyName } = useRentalsShell()

  if (!companyLogo) return null

  return (
    <img
      src={companyLogo}
      alt={companyName || 'الشركة'}
      className={`h-12 w-auto object-contain rounded-md shrink-0 ${className}`}
    />
  )
}
