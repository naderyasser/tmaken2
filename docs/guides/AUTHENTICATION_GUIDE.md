# Authentication Setup Guide

## المشكلة 🚨
```
API request failed: 403
exception: "frappe.exceptions.PermissionError"
User Guest does not have access to HR Settings
```

الطلبات تُرسل كـ **Guest user** لأنه لا يوجد authentication.

## الحل ✅

تم إضافة دعم authentication بطريقتين:

### 1️⃣ Session-Based Authentication (الموصى به للتطوير)

المستخدم يسجل دخول من خلال صفحة `/login`، والـ cookies تُحفظ تلقائياً.

**الخطوات:**

1. **افتح صفحة Login:**
   ```
   http://localhost:3000/login
   ```

2. **سجل دخول باستخدام:**
   - البريد الإلكتروني: `administrator`
   - كلمة المرور: `admin` (أو كلمة المرور الخاصة بك)

3. **بعد تسجيل الدخول:**
   - سيتم حفظ cookies تلقائياً
   - جميع الطلبات ستُرسل مع هذه الـ cookies
   - ستتمكن من الوصول إلى جميع الصفحات

4. **الصفحات المتاحة:**
   ```
   http://localhost:3000/hr-settings
   http://localhost:3000/employee-search
   http://localhost:3000/employee-details/HR-EMP-00001
   http://localhost:3000/location-tracking
   http://localhost:3000/radius-alerts
   http://localhost:3000/shift-management
   ```

### 2️⃣ API Key Authentication (للـ Production)

أكثر أماناً لأن الـ credentials لا تُخزن في المتصفح.

**الخطوات:**

1. **احصل على API Key من Frappe:**
   - سجل دخول إلى Frappe: https://qarawi.base.meena.sa
   - اذهب إلى: User Menu → My Settings → API Access
   - انقر "Generate Keys"
   - انسخ API Key و API Secret

2. **أضف الـ Keys إلى .env.local:**
   ```bash
   NEXT_PUBLIC_FRAPPE_URL=https://qarawi.base.meena.sa
   FRAPPE_API_KEY=your_api_key_here
   FRAPPE_API_SECRET=your_api_secret_here
   ```

3. **أعد تشغيل السيرفر:**
   ```bash
   npm run dev
   ```

الآن جميع الطلبات ستُرسل مع `Authorization: token API_KEY:API_SECRET` header.

## كيف يعمل؟ 🔄

### Session-Based Flow:
```
1. User visits /login
2. Enters credentials
3. POST /api/frappe?path=/api/method/login
4. Frappe returns Set-Cookie: sid=xxxxx
5. Browser saves cookie
6. All subsequent requests include Cookie: sid=xxxxx
7. API proxy forwards cookie to Frappe
8. Frappe validates session and returns data
```

### API Key Flow:
```
1. User visits any page
2. Frontend calls /api/frappe?path=...
3. API proxy adds Authorization: token KEY:SECRET
4. Frappe validates API key
5. Returns data
```

## الملفات المعدلة 📁

### 1. app/api/frappe/route.ts
```typescript
// أضيف دعم للـ authentication
function getAuthHeaders(request: NextRequest): HeadersInit {
  // Priority 1: API key (if provided)
  if (FRAPPE_API_KEY && FRAPPE_API_SECRET) {
    return { Authorization: `token ${FRAPPE_API_KEY}:${FRAPPE_API_SECRET}` }
  }
  
  // Priority 2: Forward cookies from browser
  const cookies = request.headers.get('cookie')
  if (cookies) {
    return { Cookie: cookies }
  }
}

// أضيف credentials: 'include' لكل الطلبات
fetch(url, {
  credentials: 'include',
  headers: getAuthHeaders(request)
})

// أضيف forward للـ set-cookie headers
const setCookie = response.headers.get('set-cookie')
if (setCookie) {
  frappeResponse.headers.set('set-cookie', setCookie)
}
```

### 2. lib/api.ts
```typescript
// أضيف credentials: 'include' للـ fetch
const fetchOptions: RequestInit = {
  credentials: 'include', // Important for cookies
  // ...
}

// أضيف دوال login/logout/getCurrentUser
export async function login(usr: string, pwd: string) { ... }
export async function logout() { ... }
export async function getCurrentUser() { ... }
```

### 3. app/login/page.tsx (جديد)
صفحة تسجيل دخول كاملة مع:
- Form validation
- Loading states
- Error handling
- Toast notifications
- Redirect after login

### 4. next.config.mjs
تم إزالة rewrites القديمة (لم نعد نحتاجها مع API proxy).

## Testing 🧪

### Test 1: Session Login
```bash
# 1. Open browser
open http://localhost:3000/login

# 2. Login with:
#    Email: administrator
#    Password: admin

# 3. Check cookies in DevTools:
#    Application → Cookies → localhost
#    Should see: sid, user_id, etc.

# 4. Visit HR Settings:
open http://localhost:3000/hr-settings

# 5. Should work without 403 error!
```

### Test 2: API Key
```bash
# 1. Add to .env.local:
FRAPPE_API_KEY=your_key
FRAPPE_API_SECRET=your_secret

# 2. Restart server:
npm run dev

# 3. Visit any page directly:
open http://localhost:3000/hr-settings

# 4. Should work without login!
```

### Test 3: Logout
```bash
# Add logout button to any page:
import { logout } from "@/lib/api"

<Button onClick={async () => {
  await logout()
  router.push('/login')
}}>
  Logout
</Button>
```

## الأسئلة الشائعة ❓

### س: لماذا أحصل على 403 error؟
ج: لأنك غير مسجل دخول. سجل دخول من `/login` أو استخدم API key.

### س: هل cookies آمنة؟
ج: نعم! Frappe يستخدم HttpOnly cookies التي لا يمكن الوصول لها من JavaScript.

### س: ماذا عن CORS مع cookies?
ج: تم حل هذا عبر:
- `credentials: 'include'` في جميع fetch requests
- API proxy يمرر cookies من المتصفح إلى Frappe
- Frappe يُرجع Set-Cookie headers

### س: أيهما أفضل: Session أو API Key?
ج: 
- **Development**: استخدم Session (أسهل)
- **Production**: استخدم API Key (أكثر أماناً)
- **Mobile App**: استخدم API Key
- **Web App**: يمكن استخدام كليهما

### س: كيف أضيف logout button؟
ج: أضف في أي صفحة:
```typescript
import { logout } from "@/lib/api"
import { useRouter } from "next/navigation"

const router = useRouter()

<Button onClick={async () => {
  await logout()
  router.push('/login')
}}>
  تسجيل خروج
</Button>
```

### س: كيف أحمي الصفحات من الـ Guest users?
ج: أضف middleware أو check في كل صفحة:
```typescript
const user = await getCurrentUser()
if (!user || user === 'Guest') {
  router.push('/login')
  return
}
```

## Next Steps 🚀

1. ✅ سجل دخول من `/login`
2. ✅ اختبر جميع الصفحات
3. ⚠️ أضف logout button في الـ header
4. ⚠️ أضف middleware لحماية الصفحات
5. ⚠️ أضف "Remember me" option
6. ⚠️ أضف password reset functionality

---

**تم بنجاح! 🎉**
الآن يمكنك تسجيل الدخول والوصول إلى جميع الصفحات بدون 403 errors.
