"use client"

import { useState, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { ArrowRight, Check, Percent, DollarSign, AlertCircle } from 'lucide-react'
import Link from "next/link"
import { useRouter } from 'next/navigation'

interface Product {
  id: string
  name: string
  price: number
  unit: string
  category: string
  image: string
}

interface OrderItem {
  product: Product
  quantity: number
  discount?: {
    type: "fixed" | "percentage"
    value: number
  }
}

interface WithdrawItem {
  productId: string
  batchId: string
  quantity: number
  reason: string
  customReason?: string
}

const WITHDRAW_REASONS = [
  { id: "return", label: "رجيع" },
  { id: "damaged", label: "تالف" },
  { id: "expired", label: "منتهي الصلاحية" },
  { id: "near-expiry", label: "قرب انتهاء الصلاحية" },
  { id: "quality-issue", label: "مشكلة في الجودة" },
  { id: "wrong-product", label: "منتج خاطئ" },
  { id: "other", label: "أسباب أخرى" },
]

const PRODUCTS = [
  {
    id: "1",
    name: "زيت زيتون فاخر",
    price: 45.0,
    unit: "لتر",
    category: "زيوت",
    image: "/olive-oil-bottle.png",
  },
  {
    id: "2",
    name: "أرز بسمتي",
    price: 35.0,
    unit: "كيس 5 كجم",
    category: "حبوب",
    image: "/rice-bag.png",
  },
  {
    id: "3",
    name: "سكر أبيض",
    price: 12.0,
    unit: "كيس 2 كجم",
    category: "سكريات",
    image: "/sugar-bag.jpg",
  },
  {
    id: "4",
    name: "شاي أسود",
    price: 28.0,
    unit: "علبة 400 جرام",
    category: "مشروبات",
    image: "/tea-box.jpg",
  },
  {
    id: "5",
    name: "معكرونة",
    price: 8.5,
    unit: "كرتون 12 كيس",
    category: "معجنات",
    image: "/pasta-box.png",
  },
  {
    id: "6",
    name: "صلصة طماطم",
    price: 15.0,
    unit: "كرتون 24 علبة",
    category: "معلبات",
    image: "/rich-tomato-sauce.png",
  },
]

export default function InvoicePage() {
  const router = useRouter()
  const [orderItems, setOrderItems] = useState<OrderItem[]>([])
  const [withdrawItems, setWithdrawItems] = useState<WithdrawItem[]>([])
  const [replacementItems, setReplacementItems] = useState<{[key: string]: boolean}>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const storedItems = sessionStorage.getItem("orderItems")
    const storedWithdraws = sessionStorage.getItem("withdrawItems")
    const storedReplacements = sessionStorage.getItem("replacementItems")
    
    if (storedItems) {
      setOrderItems(JSON.parse(storedItems))
    }
    if (storedWithdraws) {
      setWithdrawItems(JSON.parse(storedWithdraws))
    }
    if (storedReplacements) {
      setReplacementItems(JSON.parse(storedReplacements))
    }
    setLoading(false)
  }, [router])

  const updateDiscount = (productId: string, type: "fixed" | "percentage", value: string) => {
    const numValue = parseFloat(value) || 0
    setOrderItems(
      orderItems.map((item) => {
        if (item.product.id === productId) {
          return {
            ...item,
            discount: numValue > 0 ? { type, value: numValue } : undefined,
          }
        }
        return item
      })
    )
  }

  const calculateItemTotal = (item: OrderItem) => {
    const subtotal = item.product.price * item.quantity
    if (!item.discount) return subtotal

    if (item.discount.type === "fixed") {
      return Math.max(0, subtotal - item.discount.value)
    } else {
      return subtotal * (1 - item.discount.value / 100)
    }
  }

  const calculateWithdrawTotal = () => {
    return withdrawItems.reduce((sum, item) => {
      // Only calculate for items that are NOT being replaced
      const key = `${item.productId}-${item.batchId}`
      if (replacementItems[key]) return sum
      
      const product = PRODUCTS.find(p => p.id === item.productId)
      if (!product) return sum
      return sum + (product.price * item.quantity)
    }, 0)
  }

  const calculateSubtotal = () => {
    return orderItems.reduce((sum, item) => sum + item.product.price * item.quantity, 0)
  }

  const calculateTotalDiscount = () => {
    return orderItems.reduce((sum, item) => {
      const subtotal = item.product.price * item.quantity
      const total = calculateItemTotal(item)
      return sum + (subtotal - total)
    }, 0)
  }

  const calculateTotal = () => {
    return orderItems.reduce((sum, item) => sum + calculateItemTotal(item), 0)
  }

  const calculateVAT = () => {
    return calculateTotal() * 0.15 // 15% VAT
  }

  const calculateGrandTotal = () => {
    return calculateTotal() + calculateVAT()
  }

  const calculateNetAmount = () => {
    return calculateGrandTotal() - calculateWithdrawTotal()
  }

  const handleSubmit = () => {
    // Here you would submit the order to your backend
    alert("تم إرسال الطلب بنجاح!")
    sessionStorage.removeItem("orderItems")
    sessionStorage.removeItem("withdrawItems")
    sessionStorage.removeItem("replacementItems")
    router.push("/sales-rep")
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background pb-32">
      {/* Header */}
      <div className="bg-primary text-primary-foreground sticky top-0 z-10 shadow-lg">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <Link href="/sales-rep/new-order">
              <Button variant="ghost" size="sm" className="text-primary-foreground hover:bg-white/20">
                <ArrowRight className="w-5 h-5" />
              </Button>
            </Link>
            <h1 className="text-2xl font-bold">الفاتورة</h1>
            <div className="w-10" />
          </div>
        </div>
      </div>

      {/* Invoice Content */}
      <div className="container mx-auto px-4 py-6 space-y-4">
        {withdrawItems.length > 0 && (
          <Card className="p-5 rounded-2xl border-2 border-orange-300 bg-orange-50">
            <div className="flex items-start gap-3 mb-4">
              <AlertCircle className="w-5 h-5 text-orange-600 mt-1" />
              <div className="flex-1">
                <h3 className="font-bold text-lg text-orange-900 mb-2">منتجات مسحوبة من العميل</h3>
                <p className="text-sm text-orange-700 mb-3">
                  هذه المنتجات سيتم خصمها من رصيد العميل
                </p>
              </div>
            </div>
            <div className="space-y-2">
              {withdrawItems.map((item) => {
                const product = PRODUCTS.find(p => p.id === item.productId)
                if (!product) return null
                const key = `${item.productId}-${item.batchId}`
                const isReplacing = replacementItems[key]
                const itemValue = product.price * item.quantity
                
                return (
                  <div key={key} className="bg-white rounded-xl p-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <img
                        src={product.image || "/placeholder.svg"}
                        alt={product.name}
                        className="w-12 h-12 rounded-lg object-cover"
                      />
                      <div>
                        <p className="font-semibold">{product.name}</p>
                        <p className="text-sm text-muted-foreground">
                          الكمية: {item.quantity} × {product.price} ر.س
                        </p>
                        <Badge variant="outline" className="text-xs mt-1">
                          {WITHDRAW_REASONS.find(r => r.id === item.reason)?.label}
                        </Badge>
                      </div>
                    </div>
                    <div className="text-left">
                      <p className="font-bold text-orange-600">-{itemValue.toFixed(2)} ر.س</p>
                      {isReplacing && (
                        <Badge className="bg-blue-500 text-white text-xs mt-1">
                          سيتم التبديل
                        </Badge>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
            <Separator className="my-3" />
            <div className="flex justify-between items-center">
              <span className="font-semibold text-orange-900">إجمالي المسحوبات</span>
              <span className="font-bold text-lg text-orange-600">
                -{calculateWithdrawTotal().toFixed(2)} ر.س
              </span>
            </div>
          </Card>
        )}

        {/* Order Items */}
        {orderItems.length > 0 ? (
          orderItems.map((item, index) => {
            const itemSubtotal = item.product.price * item.quantity
            const itemTotal = calculateItemTotal(item)
            const itemDiscount = itemSubtotal - itemTotal

            return (
              <Card key={item.product.id} className="p-5 rounded-2xl border-2">
                <div className="flex items-start gap-4 mb-4">
                  <img
                    src={item.product.image || "/placeholder.svg"}
                    alt={item.product.name}
                    className="w-16 h-16 rounded-xl object-cover bg-muted"
                  />
                  <div className="flex-1">
                    <h3 className="font-bold text-lg mb-1">{item.product.name}</h3>
                    <p className="text-sm text-muted-foreground mb-2">
                      {item.quantity} × {item.product.price} ر.س
                    </p>
                    <div className="text-lg font-bold text-primary">{itemSubtotal.toFixed(2)} ر.س</div>
                  </div>
                </div>

                <Separator className="my-4" />

                {/* Discount Section */}
                <div className="space-y-3">
                  <Label className="text-sm font-semibold">الخصم (اختياري)</Label>
                  <div className="flex gap-3">
                    <Select
                      defaultValue={item.discount?.type || "fixed"}
                      onValueChange={(value: "fixed" | "percentage") => {
                        updateDiscount(item.product.id, value, item.discount?.value.toString() || "0")
                      }}
                    >
                      <SelectTrigger className="w-[140px] rounded-xl">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="fixed">
                          <div className="flex items-center gap-2">
                            <DollarSign className="w-4 h-4" />
                            مبلغ ثابت
                          </div>
                        </SelectItem>
                        <SelectItem value="percentage">
                          <div className="flex items-center gap-2">
                            <Percent className="w-4 h-4" />
                            نسبة مئوية
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <div className="flex-1 relative">
                      <Input
                        type="number"
                        placeholder="0"
                        className="rounded-xl pr-12"
                        value={item.discount?.value || ""}
                        onChange={(e) =>
                          updateDiscount(item.product.id, item.discount?.type || "fixed", e.target.value)
                        }
                      />
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground">
                        {item.discount?.type === "percentage" ? "%" : "ر.س"}
                      </span>
                    </div>
                  </div>
                  {itemDiscount > 0 && (
                    <div className="bg-primary/10 rounded-xl p-3 flex items-center justify-between">
                      <span className="text-sm text-primary font-medium">الخصم</span>
                      <span className="text-sm text-primary font-bold">-{itemDiscount.toFixed(2)} ر.س</span>
                    </div>
                  )}
                  {itemDiscount > 0 && (
                    <div className="bg-primary/20 rounded-xl p-3 flex items-center justify-between">
                      <span className="text-base font-semibold">المجموع بعد الخصم</span>
                      <span className="text-lg font-bold">{itemTotal.toFixed(2)} ر.س</span>
                    </div>
                  )}
                </div>
              </Card>
            )
          })
        ) : withdrawItems.length > 0 ? (
          <Card className="p-6 rounded-2xl border-2 border-muted text-center">
            <p className="text-muted-foreground">لا توجد منتجات جديدة في هذا الطلب</p>
            <p className="text-sm text-muted-foreground mt-1">فقط عمليات سحب من العميل</p>
          </Card>
        ) : null}

        {/* Summary Card */}
        <Card className="p-6 rounded-2xl border-2 border-primary/30 bg-primary/5">
          <h3 className="font-bold text-xl mb-4">ملخص الفاتورة</h3>
          <div className="space-y-3">
            {orderItems.length > 0 && (
              <>
                <div className="flex justify-between text-base">
                  <span className="text-muted-foreground">المجموع الفرعي</span>
                  <span className="font-semibold">{calculateSubtotal().toFixed(2)} ر.س</span>
                </div>
                {calculateTotalDiscount() > 0 && (
                  <div className="flex justify-between text-base text-primary">
                    <span className="font-medium">إجمالي الخصم</span>
                    <span className="font-bold">-{calculateTotalDiscount().toFixed(2)} ر.س</span>
                  </div>
                )}
                <div className="flex justify-between text-base">
                  <span className="text-muted-foreground">الضريبة (15%)</span>
                  <span className="font-semibold">{calculateVAT().toFixed(2)} ر.س</span>
                </div>
                <div className="flex justify-between text-lg font-bold text-primary">
                  <span>إجمالي الطلبات الجديدة</span>
                  <span>+{calculateGrandTotal().toFixed(2)} ر.س</span>
                </div>
              </>
            )}
            {withdrawItems.length > 0 && (
              <div className="flex justify-between text-lg font-bold text-orange-600">
                <span>إجمالي المسحوبات</span>
                <span>-{calculateWithdrawTotal().toFixed(2)} ر.س</span>
              </div>
            )}
            <Separator className="my-2" />
            <div className="flex justify-between text-2xl font-bold">
              <span>الباقي للعميل</span>
              <span className={calculateNetAmount() >= 0 ? "text-primary" : "text-orange-600"}>
                {calculateNetAmount() >= 0 ? "+" : ""}{calculateNetAmount().toFixed(2)} ر.س
              </span>
            </div>
            {calculateNetAmount() < 0 && (
              <p className="text-sm text-orange-600 mt-2">
                * سيتم خصم المبلغ من رصيد العميل
              </p>
            )}
          </div>
        </Card>
      </div>

      {/* Bottom Action Bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-card border-t-2 border-border shadow-lg">
        <div className="container mx-auto px-4 py-4">
          <Button
            size="lg"
            className="w-full bg-primary hover:bg-primary/90 py-6 text-lg rounded-2xl font-bold"
            onClick={handleSubmit}
          >
            <Check className="w-6 h-6 ml-2" />
            تأكيد الطلب
          </Button>
        </div>
      </div>
    </div>
  )
}
