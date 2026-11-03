"use client"

import { useState, useEffect, useRef } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import {
  ArrowRight, Plus, Minus, ChevronRight, AlertCircle, XCircle,
  User, Package, Loader2,
} from "lucide-react"
import Link from "next/link"
import dynamic from "next/dynamic"
import { useRouter, useSearchParams } from "next/navigation"
import { useSalesRep } from "@/contexts/SalesRepContext"
import { salesApi, localDateISO, localDateTimeISO, customerGroupLabel, type Customer, type CustomerInventoryRecord } from "@/lib/sales-api"
import { frappeImageUrl } from "@/lib/utils"
import { Suspense } from "react"
import { VisitSummaryDialog } from "@/components/sales/visit-summary-dialog"
import { useToast } from "@/hooks/use-toast"
import { useI18n } from "@/lib/i18n"

// Interactive pin map for the new-customer form (leaflet — client-side only)
const LocationPickerMap = dynamic(
  () => import("@/components/sales/location-picker-map").then(m => m.LocationPickerMap),
  { ssr: false, loading: () => <div className="h-[240px] rounded-xl bg-slate-100 animate-pulse" /> }
)

interface OrderItem {
  item_code: string
  item_name: string
  qty: number
  rate: number
  stock_uom: string
  image?: string
}

interface WithdrawItem {
  item_code: string
  item_name: string
  qty: number
  rate: number
  reason: string
  customReason?: string
}

// Reason `id` is the backend value (untouched); `labelKey` resolves via t() at render.
const REJECTION_REASONS = [
  { id: "stock", labelKey: "sr.order.reject_stock" },
  { id: "certificate", labelKey: "sr.order.reject_certificate" },
  { id: "payment", labelKey: "sr.order.reject_payment" },
  { id: "budget", labelKey: "sr.order.reject_budget" },
  { id: "competition", labelKey: "sr.order.reject_competition" },
  { id: "other", labelKey: "sr.order.reject_other" },
]

const WITHDRAW_REASONS = [
  { id: "Damaged", labelKey: "sr.withdraw.damaged" },
  { id: "Expired", labelKey: "sr.withdraw.expired" },
  { id: "Wrong Product", labelKey: "sr.withdraw.wrong_product" },
  { id: "Quality Issue", labelKey: "sr.withdraw.quality_issue" },
  { id: "Other", labelKey: "sr.withdraw.other" },
]

function NewOrderContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const customerId = searchParams.get("customerId")
  const { toast } = useToast()
  const { t } = useI18n()
  const withdrawReasonLabel = (id: string) => {
    const r = WITHDRAW_REASONS.find(x => x.id === id)
    return r ? t(r.labelKey) : id
  }

  const { salesPerson, items, repStock, refreshStock, warehouse } = useSalesRep()

  // Tracks the in-flight check-in promise so handleNext can await it before navigating
  const checkInPromiseRef = useRef<Promise<void> | null>(null)

  const [customer, setCustomer] = useState<Customer | null>(null)
  const [customerInvItems, setCustomerInvItems] = useState<{ item_code: string; item_name: string; qty: number }[]>([])
  const [loadingCustomer, setLoadingCustomer] = useState(!!customerId)
  const [visitName, setVisitName] = useState<string | null>(null)
  const [showVisitSummary, setShowVisitSummary] = useState(false)

  // Frappe link data for customer creation
  const [customerGroups, setCustomerGroups] = useState<string[]>([])
  const [territories, setTerritories] = useState<string[]>([])

  // Stage management for new customers
  const [currentStage, setCurrentStage] = useState<"customer-info" | "wants-order" | "order">("customer-info")
  const [customerInfo, setCustomerInfo] = useState({
    name: "", phone: "", address: "", taxNumber: "",
    customer_type: "Company" as "Company" | "Individual",
    customer_group: "", territory: "",
  })
  const [locationLoading, setLocationLoading] = useState(false)
  const [creatingCustomer, setCreatingCustomer] = useState(false)
  // Pin coordinates for the new customer — set by auto-detect or by
  // tapping/dragging the map; this (not the address text) is what gets saved
  const [customerCoords, setCustomerCoords] = useState<{ lat: string; lng: string } | null>(null)

  // Fetch customer groups and territories for the new customer form
  useEffect(() => {
    Promise.all([
      salesApi.getCustomerGroups().catch(() => []),
      salesApi.getTerritories().catch(() => []),
    ]).then(([groups, terrs]) => {
      setCustomerGroups(groups)
      setTerritories(terrs)
      // Set defaults if available
      if (groups.length > 0) setCustomerInfo(prev => ({ ...prev, customer_group: prev.customer_group || groups[0] }))
      if (terrs.length > 0) setCustomerInfo(prev => ({ ...prev, territory: prev.territory || terrs[0] }))
    })
  }, [])

  // Order state
  const [step, setStep] = useState<"inventory" | "products">("inventory")
  const [orderType, setOrderType] = useState<"order" | "no-order">("order")
  const [orderItems, setOrderItems] = useState<Map<string, OrderItem>>(new Map())
  const [withdrawItems, setWithdrawItems] = useState<WithdrawItem[]>([])
  const [replacementItems, setReplacementItems] = useState<{ [key: string]: boolean }>({})
  const [selectedReasons, setSelectedReasons] = useState<string[]>([])

  // Fetch customer details if customerId is provided
  useEffect(() => {
    if (!customerId) {
      setCurrentStage("customer-info")
      setStep("products")
      return
    }

    let cancelled = false
    setLoadingCustomer(true)

    async function loadCustomer() {
      try {
        const c = await salesApi.getCustomer(customerId!)
        if (cancelled) return
        if (c) {
          setCustomer(c)
          setCurrentStage("order")
          setStep("inventory")

          // Fetch customer's latest inventory record
          try {
            const records = await salesApi.getCustomerInventory({
              filters: [["Customer Inventory Record", "customer", "=", customerId!]],
            })
            if (!cancelled && records.length > 0) {
              // Get the most recent record with full details (including child items)
              const latest = records[0]
              const full = await salesApi.getCustomerInventoryById(latest.name)
              if (!cancelled && full?.items && full.items.length > 0) {
                setCustomerInvItems(
                  full.items
                    .filter(item => (item.current_stock ?? 0) > 0)
                    .map(item => ({
                      item_code: item.item_code,
                      item_name: item.item_name || item.item_code,
                      qty: item.current_stock ?? 0,
                    }))
                )
              }
            }
          } catch (err) {
            console.error("Failed to fetch customer inventory:", err)
          }
        } else {
          setCurrentStage("customer-info")
          setStep("products")
        }
      } catch (err) {
        console.error("Failed to fetch customer:", err)
        if (!cancelled) {
          setCurrentStage("customer-info")
          setStep("products")
        }
      } finally {
        if (!cancelled) setLoadingCustomer(false)
      }
    }

    loadCustomer()
    return () => { cancelled = true }
  }, [customerId])

  // Create visit + check-in when arriving at an existing customer
  useEffect(() => {
    if (!customer || !salesPerson || visitName) return
    // Check if there's already a visit name stored from a previous navigation
    const stored = sessionStorage.getItem("visitName")
    const storedCustomer = sessionStorage.getItem("visitCustomer")
    if (stored && storedCustomer === customer.name) {
      setVisitName(stored)
      return
    }
    // Clear stale visit from a different customer
    if (stored && storedCustomer !== customer.name) {
      sessionStorage.removeItem("visitName")
      sessionStorage.removeItem("visitCustomer")
    }

    let cancelled = false

    async function performCheckIn() {
      try {
        // Get GPS position
        let lat = 0
        let lng = 0
        try {
          const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
              enableHighAccuracy: true,
              timeout: 10_000,
            })
          })
          lat = pos.coords.latitude
          lng = pos.coords.longitude
        } catch {
          // GPS unavailable — continue without it
        }

        // Create a Visit
        const visit = await salesApi.createVisit({
          sales_person: salesPerson!.name,
          customer: customer!.name,
          visit_date: localDateISO(),
          visit_status: "Scheduled",
          visit_type: "Sales Order",
          has_order: 0,
        })

        if (cancelled || !visit?.name) return
        sessionStorage.setItem("visitCustomer", customer!.name)

        // Check in with GPS
        try {
          await salesApi.checkIn(visit.name, lat, lng)
        } catch (err) {
          console.warn("[CheckIn] RPC failed, falling back to manual update:", err)
          // Fallback: manually set check_in_time when RPC rejects (e.g. GPS=0,0)
          try {
            const now = localDateTimeISO()
            await salesApi.updateVisit(visit.name, {
              check_in_time: now,
              visit_status: "In Progress",
              ...(lat !== 0 && lng !== 0
                ? { check_in_lat: String(lat), check_in_lng: String(lng) }
                : {}),
            } as any)
            console.log("[CheckIn] Fallback succeeded — visit marked In Progress")
          } catch (fallbackErr) {
            console.warn("[CheckIn] Fallback also failed:", fallbackErr)
          }
        }

        if (cancelled) return
        setVisitName(visit.name)
        sessionStorage.setItem("visitName", visit.name)
      } catch (err) {
        console.warn("[CheckIn] Failed to create visit:", err)
        // Check-in failure should NOT block the order flow
      }
    }

    // ✅ Store the promise so handleNext can await it before navigating
    checkInPromiseRef.current = performCheckIn()

    return () => {
      cancelled = true
      checkInPromiseRef.current = null
    }
  }, [customer, salesPerson, visitName])

  const isExistingCustomer = !!customer

  // Refresh van stock whenever the rep lands on the product-selection step,
  // so availability (and the qty clamps) reflect real-time inventory
  useEffect(() => {
    if (currentStage === "order" && step === "products") {
      refreshStock()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStage, step])

  // If a refresh reveals LESS stock than what's already in the cart, trim it
  useEffect(() => {
    if (orderItems.size === 0 || repStock.length === 0) return
    let changed = false
    const trimmed = new Map(orderItems)
    trimmed.forEach((item, code) => {
      const available = Number(repStock.find(s => s.item_code === code)?.actual_qty) || 0
      if (item.qty > available) {
        changed = true
        if (available <= 0) trimmed.delete(code)
        else trimmed.set(code, { ...item, qty: available })
      }
    })
    if (changed) setOrderItems(trimmed)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repStock])

  const setPin = (lat: string, lng: string) => {
    setCustomerCoords({ lat, lng })
    // Keep the address field in sync when it's empty or holds raw coords —
    // never overwrite a street address the rep typed by hand
    setCustomerInfo(prev => {
      const isCoordsOrEmpty = !prev.address || /^(-?\d+\.?\d*),\s*(-?\d+\.?\d*)$/.test(prev.address.trim())
      return isCoordsOrEmpty
        ? { ...prev, address: `${Number(lat).toFixed(6)}, ${Number(lng).toFixed(6)}` }
        : prev
    })
  }

  const detectLocation = () => {
    setLocationLoading(true)
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setPin(String(position.coords.latitude), String(position.coords.longitude))
          setLocationLoading(false)
        },
        () => setLocationLoading(false)
      )
    } else {
      setLocationLoading(false)
    }
  }

  // Order item management — quantities are HARD-clamped to the live van
  // stock, not just guarded by button-disable states
  const addOrderItem = (itemCode: string) => {
    const item = items.find(i => i.name === itemCode)
    const stock = repStock.find(s => s.item_code === itemCode)
    if (!item) return
    const available = Number(stock?.actual_qty) || 0
    if (available <= 0) return

    setOrderItems(prev => {
      const newMap = new Map(prev)
      const existing = newMap.get(itemCode)
      if (existing) {
        newMap.set(itemCode, { ...existing, qty: Math.min(existing.qty + 1, available) })
      } else {
        newMap.set(itemCode, {
          item_code: itemCode,
          item_name: item.item_name,
          qty: 1,
          rate: item.standard_rate || stock?.valuation_rate || 0,
          stock_uom: item.stock_uom || "Nos",
          image: item.image || undefined,
        })
      }
      return newMap
    })
  }

  const updateOrderItemQty = (itemCode: string, delta: number) => {
    const available = Number(repStock.find(s => s.item_code === itemCode)?.actual_qty) || 0
    setOrderItems(prev => {
      const newMap = new Map(prev)
      const existing = newMap.get(itemCode)
      if (!existing) return prev
      const newQty = Math.min(existing.qty + delta, available)
      if (newQty <= 0) {
        newMap.delete(itemCode)
      } else {
        newMap.set(itemCode, { ...existing, qty: newQty })
      }
      return newMap
    })
  }

  const getOrderQty = (itemCode: string): number => {
    return orderItems.get(itemCode)?.qty || 0
  }

  // Withdraw item management
  const addWithdrawItem = (itemCode: string, itemName: string, rate: number) => {
    const existing = withdrawItems.find(w => w.item_code === itemCode)
    if (existing) {
      setWithdrawItems(prev =>
        prev.map(w => w.item_code === itemCode ? { ...w, qty: w.qty + 1 } : w)
      )
    } else {
      setWithdrawItems(prev => [...prev, { item_code: itemCode, item_name: itemName, qty: 1, rate, reason: "Damaged" }])
    }
  }

  const updateWithdrawQty = (itemCode: string, delta: number) => {
    setWithdrawItems(prev =>
      prev
        .map(w => w.item_code === itemCode ? { ...w, qty: Math.max(0, w.qty + delta) } : w)
        .filter(w => w.qty > 0)
    )
  }

  const updateWithdrawReason = (itemCode: string, reason: string, customReason?: string) => {
    setWithdrawItems(prev =>
      prev.map(w => w.item_code === itemCode ? { ...w, reason, customReason } : w)
    )
  }

  const removeWithdrawItem = (itemCode: string) => {
    setWithdrawItems(prev => prev.filter(w => w.item_code !== itemCode))
  }

  const getWithdrawItem = (itemCode: string) => withdrawItems.find(w => w.item_code === itemCode)

  const getTotalOrderItems = () => Array.from(orderItems.values()).reduce((sum, i) => sum + i.qty, 0)

  const getAvailableQty = (itemCode: string): number => {
    return repStock.find(s => s.item_code === itemCode)?.actual_qty || 0
  }

  const canCompleteOrder = () => {
    if (orderType === "no-order") return selectedReasons.length > 0
    if (isExistingCustomer && step === "inventory") return true
    return orderItems.size > 0 || withdrawItems.length > 0
  }

  const handleNext = async () => {
    if (isExistingCustomer && step === "inventory" && orderType === "order") {
      setStep("products")
      return
    }

    if (orderType === "order" && (orderItems.size > 0 || withdrawItems.length > 0)) {
      const customerName = customer?.customer_name || customerInfo.name
      const custId = customer?.name || ""

      sessionStorage.setItem("orderItems", JSON.stringify(Array.from(orderItems.values())))
      sessionStorage.setItem("withdrawItems", JSON.stringify(withdrawItems))
      sessionStorage.setItem("replacementItems", JSON.stringify(replacementItems))
      sessionStorage.setItem("customerId", custId)
      sessionStorage.setItem("customerName", customerName)
      if (salesPerson) {
        sessionStorage.setItem("salesPerson", salesPerson.name)
      }
      if (warehouse) {
        sessionStorage.setItem("salesWarehouse", warehouse)
      }

      // ✅ Await any in-flight check-in before navigating so visitName lands in sessionStorage
      if (checkInPromiseRef.current) {
        try { await checkInPromiseRef.current } catch { /* non-blocking — visit failure doesn't stop order */ }
      }
      // Sync React state → sessionStorage as final safety net
      const resolvedVisitName = visitName || sessionStorage.getItem("visitName")
      if (resolvedVisitName) sessionStorage.setItem("visitName", resolvedVisitName)

      router.push("/sales-rep/invoice")
    } else if (orderType === "no-order" && selectedReasons.length > 0) {
      // Update existing visit with no-order info and check out
      const vn = visitName || sessionStorage.getItem("visitName")
      if (vn) {
        try {
          await salesApi.updateVisit(vn, {
            visit_type: "No Order - Visit Only",
            has_order: 0,
            notes: t('sr.order.no_order_notes').replace('{reasons}', selectedReasons.join(", ")),
          })
          // Check out
          let lat = 0, lng = 0
          try {
            const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
              navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 10_000 })
            })
            lat = pos.coords.latitude
            lng = pos.coords.longitude
          } catch { /* GPS optional */ }
          await salesApi.checkOut(vn, lat, lng)
        } catch (err) {
          console.warn("[CheckOut] Failed:", err)
        }
        sessionStorage.removeItem("visitName")
        sessionStorage.removeItem("visitCustomer")
      } else if (salesPerson && customer) {
        // Fallback: create visit if no check-in visit exists
        // ✅ Include check_in_time + check_out_time so backend has a complete record
        const now = localDateTimeISO()
        salesApi.createVisit({
          sales_person: salesPerson.name,
          customer: customer.name,
          visit_date: localDateISO(),
          visit_status: "Completed",
          visit_type: "No Order - Visit Only",
          has_order: 0,
          notes: t('sr.order.no_order_notes').replace('{reasons}', selectedReasons.join(", ")),
          check_in_time: now,
          check_out_time: now,
        } as any).catch(err => console.error("Failed to create visit:", err))
      }
      setShowVisitSummary(true)
      return
    }
  }

  const handleBack = () => {
    if (!isExistingCustomer && currentStage === "order") {
      setCurrentStage("customer-info")
    } else if (isExistingCustomer && step === "products") {
      setStep("inventory")
    } else {
      router.push("/sales-rep")
    }
  }

  const handleCustomerInfoNext = async () => {
    if (!customerInfo.name || !customerInfo.phone || !customerInfo.address) return
    if (!customerInfo.customer_group) {
      toast({ title: t('sr.order.toast_required_title'), description: t('sr.order.choose_group'), variant: "destructive" })
      return
    }

    setCreatingCustomer(true)
    try {
      // Prefer the map pin; fall back to raw coordinates typed in the address
      const parsed = customerInfo.address.match(/^(-?\d+\.?\d*),\s*(-?\d+\.?\d*)$/)
      const lat = customerCoords?.lat || (parsed ? parsed[1] : undefined)
      const lng = customerCoords?.lng || (parsed ? parsed[2] : undefined)

      const newCustomer = await salesApi.createCustomer({
        customer_name: customerInfo.name,
        customer_type: customerInfo.customer_type,
        customer_group: customerInfo.customer_group,
        territory: customerInfo.territory || undefined,
        tax_id: customerInfo.taxNumber || undefined,
        mobile_no: customerInfo.phone || undefined,
        primary_sales_person: salesPerson?.name,
        ...(lat && lng ? { customer_lat: lat, customer_lng: lng } : {}),
      })

      if (newCustomer) {
        setCustomer(newCustomer)
        setCurrentStage("wants-order")
      } else {
        toast({ title: t('sr.common.error'), description: t('sr.order.toast_create_failed_desc'), variant: "destructive" })
      }
    } catch (err: any) {
      console.error("Failed to create customer:", err)
      const msg = err?.message || ""
      if (msg.includes("LinkValidationError") || msg.includes("Could not find")) {
        toast({ title: t('sr.order.toast_data_error_title'), description: msg, variant: "destructive" })
      } else {
        toast({ title: t('sr.order.toast_create_failed_title'), description: msg || t('sr.order.unexpected_error'), variant: "destructive" })
      }
    } finally {
      setCreatingCustomer(false)
    }
  }

  const handleWantsOrderResponse = (wantsOrder: boolean) => {
    if (wantsOrder) {
      setCurrentStage("order")
      setOrderType("order")
      setStep("products")
    } else {
      toast({ title: t('sr.order.toast_saved_title'), description: t('sr.order.toast_saved_desc') })
      router.push("/sales-rep")
    }
  }

  if (loadingCustomer) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-10 h-10 animate-spin text-primary mx-auto mb-3" />
          <p className="text-muted-foreground">{t('sr.order.loading_customer')}</p>
        </div>
      </div>
    )
  }

  // Stage: Customer Info (new customer)
  if (!isExistingCustomer && currentStage === "customer-info") {
    return (
      <div className="min-h-screen bg-slate-50 pb-24">
        <div className="bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 text-white pb-8 px-5 rounded-b-[2rem]">
          <div className="pt-8">
            <div className="flex items-center justify-between">
              <Button
                variant="ghost"
                size="sm"
                className="text-white hover:bg-white/20"
                onClick={() => router.push("/sales-rep")}
              >
                <ArrowRight className="w-5 h-5" />
              </Button>
              <h1 className="text-xl font-bold">{t('sr.order.new_customer_data_title')}</h1>
              <div className="w-10" />
            </div>
          </div>
        </div>

        <div className="px-4 md:px-6 py-5">
          <Card className="p-5 rounded-2xl bg-white border border-slate-200">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
                <User className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <h2 className="font-bold text-base text-slate-800">{t('sr.order.customer_info')}</h2>
                <p className="text-xs text-slate-500">{t('sr.order.customer_info_hint')}</p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <Label htmlFor="name" className="text-sm font-medium mb-2 block text-slate-700">
                  {t('sr.order.field_name')} <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="name"
                  placeholder={t('sr.order.ph_name')}
                  value={customerInfo.name}
                  onChange={(e) => setCustomerInfo({ ...customerInfo, name: e.target.value })}
                  className="h-11 text-sm border-slate-200"
                />
              </div>
              <div>
                <Label htmlFor="phone" className="text-sm font-medium mb-2 block text-slate-700">
                  {t('sr.order.field_phone')} <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="phone"
                  type="tel"
                  placeholder={t('sr.order.ph_phone')}
                  value={customerInfo.phone}
                  onChange={(e) => setCustomerInfo({ ...customerInfo, phone: e.target.value })}
                  className="h-11 text-sm border-slate-200"
                  dir="ltr"
                />
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label htmlFor="address" className="text-sm font-medium text-slate-700">
                    {t('sr.order.field_address')} <span className="text-red-500">*</span>
                  </Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 h-8 text-xs"
                    onClick={detectLocation}
                    disabled={locationLoading}
                  >
                    {locationLoading ? t('sr.order.locating_btn') : t('sr.order.auto_detect')}
                  </Button>
                </div>
                <Input
                  id="address"
                  placeholder={t('sr.order.ph_address')}
                  value={customerInfo.address}
                  onChange={(e) => setCustomerInfo({ ...customerInfo, address: e.target.value })}
                  className="h-11 text-sm border-slate-200"
                />
                {/* Pin map — auto-detect drops the pin here; the rep can tap/search to adjust */}
                <div className="mt-3">
                  <LocationPickerMap
                    lat={customerCoords?.lat || ''}
                    lng={customerCoords?.lng || ''}
                    onChange={(lat, lng) => setPin(lat, lng)}
                    height="240px"
                  />
                  <p className="text-[11px] text-slate-400 mt-1.5">
                    {customerCoords
                      ? t('sr.order.location_set').replace('{lat}', Number(customerCoords.lat).toFixed(5)).replace('{lng}', Number(customerCoords.lng).toFixed(5))
                      : t('sr.order.location_hint')}
                  </p>
                </div>
              </div>
              <div>
                <Label className="text-sm font-medium mb-2 block text-slate-700">{t('sr.order.field_type')}</Label>
                <Select
                  value={customerInfo.customer_type}
                  onValueChange={(v: "Company" | "Individual") => setCustomerInfo({ ...customerInfo, customer_type: v })}
                >
                  <SelectTrigger className="h-11 text-sm border-slate-200">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Company">{t('sr.order.type_company')}</SelectItem>
                    <SelectItem value="Individual">{t('sr.order.type_individual')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-sm font-medium mb-2 block text-slate-700">
                  {t('sr.order.field_group')} <span className="text-red-500">*</span>
                </Label>
                <Select
                  value={customerInfo.customer_group}
                  onValueChange={(v) => setCustomerInfo({ ...customerInfo, customer_group: v })}
                >
                  <SelectTrigger aria-label={t('sr.order.choose_group')} className="h-11 text-sm border-slate-200">
                    <SelectValue placeholder={t('sr.order.choose_group')} />
                  </SelectTrigger>
                  <SelectContent>
                    {customerGroups.map(g => <SelectItem key={g} value={g}>{customerGroupLabel(t, g)}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-sm font-medium mb-2 block text-slate-700">{t('sr.order.field_territory')}</Label>
                <Select
                  value={customerInfo.territory}
                  onValueChange={(v) => setCustomerInfo({ ...customerInfo, territory: v })}
                >
                  <SelectTrigger aria-label={t('sr.order.ph_territory')} className="h-11 text-sm border-slate-200">
                    <SelectValue placeholder={t('sr.order.ph_territory')} />
                  </SelectTrigger>
                  <SelectContent>
                    {territories.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="taxNumber" className="text-sm font-medium mb-2 block text-slate-700">
                  {t('sr.order.field_tax')}
                </Label>
                <Input
                  id="taxNumber"
                  placeholder={t('sr.order.ph_tax')}
                  value={customerInfo.taxNumber}
                  onChange={(e) => setCustomerInfo({ ...customerInfo, taxNumber: e.target.value })}
                  className="h-11 text-sm border-slate-200"
                />
              </div>
            </div>
          </Card>
        </div>

        <div className="fixed bottom-16 left-0 right-0 bg-white border-t border-slate-200 shadow-lg z-20">
          <div className="px-4 md:px-6 py-4">
            <Button
              size="lg"
              className="w-full py-6 text-base rounded-xl font-bold bg-blue-600 hover:bg-blue-700 text-white"
              disabled={!customerInfo.name || !customerInfo.phone || !customerInfo.address || !customerInfo.customer_group || creatingCustomer}
              onClick={handleCustomerInfoNext}
            >
              {creatingCustomer ? (
                <><Loader2 className="w-5 h-5 ml-2 animate-spin" /> {t('sr.order.creating')}</>
              ) : (
                <>{t('sr.order.next')} <ChevronRight className="w-5 h-5 mr-2" /></>
              )}
            </Button>
          </div>
        </div>
      </div>
    )
  }

  // Stage: Ask if customer wants to order now
  if (!isExistingCustomer && currentStage === "wants-order") {
    return (
      <div className="min-h-screen bg-slate-50">
        <div className="bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 text-white pb-8 px-5 rounded-b-[2rem]">
          <div className="pt-8">
            <div className="flex items-center justify-between">
              <Button
                variant="ghost"
                size="sm"
                className="text-white hover:bg-white/20"
                onClick={() => setCurrentStage("customer-info")}
              >
                <ArrowRight className="w-5 h-5" />
              </Button>
              <h1 className="text-xl font-bold">{t('sr.order.wants_order_title')}</h1>
              <div className="w-10" />
            </div>
          </div>
        </div>

        <div className="px-4 md:px-6 py-8">
          <Card className="p-6 rounded-2xl bg-white border border-slate-200 text-center">
            <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center mx-auto mb-4">
              <Package className="w-8 h-8 text-blue-600" />
            </div>
            <h2 className="font-bold text-lg text-slate-800 mb-2">{t('sr.order.wants_order_q')}</h2>
            <p className="text-sm text-slate-500 mb-6">{t('sr.order.wants_order_hint')}</p>

            <div className="space-y-3">
              <Button
                size="lg"
                className="w-full py-6 text-base rounded-xl font-bold bg-emerald-600 hover:bg-emerald-700 text-white"
                onClick={() => handleWantsOrderResponse(true)}
              >
                {t('sr.order.wants_yes')}
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="w-full py-6 text-base rounded-xl font-bold border-slate-300 hover:bg-slate-100 text-slate-700 bg-transparent"
                onClick={() => handleWantsOrderResponse(false)}
              >
                {t('sr.order.wants_no')}
              </Button>
            </div>
          </Card>
        </div>
      </div>
    )
  }

  // Main order stage
  return (
    <>
      <div className="min-h-screen bg-background pb-28">
        <div className="bg-primary text-primary-foreground sticky top-0 z-10 shadow-lg">
          <div className="px-4 md:px-6 py-5">
            <div className="flex items-center justify-between">
              <Button
                variant="ghost"
                size="sm"
                className="text-primary-foreground hover:bg-primary-foreground/20"
                onClick={handleBack}
              >
                <ArrowRight className="w-5 h-5" />
              </Button>
              <h1 className="text-xl font-bold truncate mx-2">
                {isExistingCustomer ? customer?.customer_name : t('sr.common.new_customer')}
              </h1>
              <div className="w-10" />
            </div>
          </div>
        </div>

        <div className="px-4 md:px-6 py-4">
          <Tabs
            value={orderType}
            onValueChange={(v) => setOrderType(v as "order" | "no-order")}
            className="w-full"
          >
            <TabsList className="grid w-full grid-cols-2 mb-6 bg-muted p-1 rounded-2xl h-14">
              <TabsTrigger
                value="order"
                className="rounded-xl text-base font-bold data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
              >
                {isExistingCustomer && step === "inventory" ? t('sr.order.tab_update_inventory') : t('sr.order.tab_wants_order')}
              </TabsTrigger>
              <TabsTrigger
                value="no-order"
                className="rounded-xl text-base font-bold data-[state=active]:bg-destructive data-[state=active]:text-destructive-foreground"
              >
                {t('sr.order.tab_no_order')}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="order" className="space-y-4 mt-4">
              {/* Step: Customer Inventory Update */}
              {isExistingCustomer && step === "inventory" ? (
                <>
                  <Card className="p-4 bg-blue-50 border-blue-200 mb-4">
                    <div className="flex items-start gap-3">
                      <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                      <div>
                        <h3 className="font-bold text-blue-900 mb-1">{t('sr.order.review_inv_title')}</h3>
                        <p className="text-sm text-blue-700">
                          {t('sr.order.review_inv_desc')}
                        </p>
                      </div>
                    </div>
                  </Card>

                  {customerInvItems.length > 0 ? (
                    customerInvItems.map((invItem) => {
                      const itemDetails = items.find(i => i.name === invItem.item_code)
                      const withdraw = getWithdrawItem(invItem.item_code)

                      return (
                        <Card key={invItem.item_code} className="p-4 rounded-xl border-2">
                          <div className="flex items-center gap-4 mb-3">
                            {itemDetails?.image && (
                              <img
                                src={frappeImageUrl(itemDetails.image)}
                                alt={invItem.item_name}
                                className="w-16 h-16 rounded-lg object-cover bg-muted flex-shrink-0"
                              />
                            )}
                            <div className="flex-1 min-w-0">
                              <h3 className="font-bold text-base mb-1 truncate">{invItem.item_name}</h3>
                              <p className="text-sm text-muted-foreground">{t('sr.order.customer_qty').replace('{qty}', String(invItem.qty))}</p>
                            </div>
                          </div>

                          {!withdraw ? (
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                className="border-orange-500 text-orange-600 hover:bg-orange-50 font-bold bg-transparent flex-1"
                                onClick={() =>
                                  addWithdrawItem(
                                    invItem.item_code,
                                    invItem.item_name,
                                    itemDetails?.standard_rate || 0
                                  )
                                }
                              >
                                <XCircle className="w-4 h-4 ml-1" />
                                {t('sr.order.withdraw_product')}
                              </Button>
                            </div>
                          ) : (
                            <div className="space-y-3 mt-3 pt-3 border-t bg-orange-50 -mx-4 -mb-4 p-4 rounded-b-xl">
                              <div className="flex items-center gap-2">
                                <Label className="text-sm font-medium min-w-[60px]">{t('sr.order.reason_label')}</Label>
                                <Select
                                  value={withdraw.reason}
                                  onValueChange={(v) => updateWithdrawReason(invItem.item_code, v)}
                                >
                                  <SelectTrigger className="flex-1">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {WITHDRAW_REASONS.map(r => (
                                      <SelectItem key={r.id} value={r.id}>{t(r.labelKey)}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>

                              {withdraw.reason === "Other" && (
                                <Input
                                  placeholder={t('sr.order.ph_custom_reason')}
                                  value={withdraw.customReason || ""}
                                  onChange={(e) =>
                                    updateWithdrawReason(invItem.item_code, withdraw.reason, e.target.value)
                                  }
                                />
                              )}

                              <div className="flex items-center justify-between">
                                <span className="text-sm font-medium">{t('sr.order.qty_label')}</span>
                                <div className="flex items-center gap-2 bg-orange-200 rounded-full px-2 py-1.5">
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-8 w-8 rounded-full bg-white hover:bg-muted"
                                    onClick={() => updateWithdrawQty(invItem.item_code, -1)}
                                    disabled={withdraw.qty <= 1}
                                  >
                                    <Minus className="w-4 h-4" />
                                  </Button>
                                  <span className="font-bold text-lg min-w-[2.5rem] text-center">
                                    {withdraw.qty}
                                  </span>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-8 w-8 rounded-full bg-orange-500 hover:bg-orange-600 text-white"
                                    onClick={() => updateWithdrawQty(invItem.item_code, 1)}
                                    disabled={withdraw.qty >= invItem.qty}
                                  >
                                    <Plus className="w-4 h-4" />
                                  </Button>
                                </div>
                              </div>

                              <Button
                                size="sm"
                                variant="ghost"
                                className="w-full text-red-600 hover:text-red-700 hover:bg-red-50"
                                onClick={() => removeWithdrawItem(invItem.item_code)}
                              >
                                {t('sr.order.cancel_withdraw')}
                              </Button>
                            </div>
                          )}
                        </Card>
                      )
                    })
                  ) : (
                    <Card className="p-8 text-center">
                      <Package className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                      <p className="text-muted-foreground mb-2">{t('sr.order.no_inv_record')}</p>
                      <p className="text-sm text-muted-foreground">{t('sr.order.no_inv_hint')}</p>
                    </Card>
                  )}
                </>
              ) : (
                /* Step: Product Selection */
                <>
                  {isExistingCustomer && withdrawItems.length > 0 && (
                    <Card className="p-4 bg-orange-50 border-orange-200 mb-4">
                      <h3 className="font-bold text-orange-900 mb-3">{t('sr.order.replace_question')}</h3>
                      <div className="space-y-2">
                        {withdrawItems.map(item => (
                          <div key={item.item_code} className="flex items-center justify-between p-2 bg-white rounded-lg">
                            <div className="flex items-center gap-2">
                              <Checkbox
                                id={`replace-${item.item_code}`}
                                checked={replacementItems[item.item_code] || false}
                                onCheckedChange={() =>
                                  setReplacementItems(prev => ({ ...prev, [item.item_code]: !prev[item.item_code] }))
                                }
                              />
                              <Label htmlFor={`replace-${item.item_code}`} className="cursor-pointer">
                                {t('sr.order.replace_item').replace('{name}', item.item_name).replace('{n}', String(item.qty))}
                              </Label>
                            </div>
                            <Badge variant="outline" className="text-xs">
                              {withdrawReasonLabel(item.reason)}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    </Card>
                  )}

                  {/* Available items from rep stock */}
                  <div className="space-y-3">
                    {repStock.length === 0 ? (
                      <Card className="p-8 text-center">
                        <Package className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                        <p className="text-muted-foreground">{t('sr.order.no_stock_available')}</p>
                      </Card>
                    ) : (
                      repStock.map((stock) => {
                        const itemDetails = items.find(i => i.name === stock.item_code)
                        const orderQty = getOrderQty(stock.item_code)

                        return (
                          <Card
                            key={stock.item_code}
                            className={`p-4 rounded-xl border-2 transition-all ${orderQty > 0 ? "border-primary bg-primary/5" : "border-border"
                              }`}
                          >
                            <div className="flex items-start gap-4 mb-3">
                              {itemDetails?.image && (
                                <img
                                  src={frappeImageUrl(itemDetails.image)}
                                  alt={stock.item_name || stock.item_code}
                                  className="w-20 h-20 rounded-xl object-cover bg-muted flex-shrink-0"
                                />
                              )}
                              <div className="flex-1 min-w-0">
                                <h3 className="font-bold text-lg mb-1 truncate">{stock.item_name || stock.item_code}</h3>
                                <p className="text-sm text-muted-foreground">{stock.stock_uom || t('sr.common.unit_default')}</p>
                                <div className="flex items-center gap-2 flex-wrap mt-1">
                                  {itemDetails?.item_group && (
                                    <Badge variant="secondary" className="text-xs">
                                      {itemDetails.item_group}
                                    </Badge>
                                  )}
                                  <span className="text-base font-bold text-primary">
                                    {t('sr.common.amount_sar').replace('{amount}', (itemDetails?.standard_rate || stock.valuation_rate || 0).toFixed(2))}
                                  </span>
                                </div>
                                <p className="text-xs text-muted-foreground mt-1">
                                  {t('sr.order.available_qty').replace('{qty}', String(stock.actual_qty)).replace('{uom}', stock.stock_uom || t('sr.common.unit_default'))}
                                </p>
                                {orderQty > 0 && (
                                  <Badge className="bg-primary text-primary-foreground mt-1">
                                    {t('sr.order.selected_qty').replace('{qty}', String(orderQty))}
                                  </Badge>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center gap-2">
                              {orderQty > 0 ? (
                                <div className="flex items-center gap-2 bg-primary/10 rounded-full px-2 py-1.5 flex-1">
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-9 w-9 rounded-full bg-background hover:bg-muted text-primary flex-shrink-0"
                                    onClick={() => updateOrderItemQty(stock.item_code, -1)}
                                  >
                                    <Minus className="w-4 h-4" />
                                  </Button>
                                  <span className="font-bold text-lg min-w-[2rem] text-center text-primary">
                                    {orderQty}
                                  </span>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-9 w-9 rounded-full bg-primary hover:bg-primary/90 text-primary-foreground flex-shrink-0"
                                    onClick={() => updateOrderItemQty(stock.item_code, 1)}
                                    disabled={orderQty >= stock.actual_qty}
                                  >
                                    <Plus className="w-4 h-4" />
                                  </Button>
                                </div>
                              ) : (
                                <Button
                                  size="sm"
                                  className="flex-1 bg-primary hover:bg-primary/90"
                                  onClick={() => addOrderItem(stock.item_code)}
                                  disabled={stock.actual_qty === 0}
                                >
                                  <Plus className="w-4 h-4 ml-1" />
                                  {t('sr.order.add')}
                                </Button>
                              )}
                            </div>
                          </Card>
                        )
                      })
                    )}
                  </div>
                </>
              )}
            </TabsContent>

            <TabsContent value="no-order" className="space-y-4 mt-6">
              <Card className="p-6 rounded-2xl">
                <h3 className="font-bold text-lg mb-4">{t('sr.order.select_rejection')}</h3>
                <div className="space-y-4">
                  {REJECTION_REASONS.map((reason) => (
                    <div key={reason.id} className="flex items-center space-x-3 space-x-reverse">
                      <Checkbox
                        id={reason.id}
                        checked={selectedReasons.includes(reason.id)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setSelectedReasons([...selectedReasons, reason.id])
                          } else {
                            setSelectedReasons(selectedReasons.filter((id) => id !== reason.id))
                          }
                        }}
                        className="data-[state=checked]:bg-destructive data-[state=checked]:border-destructive"
                      />
                      <Label htmlFor={reason.id} className="text-base font-medium leading-none cursor-pointer">
                        {t(reason.labelKey)}
                      </Label>
                    </div>
                  ))}
                </div>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        {/* Bottom Bar */}
        <div className="fixed bottom-16 left-0 right-0 bg-card border-t-2 border-border shadow-lg z-20">
          <div className="px-4 md:px-6 py-4">
            <div className="flex items-center justify-between gap-4">
              {orderType === "order" ? (
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-muted-foreground">
                    {isExistingCustomer && step === "inventory" ? t('sr.order.review_inv_short')
                      : getTotalOrderItems() > 0 ? t('sr.order.total_products')
                        : withdrawItems.length > 0 ? t('sr.order.withdrawn_products')
                          : t('sr.order.total_products')}
                  </div>
                  <div className="text-2xl font-bold text-primary">
                    {isExistingCustomer && step === "inventory"
                      ? t('sr.common.count_products').replace('{n}', String(customerInvItems.length))
                      : getTotalOrderItems() > 0
                        ? t('sr.common.count_products').replace('{n}', String(getTotalOrderItems()))
                        : withdrawItems.length > 0
                          ? t('sr.order.count_withdraw').replace('{n}', String(withdrawItems.reduce((sum, w) => sum + w.qty, 0)))
                          : t('sr.common.count_products').replace('{n}', '0')}
                  </div>
                </div>
              ) : (
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-muted-foreground">{t('sr.order.selected_reasons')}</div>
                  <div className="text-2xl font-bold text-destructive">{t('sr.order.count_reasons').replace('{n}', String(selectedReasons.length))}</div>
                </div>
              )}
              <Button
                size="lg"
                className={`px-6 py-6 text-lg rounded-2xl font-bold flex-shrink-0 ${orderType === "order"
                  ? "bg-primary hover:bg-primary/90"
                  : "bg-destructive hover:bg-destructive/90"
                  }`}
                disabled={!canCompleteOrder()}
                onClick={handleNext}
              >
                {orderType === "order"
                  ? isExistingCustomer && step === "inventory"
                    ? t('sr.order.next')
                    : t('sr.order.finish_order')
                  : t('sr.order.register')}
                <ChevronRight className="w-5 h-5 mr-2" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Visit Summary Dialog */}
      <VisitSummaryDialog
        open={showVisitSummary}
        onComplete={() => {
          setShowVisitSummary(false)
          router.push("/sales-rep")
        }}
        customerName={customer?.customer_name || ""}
        customerId={customer?.name || ""}
        salesPersonName={salesPerson?.name || ""}
        visitName={visitName || sessionStorage?.getItem?.("visitName") || ""}
        hadOrder={false}
      />
    </>
  )
}

export default function NewOrderPage() {
  const { t } = useI18n()
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-background flex items-center justify-center">
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-muted-foreground">{t('sr.common.loading')}</p>
          </div>
        </div>
      }
    >
      <NewOrderContent />
    </Suspense>
  )
}
