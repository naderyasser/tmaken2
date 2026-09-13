'use client'

import { use } from 'react'
import { notFound } from 'next/navigation'
import { entityByKey } from '@/lib/rentals/config'
import { RentalsEditor } from '@/components/rentals/generic'

export default function RentalsEntityDetail({ params }: { params: Promise<{ entity: string; id: string }> }) {
    const { entity, id } = use(params)
    const cfg = entityByKey(entity)
    if (!cfg) notFound()
    return <RentalsEditor entity={cfg} docName={decodeURIComponent(id)} />
}
