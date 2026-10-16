import { NextRequest, NextResponse } from 'next/server'

import { STORE_METHODS, storeCall, type StoreMethod } from '@/lib/store-api'

/** Browser → HR store proxy for the subscribe pages (whitelisted methods only). */
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest, { params }: { params: Promise<{ method: string }> }) {
  const { method } = await params
  if (!(STORE_METHODS as readonly string[]).includes(method)) return NextResponse.json({ error: 'not found' }, { status: 404 })
  const args = await req.json().catch(() => ({}))
  // the LAST hop is the one nginx appended (the earlier ones are whatever the client sent)
  const ip = (req.headers.get('x-forwarded-for') || '').split(',').pop()?.trim() || undefined
  const r = await storeCall(method as StoreMethod, args && typeof args === 'object' ? args : {}, ip)
  return r.ok ? NextResponse.json({ data: r.data }) : NextResponse.json({ error: r.error }, { status: r.status })
}
