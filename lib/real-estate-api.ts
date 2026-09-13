/**
 * Real Estate Marketplace (متجر العقارات) API Client
 * Wraps base_meena.real_estate whitelisted methods + Aqar* DocType CRUD.
 * All calls go through the shared frappeClient (session-cookie auth / proxy in dev).
 */

import { frappeClient, type FrappeRequestOptions, type FrappeFilter } from './api-client'

const AUTH = 'base_meena.real_estate.aqar_api'
const PUBLIC = 'base_meena.real_estate.aqar_public_api'
const SOCIAL = 'base_meena.real_estate.aqar_social_api'
const CHAT = 'base_meena.real_estate.aqar_chat_api'
const PAY = 'base_meena.real_estate.aqar_payment_api'
const COMP = 'base_meena.real_estate.aqar_compliance_api'
const ADMIN = 'base_meena.real_estate.aqar_admin_api'

// ==================== Types ====================

export type ListingType = 'Sale' | 'Rent' | 'Daily Rent'
export type ListingStatus = 'Draft' | 'Pending License' | 'Active' | 'Expired' | 'Rejected' | 'Sold'

export interface AqarServiceRow { service: string }

export interface AqarListing {
  name?: string
  title: string
  advertiser?: string
  category?: string
  listing_type?: ListingType
  status?: ListingStatus
  rejection_reason?: string
  description?: string
  price?: number
  payment_terms?: string
  area_sqm?: number
  bedrooms?: number
  bathrooms?: number
  age_years?: number
  street_width?: number
  facade?: string
  region?: string
  city?: string
  district?: string
  address_text?: string
  latitude?: number
  longitude?: number
  hide_exact_location?: 0 | 1
  // licensed-ad info (معلومات العقار حسب الرخصة)
  plan_number?: string
  plot_number?: string
  property_services?: AqarServiceRow[]
  property_usages?: string
  guarantees_and_duration?: string
  other_obligations?: string
  disputes?: string
  location_description_per_deed?: string
  licensee_name?: string
  // REGA
  rega_ad_license_number?: string
  rega_license_expiry?: string
  rega_verified_at?: string
  fal_license_number?: string
  deed_number?: string
  // meta
  is_featured?: 0 | 1
  featured_until?: string
  views_count?: number
  published_at?: string
  creation?: string
  modified?: string
}

export interface AqarAdvertiser {
  name?: string
  advertiser_name: string
  user?: string
  user_type?: 'Individual' | 'Broker' | 'Agency'
  status?: 'Active' | 'Suspended'
  phone?: string
  is_phone_verified?: 0 | 1
  national_id?: string
  nafath_verified?: 0 | 1
  fal_license_number?: string
  fal_license_expiry?: string
  rating_avg?: number
}

export interface AqarCategory {
  name: string
  category_name_ar: string
  category_name_en: string
  parent_aqar_category?: string
  is_group?: 0 | 1
  allow_sale?: 0 | 1
  allow_rent?: 0 | 1
  allow_daily_rent?: 0 | 1
  icon?: string
  enabled?: 0 | 1
  display_order?: number
  listing_count?: number
  lft?: number
  rgt?: number
}

export interface GeoItem {
  name: string
  region?: string
  city?: string
  latitude?: number
  longitude?: number
  region_name_ar?: string; region_name_en?: string
  city_name_ar?: string; city_name_en?: string
  district_name_ar?: string; district_name_en?: string
}

export interface CityWithCount {
  name: string
  city_name_ar?: string
  city_name_en?: string
  latitude?: number
  longitude?: number
  count: number
}

export interface AqarListingImage {
  name?: string
  image: string
  webp_thumb?: string
  is_primary?: 0 | 1
  caption?: string
}

export interface AqarAuditEntry {
  name: string
  action: string
  user?: string
  changed_fields?: string
  note?: string
  creation: string
}

export interface AqarDashboard {
  active: number; pending: number; draft: number; expired: number; rejected: number; sold: number
  expiring_7: number; expiring_30: number; advertisers: number
  promotion_revenue: number; open_reports: number; open_complaints: number
  new_contracts: number
}

export interface AqarSuggestCity { name: string; label: string; count: number }
export interface AqarSuggestDistrict { name: string; label: string; city: string; city_label?: string; count: number }
export interface AqarSuggest {
  cities: AqarSuggestCity[]
  districts: AqarSuggestDistrict[]
  categories: AqarSuggestCity[]
}

export interface AqarDashboardExtras {
  recent: Array<{ name: string; title: string; price?: number; listing_type?: string; status?: string; district?: string; district_name_ar?: string; primary_image?: string | null }>
  daily: Array<{ day: string; count: number }>
  by_category: Array<{ label: string; count: number }>
  by_city: Array<{ label: string; count: number }>
  expiring: Array<{ name: string; title: string; city?: string; rega_license_expiry: string; days_left: number }>
  activity: Array<{ type: 'audit' | 'comment' | 'report'; name: string; title: string; listing?: string; reference_doctype?: string; reference_name?: string; who?: string; detail?: string; creation: string }>
  contracts?: Array<{ name: string; contract_type: string; applicant_name?: string; status?: string; creation: string }>
  leads?: Array<{ name: string; topic: string; lead_name?: string; contact?: string; status?: string; creation: string }>
}

export interface AqarContractRow {
  name: string; contract_type: string; applicant_name?: string; applicant_phone?: string
  preferred_channel?: string; status: string; creation: string
}
export interface AqarContractDetail extends AqarContractRow {
  linked_listing?: string; notes?: string; terms?: string; details?: string
  attachment?: string; team_notes?: string; source?: string
}
export interface AqarLeadRow {
  name: string; topic: string; intent?: string; lead_name?: string; contact?: string
  channel?: string; status: string; creation: string
}
export interface AqarLeadDetail extends AqarLeadRow {
  message?: string; team_notes?: string; source?: string
}

export interface ListingSearchResult {
  name: string; title: string; price?: number; payment_terms?: string; listing_type?: ListingType
  category?: string; city?: string; district?: string; region?: string
  area_sqm?: number; bedrooms?: number; bathrooms?: number; facade?: string
  age_years?: number; furnished?: string; floor_level?: string
  is_featured?: 0 | 1; views_count?: number; rega_ad_license_number?: string; creation?: string
  city_name_ar?: string; city_name_en?: string
  district_name_ar?: string; district_name_en?: string
  category_name_ar?: string; category_name_en?: string
  primary_image?: string | null
  distance_km?: number
  pin_lat?: number | null
  pin_lng?: number | null
  pin_obscured?: 0 | 1
  advertiser?: string
  rating_avg?: number | null
  review_count?: number
}

export interface AqarReview {
  name: string
  rating: number
  body?: string
  author_name?: string
  creation: string
}

export interface OfficeReviews {
  reviews: AqarReview[]
  rating_avg: number | null
  review_count: number
  next_cursor: string | null
  has_more: boolean
}

export interface SearchResponse {
  results: ListingSearchResult[]
  next_cursor: string | null
  has_more: boolean
}

export interface AqarComment {
  name: string
  author_name?: string
  parent_comment?: string | null
  body: string
  creation: string
  is_hidden?: 0 | 1
}

export interface AqarReport {
  name: string
  listing: string
  reason: string
  status: string
  details?: string
  reported_by?: string
  handled_by?: string
  resolution_note?: string
  creation: string
}

export interface AqarPropertyRequest {
  name?: string
  title?: string
  category?: string
  listing_type?: string
  city?: string
  district?: string
  price_min?: number
  price_max?: number
  area_min?: number
  area_max?: number
  bedrooms_min?: number
  notify_on_match?: 0 | 1
  is_active?: 0 | 1
}

export interface AqarThread {
  name: string
  listing: string
  listing_title?: string
  buyer?: string
  seller?: string
  other_party?: string
  last_message?: string
  last_message_at?: string
}
export interface AqarMessage {
  name: string
  sender?: string
  body: string
  read_at?: string
  creation: string
}
export interface AqarPromotion {
  name: string
  package_name: string
  package_name_ar?: string
  duration_days: number
  price: number
  description?: string
}
export interface AqarComplaint {
  name: string
  subject: string
  status: string
  complainant?: string
  complainant_contact?: string
  listing?: string
  sla_due?: string
  handled_by?: string
  details?: string
  resolution?: string
  creation: string
}
export interface ExpiryMonitor {
  expired: any[]
  expiring_7: any[]
  expiring_30: any[]
}

export interface SearchParams {
  city?: string; district?: string; category?: string; listing_type?: string
  price_min?: number; price_max?: number; area_min?: number; area_max?: number
  bedrooms_min?: number; keyword?: string; sort?: string; cursor?: string | null; limit?: number
  bathrooms_min?: string; age_max?: string; facade?: string
  furnished?: string; floor_level?: string; services?: string
}

// ==================== Client ====================

function unwrap<T>(resp: { message?: T; data?: T }): T {
  return (resp?.message ?? resp?.data) as T
}

export const realEstateApi = {
  // ---- settings / dashboard ----
  async getSettings(): Promise<{ enabled: boolean }> {
    return unwrap(await frappeClient.call(`${AUTH}.get_real_estate_settings`))
  },
  async getDashboard(): Promise<AqarDashboard> {
    return unwrap(await frappeClient.call<AqarDashboard>(`${AUTH}.get_dashboard`))
  },
  async getDashboardExtras(): Promise<AqarDashboardExtras> {
    return unwrap(await frappeClient.call<AqarDashboardExtras>(`${AUTH}.get_dashboard_extras`))
  },

  // ---- request inboxes (contracts + leads) — in-dashboard list/detail ----
  async listContractRequests(status?: string): Promise<AqarContractRow[]> {
    return unwrap(await frappeClient.call<AqarContractRow[]>(`${AUTH}.list_contract_requests`, { status }))
  },
  async getContractRequest(name: string): Promise<AqarContractDetail> {
    return unwrap(await frappeClient.call<AqarContractDetail>(`${AUTH}.get_contract_request`, { name }))
  },
  async setContractStatus(name: string, status: string, team_notes?: string): Promise<{ name: string; status: string }> {
    return unwrap(await frappeClient.call(`${AUTH}.set_contract_status`, { name, status, team_notes }))
  },
  async listLeads(status?: string): Promise<AqarLeadRow[]> {
    return unwrap(await frappeClient.call<AqarLeadRow[]>(`${AUTH}.list_leads`, { status }))
  },
  async getLead(name: string): Promise<AqarLeadDetail> {
    return unwrap(await frappeClient.call<AqarLeadDetail>(`${AUTH}.get_lead`, { name }))
  },
  async setLeadStatus(name: string, status: string, team_notes?: string): Promise<{ name: string; status: string }> {
    return unwrap(await frappeClient.call(`${AUTH}.set_lead_status`, { name, status, team_notes }))
  },

  // ---- listings CRUD (resource API) ----
  async getListings(options?: FrappeRequestOptions): Promise<AqarListing[]> {
    return frappeClient.getList<AqarListing>('Aqar Listing', {
      fields: ['name', 'title', 'advertiser', 'category', 'listing_type', 'status', 'price',
        'city', 'district', 'area_sqm', 'bedrooms', 'rega_license_expiry', 'is_featured',
        'views_count', 'creation', 'modified'],
      order_by: 'modified desc',
      limit_page_length: 50,
      ...options,
    })
  },
  async getListing(name: string): Promise<AqarListing> {
    const res = await frappeClient.get<AqarListing>('Aqar Listing', name)
    return res.data as AqarListing
  },
  async createListing(data: Partial<AqarListing>): Promise<AqarListing> {
    const res = await frappeClient.post<AqarListing>('Aqar Listing', data)
    const out = res.data ?? (res.message as AqarListing)
    if (!out) throw new Error('Failed to create listing')
    return out
  },
  async updateListing(name: string, data: Partial<AqarListing>): Promise<AqarListing> {
    const res = await frappeClient.put<AqarListing>('Aqar Listing', name, data)
    return (res.data ?? res.message) as AqarListing
  },

  // ---- advertisers ----
  async getAdvertisers(options?: FrappeRequestOptions): Promise<AqarAdvertiser[]> {
    return frappeClient.getList<AqarAdvertiser>('Aqar Advertiser', {
      fields: ['name', 'advertiser_name', 'user_type', 'status', 'phone', 'is_phone_verified',
        'nafath_verified', 'fal_license_number', 'rating_avg'],
      order_by: 'modified desc',
      limit_page_length: 100,
      ...options,
    })
  },
  async getAdvertiser(name: string): Promise<AqarAdvertiser> {
    return (await frappeClient.get<AqarAdvertiser>('Aqar Advertiser', name)).data as AqarAdvertiser
  },
  async createAdvertiser(data: Partial<AqarAdvertiser>): Promise<AqarAdvertiser> {
    const res = await frappeClient.post<AqarAdvertiser>('Aqar Advertiser', data)
    return (res.data ?? res.message) as AqarAdvertiser
  },
  async updateAdvertiser(name: string, data: Partial<AqarAdvertiser>): Promise<AqarAdvertiser> {
    return (await frappeClient.put<AqarAdvertiser>('Aqar Advertiser', name, data)).data as AqarAdvertiser
  },

  // ---- images ----
  async getListingImages(listing: string): Promise<AqarListingImage[]> {
    return unwrap(await frappeClient.call<AqarListingImage[]>(`${AUTH}.get_listing_images`, { listing }))
  },
  async addListingImage(listing: string, file_url: string, is_primary = 0, caption?: string) {
    return unwrap(await frappeClient.call(`${AUTH}.add_listing_image`, { listing, file_url, is_primary, caption }))
  },

  // ---- compliance flow ----
  async requestOtp(phone: string) {
    return unwrap(await frappeClient.call(`${AUTH}.request_otp`, { phone }))
  },
  async verifyOtp(phone: string, code: string, advertiser?: string): Promise<{ verified: boolean }> {
    return unwrap(await frappeClient.call(`${AUTH}.verify_otp`, { phone, code, advertiser }))
  },
  async nafathInitiate(national_id: string): Promise<{ trans_id: string; random: string }> {
    return unwrap(await frappeClient.call(`${AUTH}.nafath_initiate`, { national_id }))
  },
  async nafathStatus(trans_id: string, advertiser?: string): Promise<{ status: string }> {
    return unwrap(await frappeClient.call(`${AUTH}.nafath_status`, { trans_id, advertiser }))
  },
  async verifyLicense(listing: string) {
    return unwrap(await frappeClient.call(`${AUTH}.verify_listing_license`, { listing }))
  },
  async publishListing(listing: string): Promise<{ status: string; published_at: string }> {
    return unwrap(await frappeClient.call(`${AUTH}.publish_listing`, { listing }))
  },
  async rejectListing(listing: string, reason?: string) {
    return unwrap(await frappeClient.call(`${AUTH}.reject_listing`, { listing, reason }))
  },
  async getListingAudit(listing: string, limit = 50): Promise<AqarAuditEntry[]> {
    return unwrap(await frappeClient.call<AqarAuditEntry[]>(`${AUTH}.get_listing_audit`, { listing, limit }))
  },

  // ---- public taxonomy / search ----
  async listCategories(): Promise<AqarCategory[]> {
    return unwrap(await frappeClient.call<AqarCategory[]>(`${PUBLIC}.list_categories`))
  },
  async listRegions(): Promise<GeoItem[]> {
    return unwrap(await frappeClient.call<GeoItem[]>(`${PUBLIC}.list_regions`))
  },
  async listCities(region?: string): Promise<GeoItem[]> {
    return unwrap(await frappeClient.call<GeoItem[]>(`${PUBLIC}.list_cities`, { region }))
  },
  async listDistricts(city: string): Promise<GeoItem[]> {
    return unwrap(await frappeClient.call<GeoItem[]>(`${PUBLIC}.list_districts`, { city }))
  },
  async listCitiesWithListings(): Promise<CityWithCount[]> {
    return unwrap(await frappeClient.call<CityWithCount[]>(`${PUBLIC}.list_cities_with_listings`))
  },
  async submitLead(payload: { topic: string; lead_name?: string; contact: string; channel?: string; message?: string; intent?: string; contact_time?: string }): Promise<{ ok: boolean }> {
    return unwrap(await frappeClient.call(`${PUBLIC}.submit_lead`, payload as Record<string, any>))
  },
  async purgeTestLeads(): Promise<{ deleted: number }> {
    return unwrap(await frappeClient.call(`${PUBLIC}.purge_test_leads`))
  },

  // ---- lead-capture intake (اطلب عقارك / سجّل اهتمامك / تحالفات / تسويق) ----
  async submitBuyerRequest(payload: {
    requester_type: 'Seeker' | 'Broker'
    full_name: string
    phone: string
    city?: string
    category?: string
    districts?: string[]
    area_min?: number
    area_max?: number
    budget_min?: number
    budget_max?: number
    payment_method?: 'Cash' | 'Bank Financing'
    notes?: string
    fal_license_number?: string
    brokerage_contract_number?: string
    has_brokerage_contract?: number
  }): Promise<{ ok: boolean; name: string }> {
    const { districts, ...rest } = payload
    return unwrap(await frappeClient.call(`${PUBLIC}.submit_buyer_request`, {
      ...rest,
      districts: districts?.length ? JSON.stringify(districts) : undefined,
    } as Record<string, any>))
  },
  async listInterestAreas(): Promise<Array<{ name: string; interest_name_ar: string }>> {
    return unwrap(await frappeClient.call(`${PUBLIC}.list_interest_areas`))
  },
  async submitInterest(payload: {
    full_name: string
    phone: string
    stakeholder_type: string
    city?: string
    interests?: string[]
    organization_name?: string
    fal_license_number?: string
    notes?: string
  }): Promise<{ ok: boolean; name: string }> {
    const { interests, ...rest } = payload
    return unwrap(await frappeClient.call(`${PUBLIC}.submit_interest`, {
      ...rest,
      interests: interests?.length ? JSON.stringify(interests) : undefined,
    } as Record<string, any>))
  },
  async submitPartnershipLead(payload: {
    full_name: string
    phone: string
    ownership_relation?: string
    city?: string
    district?: string
    location_text?: string
    land_area?: number
    dimensions?: string
    land_use?: string
    has_valuation?: string
    contact_time?: string
    notes?: string
  }): Promise<{ ok: boolean; name: string }> {
    return unwrap(await frappeClient.call(`${PUBLIC}.submit_partnership_lead`, payload as Record<string, any>))
  },
  async submitMarketingRequest(payload: {
    applicant_name: string
    phone: string
    company_name: string
    job_title?: string
    city?: string
    district?: string
    project_type?: string
    contact_time?: string
    notes?: string
  }): Promise<{ ok: boolean; name: string }> {
    return unwrap(await frappeClient.call(`${PUBLIC}.submit_marketing_request`, payload as Record<string, any>))
  },
  async checkMembership(phone: string): Promise<{
    found: boolean
    status?: 'Active' | 'Expired' | 'Suspended'
    tier?: string | null
    member_type?: string | null
    expires_on?: string | null
  }> {
    return unwrap(await frappeClient.call(`${PUBLIC}.check_membership`, { phone }))
  },
  async getContactChannels(): Promise<Record<string, string>> {
    return unwrap(await frappeClient.call(`${PUBLIC}.get_contact_channels`))
  },
  async getInvestmentOverview(params: { city?: string; category?: string; limit?: number } = {}): Promise<any> {
    return unwrap(await frappeClient.call(`${PUBLIC}.get_investment_overview`, params as Record<string, any>))
  },
  async searchListings(params: SearchParams, signal?: AbortSignal): Promise<SearchResponse> {
    return unwrap(await frappeClient.call<SearchResponse>(`${PUBLIC}.search_listings`, params as Record<string, any>, signal))
  },
  async getPublicListing(name: string): Promise<any> {
    return unwrap(await frappeClient.call(`${PUBLIC}.get_listing`, { name }))
  },
  async getSimilarListings(listing: string, limit = 6): Promise<ListingSearchResult[]> {
    return unwrap(await frappeClient.call<ListingSearchResult[]>(`${PUBLIC}.get_similar_listings`, { listing, limit }))
  },
  async getComments(listing: string): Promise<AqarComment[]> {
    return unwrap(await frappeClient.call<AqarComment[]>(`${PUBLIC}.get_comments`, { listing }))
  },

  // ---- social (authenticated) ----
  async addComment(listing: string, body: string, parent_comment?: string) {
    return unwrap(await frappeClient.call(`${SOCIAL}.add_comment`, { listing, body, parent_comment }))
  },
  async hideComment(comment: string, hidden = 1) {
    return unwrap(await frappeClient.call(`${SOCIAL}.hide_comment`, { comment, hidden }))
  },
  async toggleFavorite(listing: string): Promise<{ favorited: boolean }> {
    return unwrap(await frappeClient.call(`${SOCIAL}.toggle_favorite`, { listing }))
  },
  async isFavorited(listing: string): Promise<{ favorited: boolean }> {
    return unwrap(await frappeClient.call(`${SOCIAL}.is_favorited`, { listing }))
  },
  async listMyFavorites(): Promise<ListingSearchResult[]> {
    return unwrap(await frappeClient.call<ListingSearchResult[]>(`${SOCIAL}.list_my_favorites`))
  },
  async toggleFollow(advertiser: string): Promise<{ following: boolean }> {
    return unwrap(await frappeClient.call(`${SOCIAL}.toggle_follow`, { advertiser }))
  },
  async isFollowing(advertiser: string): Promise<{ following: boolean }> {
    return unwrap(await frappeClient.call(`${SOCIAL}.is_following`, { advertiser }))
  },
  async createReport(listing: string, reason: string, details?: string) {
    return unwrap(await frappeClient.call(`${SOCIAL}.create_report`, { listing, reason, details }))
  },
  async listReports(status?: string): Promise<AqarReport[]> {
    return unwrap(await frappeClient.call<AqarReport[]>(`${SOCIAL}.list_reports`, { status }))
  },
  async resolveReport(report: string, status: string, note?: string) {
    return unwrap(await frappeClient.call(`${SOCIAL}.resolve_report`, { report, status, note }))
  },
  async createPropertyRequest(req: AqarPropertyRequest) {
    return unwrap(await frappeClient.call(`${SOCIAL}.create_property_request`, req as Record<string, any>))
  },
  async listMyPropertyRequests(): Promise<AqarPropertyRequest[]> {
    return unwrap(await frappeClient.call<AqarPropertyRequest[]>(`${SOCIAL}.list_my_property_requests`))
  },
  async deletePropertyRequest(name: string) {
    return unwrap(await frappeClient.call(`${SOCIAL}.delete_property_request`, { name }))
  },
  async getRequestMatches(name: string): Promise<ListingSearchResult[]> {
    return unwrap(await frappeClient.call<ListingSearchResult[]>(`${SOCIAL}.get_request_matches`, { name }))
  },

  // ---- office/agent reviews ----
  async getOfficeReviews(office: string, cursor?: string): Promise<OfficeReviews> {
    return unwrap(await frappeClient.call<OfficeReviews>(`${PUBLIC}.get_office_reviews`, { office, cursor }))
  },
  async submitReview(office: string, rating: number, body?: string, is_test?: number): Promise<{ name: string; status: string }> {
    return unwrap(await frappeClient.call(`${SOCIAL}.submit_review`, { office, rating, body, is_test }))
  },
  async reportReview(review: string): Promise<{ ok: boolean; report_count: number }> {
    return unwrap(await frappeClient.call(`${SOCIAL}.report_review`, { review }))
  },
  async moderateReview(review: string, status: string): Promise<{ name: string; status: string }> {
    return unwrap(await frappeClient.call(`${SOCIAL}.moderate_review`, { review, status }))
  },

  // ---- contract request intake (إدارة العقود) ----
  async submitContractRequest(payload: {
    contract_type: string
    applicant_name: string
    applicant_phone: string
    preferred_channel?: string
    notes?: string
    terms?: string
    linked_listing?: string
    details?: string
    attachment?: string
    attachment_filename?: string
  }): Promise<{ ok: boolean; name?: string; contract_type?: string; status?: string }> {
    return unwrap(await frappeClient.call(`${PUBLIC}.submit_contract_request`, payload as Record<string, any>))
  },

  // ---- chat (Phase 3) ----
  async startThread(listing: string): Promise<{ thread: string }> {
    return unwrap(await frappeClient.call(`${CHAT}.start_thread`, { listing }))
  },
  async getMyThreads(): Promise<AqarThread[]> {
    return unwrap(await frappeClient.call<AqarThread[]>(`${CHAT}.get_my_threads`))
  },
  async getMessages(thread: string): Promise<AqarMessage[]> {
    return unwrap(await frappeClient.call<AqarMessage[]>(`${CHAT}.get_messages`, { thread }))
  },
  async sendMessage(thread: string, body: string) {
    return unwrap(await frappeClient.call(`${CHAT}.send_message`, { thread, body }))
  },

  // ---- promotions / payments (Phase 3) ----
  async listPromotions(): Promise<AqarPromotion[]> {
    return unwrap(await frappeClient.call<AqarPromotion[]>(`${PAY}.list_promotions`))
  },
  async createCheckout(listing: string, promotion: string): Promise<{ payment: string; checkout_url?: string }> {
    return unwrap(await frappeClient.call(`${PAY}.create_checkout`, { listing, promotion }))
  },
  async confirmPayment(payment: string): Promise<{ status: string; sales_invoice?: string }> {
    return unwrap(await frappeClient.call(`${PAY}.confirm_payment`, { payment }))
  },

  // ---- compliance (Phase 3) ----
  async getExpiryMonitor(): Promise<ExpiryMonitor> {
    return unwrap(await frappeClient.call<ExpiryMonitor>(`${COMP}.get_expiry_monitor`))
  },
  async createComplaint(subject: string, details?: string, listing?: string, contact?: string) {
    return unwrap(await frappeClient.call(`${COMP}.create_complaint`, { subject, details, listing, contact }))
  },
  async listComplaints(status?: string): Promise<AqarComplaint[]> {
    return unwrap(await frappeClient.call<AqarComplaint[]>(`${COMP}.list_complaints`, { status }))
  },
  async updateComplaint(name: string, status: string, resolution?: string) {
    return unwrap(await frappeClient.call(`${COMP}.update_complaint`, { name, status, resolution }))
  },
  async getAudit(listing?: string): Promise<AqarAuditEntry[]> {
    return unwrap(await frappeClient.call<AqarAuditEntry[]>(`${COMP}.get_audit`, { listing }))
  },
  async exportUserData(advertiser?: string, user?: string): Promise<any> {
    return unwrap(await frappeClient.call(`${COMP}.export_user_data`, { advertiser, user }))
  },

  // ---- guest post-ad flow (public storefront) ----
  /** Runtime flag (backend ENABLE_PHONE_OTP / site_config enable_phone_otp, default OFF):
   *  decides whether /post shows the OTP step or the contact-info step. */
  async guestPostConfig(): Promise<{ phone_otp: boolean }> {
    return unwrap(await frappeClient.call(`${PUBLIC}.guest_post_config`))
  },
  async guestRequestOtp(phone: string): Promise<{ sent: boolean; ttl: number }> {
    return unwrap(await frappeClient.call(`${PUBLIC}.guest_request_otp`, { phone }))
  },
  async guestVerifyOtp(phone: string, code: string): Promise<{ token: string; advertiser: string }> {
    return unwrap(await frappeClient.call(`${PUBLIC}.guest_verify_otp`, { phone, code }))
  },
  /** No-OTP session start (phone collected as contact info; listing goes to manual review). */
  async guestStartSession(phone: string, advertiser_name?: string): Promise<{ token: string; advertiser: string }> {
    return unwrap(await frappeClient.call(`${PUBLIC}.guest_start_session`, { phone, advertiser_name }))
  },
  async guestSubmitListing(payload: Record<string, any>): Promise<{ listing: string; status: string }> {
    return unwrap(await frappeClient.call(`${PUBLIC}.guest_submit_listing`, payload))
  },
  async suggest(q: string): Promise<AqarSuggest> {
    return unwrap(await frappeClient.call(`${PUBLIC}.suggest`, { q }))
  },
  async searchInBounds(params: Record<string, any>, signal?: AbortSignal): Promise<{ results: ListingSearchResult[]; count: number; capped: boolean }> {
    return unwrap(await frappeClient.call(`${PUBLIC}.search_in_bounds`, params, signal))
  },
  // ---- guest wizard v2 (draft → images → map → publish) ----
  async guestSaveDraft(token: string, fields: Record<string, any>, advertiser_name?: string): Promise<{ listing: string }> {
    return unwrap(await frappeClient.call(`${PUBLIC}.guest_save_draft`, { token, fields: JSON.stringify(fields), advertiser_name }))
  },
  async guestUploadImage(token: string, listing: string, filename: string, data: string, is_primary = 0): Promise<{ name: string; image: string; is_primary: number }> {
    return unwrap(await frappeClient.call(`${PUBLIC}.guest_upload_image`, { token, listing, filename, data, is_primary }))
  },
  async guestImageAction(token: string, listing: string, image: string, action: 'delete' | 'primary'): Promise<{ ok: boolean }> {
    return unwrap(await frappeClient.call(`${PUBLIC}.guest_image_action`, { token, listing, image, action }))
  },
  async guestListImages(token: string, listing: string): Promise<Array<{ name: string; image: string; webp_thumb?: string; is_primary: number }>> {
    return unwrap(await frappeClient.call(`${PUBLIC}.guest_list_images`, { token, listing }))
  },
  async guestPublish(token: string, listing: string): Promise<{ listing: string; status: string }> {
    return unwrap(await frappeClient.call(`${PUBLIC}.guest_publish`, { token, listing }))
  },
  async listPropertyServices(): Promise<Array<{ name: string; service_name_ar: string }>> {
    return unwrap(await frappeClient.call(`${PUBLIC}.list_property_services`))
  },

  // ==================== Phase 5 admin (Manager+Admin) ====================
  admin: {
    // categories
    listCategories: async (): Promise<AqarCategory[]> => unwrap(await frappeClient.call(`${ADMIN}.admin_list_categories`)),
    createCategory: async (p: Record<string, any>) => unwrap(await frappeClient.call(`${ADMIN}.create_category`, p)),
    updateCategory: async (p: Record<string, any>) => unwrap(await frappeClient.call(`${ADMIN}.update_category`, p)),
    toggleCategory: async (name: string, enabled: 0 | 1) => unwrap(await frappeClient.call(`${ADMIN}.toggle_category`, { name, enabled })),
    reorderCategories: async (order: string[]) => unwrap(await frappeClient.call(`${ADMIN}.reorder_categories`, { order: JSON.stringify(order) })),
    reassignCategory: async (from_category: string, to_category: string) => unwrap(await frappeClient.call(`${ADMIN}.reassign_category`, { from_category, to_category })),
    deleteCategory: async (name: string) => unwrap(await frappeClient.call(`${ADMIN}.delete_category`, { name })),
    // advertisers & users
    listAdvertisers: async (p: Record<string, any> = {}): Promise<any[]> => unwrap(await frappeClient.call(`${ADMIN}.admin_list_advertisers`, p)),
    updateAdvertiser: async (p: Record<string, any>) => unwrap(await frappeClient.call(`${ADMIN}.update_advertiser`, p)),
    setVerification: async (advertiser: string, field: string, value: 0 | 1, reason?: string) => unwrap(await frappeClient.call(`${ADMIN}.set_verification`, { advertiser, field, value, reason })),
    suspendAdvertiser: async (advertiser: string, reason?: string) => unwrap(await frappeClient.call(`${ADMIN}.suspend_advertiser`, { advertiser, reason })),
    banAdvertiser: async (advertiser: string, reason?: string) => unwrap(await frappeClient.call(`${ADMIN}.ban_advertiser`, { advertiser, reason })),
    unbanAdvertiser: async (advertiser: string, reason?: string) => unwrap(await frappeClient.call(`${ADMIN}.unban_advertiser`, { advertiser, reason })),
    deleteAdvertiser: async (advertiser: string, content_handling: 'archive' | 'remove') => unwrap(await frappeClient.call(`${ADMIN}.delete_advertiser`, { advertiser, content_handling })),
    listReUsers: async (): Promise<any[]> => unwrap(await frappeClient.call(`${ADMIN}.list_re_users`)),
    grantRole: async (email: string, role: string) => unwrap(await frappeClient.call(`${ADMIN}.grant_role`, { email, role })),
    revokeRole: async (email: string, role: string) => unwrap(await frappeClient.call(`${ADMIN}.revoke_role`, { email, role })),
    // listing overrides
    forceUnpublish: async (listing: string, reason?: string) => unwrap(await frappeClient.call(`${ADMIN}.force_unpublish`, { listing, reason })),
    forceFeature: async (listing: string, days = 7) => unwrap(await frappeClient.call(`${ADMIN}.force_feature`, { listing, days })),
    forceUnfeature: async (listing: string) => unwrap(await frappeClient.call(`${ADMIN}.force_unfeature`, { listing })),
    transferListing: async (listing: string, to_advertiser: string, reason?: string) => unwrap(await frappeClient.call(`${ADMIN}.transfer_listing`, { listing, to_advertiser, reason })),
    relicenseEdit: async (listing: string, fields: Record<string, any>) => unwrap(await frappeClient.call(`${ADMIN}.admin_relicense_edit`, { listing, fields: JSON.stringify(fields) })),
    // masters
    listServices: async (): Promise<any[]> => unwrap(await frappeClient.call(`${ADMIN}.list_services`)),
    saveService: async (p: Record<string, any>) => unwrap(await frappeClient.call(`${ADMIN}.save_service`, p)),
    deleteService: async (name: string) => unwrap(await frappeClient.call(`${ADMIN}.delete_service`, { name })),
    listPromotions: async (): Promise<any[]> => unwrap(await frappeClient.call(`${ADMIN}.admin_list_promotions`)),
    savePromotion: async (p: Record<string, any>) => unwrap(await frappeClient.call(`${ADMIN}.save_promotion`, p)),
    deletePromotion: async (name: string) => unwrap(await frappeClient.call(`${ADMIN}.delete_promotion`, { name })),
    renameGeo: async (doctype: string, name: string, name_ar?: string, name_en?: string) => unwrap(await frappeClient.call(`${ADMIN}.rename_geo`, { doctype, name, name_ar, name_en })),
    addDistrict: async (p: Record<string, any>) => unwrap(await frappeClient.call(`${ADMIN}.add_district`, p)),
    // flags + audit
    getFlags: async (): Promise<Record<string, number>> => unwrap(await frappeClient.call(`${ADMIN}.get_module_flags`)),
    setFlag: async (flag: string, value: 0 | 1) => unwrap(await frappeClient.call(`${ADMIN}.set_module_flag`, { flag, value })),
    listAudit: async (limit = 50, reference_doctype?: string): Promise<any[]> => unwrap(await frappeClient.call(`${ADMIN}.list_audit`, { limit, reference_doctype })),
  },
}

export type { FrappeFilter }
