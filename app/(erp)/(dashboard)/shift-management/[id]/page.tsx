'use client'

import { use } from 'react'
import { ShiftEditorPage } from '@/components/hr/shift-editor-page'

/** /shift-management/<id> — the Apex full-page shift editor, edit mode. */
export default function Page({ params: paramsPromise }: { params: Promise<{ id: string }> }) {
  const params = use(paramsPromise)
  return <ShiftEditorPage shiftId={decodeURIComponent(params.id)} />
}
