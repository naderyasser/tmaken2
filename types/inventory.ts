export type InventoryType = "active" | "damaged" | "expired" | "return"

export interface ProductBatch {
  batchId: string
  expiryDate: Date
  quantity: number
  addedDate: Date
}

export interface InventoryItem {
  productId: string
  productName: string
  productNameEn: string
  batches: ProductBatch[]
  type: InventoryType
  lastUpdated: Date
}

export function getTotalQuantity(item: InventoryItem): number {
  return item.batches.reduce((sum, batch) => sum + batch.quantity, 0)
}

export interface InventoryRecord {
  id: string
  productId: string
  productName: string
  productNameEn: string
  quantity: number
  batchId?: string
  expiryDate?: Date
  type: InventoryType
  from: string // "warehouse" | "rep" | customer ID
  to: string // "warehouse" | "rep" | customer ID
  date: Date
  status?: "pending" | "accepted" | "rejected"
  note?: string
}

export interface RepInventory {
  repId: string
  repName: string
  items: InventoryItem[]
  records: InventoryRecord[]
}

export interface CustomerInventory {
  customerId: string
  customerName: string
  items: InventoryItem[]
  records: InventoryRecord[]
}
