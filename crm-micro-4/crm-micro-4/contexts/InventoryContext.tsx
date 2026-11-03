"use client"

import { createContext, useContext, useState, ReactNode } from "react"
import {
  RepInventory,
  CustomerInventory,
  InventoryItem,
  InventoryRecord,
  InventoryType,
  ProductBatch,
  getTotalQuantity,
} from "@/types/inventory"

interface InventoryContextType {
  repInventory: RepInventory
  customerInventories: Map<string, CustomerInventory>
  addToRepInventory: (
    productId: string,
    productName: string,
    productNameEn: string,
    quantity: number,
    type: InventoryType,
    expiryDate?: Date
  ) => void
  removeFromRepInventory: (productId: string, batchId: string, quantity: number, type: InventoryType) => void
  transferToCustomer: (
    customerId: string,
    customerName: string,
    productId: string,
    productName: string,
    productNameEn: string,
    batchId: string,
    quantity: number
  ) => void
  updateCustomerInventory: (
    customerId: string,
    productId: string,
    batchId: string,
    currentQuantity: number,
    type: InventoryType
  ) => void
  withdrawFromCustomer: (
    customerId: string,
    productId: string,
    batchId: string,
    quantity: number,
    reason: InventoryType
  ) => void
  getCustomerInventory: (customerId: string) => CustomerInventory | undefined
  getRepInventoryRecords: () => InventoryRecord[]
  getCustomerInventoryRecords: (customerId: string) => InventoryRecord[]
}

const InventoryContext = createContext<InventoryContextType | undefined>(undefined)

export function InventoryProvider({ children }: { children: ReactNode }) {
  const [repInventory, setRepInventory] = useState<RepInventory>({
    repId: "rep-1",
    repName: "محمد أحمد",
    items: [
      {
        productId: "1",
        productName: "زيت زيتون فاخر",
        productNameEn: "Premium Olive Oil",
        batches: [
          {
            batchId: "batch-1-1",
            expiryDate: new Date("2025-12-31"),
            quantity: 30,
            addedDate: new Date(),
          },
          {
            batchId: "batch-1-2",
            expiryDate: new Date("2026-03-15"),
            quantity: 20,
            addedDate: new Date(),
          },
        ],
        type: "active",
        lastUpdated: new Date(),
      },
      {
        productId: "2",
        productName: "أرز بسمتي",
        productNameEn: "Basmati Rice",
        batches: [
          {
            batchId: "batch-2-1",
            expiryDate: new Date("2025-08-20"),
            quantity: 100,
            addedDate: new Date(),
          },
        ],
        type: "active",
        lastUpdated: new Date(),
      },
      {
        productId: "3",
        productName: "سكر أبيض",
        productNameEn: "White Sugar",
        batches: [
          {
            batchId: "batch-3-1",
            expiryDate: new Date("2026-01-10"),
            quantity: 50,
            addedDate: new Date(),
          },
          {
            batchId: "batch-3-2",
            expiryDate: new Date("2025-11-30"),
            quantity: 25,
            addedDate: new Date(),
          },
        ],
        type: "active",
        lastUpdated: new Date(),
      },
      {
        productId: "4",
        productName: "شاي أسود",
        productNameEn: "Black Tea",
        batches: [
          {
            batchId: "batch-4-1",
            expiryDate: new Date("2026-06-30"),
            quantity: 40,
            addedDate: new Date(),
          },
        ],
        type: "active",
        lastUpdated: new Date(),
      },
    ],
    records: [],
  })

  const [customerInventories, setCustomerInventories] = useState<Map<string, CustomerInventory>>(
    new Map([
      [
        "1",
        {
          customerId: "1",
          customerName: "محمد أحمد التجاري",
          items: [
            {
              productId: "1",
              productName: "زيت زيتون فاخر",
              productNameEn: "Premium Olive Oil",
              batches: [
                {
                  batchId: "batch-1-1",
                  expiryDate: new Date("2025-12-31"),
                  quantity: 4,
                  addedDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
                },
              ],
              type: "active",
              lastUpdated: new Date(),
            },
            {
              productId: "2",
              productName: "أرز بسمتي",
              productNameEn: "Basmati Rice",
              batches: [
                {
                  batchId: "batch-2-1",
                  expiryDate: new Date("2025-08-20"),
                  quantity: 6,
                  addedDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
                },
              ],
              type: "active",
              lastUpdated: new Date(),
            },
            {
              productId: "3",
              productName: "سكر أبيض",
              productNameEn: "White Sugar",
              batches: [
                {
                  batchId: "batch-3-1",
                  expiryDate: new Date("2026-01-10"),
                  quantity: 10,
                  addedDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
                },
              ],
              type: "active",
              lastUpdated: new Date(),
            },
          ],
          records: [],
        },
      ],
      [
        "2",
        {
          customerId: "2",
          customerName: "سوبر ماركت النور",
          items: [
            {
              productId: "2",
              productName: "أرز بسمتي",
              productNameEn: "Basmati Rice",
              batches: [
                {
                  batchId: "batch-2-1",
                  expiryDate: new Date("2025-08-20"),
                  quantity: 8,
                  addedDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
                },
              ],
              type: "active",
              lastUpdated: new Date(),
            },
            {
              productId: "4",
              productName: "شاي أسود",
              productNameEn: "Black Tea",
              batches: [
                {
                  batchId: "batch-4-1",
                  expiryDate: new Date("2026-06-30"),
                  quantity: 0,
                  addedDate: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000),
                },
              ],
              type: "active",
              lastUpdated: new Date(),
            },
          ],
          records: [],
        },
      ],
    ])
  )

  const addToRepInventory = (
    productId: string,
    productName: string,
    productNameEn: string,
    quantity: number,
    type: InventoryType,
    expiryDate?: Date
  ) => {
    setRepInventory((prev) => {
      const items = [...prev.items]
      const existingIndex = items.findIndex((item) => item.productId === productId && item.type === type)

      const newBatch: ProductBatch = {
        batchId: `batch-${productId}-${Date.now()}`,
        expiryDate: expiryDate || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        quantity,
        addedDate: new Date(),
      }

      if (existingIndex !== -1) {
        const sameBatchIndex = items[existingIndex].batches.findIndex(
          (b) => b.expiryDate.getTime() === newBatch.expiryDate.getTime()
        )

        if (sameBatchIndex !== -1) {
          items[existingIndex].batches[sameBatchIndex].quantity += quantity
        } else {
          items[existingIndex].batches.push(newBatch)
        }
        items[existingIndex].lastUpdated = new Date()
      } else {
        items.push({ productId, productName, productNameEn, batches: [newBatch], type, lastUpdated: new Date() })
      }

      const record: InventoryRecord = {
        id: Date.now().toString(),
        productId,
        productName,
        productNameEn,
        quantity,
        batchId: newBatch.batchId,
        expiryDate: newBatch.expiryDate,
        type,
        from: "warehouse",
        to: "rep",
        date: new Date(),
      }

      if (type === "return") {
        const activeIndex = items.findIndex((item) => item.productId === productId && item.type === "active")
        if (activeIndex !== -1) {
          const sameBatchIndex = items[activeIndex].batches.findIndex(
            (b) => b.expiryDate.getTime() === newBatch.expiryDate.getTime()
          )
          if (sameBatchIndex !== -1) {
            items[activeIndex].batches[sameBatchIndex].quantity += quantity
          } else {
            items[activeIndex].batches.push({ ...newBatch })
          }
          items[activeIndex].lastUpdated = new Date()
        } else {
          items.push({
            productId,
            productName,
            productNameEn,
            batches: [{ ...newBatch }],
            type: "active",
            lastUpdated: new Date(),
          })
        }
      }

      return { ...prev, items, records: [...prev.records, record] }
    })
  }

  const removeFromRepInventory = (productId: string, batchId: string, quantity: number, type: InventoryType) => {
    setRepInventory((prev) => {
      const items = prev.items.map((item) => {
        if (item.productId === productId && item.type === type) {
          const batches = item.batches
            .map((batch) => {
              if (batch.batchId === batchId) {
                return { ...batch, quantity: Math.max(0, batch.quantity - quantity) }
              }
              return batch
            })
            .filter((batch) => batch.quantity > 0)

          return { ...item, batches, lastUpdated: new Date() }
        }
        return item
      })

      return { ...prev, items }
    })
  }

  const transferToCustomer = (
    customerId: string,
    customerName: string,
    productId: string,
    productName: string,
    productNameEn: string,
    batchId: string,
    quantity: number
  ) => {
    let batchDetails: ProductBatch | undefined
    const repItem = repInventory.items.find((item) => item.productId === productId && item.type === "active")
    if (repItem) {
      batchDetails = repItem.batches.find((b) => b.batchId === batchId)
    }

    removeFromRepInventory(productId, batchId, quantity, "active")

    setCustomerInventories((prev) => {
      const newMap = new Map(prev)
      const existing = newMap.get(customerId)

      const record: InventoryRecord = {
        id: Date.now().toString(),
        productId,
        productName,
        productNameEn,
        quantity,
        batchId,
        expiryDate: batchDetails?.expiryDate,
        type: "active",
        from: "rep",
        to: customerId,
        date: new Date(),
      }

      if (existing) {
        const items = [...existing.items]
        const existingIndex = items.findIndex((item) => item.productId === productId && item.type === "active")

        if (existingIndex !== -1) {
          const sameBatchIndex = items[existingIndex].batches.findIndex((b) => b.batchId === batchId)

          if (sameBatchIndex !== -1) {
            items[existingIndex].batches[sameBatchIndex].quantity += quantity
          } else if (batchDetails) {
            items[existingIndex].batches.push({
              ...batchDetails,
              quantity,
              addedDate: new Date(),
            })
          }
          items[existingIndex].lastUpdated = new Date()
        } else if (batchDetails) {
          items.push({
            productId,
            productName,
            productNameEn,
            batches: [{ ...batchDetails, quantity, addedDate: new Date() }],
            type: "active",
            lastUpdated: new Date(),
          })
        }

        newMap.set(customerId, {
          ...existing,
          items,
          records: [...existing.records, record],
        })
      } else if (batchDetails) {
        newMap.set(customerId, {
          customerId,
          customerName,
          items: [
            {
              productId,
              productName,
              productNameEn,
              batches: [{ ...batchDetails, quantity, addedDate: new Date() }],
              type: "active",
              lastUpdated: new Date(),
            },
          ],
          records: [record],
        })
      }

      return newMap
    })

    setRepInventory((prev) => ({
      ...prev,
      records: [
        ...prev.records,
        {
          id: Date.now().toString(),
          productId,
          productName,
          productNameEn,
          quantity,
          batchId,
          expiryDate: batchDetails?.expiryDate,
          type: "active",
          from: "rep",
          to: customerId,
          date: new Date(),
        },
      ],
    }))
  }

  const updateCustomerInventory = (
    customerId: string,
    productId: string,
    batchId: string,
    currentQuantity: number,
    type: InventoryType
  ) => {
    setCustomerInventories((prev) => {
      const newMap = new Map(prev)
      const existing = newMap.get(customerId)

      if (existing) {
        const items = existing.items.map((item) => {
          if (item.productId === productId && item.type === type) {
            const batches = item.batches.map((batch) => {
              if (batch.batchId === batchId) {
                return { ...batch, quantity: currentQuantity }
              }
              return batch
            })
            return { ...item, batches, lastUpdated: new Date() }
          }
          return item
        })

        newMap.set(customerId, { ...existing, items })
      }

      return newMap
    })
  }

  const withdrawFromCustomer = (
    customerId: string,
    productId: string,
    batchId: string,
    quantity: number,
    reason: InventoryType
  ) => {
    const customerInv = customerInventories.get(customerId)
    if (!customerInv) return

    const item = customerInv.items.find((i) => i.productId === productId)
    if (!item) return

    const batch = item.batches.find((b) => b.batchId === batchId)
    if (!batch) return

    setCustomerInventories((prev) => {
      const newMap = new Map(prev)
      const existing = newMap.get(customerId)

      if (existing) {
        const items = existing.items.map((item) => {
          if (item.productId === productId) {
            const batches = item.batches
              .map((b) => {
                if (b.batchId === batchId) {
                  return { ...b, quantity: Math.max(0, b.quantity - quantity) }
                }
                return b
              })
              .filter((b) => b.quantity > 0)

            return { ...item, batches, lastUpdated: new Date() }
          }
          return item
        })

        const record: InventoryRecord = {
          id: Date.now().toString(),
          productId,
          productName: item.productName,
          productNameEn: item.productNameEn,
          quantity,
          batchId,
          expiryDate: batch.expiryDate,
          type: reason,
          from: customerId,
          to: "rep",
          date: new Date(),
          note: `سحب: ${reason === "damaged" ? "تالف" : reason === "expired" ? "منتهي" : "رجيع"}`,
        }

        newMap.set(customerId, {
          ...existing,
          items,
          records: [...existing.records, record],
        })
      }

      return newMap
    })

    addToRepInventory(item.productName, item.productName, item.productNameEn, quantity, reason, batch.expiryDate)
  }

  const getCustomerInventory = (customerId: string) => {
    return customerInventories.get(customerId)
  }

  const getRepInventoryRecords = () => {
    return repInventory.records
  }

  const getCustomerInventoryRecords = (customerId: string) => {
    return customerInventories.get(customerId)?.records || []
  }

  return (
    <InventoryContext.Provider
      value={{
        repInventory,
        customerInventories,
        addToRepInventory,
        removeFromRepInventory,
        transferToCustomer,
        updateCustomerInventory,
        withdrawFromCustomer,
        getCustomerInventory,
        getRepInventoryRecords,
        getCustomerInventoryRecords,
      }}
    >
      {children}
    </InventoryContext.Provider>
  )
}

export function useInventory() {
  const context = useContext(InventoryContext)
  if (!context) {
    throw new Error("useInventory must be used within InventoryProvider")
  }
  return context
}
