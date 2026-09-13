// Scoped re-export of the platform's v3 shadcn `skeleton` primitive, so the ported
// egarsys invoices screen imports every UI primitive from one folder. The platform
// component already uses semantic tokens, which the .egarsys-scope design system
// remaps to egarsys's palette (same approach the ported dashboard/contracts took).
export * from '@/components/ui/skeleton'
