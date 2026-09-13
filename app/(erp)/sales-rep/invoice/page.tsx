"use client"

import { useState, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { ArrowRight, Check, Percent, DollarSign, AlertCircle, Loader2, Wallet } from "lucide-react"
import { useRouter } from "next/navigation"
import { useToast } from "@/hooks/use-toast"
import { salesApi, localDateISO, localDateTimeISO } from "@/lib/sales-api"
import { stockApi } from "@/lib/stock-api"
import { frappeClient } from "@/lib/api-client"
import { frappeImageUrl } from "@/lib/utils"
import { useSalesRep } from "@/contexts/SalesRepContext"
import { VisitSummaryDialog } from "@/components/sales/visit-summary-dialog"
import { ZatcaQRDialog } from "@/components/sales/zatca-status-badge"
import { useI18n } from "@/lib/i18n"

interface OrderItem {
  item_code: string
  item_name: string
  qty: number
  rate: number
  stock_uom: string
  image?: string
  discount?: {
    type: "fixed" | "percentage"
    value: number
  }
}

interface WithdrawItem {
  item_code: string
  item_name: string
  qty: number
  rate: number
  reason: string
  customReason?: string
}

/** Backend validation messages arrive as HTML (_server_messages) — flatten for toasts. */
const stripServerMessage = (err: unknown): string =>
  ((err as { message?: string })?.message || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()

export default function InvoicePage() {
  const router = useRouter()
  const { t, dir } = useI18n()
  const { company: salesRepCompany } = useSalesRep()

  // Backend enum id → translated label (ids are backend values — do not translate)
  const withdrawReasonLabels: Record<string, string> = {
    "Damaged": t("sr.withdraw.damaged"),
    "Expired": t("sr.withdraw.expired"),
    "Wrong Product": t("sr.withdraw.wrong_product"),
    "Quality Issue": t("sr.withdraw.quality_issue"),
    "Other": t("sr.withdraw.other"),
  }

  // Format an amount with the localized SAR unit
  const fmtSAR = (v: number) => t("sr.common.amount_sar").replace("{amount}", v.toFixed(2))
  const [orderItems, setOrderItems] = useState<OrderItem[]>([])
  const [withdrawItems, setWithdrawItems] = useState<WithdrawItem[]>([])
  const [replacementItems, setReplacementItems] = useState<{ [key: string]: boolean }>({})
  const [customerId, setCustomerId] = useState<string>("")
  const [customerName, setCustomerName] = useState<string>("")
  const [salesPerson, setSalesPerson] = useState<string>("")
  const [salesWarehouse, setSalesWarehouse] = useState<string>("")
  const [loadingData, setLoadingData] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [showVisitSummary, setShowVisitSummary] = useState(false)
  const [completedVisitName, setCompletedVisitName] = useState<string>("")
  const [taxAccount, setTaxAccount] = useState<string>("")
  const [taxTemplate, setTaxTemplate] = useState<string>("")
  const [customerCredit, setCustomerCredit] = useState<number>(0)
  const [applyCredit, setApplyCredit] = useState(true)
  // vatRate is resolved from the tax template; defaults to 0.15 (15%) until API responds
  const [vatRate, setVatRate] = useState<number>(0.15)

  const { toast } = useToast()

  // ZATCA E-Invoice state
  const [zatcaQROpen, setZatcaQROpen] = useState(false)
  const [zatcaQR, setZatcaQR] = useState<string>("")
  const [zatcaStatus, setZatcaStatus] = useState<string>("")
  const [zatcaInvoiceName, setZatcaInvoiceName] = useState<string>("")
  const [zatcaUUID, setZatcaUUID] = useState<string>("")

  // Resolve VAT tax account and template on mount
  useEffect(() => {
    async function loadTaxConfig() {
      // Get the company from SalesRepContext, fallback to fetching from API
      let company = salesRepCompany || ""
      if (!company) {
        try {
          const companies = await frappeClient.getList<{ name: string }>("Company", {
            fields: ["name"], limit_page_length: 1,
          })
          if (companies.length > 0) company = companies[0].name
        } catch { /* use default */ }
      }

      // 1) Try to find a default Sales Taxes and Charges Template
      try {
        const templates = await frappeClient.getList<{ name: string; is_default?: number }>("Sales Taxes and Charges Template", {
          filters: [["Sales Taxes and Charges Template", "company", "=", company]],
          fields: ["name", "is_default"],
          limit_page_length: 10,
        })
        const defaultTpl = templates.find(t => t.is_default) || templates[0]
        if (defaultTpl) {
          setTaxTemplate(defaultTpl.name)
          // ✅ Fetch the actual VAT rate from the template rows so UI matches backend
          try {
            const tplDoc = await frappeClient.get<{ taxes?: Array<{ rate?: number }> }>(
              "Sales Taxes and Charges Template", defaultTpl.name
            )
            const rateFromTpl = tplDoc?.data?.taxes?.[0]?.rate
            if (rateFromTpl != null && rateFromTpl > 0) {
              setVatRate(rateFromTpl / 100)
            }
          } catch { /* keep default 15% */ }
          return // Template will handle taxes automatically
        }
      } catch { /* no permission or no templates */ }

      // 2) Fallback: find a Tax account to use manually
      try {
        const accounts = await frappeClient.getList<{ name: string; is_group?: number }>("Account", {
          filters: [
            ["Account", "account_type", "=", "Tax"],
            ["Account", "company", "=", company],
            ["Account", "is_group", "=", 0],
          ],
          fields: ["name", "is_group"],
          limit_page_length: 10,
        })
        if (accounts.length > 0) {
          setTaxAccount(accounts[0].name)
        }
        // If no leaf tax account exists, taxAccount stays empty — SO/SI will be created without taxes
      } catch { /* ignore */ }
    }
    loadTaxConfig()
  }, [salesRepCompany])

  useEffect(() => {
    const storedItems = sessionStorage.getItem("orderItems")
    const storedWithdraws = sessionStorage.getItem("withdrawItems")
    const storedReplacements = sessionStorage.getItem("replacementItems")
    const storedCustomerId = sessionStorage.getItem("customerId")
    const storedCustomerName = sessionStorage.getItem("customerName")
    const storedSalesPerson = sessionStorage.getItem("salesPerson")

    if (storedItems) setOrderItems(JSON.parse(storedItems))
    if (storedWithdraws) setWithdrawItems(JSON.parse(storedWithdraws))
    if (storedReplacements) setReplacementItems(JSON.parse(storedReplacements))
    if (storedCustomerId) {
      setCustomerId(storedCustomerId)
      // Fetch customer credit balance
      salesApi.getCustomerCreditBalance(storedCustomerId)
        .then(balance => setCustomerCredit(balance))
        .catch(() => setCustomerCredit(0))
    }
    if (storedCustomerName) setCustomerName(storedCustomerName)
    if (storedSalesPerson) setSalesPerson(storedSalesPerson)

    const storedWarehouse = sessionStorage.getItem("salesWarehouse")
    if (storedWarehouse) {
      setSalesWarehouse(storedWarehouse)
      setLoadingData(false)
    } else {
      // Fallback: resolve warehouse from Sales Person if not in sessionStorage
      resolveWarehouse(storedSalesPerson || "").then(() => setLoadingData(false))
    }
  }, [])

  const resolveWarehouse = async (spName: string) => {
    if (!spName) return
    try {
      // Try to get inventory_warehouse from Sales Person
      const resp = await frappeClient.get<{ inventory_warehouse?: string }>("Sales Person", spName)
      const sp = resp?.data
      if (sp?.inventory_warehouse) {
        setSalesWarehouse(sp.inventory_warehouse)
        return
      }
    } catch (err) {
      console.warn("[Invoice] Failed to get Sales Person warehouse:", err)
    }
    try {
      // Try linked warehouse
      const warehouses = await stockApi.getWarehouses({
        filters: [
          ["Warehouse", "custom_linked_sales_person", "=", spName],
          ["Warehouse", "disabled", "=", 0],
        ],
        fields: ["name"],
      })
      if (warehouses.length > 0) {
        setSalesWarehouse(warehouses[0].name)
      }
    } catch (err) {
      console.warn("[Invoice] Failed to find linked warehouse:", err)
    }
  }

  const updateDiscount = (itemCode: string, type: "fixed" | "percentage", value: string) => {
    const numValue = parseFloat(value) || 0
    setOrderItems(
      orderItems.map((item) =>
        item.item_code === itemCode
          ? { ...item, discount: numValue > 0 ? { type, value: numValue } : undefined }
          : item
      )
    )
  }

  const calculateItemTotal = (item: OrderItem) => {
    const subtotal = item.rate * item.qty
    if (!item.discount) return subtotal
    if (item.discount.type === "fixed") return Math.max(0, subtotal - item.discount.value)
    return subtotal * (1 - item.discount.value / 100)
  }

  const calculateWithdrawTotal = () =>
    withdrawItems.reduce((sum, item) => {
      if (replacementItems[item.item_code]) return sum
      return sum + item.rate * item.qty
    }, 0)

  const calculateSubtotal = () =>
    orderItems.reduce((sum, item) => sum + item.rate * item.qty, 0)

  const calculateTotalDiscount = () =>
    orderItems.reduce((sum, item) => sum + (item.rate * item.qty - calculateItemTotal(item)), 0)

  const calculateTotal = () =>
    orderItems.reduce((sum, item) => sum + calculateItemTotal(item), 0)

  // ✅ Uses vatRate resolved from tax template; falls back to 0.15 (15%)
  const calculateVAT = () => calculateTotal() * vatRate

  const calculateGrandTotal = () => calculateTotal() + calculateVAT()

  const calculateNetAmount = () => calculateGrandTotal() - calculateWithdrawTotal()

  const calculateCreditDeduction = () => {
    if (!applyCredit || customerCredit <= 0) return 0
    const netBeforeCredit = calculateGrandTotal() - calculateWithdrawTotal()
    return Math.min(customerCredit, Math.max(0, netBeforeCredit))
  }

  const calculateFinalAmount = () => {
    const net = calculateNetAmount()
    return Math.max(0, net - calculateCreditDeduction())
  }

  const handleSubmit = async () => {
    if (!customerId) {
      toast({ title: t("sr.common.error"), description: t("sr.invoice.toast_no_customer"), variant: "destructive" })
      return
    }

    if (orderItems.length > 0 && !salesWarehouse) {
      toast({
        title: t("sr.invoice.toast_no_wh_title"),
        description: t("sr.invoice.toast_no_wh_desc"),
        variant: "destructive",
      })
      return
    }

    setSubmitting(true)
    // Delivery outcome of step 4 — gates the customer-inventory bookkeeping in
    // step 6 so app-side state is only advanced when stock actually moved.
    let dnSubmitted = false
    let deliveryNoteName = ''
    try {
      // 1. Update existing visit (created during check-in) instead of creating a new one
      const existingVisitName = sessionStorage.getItem("visitName")
      if (existingVisitName && salesPerson) {
        try {
          const hasOrder = orderItems.length > 0
          await salesApi.updateVisit(existingVisitName, {
            visit_type: hasOrder ? "Sales Order" : "Product Return",
            has_order: hasOrder ? 1 : 0,
          })
        } catch (err) {
          console.warn("[Invoice] Failed to update visit:", err)
        }
      } else if (salesPerson && customerId) {
        // Fallback: create visit if no check-in visit
        try {
          const hasOrder = orderItems.length > 0
          await salesApi.createVisit({
            sales_person: salesPerson,
            customer: customerId,
            visit_date: localDateISO(),
            visit_status: "Completed",
            visit_type: hasOrder ? "Sales Order" : "Product Return",
            has_order: hasOrder ? 1 : 0,
          })
        } catch (err) {
          console.error("Failed to create visit:", err)
        }
      }

      // 2. Handle product returns if any
      if (withdrawItems.length > 0 && salesPerson) {
        // 2a. Create Product Return From Customer docs (inventory tracking)
        for (const wi of withdrawItems) {
          try {
            const returnDoc = await salesApi.createProductReturn({
              return_date: localDateISO(),
              sales_person: salesPerson,
              customer: customerId,
              return_reason: wi.reason as "Damaged" | "Expired" | "Wrong Product" | "Quality Issue" | "Other",
              items: [{
                item_code: wi.item_code,
                item_name: wi.item_name,
                qty: wi.qty,
                rate: wi.rate,
              }],
            })

            // Submit the return
            if (returnDoc?.name) {
              try {
                await salesApi.submitProductReturn(returnDoc.name)
              } catch {
                console.error("Failed to submit product return")
              }
            }
          } catch (err) {
            console.error("Failed to create product return:", err)
          }
        }

        // 2b. Create Credit Note (Sales Invoice is_return=1) for non-replacement items
        //     so the customer gets a financial credit for the returned goods
        const creditableItems = withdrawItems.filter(wi => !replacementItems[wi.item_code])
        if (creditableItems.length > 0) {
          try {
            // Build tax config same as order
            const creditTaxConfig: Record<string, any> = {}
            if (taxTemplate) {
              creditTaxConfig.taxes_and_charges = taxTemplate
            } else if (taxAccount) {
              creditTaxConfig.taxes = [{
                charge_type: "On Net Total",
                account_head: taxAccount,
                description: "ضريبة القيمة المضافة 15%",
                rate: 15,
              }]
            }

            const creditNote = await salesApi.createCreditNote({
              customer: customerId,
              company: salesRepCompany || undefined,
              posting_date: localDateISO(),
              items: creditableItems.map(wi => ({
                item_code: wi.item_code,
                item_name: wi.item_name,
                qty: wi.qty, // API will negate
                rate: wi.rate,
                ...(salesWarehouse ? { warehouse: salesWarehouse } : {}),
              })),
              sales_person: salesPerson,
              ...creditTaxConfig,
            })

            if (creditNote?.name) {
              console.log("[Invoice] Credit Note created:", creditNote.name)
              // Try to submit the Credit Note
              try {
                await salesApi.submitSalesInvoice(creditNote.name)
                console.log("[Invoice] Credit Note submitted:", creditNote.name)
              } catch (err) {
                console.warn("[Invoice] Credit Note created as draft — submit failed:", err)
              }
            }
          } catch (err) {
            console.error("[Invoice] Failed to create Credit Note:", err)
          }
        }
      }

      // 3. Create Sales Order, Delivery Note, Sales Invoice
      if (orderItems.length > 0) {
        try {
          const soItems = orderItems.map(item => ({
            item_code: item.item_code,
            item_name: item.item_name,
            qty: item.qty,
            rate: item.discount
              ? item.discount.type === "fixed"
                ? Math.max(0, item.rate - item.discount.value / item.qty)
                : item.rate * (1 - item.discount.value / 100)
              : item.rate,
            uom: item.stock_uom,
            ...(salesWarehouse ? { warehouse: salesWarehouse } : {}),
          }))

          // Build tax configuration for 15% VAT
          const taxConfig: Record<string, any> = {}
          if (taxTemplate) {
            taxConfig.taxes_and_charges = taxTemplate
          } else if (taxAccount) {
            taxConfig.taxes = [{
              charge_type: "On Net Total",
              account_head: taxAccount,
              description: `ضريبة القيمة المضافة ${Math.round(vatRate * 100)}%`,
              rate: Math.round(vatRate * 100),
            }]
          }

          // ✅ Apply customer credit as additional_discount_amount on the SO
          const creditDeduction = calculateCreditDeduction()
          const salesOrder = await salesApi.createSalesOrder({
            customer: customerId,
            transaction_date: localDateISO(),
            delivery_date: localDateISO(),
            order_type: "Sales",
            ...(salesWarehouse ? { set_warehouse: salesWarehouse } : {}),
            items: soItems,
            ...taxConfig,
            ...(creditDeduction > 0 ? {
              additional_discount_amount: creditDeduction,
              apply_discount_on: "Grand Total",
            } : {}),
            ...(salesPerson ? {
              sales_team: [{ sales_person: salesPerson, allocated_percentage: 100 }],
            } : {}),
          })

          if (!salesOrder?.name) {
            throw new Error(t("sr.invoice.err_so_create"))
          }

          // Submit the Sales Order — a rejection here (e.g. the van stock
          // validation) is FATAL: remove the unusable draft, keep the cart,
          // and surface the backend's actual reason to the rep.
          try {
            await salesApi.submitSalesOrder(salesOrder.name)
          } catch (err: any) {
            console.error("[Invoice] SO submit rejected:", err)
            try { await frappeClient.delete('Sales Order', salesOrder.name) } catch { /* draft stays for admin review */ }
            const reason = stripServerMessage(err)
            throw new Error((reason ? reason + " — " : "") + t("sr.invoice.err_so_submit"))
          }

          // 4. Delivery Note — the step that actually moves stock. If any part
          // fails, the order must not stay booked: roll the SO back and stop.
          try {
            const dnData = await salesApi.createDeliveryNoteFromSO(salesOrder.name)
            const dnDoc = dnData?.message
            if (!dnDoc) throw new Error("make_delivery_note returned no doc")
            const savedDN = await salesApi.saveDeliveryNote({
              ...dnDoc,
              doctype: 'Delivery Note',
              ...(salesWarehouse ? { set_warehouse: salesWarehouse } : {}),
            })
            if (!savedDN?.name) throw new Error("Delivery Note save returned no name")
            await salesApi.submitDeliveryNote(savedDN.name)
            dnSubmitted = true
            deliveryNoteName = savedDN.name
            console.log("[Invoice] Delivery Note submitted:", savedDN.name)
          } catch (err: any) {
            console.error("[Invoice] Delivery failed — rolling back SO:", err)
            try {
              await salesApi.cancelSalesOrder(salesOrder.name)
            } catch (cancelErr) {
              console.error("[Invoice] SO rollback also failed:", cancelErr)
            }
            const reason = stripServerMessage(err)
            throw new Error((reason ? reason + " — " : "") + t("sr.invoice.err_dn_failed_so_cancelled"))
          }

          // 5. Sales Invoice from SO — stock has already moved, so a failure
          // here is NOT rolled back: surface it loudly for admin follow-up
          // and let the visit complete.
          try {
            const invoiceData = await salesApi.createInvoiceFromSO(salesOrder.name)
            const siDoc = invoiceData?.message
            if (!siDoc) throw new Error("make_sales_invoice returned no doc")

            // Clean up the blueprint — remove name/amended_from so Frappe auto-names it
            delete siDoc.name
            delete siDoc.amended_from
            siDoc.doctype = "Sales Invoice"
            if (salesWarehouse) siDoc.set_warehouse = salesWarehouse

            // Insert via RPC (more reliable than REST for blueprint docs)
            const insertRes = await frappeClient.call("frappe.client.insert", { doc: siDoc })
            const siName = insertRes?.message?.name
            if (!siName) throw new Error("Sales Invoice insert returned no name")
            console.log("[Invoice] Sales Invoice saved:", siName)

            await salesApi.submitSalesInvoice(siName)
            console.log("[Invoice] Sales Invoice submitted:", siName)

            // Fetch ZATCA status & QR code (ZATCA hooks run on submit)
            setZatcaInvoiceName(siName)
            try {
              // Wait a moment for ZATCA on_submit hook to process
              await new Promise(r => setTimeout(r, 2000))
              const siDoc2 = await frappeClient.getList<{
                custom_zatca_status?: string
                ksa_einv_qr?: string
                custom_uuid?: string
              }>('Sales Invoice', {
                filters: [['Sales Invoice', 'name', '=', siName]],
                fields: ['custom_zatca_status', 'ksa_einv_qr', 'custom_uuid'],
                limit_page_length: 1,
              })
              if (siDoc2.length > 0) {
                const z = siDoc2[0]
                if (z.custom_zatca_status) setZatcaStatus(z.custom_zatca_status)
                if (z.ksa_einv_qr) setZatcaQR(z.ksa_einv_qr)
                if (z.custom_uuid) setZatcaUUID(z.custom_uuid)
                console.log("[Invoice] ZATCA status:", z.custom_zatca_status, "QR:", z.ksa_einv_qr ? "present" : "none")
              }
            } catch (zatcaErr) {
              console.warn("[Invoice] Failed to fetch ZATCA status:", zatcaErr)
            }
          } catch (err) {
            console.error("[Invoice] Invoice failed after delivery:", err)
            toast({
              title: t("sr.invoice.toast_submit_error_title"),
              description: t("sr.invoice.err_si_failed_delivery_ok")
                .replace("{dn}", deliveryNoteName || "—")
                .replace("{so}", salesOrder.name),
              variant: "destructive",
            })
          }
        } catch (err) {
          // fatal pipeline failure — bubbles to the outer handler, which shows
          // the reason and PRESERVES the cart (no cleanup, no success screen)
          console.error("[Invoice] Order pipeline failed:", err)
          throw err
        }
      }

      // 6. Update Customer Inventory Record (handles both new orders and withdrawals).
      // Order items only count when the Delivery Note actually submitted —
      // app-side inventory must never advance past what ERPNext recorded.
      if (salesPerson && customerId && ((orderItems.length > 0 && dnSubmitted) || withdrawItems.length > 0)) {
        try {
          // Fetch existing customer inventory to get baseline
          const existingRecords = await salesApi.getCustomerInventory({
            filters: [["Customer Inventory Record", "customer", "=", customerId]],
          })
          console.log("[Invoice] Found", existingRecords.length, "existing inventory records for customer")

          // Build a map of current inventory: item_code → { item_name, current_stock }
          const inventoryMap = new Map<string, { item_name: string; current_stock: number }>()

          if (existingRecords.length > 0) {
            try {
              const latestRecord = await salesApi.getCustomerInventoryById(existingRecords[0].name)
              console.log("[Invoice] Latest record:", existingRecords[0].name, "items:", latestRecord?.items?.length || 0)
              if (latestRecord?.items) {
                for (const item of latestRecord.items) {
                  inventoryMap.set(item.item_code, {
                    item_name: item.item_name || item.item_code,
                    current_stock: item.current_stock ?? 0,
                  })
                }
              }
            } catch (err) {
              console.warn("[Invoice] Failed to fetch existing inventory details:", err)
            }
          }

          console.log("[Invoice] Existing inventory map:", Object.fromEntries(inventoryMap))

          // Add order items (increase quantities) — only what was delivered
          for (const item of dnSubmitted ? orderItems : []) {
            const existing = inventoryMap.get(item.item_code)
            if (existing) {
              existing.current_stock += item.qty
            } else {
              inventoryMap.set(item.item_code, {
                item_name: item.item_name,
                current_stock: item.qty,
              })
            }
          }

          // Subtract withdrawn items (decrease quantities)
          for (const item of withdrawItems) {
            const existing = inventoryMap.get(item.item_code)
            if (existing) {
              console.log("[Invoice] Withdrawing", item.qty, "of", item.item_code, "from", existing.current_stock)
              existing.current_stock = Math.max(0, existing.current_stock - item.qty)
            } else {
              console.warn("[Invoice] Withdraw item", item.item_code, "not found in existing inventory")
            }
          }

          // Create new inventory record with updated quantities
          // Include ALL items (even zero-stock) so the new record replaces the old one
          const updatedItems = Array.from(inventoryMap.entries())
            .map(([itemCode, v]) => ({
              item_code: itemCode,
              item_name: v.item_name,
              current_stock: Math.max(0, v.current_stock),
            }))

          console.log("[Invoice] Creating new inventory record with items:", JSON.stringify(updatedItems))

          if (updatedItems.length > 0) {
            const newRecord = await salesApi.createCustomerInventory({
              customer: customerId,
              sales_person: salesPerson,
              visit_date: localDateISO(),
              items: updatedItems,
            })
            console.log("[Invoice] Customer inventory record created:", newRecord?.name, "with", updatedItems.length, "items")
          } else {
            console.log("[Invoice] No items in inventory map - nothing to record")
          }
        } catch (err) {
          console.error("[Invoice] Failed to update customer inventory record:", err)
        }
      }

      // 7. Check out the visit (complete the check-in/check-out cycle)
      const visitNameForCheckout = sessionStorage.getItem("visitName")
      if (visitNameForCheckout) {
        try {
          let lat = 0, lng = 0
          try {
            const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
              navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 10_000 })
            })
            lat = pos.coords.latitude
            lng = pos.coords.longitude
          } catch { /* GPS optional */ }

          // Ensure the visit has a check_in_time (may be missing if check-in RPC failed)
          try {
            const visit = await salesApi.getVisit(visitNameForCheckout)
            if (visit && !visit.check_in_time) {
              console.warn("[Invoice] Visit missing check_in_time — applying manual check-in first")
              const now = localDateTimeISO()
              await salesApi.updateVisit(visitNameForCheckout, {
                check_in_time: now,
                visit_status: "In Progress",
              } as any)
            }
          } catch (fetchErr) {
            console.warn("[Invoice] Could not verify visit check_in_time:", fetchErr)
          }

          // Attempt RPC check-out
          try {
            await salesApi.checkOut(visitNameForCheckout, lat, lng)
          } catch (rpcErr) {
            console.warn("[Invoice] Check-out RPC failed, falling back to manual update:", rpcErr)
            // Fallback: manually set check_out_time
            try {
              const now = localDateTimeISO()
              await salesApi.updateVisit(visitNameForCheckout, {
                check_out_time: now,
                visit_status: "Completed",
                ...(lat !== 0 && lng !== 0
                  ? { check_out_lat: String(lat), check_out_lng: String(lng) }
                  : {}),
              } as any)
              console.log("[Invoice] Check-out fallback succeeded — visit marked Completed")
            } catch (fallbackErr) {
              console.warn("[Invoice] Check-out fallback also failed:", fallbackErr)
            }
          }
        } catch (err) {
          console.warn("[Invoice] Check-out failed:", err)
        }
      }

      // Save visit name before cleanup
      const savedVisitName = visitNameForCheckout || sessionStorage.getItem("visitName") || ""

      // Cleanup
      sessionStorage.removeItem("orderItems")
      sessionStorage.removeItem("withdrawItems")
      sessionStorage.removeItem("replacementItems")
      sessionStorage.removeItem("customerId")
      sessionStorage.removeItem("customerName")
      sessionStorage.removeItem("salesPerson")
      sessionStorage.removeItem("visitName")

      setCompletedVisitName(savedVisitName)
      setShowVisitSummary(true)
    } catch (err: any) {
      // Cart and visit session are intentionally NOT cleared here — the rep
      // sees the real reason and can retry the same order.
      console.error("Failed to submit order:", err)
      toast({
        title: t("sr.invoice.toast_submit_error_title"),
        description: stripServerMessage(err) || t("sr.invoice.toast_submit_error_desc"),
        variant: "destructive",
      })
    } finally {
      setSubmitting(false)
    }
  }

  if (loadingData) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <>
      <div className="min-h-screen bg-background pb-36" dir={dir}>
        {/* Header */}
        <div className="bg-primary text-primary-foreground sticky top-0 z-10 shadow-lg">
          <div className="px-4 md:px-6 py-5">
            <div className="flex items-center justify-between">
              <Button
                variant="ghost"
                size="sm"
                className="text-primary-foreground hover:bg-white/20"
                onClick={() => {
                  if (typeof window !== "undefined" && window.history.length > 1) {
                    router.back()
                  } else {
                    router.push("/sales-rep")
                  }
                }}
              >
                <ArrowRight className="w-5 h-5" />
              </Button>
              <div className="text-center">
                <h1 className="text-xl font-bold">{t("sr.invoice.title")}</h1>
                {customerName && <p className="text-sm text-primary-foreground/80">{customerName}</p>}
              </div>
              <div className="w-10" />
            </div>
          </div>
        </div>

        <div className="px-4 md:px-6 py-4 space-y-4">
          {/* Withdrawn Items */}
          {withdrawItems.length > 0 && (
            <Card className="p-5 rounded-2xl border-2 border-orange-300 bg-orange-50">
              <div className="flex items-start gap-3 mb-4">
                <AlertCircle className="w-5 h-5 text-orange-600 mt-1 flex-shrink-0" />
                <div className="flex-1">
                  <h3 className="font-bold text-lg text-orange-900 mb-2">{t("sr.invoice.withdrawn_from_customer")}</h3>
                  <p className="text-sm text-orange-700 mb-3">{t("sr.invoice.withdrawn_desc")}</p>
                </div>
              </div>
              <div className="space-y-2">
                {withdrawItems.map((item) => {
                  const isReplacing = replacementItems[item.item_code]
                  const itemValue = item.rate * item.qty
                  return (
                    <div key={item.item_code} className="bg-white rounded-xl p-3 flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold truncate">{item.item_name}</p>
                        <p className="text-sm text-muted-foreground">
                          {t("sr.invoice.qty_times_rate").replace("{qty}", String(item.qty)).replace("{rate}", item.rate.toFixed(2))}
                        </p>
                        <Badge variant="outline" className="text-xs mt-1">
                          {withdrawReasonLabels[item.reason] || item.reason}
                        </Badge>
                      </div>
                      <div className="text-left flex-shrink-0 mr-3">
                        <p className="font-bold text-orange-600">-{fmtSAR(itemValue)}</p>
                        {isReplacing && (
                          <Badge className="bg-blue-500 text-white text-xs mt-1">{t("sr.invoice.will_replace")}</Badge>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
              <Separator className="my-3" />
              <div className="flex justify-between items-center">
                <span className="font-semibold text-orange-900">{t("sr.invoice.withdraw_total")}</span>
                <span className="font-bold text-lg text-orange-600">
                  -{fmtSAR(calculateWithdrawTotal())}
                </span>
              </div>
            </Card>
          )}

          {/* Order Items */}
          {orderItems.length > 0 ? (
            orderItems.map((item) => {
              const itemSubtotal = item.rate * item.qty
              const itemTotal = calculateItemTotal(item)
              const itemDiscount = itemSubtotal - itemTotal

              return (
                <Card key={item.item_code} className="p-5 rounded-2xl">
                  <div className="flex items-start gap-4 mb-4">
                    {item.image && (
                      <img
                        src={frappeImageUrl(item.image)}
                        alt={item.item_name}
                        className="w-16 h-16 rounded-xl object-cover bg-muted flex-shrink-0"
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-base mb-1 truncate">{item.item_name}</h3>
                      <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                        <span>{t("sr.invoice.qty_x_rate").replace("{qty}", String(item.qty)).replace("{rate}", item.rate.toFixed(2))}</span>
                        <span>({item.stock_uom})</span>
                      </div>
                    </div>
                    <div className="text-left flex-shrink-0">
                      <div className="text-lg font-bold">{fmtSAR(itemTotal)}</div>
                      {itemDiscount > 0 && (
                        <div className="text-xs text-red-500 line-through">{fmtSAR(itemSubtotal)}</div>
                      )}
                    </div>
                  </div>

                  {/* Discount Controls */}
                  <div className="bg-muted/50 rounded-xl p-3">
                    <Label className="text-sm font-medium mb-2 block">{t("sr.invoice.item_discount")}</Label>
                    <div className="flex gap-2 items-end">
                      <Select
                        value={item.discount?.type || "percentage"}
                        onValueChange={(v) =>
                          updateDiscount(item.item_code, v as "fixed" | "percentage", String(item.discount?.value || 0))
                        }
                      >
                        <SelectTrigger className="w-28">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="percentage">
                            <div className="flex items-center gap-1">
                              <Percent className="w-3 h-3" />
                              {t("sr.invoice.discount_percent")}
                            </div>
                          </SelectItem>
                          <SelectItem value="fixed">
                            <div className="flex items-center gap-1">
                              <DollarSign className="w-3 h-3" />
                              {t("sr.invoice.discount_fixed")}
                            </div>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      <Input
                        type="number"
                        min="0"
                        placeholder="0"
                        value={item.discount?.value || ""}
                        onChange={(e) =>
                          updateDiscount(
                            item.item_code,
                            item.discount?.type || "percentage",
                            e.target.value
                          )
                        }
                        className="flex-1"
                      />
                    </div>
                  </div>
                </Card>
              )
            })
          ) : withdrawItems.length > 0 ? (
            <Card className="p-5 rounded-2xl text-center">
              <p className="text-muted-foreground">{t("sr.invoice.withdraw_only")}</p>
            </Card>
          ) : (
            <Card className="p-8 text-center">
              <p className="text-muted-foreground">{t("sr.invoice.no_items")}</p>
            </Card>
          )}

          {/* Customer Credit Balance Banner */}
          {customerCredit > 0 && (
            <Card className="p-4 rounded-2xl border-2 border-emerald-300 bg-emerald-50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                  <Wallet className="w-5 h-5 text-emerald-600" />
                </div>
                <div className="flex-1">
                  <p className="font-bold text-emerald-900">{t("sr.invoice.credit_title")}</p>
                  <p className="text-sm text-emerald-700">
                    {t("sr.invoice.credit_desc").split("{amount}")[0]}<span className="font-bold">{customerCredit.toFixed(2)}</span>{t("sr.invoice.credit_desc").split("{amount}")[1]}
                  </p>
                </div>
              </div>
              {orderItems.length > 0 && (
                <div className="mt-3 flex items-center gap-2">
                  <button
                    onClick={() => setApplyCredit(!applyCredit)}
                    className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${applyCredit ? 'bg-emerald-600' : 'bg-gray-300'
                      }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${applyCredit ? '-translate-x-4' : 'translate-x-0'
                        }`}
                    />
                  </button>
                  <span className="text-sm text-emerald-800 font-medium">
                    {applyCredit ? t("sr.invoice.credit_on") : t("sr.invoice.credit_off")}
                  </span>
                </div>
              )}
            </Card>
          )}

          {/* Invoice Summary */}
          {orderItems.length > 0 && (
            <Card className="p-5 rounded-2xl bg-primary/5 border-primary/30">
              <h3 className="font-bold text-lg mb-4">{t("sr.invoice.summary")}</h3>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t("sr.invoice.subtotal")}</span>
                  <span className="font-medium">{fmtSAR(calculateSubtotal())}</span>
                </div>
                {calculateTotalDiscount() > 0 && (
                  <div className="flex justify-between text-red-600">
                    <span>{t("sr.invoice.discount")}</span>
                    <span>-{fmtSAR(calculateTotalDiscount())}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t("sr.invoice.after_discount")}</span>
                  <span className="font-medium">{fmtSAR(calculateTotal())}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t("sr.invoice.vat_label")}</span>
                  <span className="font-medium">{fmtSAR(calculateVAT())}</span>
                </div>
                <Separator />
                <div className="flex justify-between text-lg font-bold">
                  <span>{t("sr.invoice.grand_total")}</span>
                  <span className="text-primary">{fmtSAR(calculateGrandTotal())}</span>
                </div>
                {withdrawItems.length > 0 && (
                  <>
                    <div className="flex justify-between text-orange-600">
                      <span>{t("sr.invoice.withdraw_deduction")}</span>
                      <span>-{fmtSAR(calculateWithdrawTotal())}</span>
                    </div>
                    <Separator />
                    <div className="flex justify-between text-lg font-bold">
                      <span>{t("sr.invoice.net_amount")}</span>
                      <span className="text-primary">{fmtSAR(calculateNetAmount())}</span>
                    </div>
                  </>
                )}
                {applyCredit && calculateCreditDeduction() > 0 && (
                  <>
                    <div className="flex justify-between text-emerald-600">
                      <span className="flex items-center gap-1">
                        <Wallet className="w-3.5 h-3.5" />
                        {t("sr.invoice.credit_deduction")}
                      </span>
                      <span>-{fmtSAR(calculateCreditDeduction())}</span>
                    </div>
                    <Separator />
                    <div className="flex justify-between text-xl font-bold">
                      <span>{t("sr.invoice.amount_due")}</span>
                      <span className="text-primary">{fmtSAR(calculateFinalAmount())}</span>
                    </div>
                  </>
                )}
              </div>
            </Card>
          )}

          {/* Withdraw-only Summary */}
          {orderItems.length === 0 && withdrawItems.length > 0 && (
            <Card className="p-5 rounded-2xl bg-orange-50 border-orange-300">
              <h3 className="font-bold text-lg mb-4 text-orange-900">{t("sr.invoice.withdraw_summary")}</h3>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-orange-700">{t("sr.invoice.total_withdrawn")}</span>
                  <span className="font-bold text-orange-600">{t("sr.common.count_products").replace("{n}", String(withdrawItems.reduce((sum, w) => sum + w.qty, 0)))}</span>
                </div>
                <Separator />
                <div className="flex justify-between text-lg font-bold">
                  <span className="text-orange-900">{t("sr.invoice.withdraw_value")}</span>
                  <span className="text-orange-600">{fmtSAR(calculateWithdrawTotal())}</span>
                </div>
                {customerCredit > 0 && (
                  <>
                    <Separator />
                    <div className="flex justify-between text-sm">
                      <span className="text-emerald-700 flex items-center gap-1">
                        <Wallet className="w-3.5 h-3.5" />
                        {t("sr.invoice.credit_note_info")}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-emerald-700">{t("sr.invoice.current_credit")}</span>
                      <span className="font-bold text-emerald-600">{fmtSAR(customerCredit)}</span>
                    </div>
                  </>
                )}
              </div>
            </Card>
          )}
        </div>

        {/* Bottom Action */}
        <div className="fixed bottom-0 left-0 right-0 bg-card border-t-2 border-border shadow-lg z-20">
          <div className="px-4 md:px-6 py-4">
            <Button
              size="lg"
              className="w-full py-6 text-lg rounded-2xl font-bold bg-emerald-600 hover:bg-emerald-700"
              onClick={handleSubmit}
              disabled={(orderItems.length === 0 && withdrawItems.length === 0) || submitting}
            >
              {submitting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin ml-2" />
                  {t("sr.invoice.submitting")}
                </>
              ) : (
                <>
                  <Check className="w-5 h-5 ml-2" />
                  {orderItems.length > 0 ? t("sr.invoice.confirm_submit") : t("sr.invoice.confirm_withdraw")}
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Visit Summary Dialog */}
      <VisitSummaryDialog
        open={showVisitSummary}
        onComplete={() => {
          setShowVisitSummary(false)
          // Show ZATCA QR dialog if we have data, otherwise navigate
          if (zatcaQR || zatcaInvoiceName) {
            setZatcaQROpen(true)
          } else {
            router.push("/sales-rep")
          }
        }}
        customerName={customerName}
        customerId={customerId}
        salesPersonName={salesPerson}
        visitName={completedVisitName}
        hadOrder={orderItems.length > 0}
      />

      {/* ZATCA E-Invoice QR Code Dialog */}
      <ZatcaQRDialog
        open={zatcaQROpen}
        onOpenChange={(open) => {
          setZatcaQROpen(open)
          if (!open) router.push("/sales-rep")
        }}
        qrCode={zatcaQR}
        invoiceName={zatcaInvoiceName}
        zatcaStatus={zatcaStatus}
        uuid={zatcaUUID}
      />
    </>
  )
}
