'use client'

import nextDynamic from 'next/dynamic'

const Map = nextDynamic(() => import('@/components/real-estate/listing-map'), { ssr: false })

/** Client wrapper so the Leaflet map (ssr:false) can be used inside the server-rendered
 * storefront listing page. */
export default function ListingMapClient(props: { lat?: number; lng?: number; obscured?: boolean }) {
  return <Map {...props} />
}
