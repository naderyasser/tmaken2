import { NextRequest, NextResponse } from 'next/server'

/**
 * Dedicated file upload proxy route.
 *
 * Forwards multipart/form-data uploads to the Frappe backend with all
 * cookies and CSRF headers intact.  This is more reliable than a
 * next.config rewrite because it explicitly handles cookie forwarding,
 * CSRF passthrough, and Set-Cookie propagation.
 */

function getFrappeUrl(request: NextRequest): string {
  const protocol = process.env.NODE_ENV === 'production' ? 'https' : 'http'
  const host = request.headers.get('host') || ''
  return process.env.NEXT_PUBLIC_FRAPPE_URL || `${protocol}://${host}`
}

export async function POST(request: NextRequest) {
  try {
    const frappeUrl = getFrappeUrl(request)
    const backendUrl = `${frappeUrl}/api/upload_file`

    // Read the raw body (multipart/form-data) as-is
    const body = await request.arrayBuffer()

    // Build forwarded headers — keep content-type (includes boundary),
    // cookies (session), and CSRF token.
    const headers: Record<string, string> = {}

    const contentType = request.headers.get('content-type')
    if (contentType) headers['Content-Type'] = contentType

    const cookie = request.headers.get('cookie')
    if (cookie) headers['Cookie'] = cookie

    const csrf = request.headers.get('x-frappe-csrf-token')
    if (csrf) headers['X-Frappe-CSRF-Token'] = csrf

    const accept = request.headers.get('accept')
    if (accept) headers['Accept'] = accept

    const response = await fetch(backendUrl, {
      method: 'POST',
      headers,
      body,
    })

    // Read response
    const responseData = await response.text()
    const resContentType = response.headers.get('content-type') || 'application/json'

    // Build response — forward Set-Cookie from backend
    // Same-origin proxy: no CORS grants (credentialed cross-origin reads must stay blocked).
    const resHeaders = new Headers({
      'Content-Type': resContentType,
    })

    const setCookies = response.headers.getSetCookie?.()
    if (setCookies) {
      for (const c of setCookies) {
        resHeaders.append('Set-Cookie', c)
      }
    }

    return new NextResponse(responseData, {
      status: response.status,
      statusText: response.statusText,
      headers: resHeaders,
    })
  } catch (error) {
    console.error('[Upload Proxy] Error:', error)
    return NextResponse.json(
      { error: 'Failed to proxy upload to backend' },
      { status: 502 },
    )
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      // Same-origin proxy: never pair Allow-Credentials with a wildcard origin.
      'Access-Control-Allow-Methods': 'POST,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-Frappe-CSRF-Token, Cookie',
    },
  })
}
