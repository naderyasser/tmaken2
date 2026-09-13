/**
 * Car Marketplace (سوق السيارات) portal API client.
 * Wraps car_marketplace.admin_api whitelisted methods (session-cookie auth,
 * same qarawi site). Read = Marketplace Manager/Editor; writes = Manager.
 */

import { frappeClient } from './api-client'

const M = 'car_marketplace.admin_api'

// ==================== Types ====================

export type LeadStatus = 'New' | 'Contacted' | 'Closed'
export type SellStatus = 'New' | 'Contacted' | 'Purchased' | 'Rejected'
export type InventoryKind = 'vehicle' | 'spare_part' | 'accessory' | 'scrap' | 'service_center' | 'parts_shop'

export interface CarLead {
  name: string
  full_name: string
  phone: string
  interest_type: string
  lead_status: LeadStatus
  reference_doctype?: string | null
  reference_name?: string | null
  source_page?: string | null
  message?: string | null
  creation: string
}

export interface SellRequest {
  name: string
  full_name: string
  phone: string
  brand?: string | null
  model?: string | null
  model_text?: string | null
  year?: number | null
  mileage_km?: number | null
  asking_price_sar?: number | null
  request_status: SellStatus
  notes?: string | null
  creation: string
  photos?: { image: string }[]
}

export interface InventoryRow {
  name: string
  title: string
  status: string
  is_featured: 0 | 1
  slug?: string | null
  cover_image?: string | null
  modified: string
  // kind-specific extras
  brand?: string | null
  model?: string | null
  year?: number | null
  city?: string | null
  price_sar?: number | null
  part_number?: string | null
  availability?: string | null
  category?: string | null
  listing_type?: string | null
  phone?: string | null
  subscription_status?: string | null
  subscription_until?: string | null
}

export interface CarDashboard {
  inventory: Record<InventoryKind, { total: number; by_status: Record<string, number> }>
  leads: Record<LeadStatus, number>
  sell_requests: Record<SellStatus, number>
  recent_leads: CarLead[]
  recent_sell_requests: SellRequest[]
  can_write: boolean
}

export interface Paged<T> {
  data: T[]
  total_count: number
  statuses?: string[]
}

// ==================== API ====================

async function call<T>(method: string, args?: Record<string, any>): Promise<T> {
  const resp = await frappeClient.call<T>(`${M}.${method}`, args)
  return (resp.message ?? resp.data) as T
}

export const carMarketplaceApi = {
  getDashboard: () => call<CarDashboard>('get_dashboard'),

  listLeads: (args: { status?: string; interest?: string; search?: string; limit_start?: number; limit_page_length?: number }) =>
    call<Paged<CarLead>>('list_leads', args),
  updateLeadStatus: (name: string, status: LeadStatus) =>
    call<{ name: string; lead_status: LeadStatus }>('update_lead_status', { name, status }),

  listSellRequests: (args: { status?: string; search?: string; limit_start?: number; limit_page_length?: number }) =>
    call<Paged<SellRequest>>('list_sell_requests', args),
  getSellRequest: (name: string) => call<SellRequest>('get_sell_request', { name }),
  updateSellRequestStatus: (name: string, status: SellStatus) =>
    call<{ name: string; request_status: SellStatus }>('update_sell_request_status', { name, status }),

  listInventory: (args: { kind: InventoryKind; status?: string; search?: string; limit_start?: number; limit_page_length?: number }) =>
    call<Paged<InventoryRow>>('list_inventory', args),
  setInventoryStatus: (kind: InventoryKind, name: string, status: string) =>
    call<{ name: string; status: string }>('set_inventory_status', { kind, name, status }),
  toggleFeatured: (kind: InventoryKind, name: string, value: 0 | 1) =>
    call<{ name: string; is_featured: 0 | 1 }>('toggle_featured', { kind, name, value }),
}
