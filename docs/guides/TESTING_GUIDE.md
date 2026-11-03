# 🧪 دليل اختبار شامل لميزات HRMS
## Comprehensive Testing Guide for HRMS Features

تاريخ الإنشاء: 9 فبراير 2026
الإصدار: 1.0.0

---

## 📋 جدول المحتويات

1. [إعداد بيئة الاختبار](#setup)
2. [اختبار صفحة إعدادات HR Settings](#hr-settings-test)
3. [اختبار البحث المتقدم عن الموظفين](#employee-search-test)
4. [اختبار صفحة تفاصيل الموظف](#employee-details-test)
5. [اختبار تتبع المواقع الجغرافية](#location-tracking-test)
6. [اختبار تنبيهات المسافة](#radius-alerts-test)
7. [اختبار إدارة الشفتات](#shift-management-test)
8. [اختبار APIs الخلفية](#backend-apis-test)
9. [اختبارات الأداء](#performance-test)
10. [اختبارات الأمان](#security-test)

---

## 🛠️ إعداد بيئة الاختبار {#setup}

### المتطلبات الأساسية

```bash
# 1. تثبيت المكتبات
npm install
# أو
pnpm install

# 2. إعداد ملف .env.local
NEXT_PUBLIC_FRAPPE_URL=https://qarawi.base.meena.sa

# 3. التأكد من تشغيل الباك إند
# تأكد من أن Frappe HRMS يعمل على الرابط أعلاه

# 4. تشغيل المشروع
npm run dev
```

### حسابات الاختبار المطلوبة

```
HR Manager:
- Username: hr.manager@company.com
- Password: [كلمة المرور]
- الصلاحيات: قراءة وكتابة على كل الميزات

HR User:
- Username: hr.user@company.com
- Password: [كلمة المرور]
- الصلاحيات: قراءة فقط

Employee:
- Username: employee@company.com
- Password: [كلمة المرور]
- الصلاحيات: قراءة محدودة على بياناته فقط
```

---

## 1️⃣ اختبار صفحة إعدادات HR Settings {#hr-settings-test}

### الصفحة: `/hr-settings`

### الميزات المطلوب اختبارها:

#### ✅ Test 1.1: تحميل الإعدادات
```
الخطوات:
1. سجل الدخول كـ HR Manager
2. انتقل إلى /hr-settings
3. انتظر حتى يتم تحميل الصفحة

النتيجة المتوقعة:
✓ يتم عرض جميع الإعدادات الحالية
✓ لا توجد أخطاء في Console
✓ الـ Switches تعكس القيم الصحيحة (مفعّل/معطّل)
✓ الحقول النصية مملوءة بالقيم الحالية
```

#### ✅ Test 1.2: تعديل إعدادات الحضور
```
الخطوات:
1. فعّل "allow_geolocation_tracking"
2. فعّل "allow_employee_checkin_from_mobile_app"
3. اضغط على "حفظ الإعدادات"

النتيجة المتوقعة:
✓ يظهر toast "تم الحفظ"
✓ عند إعادة تحميل الصفحة، الإعدادات محفوظة
✓ API call ناجح: POST /api/method/frappe.client.set_value
```

#### ✅ Test 1.3: تعديل إعدادات الإجازات
```
الخطوات:
1. فعّل "prevent_self_leave_approval"
2. فعّل "restrict_backdated_leave_application"
3. اضغط على "حفظ الإعدادات"

النتيجة المتوقعة:
✓ يتم حفظ الإعدادات بنجاح
✓ لا توجد أخطاء
```

#### ✅ Test 1.4: تعديل إعدادات الشفتات
```
الخطوات:
1. فعّل "allow_multiple_shift_assignments"
2. اضغط على "حفظ الإعدادات"

النتيجة المتوقعة:
✓ يتم حفظ الإعدادات بنجاح
```

#### ✅ Test 1.5: تعديل إعدادات التنبيهات
```
الخطوات:
1. فعّل جميع التنبيهات (Birthday, Work Anniversary, Holiday)
2. غيّر التكرار إلى "Weekly"
3. اضغط على "حفظ الإعدادات"

النتيجة المتوقعة:
✓ يتم حفظ جميع الإعدادات
✓ التكرار يتغير بشكل صحيح
```

#### 🚨 اختبارات الأخطاء:

```
Test 1.E1: محاولة الحفظ بدون صلاحيات
- سجل الدخول كـ Employee
- حاول الوصول إلى /hr-settings
النتيجة المتوقعة: رسالة خطأ "Permission Denied"

Test 1.E2: فشل الاتصال بالباك إند
- أوقف الباك إند
- حاول تحميل الصفحة
النتيجة المتوقعة: رسالة خطأ مناسبة
```

---

## 2️⃣ اختبار البحث المتقدم عن الموظفين {#employee-search-test}

### الصفحة: `/employee-search`

### الميزات المطلوب اختبارها:

#### ✅ Test 2.1: البحث العام
```
الخطوات:
1. انتقل إلى /employee-search
2. أدخل "أحمد" في حقل البحث العام
3. اضغط Enter أو زر "بحث"

النتيجة المتوقعة:
✓ يتم عرض جميع الموظفين الذين يحتوي اسمهم على "أحمد"
✓ عدد النتائج يظهر بشكل صحيح
✓ API call: POST /api/method/hrms.hr.api.employee_search_api.search_employees
```

#### ✅ Test 2.2: البحث حسب القسم
```
الخطوات:
1. أدخل "HR Department" في حقل القسم
2. اضغط "بحث"

النتيجة المتوقعة:
✓ يتم عرض موظفي قسم HR فقط
```

#### ✅ Test 2.3: البحث حسب المسمى الوظيفي
```
الخطوات:
1. أدخل "Manager" في حقل المسمى الوظيفي
2. اضغط "بحث"

النتيجة المتوقعة:
✓ يتم عرض جميع المديرين فقط
```

#### ✅ Test 2.4: البحث حسب الحالة
```
الخطوات:
1. اختر "Active" من قائمة الحالة
2. اضغط "بحث"

النتيجة المتوقعة:
✓ يتم عرض الموظفين النشطين فقط
✓ Badges تعكس الحالة الصحيحة
```

#### ✅ Test 2.5: البحث المركب
```
الخطوات:
1. أدخل "أحمد" في البحث العام
2. اختر "HR Department" في القسم
3. اختر "Active" في الحالة
4. اضغط "بحث"

النتيجة المتوقعة:
✓ يتم عرض فقط الموظفين الذين يطابقون جميع الشروط
✓ البحث دقيق ولا يوجد نتائج خاطئة
```

#### ✅ Test 2.6: عرض تفاصيل الموظف
```
الخطوات:
1. قم بالبحث عن موظف
2. اضغط على زر "العين" (View)

النتيجة المتوقعة:
✓ يتم الانتقال إلى صفحة تفاصيل الموظف
✓ URL: /employee/[employee-id]
```

#### 🚨 اختبارات الأخطاء:

```
Test 2.E1: البحث بدون معايير
- اضغط "بحث" بدون إدخال أي شيء
النتيجة المتوقعة: يعرض جميع الموظفين النشطين

Test 2.E2: البحث عن موظف غير موجود
- ابحث عن "xyz123"
النتيجة المتوقعة: رسالة "لم يتم العثور على موظفين مطابقين"
```

---

## 3️⃣ اختبار صفحة تفاصيل الموظف {#employee-details-test}

### الصفحة: `/employee-details/[id]`

### الميزات المطلوب اختبارها:

#### ✅ Test 3.1: تحميل بيانات الموظف
```
الخطوات:
1. انتقل إلى /employee-details/HR-EMP-00001
2. انتظر حتى يتم التحميل

النتيجة المتوقعة:
✓ يتم عرض:
  - الاسم الكامل
  - المسمى الوظيفي
  - القسم
  - البريد الإلكتروني
  - رقم الهاتف
✓ Tabs تعمل بشكل صحيح
✓ 3 API calls:
  - get_employee_details
  - get_employee_statistics
  - get_employee_hierarchy
```

#### ✅ Test 3.2: عرض النظرة العامة
```
الخطوات:
1. افتح تفاصيل موظف
2. تأكد من أنك في tab "نظرة عامة"

النتيجة المتوقعة:
✓ يتم عرض:
  - المعلومات الأساسية (رقم الموظف، تاريخ الانضمام، تاريخ الميلاد)
  - الشفت الحالي (إن وجد)
  - إعدادات التتبع (إن وجدت)
  - سجلات الحضور الأخيرة (إن وجدت)
```

#### ✅ Test 3.3: عرض الإحصائيات
```
الخطوات:
1. اضغط على tab "الإحصائيات"

النتيجة المتوقعة:
✓ يتم عرض:
  - ملخص الحضور (حاضر، غائب، إجازة)
  - عدد التأخيرات
  - عدد الخروج المبكر
  - رصيد الإجازات
✓ الأرقام دقيقة
```

#### ✅ Test 3.4: عرض الهيكل التنظيمي
```
الخطوات:
1. اضغط على tab "الهيكل التنظيمي"

النتيجة المتوقعة:
✓ يتم عرض:
  - المدير المباشر (إن وجد)
  - المرؤوسين (إن وجدوا)
✓ الصور الرمزية تظهر بشكل صحيح
```

#### 🚨 اختبارات الأخطاء:

```
Test 3.E1: موظف غير موجود
- انتقل إلى /employee-details/INVALID-ID
النتيجة المتوقعة: رسالة "لم يتم العثور على الموظف"

Test 3.E2: موظف بدون بيانات كاملة
- اختبر موظف جديد بدون شفت أو إعدادات
النتيجة المتوقعة: لا يحدث crash، يتم إخفاء الأقسام الفارغة
```

---

## 4️⃣ اختبار تتبع المواقع الجغرافية {#location-tracking-test}

### الصفحة: `/location-tracking`

### الميزات المطلوب اختبارها:

#### ✅ Test 4.1: طلب صلاحية الموقع
```
الخطوات:
1. انتقل إلى /location-tracking
2. راقب طلب الصلاحية من المتصفح

النتيجة المتوقعة:
✓ يظهر طلب من المتصفح للسماح بالوصول إلى الموقع
✓ بعد السماح، يتم عرض الموقع الحالي
```

#### ✅ Test 4.2: عرض المواقع التاريخية
```
الخطوات:
1. أدخل رقم موظف: HR-EMP-00001
2. اختر تاريخ
3. اضغط "عرض المواقع"

النتيجة المتوقعة:
✓ يتم عرض قائمة بجميع المواقع المسجلة
✓ كل موقع يحتوي على:
  - التاريخ والوقت
  - الإحداثيات (Latitude, Longitude)
  - دقة الموقع (Accuracy)
  - العنوان (إن وجد)
✓ API call: POST /api/method/hrms.hr.doctype.employee_location_log.location_api.get_employee_locations
```

#### ✅ Test 4.3: بدء التتبع في الوقت الفعلي
```
الخطوات:
1. أدخل رقم موظف
2. اضغط "بدء التتبع"
3. انتظر دقيقة واحدة

النتيجة المتوقعة:
✓ يظهر badge "التتبع نشط" مع نقطة وامضة
✓ يتم حفظ الموقع كل دقيقة تلقائياً
✓ يظهر في Console: "Location saved"
✓ API call كل دقيقة: POST /api/method/hrms.hr.doctype.employee_location_log.location_api.save_location
```

#### ✅ Test 4.4: إيقاف التتبع
```
الخطوات:
1. بعد بدء التتبع، اضغط "إيقاف التتبع"

النتيجة المتوقعة:
✓ يتوقف حفظ المواقع
✓ يختفي badge "التتبع نشط"
✓ يظهر toast "تم إيقاف التتبع"
```

#### 🚨 اختبارات الأخطاء:

```
Test 4.E1: رفض صلاحية الموقع
- ارفض طلب الصلاحية من المتصفح
النتيجة المتوقعة: رسالة خطأ مناسبة

Test 4.E2: البحث بدون رقم موظف
- اضغط "عرض المواقع" بدون إدخال رقم موظف
النتيجة المتوقعة: toast "يرجى إدخال رقم الموظف"

Test 4.E3: موظف بدون مواقع مسجلة
- ابحث عن موظف لم يتم تتبعه
النتيجة المتوقعة: رسالة "لم يتم العثور على مواقع للتاريخ المحدد"
```

#### 📊 اختبار الدقة:

```
Test 4.P1: دقة الموقع
- تحقق من أن Accuracy أقل من 50 متر
- تحقق من أن الإحداثيات صحيحة (6 أرقام عشرية)

Test 4.P2: تكرار الحفظ
- تأكد من أن الموقع يُحفظ كل 60 ثانية بالضبط
- استخدم console.time لقياس الوقت
```

---

## 5️⃣ اختبار تنبيهات المسافة {#radius-alerts-test}

### الصفحة: `/radius-alerts`

### الميزات المطلوب اختبارها:

#### ✅ Test 5.1: عرض سجل التنبيهات
```
الخطوات:
1. انتقل إلى /radius-alerts
2. اختر فترة زمنية (from_date, to_date)
3. اضغط "عرض التنبيهات"

النتيجة المتوقعة:
✓ يتم عرض جميع التنبيهات في الفترة المحددة
✓ كل تنبيه يحتوي على:
  - اسم الموظف
  - التاريخ والوقت
  - المسافة من المركز
  - النطاق المسموح
  - الإحداثيات
  - Badge "خارج النطاق"
✓ API call: POST /api/method/hrms.hr.doctype.employee_location_settings.radius_alert_api.get_radius_alerts
```

#### ✅ Test 5.2: فلترة حسب موظف محدد
```
الخطوات:
1. أدخل رقم موظف في حقل "رقم الموظف"
2. اضغط "عرض التنبيهات"

النتيجة المتوقعة:
✓ يتم عرض تنبيهات هذا الموظف فقط
```

#### ✅ Test 5.3: فحص الموقع الحالي
```
الخطوات:
1. أدخل رقم موظف
2. اضغط "فحص الموقع الحالي"
3. اسمح بالوصول إلى الموقع

النتيجة المتوقعة:
- إذا كان داخل النطاق:
  ✓ toast أخضر: "الموظف داخل النطاق. المسافة: X متر"
- إذا كان خارج النطاق:
  ✓ toast أحمر: "الموظف خارج النطاق! المسافة: X متر من Y متر"
✓ API call: POST /api/method/hrms.hr.doctype.employee_location_settings.radius_alert_api.check_radius_alert
```

#### ✅ Test 5.4: الإحصائيات
```
الخطوات:
1. بعد عرض التنبيهات، انظر إلى البطاقات الثلاثة

النتيجة المتوقعة:
✓ إجمالي التنبيهات = عدد الصفوف في الجدول
✓ الموظفين المتأثرين = عدد الموظفين الفريدين
✓ متوسط المسافة = المتوسط الحسابي للمسافات
```

#### 🚨 اختبارات الأخطاء:

```
Test 5.E1: فحص بدون رقم موظف
- اضغط "فحص الموقع الحالي" بدون إدخال رقم موظف
النتيجة المتوقعة: toast "يرجى إدخال رقم الموظف"

Test 5.E2: موظف بدون إعدادات radius alert
- جرب موظف لم يتم تفعيل radius alert له
النتيجة المتوقعة: رسالة خطأ مناسبة أو alert_enabled: false

Test 5.E3: فترة بدون تنبيهات
- اختر فترة قديمة جداً أو مستقبلية
النتيجة المتوقعة: "لا توجد تنبيهات للفترة المحددة" مع أيقونة
```

#### 📏 اختبار الحسابات:

```
Test 5.C1: دقة حساب المسافة
- تحقق من أن المسافة المعروضة صحيحة باستخدام:
  https://www.movable-type.co.uk/scripts/latlong.html
- قارن المسافة المحسوبة مع الأداة أعلاه

Test 5.C2: التنبيه عند الحد الفاصل
- إذا كان alert_radius = 500 والمسافة = 501
  النتيجة: يجب أن ينشأ تنبيه
- إذا كانت المسافة = 499
  النتيجة: لا تنبيه
```

---

## 6️⃣ اختبار إدارة الشفتات {#shift-management-test}

### الصفحة: `/shift-management`

### الميزات المطلوب اختبارها:

#### ✅ Test 6.1: عرض قائمة الشفتات
```
الخطوات:
1. انتقل إلى /shift-management
2. انتظر حتى يتم التحميل

النتيجة المتوقعة:
✓ يتم عرض جميع الشفتات النشطة
✓ كل شفت يحتوي على:
  - الاسم
  - نقطة ملونة (color)
  - وقت البداية والنهاية
  - فترات السماح
  - حالة الحضور التلقائي
  - حالة الشفت (نشط/معطّل)
✓ API call: POST /api/method/hrms.hr.doctype.shift_assignment.shift_management_api.get_all_shifts
```

#### ✅ Test 6.2: إنشاء شفت جديد
```
الخطوات:
1. اضغط "إنشاء شفت جديد"
2. أدخل:
   - الاسم: "Evening Shift"
   - وقت البداية: 16:00
   - وقت النهاية: 00:00
   - فترة السماح للتأخير: 10 دقائق
   - فترة السماح للخروج المبكر: 10 دقائق
   - اللون: #e74c3c
3. اضغط "إنشاء الشفت"

النتيجة المتوقعة:
✓ toast "تم الإنشاء"
✓ يتم إغلاق Dialog
✓ يظهر الشفت الجديد في القائمة
✓ API call: POST /api/method/hrms.hr.doctype.shift_assignment.shift_management_api.create_shift
```

#### ✅ Test 6.3: تعيين شفت لموظف
```
الخطوات:
1. اضغط "تعيين شفت لموظف"
2. أدخل:
   - رقم الموظف: HR-EMP-00001
   - الشفت: Morning Shift
   - تاريخ البداية: اليوم
   - تاريخ النهاية: (اتركه فارغاً للتعيين الدائم)
3. اضغط "تعيين الشفت"

النتيجة المتوقعة:
✓ toast "تم التعيين"
✓ يتم إغلاق Dialog
✓ API call: POST /api/method/hrms.hr.doctype.shift_assignment.shift_management_api.assign_shift_to_employee
```

#### ✅ Test 6.4: تعيين شفت مؤقت
```
الخطوات:
1. اضغط "تعيين شفت لموظف"
2. أدخل:
   - رقم الموظف: HR-EMP-00002
   - الشفت: Night Shift
   - تاريخ البداية: اليوم
   - تاريخ النهاية: بعد أسبوع
3. اضغط "تعيين الشفت"

النتيجة المتوقعة:
✓ يتم التعيين بنجاح
✓ بعد تاريخ النهاية، يجب أن ينتهي التعيين
```

#### 🚨 اختبارات الأخطاء:

```
Test 6.E1: إنشاء شفت بدون اسم
- حاول إنشاء شفت بدون إدخال اسم
النتيجة المتوقعة: رسالة خطأ أو validation

Test 6.E2: تعيين بدون رقم موظف
- حاول التعيين بدون إدخال رقم موظف
النتيجة المتوقعة: toast "يرجى إدخال رقم الموظف"

Test 6.E3: شفت متداخل
- إذا كان "allow_multiple_shift_assignments" معطّل
- حاول تعيين شفتين لنفس الموظف في نفس اليوم
النتيجة المتوقعة: رسالة خطأ من Backend
```

#### ⏰ اختبارات المنطق:

```
Test 6.L1: شفت ليلي (عبور منتصف الليل)
- أنشئ شفت من 22:00 إلى 06:00
- تحقق من أن النظام يفهم أن النهاية في اليوم التالي

Test 6.L2: فترات السماح
- إذا كان الشفت يبدأ 08:00 وفترة السماح 15 دقيقة
- الموظف الذي يأتي الساعة 08:14 يجب ألا يُعتبر متأخراً
- الموظف الذي يأتي الساعة 08:16 يُعتبر متأخراً
```

---

## 7️⃣ اختبار APIs الخلفية {#backend-apis-test}

### استخدام Postman أو curl

#### ✅ Test 7.1: Employee Search API

```bash
# البحث عن موظف
curl -X POST https://qarawi.base.meena.sa/api/method/hrms.hr.api.employee_search_api.search_employees \
  -H "Content-Type: application/json" \
  -d '{
    "query": "أحمد",
    "filters": {"status": "Active"},
    "limit": 10
  }'

# النتيجة المتوقعة: Status 200 + قائمة بالموظفين
```

#### ✅ Test 7.2: Get Employee Details API

```bash
curl -X POST https://qarawi.base.meena.sa/api/method/hrms.hr.api.employee_search_api.get_employee_details \
  -H "Content-Type: application/json" \
  -d '{"employee": "HR-EMP-00001"}'

# النتيجة المتوقعة: كامل بيانات الموظف
```

#### ✅ Test 7.3: Save Location API

```bash
curl -X POST https://qarawi.base.meena.sa/api/method/hrms.hr.doctype.employee_location_log.location_api.save_location \
  -H "Content-Type: application/json" \
  -d '{
    "employee": "HR-EMP-00001",
    "latitude": 24.7136,
    "longitude": 46.6753,
    "accuracy": 15.5
  }'

# النتيجة المتوقعة: {"success": true, "name": "LOC-001"}
```

#### ✅ Test 7.4: Check Radius Alert API

```bash
curl -X POST https://qarawi.base.meena.sa/api/method/hrms.hr.doctype.employee_location_settings.radius_alert_api.check_radius_alert \
  -H "Content-Type: application/json" \
  -d '{
    "employee": "HR-EMP-00001",
    "latitude": 24.7136,
    "longitude": 46.6753
  }'

# النتيجة المتوقعة:
# {
#   "success": true,
#   "alert_enabled": true,
#   "distance": 753.45,
#   "alert_radius": 500,
#   "outside_radius": true
# }
```

#### ✅ Test 7.5: Create Shift API

```bash
curl -X POST https://qarawi.base.meena.sa/api/method/hrms.hr.doctype.shift_assignment.shift_management_api.create_shift \
  -H "Content-Type: application/json" \
  -d '{
    "shift_data": {
      "name": "Test Shift",
      "start_time": "09:00:00",
      "end_time": "17:00:00",
      "enable_auto_attendance": 1,
      "late_entry_grace_period": 15,
      "color": "#3498db"
    }
  }'

# النتيجة المتوقعة: {"success": true}
```

---

## 8️⃣ اختبارات الأداء {#performance-test}

### Test 8.1: سرعة تحميل الصفحات

```javascript
// استخدم Chrome DevTools > Performance tab

Test: تحميل صفحة /employee-search
الهدف: < 2 ثانية
القياس: Time to Interactive (TTI)

Test: تحميل /employee-details/[id]
الهدف: < 3 ثانية (3 API calls)
القياس: Load Complete
```

### Test 8.2: حجم البيانات المنقولة

```javascript
// استخدم Chrome DevTools > Network tab

Test: تحميل قائمة 50 موظف
الهدف: < 500 KB
القياس: Total Size Transferred

Test: تحميل 100 موقع للخريطة
الهدف: < 100 KB
القياس: Response Size
```

### Test 8.3: عدد الطلبات

```javascript
Test: صفحة employee-search
الهدف: < 5 API calls
القياس: عدد XHR requests

Test: صفحة location-tracking (مع 50 موقع)
الهدف: 1 API call فقط لتحميل المواقع
القياس: تجنب N+1 queries
```

---

## 9️⃣ اختبارات الأمان {#security-test}

### Test 9.1: التحقق من الصلاحيات

```
Test: محاولة الوصول إلى /hr-settings كـ Employee
النتيجة المتوقعة: Redirect إلى صفحة الخطأ أو Login

Test: محاولة تعديل بيانات موظف آخر
النتيجة المتوقعة: رسالة "Permission Denied"

Test: محاولة عرض بيانات موظف كـ HR User
النتيجة المتوقعة: نجاح (read-only)

Test: محاولة حذف شفت كـ HR User
النتيجة المتوقعة: فشل (no write permission)
```

### Test 9.2: حماية البيانات الحساسة

```
Test: فحص Network tab أثناء عرض بيانات موظف
✓ لا يتم نقل كلمات المرور
✓ لا يتم نقل أرقام بطاقات الهوية (إن وجدت)
✓ يتم استخدام HTTPS فقط

Test: فحص localStorage/sessionStorage
✓ لا يتم حفظ Tokens بشكل plain text
✓ يتم استخدام httpOnly cookies للـ authentication
```

### Test 9.3: SQL Injection & XSS

```
Test: إدخال SQL في حقل البحث
Input: "'; DROP TABLE Employee; --"
النتيجة المتوقعة: يتم escape الـ input، لا يحدث injection

Test: إدخال XSS في اسم الموظف
Input: "<script>alert('XSS')</script>"
النتيجة المتوقعة: يتم escape، لا يتم تنفيذ الـ script
```

---

## 🔟 اختبار التوافق مع المتصفحات

### Browsers:
- ✅ Chrome (latest)
- ✅ Firefox (latest)
- ✅ Safari (latest)
- ✅ Edge (latest)
- ⚠️ Mobile Safari (iOS)
- ⚠️ Chrome Mobile (Android)

### Features خاصة بالمتصفح:

```
Test: Geolocation API
- Chrome: ✅ يعمل
- Firefox: ✅ يعمل
- Safari: ⚠️ يتطلب HTTPS
- Mobile: ⚠️ يتطلب صلاحيات OS

Test: Background Location Tracking
- Desktop: ⚠️ يتوقف عند إغلاق Tab
- Mobile: ⚠️ يحتاج تطبيق native أو Service Worker
```

---

## 📊 Template لتقرير الاختبار

```markdown
## تقرير اختبار ميزة: [اسم الميزة]

**التاريخ:** [التاريخ]
**المختبِر:** [الاسم]
**البيئة:** Production / Staging / Local

### النتائج:

| Test ID | الوصف | النتيجة | ملاحظات |
|---------|-------|---------|---------|
| 1.1 | تحميل الإعدادات | ✅ نجح | - |
| 1.2 | تعديل إعدادات | ❌ فشل | خطأ 500 |
| 1.3 | ... | ⚠️ جزئي | بطيء |

### الأخطاء المكتشفة:

1. **خطأ 500 عند الحفظ**
   - الخطوات: ...
   - الرسالة: ...
   - Screenshot: [رابط]

2. **بطء في التحميل**
   - الصفحة: /employee-search
   - الوقت: 5.2 ثانية
   - التوصية: إضافة Caching

### التوصيات:

- [ ] إصلاح خطأ 500
- [ ] تحسين الأداء
- [ ] إضافة Validation
```

---

## 🎯 Checklist النهائي

قبل الإطلاق، تأكد من:

### Frontend:
- [ ] جميع الصفحات تُحمّل بدون أخطاء
- [ ] جميع الـ API calls تعمل
- [ ] Loading states تظهر بشكل صحيح
- [ ] Error handling موجود في كل مكان
- [ ] Toast notifications تعمل
- [ ] Responsive design يعمل على الموبايل
- [ ] No console errors في Production

### Backend APIs:
- [ ] جميع الـ APIs تعيد status codes صحيحة
- [ ] Error messages واضحة ومفيدة
- [ ] Permission checks موجودة
- [ ] Data validation موجودة
- [ ] Rate limiting مفعّل (إن أمكن)

### Database:
- [ ] الـ DocTypes مُنشأة بشكل صحيح
- [ ] الـ Indexes موجودة للحقول المستخدمة في البحث
- [ ] Permissions مضبوطة للـ Roles

### Documentation:
- [ ] README.md محدّث
- [ ] API Documentation كاملة
- [ ] User Guide متوفر
- [ ] Testing Guide (هذا الملف) موجود

---

## 📞 الدعم الفني

إذا واجهت أي مشاكل أثناء الاختبار:

1. تحقق من Console للأخطاء
2. تحقق من Network tab للـ API calls الفاشلة
3. راجع ملف التوثيق: `Features and modifications documentation.md`
4. تواصل مع فريق التطوير

---

**تاريخ التحديث:** 9 فبراير 2026
**الإصدار:** 1.0.0
**الحالة:** ✅ جاهز للاستخدام

---

© 2026 HRMS Testing Guide - All rights reserved
