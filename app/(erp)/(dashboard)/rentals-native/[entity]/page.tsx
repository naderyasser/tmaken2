'use client'

import { use } from 'react'
import { notFound } from 'next/navigation'
import { entityByKey } from '@/lib/rentals/config'
import { RentalsList } from '@/components/rentals/generic'

export default function RentalsEntityList({ params }: { params: Promise<{ entity: string }> }) {
    const { entity } = use(params)
    const cfg = entityByKey(entity)
    if (!cfg) notFound()
    return <RentalsList entity={cfg} />
}
