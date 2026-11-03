"use client"

import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ArrowRight, TrendingUp, TrendingDown, Package } from 'lucide-react'
import Link from "next/link"
import { useInventory } from "@/contexts/InventoryContext"

export default function InventoryRecordsPage() {
  const { getRepInventoryRecords } = useInventory()
  const records = getRepInventoryRecords()

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
            <h1 className="text-2xl font-bold">سجل حركات المخزون</h1>
            <div className="w-10" />
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6">
        <Card className="p-5 mb-6 bg-primary/5 border-primary/30">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold mb-1">إجمالي الحركات</h2>
              <p className="text-sm text-muted-foreground">جميع حركات المخزون المسجلة</p>
            </div>
            <div className="text-right">
              <div className="text-3xl font-bold text-primary">{records.length}</div>
              <div className="text-xs text-muted-foreground">حركة</div>
            </div>
          </div>
        </Card>

        {records.length === 0 ? (
          <div className="text-center py-12">
            <Package className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">لا توجد حركات مخزون مسجلة</p>
          </div>
        ) : (
          <div className="space-y-3">
            {records.map((record) => {
              const isIncoming = record.to === "rep"
              const isOutgoing = record.from === "rep"

              return (
                <Card key={record.id} className="p-4">
                  <div className="flex items-start gap-3">
                    <div
                      className={`p-2 rounded-xl ${
                        isIncoming ? "bg-green-100" : "bg-red-100"
                      }`}
                    >
                      {isIncoming ? (
                        <TrendingUp className="w-5 h-5 text-green-600" />
                      ) : (
                        <TrendingDown className="w-5 h-5 text-red-600" />
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-bold text-base">{record.productName}</h4>
                        <Badge
                          variant={isIncoming ? "default" : "secondary"}
                          className={isIncoming ? "bg-green-600" : "bg-red-600"}
                        >
                          {isIncoming ? "وارد" : "صادر"}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span className="text-muted-foreground">
                          {isIncoming ? "من" : "إلى"}:{" "}
                          {isIncoming
                            ? record.from === "warehouse"
                              ? "المستودع"
                              : record.from
                            : record.to === "warehouse"
                            ? "المستودع"
                            : `عميل ${record.to}`}
                        </span>
                        <span
                          className={`font-bold ${
                            isIncoming ? "text-green-600" : "text-red-600"
                          }`}
                        >
                          {isIncoming ? "+" : "-"}
                          {record.quantity}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span>{new Date(record.date).toLocaleDateString("ar-SA")}</span>
                        <Badge variant="outline" className="text-xs">
                          {record.type === "active"
                            ? "نشط"
                            : record.type === "return"
                            ? "رجيع"
                            : record.type === "damaged"
                            ? "تالف"
                            : "إكسباير"}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </Card>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
