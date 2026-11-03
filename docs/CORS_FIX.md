# CORS Fix Documentation

## المشكلة 🚨
```
Cross-Origin Request Blocked: The Same Origin Policy disallows reading the remote resource at https://qarawi.base.meena.sa/api/resource/HR%20Settings/HR%20Settings.
(Reason: CORS header 'Access-Control-Allow-Origin' missing). Status code: 200.
```

عند محاولة استدعاء API من `localhost:3001` إلى `https://qarawi.base.meena.sa`، يحظر المتصفح الطلب بسبب سياسة CORS.

## الحل ✅

استخدمنا **Next.js API Routes** كـ **Proxy Server** بين الـ Frontend والـ Backend. هذا يحل المشكلة لأن:

1. ✅ **Server-to-Server**: الطلبات تحدث من Next.js server إلى Frappe server (لا توجد قيود CORS)
2. ✅ **أكثر أماناً**: يمكن إخفاء API keys وcredentials في الـ server
3. ✅ **Caching**: يمكن إضافة caching للاستجابات لاحقاً
4. ✅ **Authentication**: يمكن إضافة authentication layer
5. ✅ **Monitoring**: يمكن تتبع جميع API calls في مكان واحد

## ما تم تنفيذه 🔧

### 1. إنشاء API Proxy Route
**الملف:** `app/api/frappe/route.ts`

```typescript
// يستقبل جميع الطلبات (GET, POST, PUT, DELETE)
// ويعيد توجيهها إلى Frappe backend
export async function GET(request: NextRequest) { ... }
export async function POST(request: NextRequest) { ... }
export async function PUT(request: NextRequest) { ... }
export async function DELETE(request: NextRequest) { ... }
```

**الاستخدام:**
```
Frontend Request: /api/frappe?path=/api/resource/HR Settings/HR Settings
                   ↓
Next.js API Route: يعيد توجيه الطلب إلى
                   ↓
Frappe Backend: https://qarawi.base.meena.sa/api/resource/HR Settings/HR Settings
```

### 2. إنشاء Helper Functions
**الملف:** `lib/api.ts`

```typescript
// دوال مساعدة لاستدعاء API بسهولة
import { getDoc, updateDoc, callMethod } from "@/lib/api"

// مثال 1: جلب document
const data = await getDoc('HR Settings', 'HR Settings')

// مثال 2: تحديث document
await updateDoc('HR Settings', 'HR Settings', settings)

// مثال 3: استدعاء method
const result = await callMethod('hrms.hr.api.employee_search_api.search_employees', {
  query: 'ahmed',
  limit: 50
})
```

### 3. تحديث جميع الصفحات
تم تحديث **6 صفحات** لاستخدام API helpers بدلاً من `fetch()` مباشرة:

#### قبل ❌
```typescript
const FRAPPE_URL = process.env.NEXT_PUBLIC_FRAPPE_URL || 'https://qarawi.base.meena.sa'

const response = await fetch(`${FRAPPE_URL}/api/resource/HR Settings/HR Settings`, {
  method: 'GET',
  headers: { 'Content-Type': 'application/json' },
})
const data = await response.json()
```

#### بعد ✅
```typescript
import { getDoc } from "@/lib/api"

const data = await getDoc('HR Settings', 'HR Settings')
```

## الملفات المعدلة 📁

1. ✅ **app/api/frappe/route.ts** - جديد (API Proxy)
2. ✅ **lib/api.ts** - جديد (Helper Functions)
3. ✅ **app/hr-settings/page.tsx** - معدل
4. ✅ **app/employee-search/page.tsx** - معدل
5. ✅ **app/employee-details/[id]/page.tsx** - معدل
6. ✅ **app/location-tracking/page.tsx** - معدل
7. ✅ **app/radius-alerts/page.tsx** - معدل
8. ✅ **app/shift-management/page.tsx** - معدل
9. ✅ **.env.local** - جديد

## كيفية الاستخدام 🚀

### 1. تأكد من الإعدادات
```bash
# ملف .env.local
NEXT_PUBLIC_FRAPPE_URL=https://qarawi.base.meena.sa

# اختياري: لإضافة Authentication (أكثر أماناً)
FRAPPE_API_KEY=your_api_key
FRAPPE_API_SECRET=your_api_secret
```

### 2. ابدأ السيرفر
```bash
cd /home/ahmedyasser/lab/base-meena-frontend
pnpm dev
```

### 3. افتح الصفحات
```
http://localhost:3000/hr-settings
http://localhost:3000/employee-search
http://localhost:3000/employee-details/HR-EMP-00001
http://localhost:3000/location-tracking
http://localhost:3000/radius-alerts
http://localhost:3000/shift-management
```

## كيف يعمل؟ 🔄

```
┌─────────────────┐
│   Browser       │
│ (localhost:3000)│
└────────┬────────┘
         │ Request to /api/frappe?path=/api/resource/HR Settings/HR Settings
         ↓
┌─────────────────┐
│ Next.js Server  │ ← لا توجد قيود CORS هنا
│ (API Route)     │   لأن الطلب server-to-server
└────────┬────────┘
         │ Fetch to https://qarawi.base.meena.sa/api/resource/HR Settings/HR Settings
         ↓
┌─────────────────┐
│ Frappe Backend  │
│ (qarawi.base... │
└─────────────────┘
```

## المزايا الإضافية 🎁

### 1. إضافة Authentication (اختياري)
```typescript
// في app/api/frappe/route.ts
if (FRAPPE_API_KEY && FRAPPE_API_SECRET) {
  headers['Authorization'] = `token ${FRAPPE_API_KEY}:${FRAPPE_API_SECRET}`
}
```

### 2. إضافة Caching لاحقاً
```typescript
export async function GET(request: NextRequest) {
  // يمكن إضافة caching هنا
  const cached = await redis.get(path)
  if (cached) return NextResponse.json(cached)
  
  // ... fetch from Frappe
  await redis.set(path, data, { ex: 60 }) // cache for 60 seconds
}
```

### 3. إضافة Logging
```typescript
export async function POST(request: NextRequest) {
  const startTime = Date.now()
  // ... API call
  console.log(`API call to ${path} took ${Date.now() - startTime}ms`)
}
```

### 4. Error Handling
```typescript
try {
  const response = await fetch(`${FRAPPE_URL}${path}`, options)
  
  if (!response.ok) {
    // يمكن إضافة error handling مخصص
    throw new Error(`Frappe API Error: ${response.status}`)
  }
} catch (error) {
  // يمكن إرسال الأخطاء إلى monitoring service
  console.error('API Error:', error)
  return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
}
```

## Testing 🧪

### 1. Test API Proxy
```bash
# Test GET
curl http://localhost:3000/api/frappe?path=/api/resource/HR%20Settings/HR%20Settings

# Test POST
curl -X POST http://localhost:3000/api/frappe?path=/api/method/ping \
  -H "Content-Type: application/json" \
  -d '{}'
```

### 2. Test في الصفحات
افتح المتصفح وانتقل إلى:
- http://localhost:3000/hr-settings
- افتح Developer Console (F12)
- تأكد من عدم وجود CORS errors
- تحقق من Network tab: يجب أن ترى طلبات إلى `/api/frappe` بدلاً من `qarawi.base.meena.sa`

## الخلاصة 📝

- ❌ **المشكلة**: CORS عند الاستدعاء المباشر من Browser إلى Frappe
- ✅ **الحل**: استخدام Next.js API Routes كـ Proxy
- 🎯 **النتيجة**: جميع API calls تعمل بدون أي CORS errors
- 🔒 **مكافأة**: أكثر أماناً ويمكن إضافة features إضافية لاحقاً

## الأسئلة الشائعة ❓

### س: هل يجب تعديل الـ Backend؟
ج: لا! الحل يعمل بدون أي تعديلات في Frappe backend.

### س: ماذا عن الأداء؟
ج: الأداء مشابه أو أفضل (يمكن إضافة caching في API Route).

### س: هل يعمل في Production؟
ج: نعم! Next.js API Routes تعمل تماماً في production على Vercel أو أي hosting آخر.

### س: ماذا عن Real-time updates؟
ج: يمكن إضافة WebSocket support لاحقاً في نفس API Route.

---

**تم بنجاح! 🎉**
جميع الصفحات الآن تستخدم API Proxy ولا توجد CORS errors.
