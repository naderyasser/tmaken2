'use client'

/**
 * F3 — Discipline hub. Wraps the NEW Violations Register and the EXISTING
 * DisciplinaryManagement board (delay-matrix + appeals) under one pill switch.
 * Nothing in the legacy board is removed.
 */

import { useState } from 'react'
import { useI18n } from '@/lib/i18n'
import { SegmentedControl } from '@/components/shared'
import { ViolationsRegister } from './violations-register'
import { DisciplinaryManagement } from './disciplinary-management'

export function DisciplineHub() {
  const { isRTL } = useI18n()
  const tx = (en: string, ar: string) => (isRTL ? ar : en)
  const [mode, setMode] = useState('register')

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="px-6 pt-6 md:px-8">
        <SegmentedControl
          options={[
            { id: 'register', label: tx('Violations Register', 'سجل المخالفات') },
            { id: 'board', label: tx('Discipline & Appeals', 'الجزاءات والتظلّمات') },
          ]}
          value={mode}
          onChange={setMode}
        />
      </div>
      {mode === 'register' ? (
        <div className="mx-auto max-w-[1100px] p-6 md:p-8">
          <ViolationsRegister />
        </div>
      ) : (
        <DisciplinaryManagement />
      )}
    </div>
  )
}
