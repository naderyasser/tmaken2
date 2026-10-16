import { NextRequest, NextResponse } from 'next/server'

import { COMPANY_COOKIE, isCompanyCode } from '@/lib/tenant-brand'

/**
 * Shared entry (masar.base.meena.sa) — pick the company the browser talks to.
 * nginx maps the `mt_company` cookie to the Frappe site (only codes listed in
 * /etc/nginx/hr-companies.map; anything else falls back to the demo), so this
 * route only stores the choice and drops the previous company's session
 * cookies. POST {code} → JSON (sign-in forms); GET ?code=&next= → redirect
 * (links from the operator panel).
 */
export const dynamic = 'force-dynamic'

const SESSION_COOKIES = ['sid', 'system_user', 'user_id', 'full_name', 'user_image', 'user_lang']

function onEntry(req: NextRequest) {
  return req.headers.get('x-masar-entry') === '1'
}

function choose(res: NextResponse, code: string) {
  res.cookies.set(COMPANY_COOKIE, code, { path: '/', maxAge: 60 * 60 * 24 * 365, sameSite: 'lax', secure: true, httpOnly: true })
  for (const c of SESSION_COOKIES) res.cookies.set(c, '', { path: '/', maxAge: 0 })
  return res
}

export async function POST(req: NextRequest) {
  if (!onEntry(req)) return NextResponse.json({ ok: false }, { status: 404 })
  const { code } = await req.json().catch(() => ({ code: '' }))
  const c = String(code || '').trim().toLowerCase()
  if (!isCompanyCode(c)) return NextResponse.json({ ok: false, error: 'unknown_company' }, { status: 404 })
  return choose(NextResponse.json({ ok: true, code: c }), c)
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const c = (url.searchParams.get('code') || '').trim().toLowerCase()
  const next = url.searchParams.get('next') || '/login'
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host') || ''
  const base = `https://${host}`
  if (!onEntry(req) || !isCompanyCode(c)) return NextResponse.redirect(new URL('/login', base))
  return choose(NextResponse.redirect(new URL(next.startsWith('/') && !next.startsWith('//') ? next : '/login', base)), c)
}
