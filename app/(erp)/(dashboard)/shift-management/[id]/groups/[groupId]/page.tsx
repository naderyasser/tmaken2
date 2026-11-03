'use client'

import { use } from 'react'
import { RotationalIntervalsPage } from '@/components/hr/rotational/intervals-page'

/** /shift-management/<id>/groups/<groupId> — the intervals editor for one
 *  rotational group (owner's spec §3): year/Ramadan blocks, each block's
 *  inline «وردية» times, + the (collapsed-by-default) members section. */
export default function Page({
  params: paramsPromise,
}: {
  params: Promise<{ id: string; groupId: string }>
}) {
  const params = use(paramsPromise)
  return (
    <RotationalIntervalsPage
      parentShift={decodeURIComponent(params.id)}
      groupId={decodeURIComponent(params.groupId)}
    />
  )
}
