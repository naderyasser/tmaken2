'use client'

import { useState } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { PunchImport } from '@/components/attendance/punch-import'
import { PunchSheet } from '@/components/attendance/punch-sheet'
import { useI18n } from '@/lib/i18n'

export default function PunchSheetPage() {
  const { t } = useI18n()
  const [tab, setTab] = useState('sheet')
  // Bumped after an import so the sheet re-reads instead of showing the month
  // as it looked before the upload.
  const [refreshKey, setRefreshKey] = useState(0)
  const [importedMonth, setImportedMonth] = useState<string | undefined>()

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="mb-4">
            <TabsTrigger value="sheet">{t('psh.tabSheet')}</TabsTrigger>
            <TabsTrigger value="import">{t('psh.tabImport')}</TabsTrigger>
          </TabsList>
          <TabsContent value="sheet">
            <PunchSheet refreshKey={refreshKey} jumpToMonth={importedMonth} />
          </TabsContent>
          <TabsContent value="import">
            <PunchImport
              onImported={month => {
                // Point the sheet at the month that just landed, but stay put:
                // the import summary lists who could NOT be matched, and jumping
                // tabs would whisk that away before it has been read.
                setImportedMonth(month)
                setRefreshKey(k => k + 1)
              }}
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
