# دليل تشخيص مشاكل Navigation والموظفين

## 🔍 المشكلة: عند الضغط على موظف لا تظهر صفحة التفاصيل

### ✅ التحديثات المضافة للتشخيص:

#### 1. إضافة Toaster في Layout
تم إضافة `<Toaster />` في `/app/layout.tsx` لعرض رسائل الـ Toast

#### 2. إضافة Console Logs تفصيلية
تم إضافة logs في:
- `/app/employees/page.tsx` - في `handleEmployeeSelect`
- `/app/employee/[id]/page.tsx` - في `loadEmployee`

#### 3. إضافة Fallback للـ Navigation
في حالة فشل `router.push`، سيتم استخدام `window.location.href`

---

## 🧪 خطوات التشخيص:

### 1️⃣ افتح Developer Console
اضغط `F12` أو `Ctrl+Shift+I` (Windows/Linux) أو `Cmd+Option+I` (Mac)

### 2️⃣ اذهب إلى صفحة الموظفين
```
http://localhost:3000/employees
```

### 3️⃣ اضغط على أي موظف أو زر "Edit"
راقب الـ Console وستشاهد:

```javascript
// عند الضغط على الموظف:
Navigating to employee: [employee_name] [employee_object]
Navigation path: /employee/[employee_name]

// بعد الانتقال للصفحة:
EmployeeProfile mounted with params: {id: "[employee_name]"}
Loading employee: [employee_name]
Employee data loaded: [employee_data]
```

---

## 🎯 الأخطاء الشائعة وحلولها:

### ❌ الخطأ 1: "Navigating to employee" يظهر بس "EmployeeProfile mounted" لا
**السبب**: الـ Route مش موجود أو في مشكلة في Next.js routing
**الحل**: 
```bash
# تأكد من وجود الملف:
ls -la app/employee/[id]/page.tsx

# أعد تشغيل الـ dev server:
npm run dev
# أو
pnpm dev
```

### ❌ الخطأ 2: "Error loading employee" يظهر في Console
**السبب**: الـ API مش راجع بيانات أو في مشكلة في الـ Backend
**الحل**:
1. تأكد من أن Backend يعمل:
```bash
curl https://qarawi.base.meena.sa/api/method/ping
```

2. تأكد من الـ Authentication:
- افتح Network tab في Developer Tools
- شوف الـ Request للـ `/api/resource/Employee/[id]`
- تحقق من الـ Response

### ❌ الخطأ 3: الصفحة تحمل بس مفيش بيانات
**السبب**: employee.name مش صحيح أو الـ API راجع null
**الحل**:
1. شوف الـ Console logs بتاعت "Employee data loaded"
2. تحقق من أن `employee.name` موجود في القائمة
3. جرب اختبار الـ API مباشرة:
```bash
curl https://qarawi.base.meena.sa/api/resource/Employee/[employee_name]
```

---

## 🔧 اختبارات إضافية:

### اختبار 1: Navigation يدوي
افتح المتصفح واكتب مباشرة:
```
http://localhost:3000/employee/new
```
إذا الصفحة ظهرت، يبقى المشكلة في الـ routing من employees list

### اختبار 2: Test API Endpoint
افتح:
```
http://localhost:3000/test-api
```
واختبر الاتصال بالـ Backend

### اختبار 3: Console في Employees List
في صفحة `/employees`، اكتب في Console:
```javascript
// طباعة أول موظف من القائمة
console.log(document.querySelector('[data-employee-name]'))
```

---

## 📋 Checklist للتأكد من عمل كل شيء:

- [ ] الـ dev server شغال (`npm run dev`)
- [ ] صفحة `/employees` تفتح بدون أخطاء
- [ ] قائمة الموظفين تظهر
- [ ] Console مفتوح (F12)
- [ ] عند الضغط على موظف، تظهر رسالة "Navigating to employee"
- [ ] الصفحة تنتقل لـ `/employee/[id]`
- [ ] تظهر رسالة "EmployeeProfile mounted"
- [ ] تظهر رسالة "Loading employee"
- [ ] البيانات تحمل أو يظهر error واضح
- [ ] الـ Toaster يعرض رسائل النجاح/الخطأ

---

## 💡 نصائح إضافية:

1. **امسح الـ Cache**: اضغط `Ctrl+Shift+R` لإعادة تحميل الصفحة بدون cache
2. **تأكد من الـ .env.local**: 
   ```env
   NEXT_PUBLIC_FRAPPE_URL=https://qarawi.base.meena.sa
   ```
3. **شوف الـ Network Tab**: راقب جميع الـ API calls
4. **اقرأ الأخطاء بدقة**: كل error message فيه معلومات مفيدة

---

## 🆘 إذا ما زالت المشكلة موجودة:

انسخ كل الـ console output وأرسله، بما في ذلك:
- جميع الـ logs من "Navigating to employee" حتى آخر رسالة
- أي errors من الـ Network tab
- أي warnings في Console
- نسخة من أحد الـ employee objects من القائمة

---

## 🎯 الملفات المحدثة:

1. ✅ `/app/layout.tsx` - أضيف Toaster
2. ✅ `/app/employees/page.tsx` - أضيفت console logs
3. ✅ `/app/employee/[id]/page.tsx` - أضيفت console logs
