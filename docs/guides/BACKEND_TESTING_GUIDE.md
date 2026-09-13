# 🧪 دليل اختبار الربط مع Frappe Backend

## ✅ ما تم إنجازه

### 1. إصلاح الأخطاء
- ✅ إصلاح TypeScript errors في `api-client.test.ts`
- ✅ إصلاح undefined department في `employees-list.tsx`
- ✅ إصلاح Jest DOM types
- ✅ تحديث Mock setup في Component tests

### 2. نتائج الاختبارات
```
✅ API Client Tests: 17/17 PASSED (100%)
✅ Component Tests: 8/23 PASSED (35%)
📊 المجموع: 25/40 (62.5%)
```

**الاختبارات الناجحة في Component:**
- ✅ should render the component
- ✅ should display employees after loading
- ✅ should filter employees by name
- ✅ should filter employees by department
- ✅ should show no results message when no match
- ✅ should sort by employee name ascending
- ✅ should paginate results
- ✅ should navigate to next page

---

## 🔗 اختبار الربط مع Backend

### 1. التحقق من Frappe Server

```bash
# التحقق من أن server يعمل
curl http://localhost:8000/api/method/ping

# النتيجة المتوقعة:
# {"message":"pong"}
```

✅ **النتيجة**: Server يعمل بنجاح! ✓

---

### 2. اختبار Employee API

#### المشكلة الحالية:
```
❌ Permission Error: Guest user لا يملك صلاحية الوصول للـ Employee DocType
```

#### الحلول:

##### الحل 1: تسجيل الدخول أولاً
```bash
# طريقة 1: استخدام API
curl -X POST http://localhost:8000/api/method/login \
  -H "Content-Type: application/json" \
  -d '{"usr": "Administrator", "pwd": "YOUR_PASSWORD"}'

# احصل على cookie من Response وأرسلها مع الطلبات التالية
curl http://localhost:8000/api/resource/Employee \
  -H "Cookie: sid=YOUR_SESSION_ID"
```

##### الحل 2: إعطاء صلاحيات Guest Role
```python
# في Frappe console
bench --site [sitename] console

# ثم في Python console:
frappe.get_doc("DocType", "Employee").add_permission("Guest", "read").save()
frappe.db.commit()
```

##### الحل 3: استخدام API Key/Secret
```python
# إنشاء API Key في Frappe
# 1. اذهب إلى User List
# 2. افتح Administrator user
# 3. Generate Keys
# 4. استخدمها في API Client:

# في api-client.ts:
frappeClient.setAPICredentials(
  'api_key_من_frappe',
  'api_secret_من_frappe'
)
```

---

### 3. اختبار manual في Browser

تم إنشاء صفحة اختبار: `/test-api`

**الاستخدام:**
1. شغّل dev server: `npm run dev`
2. افتح: `http://localhost:3000/test-api`
3. اضغط "Run Tests"
4. ستظهر نتائج 4 اختبارات:
   - Server Connectivity ✓
   - Get Employees (يحتاج authentication)
   - Get Employee Stats (يحتاج authentication)
   - Employee DocType Check (يحتاج authentication)

---

## 🛠️ الخطوات التالية

### الآن:
1. ✅ **حل مشكلة Authentication** (اختر أحد الحلول أعلاه)
2. ✅ **اختبار Employees List في المتصفح**
3. ✅ **التحقق من أن جميع CRUD operations تعمل**

### بعدها:
4. **البدء في صفحة Attendance** ✨

---

## 📊 ملخص الوضع الحالي

```
System Status:
├── Backend (Frappe)
│   ├── Server Running: ✅ YES (http://localhost:8000)
│   ├── Ping Test: ✅ PASSED
│   └── Authentication: ⚠️ REQUIRED
│
├── Frontend (Next.js)
│   ├── Components: ✅ BUILT
│   ├── API Client: ✅ TESTED (17/17)
│   ├── Tests: ✅ 62.5% PASSING
│   └── Node Version: ⚠️ v18 (requires v20+ for Next.js 15)
│
└── Integration
    ├── Network Connection: ✅ WORKING
    ├── API Endpoints: ✅ AVAILABLE
    └── Permissions: ⚠️ NEEDS SETUP
```

---

## 🎯 الخلاصة

### ✅ نجح:
- Backend Server responsive
- API Client مبني وmocked بشكل صحيح
- Component Tests 62.5% passing
- Network connection يعمل

### ⚠️ يحتاج حل:
- Authentication/Permissions للـ Employee DocType
- بقية Component Tests (15/23)
- Node.js version upgrade (للإنتاج)

### 📝 التوصية:
**حل مشكلة Authentication → اختبار في Browser → البدء في Attendance page**

---

## 🚀 الأوامر المفيدة

```bash
# تشغيل Backend
cd /home/nader/frappe-bench
bench start

# تشغيل Frontend (بعد حل مشكلة Node.js)
cd hr-management-system-ui
npm run dev

# تشغيل الاختبارات
npm test                  # All tests
npm run test:ci           # With coverage
npm run test:e2e          # E2E tests (Playwright)

# فتح Frappe Console
bench --site [sitename] console

# عرض الsites المتاحة
bench --site list
```

---

**تاريخ التحديث**: 2026-02-07  
**الحالة**: 🟡 جاهز للاختبار بعد حل Authentication
