'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

/**
 * /rotational-shifts — retired. Rotational groups now live inside their
 * parent «أوقات العمل» shift (`/shift-management/<id>/groups`) instead of
 * this standalone module (owner's spec §1). There's no reliable way to
 * deep-link an old bookmark here to the right nested URL, so anyone landing
 * on this old route is sent to the plain «أوقات العمل» list — same pattern
 * as shift-management/new/page.tsx's own retirement.
 */
export default function Page() {
  const router = useRouter()
  useEffect(() => { router.replace('/shift-management') }, [router])
  return null
}
