import type { ReactNode } from 'react'
import { AccountingLayoutShell } from '@/components/accounting/accounting-layout-shell'

export default function DashboardAccountingLayout({ children }: { children: ReactNode }) {
    return <AccountingLayoutShell>{children}</AccountingLayoutShell>
}