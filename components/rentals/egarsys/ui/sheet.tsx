// Scoped re-export of the platform's v3 shadcn `sheet` primitive, so the ported
// egarsys properties screen (the unit-detail side sheet) imports every UI
// primitive from one folder. The platform component already uses semantic
// tokens, which the .egarsys-scope design system remaps to egarsys's palette
// (same approach the ported table/dialog shims took).
export * from '@/components/ui/sheet'
