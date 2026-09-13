"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ArrowRight, ArrowLeft, Users, FileText, Package, ShoppingCart, BarChart3, Settings, Bell, TrendingUp, Receipt, Boxes, ClipboardCheck, MessageSquare, MapPin, DollarSign, Check, Loader2, Building2, CreditCard, Copy, CheckCircle2 } from 'lucide-react'
import Link from "next/link"
import { SignUpFormData, SYSTEM_MODULES } from "@/types/modules"
import { validateEmail, validateUsername, validatePassword } from "@/lib/validation"
import Image from "next/image"

const moduleIcons: Record<string, any> = {
  "users": Users,
  "clipboard-list": ClipboardCheck,
  "message-square": MessageSquare,
  "shopping-cart": ShoppingCart,
  "map-pin": MapPin,
  "package": Boxes,
  "file-text": FileText,
  "box": Package,
  "bell": Bell,
  "bar-chart": TrendingUp,
  "settings": Settings,
  "dollar-sign": DollarSign
}

const moduleLogos: Record<string, string> = {
  "hr-management": "/hr-logo.png",
  "task-management": "/tasks-logo.png"
}

export default function SignUpPage() {
  const [currentStep, setCurrentStep] = useState(1)
  const [direction, setDirection] = useState<'forward' | 'backward'>('forward')
  const [isLoading, setIsLoading] = useState(false)
  const [loadingMessage, setLoadingMessage] = useState("")
  const [systemReady, setSystemReady] = useState(false)
  const [formData, setFormData] = useState<SignUpFormData>({
    fullName: "",
    email: "",
    phone: "",
    username: "",
    password: "",
    confirmPassword: "",
    organizationName: "",
    subdomain: "",
    selectedModules: []
  })
  
  const [focusedFields, setFocusedFields] = useState<Record<string, boolean>>({})
  
  const [errors, setErrors] = useState<Record<string, string>>({})

  const totalSteps = 3

  const updateField = (field: keyof SignUpFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    if (errors[field]) {
      setErrors(prev => {
        const newErrors = { ...prev }
        delete newErrors[field]
        return newErrors
      })
    }
    
    // Auto-generate subdomain from organization name
    if (field === 'organizationName') {
      const subdomain = value
        .toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9-]/g, '')
        .substring(0, 30)
      setFormData(prev => ({ ...prev, subdomain }))
    }
  }

  const toggleModule = (moduleId: string) => {
    setFormData(prev => ({
      ...prev,
      selectedModules: prev.selectedModules.includes(moduleId)
        ? prev.selectedModules.filter(id => id !== moduleId)
        : [...prev.selectedModules, moduleId]
    }))
  }

  const validateStep1 = (): boolean => {
    const newErrors: Record<string, string> = {}
    
    if (!formData.fullName.trim()) {
      newErrors.fullName = "الاسم الكامل مطلوب"
    }
    
    if (!formData.email.trim()) {
      newErrors.email = "البريد الإلكتروني مطلوب"
    } else if (!validateEmail(formData.email)) {
      newErrors.email = "البريد الإلكتروني غير صحيح"
    }

    if (!formData.phone?.trim()) {
      newErrors.phone = "رقم الجوال مطلوب"
    } else if (!/^[0-9+\-\s()]{10,}$/.test(formData.phone)) {
      newErrors.phone = "رقم الجوال غير صحيح"
    }
    
    if (!formData.username.trim()) {
      newErrors.username = "اسم المستخدم مطلوب"
    } else if (!validateUsername(formData.username)) {
      newErrors.username = "اسم المستخدم يجب أن يكون 3-20 حرف"
    }
    
    if (!formData.password) {
      newErrors.password = "كلمة المرور مطلوبة"
    } else {
      const passwordCheck = validatePassword(formData.password)
      if (!passwordCheck.isValid) {
        newErrors.password = passwordCheck.errors.join(", ")
      }
    }
    
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const validateStep2 = (): boolean => {
    const newErrors: Record<string, string> = {}
    
    if (!formData.organizationName.trim()) {
      newErrors.organizationName = "اسم المنظمة مطلوب"
    }
    
    if (!formData.subdomain.trim()) {
      newErrors.subdomain = "النطاق الفرعي مطلوب"
    } else if (!/^[a-z0-9-]+$/.test(formData.subdomain)) {
      newErrors.subdomain = "النطاق الفرعي يجب أن يحتوي على أحرف وأرقام وشرطات فقط"
    }
    
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleNext = () => {
    if (currentStep === 1 && validateStep1()) {
      setDirection('forward')
      setCurrentStep(2)
    } else if (currentStep === 2 && validateStep2()) {
      setDirection('forward')
      setCurrentStep(3)
    } else if (currentStep === 3) {
      setDirection('forward')
      setCurrentStep(4)
    }
  }

  const handleBack = () => {
    if (currentStep > 1) {
      setDirection('backward')
      setCurrentStep(prev => prev - 1)
    }
  }

  const getStepTitle = () => {
    switch (currentStep) {
      case 1:
        return "إنشاء حسابك"
      case 2:
        return "معلومات المنظمة"
      case 3:
        return "اختر الأنظمة المناسبة لك"
      default:
        return ""
    }
  }

  const getStepDescription = () => {
    switch (currentStep) {
      case 1:
        return "ابدأ رحلتك معنا بإنشاء حساب جديد"
      case 2:
        return "أخبرنا عن منظمتك وحدد نطاقك الفرعي المخصص"
      case 3:
        return "اختر الأنظمة التي تحتاجها - يمكنك إضافة المزيد لاحقاً"
      default:
        return ""
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleNext()
    }
  }

  const handlePayment = async () => {
    setIsLoading(true)
    
    const steps = [
      { message: "جاري إنشاء قاعدة البيانات...", duration: 2000 },
      { message: "جاري تفعيل الأنظمة المختارة...", duration: 2500 },
      { message: "جاري إعداد النطاق الفرعي...", duration: 2000 },
      { message: "جاري إعداد الإعدادات الأساسية...", duration: 2000 },
      { message: "جاري إنشاء حساب المستخدم...", duration: 1500 },
    ]

    for (const step of steps) {
      setLoadingMessage(step.message)
      await new Promise(resolve => setTimeout(resolve, step.duration))
    }

    setSystemReady(true)
    setIsLoading(false)
  }

  const selectedModulesData = SYSTEM_MODULES.filter(m => formData.selectedModules.includes(m.id))
  const totalAmount = selectedModulesData.reduce((sum, m) => sum + m.price, 0)
  const originalTotalAmount = selectedModulesData.reduce((sum, m) => sum + (m.originalPrice || m.price), 0)
  const discount = originalTotalAmount - totalAmount

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50/50 via-white to-green-50/50 text-foreground relative overflow-hidden" dir="rtl">
      <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-30">
        <div className="absolute top-20 right-20 w-[500px] h-[500px] bg-blue-400/20 rounded-full blur-3xl animate-pulse-slow" />
        <div className="absolute bottom-20 left-20 w-[500px] h-[500px] bg-green-400/20 rounded-full blur-3xl animate-pulse-slow" />
      </div>

      <div className="relative z-10 flex items-center justify-center pt-8 pb-4">
        <Image 
          src="/meena-logo.svg" 
          alt="Meena Base" 
          width={200} 
          height={80}
          className="animate-input-fade"
        />
      </div>

      <div className="relative z-10 max-w-6xl mx-auto px-6 pt-4 pb-16">
        <div 
          key={currentStep}
          className={`${
            direction === 'forward' 
              ? 'animate-slide-up-in' 
              : 'animate-slide-down-in'
          }`}
        >
          {currentStep !== 4 && currentStep !== 5 && (
            <div className="text-center mb-8">
              <h2 className="text-3xl md:text-4xl font-bold mb-3 text-foreground">
                {getStepTitle()}
              </h2>
              <p className="text-base text-muted-foreground">
                {getStepDescription()}
              </p>
            </div>
          )}

          <div className="space-y-6" onKeyPress={currentStep < 4 ? handleKeyPress : undefined}>
            {currentStep === 1 && (
              <div className="max-w-xl mx-auto space-y-4">
                <div className="animate-input-fade relative pt-2">
                  <label
                    htmlFor="fullName"
                    className={`absolute right-4 text-muted-foreground transition-all pointer-events-none ${
                      formData.fullName || focusedFields.fullName
                        ? "-top-2 text-xs font-medium text-gray-900 bg-white px-2"
                        : "top-5 text-base"
                    }`}
                  >
                    الاسم الكامل
                  </label>
                  <Input
                    id="fullName"
                    type="text"
                    value={formData.fullName}
                    onChange={(e) => updateField("fullName", e.target.value)}
                    onFocus={() => setFocusedFields(prev => ({ ...prev, fullName: true }))}
                    onBlur={() => setFocusedFields(prev => ({ ...prev, fullName: false }))}
                    className={`h-14 text-base bg-white border-2 border-gray-200 focus:border-blue-500 rounded-xl transition-all text-right ${
                      errors.fullName ? "border-red-500" : ""
                    }`}
                    dir="rtl"
                  />
                  {errors.fullName && (
                    <p className="text-red-600 text-sm mt-1.5 flex items-center gap-1">
                      <ArrowLeft className="w-3.5 h-3.5" />
                      {errors.fullName}
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-input-fade" style={{ animationDelay: '0.1s' }}>
                  <div className="relative pt-2">
                    <label
                      htmlFor="email"
                      className={`absolute right-4 text-muted-foreground transition-all pointer-events-none ${
                        formData.email || focusedFields.email
                          ? "-top-2 text-xs font-medium text-gray-900 bg-white px-2"
                          : "top-5 text-base"
                      }`}
                    >
                      البريد الإلكتروني
                    </label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => updateField("email", e.target.value)}
                      onFocus={() => setFocusedFields(prev => ({ ...prev, email: true }))}
                      onBlur={() => setFocusedFields(prev => ({ ...prev, email: false }))}
                      className={`h-14 text-base bg-white border-2 border-gray-200 focus:border-blue-500 rounded-xl transition-all text-right ${
                        errors.email ? "border-red-500" : ""
                      }`}
                      dir="rtl"
                    />
                    {errors.email && (
                      <p className="text-red-600 text-sm mt-1.5 flex items-center gap-1">
                        <ArrowLeft className="w-3.5 h-3.5" />
                        {errors.email}
                      </p>
                    )}
                  </div>

                  <div className="relative pt-2">
                    <label
                      htmlFor="phone"
                      className={`absolute right-4 text-muted-foreground transition-all pointer-events-none ${
                        formData.phone || focusedFields.phone
                          ? "-top-2 text-xs font-medium text-gray-900 bg-white px-2"
                          : "top-5 text-base"
                      }`}
                    >
                      رقم الجوال
                    </label>
                    <Input
                      id="phone"
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => updateField("phone", e.target.value)}
                      onFocus={() => setFocusedFields(prev => ({ ...prev, phone: true }))}
                      onBlur={() => setFocusedFields(prev => ({ ...prev, phone: false }))}
                      className={`h-14 text-base bg-white border-2 border-gray-200 focus:border-blue-500 rounded-xl transition-all text-right ${
                        errors.phone ? "border-red-500" : ""
                      }`}
                      dir="rtl"
                    />
                    {errors.phone && (
                      <p className="text-red-600 text-sm mt-1.5 flex items-center gap-1">
                        <ArrowLeft className="w-3.5 h-3.5" />
                        {errors.phone}
                      </p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-input-fade" style={{ animationDelay: '0.2s' }}>
                  <div className="relative pt-2">
                    <label
                      htmlFor="username"
                      className={`absolute right-4 text-muted-foreground transition-all pointer-events-none ${
                        formData.username || focusedFields.username
                          ? "-top-2 text-xs font-medium text-gray-900 bg-white px-2"
                          : "top-5 text-base"
                      }`}
                    >
                      اسم المستخدم
                    </label>
                    <Input
                      id="username"
                      type="text"
                      value={formData.username}
                      onChange={(e) => updateField("username", e.target.value.toLowerCase())}
                      onFocus={() => setFocusedFields(prev => ({ ...prev, username: true }))}
                      onBlur={() => setFocusedFields(prev => ({ ...prev, username: false }))}
                      className={`h-14 text-base bg-white border-2 border-gray-200 focus:border-green-500 rounded-xl transition-all text-right ${
                        errors.username ? "border-red-500" : ""
                      }`}
                      dir="rtl"
                    />
                    {errors.username && (
                      <p className="text-red-600 text-sm mt-1.5 flex items-center gap-1">
                        <ArrowLeft className="w-3.5 h-3.5" />
                        {errors.username}
                      </p>
                    )}
                  </div>

                  <div className="relative pt-2">
                    <label
                      htmlFor="password"
                      className={`absolute right-4 text-muted-foreground transition-all pointer-events-none ${
                        formData.password || focusedFields.password
                          ? "-top-2 text-xs font-medium text-gray-900 bg-white px-2"
                          : "top-5 text-base"
                      }`}
                    >
                      كلمة المرور
                    </label>
                    <Input
                      id="password"
                      type="password"
                      value={formData.password}
                      onChange={(e) => updateField("password", e.target.value)}
                      onFocus={() => setFocusedFields(prev => ({ ...prev, password: true }))}
                      onBlur={() => setFocusedFields(prev => ({ ...prev, password: false }))}
                      className={`h-14 text-base bg-white border-2 border-gray-200 focus:border-blue-500 rounded-xl transition-all text-right ${
                        errors.password ? "border-red-500" : ""
                      }`}
                      dir="rtl"
                    />
                    {errors.password && (
                      <p className="text-red-600 text-sm mt-1.5 flex items-center gap-1">
                        <ArrowLeft className="w-3.5 h-3.5" />
                        {errors.password}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between pt-6 animate-input-fade" style={{ animationDelay: '0.3s' }}>
                  <div className="flex items-center gap-2">
                    {[1, 2, 3].map((step) => (
                      <div
                        key={step}
                        className={`h-1.5 rounded-full transition-all duration-300 ${
                          step === currentStep
                            ? "w-8 bg-primary"
                            : step < currentStep
                            ? "w-1.5 bg-green-500"
                            : "w-1.5 bg-gray-300"
                        }`}
                      />
                    ))}
                    <span className="text-xs text-muted-foreground mr-2">
                      {currentStep}/{totalSteps}
                    </span>
                  </div>

                  <Button
                    onClick={handleNext}
                    size="lg"
                    className="group h-12 px-8 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-semibold rounded-full transition-all duration-200 shadow-lg shadow-blue-200"
                  >
                    التالي
                    <ArrowLeft className="w-4 h-4 mr-2 group-hover:-translate-x-1 transition-transform" />
                  </Button>
                </div>

                <div className="text-center pt-4">
                  <p className="text-muted-foreground text-sm">
                    لديك حساب بالفعل؟{" "}
                    <Link href="/sign/in" className="text-primary font-semibold hover:underline">
                      تسجيل الدخول
                    </Link>
                  </p>
                </div>
              </div>
            )}

            {currentStep === 2 && (
              <div className="max-w-xl mx-auto space-y-4">
                <div className="animate-input-fade relative pt-2">
                  <label
                    htmlFor="organizationName"
                    className={`absolute right-4 text-muted-foreground transition-all pointer-events-none ${
                      formData.organizationName || focusedFields.organizationName
                        ? "-top-2 text-xs font-medium text-gray-900 bg-white px-2"
                        : "top-5 text-base"
                    }`}
                  >
                    اسم المنظمة
                  </label>
                  <Input
                    id="organizationName"
                    type="text"
                    value={formData.organizationName}
                    onChange={(e) => updateField("organizationName", e.target.value)}
                    onFocus={() => setFocusedFields(prev => ({ ...prev, organizationName: true }))}
                    onBlur={() => setFocusedFields(prev => ({ ...prev, organizationName: false }))}
                    className={`h-14 text-base bg-white border-2 border-gray-200 focus:border-blue-500 rounded-xl transition-all text-right ${
                      errors.organizationName ? "border-red-500" : ""
                    }`}
                    dir="rtl"
                  />
                  {errors.organizationName && (
                    <p className="text-red-600 text-sm mt-1.5 flex items-center gap-1">
                      <ArrowLeft className="w-3.5 h-3.5" />
                      {errors.organizationName}
                    </p>
                  )}
                </div>

                <div className="animate-input-fade" style={{ animationDelay: '0.1s' }}>
                  <div className="flex items-center gap-0 bg-white border-2 border-gray-200 focus-within:border-green-500 rounded-xl overflow-hidden h-14 transition-all" dir="rtl">
                    <Input
                      id="subdomain"
                      type="text"
                      placeholder="your-company"
                      value={formData.subdomain}
                      onChange={(e) => updateField("subdomain", e.target.value.toLowerCase())}
                      className="flex-1 h-full border-0 bg-transparent text-base focus-visible:ring-0 focus-visible:ring-offset-0 text-right px-4"
                      dir="rtl"
                    />
                    <div className="h-full flex items-center px-4 bg-gray-50 border-l-2 border-gray-200 order-first">
                      <span className="text-muted-foreground text-sm font-medium whitespace-nowrap">.base.app</span>
                    </div>
                  </div>
                  <p className="text-muted-foreground text-xs mt-2 text-right">سيكون هذا هو رابط منصتك المخصص</p>
                  {errors.subdomain && (
                    <p className="text-red-600 text-sm mt-1.5 flex items-center gap-1">
                      <ArrowLeft className="w-3.5 h-3.5" />
                      {errors.subdomain}
                    </p>
                  )}
                </div>

                <div className="flex items-center justify-between pt-6 animate-input-fade" style={{ animationDelay: '0.2s' }}>
                  <div className="flex items-center gap-2">
                    {[1, 2, 3].map((step) => (
                      <div
                        key={step}
                        className={`h-1.5 rounded-full transition-all duration-300 ${
                          step === currentStep
                            ? "w-8 bg-primary"
                            : step < currentStep
                            ? "w-1.5 bg-green-500"
                            : "w-1.5 bg-gray-300"
                        }`}
                      />
                    ))}
                    <span className="text-xs text-muted-foreground mr-2">
                      {currentStep}/{totalSteps}
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      onClick={handleBack}
                      className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors group h-12 px-6"
                    >
                      <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                      <span className="font-medium">رجوع</span>
                    </button>
                    
                    <Button
                      onClick={handleNext}
                      size="lg"
                      className="group h-12 px-8 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-semibold rounded-full transition-all duration-200 shadow-lg shadow-blue-200"
                    >
                      التالي
                      <ArrowLeft className="w-4 h-4 mr-2 group-hover:-translate-x-1 transition-transform" />
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {currentStep === 3 && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 max-w-7xl mx-auto">
                  {SYSTEM_MODULES.map((module, index) => {
                    const Icon = moduleIcons[module.icon || 'package'] || Package
                    const isSelected = formData.selectedModules.includes(module.id)
                    const moduleLogo = moduleLogos[module.id]
                    
                    return (
                      <button
                        key={module.id}
                        onClick={() => toggleModule(module.id)}
                        className={`relative bg-white rounded-2xl border-2 transition-all duration-200 text-right group hover:scale-[1.02] animate-input-fade overflow-hidden min-h-[180px] ${
                          isSelected
                            ? "border-green-500 shadow-xl shadow-green-100"
                            : "border-gray-200 hover:border-blue-400 hover:shadow-lg"
                        }`}
                        style={{ animationDelay: `${index * 0.05}s` }}
                      >
                        <div className="flex flex-col gap-4 p-6 h-full">
                          <div className="flex items-start gap-4">
                            <div className={`flex-shrink-0 w-20 h-20 rounded-xl flex items-center justify-center transition-all ${
                              moduleLogo ? "bg-white border-2 border-gray-100" : (
                                isSelected
                                  ? "bg-gradient-to-br from-green-500 to-green-600"
                                  : "bg-gradient-to-br from-blue-500 to-blue-600"
                              )
                            }`}>
                              {moduleLogo ? (
                                <Image 
                                  src={moduleLogo || "/placeholder.svg"} 
                                  alt={module.name}
                                  width={70}
                                  height={70}
                                  className="object-contain"
                                />
                              ) : (
                                <Icon className="w-10 h-10 text-white" />
                              )}
                            </div>

                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between gap-2 mb-2">
                                <h3 className="text-base font-bold text-foreground leading-tight">{module.name}</h3>
                                
                                <div className={`flex-shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
                                  isSelected
                                    ? "bg-green-500 border-green-500"
                                    : "border-gray-300 group-hover:border-blue-400"
                                }`}>
                                  {isSelected && (
                                    <Check className="w-4 h-4 text-white" strokeWidth={3} />
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>

                          <p className="text-sm text-muted-foreground leading-relaxed flex-1">
                            {module.description}
                          </p>

                          <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                            <div className="flex items-center gap-2">
                              {module.originalPrice && module.originalPrice > module.price ? (
                                <>
                                  <span className="text-base text-gray-400 line-through">{module.originalPrice}</span>
                                  <span className="text-xl font-bold text-green-600">{module.price} ر.س</span>
                                </>
                              ) : module.price === 0 ? (
                                <span className="text-xl font-bold text-green-600">مجاني</span>
                              ) : (
                                <span className="text-xl font-bold text-foreground">{module.price} ر.س</span>
                              )}
                              {module.price > 0 && (
                                <span className="text-xs text-muted-foreground">/شهرياً</span>
                              )}
                            </div>
                            
                            <div className={`px-3 py-1 rounded-full text-xs font-semibold ${
                              isSelected
                                ? "bg-green-100 text-green-700"
                                : "bg-gray-100 text-gray-600"
                            }`}>
                              {isSelected ? "مفعّل" : "غير مفعّل"}
                            </div>
                          </div>
                        </div>

                        {isSelected && (
                          <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-green-500 to-green-600" />
                        )}
                      </button>
                    )
                  })}
                </div>

                {formData.selectedModules.length > 0 && (
                  <div className="bg-gradient-to-r from-green-50 to-blue-50 rounded-xl p-5 border-2 border-green-200 max-w-2xl mx-auto">
                    <div className="flex items-center justify-between">
                      <p className="text-green-700 font-semibold flex items-center gap-2">
                        <Check className="w-5 h-5" />
                        تم اختيار {formData.selectedModules.length} من الأنظمة
                      </p>
                      <div className="text-left">
                        <div className="text-2xl font-bold text-foreground">
                          {totalAmount} ر.س
                        </div>
                        <div className="text-xs text-muted-foreground">الإجمالي الشهري</div>
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between pt-6 max-w-2xl mx-auto">
                  <div className="flex items-center gap-2">
                    {[1, 2, 3].map((step) => (
                      <div
                        key={step}
                        className={`h-1.5 rounded-full transition-all duration-300 ${
                          step === currentStep
                            ? "w-8 bg-primary"
                            : step < currentStep
                            ? "w-1.5 bg-green-500"
                            : "w-1.5 bg-gray-300"
                        }`}
                      />
                    ))}
                    <span className="text-xs text-muted-foreground mr-2">
                      {currentStep}/{totalSteps}
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      onClick={handleBack}
                      className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors group h-12 px-6"
                    >
                      <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                      <span className="font-medium">رجوع</span>
                    </button>

                    <Button
                      onClick={handleNext}
                      size="lg"
                      disabled={formData.selectedModules.length === 0}
                      className="group h-12 px-8 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white font-semibold rounded-full transition-all duration-200 shadow-lg shadow-green-200 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      إنهاء التسجيل
                      <ArrowLeft className="w-4 h-4 mr-2 group-hover:-translate-x-1 transition-transform" />
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {currentStep === 4 && !isLoading && !systemReady && (
              <div className="max-w-4xl mx-auto space-y-6">
                <div className="text-center mb-8">
                  <h2 className="text-3xl font-bold mb-3 text-foreground">فاتورة التسجيل</h2>
                  <p className="text-base text-muted-foreground">مراجعة وتأكيد الاشتراك</p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* تفاصيل الفاتورة */}
                  <div className="lg:col-span-2 space-y-4">
                    <div className="bg-white rounded-2xl border-2 border-gray-200 p-6">
                      <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                        <Receipt className="w-5 h-5 text-blue-500" />
                        الأنظمة المختارة
                      </h3>
                      <div className="space-y-3">
                        {selectedModulesData.map((module) => (
                          <div key={module.id} className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0">
                            <div>
                              <p className="font-semibold text-foreground">{module.name}</p>
                              <p className="text-xs text-muted-foreground">{module.nameEn}</p>
                            </div>
                            <div className="text-left">
                              {module.originalPrice && module.originalPrice > module.price ? (
                                <div className="flex items-center gap-2">
                                  <span className="text-sm text-gray-400 line-through">{module.originalPrice} ر.س</span>
                                  <span className="text-lg font-bold text-green-600">{module.price} ر.س</span>
                                </div>
                              ) : (
                                <span className="text-lg font-bold text-foreground">{module.price} ر.س</span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="mt-6 pt-4 border-t-2 border-gray-200 space-y-2">
                        {discount > 0 && (
                          <>
                            <div className="flex items-center justify-between text-muted-foreground">
                              <span>المجموع قبل الخصم</span>
                              <span className="font-semibold">{originalTotalAmount} ر.س</span>
                            </div>
                            <div className="flex items-center justify-between text-green-600">
                              <span>الخصم</span>
                              <span className="font-semibold">-{discount} ر.س</span>
                            </div>
                          </>
                        )}
                        <div className="flex items-center justify-between text-xl font-bold text-foreground">
                          <span>الإجمالي الشهري</span>
                          <span>{totalAmount} ر.س</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* بيانات التحويل البنكي */}
                  <div className="space-y-4">
                    <div className="bg-white rounded-2xl border-2 border-gray-200 p-6">
                      <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                        <Building2 className="w-5 h-5 text-blue-500" />
                        معلومات المنظمة
                      </h3>
                      <div className="space-y-3 text-sm">
                        <div>
                          <p className="text-muted-foreground mb-1">اسم المنظمة</p>
                          <p className="font-semibold">{formData.organizationName}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground mb-1">النطاق الفرعي</p>
                          <p className="font-semibold">{formData.subdomain}.base.app</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground mb-1">البريد الإلكتروني</p>
                          <p className="font-semibold">{formData.email}</p>
                        </div>
                      </div>
                    </div>

                    {totalAmount > 0 && (
                      <div className="bg-gradient-to-br from-blue-50 to-green-50 rounded-2xl border-2 border-blue-200 p-6">
                        <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                          <CreditCard className="w-5 h-5 text-blue-600" />
                          بيانات التحويل البنكي
                        </h3>
                        <div className="space-y-3 text-sm">
                          <div>
                            <p className="text-muted-foreground mb-1">اسم المؤسسة</p>
                            <p className="font-bold text-foreground">مينا لتقنية المعلومات</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground mb-1">رقم الحساب (IBAN)</p>
                            <div className="flex items-center gap-2">
                              <p className="font-mono font-semibold text-foreground">SA1234567890123456789012</p>
                              <button className="p-1 hover:bg-white rounded">
                                <Copy className="w-3.5 h-3.5 text-muted-foreground" />
                              </button>
                            </div>
                          </div>
                          <div>
                            <p className="text-muted-foreground mb-1">اسم البنك</p>
                            <p className="font-semibold">البنك الأهلي السعودي</p>
                          </div>
                          <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                            <p className="text-xs text-amber-800">
                              يرجى إرسال إثبات التحويل على البريد الإلكتروني: payments@meenabase.com
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between pt-6 max-w-4xl mx-auto">
                  <button
                    onClick={handleBack}
                    className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors group h-12 px-6"
                  >
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                    <span className="font-medium">رجوع</span>
                  </button>

                  <Button
                    onClick={handlePayment}
                    size="lg"
                    className="group h-12 px-8 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white font-semibold rounded-full transition-all duration-200 shadow-lg shadow-green-200"
                  >
                    {totalAmount > 0 ? "تم الدفع - تفعيل النظام" : "تفعيل النظام"}
                    <Check className="w-4 h-4 mr-2" />
                  </Button>
                </div>
              </div>
            )}

            {currentStep === 4 && isLoading && (
              <div className="max-w-2xl mx-auto text-center space-y-8 py-16">
                <div className="animate-pulse">
                  <Loader2 className="w-16 h-16 text-blue-500 mx-auto animate-spin" />
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-foreground mb-3">جاري إعداد نظامك...</h3>
                  <p className="text-lg text-muted-foreground">{loadingMessage}</p>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                  <div className="bg-gradient-to-r from-blue-500 to-green-500 h-full rounded-full animate-loading-bar" style={{ width: '75%' }} />
                </div>
              </div>
            )}

            {currentStep === 4 && systemReady && (
              <div className="max-w-3xl mx-auto text-center space-y-8 py-8">
                <div className="animate-bounce-in">
                  <div className="w-20 h-20 bg-gradient-to-br from-green-500 to-green-600 rounded-full flex items-center justify-center mx-auto mb-6">
                    <CheckCircle2 className="w-12 h-12 text-white" strokeWidth={2.5} />
                  </div>
                  <h2 className="text-3xl font-bold text-foreground mb-3">تم إنشاء نظامك بنجاح!</h2>
                  <p className="text-lg text-muted-foreground">نظامك جاهز للاستخدام الآن</p>
                </div>

                <div className="bg-gradient-to-br from-blue-50 to-green-50 rounded-2xl border-2 border-blue-200 p-8 text-right">
                  <h3 className="text-xl font-bold mb-6 text-center">بيانات الدخول</h3>
                  <div className="space-y-4">
                    <div className="bg-white rounded-xl p-4 border border-gray-200">
                      <p className="text-sm text-muted-foreground mb-1">رابط النظام</p>
                      <div className="flex items-center justify-between">
                        <a 
                          href={`https://${formData.subdomain}.base.app`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-lg font-bold text-blue-600 hover:underline"
                        >
                          {formData.subdomain}.base.app
                        </a>
                        <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                          <Copy className="w-4 h-4 text-muted-foreground" />
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="bg-white rounded-xl p-4 border border-gray-200">
                        <p className="text-sm text-muted-foreground mb-1">اسم المستخدم</p>
                        <p className="text-lg font-bold text-foreground">{formData.username}</p>
                      </div>

                      <div className="bg-white rounded-xl p-4 border border-gray-200">
                        <p className="text-sm text-muted-foreground mb-1">البريد الإلكتروني</p>
                        <p className="text-lg font-bold text-foreground">{formData.email}</p>
                      </div>
                    </div>

                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                      <p className="text-sm text-amber-800">
                        تم إرسال رسالة تأكيد إلى بريدك الإلكتروني تحتوي على جميع التفاصيل
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex gap-4 justify-center">
                  <Button
                    onClick={() => window.location.href = `https://${formData.subdomain}.base.app`}
                    size="lg"
                    className="h-12 px-8 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-semibold rounded-full"
                  >
                    الذهاب إلى النظام
                    <ArrowLeft className="w-4 h-4 mr-2" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
