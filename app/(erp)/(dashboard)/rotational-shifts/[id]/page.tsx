'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

/** /rotational-shifts/<id> — retired, see ../page.tsx. */
export default function Page() {
  const router = useRouter()
  useEffect(() => { router.replace('/shift-management') }, [router])
  return null
}
