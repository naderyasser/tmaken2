'use client'

import { useBrand } from '@/hooks/use-brand'

/**
 * Fetches the tenant brand once per page load and renders nothing.
 *
 * Mounted in the ERP layout so that `getBrandSync()` is populated on EVERY
 * back-office route, not only the ones whose chrome happens to call `useBrand()`.
 * The print engines that build a document synchronously (cashier X-report and
 * shift report, egarsys contracts/statements) read the cache rather than
 * awaiting a fetch, so without this a tenant's first print from, say, the
 * cashier could go out unbranded.
 */
export function BrandWarmup() {
    useBrand()
    return null
}
