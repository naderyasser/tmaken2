// Scoped re-export of the platform's v3 shadcn `tooltip` primitive, so the ported
// egarsys contracts screen imports every UI primitive from one folder. The
// platform component already uses semantic tokens, which the .egarsys-scope
// design system remaps to egarsys's palette (same approach the ported dashboard
// took by reusing @/components/ui/table). Card/Badge/Button are the exception —
// those are hand-adapted copies (they carry egarsys-specific variants/metrics).
export * from '@/components/ui/tooltip'
