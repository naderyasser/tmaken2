'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

/**
 * /shift-management/new — retired as a standalone page. Apex creates a
 * shift from the small list-page dialog (G9, «إضافة دوام») now, not a
 * full-page form, so this just sends anyone with the old link/bookmark
 * back to the list with that dialog opened automatically.
 */
export default function Page() {
  const router = useRouter()
  useEffect(() => { router.replace('/shift-management?add=1') }, [router])
  return null
}
