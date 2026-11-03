'use client'

import { useEffect } from 'react'
import { useClient } from '@/contexts/ClientContext'

export function ClientBranding() {
  const { config } = useClient()

  useEffect(() => {
    if (config?.branding.primaryColor) {
      // Update CSS variables for theming
      document.documentElement.style.setProperty(
        '--primary-color',
        config.branding.primaryColor
      )
    }
  }, [config])

  return null
}
