"use client"

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react"
import { useAuth } from "@/lib/auth-context"
import { useI18n } from "@/lib/i18n"
import { frappeClient } from "@/lib/api-client"
import {
  salesApi,
  type Customer,
  type SalesPerson,
  type Item,
} from "@/lib/sales-api"
import { stockApi, type BinStock, type SalesPersonStockItem } from "@/lib/stock-api"

interface SalesRepContextType {
  salesPerson: SalesPerson | null
  warehouse: string | null
  company: string | null
  customers: Customer[]
  items: Item[]
  repStock: BinStock[]
  loading: boolean
  initialLoading: boolean
  error: string | null
  refreshCustomers: () => Promise<void>
  refreshItems: () => Promise<void>
  refreshStock: () => Promise<void>
  refreshAll: () => Promise<void>
  getSalesPersonName: () => string
}

const SalesRepContext = createContext<SalesRepContextType | undefined>(undefined)

export function SalesRepProvider({ children }: { children: ReactNode }) {
  const { user, activeCompany } = useAuth()
  const { t } = useI18n()

  const [salesPerson, setSalesPerson] = useState<SalesPerson | null>(null)
  const [warehouse, setWarehouse] = useState<string | null>(null)
  const [company, setCompany] = useState<string | null>(null)
  const [customers, setCustomers] = useState<Customer[]>([])
  const [items, setItems] = useState<Item[]>([])
  const [repStock, setRepStock] = useState<BinStock[]>([])
  const [loading, setLoading] = useState(false)
  const [initialLoading, setInitialLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Find sales person: User email → Employee (user_id) → Sales Person (employee)
  useEffect(() => {
    if (!user?.email) {
      setInitialLoading(false)
      return
    }

    let cancelled = false

    async function findSalesPerson() {
      try {
        let foundSalesPerson = false

        // Strategy 1: Find via Employee → Sales Person (internal reps)
        try {
          const employees = await frappeClient.getList<{ name: string; employee_name: string; company?: string }>("Employee", {
            filters: [["Employee", "user_id", "=", user!.email]],
            fields: ["name", "employee_name", "company"],
            limit_page_length: 1,
          })

          if (cancelled) return

          if (employees.length > 0) {
            const emp = employees[0]
            // Set company from employee record
            if (emp.company) setCompany(emp.company)
            const spList = await salesApi.getSalesPersons({
              filters: [["Sales Person", "employee", "=", emp.name]],
              fields: ["name", "sales_person_name", "enabled", "employee"],
            })

            if (cancelled) return

            const match = spList.find(sp => sp.enabled)
            if (match) {
              const full = await salesApi.getSalesPerson(match.name)
              if (!cancelled && full) {
                console.log("[SalesRep] Found Sales Person via Employee:", full.name, {
                  inventory_warehouse: full.inventory_warehouse,
                  has_inventory: full.has_inventory,
                })
                setSalesPerson(full)
                foundSalesPerson = true
              }
            }
          }
        } catch (err) {
          console.warn("[SalesRep] Employee lookup failed, trying mobile_app_user:", err)
        }

        if (cancelled || foundSalesPerson) return

        // Strategy 2: Find via mobile_app_user (external reps)
        try {
          const spList = await salesApi.getSalesPersons({
            filters: [["Sales Person", "mobile_app_user", "=", user!.email]],
            fields: ["name", "sales_person_name", "enabled", "employee"],
          })

          if (cancelled) return

          const match = spList.find(sp => sp.enabled)
          if (match) {
            const full = await salesApi.getSalesPerson(match.name)
            if (!cancelled && full) {
              console.log("[SalesRep] Found Sales Person via mobile_app_user:", full.name, {
                inventory_warehouse: full.inventory_warehouse,
                has_inventory: full.has_inventory,
              })
              setSalesPerson(full)
              foundSalesPerson = true
            }
          }
        } catch (err) {
          console.warn("[SalesRep] mobile_app_user lookup failed:", err)
        }

        if (cancelled) return

        if (!foundSalesPerson) {
          setError(t("sr.ctx.rep_not_found"))
        }
      } catch (err) {
        console.error("[SalesRep] Failed to find sales person:", err)
        if (!cancelled) setError(t("sr.ctx.load_failed"))
      } finally {
        if (!cancelled) setInitialLoading(false)
      }
    }

    findSalesPerson()
    return () => { cancelled = true }
  }, [user?.email])

  // Resolve the warehouse for this sales person
  // Priority: 1) inventory_warehouse on Sales Person, 2) Warehouse with custom_linked_sales_person
  const findWarehouse = useCallback(async (): Promise<string | null> => {
    if (!salesPerson) return null

    // Check if Sales Person has inventory_warehouse set
    if (salesPerson.inventory_warehouse) {
      setWarehouse(salesPerson.inventory_warehouse)
      return salesPerson.inventory_warehouse
    }

    // Find a Van warehouse linked to this sales person
    try {
      const warehouses = await stockApi.getWarehouses({
        filters: [
          ["Warehouse", "custom_linked_sales_person", "=", salesPerson.name],
          ["Warehouse", "disabled", "=", 0],
        ],
        fields: ["name", "warehouse_name", "custom_warehouse_type"],
      })
      if (warehouses.length > 0) {
        setWarehouse(warehouses[0].name)
        return warehouses[0].name
      }
    } catch (err) {
      console.warn("[SalesRep] Failed to find linked warehouse:", err)
    }

    return null
  }, [salesPerson])

  const fetchStock = useCallback(async (): Promise<BinStock[]> => {
    if (!salesPerson) return []

    // Strategy 1: Try the custom backend API
    try {
      const data = await stockApi.getSalesPersonStock(salesPerson.name)
      console.log("[SalesRep] Custom API stock result:", data?.length, "items")
      if (data && data.length > 0) {
        console.log("[SalesRep] Custom API stock sample:", JSON.stringify(data[0]))
        return data
      }
    } catch (err) {
      console.warn("[SalesRep] Custom stock API failed, trying fallback:", err)
    }

    // Strategy 2: Find the warehouse and read Bin stock directly
    try {
      const warehouse = await findWarehouse()
      console.log("[SalesRep] Found warehouse for sales person:", warehouse)
      if (warehouse) {
        const binData = await stockApi.getBinStock(warehouse)
        console.log("[SalesRep] Bin stock from warehouse:", binData?.length, "items", binData.length > 0 ? JSON.stringify(binData[0]) : "")
        return binData
      } else {
        console.warn("[SalesRep] No warehouse found for sales person:", salesPerson.name,
          "- Check: 1) inventory_warehouse on Sales Person, 2) Warehouse with custom_linked_sales_person =", salesPerson.name)
      }
    } catch (err) {
      console.warn("[SalesRep] Fallback Bin stock fetch failed:", err)
    }

    return []
  }, [salesPerson, findWarehouse])

  // The effective company for this sales rep: prefer activeCompany from admin switcher, else employee's own company
  const effectiveCompany = activeCompany || company

  const refreshCustomers = useCallback(async () => {
    if (!salesPerson) return
    try {
      // ✅ Filter at API level — only fetch customers assigned to this sales person
      const data = await salesApi.getCustomers({
        filters: [
          ["Customer", "disabled", "=", 0],
          ["Customer", "primary_sales_person", "=", salesPerson.name],
        ],
      })
      // ✅ Strict equality: never show unassigned customers to this rep
      setCustomers(data.filter(c => c.primary_sales_person === salesPerson.name))
    } catch (err) {
      console.error("Failed to fetch customers:", err)
    }
  }, [salesPerson])

  const refreshItems = useCallback(async () => {
    try {
      const data = await salesApi.getItems()
      setItems(data)
    } catch (err) {
      console.error("Failed to fetch items:", err)
    }
  }, [])

  const refreshStock = useCallback(async () => {
    if (!salesPerson) return
    try {
      const data = await fetchStock()
      setRepStock(data)
    } catch (err) {
      console.error("Failed to fetch stock:", err)
    }
  }, [salesPerson, fetchStock])

  const refreshAll = useCallback(async () => {
    setLoading(true)
    try {
      await Promise.all([refreshCustomers(), refreshItems(), refreshStock()])
    } finally {
      setLoading(false)
    }
  }, [refreshCustomers, refreshItems, refreshStock])

  // Load data when sales person is found
  useEffect(() => {
    if (!salesPerson) return

    let cancelled = false

    const loadData = async () => {
      setLoading(true)
      try {
        const [customersData, itemsData, stockData] = await Promise.all([
          // ✅ Filter at API level — only fetch customers assigned to this sales person
          salesApi.getCustomers({
            filters: [
              ["Customer", "disabled", "=", 0],
              ["Customer", "primary_sales_person", "=", salesPerson.name],
            ],
          }),
          salesApi.getItems(),
          fetchStock(),
          findWarehouse(), // Always resolve warehouse independently
        ])

        if (!cancelled) {
          // ✅ Strict equality as client-side safety net
          setCustomers(customersData.filter(c => c.primary_sales_person === salesPerson.name))
          setItems(itemsData)
          setRepStock(stockData)
        }
      } catch (err) {
        console.error("Failed to load data:", err)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    loadData()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [salesPerson?.name])

  const getSalesPersonName = useCallback(() => {
    return salesPerson?.sales_person_name || user?.full_name || t("sr.ctx.rep_default")
  }, [salesPerson, user, t])

  return (
    <SalesRepContext.Provider
      value={{
        salesPerson,
        warehouse,
        company: effectiveCompany,
        customers,
        items,
        repStock,
        loading,
        initialLoading,
        error,
        refreshCustomers,
        refreshItems,
        refreshStock,
        refreshAll,
        getSalesPersonName,
      }}
    >
      {children}
    </SalesRepContext.Provider>
  )
}

export function useSalesRep() {
  const context = useContext(SalesRepContext)
  if (!context) {
    throw new Error("useSalesRep must be used within SalesRepProvider")
  }
  return context
}
