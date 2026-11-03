'use client'

import { use } from 'react'
import { LocationGroupDetailsPage } from '@/components/hr/location-group-details-page'

/** /location-groups/<name> — Apex `hr/locations-group-details` (M6): per
 *  location group, on-site transactions (الاجازات/الاذونات/البصمات) with
 *  approve/reject, and the group's employee roster. */
export default function Page({ params: paramsPromise }: { params: Promise<{ name: string }> }) {
  const params = use(paramsPromise)
  return <LocationGroupDetailsPage group={decodeURIComponent(params.name)} />
}
