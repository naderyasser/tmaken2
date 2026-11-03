"use client"

import { useState, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { ArrowRight, Plus, Minus, ChevronRight, AlertCircle, XCircle, User, Package } from 'lucide-react'
import Link from "next/link"
import { useRouter, useSearchParams } from 'next/navigation'
import { useInventory } from "@/contexts/InventoryContext"
import { InventoryType } from "@/types/inventory"
import { Suspense } from "react"

interface Product {
  id: string
  name: string
  price: number
  unit: string
  category: string
  image: string
  lastDeliveredQuantity?: number
}

interface CustomerInventory {
  productId: string
  currentStock: number
  lastDeliveredQuantity: number
}

interface OrderItem {
  product: Product
  quantity: number
  batchId: string
}

interface WithdrawItem {
  productId: string
  batchId: string
  quantity: number
  reason: string // Changed to string to support custom reasons
  customReason?: string
}

const PRODUCTS: Product[] = [
  {
    id: "1",
    name: "زيت زيتون فاخر",
    price: 45.0,
    unit: "لتر",
    category: "زيوت",
    image: "/olive-oil-bottle.png",
    lastDeliveredQuantity: 4,
  },
  {
    id: "2",
    name: "أرز بسمتي",
    price: 35.0,
    unit: "كيس 5 كجم",
    category: "حبوب",
    image: "/rice-bag.png",
    lastDeliveredQuantity: 6,
  },
  {
    id: "3",
    name: "سكر أبيض",
    price: 12.0,
    unit: "كيس 2 كجم",
    category: "سكريات",
    image: "/sugar-bag.jpg",
    lastDeliveredQuantity: 10,
  },
  {
    id: "4",
    name: "شاي أسود",
    price: 28.0,
    unit: "علبة 400 جرام",
    category: "مشروبات",
    image: "/tea-box.jpg",
    lastDeliveredQuantity: 0,
  },
  {
    id: "5",
    name: "معكرونة",
    price: 8.5,
    unit: "كرتون 12 كيس",
    category: "معجنات",
    image: "/pasta-box.png",
    lastDeliveredQuantity: 3,
  },
  {
    id: "6",
    name: "صلصة طماطم",
    price: 15.0,
    unit: "كرتون 24 علبة",
    category: "معلبات",
    image: "/rich-tomato-sauce.png",
    lastDeliveredQuantity: 0,
  },
]

const REJECTION_REASONS = [
  { id: "stock", label: "عنده متطلب من المخزون" },
  { id: "certificate", label: "يحتاج شهادة ضريبية" },
  { id: "payment", label: "يريد تأجيل الدفع" },
  { id: "budget", label: "لا يوجد ميزانية حالياً" },
  { id: "competition", label: "يتعامل مع منافس" },
  { id: "other", label: "سبب آخر" },
]

const WITHDRAW_REASONS = [
  { id: "return", label: "رجيع" },
  { id: "damaged", label: "تالف" },
  { id: "expired", label: "منتهي الصلاحية" },
  { id: "near-expiry", label: "قرب انتهاء الصلاحية" },
  { id: "quality-issue", label: "مشكلة في الجودة" },
  { id: "wrong-product", label: "منتج خاطئ" },
  { id: "other", label: "أسباب أخرى" },
]

function NewOrderContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const customerId = searchParams.get("customerId")
  
  const { getCustomerInventory, withdrawFromCustomer, repInventory } = useInventory()
  
  const [savedCustomer, setSavedCustomer] = useState<any>(null)
  
  useEffect(() => {
    if (customerId) {
      const saved = localStorage.getItem(`customer-${customerId}`)
      if (saved) {
        setSavedCustomer(JSON.parse(saved))
      }
    }
  }, [customerId])
  
  const isExistingCustomer = customerId && (["1", "2"].includes(customerId) || savedCustomer)
  const customerType = ["1", "2"].includes(customerId || "") ? "active" : "potential"

  const [currentStage, setCurrentStage] = useState<"customer-info" | "wants-order" | "order">("customer-info")
  const [wantsOrderNow, setWantsOrderNow] = useState<boolean | null>(null)
  const [customerInfo, setCustomerInfo] = useState({
    name: "",
    phone: "",
    address: "",
    taxNumber: ""
  })
  const [locationLoading, setLocationLoading] = useState(false)
  
  // Auto-detect location
  const detectLocation = () => {
    setLocationLoading(true)
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          // In production, use reverse geocoding API
          // For now, set a placeholder
          setCustomerInfo(prev => ({ 
            ...prev, 
            address: `${position.coords.latitude.toFixed(4)}, ${position.coords.longitude.toFixed(4)}`
          }))
          setLocationLoading(false)
        },
        (error) => {
          console.error("[v0] Location error:", error)
          setLocationLoading(false)
        }
      )
    } else {
      setLocationLoading(false)
    }
  }
  
  const [step, setStep] = useState<"inventory" | "products">("inventory")
  const [orderType, setOrderType] = useState<"order" | "no-order">("order")
  const [customerInventory, setCustomerInventory] = useState<CustomerInventory[]>([])
  const [withdrawItems, setWithdrawItems] = useState<WithdrawItem[]>([])
  const [replacementItems, setReplacementItems] = useState<{[key: string]: boolean}>({})
  const [selectedBatches, setSelectedBatches] = useState<{[key: string]: number}>({})
  const [selectedReasons, setSelectedReasons] = useState<string[]>([])
  const [updatedCustomerBatches, setUpdatedCustomerBatches] = useState<{[key: string]: number}>({})

  useEffect(() => {
    if (isExistingCustomer) {
      setCurrentStage("order")
      const initialInventory = PRODUCTS.map(product => ({
        productId: product.id,
        currentStock: product.lastDeliveredQuantity || 0,
        lastDeliveredQuantity: product.lastDeliveredQuantity || 0
      }))
      setCustomerInventory(initialInventory)
    } else {
      setCurrentStage("customer-info")
      setStep("products")
    }
  }, [isExistingCustomer])

  const updateInventory = (productId: string, delta: number) => {
    setCustomerInventory(prevInventory => 
      prevInventory.map(inv => 
        inv.productId === productId 
          ? { ...inv, currentStock: Math.max(0, inv.currentStock + delta) }
          : inv
      )
    )
  }

  const updateCustomerBatchQuantity = (productId: string, batchId: string, delta: number, maxQuantity: number) => {
    const key = `${productId}-${batchId}`
    const currentQty = updatedCustomerBatches[key] ?? maxQuantity
    const newQty = Math.max(0, Math.min(maxQuantity, currentQty + delta))
    
    setUpdatedCustomerBatches(prev => ({
      ...prev,
      [key]: newQty
    }))
  }

  const getCustomerBatchQuantity = (productId: string, batchId: string, originalQuantity: number): number => {
    const key = `${productId}-${batchId}`
    return updatedCustomerBatches[key] ?? originalQuantity
  }

  const addProductFromBatch = (productId: string, productName: string, batchId: string, price: number, unit: string) => {
    const key = `${productId}-${batchId}`
    const currentQty = selectedBatches[key] || 0
    setSelectedBatches(prev => ({
      ...prev,
      [key]: currentQty + 1
    }))
  }

  const updateBatchQuantity = (productId: string, batchId: string, delta: number) => {
    const key = `${productId}-${batchId}`
    const currentQty = selectedBatches[key] || 0
    const newQty = Math.max(0, currentQty + delta)
    
    if (newQty === 0) {
      setSelectedBatches(prev => {
        const newState = { ...prev }
        delete newState[key]
        return newState
      })
    } else {
      setSelectedBatches(prev => ({
        ...prev,
        [key]: newQty
      }))
    }
  }

  const getInventoryStock = (productId: string) => {
    return customerInventory.find((inv) => inv.productId === productId)?.currentStock || 0
  }

  const getLastDeliveredQuantity = (productId: string) => {
    return customerInventory.find((inv) => inv.productId === productId)?.lastDeliveredQuantity || 0
  }

  const getProductTotalQuantity = (productId: string): number => {
    return Object.keys(selectedBatches)
      .filter(key => key.startsWith(`${productId}-`))
      .reduce((sum, key) => sum + selectedBatches[key], 0)
  }

  const getTotalItems = () => {
    return Object.values(selectedBatches).reduce((sum, qty) => sum + qty, 0)
  }

  const getProductStatus = (productId: string): "empty" | "new" | "normal" => {
    const stock = getInventoryStock(productId)
    const lastDelivered = getLastDeliveredQuantity(productId)
    
    if (stock === 0 && lastDelivered > 0) return "empty"
    if (lastDelivered === 0) return "new"
    return "normal"
  }

  const addWithdrawItem = (productId: string, batchId: string, reason: string) => {
    const existing = withdrawItems.find((item) => item.productId === productId && item.batchId === batchId)
    if (existing) {
      setWithdrawItems(
        withdrawItems.map((item) =>
          item.productId === productId && item.batchId === batchId 
            ? { ...item, quantity: item.quantity + 1 }
            : item
        )
      )
    } else {
      setWithdrawItems([...withdrawItems, { productId, batchId, quantity: 1, reason }])
    }
  }

  const updateWithdrawQuantity = (productId: string, batchId: string, delta: number) => {
    setWithdrawItems(
      withdrawItems
        .map((item) => {
          if (item.productId === productId && item.batchId === batchId) {
            const newQuantity = item.quantity + delta
            return newQuantity > 0 ? { ...item, quantity: newQuantity } : null
          }
          return item
        })
        .filter((item): item is WithdrawItem => item !== null)
    )
  }

  const updateWithdrawReason = (productId: string, batchId: string, reason: string, customReason?: string) => {
    setWithdrawItems(
      withdrawItems.map((item) =>
        item.productId === productId && item.batchId === batchId
          ? { ...item, reason, customReason }
          : item
      )
    )
  }

  const getWithdrawReason = (productId: string, batchId: string): string => {
    return withdrawItems.find((item) => item.productId === productId && item.batchId === batchId)?.reason || "return"
  }

  const getCustomReason = (productId: string, batchId: string): string => {
    return withdrawItems.find((item) => item.productId === productId && item.batchId === batchId)?.customReason || ""
  }

  const removeWithdrawItem = (productId: string, batchId: string) => {
    setWithdrawItems(withdrawItems.filter((item) => !(item.productId === productId && item.batchId === batchId)))
  }

  const toggleReplacement = (key: string) => {
    setReplacementItems(prev => ({
      ...prev,
      [key]: !prev[key]
    }))
  }

  const handleNext = () => {
    if (isExistingCustomer && step === "inventory" && orderType === "order") {
      if (withdrawItems.length > 0 && customerId) {
        withdrawItems.forEach(item => {
          const inventoryType: InventoryType = 
            item.reason === "return" ? "return" :
            item.reason === "damaged" ? "damaged" :
            item.reason === "expired" || item.reason === "near-expiry" ? "expired" :
            "damaged"
          
          withdrawFromCustomer(customerId, item.productId, item.batchId, item.quantity, inventoryType)
        })
      }
      
      setStep("products")
      return
    }

    if (orderType === "order" && (Object.keys(selectedBatches).length > 0 || withdrawItems.length > 0)) {
      const orderItemsForInvoice = Object.entries(selectedBatches).map(([key, quantity]) => {
        const [productId, batchId] = key.split('-')
        const repItem = repInventory.items.find(i => i.productId === productId)
        const product = PRODUCTS.find(p => p.id === productId)
        
        return {
          product: product!,
          quantity,
          batchId
        }
      })
      
      sessionStorage.setItem("orderItems", JSON.stringify(orderItemsForInvoice))
      sessionStorage.setItem("customerInventory", JSON.stringify(customerInventory))
      sessionStorage.setItem("withdrawItems", JSON.stringify(withdrawItems))
      sessionStorage.setItem("replacementItems", JSON.stringify(replacementItems))
      router.push("/sales-rep/invoice")
    } else if (orderType === "no-order" && selectedReasons.length > 0) {
      alert("تم تسجيل أسباب عدم التنزيل بنجاح")
      router.push("/sales-rep")
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

  const handleCustomerInfoNext = () => {
    if (customerInfo.name && customerInfo.phone && customerInfo.address) {
      if (customerId) {
        localStorage.setItem(`customer-${customerId}`, JSON.stringify(customerInfo))
        setSavedCustomer(customerInfo)
      }
      setCurrentStage("wants-order")
    }
  }

  const handleWantsOrderResponse = (wantsOrder: boolean) => {
    setWantsOrderNow(wantsOrder)
    if (wantsOrder) {
      setCurrentStage("order")
      setOrderType("order")
    } else {
      // Save as potential customer and redirect
      if (customerId) {
        localStorage.setItem(`customer-${customerId}`, JSON.stringify({
          ...customerInfo,
          type: "potential"
        }))
      }
      alert("تم حفظ العميل كعميل محتمل بنجاح")
      router.push("/sales-rep")
    }
  }

  const canProceedCustomerInfo = customerInfo.name && customerInfo.phone && customerInfo.address

  const customerInv = customerId ? getCustomerInventory(customerId) : undefined
  const getBatchQuantity = (productId: string, batchId: string): number => {
    const key = `${productId}-${batchId}`
    return selectedBatches[key] || 0
  }

  const getWithdrawQuantity = (productId: string, batchId: string): number => {
    const item = withdrawItems.find(w => w.productId === productId && w.batchId === batchId)
    return item?.quantity || 0
  }

  const canCompleteOrder = () => {
    if (orderType === "no-order") {
      return selectedReasons.length > 0
    }
    if (isExistingCustomer && step === "inventory") {
      return true
    }
    return Object.keys(selectedBatches).length > 0 || withdrawItems.length > 0
  }

  if (!isExistingCustomer && currentStage === "customer-info") {
    return (
      <div className="min-h-screen bg-slate-50 pb-24">
        <div className="bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 text-white pt-12 pb-8 px-5 rounded-b-[2rem]">
          <div className="flex items-center justify-between">
            <Button 
              variant="ghost" 
              size="sm" 
              className="text-white hover:bg-white/20"
              onClick={() => router.push("/sales-rep")}
            >
              <ArrowRight className="w-5 h-5" />
            </Button>
            <h1 className="text-xl font-bold">بيانات العميل الجديد</h1>
            <div className="w-10" />
          </div>
        </div>

        <div className="px-5 py-5">
          <Card className="p-5 rounded-2xl bg-white border border-slate-200">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
                <User className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <h2 className="font-bold text-base text-slate-800">معلومات العميل</h2>
                <p className="text-xs text-slate-500">أدخل بيانات العميل الجديد</p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <Label htmlFor="name" className="text-sm font-medium mb-2 block text-slate-700">
                  اسم العميل <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="name"
                  placeholder="أدخل اسم العميل"
                  value={customerInfo.name}
                  onChange={(e) => setCustomerInfo({ ...customerInfo, name: e.target.value })}
                  className="h-11 text-sm border-slate-200"
                />
              </div>

              <div>
                <Label htmlFor="phone" className="text-sm font-medium mb-2 block text-slate-700">
                  رقم الجوال <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="phone"
                  type="tel"
                  placeholder="05xxxxxxxx"
                  value={customerInfo.phone}
                  onChange={(e) => setCustomerInfo({ ...customerInfo, phone: e.target.value })}
                  className="h-11 text-sm border-slate-200"
                  dir="ltr"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label htmlFor="address" className="text-sm font-medium text-slate-700">
                    العنوان <span className="text-red-500">*</span>
                  </Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 h-8 text-xs"
                    onClick={detectLocation}
                    disabled={locationLoading}
                  >
                    {locationLoading ? "جاري التحديد..." : "تحديد تلقائي"}
                  </Button>
                </div>
                <Input
                  id="address"
                  placeholder="أدخل عنوان العميل أو حدده تلقائياً"
                  value={customerInfo.address}
                  onChange={(e) => setCustomerInfo({ ...customerInfo, address: e.target.value })}
                  className="h-11 text-sm border-slate-200"
                />
              </div>

              <div>
                <Label htmlFor="taxNumber" className="text-sm font-medium mb-2 block text-slate-700">
                  الرقم الضريبي (اختياري)
                </Label>
                <Input
                  id="taxNumber"
                  placeholder="أدخل الرقم الضريبي"
                  value={customerInfo.taxNumber}
                  onChange={(e) => setCustomerInfo({ ...customerInfo, taxNumber: e.target.value })}
                  className="h-11 text-sm border-slate-200"
                />
              </div>
            </div>
          </Card>
        </div>

        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 shadow-lg max-w-[430px] mx-auto">
          <div className="px-5 py-4">
            <Button
              size="lg"
              className="w-full py-6 text-base rounded-xl font-bold bg-blue-600 hover:bg-blue-700 text-white"
              disabled={!canProceedCustomerInfo}
              onClick={handleCustomerInfoNext}
            >
              التالي
              <ChevronRight className="w-5 h-5 mr-2" />
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
        <div className="bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 text-white pt-12 pb-8 px-5 rounded-b-[2rem]">
          <div className="flex items-center justify-between">
            <Button 
              variant="ghost" 
              size="sm" 
              className="text-white hover:bg-white/20"
              onClick={() => setCurrentStage("customer-info")}
            >
              <ArrowRight className="w-5 h-5" />
            </Button>
            <h1 className="text-xl font-bold">رغبة العميل في الطلب</h1>
            <div className="w-10" />
          </div>
        </div>

        <div className="px-5 py-8">
          <Card className="p-6 rounded-2xl bg-white border border-slate-200 text-center">
            <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center mx-auto mb-4">
              <Package className="w-8 h-8 text-blue-600" />
            </div>
            <h2 className="font-bold text-lg text-slate-800 mb-2">هل يريد العميل طلب الآن؟</h2>
            <p className="text-sm text-slate-500 mb-6">اختر الإجابة المناسبة للمتابعة</p>
            
            <div className="space-y-3">
              <Button
                size="lg"
                className="w-full py-6 text-base rounded-xl font-bold bg-emerald-600 hover:bg-emerald-700 text-white"
                onClick={() => handleWantsOrderResponse(true)}
              >
                نعم، يريد طلب الآن
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="w-full py-6 text-base rounded-xl font-bold border-slate-300 hover:bg-slate-100 text-slate-700 bg-transparent"
                onClick={() => handleWantsOrderResponse(false)}
              >
                لا، سيطلب لاحقاً
              </Button>
            </div>
          </Card>

          <div className="mt-4 p-4 bg-blue-50 rounded-xl border border-blue-200">
            <p className="text-xs text-blue-700 text-center">
              <strong>ملاحظة:</strong> إذا اختار العميل "لا"، سيتم حفظه كعميل محتمل ويمكنك التواصل معه لاحقاً
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="bg-primary text-primary-foreground sticky top-0 z-10 shadow-lg">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <Button 
              variant="ghost" 
              size="sm" 
              className="text-primary-foreground hover:bg-primary-foreground/20"
              onClick={handleBack}
            >
              <ArrowRight className="w-5 h-5" />
            </Button>
            <h1 className="text-2xl font-bold">
              {isExistingCustomer ? "طلب لعميل قديم" : "عميل جديد"}
            </h1>
            <div className="w-10" />
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6">
        <Tabs
          defaultValue="order"
          value={orderType}
          onValueChange={(value) => setOrderType(value as "order" | "no-order")}
          className="w-full"
        >
          <TabsList className={`grid w-full grid-cols-2 mb-6 bg-muted p-1 rounded-2xl h-14`}>
            <TabsTrigger
              value="order"
              className="rounded-xl text-base font-bold data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
            >
              {isExistingCustomer && step === "inventory" ? "تحديث المخزون" : "يبي ينزّل"}
            </TabsTrigger>
            <TabsTrigger
              value="no-order"
              className="rounded-xl text-base font-bold data-[state=active]:bg-destructive data-[state=active]:text-destructive-foreground"
            >
              لم يتم التنزيل
            </TabsTrigger>
          </TabsList>

          <TabsContent value="order" className="space-y-4 mt-6">
            {isExistingCustomer && step === "inventory" ? (
              <>
                <Card className="p-4 bg-blue-50 border-blue-200 mb-4">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5" />
                    <div>
                      <h3 className="font-bold text-blue-900 mb-1">تحديث وسحب المخزون</h3>
                      <p className="text-sm text-blue-700">
                        استخدم + و - لتحديث الكمية المتبقية، أو انقر "سحب" لسحب منتجات من العميل
                      </p>
                    </div>
                  </div>
                </Card>

                {customerInv && customerInv.items.length > 0 ? (
                  customerInv.items
                    .filter(item => item.type === "active")
                    .map((item) => {
                      const product = PRODUCTS.find(p => p.id === item.productId)
                      if (!product) return null

                      return (
                        <Card key={item.productId} className="p-4 rounded-xl border-2">
                          <div className="mb-3">
                            <div className="flex items-center gap-4">
                              <img
                                src={product.image || "/placeholder.svg"}
                                alt={product.name}
                                className="w-16 h-16 rounded-lg object-cover bg-muted flex-shrink-0"
                              />
                              <div className="flex-1">
                                <h3 className="font-bold text-base mb-1">{product.name}</h3>
                                <p className="text-sm text-muted-foreground">{product.unit}</p>
                              </div>
                            </div>
                          </div>

                          <div className="space-y-3 mt-3 pt-3 border-t">
                            {item.batches.map((batch) => {
                              const withdrawQty = getWithdrawQuantity(item.productId, batch.batchId)
                              const withdrawReason = getWithdrawReason(item.productId, batch.batchId)
                              const customReason = getCustomReason(item.productId, batch.batchId)
                              const isWithdrawing = withdrawQty > 0
                              const currentBatchQty = getCustomerBatchQuantity(item.productId, batch.batchId, batch.quantity)
                              
                              return (
                                <div
                                  key={batch.batchId}
                                  className={`p-3 rounded-lg transition-all ${
                                    isWithdrawing ? 'bg-orange-50 border-2 border-orange-300' : 'bg-muted/30'
                                  }`}
                                >
                                  <div className="flex items-center justify-between mb-3">
                                    <div className="text-sm">
                                      <p className="font-medium">
                                        تاريخ الانتهاء: {new Date(batch.expiryDate).toLocaleDateString("en-GB")}
                                      </p>
                                      <p className="text-xs text-muted-foreground">
                                        متوفر: {currentBatchQty} وحدة
                                      </p>
                                    </div>
                                  </div>

                                  {!isWithdrawing ? (
                                    <div className="flex items-center gap-2">
                                      <div className="flex items-center gap-2 bg-primary/10 rounded-full px-2 py-1.5 flex-1">
                                        <Button
                                          size="icon"
                                          variant="ghost"
                                          className="h-8 w-8 rounded-full bg-background hover:bg-muted text-primary"
                                          onClick={() => {
                                            updateCustomerBatchQuantity(item.productId, batch.batchId, -1, batch.quantity)
                                          }}
                                          disabled={currentBatchQty <= 0}
                                        >
                                          <Minus className="w-4 h-4" />
                                        </Button>
                                        <span className="font-bold text-base min-w-[2.5rem] text-center text-primary">
                                          {currentBatchQty}
                                        </span>
                                        <Button
                                          size="icon"
                                          variant="ghost"
                                          className="h-8 w-8 rounded-full bg-primary hover:bg-primary/90 text-primary-foreground"
                                          onClick={() => {
                                            updateCustomerBatchQuantity(item.productId, batch.batchId, 1, batch.quantity)
                                          }}
                                          disabled={currentBatchQty >= batch.quantity}
                                        >
                                          <Plus className="w-4 h-4" />
                                        </Button>
                                      </div>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        className="border-orange-500 text-orange-600 hover:bg-orange-50 font-bold bg-transparent"
                                        onClick={() => addWithdrawItem(item.productId, batch.batchId, "return")}
                                      >
                                        <XCircle className="w-4 h-4 ml-1" />
                                        سحب
                                      </Button>
                                    </div>
                                  ) : (
                                    <div className="space-y-3">
                                      <div className="flex items-center gap-2">
                                        <Label className="text-sm font-medium min-w-[60px]">السبب:</Label>
                                        <Select
                                          value={withdrawReason}
                                          onValueChange={(value: string) => 
                                            updateWithdrawReason(item.productId, batch.batchId, value)
                                          }
                                        >
                                          <SelectTrigger className="flex-1">
                                            <SelectValue />
                                          </SelectTrigger>
                                          <SelectContent>
                                            {WITHDRAW_REASONS.map(reason => (
                                              <SelectItem key={reason.id} value={reason.id}>
                                                {reason.label}
                                              </SelectItem>
                                            ))}
                                          </SelectContent>
                                        </Select>
                                      </div>

                                      {withdrawReason === "other" && (
                                        <div className="flex items-center gap-2">
                                          <Label className="text-sm font-medium min-w-[60px]">السبب:</Label>
                                          <Input
                                            placeholder="اكتب السبب..."
                                            value={customReason}
                                            onChange={(e) => 
                                              updateWithdrawReason(item.productId, batch.batchId, withdrawReason, e.target.value)
                                            }
                                            className="flex-1"
                                          />
                                        </div>
                                      )}
                                      
                                      <div className="flex items-center justify-between">
                                        <span className="text-sm font-medium">الكمية:</span>
                                        <div className="flex items-center gap-2 bg-orange-200 rounded-full px-2 py-1.5">
                                          <Button
                                            size="icon"
                                            variant="ghost"
                                            className="h-8 w-8 rounded-full bg-white hover:bg-muted"
                                            onClick={() => updateWithdrawQuantity(item.productId, batch.batchId, -1)}
                                            disabled={withdrawQty <= 1}
                                          >
                                            <Minus className="w-4 h-4" />
                                          </Button>
                                          <span className="font-bold text-lg min-w-[2.5rem] text-center">
                                            {withdrawQty}
                                          </span>
                                          <Button
                                            size="icon"
                                            variant="ghost"
                                            className="h-8 w-8 rounded-full bg-orange-500 hover:bg-orange-600 text-white"
                                            onClick={() => updateWithdrawQuantity(item.productId, batch.batchId, 1)}
                                            disabled={withdrawQty >= currentBatchQty}
                                          >
                                            <Plus className="w-4 h-4" />
                                          </Button>
                                        </div>
                                      </div>

                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        className="w-full text-red-600 hover:text-red-700 hover:bg-red-50"
                                        onClick={() => removeWithdrawItem(item.productId, batch.batchId)}
                                      >
                                        إلغاء السحب
                                      </Button>
                                    </div>
                                  )}
                                </div>
                              )
                            })}
                          </div>
                        </Card>
                      )
                    })
                ) : (
                  <Card className="p-8 text-center">
                    <p className="text-muted-foreground">لا يوجد مخزون متوفر عند العميل</p>
                    <Link href="/sales-rep">
                      <Button variant="outline" className="mt-4 bg-transparent">
                        <ArrowRight className="w-4 h-4 ml-2" />
                        العودة للصفحة الرئيسية
                      </Button>
                    </Link>
                  </Card>
                )}
              </>
            ) : (
              <>
                {isExistingCustomer && withdrawItems.length > 0 && (
                  <Card className="p-4 bg-orange-50 border-orange-200 mb-4">
                    <h3 className="font-bold text-orange-900 mb-3">منتجات مسحوبة - هل تريد التبديل؟</h3>
                    <div className="space-y-2">
                      {withdrawItems.map(item => {
                        const product = PRODUCTS.find(p => p.id === item.productId)
                        if (!product) return null
                        const key = `${item.productId}-${item.batchId}`
                        
                        return (
                          <div key={key} className="flex items-center justify-between p-2 bg-white rounded-lg">
                            <div className="flex items-center gap-2">
                              <Checkbox
                                id={key}
                                checked={replacementItems[key] || false}
                                onCheckedChange={() => toggleReplacement(key)}
                              />
                              <Label htmlFor={key} className="cursor-pointer">
                                {product.name} ({item.quantity} وحدة)
                              </Label>
                            </div>
                            <Badge variant="outline" className="text-xs">
                              {WITHDRAW_REASONS.find(r => r.id === item.reason)?.label}
                            </Badge>
                          </div>
                        )
                      })}
                    </div>
                  </Card>
                )}

                {isExistingCustomer && (
                  <div className="flex gap-2 mb-4">
                    <Card className="flex-1 p-3 bg-yellow-50 border-yellow-300">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-yellow-500" />
                        <span className="text-sm font-medium text-yellow-900">منتجات خلصت</span>
                      </div>
                    </Card>
                    <Card className="flex-1 p-3 bg-blue-50 border-blue-200">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-blue-500" />
                        <span className="text-sm font-medium text-blue-900">منتجات جديدة</span>
                      </div>
                    </Card>
                  </div>
                )}

                {repInventory.items
                  .filter(item => item.type === "active")
                  .map((item) => {
                    const product = PRODUCTS.find(p => p.id === item.productId)
                    if (!product) return null
                    
                    const totalQuantity = getProductTotalQuantity(item.productId)
                    const status = isExistingCustomer ? getProductStatus(item.productId) : "normal"
                    
                    const borderColor = 
                      status === "empty" ? "border-yellow-400 bg-yellow-50/50" :
                      status === "new" ? "border-blue-300 bg-blue-50/50" :
                      "border-border"

                    return (
                      <Card key={item.productId} className={`p-4 rounded-xl border-2 ${borderColor} transition-all`}>
                        <div className="flex items-start gap-4 mb-3">
                          <div className="relative flex-shrink-0">
                            <img
                              src={product.image || "/placeholder.svg"}
                              alt={product.name}
                              className="w-20 h-20 rounded-xl object-cover bg-muted"
                            />
                            {status === "empty" && (
                              <Badge className="absolute -top-2 -right-2 bg-yellow-500 text-white text-xs">
                               خلص
                              </Badge>
                            )}
                            {status === "new" && (
                              <Badge className="absolute -top-2 -right-2 bg-blue-500 text-white text-xs">
                                جديد
                              </Badge>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="font-bold text-lg mb-1 truncate">{product.name}</h3>
                            <p className="text-sm text-muted-foreground mb-2">{product.unit}</p>
                            <div className="flex items-center gap-2 flex-wrap">
                              <Badge variant="secondary" className="text-xs">
                                {product.category}
                              </Badge>
                              <span className="text-base font-bold text-primary">{product.price} ر.س</span>
                            </div>
                            {totalQuantity > 0 && (
                              <div className="mt-2">
                                <Badge className="bg-primary text-primary-foreground">
                                  المحدد: {totalQuantity}
                                </Badge>
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="space-y-2 mt-3 pt-3 border-t">
                          {item.batches.map((batch) => {
                            const batchQty = getBatchQuantity(item.productId, batch.batchId)
                            
                            return (
                              <div
                                key={batch.batchId}
                                className={`p-3 rounded-lg ${
                                  batchQty > 0 ? 'bg-primary/10 border-2 border-primary' : 'bg-muted/30'
                                }`}
                              >
                                <div className="flex items-center justify-between mb-2">
                                  <div className="text-sm">
                                    <p className="font-medium">
                                      تاريخ الانتهاء: {new Date(batch.expiryDate).toLocaleDateString("en-GB")}
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                      متوفر: {batch.quantity} وحدة
                                    </p>
                                  </div>
                                </div>

                                <div className="flex items-center gap-2">
                                  {batchQty > 0 ? (
                                    <div className="flex items-center gap-2 bg-primary/10 rounded-full px-1.5 py-1.5 flex-1">
                                      <Button
                                        size="icon"
                                        variant="ghost"
                                        className="h-9 w-9 rounded-full bg-background hover:bg-muted text-primary flex-shrink-0"
                                        onClick={() => updateBatchQuantity(item.productId, batch.batchId, -1)}
                                        disabled={batchQty <= 0}
                                      >
                                        <Minus className="w-4 h-4" />
                                      </Button>
                                      <span className="font-bold text-lg min-w-[2rem] text-center text-primary">
                                        {batchQty}
                                      </span>
                                      <Button
                                        size="icon"
                                        variant="ghost"
                                        className="h-9 w-9 rounded-full bg-primary hover:bg-primary/90 text-primary-foreground flex-shrink-0"
                                        onClick={() => updateBatchQuantity(item.productId, batch.batchId, 1)}
                                        disabled={batchQty >= batch.quantity}
                                      >
                                        <Plus className="w-4 h-4" />
                                      </Button>
                                    </div>
                                  ) : (
                                    <Button
                                      size="sm"
                                      className="flex-1 bg-primary hover:bg-primary/90"
                                      onClick={() => addProductFromBatch(
                                        item.productId, 
                                        product.name, 
                                        batch.batchId, 
                                        product.price, 
                                        product.unit
                                      )}
                                      disabled={batch.quantity === 0}
                                    >
                                      <Plus className="w-4 h-4 ml-1" />
                                      إضافة
                                    </Button>
                                  )}
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </Card>
                    )
                  })}
              </>
            )}
          </TabsContent>

          <TabsContent value="no-order" className="space-y-4 mt-6">
            <Card className="p-6 rounded-2xl">
              <h3 className="font-bold text-lg mb-4">اختر سبب عدم التنزيل:</h3>
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
                    <Label
                      htmlFor={reason.id}
                      className="text-base font-medium leading-none cursor-pointer"
                    >
                      {reason.label}
                    </Label>
                  </div>
                ))}
              </div>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-card border-t-2 border-border shadow-lg">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between gap-4">
            {orderType === "order" ? (
              <div className="flex-1">
                <div className="text-sm text-muted-foreground">
                  {isExistingCustomer && step === "inventory" ? "المنتجات المحدثة" : "إجمالي المنتجات"}
                </div>
                <div className="text-2xl font-bold text-primary">
                  {isExistingCustomer && step === "inventory" 
                    ? `${customerInventory.length} منتج`
                    : `${getTotalItems()} منتج`
                  }
                </div>
              </div>
            ) : (
              <div className="flex-1">
                <div className="text-sm text-muted-foreground">الأسباب المحددة</div>
                <div className="text-2xl font-bold text-destructive">{selectedReasons.length} سبب</div>
              </div>
            )}
            <Button
              size="lg"
              className={`px-8 py-6 text-lg rounded-2xl font-bold ${
                orderType === "order"
                  ? "bg-primary hover:bg-primary/90"
                  : "bg-destructive hover:bg-destructive/90"
              }`}
              disabled={!canCompleteOrder()}
              onClick={handleNext}
            >
              {orderType === "order" 
                ? (isExistingCustomer && step === "inventory" ? "التالي" : "إنهاء الطلب")
                : "تسجيل"
              }
              <ChevronRight className="w-5 h-5 mr-2" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function NewOrderPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-muted-foreground">جاري التحميل...</p>
        </div>
      </div>
    }>
      <NewOrderContent />
    </Suspense>
  )
}
