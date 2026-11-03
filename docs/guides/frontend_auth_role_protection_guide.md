# 🔐 دليل حماية الفرونت إند - صلاحيات HR Manager فقط

## المشكلة الحالية

الفرونت إند حالياً **مافيه أي نظام تسجيل دخول حقيقي**:
- صفحة تسجيل الدخول (`/sign/in`) فيها فورم بس **مش بتعمل أي حاجة** — مجرد `setTimeout`
- مافيه middleware يحمي الصفحات
- مافيه Auth Context أو Session Management
- مافيه أي اتصال بـ Frappe Backend
- **أي حد يقدر يفتح أي صفحة بدون تسجيل دخول**

## المطلوب

- تسجيل الدخول يتم عن طريق **Frappe Backend API**
- بعد تسجيل الدخول، النظام يتأكد إن المستخدم عنده **Role = "HR Manager"**
- لو المستخدم **مش HR Manager** → يتم رفض الدخول ويظهر رسالة خطأ
- كل الصفحات تكون محمية — لو مافيه Session يتم التحويل لصفحة تسجيل الدخول

---

## الخطوات المطلوبة

---

### الخطوة 1: إعداد متغيرات البيئة

أنشئ ملف `.env.local` في مجلد المشروع:

```env
# رابط سيرفر Frappe
NEXT_PUBLIC_FRAPPE_URL=https://your-site.example.com
```

> **ملاحظة:** استبدل الرابط برابط السيرفر الفعلي بتاعك

---

### الخطوة 2: تثبيت المكتبات المطلوبة

```bash
pnpm add js-cookie
pnpm add -D @types/js-cookie
```

---

### الخطوة 3: إنشاء Auth Context

أنشئ ملف `contexts/AuthContext.tsx`:

```tsx
"use client"

import React, { createContext, useContext, useState, useEffect, useCallback } from "react"
import { useRouter, usePathname } from "next/navigation"

// ============================
// Types
// ============================
interface User {
  email: string
  fullName: string
  roles: string[]
}

interface AuthContextType {
  user: User | null
  isLoading: boolean
  isAuthenticated: boolean
  isHRManager: boolean
  login: (usr: string, pwd: string) => Promise<LoginResult>
  logout: () => Promise<void>
  error: string | null
}

interface LoginResult {
  success: boolean
  error?: string
}

const AuthContext = createContext<AuthContextType | null>(null)

// ============================
// الصفحات اللي مش محتاجة تسجيل دخول
// ============================
const PUBLIC_PATHS = ["/sign/in", "/sign/up", "/sign/forgot-password"]

// ============================
// رابط Frappe Backend
// ============================
const FRAPPE_URL = process.env.NEXT_PUBLIC_FRAPPE_URL || ""

// ============================
// Auth Provider Component
// ============================
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()
  const pathname = usePathname()

  const isAuthenticated = !!user
  const isHRManager = user?.roles?.includes("HR Manager") ?? false

  // ============================
  // تسجيل الدخول
  // ============================
  const login = async (usr: string, pwd: string): Promise<LoginResult> => {
    setError(null)

    try {
      // ---- الخطوة 1: تسجيل الدخول في Frappe ----
      const loginRes = await fetch(`${FRAPPE_URL}/api/method/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include", // مهم جداً عشان يرسل ويستقبل الكوكيز
        body: JSON.stringify({ usr, pwd }),
      })

      if (!loginRes.ok) {
        const errData = await loginRes.json().catch(() => null)
        return {
          success: false,
          error: errData?.message || "بيانات الدخول غير صحيحة",
        }
      }

      const loginData = await loginRes.json()

      // ---- الخطوة 2: جلب الـ Roles بتاعة المستخدم ----
      const rolesRes = await fetch(
        `${FRAPPE_URL}/api/method/frappe.core.doctype.user.user.get_roles?uid=${encodeURIComponent(usr)}`,
        {
          method: "GET",
          credentials: "include",
        }
      )

      if (!rolesRes.ok) {
        return { success: false, error: "فشل في جلب صلاحيات المستخدم" }
      }

      const rolesData = await rolesRes.json()
      const roles: string[] = rolesData.message || []

      // ---- الخطوة 3: التأكد إن المستخدم HR Manager ----
      if (!roles.includes("HR Manager")) {
        // تسجيل خروج فوري — المستخدم مش HR Manager
        await fetch(`${FRAPPE_URL}/api/method/logout`, {
          method: "POST",
          credentials: "include",
        })

        return {
          success: false,
          error: "⛔ ليس لديك صلاحية الدخول. هذا النظام مخصص لمدير الموارد البشرية (HR Manager) فقط.",
        }
      }

      // ---- الخطوة 4: حفظ بيانات المستخدم ----
      const userData: User = {
        email: usr,
        fullName: loginData.full_name || usr,
        roles,
      }

      setUser(userData)
      // حفظ في localStorage عشان يفضل متسجل بعد الـ Refresh
      localStorage.setItem("hr_admin_user", JSON.stringify(userData))

      return { success: true }
    } catch (err) {
      console.error("Login error:", err)
      return {
        success: false,
        error: "حدث خطأ في الاتصال بالسيرفر. تأكد من اتصالك بالإنترنت.",
      }
    }
  }

  // ============================
  // تسجيل الخروج
  // ============================
  const logout = async () => {
    try {
      await fetch(`${FRAPPE_URL}/api/method/logout`, {
        method: "POST",
        credentials: "include",
      })
    } catch {
      // حتى لو فشل، ننظف الـ Local State
    }

    setUser(null)
    localStorage.removeItem("hr_admin_user")
    router.push("/sign/in")
  }

  // ============================
  // التحقق من الجلسة عند تحميل الصفحة
  // ============================
  const verifySession = useCallback(async () => {
    setIsLoading(true)
    try {
      // أولاً: نشوف لو فيه بيانات محفوظة في localStorage
      const saved = localStorage.getItem("hr_admin_user")
      if (!saved) {
        setIsLoading(false)
        return
      }

      // ثانياً: نتأكد إن الجلسة لسه شغالة في Frappe
      const res = await fetch(`${FRAPPE_URL}/api/method/frappe.auth.get_logged_user`, {
        credentials: "include",
      })

      if (!res.ok) {
        // الجلسة خلصت — ننظف
        localStorage.removeItem("hr_admin_user")
        setUser(null)
        setIsLoading(false)
        return
      }

      const data = await res.json()
      const loggedUser = data.message

      if (loggedUser === "Guest") {
        // الجلسة خلصت
        localStorage.removeItem("hr_admin_user")
        setUser(null)
        setIsLoading(false)
        return
      }

      // ثالثاً: نتأكد إن لسه HR Manager
      const rolesRes = await fetch(
        `${FRAPPE_URL}/api/method/frappe.core.doctype.user.user.get_roles?uid=${encodeURIComponent(loggedUser)}`,
        {
          credentials: "include",
        }
      )

      if (rolesRes.ok) {
        const rolesData = await rolesRes.json()
        const roles: string[] = rolesData.message || []

        if (roles.includes("HR Manager")) {
          const savedData = JSON.parse(saved)
          setUser({ ...savedData, roles, email: loggedUser })
        } else {
          // الـ Role اتشال — سجل خروج
          localStorage.removeItem("hr_admin_user")
          setUser(null)
          await fetch(`${FRAPPE_URL}/api/method/logout`, {
            method: "POST",
            credentials: "include",
          })
        }
      }
    } catch {
      // خطأ في الاتصال — ننظف
      localStorage.removeItem("hr_admin_user")
      setUser(null)
    }
    setIsLoading(false)
  }, [])

  useEffect(() => {
    verifySession()
  }, [verifySession])

  // ============================
  // حماية الصفحات — Redirect لو مش مسجل
  // ============================
  useEffect(() => {
    if (isLoading) return

    const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p))

    if (!isAuthenticated && !isPublic) {
      router.push("/sign/in")
    }

    if (isAuthenticated && isPublic) {
      router.push("/")
    }
  }, [isAuthenticated, isLoading, pathname, router])

  return (
    <AuthContext.Provider
      value={{ user, isLoading, isAuthenticated, isHRManager, login, logout, error }}
    >
      {children}
    </AuthContext.Provider>
  )
}

// ============================
// Hook عشان تستخدمه في أي Component
// ============================
export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider")
  }
  return ctx
}
```

---

### الخطوة 4: تعديل `layout.tsx` الرئيسي

عدّل ملف `app/layout.tsx` عشان يستخدم الـ AuthProvider:

```tsx
import type React from "react"
import "./globals.css"
import type { Metadata } from "next"
import { InventoryProvider } from "@/contexts/InventoryContext"
import { AuthProvider } from "@/contexts/AuthContext"

export const metadata: Metadata = {
  title: "نظام إدارة المناديب",
  description: "منصة شاملة لإدارة المبيعات الميدانية وتتبع العملاء",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ar" dir="rtl">
      <body className="font-sans antialiased">
        <AuthProvider>
          <InventoryProvider>
            {children}
          </InventoryProvider>
        </AuthProvider>
      </body>
    </html>
  )
}
```

---

### الخطوة 5: إنشاء Next.js Middleware لحماية الصفحات (Server-Side)

أنشئ ملف `middleware.ts` في **الروت** بتاع المشروع (جنب `app/`):

```typescript
import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

// الصفحات المسموح فيها بدون تسجيل دخول
const PUBLIC_PATHS = ["/sign/in", "/sign/up", "/sign/forgot-password"]

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // لو الصفحة عامة — خليه يعدي
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next()
  }

  // لو ملفات Static أو API — خليها تعدي
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname.includes(".")
  ) {
    return NextResponse.next()
  }

  // تحقق من كوكيز Frappe — لو مافيه sid يعني مش مسجل
  const sid = request.cookies.get("sid")
  const userId = request.cookies.get("user_id")

  if (!sid || sid.value === "Guest" || !userId || userId.value === "Guest") {
    // حول لصفحة تسجيل الدخول
    const signInUrl = new URL("/sign/in", request.url)
    signInUrl.searchParams.set("redirect", pathname)
    return NextResponse.redirect(signInUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    // كل الصفحات ماعدا الـ Static Files
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
}
```

---

### الخطوة 6: تعديل صفحة تسجيل الدخول (`app/sign/in/page.tsx`)

استبدل المحتوى الحالي بالكود ده:

```tsx
"use client"

import { useState } from "react"
import { useAuth } from "@/contexts/AuthContext"
import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { AlertCircle, ArrowLeft, ShieldAlert } from "lucide-react"

export default function SignInPage() {
  const { login, isLoading: authLoading } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()

  const [formData, setFormData] = useState({
    emailOrUsername: "",
    password: "",
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [loginError, setLoginError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const updateField = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
    if (errors[field]) {
      setErrors((prev) => {
        const newErrors = { ...prev }
        delete newErrors[field]
        return newErrors
      })
    }
    setLoginError(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // ---- Validation ----
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

    // ---- Login ----
    setIsLoading(true)
    setLoginError(null)

    const result = await login(formData.emailOrUsername, formData.password)

    if (result.success) {
      // نجح — حول للصفحة اللي كان عاوز يروحها أو الرئيسية
      const redirect = searchParams.get("redirect") || "/"
      router.push(redirect)
    } else {
      // فشل — اعرض رسالة الخطأ
      setLoginError(result.error || "فشل تسجيل الدخول")
    }

    setIsLoading(false)
  }

  return (
    <div
      className="min-h-screen bg-gradient-to-br from-blue-50/50 via-white to-green-50/50 text-foreground relative overflow-hidden"
      dir="rtl"
    >
      {/* Background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-30">
        <div className="absolute top-20 right-20 w-[500px] h-[500px] bg-blue-400/20 rounded-full blur-3xl" />
        <div className="absolute bottom-20 left-20 w-[500px] h-[500px] bg-green-400/20 rounded-full blur-3xl" />
      </div>

      {/* Content */}
      <div className="relative z-10 min-h-screen flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          <div className="text-center mb-12">
            <h1 className="text-3xl md:text-4xl font-bold mb-3 text-foreground">
              لوحة تحكم الموارد البشرية
            </h1>
            <p className="text-base text-muted-foreground">
              سجل دخولك للوصول إلى لوحة إدارة HR
            </p>
            {/* تنبيه الصلاحيات */}
            <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-center gap-2 text-sm text-amber-800">
              <ShieldAlert className="w-5 h-5 flex-shrink-0" />
              <span>هذا النظام مخصص لمدراء الموارد البشرية (HR Manager) فقط</span>
            </div>
          </div>

          {/* ---- رسالة الخطأ ---- */}
          {loginError && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm flex items-start gap-2">
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <span>{loginError}</span>
            </div>
          )}

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

            <Button
              type="submit"
              size="lg"
              className="group w-full h-14 bg-primary hover:bg-primary/90 text-white font-semibold rounded-xl transition-all duration-200 mt-6"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin ml-2" />
                  جاري التحقق من الصلاحيات...
                </>
              ) : (
                <>
                  تسجيل الدخول
                  <ArrowLeft className="w-4 h-4 mr-2 group-hover:-translate-x-0.5 transition-transform" />
                </>
              )}
            </Button>
          </form>

          <div className="text-center mt-8">
            <p className="text-xs text-muted-foreground">
              ⚠️ في حال عدم وجود صلاحيات — تواصل مع مدير النظام
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
```

---

### الخطوة 7: إضافة زر تسجيل الخروج في الصفحة الرئيسية

أضف الكود ده في `app/page.tsx` أو أي Component فيه الـ Header:

```tsx
"use client"

import { useAuth } from "@/contexts/AuthContext"
import { LogOut, Shield } from "lucide-react"
import { Button } from "@/components/ui/button"

// داخل الـ Component بتاعك:
function UserHeader() {
  const { user, logout, isLoading } = useAuth()

  if (isLoading || !user) return null

  return (
    <div className="fixed top-4 right-4 z-50 flex items-center gap-3">
      {/* معلومات المستخدم */}
      <div className="bg-white/90 backdrop-blur-sm shadow-lg rounded-xl px-4 py-2 flex items-center gap-2">
        <Shield className="w-4 h-4 text-green-600" />
        <span className="text-sm font-medium">{user.fullName}</span>
        <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
          HR Manager
        </span>
      </div>

      {/* زر تسجيل الخروج */}
      <Button
        variant="outline"
        size="sm"
        onClick={logout}
        className="shadow-lg"
      >
        <LogOut className="w-4 h-4 ml-1" />
        خروج
      </Button>
    </div>
  )
}
```

---

### الخطوة 8: حماية API Routes (اختياري لكن مهم)

لو عندك API Routes في `app/api/`، لازم تحميها كمان. أنشئ ملف `lib/auth.ts`:

```typescript
import { cookies } from "next/headers"

const FRAPPE_URL = process.env.NEXT_PUBLIC_FRAPPE_URL || ""

export async function verifyHRManager(): Promise<{
  authenticated: boolean
  user?: string
  error?: string
}> {
  try {
    const cookieStore = await cookies()
    const sid = cookieStore.get("sid")

    if (!sid || sid.value === "Guest") {
      return { authenticated: false, error: "Not authenticated" }
    }

    // تأكد من الجلسة في Frappe
    const userRes = await fetch(
      `${FRAPPE_URL}/api/method/frappe.auth.get_logged_user`,
      {
        headers: { Cookie: `sid=${sid.value}` },
      }
    )

    if (!userRes.ok) {
      return { authenticated: false, error: "Invalid session" }
    }

    const userData = await userRes.json()
    const user = userData.message

    if (user === "Guest") {
      return { authenticated: false, error: "Guest user" }
    }

    // تأكد من الـ Role
    const rolesRes = await fetch(
      `${FRAPPE_URL}/api/method/frappe.core.doctype.user.user.get_roles?uid=${encodeURIComponent(user)}`,
      {
        headers: { Cookie: `sid=${sid.value}` },
      }
    )

    if (!rolesRes.ok) {
      return { authenticated: false, error: "Failed to get roles" }
    }

    const rolesData = await rolesRes.json()
    const roles: string[] = rolesData.message || []

    if (!roles.includes("HR Manager")) {
      return { authenticated: false, error: "Not HR Manager" }
    }

    return { authenticated: true, user }
  } catch {
    return { authenticated: false, error: "Server error" }
  }
}
```

استخدمه في أي API Route:

```typescript
import { NextResponse } from "next/server"
import { verifyHRManager } from "@/lib/auth"

export async function GET() {
  const auth = await verifyHRManager()

  if (!auth.authenticated) {
    return NextResponse.json(
      { error: "غير مصرح لك بالوصول" },
      { status: 403 }
    )
  }

  // ... باقي الكود
}
```

---

## ⚙️ إعداد CORS في Frappe (مهم جداً)

عشان الفرونت إند يقدر يتكلم مع Frappe Backend، لازم تضيف الدومين في إعدادات CORS.

### الطريقة 1: من ملف `site_config.json`

```json
{
  "allow_cors": "*",
  "ignore_csrf": 1
}
```

> ⚠️ ده للتطوير بس. في الإنتاج استخدم الدومين المحدد:

```json
{
  "allow_cors": "https://your-frontend-domain.com"
}
```

### الطريقة 2: من ملف `common_site_config.json`

```bash
bench --site your-site.local set-config allow_cors "https://your-frontend-domain.com"
```

### الطريقة 3: لو الفرونت على نفس السيرفر

أضف Proxy في `next.config.mjs`:

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  async rewrites() {
    return [
      {
        source: "/frappe-api/:path*",
        destination: "https://your-site.example.com/api/:path*",
      },
    ]
  },
}

export default nextConfig
```

وبعدين في الكود استخدم `/frappe-api/method/login` بدل `FRAPPE_URL/api/method/login`

---

## 📋 ملخص الـ APIs المستخدمة

| الوظيفة | الـ Endpoint | الـ Method | الـ Body/Params |
|---------|-------------|-----------|-----------------|
| تسجيل الدخول | `/api/method/login` | POST | `{ "usr": "...", "pwd": "..." }` |
| جلب المستخدم الحالي | `/api/method/frappe.auth.get_logged_user` | GET | — |
| جلب Roles المستخدم | `/api/method/frappe.core.doctype.user.user.get_roles` | GET | `?uid=user@email.com` |
| تسجيل الخروج | `/api/method/logout` | POST | — |

### ملاحظات مهمة على الـ APIs:

1. **كل الـ Requests لازم تحتوي على `credentials: "include"`** عشان الكوكيز تتبعت
2. **بعد تسجيل الدخول، Frappe بيرجع كوكيز:**
   - `sid` — Session ID (الأهم)
   - `user_id` — إيميل المستخدم
   - `full_name` — اسم المستخدم
   - `system_user` — `"yes"` أو `"no"`
3. **Response تسجيل الدخول:**
   ```json
   {
     "message": "Logged In",
     "home_page": "/app",
     "full_name": "اسم المستخدم"
   }
   ```
4. **Response الـ Roles:**
   ```json
   {
     "message": ["HR Manager", "Employee", "All", ...]
   }
   ```

---

## 🔄 تدفق العملية (Flow)

```
المستخدم يفتح الموقع
       │
       ▼
  Middleware يتحقق من كوكي sid
       │
       ├── مافيش sid ──────────► تحويل لـ /sign/in
       │
       ▼
  AuthContext يتحقق من الجلسة
       │
       ├── الجلسة خلصت ───────► تحويل لـ /sign/in
       │
       ▼
  يتحقق من Role = HR Manager
       │
       ├── مش HR Manager ─────► رسالة "غير مصرح" + Logout
       │
       ▼
  ✅ يدخل النظام بصلاحيات كاملة
```

---

## 🧪 اختبار سريع

1. **سجل دخول بمستخدم عادي (Employee فقط):**
   - المتوقع: رسالة "هذا النظام مخصص لمدير الموارد البشرية فقط" ❌
   
2. **سجل دخول بمستخدم HR Manager:**
   - المتوقع: يدخل النظام بنجاح ✅

3. **افتح أي صفحة بدون تسجيل دخول:**
   - المتوقع: تحويل تلقائي لـ `/sign/in` 🔄

4. **امسح الكوكيز وحاول تفتح الداشبورد:**
   - المتوقع: تحويل لـ `/sign/in` 🔄

---

## 📁 ملخص الملفات المطلوب إنشاؤها/تعديلها

| الملف | العملية | الوصف |
|-------|---------|-------|
| `.env.local` | **إنشاء** | رابط سيرفر Frappe |
| `contexts/AuthContext.tsx` | **إنشاء** | Auth Context مع Login/Logout/Role Check |
| `middleware.ts` | **إنشاء** | حماية الصفحات Server-Side |
| `lib/auth.ts` | **إنشاء** | التحقق من صلاحيات HR Manager في API Routes |
| `app/layout.tsx` | **تعديل** | إضافة AuthProvider |
| `app/sign/in/page.tsx` | **تعديل** | ربط الفورم بـ Frappe API + رسالة الصلاحيات |
| `app/page.tsx` | **تعديل** | إضافة زر خروج ومعلومات المستخدم |
| `next.config.mjs` | **تعديل** | إضافة Proxy (اختياري) |

---

## ⚡ أهم نقطة

الـ **فلتر الأساسي** هو في `AuthContext.tsx` في الدالة `login`:

```typescript
if (!roles.includes("HR Manager")) {
  // ❌ ارفض الدخول فوراً
  await fetch(`${FRAPPE_URL}/api/method/logout`, { ... })
  return { success: false, error: "ليس لديك صلاحية..." }
}
```

ده بيضمن إنه حتى لو المستخدم سجل دخول بنجاح في Frappe، لو مش HR Manager، هيتم:
1. تسجيل خروجه فوراً من Frappe
2. عرض رسالة خطأ
3. منعه من الدخول للنظام

---
---

# 👥 صفحة إدارة صلاحيات HR Manager

## الوصف

صفحة تمكّن الـ HR Manager الحالي من:
- عرض كل الموظفين (System Users) ومين فيهم HR Manager ومين لأ
- **تعيين** موظف كـ HR Manager
- **إزالة** صلاحية HR Manager من موظف
- **مع حماية:** مايقدرش يشيل الصلاحية من نفسه (عشان مايقفلش نفسه بره النظام)

## ⚠️ ملاحظة مهمة

الـ APIs جاهزة ومتستة في الباك إند. مافيش حاجة محتاج تتعدل في الباك إند — بس اعمل الفرونت.

---

## الـ APIs المتاحة

### 1. جلب كل المستخدمين مع حالة الصلاحية

```
GET /api/method/hrms.api.hr_manager_admin.get_system_users
```

**لا يحتاج Parameters.**

**Response:**
```json
{
  "message": [
    {
      "user_id": "nader@gmail.com",
      "full_name": "Nader Yasser",
      "email": "nader@gmail.com",
      "user_image": null,
      "has_hr_manager": false,
      "is_current_user": false,
      "employee_name": "Nader Yasser",
      "department": "IT",
      "designation": "Developer",
      "company": "شركة القرعاوي"
    },
    {
      "user_id": "qarawi@qarawi.com",
      "full_name": "القرعاوي القرعاوي",
      "email": "qarawi@qarawi.com",
      "user_image": null,
      "has_hr_manager": true,
      "is_current_user": true,
      "employee_name": "القرعاوي القرعاوي",
      "department": null,
      "designation": null,
      "company": null
    }
  ]
}
```

**الحقول المهمة:**
| الحقل | الوصف |
|-------|-------|
| `user_id` | الإيميل — هتستخدمه في assign/remove |
| `full_name` | اسم المستخدم للعرض |
| `has_hr_manager` | `true` = عنده صلاحية HR Manager |
| `is_current_user` | `true` = ده المستخدم الحالي (اعمل disable لزرار الإزالة) |
| `employee_name` | اسم الموظف في HR (ممكن يكون `null` لو مافيش Employee مربوط) |
| `department` | القسم |
| `designation` | المسمى الوظيفي |

---

### 2. تعيين موظف كـ HR Manager

```
POST /api/method/hrms.api.hr_manager_admin.assign_hr_manager_role
```

**Body:**
```json
{
  "user_id": "nader@gmail.com"
}
```

**Response (نجاح):**
```json
{
  "message": {
    "success": true,
    "message": "تم تعيين Nader Yasser كمدير موارد بشرية بنجاح",
    "user_id": "nader@gmail.com",
    "full_name": "Nader Yasser"
  }
}
```

**Response (فشل — المستخدم عنده الصلاحية أصلاً):**
```json
{
  "exc_type": "ValidationError",
  "exception": "هذا المستخدم لديه صلاحية HR Manager بالفعل"
}
```

**الحالات اللي هترجع Error:**
| الحالة | رسالة الخطأ |
|--------|------------|
| المستخدم الحالي مش HR Manager | `ليس لديك صلاحية` (403) |
| المستخدم عنده الصلاحية أصلاً | `هذا المستخدم لديه صلاحية HR Manager بالفعل` |
| المستخدم معطّل | `هذا المستخدم معطّل. قم بتفعيله أولاً.` |
| محاولة تعديل Administrator | `لا يمكن تعديل صلاحيات المدير العام` |

---

### 3. إزالة صلاحية HR Manager من موظف

```
POST /api/method/hrms.api.hr_manager_admin.remove_hr_manager_role
```

**Body:**
```json
{
  "user_id": "nader@gmail.com"
}
```

**Response (نجاح):**
```json
{
  "message": {
    "success": true,
    "message": "تم إزالة صلاحية مدير الموارد البشرية من Nader Yasser",
    "user_id": "nader@gmail.com",
    "full_name": "Nader Yasser"
  }
}
```

**الحالات اللي هترجع Error:**
| الحالة | رسالة الخطأ |
|--------|------------|
| المستخدم الحالي مش HR Manager | `ليس لديك صلاحية` (403) |
| محاولة إزالة من نفسك | `لا يمكنك إزالة صلاحية HR Manager من نفسك` |
| المستخدم مش عنده الصلاحية أصلاً | `هذا المستخدم ليس لديه صلاحية HR Manager` |
| محاولة تعديل Administrator | `لا يمكن تعديل صلاحيات المدير العام` |

---

### 4. جلب الـ HR Managers فقط (اختياري)

```
GET /api/method/hrms.api.hr_manager_admin.get_hr_managers
```

**Response:**
```json
{
  "message": [
    {
      "user_id": "qarawi@qarawi.com",
      "full_name": "القرعاوي القرعاوي",
      "email": "qarawi@qarawi.com",
      "user_image": null,
      "is_current_user": true,
      "employee_name": "القرعاوي القرعاوي",
      "department": null,
      "designation": null
    }
  ]
}
```

---

## 🎨 تصميم الصفحة المقترح

### الشكل العام

```
┌─────────────────────────────────────────────────────────┐
│  👥 إدارة صلاحيات HR Manager                           │
│  ─────────────────────────────────────────────────────  │
│                                                         │
│  🟢 مدراء الموارد البشرية الحاليين (2)                  │
│  ┌─────────────────────────────────────────────────────┐│
│  │ 👤 القرعاوي القرعاوي    HR Manager  ✅  [أنت]      ││
│  │    qarawi@qarawi.com                                ││
│  │─────────────────────────────────────────────────────││
│  │ 👤 القرعاوي              HR Manager  ✅  [إزالة ❌] ││
│  │    qarawi@gmail.com                                ││
│  └─────────────────────────────────────────────────────┘│
│                                                         │
│  👥 باقي الموظفين (4)                                   │
│  ┌─────────────────────────────────────────────────────┐│
│  │ 👤 Nader Yasser          IT / Developer  [تعيين ✅] ││
│  │    nader@gmail.com                                 ││
│  │─────────────────────────────────────────────────────││
│  │ 👤 Meena shah                            [تعيين ✅] ││
│  │    bilalkhan01.bk@gmail.com                        ││
│  │─────────────────────────────────────────────────────││
│  │ 👤 bilal shah                            [تعيين ✅] ││
│  │    bilakhan01.bk@gmail.com                         ││
│  │─────────────────────────────────────────────────────││
│  │ 👤 موظف جديد                            [تعيين ✅] ││
│  │    employee@gmail.com                              ││
│  └─────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────┘
```

---

## 💻 كود مقترح للصفحة

### 1. أضف الدوال في `api.ts`

```typescript
// ===== HR Manager Administration =====

/** جلب كل المستخدمين مع حالة الصلاحية */
export async function getSystemUsers() {
  const res = await fetch("/api/method/hrms.api.hr_manager_admin.get_system_users", {
    credentials: "include",
  })
  if (!res.ok) throw new Error("فشل في جلب المستخدمين")
  const data = await res.json()
  return data.message
}

/** تعيين موظف كـ HR Manager */
export async function assignHRManagerRole(userId: string) {
  const res = await fetch("/api/method/hrms.api.hr_manager_admin.assign_hr_manager_role", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user_id: userId }),
  })
  const data = await res.json()
  if (!res.ok || data.exc_type) {
    throw new Error(data.exception || data.message || "فشل في تعيين الصلاحية")
  }
  return data.message
}

/** إزالة صلاحية HR Manager */
export async function removeHRManagerRole(userId: string) {
  const res = await fetch("/api/method/hrms.api.hr_manager_admin.remove_hr_manager_role", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user_id: userId }),
  })
  const data = await res.json()
  if (!res.ok || data.exc_type) {
    throw new Error(data.exception || data.message || "فشل في إزالة الصلاحية")
  }
  return data.message
}
```

> **ملاحظة:** لو عندك API Proxy في `route.ts`، استخدم المسار بتاعك بدل المسار المباشر. مثلاً لو الـ proxy على `/api/frappe/`، يبقى:
> ```typescript
> fetch("/api/frappe/method/hrms.api.hr_manager_admin.get_system_users")
> ```

---

### 2. كود الصفحة (`app/hr-managers/page.tsx` أو أي مسار تختاره)

```tsx
"use client"

import { useState, useEffect } from "react"
import { useAuth } from "@/contexts/auth-context" // أو المسار بتاعك
import { Button } from "@/components/ui/button"
import {
  Shield, ShieldCheck, ShieldX, UserPlus, UserMinus,
  Loader2, AlertCircle, Search, Users, ChevronLeft
} from "lucide-react"
import Link from "next/link"
import { getSystemUsers, assignHRManagerRole, removeHRManagerRole } from "@/lib/api"

interface SystemUser {
  user_id: string
  full_name: string
  email: string
  user_image: string | null
  has_hr_manager: boolean
  is_current_user: boolean
  employee_name: string | null
  department: string | null
  designation: string | null
  company: string | null
}

export default function HRManagersPage() {
  const { user } = useAuth()
  const [users, setUsers] = useState<SystemUser[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  // جلب المستخدمين
  const fetchUsers = async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await getSystemUsers()
      setUsers(data)
    } catch (err: any) {
      setError(err.message || "فشل في جلب البيانات")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchUsers()
  }, [])

  // تعيين HR Manager
  const handleAssign = async (userId: string) => {
    if (!confirm("هل تريد تعيين هذا المستخدم كمدير موارد بشرية؟")) return

    try {
      setActionLoading(userId)
      const result = await assignHRManagerRole(userId)
      setSuccessMessage(result.message)
      await fetchUsers() // إعادة تحميل القائمة
      setTimeout(() => setSuccessMessage(null), 4000)
    } catch (err: any) {
      setError(err.message)
      setTimeout(() => setError(null), 4000)
    } finally {
      setActionLoading(null)
    }
  }

  // إزالة HR Manager
  const handleRemove = async (userId: string) => {
    if (!confirm("هل تريد إزالة صلاحية مدير الموارد البشرية من هذا المستخدم؟\nلن يتمكن من الدخول لهذا النظام بعد الآن.")) return

    try {
      setActionLoading(userId)
      const result = await removeHRManagerRole(userId)
      setSuccessMessage(result.message)
      await fetchUsers()
      setTimeout(() => setSuccessMessage(null), 4000)
    } catch (err: any) {
      setError(err.message)
      setTimeout(() => setError(null), 4000)
    } finally {
      setActionLoading(null)
    }
  }

  // فلترة البحث
  const filteredUsers = users.filter(u =>
    u.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.employee_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.department?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  // فصل المستخدمين
  const hrManagers = filteredUsers.filter(u => u.has_hr_manager)
  const otherUsers = filteredUsers.filter(u => !u.has_hr_manager)

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8" dir="rtl">
      <div className="max-w-4xl mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Shield className="w-7 h-7 text-primary" />
              إدارة صلاحيات HR Manager
            </h1>
            <p className="text-muted-foreground mt-1">
              تعيين أو إزالة صلاحية مدير الموارد البشرية من الموظفين
            </p>
          </div>
          <Link href="/">
            <Button variant="outline" size="sm">
              <ChevronLeft className="w-4 h-4 ml-1" />
              رجوع
            </Button>
          </Link>
        </div>

        {/* رسائل النجاح والخطأ */}
        {successMessage && (
          <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-xl text-green-700 text-sm flex items-center gap-2">
            <ShieldCheck className="w-5 h-5" />
            {successMessage}
          </div>
        )}
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm flex items-center gap-2">
            <AlertCircle className="w-5 h-5" />
            {error}
          </div>
        )}

        {/* البحث */}
        <div className="relative mb-6">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <input
            type="text"
            placeholder="ابحث بالاسم أو الإيميل أو القسم..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-4 pr-10 py-3 border-2 border-gray-200 rounded-xl focus:border-primary focus:outline-none"
          />
        </div>

        {/* مدراء الموارد البشرية الحاليين */}
        <div className="mb-8">
          <h2 className="text-lg font-semibold mb-3 flex items-center gap-2 text-green-700">
            <ShieldCheck className="w-5 h-5" />
            مدراء الموارد البشرية الحاليين ({hrManagers.length})
          </h2>
          <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">
            {hrManagers.length === 0 ? (
              <div className="p-6 text-center text-muted-foreground">
                لا يوجد مدراء موارد بشرية مطابقين للبحث
              </div>
            ) : (
              hrManagers.map((u, i) => (
                <div key={u.user_id} className={`p-4 flex items-center justify-between ${i > 0 ? 'border-t' : ''}`}>
                  <div className="flex items-center gap-3">
                    {/* صورة المستخدم */}
                    <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                      {u.user_image ? (
                        <img src={u.user_image} alt="" className="w-10 h-10 rounded-full object-cover" />
                      ) : (
                        <ShieldCheck className="w-5 h-5 text-green-600" />
                      )}
                    </div>
                    <div>
                      <div className="font-medium flex items-center gap-2">
                        {u.full_name}
                        <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                          HR Manager
                        </span>
                        {u.is_current_user && (
                          <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                            أنت
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {u.email}
                        {u.department && ` · ${u.department}`}
                        {u.designation && ` · ${u.designation}`}
                      </div>
                    </div>
                  </div>

                  {/* زر الإزالة */}
                  {u.is_current_user ? (
                    <span className="text-xs text-muted-foreground">لا يمكن إزالة نفسك</span>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleRemove(u.user_id)}
                      disabled={actionLoading === u.user_id}
                      className="text-red-600 border-red-200 hover:bg-red-50"
                    >
                      {actionLoading === u.user_id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <>
                          <UserMinus className="w-4 h-4 ml-1" />
                          إزالة
                        </>
                      )}
                    </Button>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* باقي الموظفين */}
        <div>
          <h2 className="text-lg font-semibold mb-3 flex items-center gap-2 text-gray-700">
            <Users className="w-5 h-5" />
            الموظفون ({otherUsers.length})
          </h2>
          <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">
            {otherUsers.length === 0 ? (
              <div className="p-6 text-center text-muted-foreground">
                لا يوجد موظفين مطابقين للبحث
              </div>
            ) : (
              otherUsers.map((u, i) => (
                <div key={u.user_id} className={`p-4 flex items-center justify-between ${i > 0 ? 'border-t' : ''}`}>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
                      {u.user_image ? (
                        <img src={u.user_image} alt="" className="w-10 h-10 rounded-full object-cover" />
                      ) : (
                        <span className="text-lg">👤</span>
                      )}
                    </div>
                    <div>
                      <div className="font-medium">{u.full_name}</div>
                      <div className="text-sm text-muted-foreground">
                        {u.email}
                        {u.department && ` · ${u.department}`}
                        {u.designation && ` · ${u.designation}`}
                      </div>
                    </div>
                  </div>

                  {/* زر التعيين */}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleAssign(u.user_id)}
                    disabled={actionLoading === u.user_id}
                    className="text-green-600 border-green-200 hover:bg-green-50"
                  >
                    {actionLoading === u.user_id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <UserPlus className="w-4 h-4 ml-1" />
                        تعيين HR Manager
                      </>
                    )}
                  </Button>
                </div>
              ))
            )}
          </div>
        </div>

      </div>
    </div>
  )
}
```

---

### 3. إضافة رابط للصفحة (في القائمة الجانبية أو الهيدر)

أضف رابط في أي مكان مناسب:

```tsx
import { Shield } from "lucide-react"
import Link from "next/link"

<Link href="/hr-managers">
  <Button variant="ghost" className="flex items-center gap-2">
    <Shield className="w-4 h-4" />
    إدارة الصلاحيات
  </Button>
</Link>
```

---

## 🔐 قواعد الأمان (مطبقة في الباك إند)

| القاعدة | التفاصيل |
|---------|---------|
| **HR Manager فقط** | كل الـ APIs محمية — لو المستخدم مش HR Manager هيرجع 403 |
| **منع إزالة النفس** | المستخدم مايقدرش يشيل الصلاحية من نفسه |
| **حماية Administrator** | مايقدرش يعدل على Administrator |
| **المستخدم المعطّل** | مايقدرش يعين صلاحية لمستخدم disabled |
| **تسجيل العمليات** | كل عملية assign/remove بتتسجل في Frappe Log |

---

## 🧪 سيناريوهات الاختبار

1. **سجل دخول كـ HR Manager** → افتح `/hr-managers` → لازم يظهر الكل ✅
2. **اضغط "تعيين" على موظف عادي** → لازم يتحول لـ HR Manager ✅
3. **اضغط "إزالة" على HR Manager تاني** → لازم تتشال الصلاحية ✅
4. **حاول تشيل الصلاحية من نفسك** → لازم الزر يكون معطّل + نص "لا يمكن إزالة نفسك" ✅
5. **سجل دخول بموظف عادي وحاول تفتح الـ API مباشرة** → 403 ✅
