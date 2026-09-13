'use client'

// «أرشيف العقود» — the same ContractsSection rendered in `ended` mode: it lists
// ONLY ended contracts (terminated / moved_out / archived, or superseded by a successor
// contract), swaps the archive action for «استعادة إلى النشطة», and drops «إضافة عقد».
// All logic lives in contracts.tsx behind the `ended` prop — this is a thin wrapper so
// app-shell can dynamic-import it as its own section.

import ContractsSection from './contracts'

export default function EndedContractsSection() {
  return <ContractsSection ended />
}
