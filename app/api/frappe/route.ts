import { NextRequest, NextResponse } from 'next/server'

const MAX_REQUEST_SIZE = 10 * 1024 * 1024

const ALLOWED_PATH_PREFIXES = [
  '/api/method/',
  '/api/resource/',
  '/api/frappe/',
]

const BLOCKED_API_METHODS = [
  'frappe.client.delete',
  'frappe.client.bulk_update',
]

function isPathAllowed(path: string): boolean {
  if (!path.startsWith('/')) return false
  if (path.includes('..')) return false
  if (path.startsWith('//')) return false

  const isPrefixAllowed = ALLOWED_PATH_PREFIXES.some(prefix => path.startsWith(prefix))
  if (!isPrefixAllowed) return false

  if (path.startsWith('/api/method/')) {
    const methodName = path.slice('/api/method/'.length).split(/[/?#]/)[0]
    if (BLOCKED_API_METHODS.includes(methodName)) return false
  }

  return true
}

function getCorsHeaders(_request: NextRequest): HeadersInit {
  // Same-origin proxy: deliberately NO Access-Control-Allow-Origin / Allow-Credentials.
  // Reflecting the Origin header with credentials (the previous behavior) lets any
  // website read session-authenticated responses — the classic CORS hole. Same-origin
  // callers never need CORS; cross-origin reads stay blocked by the browser default.
  return {
    'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,PATCH,OPTIONS',
    'Access-Control-Allow-Headers': 'X-Requested-With, Content-Type, Authorization, X-Frappe-CSRF-Token',
  }
}

export async function GET(request: NextRequest) {
  return handleProxyRequest(request)
}

export async function POST(request: NextRequest) {
  return handleProxyRequest(request)
}

export async function PUT(request: NextRequest) {
  return handleProxyRequest(request)
}

export async function DELETE(request: NextRequest) {
  return handleProxyRequest(request)
}

export async function PATCH(request: NextRequest) {
  return handleProxyRequest(request)
}

async function handleProxyRequest(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const path = searchParams.get('path')

    if (!path) {
      return NextResponse.json(
        { error: 'Missing "path" query parameter' },
        { status: 400 }
      )
    }

    if (!isPathAllowed(path)) {
      console.warn('[API Proxy] Blocked request to path:', path)
      return NextResponse.json(
        { error: 'Access denied: path not allowed', exc_type: 'PermissionError' },
        { status: 403 }
      )
    }

    const protocol = process.env.NODE_ENV === 'production' ? 'https' : 'http'
    const host = request.headers.get('host') || ''
    const FRAPPE_URL = process.env.NEXT_PUBLIC_FRAPPE_URL || `${protocol}://${host}`
    const backendUrl = `${FRAPPE_URL}${path}`

    let body: BodyInit | undefined
    const contentType = request.headers.get('content-type')
    if (contentType && request.method !== 'GET' && request.method !== 'HEAD') {
      body = await request.arrayBuffer()
      if (body && body.byteLength > MAX_REQUEST_SIZE) {
        return NextResponse.json(
          { error: 'Request body too large', exc_type: 'RequestEntityTooLarge' },
          { status: 413 }
        )
      }
    }

    const response = await fetch(backendUrl, {
      method: request.method,
      headers: {
        'Content-Type': contentType || 'application/json',
        'Accept': request.headers.get('accept') || 'application/json',
        'Cookie': request.headers.get('cookie') || '',
        'X-Forwarded-For': request.headers.get('x-forwarded-for') || '',
        'X-Forwarded-Proto': request.headers.get('x-forwarded-proto') || protocol,
        'User-Agent': request.headers.get('user-agent') || '',
        'Authorization': request.headers.get('authorization') || '',
        'X-Frappe-CSRF-Token': request.headers.get('x-frappe-csrf-token') || '',
      },
      body,
      credentials: 'include',
    })

    const responseData = await response.text()
    const contentTypeHeader = response.headers.get('content-type') || 'application/json'

    const corsHeaders = getCorsHeaders(request)
    const resHeaders = new Headers({
      'Content-Type': contentTypeHeader,
      ...corsHeaders,
    })

    // Forward Content-Disposition for file downloads
    const contentDisposition = response.headers.get('content-disposition')
    if (contentDisposition) {
      resHeaders.set('Content-Disposition', contentDisposition)
    }

    // Forward Set-Cookie headers from backend (critical for login)
    // In dev (localhost), strip Domain= attribute so the browser accepts cookies
    // from the prod backend (qarawi.base.meena.sa) on localhost:3000
    const setCookies = response.headers.getSetCookie?.()
    if (setCookies) {
      const isDev = process.env.NODE_ENV !== 'production'
      for (const cookie of setCookies) {
        let sanitized = cookie
        if (isDev) {
          // Remove Domain= attribute (prevents cookie being scoped to prod domain)
          sanitized = sanitized.replace(/;\s*Domain=[^;]*/gi, '')
          // Remove Secure flag so cookies work on http://localhost
          sanitized = sanitized.replace(/;\s*Secure/gi, '')
          // Change SameSite=Strict/None → Lax so cross-origin rewrite still works
          sanitized = sanitized.replace(/;\s*SameSite=(Strict|None)/gi, '; SameSite=Lax')
        }
        resHeaders.append('Set-Cookie', sanitized)
      }
    }

    return new NextResponse(responseData, {
      status: response.status,
      statusText: response.statusText,
      headers: resHeaders,
    })
  } catch (error) {
    console.error('[API Proxy] Error:', error)
    return NextResponse.json(
      { error: 'Failed to proxy request to backend', exc_type: 'ProxyError' },
      { status: 500 }
    )
  }
}

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: getCorsHeaders(request),
  })
}
