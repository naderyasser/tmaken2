"use client"

import { useState } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { MapPin, Plus, Navigation, Phone, Clock, Home, Package, History, ArrowLeft, Calendar } from 'lucide-react'
import Link from "next/link"
import { useInventory } from "@/contexts/InventoryContext"
import { getTotalQuantity } from "@/types/inventory"

interface Customer {
  id: string
  name: string
  location: string
  distance: number
  phone: string
  lastVisit: string
  type: "potential" | "active"
  orders: number
}

const initialCustomers: Customer[] = [
  {
    id: "1",
    name: "محمد أحمد التجاري",
    location: "شارع الملك فهد، الرياض",
    distance: 0.5,
    phone: "+966 50 123 4567",
    lastVisit: "منذ 3 أيام",
    type: "active",
    orders: 12,
  },
  {
    id: "2",
    name: "سوبر ماركت النور",
    location: "حي العليا، الرياض",
    distance: 1.2,
    phone: "+966 50 234 5678",
    lastVisit: "منذ أسبوع",
    type: "active",
    orders: 8,
  },
  {
    id: "3",
    name: "بقالة الفيصلية",
    location: "شارع التحلية، الرياض",
    distance: 2.1,
    phone: "+966 50 345 6789",
    lastVisit: "منذ أسبوعين",
    type: "potential",
    orders: 2,
  },
]

export default function SalesRepDashboard() {
  const [customers] = useState<Customer[]>(initialCustomers)
  const { repInventory } = useInventory()
  const [activeTab, setActiveTab] = useState<"customers" | "inventory">("customers")

  const activeInventory = repInventory.items.filter(item => item.type === "active")
  const totalActiveStock = activeInventory.reduce((sum, item) => sum + getTotalQuantity(item), 0)

  const hasInventory = repInventory.items.length > 0

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 text-white pt-12 pb-8 px-5 rounded-b-[2rem]">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold mb-1">مرحباً أحمد</h1>
            <p className="text-blue-100 flex items-center gap-2 text-sm">
              <MapPin className="w-4 h-4" />
              الموقع الحالي: الرياض
            </p>
          </div>
          <div className="bg-white/15 backdrop-blur-sm rounded-2xl px-5 py-3 text-center border border-white/20">
            <div className="text-2xl font-bold">{customers.length}</div>
            <div className="text-xs text-blue-100">عملاء قريبين</div>
          </div>
        </div>

        <Link href="/sales-rep/new-order">
          <Button
            size="lg"
            className="w-full bg-white text-blue-700 hover:bg-blue-50 font-bold text-base py-6 rounded-2xl shadow-lg border-0"
          >
            <Plus className="w-5 h-5 ml-2" />
            إضافة عميل جديد
          </Button>
        </Link>
      </div>

      {/* Tabs for switching between customers and inventory */}
      <div className="px-5 py-5">
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-5 bg-white p-1.5 rounded-2xl h-14 shadow-sm border border-slate-200">
            <TabsTrigger
              value="customers"
              className="rounded-xl text-sm font-bold data-[state=active]:bg-blue-600 data-[state=active]:text-white data-[state=active]:shadow-md transition-all"
            >
              <MapPin className="w-4 h-4 ml-2" />
              العملاء القريبين
            </TabsTrigger>
            <TabsTrigger
              value="inventory"
              className="rounded-xl text-sm font-bold data-[state=active]:bg-blue-600 data-[state=active]:text-white data-[state=active]:shadow-md transition-all"
            >
              <Package className="w-4 h-4 ml-2" />
              مخزوني
            </TabsTrigger>
          </TabsList>

          <TabsContent value="customers" className="space-y-4 mt-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-bold text-slate-800">العملاء القريبين منك</h2>
              <Button variant="ghost" size="sm" className="text-blue-600 hover:text-blue-700 hover:bg-blue-50">
                <Navigation className="w-4 h-4 ml-2" />
                تحديث الموقع
              </Button>
            </div>

            {customers.map((customer) => (
              <Card
                key={customer.id}
                className="p-4 bg-white hover:shadow-lg transition-all duration-300 border border-slate-200 rounded-2xl"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="text-base font-bold text-slate-800">{customer.name}</h3>
                      <Badge 
                        className={customer.type === "active" 
                          ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-100 text-xs" 
                          : "bg-blue-100 text-blue-700 hover:bg-blue-100 text-xs"}>
                        {customer.type === "active" ? "عميل فعال" : "عميل محتمل"}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-slate-500 mb-2">
                      <MapPin className="w-3.5 h-3.5" />
                      <span>{customer.location}</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                      <div className="flex items-center gap-1">
                        <Phone className="w-3.5 h-3.5" />
                        <span dir="ltr">{customer.phone}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        <span>آخر زيارة: {customer.lastVisit}</span>
                      </div>
                    </div>
                  </div>
                  <div className="text-center mr-3">
                    <div className="bg-blue-50 rounded-2xl w-14 h-14 flex items-center justify-center">
                      <div>
                        <div className="text-xl font-bold text-blue-600">{customer.distance}</div>
                        <div className="text-[10px] text-blue-500">كم</div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex gap-2 mt-4 pt-3 border-t border-slate-100">
                  <Link href={`/sales-rep/new-order?customerId=${customer.id}&type=${customer.type}`} className="flex-1">
                    <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-xl h-11">
                      {customer.type === "active" ? "أنا وصلت" : "إضافة طلب"}
                    </Button>
                  </Link>
                  {customer.type === "active" && (
                    <Link href={`/sales-rep/customer-inventory?customerId=${customer.id}`}>
                      <Button variant="outline" className="border-slate-200 hover:bg-slate-50 rounded-xl h-11 bg-transparent">
                        <Package className="w-4 h-4 ml-1" />
                        المخزون
                      </Button>
                    </Link>
                  )}
                </div>
              </Card>
            ))}
          </TabsContent>

          <TabsContent value="inventory" className="space-y-4 mt-6">
            {!hasInventory ? (
              <Card className="p-12 text-center">
                <Package className="w-16 h-16 mx-auto text-muted-foreground/50 mb-4" />
                <h3 className="text-xl font-bold mb-2">لا يوجد مخزون</h3>
                <p className="text-muted-foreground mb-6">ليس لديك أي منتجات في المخزون حالياً</p>
                <Link href="/">
                  <Button variant="outline" size="lg">
                    <ArrowLeft className="w-4 h-4 ml-2" />
                    العودة للصفحة الرئيسية
                  </Button>
                </Link>
              </Card>
            ) : (
              <>
                {/* Inventory Statistics Section */}
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <Card className="p-4 bg-primary/5 border-primary/30">
                    <div className="flex items-center gap-3">
                      <div className="bg-primary/10 p-3 rounded-xl">
                        <Package className="w-6 h-6 text-primary" />
                      </div>
                      <div>
                        <div className="text-2xl font-bold text-primary">{totalActiveStock}</div>
                        <div className="text-sm text-muted-foreground">إجمالي المخزون النشط</div>
                      </div>
                    </div>
                  </Card>
                  <Card className="p-4 bg-blue-50 border-blue-200">
                    <div className="flex items-center gap-3">
                      <div className="bg-blue-100 p-3 rounded-xl">
                        <History className="w-6 h-6 text-blue-600" />
                      </div>
                      <div>
                        <div className="text-2xl font-bold text-blue-600">{repInventory.records.length}</div>
                        <div className="text-sm text-blue-600/70">حركة مخزون</div>
                      </div>
                    </div>
                  </Card>
                </div>

                {/* Inventory Display by Type */}
                <div className="space-y-6">
                  {/* Active Inventory */}
                  <div>
                    <h3 className="font-bold text-lg mb-3 flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-green-500" />
                      المخزون النشط
                    </h3>
                    <div className="space-y-3">
                      {repInventory.items
                        .filter((item) => item.type === "active")
                        .map((item) => (
                          <Card key={item.productId} className="p-4 border-2 border-green-200 bg-green-50/50">
                            <div className="flex items-center justify-between mb-3">
                              <div className="flex-1">
                                <h4 className="font-bold text-lg">{item.productName}</h4>
                                <p className="text-sm text-muted-foreground">{item.productNameEn}</p>
                                <p className="text-xs text-muted-foreground mt-1">
                                  عدد الدفعات: {item.batches.length}
                                </p>
                              </div>
                              <div className="text-right">
                                <div className="text-3xl font-bold text-green-600">{getTotalQuantity(item)}</div>
                                <div className="text-xs text-muted-foreground">إجمالي الوحدات</div>
                              </div>
                            </div>

                            <div className="space-y-2 mt-3 pt-3 border-t border-green-200">
                              {item.batches.map((batch) => (
                                <div
                                  key={batch.batchId}
                                  className="flex items-center justify-between bg-white/60 p-3 rounded-lg"
                                >
                                  <div className="flex items-center gap-2">
                                    <Calendar className="w-4 h-4 text-green-600" />
                                    <div>
                                      <p className="text-sm font-medium">
                                        تاريخ الانتهاء: {new Date(batch.expiryDate).toLocaleDateString("en-GB")}
                                      </p>
                                      <p className="text-xs text-muted-foreground">
                                        أضيف: {new Date(batch.addedDate).toLocaleDateString("en-GB")}
                                      </p>
                                    </div>
                                  </div>
                                  <div className="text-right">
                                    <div className="text-xl font-bold text-green-600">{batch.quantity}</div>
                                    <div className="text-xs text-muted-foreground">وحدة</div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </Card>
                        ))}
                    </div>
                  </div>

                  {/* Return Inventory */}
                  {repInventory.items.some((item) => item.type === "return") && (
                    <div>
                      <h3 className="font-bold text-lg mb-3 flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-orange-500" />
                        سجل الرجيع
                      </h3>
                      <div className="space-y-3">
                        {repInventory.items
                          .filter((item) => item.type === "return")
                          .map((item) => (
                            <Card key={item.productId} className="p-4 border-2 border-orange-200 bg-orange-50/50">
                              <div className="flex items-center justify-between mb-3">
                                <div className="flex-1">
                                  <h4 className="font-bold text-lg">{item.productName}</h4>
                                  <p className="text-sm text-muted-foreground">{item.productNameEn}</p>
                                  <p className="text-xs text-muted-foreground mt-1">
                                    عدد الدفعات: {item.batches.length}
                                  </p>
                                </div>
                                <div className="text-right">
                                  <div className="text-3xl font-bold text-orange-600">{getTotalQuantity(item)}</div>
                                  <div className="text-xs text-muted-foreground">إجمالي الوحدات</div>
                                </div>
                              </div>

                              <div className="space-y-2 mt-3 pt-3 border-t border-orange-200">
                                {item.batches.map((batch) => (
                                  <div
                                    key={batch.batchId}
                                    className="flex items-center justify-between bg-white/60 p-3 rounded-lg"
                                  >
                                    <div className="flex items-center gap-2">
                                      <Calendar className="w-4 h-4 text-orange-600" />
                                      <div>
                                        <p className="text-sm font-medium">
                                          تاريخ الانتهاء: {new Date(batch.expiryDate).toLocaleDateString("en-GB")}
                                        </p>
                                        <p className="text-xs text-muted-foreground">
                                          أضيف: {new Date(batch.addedDate).toLocaleDateString("en-GB")}
                                        </p>
                                      </div>
                                    </div>
                                    <div className="text-right">
                                      <div className="text-xl font-bold text-orange-600">{batch.quantity}</div>
                                      <div className="text-xs text-muted-foreground">وحدة</div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </Card>
                          ))}
                      </div>
                    </div>
                  )}

                  {/* Damaged Inventory */}
                  {repInventory.items.some((item) => item.type === "damaged") && (
                    <div>
                      <h3 className="font-bold text-lg mb-3 flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-red-500" />
                        المخزون التالف
                      </h3>
                      <div className="space-y-3">
                        {repInventory.items
                          .filter((item) => item.type === "damaged")
                          .map((item) => (
                            <Card key={item.productId} className="p-4 border-2 border-red-200 bg-red-50/50">
                              <div className="flex items-center justify-between mb-3">
                                <div className="flex-1">
                                  <h4 className="font-bold text-lg">{item.productName}</h4>
                                  <p className="text-sm text-muted-foreground">{item.productNameEn}</p>
                                  <p className="text-xs text-muted-foreground mt-1">
                                    عدد الدفعات: {item.batches.length}
                                  </p>
                                </div>
                                <div className="text-right">
                                  <div className="text-3xl font-bold text-red-600">{getTotalQuantity(item)}</div>
                                  <div className="text-xs text-muted-foreground">إجمالي الوحدات</div>
                                </div>
                              </div>

                              <div className="space-y-2 mt-3 pt-3 border-t border-red-200">
                                {item.batches.map((batch) => (
                                  <div
                                    key={batch.batchId}
                                    className="flex items-center justify-between bg-white/60 p-3 rounded-lg"
                                  >
                                    <div className="flex items-center gap-2">
                                      <Calendar className="w-4 h-4 text-red-600" />
                                      <div>
                                        <p className="text-sm font-medium">
                                          تاريخ الانتهاء: {new Date(batch.expiryDate).toLocaleDateString("en-GB")}
                                        </p>
                                        <p className="text-xs text-muted-foreground">
                                          أضيف: {new Date(batch.addedDate).toLocaleDateString("en-GB")}
                                        </p>
                                      </div>
                                    </div>
                                    <div className="text-right">
                                      <div className="text-xl font-bold text-red-600">{batch.quantity}</div>
                                      <div className="text-xs text-muted-foreground">وحدة</div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </Card>
                          ))}
                      </div>
                    </div>
                  )}

                  {/* Expired Inventory */}
                  {repInventory.items.some((item) => item.type === "expired") && (
                    <div>
                      <h3 className="font-bold text-lg mb-3 flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-yellow-500" />
                        منتهي الصلاحية
                      </h3>
                      <div className="space-y-3">
                        {repInventory.items
                          .filter((item) => item.type === "expired")
                          .map((item) => (
                            <Card key={item.productId} className="p-4 border-2 border-yellow-200 bg-yellow-50/50">
                              <div className="flex items-center justify-between mb-3">
                                <div className="flex-1">
                                  <h4 className="font-bold text-lg">{item.productName}</h4>
                                  <p className="text-sm text-muted-foreground">{item.productNameEn}</p>
                                  <p className="text-xs text-muted-foreground mt-1">
                                    عدد الدفعات: {item.batches.length}
                                  </p>
                                </div>
                                <div className="text-right">
                                  <div className="text-3xl font-bold text-yellow-600">{getTotalQuantity(item)}</div>
                                  <div className="text-xs text-muted-foreground">إجمالي الوحدات</div>
                                </div>
                              </div>

                              <div className="space-y-2 mt-3 pt-3 border-t border-yellow-200">
                                {item.batches.map((batch) => (
                                  <div
                                    key={batch.batchId}
                                    className="flex items-center justify-between bg-white/60 p-3 rounded-lg"
                                  >
                                    <div className="flex items-center gap-2">
                                      <Calendar className="w-4 h-4 text-yellow-600" />
                                      <div>
                                        <p className="text-sm font-medium">
                                          تاريخ الانتهاء: {new Date(batch.expiryDate).toLocaleDateString("en-GB")}
                                        </p>
                                        <p className="text-xs text-muted-foreground">
                                          أضيف: {new Date(batch.addedDate).toLocaleDateString("en-GB")}
                                        </p>
                                      </div>
                                    </div>
                                    <div className="text-right">
                                      <div className="text-xl font-bold text-yellow-600">{batch.quantity}</div>
                                      <div className="text-xs text-muted-foreground">وحدة</div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </Card>
                          ))}
                      </div>
                    </div>
                  )}
                </div>

                <Link href="/sales-rep/inventory-records">
                  <Button variant="outline" className="w-full border-2 py-6 rounded-2xl bg-transparent">
                    <History className="w-5 h-5 ml-2" />
                    عرض سجل حركات المخزون
                  </Button>
                </Link>
              </>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
