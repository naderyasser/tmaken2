# 🚀 دليل البدء السريع - نظام الموارد البشرية

## 👋 مرحباً بك!

هذا الدليل سيساعدك على البدء مع نظام الموارد البشرية (HRMS) خلال **10 دقائق**!

---

## 📋 قبل البدء

تأكد أن لديك:
- ✅ Node.js 18+ مثبت
- ✅ Python 3.10+ مثبت
- ✅ MariaDB/MySQL مثبت
- ✅ Git مثبت
- ✅ pnpm أو npm مثبت

---

## 🏗️ نظرة سريعة على البنية

```
┌─────────────────────────────────────────────┐
│         المستخدم (User)                     │
└────────────────┬────────────────────────────┘
                 │
        ┌────────┴────────┐
        │                 │
        ▼                 ▼
┌──────────────┐  ┌──────────────┐
│   Next.js    │  │   Frappe     │
│  Frontend    │  │   Backend    │
│  Port 3000   │◄─┤  Port 8000   │
│   🎨 UI      │  │  🔧 API      │
└──────────────┘  └──────────────┘
```

---

## ⚡ البدء السريع - 3 خطوات

### الخطوة 1: تشغيل Backend (Frappe)

```bash
# في Terminal أول
cd /home/nader/frappe-bench

# بدء الـ bench
bench start
```

**النتيجة المتوقعة**:
```
✓ Redis Server running on port 11000
✓ Redis Server running on port 13000  
✓ SocketIO Server running on port 9000
✓ Web Server running on http://localhost:8000
```

**اختبر**: افتح `http://localhost:8000` في المتصفح - يجب أن ترى صفحة Login

---

### الخطوة 2: تشغيل Frontend (Next.js)

```bash
# في Terminal ثاني
cd /home/nader/frappe-bench/hr-management-system-ui

# تثبيت Dependencies (أول مرة فقط)
pnpm install

# بدء Development Server
pnpm dev
```

**النتيجة المتوقعة**:
```
✓ Ready in 2.5s
✓ Local: http://localhost:3000
✓ Network: http://192.168.1.x:3000
```

**اختبر**: افتح `http://localhost:3000` في المتصفح - يجب أن ترى HR Dashboard

---

### الخطوة 3: تسجيل الدخول (اختياري)

```bash
# في Frappe (Terminal ثالث)
cd /home/nader/frappe-bench

# الدخول بحساب Administrator
bench --site meena.localhost set-admin-password [password]

# أو إنشاء مستخدم جديد
bench --site meena.localhost add-user [email] --first-name [name] --last-name [name]
```

---

## 🎯 بدأت بنجاح! الآن ماذا؟

### للمطورين الـ Backend

```bash
# 1. فتح Frappe UI
http://localhost:8000

# 2. اذهب إلى HR Dashboard
http://localhost:8000/app/hr

# 3. راجع التوثيق
cd /home/nader/frappe-bench
cat HR_PAGES_DOCUMENTATION.md
```

**الملفات المهمة لك**:
- `HR_PAGES_DOCUMENTATION.md` - جميع الصفحات والمسارات
- `HR_ROUTING_GUIDE.md` - دليل التوجيه
- `apps/hrms/` - كود HRMS
- `apps/base_meena/` - التخصيصات

---

### للمطورين الـ Frontend

```bash
# 1. فتح Next.js UI
http://localhost:3000

# 2. فتح المشروع في VS Code
code hr-management-system-ui/

# 3. راجع التوثيق
cd hr-management-system-ui
cat README.md
```

**الملفات المهمة لك**:
- `hr-management-system-ui/README.md` - توثيق شامل
- `hr-management-system-ui/components/` - React Components
- `HR_SYSTEM_INTEGRATION_GUIDE.md` - التكامل مع Backend
- `hr-management-system-ui/app/` - Next.js Pages

---

### للمطورين الـ Full Stack

راجع كل الملفات! بالترتيب:
1. `HR_DASHBOARD_INDEX.md` (هذا الملف) - الفهرس
2. `HR_SYSTEM_INTEGRATION_GUIDE.md` - التكامل الشامل
3. `hr-management-system-ui/README.md` - Frontend
4. `HR_PAGES_DOCUMENTATION.md` - Backend

---

## 📁 هيكل المشروع الأساسي

```
/home/nader/frappe-bench/
│
├── apps/                          # Frappe Apps
│   ├── frappe/                   # Frappe Framework
│   ├── erpnext/                  # ERPNext Core
│   ├── hrms/                     # HR Module ⭐
│   ├── base_meena/               # Meena Customizations
│   └── hr_custom/                # HR Customizations
│
├── sites/                         # Sites Configuration
│   └── meena.localhost/          # Your Site
│
├── hr-management-system-ui/      # Next.js Frontend 🆕
│   ├── app/                      # Next.js App Router
│   ├── components/               # React Components
│   ├── lib/                      # Utilities
│   └── public/                   # Static Assets
│
└── Documentation/                 # التوثيق
    ├── HR_DASHBOARD_INDEX.md
    ├── HR_PAGES_DOCUMENTATION.md
    ├── HR_ROUTING_GUIDE.md
    ├── HR_UX_FLOW_GUIDE.md
    └── HR_SYSTEM_INTEGRATION_GUIDE.md
```

---

## 🔍 أول مهمة: إضافة موظف

### في Frappe UI (الطريقة القديمة)

```bash
# 1. افتح Frappe
http://localhost:8000/app/hr

# 2. اضغط على "Employee"
# 3. اضغط على "+ New"
# 4. املأ البيانات:
   - Employee Name: Ahmed Mohamed
   - Company: Meena Company
   - Department: Engineering
   - Status: Active

# 5. اضغط "Save"
```

---

### في Next.js UI (الطريقة الجديدة)

```bash
# 1. افتح Next.js
http://localhost:3000

# 2. اضغط على "Add Employee" في Quick Actions
# 3. سيظهر نموذج إضافة موظف
# 4. املأ البيانات
# 5. اضغط "Save"

# ملاحظة: حالياً النموذج تجريبي، التكامل مع Backend قيد التطوير
```

---

## 🧪 اختبار التكامل

### اختبار 1: API Call من Frontend إلى Backend

```typescript
// في مجلد hr-management-system-ui
// أنشئ ملف test-api.ts

import { frappeClient } from '@/lib/api-client'

async function testAPI() {
  try {
    // احصل على قائمة الموظفين
    const response = await frappeClient.get('/api/resource/Employee')
    console.log('Employees:', response.data)
  } catch (error) {
    console.error('API Error:', error)
  }
}

testAPI()
```

---

### اختبار 2: إنشاء موظف من Frontend

```typescript
async function createEmployee() {
  try {
    const newEmployee = await frappeClient.post('/api/resource/Employee', {
      employee_name: 'Test Employee',
      company: 'Meena Company',
      status: 'Active'
    })
    console.log('Created:', newEmployee.data)
  } catch (error) {
    console.error('Create Error:', error)
  }
}
```

---

## 🛠️ حل المشاكل الشائعة

### مشكلة: Frappe لا يعمل

```bash
# الحل 1: تأكد من تشغيل MariaDB
sudo systemctl status mariadb
sudo systemctl start mariadb

# الحل 2: تأكد من تشغيل Redis
redis-cli ping
# يجب أن يرجع: PONG

# الحل 3: أعد تشغيل bench
bench restart
```

---

### مشكلة: Next.js لا يعمل

```bash
# الحل 1: احذف node_modules وأعد التثبيت
cd hr-management-system-ui
rm -rf node_modules
rm -rf .next
pnpm install
pnpm dev

# الحل 2: تأكد من Port 3000 غير مستخدم
lsof -i :3000
kill -9 [PID]

# الحل 3: استخدم port مختلف
pnpm dev --port 3001
```

---

### مشكلة: CORS Error

```bash
# في Frappe
cd /home/nader/frappe-bench

# أضف للـ site_config.json
bench --site meena.localhost set-config allow_cors "*"

# أعد تشغيل bench
bench restart
```

---

### مشكلة: Cannot connect to API

```typescript
// في hr-management-system-ui/.env.local
NEXT_PUBLIC_FRAPPE_URL=http://localhost:8000

// أعد تشغيل Next.js
pnpm dev
```

---

## 📚 الموارد والروابط

### التوثيق المحلي
- 📑 [فهرس شامل](./HR_DASHBOARD_INDEX.md)
- 📖 [توثيق الصفحات](./HR_PAGES_DOCUMENTATION.md)
- 🛣️ [دليل المسارات](./HR_ROUTING_GUIDE.md)
- 👤 [دليل UX](./HR_UX_FLOW_GUIDE.md)
- 🔗 [التكامل الشامل](./HR_SYSTEM_INTEGRATION_GUIDE.md)
- 📘 [Next.js Frontend](./hr-management-system-ui/README.md)

### التوثيق الرسمي
- [Frappe Framework](https://frappeframework.com/docs)
- [ERPNext](https://docs.erpnext.com)
- [Next.js](https://nextjs.org/docs)
- [React](https://react.dev)
- [TypeScript](https://www.typescriptlang.org/docs)
- [Tailwind CSS](https://tailwindcss.com/docs)

---

## 🎓 خطوات التعلم المقترحة

### اليوم الأول (2-3 ساعات)
1. ✅ تشغيل Backend و Frontend
2. ✅ استكشاف Frappe UI
3. ✅ استكشاف Next.js UI
4. ✅ قراءة `HR_DASHBOARD_INDEX.md`
5. ✅ قراءة `HR_SYSTEM_INTEGRATION_GUIDE.md`

### اليوم الثاني (3-4 ساعات)
1. ✅ قراءة توثيق التخصص (Backend أو Frontend)
2. ✅ تجربة إنشاء موظف في النظامين
3. ✅ فهم Data Flow بين Frontend و Backend
4. ✅ تجربة API Calls

### اليوم الثالث (4-5 ساعات)
1. ✅ بدء العمل على مهمة بسيطة
2. ✅ إضافة Component جديد (Frontend)
3. ✅ أو إضافة API Endpoint جديد (Backend)
4. ✅ كتابة Test

---

## 🎯 المهام المقترحة للمبتدئين

### مهمة 1: إضافة حقل جديد لـ Employee (Backend)
```bash
# الصعوبة: ⭐ سهل
# الوقت: 30 دقيقة
# الهدف: فهم DocType Customization
```

### مهمة 2: إنشاء Component جديد (Frontend)
```bash
# الصعوبة: ⭐ سهل
# الوقت: 1 ساعة
# الهدف: فهم React Components
```

### مهمة 3: ربط Component بـ API (Full Stack)
```bash
# الصعوبة: ⭐⭐ متوسط
# الوقت: 2-3 ساعات
# الهدف: فهم التكامل بين Frontend و Backend
```

### مهمة 4: إضافة صفحة جديدة كاملة (Full Stack)
```bash
# الصعوبة: ⭐⭐⭐ متقدم
# الوقت: 1-2 يوم
# الهدف: بناء Feature كاملة من البداية للنهاية
```

---

## 💡 نصائح للنجاح

### للجميع
1. ✅ **اقرأ التوثيق أولاً** - وفر عليك ساعات من البحث
2. ✅ **جرب الأمثلة** - كل الكود في التوثيق tested
3. ✅ **اسأل الفريق** - لا تتردد في طلب المساعدة
4. ✅ **ساهم في التوثيق** - إذا وجدت شيء ناقص، أضفه

### للمطورين Backend
1. ✅ استخدم Frappe Console للتجربة السريعة: `bench console`
2. ✅ راجع DocTypes الموجودة قبل إنشاء جديدة
3. ✅ استخدم Hooks بحذر
4. ✅ اكتب Tests للـ API

### للمطورين Frontend
1. ✅ استخدم TypeScript - لا تتجاهل الـ Types
2. ✅ استخدم المكونات الجاهزة من `components/ui/`
3. ✅ اتبع Tailwind naming conventions
4. ✅ اكتب Components قابلة لإعادة الاستخدام

---

## 🚀 أنت جاهز!

الآن لديك:
- ✅ بيئة عمل كاملة
- ✅ توثيق شامل
- ✅ أمثلة للبدء
- ✅ مهام مقترحة
- ✅ خطة تعلم واضحة

**ابدأ بالكود! 💪**

---

## 📞 الدعم

إذا واجهت أي مشكلة:
1. راجع قسم "حل المشاكل الشائعة" في الأعلى
2. ابحث في التوثيق
3. اسأل الفريق
4. افتح Issue على GitHub

---

## 🎉 نصيحة أخيرة

> "أفضل طريقة للتعلم هي بالممارسة. لا تخف من كسر الأشياء - هذا جزء من عملية التعلم!"

---

**تاريخ الإنشاء**: 7 فبراير 2026  
**آخر تحديث**: 7 فبراير 2026  
**الإصدار**: 1.0.0

**Happy Coding! 🚀**
