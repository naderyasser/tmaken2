"use client"

import { useEffect, useState } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ArrowRight, Package, History } from 'lucide-react'
import Link from "next/link"
import { useSearchParams } from 'next/navigation'
import { useInventory } from "@/contexts/InventoryContext"
import { Suspense } from "react"

function CustomerInventoryContent() {
  const searchParams = useSearchParams()
  const customerId = searchParams.get("customerId")
  const { getCustomerInventory, getCustomerInventoryRecords } = useInventory()
  
  const [customerData, setCustomerData] = useState<any>(null)

  useEffect(() => {
    if (customerId) {
      const inventory = getCustomerInventory(customerId)
      setCustomerData(inventory)
    }
  }, [customerId, getCustomerInventory])

  if (!customerData) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Package className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">لا توجد بيانات مخزون</p>
        </div>
      </div>
    )
  }

  const records = getCustomerInventoryRecords(customerId!)

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="bg-primary text-primary-foreground sticky top-0 z-10 shadow-lg">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <Link href="/sales-rep">
              <Button variant="ghost" size="sm" className="text-primary-foreground hover:bg-primary-foreground/20">
                <ArrowRight className="w-5 h-5" />
              </Button>
            </Link>
            <h1 className="text-2xl font-bold">مخزون العميل</h1>
            <div className="w-10" />
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6">
        <Card className="p-5 mb-6 bg-primary/5 border-primary/30">
          <h2 className="text-xl font-bold mb-2">{customerData.customerName}</h2>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-1">
              <Package className="w-4 h-4" />
              <span>{customerData.items.length} منتج في المخزون</span>
            </div>
            <div className="flex items-center gap-1">
              <History className="w-4 h-4" />
              <span>{records.length} حركة مسجلة</span>
            </div>
          </div>
        </Card>

        <h3 className="font-bold text-lg mb-4">المخزون الحالي</h3>
        <div className="space-y-3">
          {customerData.items.map((item: any) => (
            <Card key={item.productId} className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-base mb-1">{item.productName}</h4>
                  <p className="text-sm text-muted-foreground">
                    آخر تحديث: {new Date(item.lastUpdated).toLocaleDateString("ar-SA")}
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-primary">{item.quantity}</div>
                  <Badge variant="secondary" className="mt-1">
                    {item.type === "active" ? "نشط" : item.type}
                  </Badge>
                </div>
              </div>
            </Card>
          ))}
        </div>

        {records.length > 0 && (
          <>
            <h3 className="font-bold text-lg mb-4 mt-8">آخر الحركات</h3>
            <div className="space-y-3">
              {records.slice(0, 5).map((record: any) => (
                <Card key={record.id} className="p-4 bg-muted/50">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-bold text-sm">{record.productName}</h4>
                    <Badge variant="outline" className="text-xs">
                      {new Date(record.date).toLocaleDateString("ar-SA")}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">
                      من: {record.from === "rep" ? "المندوب" : record.from}
                    </span>
                    <span className="font-bold text-green-600">+{record.quantity}</span>
                  </div>
                </Card>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default function CustomerInventoryPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Package className="w-12 h-12 text-muted-foreground mx-auto mb-3 animate-pulse" />
          <p className="text-muted-foreground">جاري التحميل...</p>
        </div>
      </div>
    }>
      <CustomerInventoryContent />
    </Suspense>
  )
}
