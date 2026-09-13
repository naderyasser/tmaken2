# 📚 دليل توثيق نظام الموارد البشرية - Meena HRMS

## مرحباً! 👋

هذا هو الدليل الشامل لنظام الموارد البشرية (HR) في تطبيق Meena/HRMS. تم تصميم هذا التوثيق لمساعدة المطورين والمستخدمين على فهم بنية النظام والتنقل بين صفحاته وتحسين تجربة المستخدم.

## 🎯 النظام الجديد 🆕

**تم تطوير واجهة أمامية حديثة بتقنية Next.js!**

نظام الموارد البشرية الآن يتكون من:
- 🔧 **Backend (Frappe/ERPNext)**: `http://localhost:8000` - يدير البيانات وال Business Logic
- 🎨 **Frontend (Next.js/React)**: `http://localhost:3000` - واجهة المستخدم الحديثة

للمزيد، راجع:
- [📘 توثيق Next.js Frontend](./hr-management-system-ui/README.md)
- [🔗 دليل التكامل الشامل](./HR_SYSTEM_INTEGRATION_GUIDE.md)

---

## 📑 محتويات التوثيق

### 1. [📖 توثيق الصفحات والمسارات](./HR_PAGES_DOCUMENTATION.md)

**الملف**: `HR_PAGES_DOCUMENTATION.md`

#### 📋 ماذا ستجد في هذا الملف؟
- **نظرة شاملة على جميع صفحات HR Dashboard**
- **المسارات الكاملة (URLs) لكل صفحة**
- **شرح تفصيلي لوظيفة كل صفحة**
- **مكونات البيانات والحقول المطلوبة**
- **الأدوار والصلاحيات المطلوبة**

#### 🎯 مناسب لـ:
- المطورين الذين يريدون فهم بنية النظام
- فريق UX/UI لتصميم تحسينات
- المستخدمين الجدد للتعرف على النظام
- فريق التدريب لإعداد مواد تعليمية

#### 📌 الأقسام الرئيسية:
- صفحات إدارة الموظفين
- صفحات الحضور والانصراف
- صفحات الإجازات
- صفحات الرواتب
- صفحات التوظيف
- صفحات المصروفات
- صفحات التقارير
- صفحات الإعدادات

---

### 2. [🛣️ دليل المسارات والتوجيه](./HR_ROUTING_GUIDE.md)

**الملف**: `HR_ROUTING_GUIDE.md`

#### 📋 ماذا ستجد في هذا الملف؟
- **أنماط المسارات في Frappe**
- **كيفية استخدام Frappe Router API**
- **أمثلة برمجية للتوجيه**
- **نظام Custom Views في Meena**
- **Route Guards وحماية المسارات**
- **Deep Linking والروابط القابلة للمشاركة**

#### 🎯 مناسب لـ:
- المطورين الذين يعملون على التنقل والتوجيه
- من يريد إضافة صفحات مخصصة
- فريق التطوير لفهم Route System
- من يعمل على تكامل External Links

#### 📌 المواضيع الرئيسية:
```javascript
// أمثلة من الملف:

// 1. التوجيه الأساسي
frappe.set_route('List', 'Employee');

// 2. التوجيه مع فلاتر
frappe.route_options = {status: 'Active'};
frappe.set_route('List', 'Employee');

// 3. Custom View Routing
frappe.set_route('List', 'Employee', 'view', 'cards');

// 4. مراقبة تغيير المسارات
frappe.router.on('change', function() {
    console.log('Route:', frappe.get_route());
});
```

---

### 3. [🎨 دليل تدفقات تجربة المستخدم](./HR_UX_FLOW_GUIDE.md)

**الملف**: `HR_UX_FLOW_GUIDE.md`

#### 📋 ماذا ستجد في هذا الملف؟
- **خرائط تدفق كاملة للعمليات الأساسية**
- **رحلة المستخدم خطوة بخطوة**
- **الأوقات المتوقعة لكل عملية**
- **نقاط تحسين UX**
- **Best Practices للواجهات**
- **Benchmark Times للعمليات**

#### 🎯 مناسب لـ:
- مصممي UX/UI
- Product Managers
- فريق التدريب
- Analysts الذين يقيسون الأداء
- فريق Quality Assurance

#### 📌 التدفقات المشمولة:
- ✅ تعيين موظف جديد (Onboarding)
- ✅ البحث عن موظف
- ✅ تسجيل الحضور
- ✅ طلب إجازة والموافقة عليها
- ✅ إنشاء قسائم الرواتب
- ✅ عملية التوظيف الكاملة
- ✅ تقديم مطالبة مصروف
- ✅ تسجيل ساعات العمل
- ✅ إنشاء التقارير

---

## 🗂️ هيكل الملفات في المشروع

```
/home/nader/frappe-bench/
│
├── HR_DASHBOARD_INDEX.md          ← أنت هنا (الفهرس الرئيسي)
├── HR_PAGES_DOCUMENTATION.md      ← توثيق الصفحات
├── HR_ROUTING_GUIDE.md            ← دليل التوجيه
├── HR_UX_FLOW_GUIDE.md            ← تدفقات UX
│
├── apps/
│   ├── base_meena/                ← تخصيصات Meena
│   │   └── base_meena/
│   │       └── public/js/
│   │           ├── hr_dashboard_view.js      ← Dock Navigation
│   │           ├── employee_cards.js         ← Employee Cards
│   │           ├── recruitment_view.js       ← Recruitment Cards
│   │           └── cards_view.js             ← Generic Cards
│   │
│   └── hrms/                      ← نظام HRMS الأساسي
│       └── hrms/
│           ├── hr/
│           │   ├── doctype/       ← تعريفات DocTypes
│           │   ├── page/          ← الصفحات المخصصة
│           │   └── workspace/     ← تكوينات Workspace
│           │
│           └── payroll/
│               └── workspace/     ← Payroll Workspace
│
└── plans/                         ← خطط ومستندات إضافية
```

---

## 🚀 البداية السريعة

### للمطورين الجدد
```bash
# 1. اقرأ نظرة عامة على الصفحات
open HR_PAGES_DOCUMENTATION.md

# 2. تعلم كيفية التوجيه
open HR_ROUTING_GUIDE.md

# 3. افهم تدفقات العمل
open HR_UX_FLOW_GUIDE.md
```

### لمصممي UX
```bash
# 1. ابدأ بفهم التدفقات
open HR_UX_FLOW_GUIDE.md

# 2. راجع الصفحات الموجودة
open HR_PAGES_DOCUMENTATION.md

# 3. خطط للتحسينات
```

### للمستخدمين النهائيين
```bash
# ركز على التدفقات العملية
open HR_UX_FLOW_GUIDE.md

# ثم راجع الصفحات حسب الحاجة
open HR_PAGES_DOCUMENTATION.md
```

---

## 📊 خريطة ذهنية للنظام

```
HR Dashboard (http://localhost:8000/app/hr)
│
├── 👥 الموظفين (Employees)
│   ├── قائمة الموظفين
│   ├── إضافة موظف جديد
│   ├── بطاقات الموظفين
│   └── الهيكل التنظيمي
│
├── 📅 الحضور والانصراف (Attendance)
│   ├── سجل الحضور
│   ├── Check-in/Check-out
│   ├── طلبات الحضور
│   └── إدارة الورديات
│
├── 🏖️ الإجازات (Leaves)
│   ├── طلبات الإجازات
│   ├── تخصيص الإجازات
│   ├── سياسات الإجازات
│   └── رصيد الإجازات
│
├── 💰 الرواتب (Payroll)
│   ├── قسائم الرواتب
│   ├── هياكل الرواتب
│   ├── قيود الرواتب
│   └── التقارير المالية
│
├── 👔 التوظيف (Recruitment)
│   ├── الوظائف الشاغرة
│   ├── المتقدمين
│   ├── المقابلات
│   └── عروض العمل
│
├── 💸 المصروفات (Expenses)
│   ├── مطالبات المصروفات
│   ├── سلف الموظفين
│   └── طلبات السفر
│
├── ⏱️ تتبع الوقت (Time Tracking)
│   ├── Timesheets
│   └── Activity Types
│
└── 📊 التقارير (Reports)
    ├── تقارير الموظفين
    ├── تقارير الحضور
    ├── تقارير الإجازات
    └── تقارير الرواتب
```

---

## 🔍 كيفية استخدام هذا التوثيق

### لإيجاد صفحة معينة
1. افتح `HR_PAGES_DOCUMENTATION.md`
2. استخدم Ctrl+F للبحث عن اسم الصفحة
3. ستجد المسار الكامل والوصف

### لفهم كيفية التنقل برمجياً
1. افتح `HR_ROUTING_GUIDE.md`
2. ابحث عن النمط المطلوب
3. انسخ والصق الكود مع التعديل

### لتحسين تجربة المستخدم
1. افتح `HR_UX_FLOW_GUIDE.md`
2. اختر العملية المراد تحسينها
3. راجع التدفق الحالي
4. حدد نقاط التحسين

---

## 📖 دليل المصطلحات

| المصطلح | المعنى | مثال |
|---------|--------|-------|
| **DocType** | نوع المستند في Frappe | Employee, Leave Application |
| **Workspace** | مساحة العمل - Dashboard وحدة | HR Workspace, Payroll Workspace |
| **Route** | المسار في التطبيق | `/app/employee` |
| **Cards View** | عرض البطاقات المخصص من Meena | Employee Cards |
| **Dock** | الشريط السفلي للتنقل السريع | Meena Dock |
| **Form View** | نموذج تفاصيل سجل واحد | Employee Form |
| **List View** | قائمة السجلات | Employee List |
| **Report** | تقرير البيانات | Monthly Attendance Sheet |

---

## 🎯 حالات الاستخدام الشائعة

### حالة 1: أريد إضافة صفحة جديدة
```
1. راجع HR_PAGES_DOCUMENTATION.md لفهم البنية الحالية
2. راجع HR_ROUTING_GUIDE.md لإضافة المسار الجديد
3. راجع HR_UX_FLOW_GUIDE.md لتصميم التدفق
4. نفذ الصفحة
5. حدّث التوثيق
```

### حالة 2: أريد تحسين عملية موجودة
```
1. راجع HR_UX_FLOW_GUIDE.md للعملية المطلوبة
2. حدد النقاط البطيئة (Bottlenecks)
3. راجع HR_PAGES_DOCUMENTATION.md للصفحات المعنية
4. صمم التحسينات
5. طبق التغييرات
6. قس النتائج
7. حدّث التوثيق
```

### حالة 3: مستخدم جديد يريد فهم النظام
```
1. ابدأ بهذا الملف (INDEX) للنظرة العامة
2. راجع HR_PAGES_DOCUMENTATION.md القسم الذي يهمك
3. راجع HR_UX_FLOW_GUIDE.md للعمليات التي ستنفذها
4. جرب النظام عملياً
```

---

## 📊 إحصائيات التوثيق

| المقياس | القيمة |
|---------|--------|
| عدد الصفحات الموثقة | 100+ صفحة |
| عدد المسارات | 150+ مسار |
| عدد التدفقات | 15 تدفق رئيسي |
| عدد أمثلة الكود | 50+ مثال |
| عدد الجداول | 20+ جدول |
| حجم التوثيق | ~4000 سطر |

---

## 🔄 التحديثات والصيانة

### آخر تحديث
**التاريخ**: 7 فبراير 2026  
**الإصدار**: 1.0  
**المطور**: Meena Base App Team

### خطة التحديثات المستقبلية
- [ ] إضافة رسوم توضيحية (Screenshots)
- [ ] إضافة فيديوهات تعليمية
- [ ] توثيق APIs
- [ ] إضافة أمثلة Integration
- [ ] توثيق Mobile App (عند التوفر)
- [ ] Multi-language Support
- [ ] Interactive Documentation
- [ ] Performance Metrics

---

## 🤝 المساهمة في التوثيق

### كيف تساهم؟
1. **للمطورين**:
   - عند إضافة صفحة جديدة، حدّث `HR_PAGES_DOCUMENTATION.md`
   - عند تغيير مسار، حدّث `HR_ROUTING_GUIDE.md`
   - عند تحسين عملية، حدّث `HR_UX_FLOW_GUIDE.md`

2. **لفريق UX**:
   - أضف ملاحظات UX في `HR_UX_FLOW_GUIDE.md`
   - وثق التحسينات المقترحة
   - شارك نتائج اختبارات المستخدمين

3. **للمستخدمين**:
   - أبلغ عن صفحات مفقودة أو غير واضحة
   - شارك حالات الاستخدام الخاصة بك
   - اقترح تحسينات

### معايير التوثيق
```markdown
✅ استخدم عناوين واضحة
✅ أضف أمثلة عملية
✅ وثق URLs كاملة
✅ أضف أوقات متوقعة
✅ استخدم جداول منظمة
✅ أضف screenshots عند الممكن
✅ اشرح المصطلحات الفنية
✅ حافظ على التنسيق الموحد
```

---

## 📞 الدعم والمساعدة

### للأسئلة التقنية
```bash
# راجع الملفات التقنية
- TECHNICAL.md
- DEVELOPMENT.md
- README.md
```

### لمشاكل الاستخدام
```bash
# راجع أدلة المستخدم
- USER_GUIDE.md
- MANUAL_TESTING_GUIDE.md
- HR_UX_FLOW_GUIDE.md
```

### للإبلاغ عن مشاكل
1. تأكد من مراجعة التوثيق أولاً
2. ابحث في Issues الموجودة
3. أنشئ Issue جديد مع:
   - وصف المشكلة
   - الصفحة/المسار المعني
   - خطوات إعادة الإنتاج
   - Screenshots (إن وجدت)

---

## 🎓 الموارد الإضافية

### الوثائق الرسمية
- [Frappe Framework Documentation](https://frappeframework.com/docs)
- [ERPNext Documentation](https://docs.erpnext.com)
- [HRMS Documentation](https://docs.erpnext.com/docs/user/manual/en/human-resources)

### الفيديوهات التعليمية
- Frappe School
- ERPNext YouTube Channel
- Community Tutorials

### المجتمع
- Frappe Forum
- Discord Channel
- GitHub Discussions

---

## 📋 Checklist للمطورين

عند العمل على نظام HR، تأكد من:

- [ ] قراءة هذا الفهرس (INDEX)
- [ ] مراجعة الصفحات ذات الصلة في `HR_PAGES_DOCUMENTATION.md`
- [ ] فهم نظام التوجيه من `HR_ROUTING_GUIDE.md`
- [ ] مراجعة التدفقات في `HR_UX_FLOW_GUIDE.md`
- [ ] اختبار المسارات الجديدة
- [ ] التأكد من الصلاحيات المناسبة
- [ ] اختبار على Mobile (عند الممكن)
- [ ] تحديث التوثيق
- [ ] إضافة Unit Tests
- [ ] مراجعة Performance

---

## 🎉 الخلاصة

هذا التوثيق مصمم ليكون:
- ✅ **شامل**: يغطي جميع جوانب نظام HR
- ✅ **عملي**: أمثلة وأكواد جاهزة للاستخدام
- ✅ **واضح**: شروحات بسيطة وسهلة الفهم
- ✅ **محدّث**: يعكس آخر التطورات في النظام
- ✅ **تفاعلي**: روابط سريعة وتنقل سهل

نأمل أن يساعدك هذا التوثيق في:
- 🎯 فهم بنية نظام HR بسرعة
- 🚀 تطوير ميزات جديدة بكفاءة
- 💡 تحسين تجربة المستخدم
- 🤝 التعاون مع الفريق بفعالية

---

## 📚 الملفات المرجعية السريعة

| **ما تريد معرفته** | **الملف المناسب** | **الوقت المتوقع** |
|---------------------|-------------------|-------------------|
| "ما هي الصفحات المتاحة؟" | `HR_PAGES_DOCUMENTATION.md` | 10-15 دقيقة |
| "كيف أنتقل بين الصفحات برمجياً؟" | `HR_ROUTING_GUIDE.md` | 15-20 دقيقة |
| "كيف تتم عملية معينة؟" | `HR_UX_FLOW_GUIDE.md` | 5-10 دقائق |
| "نظرة عامة على النظام" | `HR_DASHBOARD_INDEX.md` (هذا الملف) | 5 دقائق |
| "مسار محدد بسرعة" | استخدم Ctrl+F في الملفات | 1 دقيقة |
| "توثيق Next.js Frontend" | `hr-management-system-ui/README.md` | 20-30 دقيقة |
| "كيف يتكامل Frontend مع Backend؟" | `HR_SYSTEM_INTEGRATION_GUIDE.md` | 30-45 دقيقة |

---

## 🆕 التوثيق الجديد - Next.js Frontend

### 4. [📘 توثيق Next.js Frontend](./hr-management-system-ui/README.md)

**الملف**: `hr-management-system-ui/README.md`

#### 📋 ماذا ستجد في هذا الملف؟
- **نظرة عامة على مشروع Next.js**
- **البنية التقنية والتقنيات المستخدمة**
- **هيكل المجلدات والملفات**
- **المكونات الرئيسية (Components)**
- **نظام التصميم (Design System)**
- **الصفحات والمسارات**
- **التكامل مع Frappe Backend**
- **حالة المشروع الحالية**
- **مكونات UI المتاحة (50+ component)**
- **أمثلة الاستخدام**

#### 🎯 مناسب لـ:
- مطوري Frontend الذين يعملون على Next.js
- مطوري React/TypeScript
- مصممي UI/UX
- فريق التطوير لفهم البنية الحديثة

#### 📌 الأقسام الرئيسية:
- إعداد المشروع
- المكونات (Header, Sidebar, Dashboard, etc.)
- نظام التصميم (Colors, Typography, Spacing)
- التوثيق التقني
- Best Practices

---

### 5. [🔗 دليل التكامل الشامل](./HR_SYSTEM_INTEGRATION_GUIDE.md)

**الملف**: `HR_SYSTEM_INTEGRATION_GUIDE.md`

#### 📋 ماذا ستجد في هذا الملف؟
- **نظرة عامة على Architecture**
- **مقارنة بين Frappe UI و Next.js UI**
- **ربط المكونات بـ DocTypes**
- **Authentication & Authorization**
- **Module Navigation Mapping**
- **أمثلة Data Flow كاملة**
- **إعداد البيئة المحلية**
- **العمليات الشائعة والـ API Calls**
- **UI Components Mapping**
- **State Management**
- **خطة الانتقال (Migration Plan)**
- **مثال تطبيقي كامل: صفحة الموظفين**

#### 🎯 مناسب لـ:
- جميع أعضاء الفريق
- مطوري Backend و Frontend
- Full Stack Developers
- Solution Architects
- Project Managers

#### 📌 الأقسام الرئيسية:
- Architecture Overview
- Component ↔ DocType Mapping
- Authentication Flow
- API Integration Examples
- Environment Setup
- Migration Plan
- Complete Application Examples

---

## 🔄 تدفق العمل (Workflow)

### للمطورين الجدد على المشروع:
1. ابدأ بقراءة [HR_DASHBOARD_INDEX.md](./HR_DASHBOARD_INDEX.md) (هذا الملف) - 5 دقائق
2. راجع [HR_SYSTEM_INTEGRATION_GUIDE.md](./HR_SYSTEM_INTEGRATION_GUIDE.md) - 30 دقيقة
3. حسب تخصصك:
   - **Backend Developer**: راجع [HR_PAGES_DOCUMENTATION.md](./HR_PAGES_DOCUMENTATION.md)
   - **Frontend Developer**: راجع [hr-management-system-ui/README.md](./hr-management-system-ui/README.md)
   - **Full Stack Developer**: راجع كل الملفات

### للمطورين الحاليين:
- استخدم الملف المناسب حسب مهمتك
- راجع [HR_SYSTEM_INTEGRATION_GUIDE.md](./HR_SYSTEM_INTEGRATION_GUIDE.md) للتكامل بين النظامين
- استخدم أمثلة الكود الموجودة في التوثيق

### لفريق UX/UI:
1. راجع [HR_UX_FLOW_GUIDE.md](./HR_UX_FLOW_GUIDE.md) للتدفقات الحالية
2. راجع [hr-management-system-ui/README.md](./hr-management-system-ui/README.md) لنظام التصميم
3. استخدم Component Library الموجود في Next.js

---

## 🎨 الفروقات بين النظامين

### النظام القديم (Frappe UI)
- **التقنية**: Jinja Templates + Frappe JS + Bootstrap
- **التوجيه**: Server-side rendering
- **المسارات**: `/app/employee`, `/app/attendance`
- **التفاعل**: jQuery + Frappe Framework
- **التوثيق**: `HR_PAGES_DOCUMENTATION.md`, `HR_ROUTING_GUIDE.md`

### النظام الجديد (Next.js UI) 🆕
- **التقنية**: Next.js 16 + React 19 + TypeScript + Tailwind
- **التوجيه**: Client-side module switching
- **المسارات**: Module-based navigation (no URL changes)
- **التفاعل**: React Hooks + Modern JavaScript
- **التوثيق**: `hr-management-system-ui/README.md`, `HR_SYSTEM_INTEGRATION_GUIDE.md`

---

## 🌟 نصيحة أخيرة

> "أفضل توثيق هو الذي يُستخدم. لا تتردد في العودة إلى هذه الملفات كلما احتجت. والأهم من ذلك، ساهم في تحديثها وتحسينها!"

---

**تم إعداد هذا التوثيق بـ ❤️ من فريق Meena Base App**

**Happy Coding! 🚀**
