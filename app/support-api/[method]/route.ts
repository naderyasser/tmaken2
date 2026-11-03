import { NextRequest, NextResponse } from 'next/server'

import { storeCall, type StoreMethod } from '@/lib/store-api'

/**
 * «تحتاج مساعدة؟» widget → HR store (live chat + call-back). Unlike
 * /subscribe/api this works on every host: the public site AND each client's
 * HR system. From inside a client's system the chat/call is tagged with the
 * client's site (nginx's X-Frappe-Site-Name, not anything the browser says)
 * and the signed-in user, so the team knows who is asking.
 */
export const dynamic = 'force-dynamic'

const METHODS = ['support_options', 'request_call', 'chat_send', 'chat_poll', 'team_status', 'chat_typing']

export async function POST(req: NextRequest, { params }: { params: Promise<{ method: string }> }) {
  const { method } = await params
  if (method === 'client_error') {
    // browser crash reports from the help widget → this unit's journal (journalctl -u tamken3-frontend | grep client-error)
    const raw = (await req.text().catch(() => '')).slice(0, 5000)
    console.error('[client-error]', req.headers.get('x-frappe-site-name') || '', raw.replace(/\s+/g, ' '))
    return NextResponse.json({ ok: true })
  }
  if (!METHODS.includes(method)) return NextResponse.json({ error: 'not found' }, { status: 404 })
  // Masar HR edition runs on the staging bench: the support inbox (fc.local) is not reachable from
  // here and must stay that way — report «team offline» so the widget offers phone/WhatsApp instead.
  if (process.env.MASAR_SUPPORT_OFFLINE === '1' && (method === 'team_status' || method === 'chat_poll')) {
    return NextResponse.json({ data: { team_online: false, messages: [] } })
  }
  if (process.env.MASAR_SUPPORT_OFFLINE === '1') {
    return NextResponse.json({ error: 'المحادثة المباشرة غير متاحة الآن — تواصل معنا عبر واتساب أو الاتصال' }, { status: 503 })
  }
  const body = await req.json().catch(() => ({}))
  const args: Record<string, unknown> = body && typeof body === 'object' ? { ...body } : {}
  delete args.origin
  if (args.inApp && (method === 'chat_send' || method === 'request_call')) {
    const site = req.headers.get('x-frappe-site-name') || ''
    const user = decodeURIComponent(req.cookies.get('user_id')?.value || '')
    if (site && user && user !== 'Guest') args.origin = { site, user }
  }
  delete args.inApp
  const ip = (req.headers.get('x-forwarded-for') || '').split(',').pop()?.trim() || undefined
  const r = await storeCall(method as StoreMethod, args, ip)
  return r.ok ? NextResponse.json({ data: r.data }) : NextResponse.json({ error: r.error }, { status: r.status })
}
