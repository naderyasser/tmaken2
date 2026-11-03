'use client'

import { createContext, useContext } from 'react'

import type { TenantBrand } from '@/lib/tenant-brand'

const BrandContext = createContext<TenantBrand | null>(null)

/** Fed once by the root layout (server-resolved from the request host). */
export function TenantBrandProvider({ brand, children }: { brand: TenantBrand; children: React.ReactNode }) {
  return <BrandContext.Provider value={brand}>{children}</BrandContext.Provider>
}

export function useTenantBrand(): TenantBrand {
  const brand = useContext(BrandContext)
  if (!brand) throw new Error('useTenantBrand outside TenantBrandProvider')
  return brand
}
