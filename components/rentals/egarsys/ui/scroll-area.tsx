// Scoped re-export of the platform's v3 shadcn `scroll-area` primitive, so the
// ported egarsys tenants screen imports every UI primitive from one folder. The
// platform component already uses semantic tokens, which the .egarsys-scope
// design system remaps to egarsys's palette (same approach the other ported
// sections took by reusing @/components/ui/*). Card/Badge/Button are the
// exception — those are hand-adapted copies (egarsys-specific variants/metrics).
export * from '@/components/ui/scroll-area'
