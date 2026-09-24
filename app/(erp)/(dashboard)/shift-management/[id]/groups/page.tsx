'use client'

import { use } from 'react'
import { RotationalGroupsPage } from '@/components/hr/rotational/groups-page'

/** /shift-management/<id>/groups — «الدوام المتغير» groups list for ONE
 *  parent shift (owner's spec §1/§2). Replaces the old standalone
 *  /rotational-shifts list. */
export default function Page({ params: paramsPromise }: { params: Promise<{ id: string }> }) {
  const params = use(paramsPromise)
  return <RotationalGroupsPage parentShift={decodeURIComponent(params.id)} />
}
