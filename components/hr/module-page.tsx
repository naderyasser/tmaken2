'use client'

import { Construction } from 'lucide-react'
import { getModuleConfig } from '@/lib/hr-modules'
import { useCompanySafe } from '@/hooks/use-company'
import { GenericListPage } from '@/components/hr/generic-list-page'
import { GenericSettingsPage } from '@/components/hr/generic-settings-page'
import { CancelTransactionsPage } from '@/components/hr/cancel-transactions-page'

/**
 * Renders the page for one HR sidebar module id. Bespoke screens are matched
 * first, then the config-driven generic list/settings pages.
 */
export function ModulePage({ moduleId }: { moduleId: string }) {
  const { company } = useCompanySafe()

  if (moduleId === 'cancel-transactions') return <CancelTransactionsPage />

  const config = getModuleConfig(moduleId)
  if (!config) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3 text-muted-foreground p-8">
        <Construction className="h-10 w-10" />
        <p className="text-lg font-semibold">هذه الصفحة قيد التطوير</p>
      </div>
    )
  }

  if (config.kind === 'settings') {
    return (
      <GenericSettingsPage
        config={config}
        recordName={moduleId === 'company-data' ? (company ?? undefined) : undefined}
      />
    )
  }

  return <GenericListPage config={config} />
}
