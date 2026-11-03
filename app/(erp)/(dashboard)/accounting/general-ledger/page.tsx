import { Suspense } from 'react'
import { GeneralLedgerClient } from './general-ledger-client'

function LoadingFallback() {
    return <div className="min-h-screen bg-gray-50" />
}

export default async function GeneralLedgerPage({
    searchParams,
}: {
    searchParams?: Promise<{ account?: string | string[] }>
}) {
    const params = await searchParams
    const accountParam = Array.isArray(params?.account)
        ? params?.account[0] ?? ''
        : params?.account ?? ''

    return (
        <Suspense fallback={<LoadingFallback />}>
            <GeneralLedgerClient initialAccount={accountParam} />
        </Suspense>
    )
}
