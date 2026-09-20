'use client'

import { use } from 'react'
import { RotationalShiftEditorPage } from '@/components/hr/rotational-shift-editor-page'

/** /rotational-shifts/<id> — the Apex full-page rotational shift group editor, edit mode. */
export default function Page({ params: paramsPromise }: { params: Promise<{ id: string }> }) {
  const params = use(paramsPromise)
  return <RotationalShiftEditorPage groupId={decodeURIComponent(params.id)} />
}
