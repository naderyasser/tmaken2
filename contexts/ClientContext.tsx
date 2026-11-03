'use client'

import React, { createContext, useContext, ReactNode } from 'react'
import { ClientConfig } from '@/lib/client-config'

interface ClientContextType {
  config: ClientConfig | null
  domain: string
}

const ClientContext = createContext<ClientContextType | null>(null)

export function ClientProvider({ 
  children, 
  config, 
  domain 
}: { 
  children: ReactNode
  config: ClientConfig | null
  domain: string
}) {
  return (
    <ClientContext.Provider value={{ config, domain }}>
      {children}
    </ClientContext.Provider>
  )
}

export function useClient() {
  const context = useContext(ClientContext)
  if (!context) {
    throw new Error('useClient must be used within a ClientProvider')
  }
  return context
}
