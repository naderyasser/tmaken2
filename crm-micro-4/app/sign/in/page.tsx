"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { AlertCircle, ArrowLeft } from 'lucide-react'
import Link from "next/link"

export default function SignInPage() {
  const [formData, setFormData] = useState({
    emailOrUsername: "",
    password: ""
  })
  
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [isLoading, setIsLoading] = useState(false)

  const updateField = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    if (errors[field]) {
      setErrors(prev => {
        const newErrors = { ...prev }
        delete newErrors[field]
        return newErrors
      })
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    const newErrors: Record<string, string> = {}
    
    if (!formData.emailOrUsername.trim()) {
      newErrors.emailOrUsername = "البريد الإلكتروني أو اسم المستخدم مطلوب"
    }
    
    if (!formData.password) {
      newErrors.password = "كلمة المرور مطلوبة"
    }
    
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      return
    }
    
    setIsLoading(true)
    // Here you would handle the actual sign in logic
    setTimeout(() => {
      setIsLoading(false)
      // Redirect to dashboard or show error
    }, 1500)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50/50 via-white to-green-50/50 text-foreground relative overflow-hidden" dir="rtl">
      <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-30">
        <div className="absolute top-20 right-20 w-[500px] h-[500px] bg-blue-400/20 rounded-full blur-3xl" />
        <div className="absolute bottom-20 left-20 w-[500px] h-[500px] bg-green-400/20 rounded-full blur-3xl" />
      </div>

      {/* Content */}
      <div className="relative z-10 min-h-screen flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          {/* Title & Description */}
          <div className="text-center mb-12">
            <h1 className="text-3xl md:text-4xl font-bold mb-3 text-foreground">
              مرحباً بعودتك
            </h1>
            <p className="text-base text-muted-foreground">
              سجل دخولك للوصول إلى منصتك
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Input
                id="emailOrUsername"
                type="text"
                placeholder="البريد الإلكتروني أو اسم المستخدم"
                value={formData.emailOrUsername}
                onChange={(e) => updateField("emailOrUsername", e.target.value)}
                className={`h-14 text-base bg-white border-2 border-gray-200 focus:border-blue-500 rounded-xl transition-all ${
                  errors.emailOrUsername ? "border-red-500" : ""
                }`}
                disabled={isLoading}
              />
              {errors.emailOrUsername && (
                <p className="text-red-600 text-sm mt-1.5 flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5" />
                  {errors.emailOrUsername}
                </p>
              )}
            </div>

            <div>
              <Input
                id="password"
                type="password"
                placeholder="كلمة المرور"
                value={formData.password}
                onChange={(e) => updateField("password", e.target.value)}
                className={`h-14 text-base bg-white border-2 border-gray-200 focus:border-green-500 rounded-xl transition-all ${
                  errors.password ? "border-red-500" : ""
                }`}
                dir="ltr"
                disabled={isLoading}
              />
              {errors.password && (
                <p className="text-red-600 text-sm mt-1.5 flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5" />
                  {errors.password}
                </p>
              )}
            </div>

            <div className="flex items-center justify-between px-1 pt-2">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="remember"
                  className="w-4 h-4 rounded border-gray-300 bg-white text-primary focus:ring-primary focus:ring-offset-0"
                />
                <label htmlFor="remember" className="text-sm font-medium cursor-pointer text-foreground">
                  تذكرني
                </label>
              </div>
              <Link href="/sign/forgot-password" className="text-sm text-primary font-semibold hover:underline">
                نسيت كلمة المرور؟
              </Link>
            </div>

            <Button
              type="submit"
              size="lg"
              className="group w-full h-14 bg-primary hover:bg-primary/90 text-white font-semibold rounded-xl transition-all duration-200 mt-6"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin ml-2" />
                  جاري تسجيل الدخول...
                </>
              ) : (
                <>
                  تسجيل الدخول
                  <ArrowLeft className="w-4 h-4 mr-2 group-hover:-translate-x-0.5 transition-transform" />
                </>
              )}
            </Button>
          </form>

          {/* Sign Up Link */}
          <div className="text-center mt-6">
            <p className="text-muted-foreground text-sm">
              ليس لديك حساب؟{" "}
              <Link href="/sign/up" className="text-primary font-semibold hover:underline">
                إنشاء حساب جديد
              </Link>
            </p>
          </div>

          {/* Footer */}
          <div className="text-center mt-8">
            <p className="text-xs text-muted-foreground">
              بتسجيل الدخول، أنت توافق على{" "}
              <Link href="/terms" className="text-foreground hover:text-primary transition-colors underline">
                الشروط والأحكام
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
