# دليل صفحات نظام الموارد البشرية (HR) - توثيق شامل

## 📋 نظرة عامة
هذا الدليل يوفر شرحاً تفصيلياً لجميع الصفحات والمسارات المرتبطة بنظام الموارد البشرية (HR) في تطبيق Meena/HRMS.

---

## 🏠 الصفحة الرئيسية للموارد البشرية

### 🔗 المسار الأساسي
```
http://localhost:8000/app/hr
```

### 📝 الوصف
- **الصفحة الرئيسية (Dashboard)**: تعرض لوحة قيادة شاملة لنظام الموارد البشرية
- **الموقع في الكود**: 
  - Workspace Configuration: `/apps/hrms/hrms/hr/workspace/hr/hr.json`
  - Dashboard View: `/apps/base_meena/base_meena/public/js/hr_dashboard_view.js`

### 🎨 مكونات Dashboard الرئيسية
1. **Shortcuts (اختصارات سريعة)**
   - الموظفين (Employee)
   - HR Dashboard
   - Payroll Dashboard

2. **Cards (بطاقات المعلومات)**
   - Setup (الإعدادات)
   - Employee (الموظفين)
   - Leaves (الإجازات)
   - Settings (الإعدادات)
   - Attendance (الحضور)
   - Expense Claim (المصروفات)
   - Key Reports (التقارير الرئيسية)
   - Other Reports (تقارير أخرى)

---

## 👥 صفحات إدارة الموظفين

### 1. صفحة قائمة الموظفين (Employee List)

#### 🔗 المسارات
```javascript
// List View (التقليدية)
http://localhost:8000/app/employee

// Cards View (عرض البطاقات - Meena)
http://localhost:8000/app/List/Employee/view/cards
```

#### 📝 الوصف
- **الغرض**: عرض وإدارة جميع الموظفين في النظام
- **أنواع العرض**:
  - **List View**: العرض التقليدي كجدول
  - **Cards View**: عرض البطاقات الحديث (مخصص من Meena)
  - **Report View**: عرض التقارير
  - **Dashboard**: لوحة بيانات الموظفين

#### 🎯 الوظائف المتاحة
- إضافة موظف جديد
- تعديل بيانات الموظفين
- البحث والتصفية
- تصدير البيانات
- عرض سجل الموظف الكامل

#### 📂 الملفات ذات الصلة
```
/apps/hrms/hrms/hr/doctype/employee/
├── employee.py
├── employee.js
├── employee.json
└── employee_list.js
```

---

### 2. صفحة نموذج الموظف (Employee Form)

#### 🔗 المسار
```javascript
// موظف جديد
http://localhost:8000/app/employee/new-employee-1

// موظف موجود
http://localhost:8000/app/employee/[employee_id]
```

#### 📋 أقسام النموذج
1. **البيانات الأساسية**
   - الاسم الكامل
   - رقم الموظف
   - تاريخ الميلاد
   - الجنس

2. **البيانات الوظيفية**
   - القسم (Department)
   - المسمى الوظيفي (Designation)
   - الفرع (Branch)
   - الدرجة الوظيفية (Grade)
   - تاريخ الالتحاق

3. **معلومات الحضور والإجازات**
   - نوع الإجازة الافتراضي
   - قائمة العطلات
   - نوع الورديات

4. **الراتب والحساب البنكي**
   - رقم الحساب البنكي
   - اسم البنك
   - هيكل الراتب

5. **معلومات الاتصال**
   - رقم الهاتف
   - البريد الإلكتروني
   - العنوان

---

## 📊 صفحات الحضور والانصراف

### 1. صفحة سجل الحضور (Attendance)

#### 🔗 المسارات
```javascript
// List View
http://localhost:8000/app/attendance

// Cards View
http://localhost:8000/app/List/Attendance/view/cards
```

#### 📝 الوصف
- **الغرض**: تسجيل وإدارة حضور وانصراف الموظفين
- **البيانات المسجلة**:
  - تاريخ الحضور
  - حالة الحضور (Present/Absent/Half Day)
  - وقت الدخول والخروج
  - ساعات العمل

#### 🔗 صفحات ذات صلة
```javascript
// Check-in/Check-out
http://localhost:8000/app/employee-checkin

// Attendance Request
http://localhost:8000/app/attendance-request

// Employee Attendance Tool
http://localhost:8000/app/employee-attendance-tool

// Upload Attendance
http://localhost:8000/app/upload-attendance
```

---

### 2. صفحة الورديات (Shift Management)

#### 🔗 المسار الرئيسي
```
http://localhost:8000/app/shift-&-attendance
```

#### 📋 الصفحات الفرعية
```javascript
// Shift Type
http://localhost:8000/app/shift-type

// Shift Request
http://localhost:8000/app/shift-request

// Shift Assignment
http://localhost:8000/app/shift-assignment

// Roster (الجدول الزمني)
http://localhost:8000/app/roster
```

---

## 🏖️ صفحات الإجازات

### 1. Workspace الإجازات (Leaves Workspace)

#### 🔗 المسار الأساسي
```
http://localhost:8000/app/leaves
```

#### 📋 مكونات Workspace
- **Shortcuts**:
  - Leave Application (طلب إجازة)
  - Leave Allocation (تخصيص إجازة)

- **Cards**:
  - Setup (الإعدادات)
  - Allocation (التخصيص)
  - Application (الطلبات)
  - Reports (التقارير)

---

### 2. صفحة طلبات الإجازات (Leave Applications)

#### 🔗 المسارات
```javascript
// List View
http://localhost:8000/app/leave-application

// Cards View
http://localhost:8000/app/List/Leave%20Application/view/cards
```

#### 📝 الوصف
- **الغرض**: إدارة طلبات الإجازات
- **حالات الطلب**:
  - Draft (مسودة)
  - Approved (موافق عليه)
  - Rejected (مرفوض)
  - Cancelled (ملغي)

#### 📋 بيانات طلب الإجازة
- نوع الإجازة (Leave Type)
- تاريخ البداية والنهاية
- عدد الأيام
- السبب
- المدير المباشر للموافقة

---

### 3. صفحات إعدادات الإجازات

#### 🔗 المسارات
```javascript
// Leave Type (أنواع الإجازات)
http://localhost:8000/app/leave-type

// Leave Period (فترة الإجازات)
http://localhost:8000/app/leave-period

// Leave Policy (سياسة الإجازات)
http://localhost:8000/app/leave-policy

// Leave Block List (قائمة حظر الإجازات)
http://localhost:8000/app/leave-block-list

// Holiday List (قائمة العطلات)
http://localhost:8000/app/holiday-list

// Leave Allocation (تخصيص الإجازات)
http://localhost:8000/app/leave-allocation

// Compensatory Leave Request (طلب إجازة تعويضية)
http://localhost:8000/app/compensatory-leave-request
```

---

## 💰 صفحات الرواتب (Payroll)

### 1. Workspace الرواتب

#### 🔗 المسار الأساسي
```
http://localhost:8000/app/payroll
```

#### 📊 Dashboard Components
- **Chart**: Outgoing Salary (الرواتب الصادرة)
- **Shortcuts**:
  - Salary Slip (قسيمة راتب)
  - Payroll Entry (قيد رواتب)
  - Salary Register (سجل الرواتب)

---

### 2. صفحة قسائم الرواتب (Salary Slips)

#### 🔗 المسارات
```javascript
// List View
http://localhost:8000/app/salary-slip

// Cards View
http://localhost:8000/app/List/Salary%20Slip/view/cards
```

#### 📋 محتويات قسيمة الراتب
1. **معلومات أساسية**
   - الموظف
   - الشهر
   - السنة
   - رقم القسيمة

2. **المكاسب (Earnings)**
   - الراتب الأساسي
   - البدلات
   - الحوافز

3. **الخصومات (Deductions)**
   - التأمينات
   - القروض
   - الغياب

4. **الإجمالي**
   - إجمالي المكاسب
   - إجمالي الخصومات
   - صافي الراتب

---

### 3. صفحات إعدادات الرواتب

#### 🔗 المسارات
```javascript
// Salary Component (مكونات الراتب)
http://localhost:8000/app/salary-component

// Salary Structure (هيكل الراتب)
http://localhost:8000/app/salary-structure

// Salary Structure Assignment
http://localhost:8000/app/salary-structure-assignment

// Payroll Period (فترة الرواتب)
http://localhost:8000/app/payroll-period

// Payroll Entry (قيد الرواتب الشهري)
http://localhost:8000/app/payroll-entry

// Income Tax Slab (شرائح ضريبة الدخل)
http://localhost:8000/app/income-tax-slab

// Additional Salary (راتب إضافي)
http://localhost:8000/app/additional-salary

// Employee Incentive (حافز موظف)
http://localhost:8000/app/employee-incentive

// Retention Bonus (مكافأة الاحتفاظ)
http://localhost:8000/app/retention-bonus
```

---

## 👔 صفحات التوظيف (Recruitment)

### 1. Workspace التوظيف

#### 🔗 المسار الأساسي
```
http://localhost:8000/app/recruitment
```

#### 📊 Dashboard Features
- **Chart**: Department Wise Openings
- **Quick List**: Interviews (This Week)

---

### 2. صفحة المتقدمين (Job Applicants)

#### 🔗 المسارات
```javascript
// List View
http://localhost:8000/app/job-applicant

// Cards View (Meena Custom)
http://localhost:8000/app/List/Job%20Applicant/view/cards
```

#### 📝 الوصف
- **الغرض**: إدارة المتقدمين للوظائف
- **حالات المتقدم**:
  - Open (جديد)
  - Replied (تم الرد)
  - Hold (معلق)
  - Accepted (مقبول)
  - Rejected (مرفوض)

#### 🎯 العمليات المتاحة
- إضافة متقدم جديد
- تحديد موعد مقابلة
- تقييم المتقدم
- إرسال عرض عمل
- رفض أو قبول المتقدم

#### 📂 الملفات المخصصة (Meena)
```
/apps/base_meena/base_meena/public/js/recruitment_view.js
```

---

### 3. صفحات عملية التوظيف

#### 🔗 المسارات
```javascript
// Staffing Plan (خطة التوظيف)
http://localhost:8000/app/staffing-plan

// Job Requisition (طلب توظيف)
http://localhost:8000/app/job-requisition

// Job Opening (الوظائف الشاغرة)
http://localhost:8000/app/job-opening

// Job Applicant Source (مصدر المتقدم)
http://localhost:8000/app/job-applicant-source

// Job Offer (عرض العمل)
http://localhost:8000/app/job-offer
```

---

### 4. صفحات المقابلات

#### 🔗 المسارات
```javascript
// Interview Type (نوع المقابلة)
http://localhost:8000/app/interview-type

// Interview Round (جولة المقابلة)
http://localhost:8000/app/interview-round

// Interview (المقابلة)
http://localhost:8000/app/interview

// Interview Feedback (تقييم المقابلة)
http://localhost:8000/app/interview-feedback
```

---

### 5. صفحات التعيين

#### 🔗 المسارات
```javascript
// Appointment Letter Template (نموذج خطاب التعيين)
http://localhost:8000/app/appointment-letter-template

// Appointment Letter (خطاب التعيين)
http://localhost:8000/app/appointment-letter
```

---

## 💸 صفحات المصروفات (Expenses)

### 1. Workspace المصروفات

#### 🔗 المسار الأساسي
```
http://localhost:8000/app/expenses
```

#### 📊 Dashboard Features
- **Chart**: Expense Claims (مطالبات المصروفات)

---

### 2. صفحة مطالبات المصروفات

#### 🔗 المسارات
```javascript
// List View
http://localhost:8000/app/expense-claim

// Cards View
http://localhost:8000/app/List/Expense%20Claim/view/cards
```

#### 📋 بيانات المطالبة
- الموظف
- نوع المصروف
- المبلغ
- التاريخ
- المستندات المرفقة
- حالة الموافقة

---

### 3. صفحات السلف والمصروفات

#### 🔗 المسارات
```javascript
// Expense Claim Type (نوع المصروف)
http://localhost:8000/app/expense-claim-type

// Employee Advance (سلفة موظف)
http://localhost:8000/app/employee-advance

// Travel Request (طلب سفر)
http://localhost:8000/app/travel-request

// Purpose of Travel (غرض السفر)
http://localhost:8000/app/purpose-of-travel
```

---

## 📈 صفحات الأداء (Performance)

### 1. Workspace الأداء

#### 🔗 المسار الأساسي
```
http://localhost:8000/app/performance
```

---

### 2. صفحات تقييم الأداء

#### 🔗 المسارات
```javascript
// Appraisal (التقييم السنوي)
http://localhost:8000/app/appraisal

// Appraisal Template (نموذج التقييم)
http://localhost:8000/app/appraisal-template

// Goal (الهدف)
http://localhost:8000/app/goal

// Energy Point Rule (قاعدة نقاط الطاقة)
http://localhost:8000/app/energy-point-rule

// Energy Point Log (سجل نقاط الطاقة)
http://localhost:8000/app/energy-point-log
```

---

## ⏱️ صفحات تتبع الوقت

### 1. صفحة Timesheet

#### 🔗 المسارات
```javascript
// List View
http://localhost:8000/app/timesheet

// Cards View
http://localhost:8000/app/List/Timesheet/view/cards
```

#### 📝 الوصف
- **الغرض**: تسجيل ساعات العمل على المشاريع والمهام
- **البيانات المسجلة**:
  - الموظف
  - التاريخ
  - المشروع/المهمة
  - النشاط
  - ساعات العمل
  - القابلية للفوترة

---

### 2. صفحات ذات صلة

#### 🔗 المسارات
```javascript
// Activity Type (نوع النشاط)
http://localhost:8000/app/activity-type

// Activity Cost (تكلفة النشاط)
http://localhost:8000/app/activity-cost
```

---

## 🏢 صفحات البيانات الرئيسية (Masters)

### 1. الهيكل التنظيمي

#### 🔗 المسارات
```javascript
// Department (القسم)
http://localhost:8000/app/department

// Designation (المسمى الوظيفي)
http://localhost:8000/app/designation

// Branch (الفرع)
http://localhost:8000/app/branch

// Employment Type (نوع التوظيف)
http://localhost:8000/app/employment-type

// Employee Grade (الدرجة الوظيفية)
http://localhost:8000/app/employee-grade

// Employee Group (مجموعة الموظفين)
http://localhost:8000/app/employee-group
```

---

### 2. صفحة الهيكل التنظيمي المرئي

#### 🔗 المسار
```
http://localhost:8000/app/organizational-chart
```

#### 📝 الوصف
- **الغرض**: عرض الهيكل التنظيمي بشكل شجري مرئي
- **المزايا**:
  - عرض تسلسل القيادة
  - عرض المرؤوسين المباشرين
  - التنقل بين المستويات
  - معلومات سريعة عن كل موظف

#### 📂 الملفات
```
/apps/hrms/hrms/hr/page/organizational_chart/
├── organizational_chart.py
├── organizational_chart.js
└── organizational_chart.json
```

---

## 🗺️ صفحات إضافية

### 1. خريطة مواقع الموظفين

#### 🔗 المسار
```
http://localhost:8000/app/employee-location-map
```

#### 📝 الوصف
- عرض مواقع الموظفين على الخريطة
- تتبع الموظفين الميدانيين
- معلومات الموقع في الوقت الفعلي

---

### 2. تحديثات الفريق

#### 🔗 المسار
```
http://localhost:8000/app/team-updates
```

#### 📝 الوصف
- عرض تحديثات العمل اليومية
- ملخصات العمل
- تواصل الفريق

---

## 📊 صفحات التقارير

### 1. التقارير الرئيسية (Key Reports)

#### 🔗 المسارات
```javascript
// Monthly Attendance Sheet
http://localhost:8000/app/query-report/Monthly%20Attendance%20Sheet

// Recruitment Analytics
http://localhost:8000/app/query-report/Recruitment%20Analytics

// Employee Analytics
http://localhost:8000/app/query-report/Employee%20Analytics

// Employee Leave Balance
http://localhost:8000/app/query-report/Employee%20Leave%20Balance

// Employee Leave Balance Summary
http://localhost:8000/app/query-report/Employee%20Leave%20Balance%20Summary

// Employee Advance Summary
http://localhost:8000/app/query-report/Employee%20Advance%20Summary

// Employee Exits
http://localhost:8000/app/query-report/Employee%20Exits
```

---

### 2. تقارير أخرى

#### 🔗 المسارات
```javascript
// Employee Information
http://localhost:8000/app/query-report/Employee%20Information

// Employee Birthday
http://localhost:8000/app/query-report/Employee%20Birthday

// Employees Working on a Holiday
http://localhost:8000/app/query-report/Employees%20working%20on%20a%20holiday

// Daily Work Summary Replies
http://localhost:8000/app/query-report/Daily%20Work%20Summary%20Replies

// Shift Attendance
http://localhost:8000/app/query-report/Shift%20Attendance

// Employee Hours Utilization Based On Timesheet
http://localhost:8000/app/query-report/Employee%20Hours%20Utilization%20Based%20On%20Timesheet
```

---

### 3. تقارير الرواتب

#### 🔗 المسارات
```javascript
// Salary Register
http://localhost:8000/app/query-report/Salary%20Register

// Bank Remittance
http://localhost:8000/app/query-report/Bank%20Remittance

// Salary Payments Based On Payment Mode
http://localhost:8000/app/query-report/Salary%20Payments%20Based%20On%20Payment%20Mode

// Salary Payments via ECS
http://localhost:8000/app/query-report/Salary%20Payments%20via%20ECS

// Income Tax Deductions
http://localhost:8000/app/query-report/Income%20Tax%20Deductions

// Professional Tax Deductions
http://localhost:8000/app/query-report/Professional%20Tax%20Deductions

// Provident Fund Deductions
http://localhost:8000/app/query-report/Provident%20Fund%20Deductions
```

---

### 4. تقارير المصروفات

#### 🔗 المسارات
```javascript
// Unpaid Expense Claim
http://localhost:8000/app/query-report/Unpaid%20Expense%20Claim

// Department Wise Expense Claims
Chart: http://localhost:8000/app/chart/Department%20Wise%20Expense%20Claims
```

---

## ⚙️ صفحات الإعدادات

### 1. إعدادات HR الأساسية

#### 🔗 المسارات
```javascript
// HR Settings (الإعدادات الرئيسية)
http://localhost:8000/app/hr-settings

// Daily Work Summary Group
http://localhost:8000/app/daily-work-summary-group

// Employee Referral (إحالة الموظف)
http://localhost:8000/app/employee-referral

// Employee Skill Map (خريطة مهارات الموظف)
http://localhost:8000/app/employee-skill-map

// Skill (المهارة)
http://localhost:8000/app/skill
```

---

### 2. إعدادات النظام المتقدمة

#### 🔗 المسارات
```javascript
// DocType Customizations
http://localhost:8000/app/customize-form

// Workflow Settings
http://localhost:8000/app/workflow

// Email Templates
http://localhost:8000/app/email-template

// Print Formats
http://localhost:8000/app/print-format
```

---

## 🎯 مكونات Meena Dock في HR Dashboard

### 📋 قائمة الموارد البشرية في Dock

عند الضغط على أيقونة "الموارد البشرية" في Meena Dock، تظهر القائمة التالية:

```javascript
{
  id: 'hr',
  label: 'الموارد البشرية',
  menuItems: [
    { 
      label: 'لوحة القيادة', 
      route: 'app/hr' 
    },
    { 
      label: 'الموظفين', 
      route: 'List/Employee/view/cards' 
    },
    { 
      label: 'التوظيف', 
      route: 'List/Job Applicant/view/cards' 
    },
    { 
      label: 'الحضور', 
      route: 'List/Attendance/view/cards' 
    },
    { 
      label: 'الإجازات', 
      route: 'List/Leave Application/view/cards' 
    },
    { 
      label: 'الرواتب', 
      route: 'List/Salary Slip/view/cards' 
    },
    { 
      label: 'المصروفات', 
      route: 'List/Expense Claim/view/cards' 
    }
  ]
}
```

---

## 🔄 تدفق العمل (Workflow) - أمثلة

### 1. تدفق التوظيف

```
Job Opening → Job Applicant → Interview → Job Offer → Employee
```

**المسارات خطوة بخطوة:**
```javascript
1. إنشاء وظيفة شاغرة:
   http://localhost:8000/app/job-opening/new

2. استلام طلبات التوظيف:
   http://localhost:8000/app/job-applicant

3. جدولة مقابلة:
   http://localhost:8000/app/interview/new

4. إرسال عرض عمل:
   http://localhost:8000/app/job-offer/new

5. إنشاء سجل موظف:
   http://localhost:8000/app/employee/new
```

---

### 2. تدفق الإجازات

```
Leave Application → Approval → Leave Allocation Update
```

**المسارات خطوة بخطوة:**
```javascript
1. طلب إجازة جديد:
   http://localhost:8000/app/leave-application/new

2. الموافقة من المدير:
   (يتم من خلال Dashboard أو Email)

3. تحديث رصيد الإجازات:
   (تلقائي في النظام)

4. مراجعة التقرير:
   http://localhost:8000/app/query-report/Employee%20Leave%20Balance
```

---

### 3. تدفق الرواتب الشهري

```
Salary Structure → Payroll Entry → Salary Slip → Payment
```

**المسارات خطوة بخطوة:**
```javascript
1. إعداد هيكل الراتب للموظف:
   http://localhost:8000/app/salary-structure-assignment

2. إنشاء قيد رواتب شهري:
   http://localhost:8000/app/payroll-entry/new

3. مراجعة قسائم الرواتب:
   http://localhost:8000/app/salary-slip

4. تسجيل الدفع:
   http://localhost:8000/app/payment-entry
```

---

## 🎨 تخصيصات Meena (Custom Views)

### 1. Cards View (عرض البطاقات)

#### 📝 الوصف
تخصيص Meena يوفر عرض بطاقات حديث وجذاب لجميع القوائم

#### 📂 الملف الرئيسي
```
/apps/base_meena/base_meena/public/js/cards_view.js
```

#### 🔗 كيفية الوصول
إضافة `/view/cards` إلى نهاية أي مسار قائمة:
```
http://localhost:8000/app/List/[DocType]/view/cards
```

---

### 2. Employee Cards (بطاقات الموظفين)

#### 📂 الملف المخصص
```
/apps/base_meena/base_meena/public/js/employee_cards.js
```

#### 🎯 المزايا
- تصميم بطاقات حديث
- معلومات سريعة عن الموظف
- صورة الموظف
- بيانات الاتصال
- القسم والمسمى الوظيفي

---

### 3. Recruitment View (عرض التوظيف)

#### 📂 الملف المخصص
```
/apps/base_meena/base_meena/public/js/recruitment_view.js
```

#### 🎯 المزايا
- لوحة Kanban للمتقدمين
- تصنيف حسب الحالة
- Drag & Drop لتغيير الحالة
- معلومات سريعة عن المتقدم

---

## 📱 التصميم المتجاوب (Responsive Design)

### Desktop View
- عرض Dock السفلي
- قوائم منبثقة لكل وحدة
- اختصارات سريعة

### Mobile View
- إخفاء Dock تلقائياً
- التركيز على العرض التقليدي
- قائمة جانبية للتنقل

---

## 🔐 الصلاحيات (Permissions)

### أدوار النظام (System Roles)

```javascript
// HR Manager (مدير الموارد البشرية)
- الوصول الكامل لجميع الصفحات
- الموافقة على الطلبات
- إعداد التقارير

// HR User (موظف الموارد البشرية)
- إدارة الموظفين
- معالجة الطلبات
- عرض التقارير

// Employee (الموظف)
- عرض البيانات الشخصية
- تقديم الطلبات (إجازات، مصروفات)
- عرض قسائم الراتب
```

---

## 🛠️ ملفات التكوين الرئيسية

### 1. Workspace Configurations
```
/apps/hrms/hrms/hr/workspace/
├── hr/hr.json
├── recruitment/recruitment.json
├── leaves/leaves.json
├── shift_&_attendance/shift_&_attendance.json
├── expenses/expenses.json
├── performance/performance.json
└── tenure/tenure.json

/apps/hrms/hrms/payroll/workspace/
├── payroll/payroll.json
└── tax_&_benefits/tax_&_benefits.json
```

---

### 2. Meena Custom Files
```
/apps/base_meena/base_meena/public/js/
├── hr_dashboard_view.js     (Dock Navigation)
├── employee_cards.js         (Employee Cards View)
├── recruitment_view.js       (Recruitment Cards)
├── cards_view.js             (Generic Cards View)
├── frappe_dashboard_integration.js
└── meena_dashboard_manager.js
```

---

### 3. Page Definitions
```
/apps/hrms/hrms/hr/page/
├── organizational_chart/
│   ├── organizational_chart.py
│   ├── organizational_chart.js
│   └── organizational_chart.json
├── employee_location_map/
│   ├── employee_location_map.py
│   ├── employee_location_map.js
│   └── employee_location_map.json
└── team_updates/
    ├── team_updates.py
    ├── team_updates.js
    └── team_updates.json
```

---

## 📖 أمثلة على المسارات الكاملة

### مسارات الموظف "أحمد محمد"

```javascript
// الملف الشخصي
http://localhost:8000/app/employee/HR-EMP-00001

// سجل الحضور
http://localhost:8000/app/attendance?employee=HR-EMP-00001

// طلبات الإجازات
http://localhost:8000/app/leave-application?employee=HR-EMP-00001

// قسائم الراتب
http://localhost:8000/app/salary-slip?employee=HR-EMP-00001

// المصروفات
http://localhost:8000/app/expense-claim?employee=HR-EMP-00001

// Timesheet
http://localhost:8000/app/timesheet?employee=HR-EMP-00001
```

---

## 🎓 نصائح لتحسين UX

### 1. التنقل السريع
- استخدم Meena Dock للوصول السريع
- احفظ التقارير المفضلة كـ Shortcuts
- استخدم البحث الشامل (Ctrl+K)

### 2. التخصيص
- خصص Dashboard حسب دورك
- أضف الحقول المطلوبة
- أنشئ تقارير مخصصة

### 3. الأتمتة
- استخدم Workflows للموافقات
- فعّل الإشعارات التلقائية
- أعد Email Templates الاحترافية

---

## 🔄 التحديثات المستقبلية

### قيد التطوير
- [ ] تطبيق Mobile App للموظفين
- [ ] تكامل مع أنظمة البصمة
- [ ] Dashboard تحليلي متقدم
- [ ] AI للتنبؤ بالاحتياجات
- [ ] Self-Service Portal محسّن

---

## 📞 الدعم والمساعدة

### للمشاكل التقنية
- راجع ملف `TECHNICAL.md`
- تحقق من `DEVELOPMENT.md`

### للتعليمات
- راجع `USER_GUIDE.md`
- اطلع على `MANUAL_TESTING_GUIDE.md`

---

## 📝 ملاحظات هامة

1. **المسارات الديناميكية**: 
   - `[employee_id]` يتم استبداله بالرقم الفعلي للموظف
   - `[DocType]` يتم استبداله باسم النوع المطلوب

2. **URL Encoding**:
   - المسافات في المسارات تُستبدل بـ `%20`
   - الأحرف الخاصة يتم ترميزها

3. **الصلاحيات**:
   - بعض الصفحات تتطلب صلاحيات معينة
   - تأكد من وجود الدور المناسب

4. **التخصيصات**:
   - معظم الصفحات قابلة للتخصيص
   - استخدم Customize Form للتعديلات

---

## 🎉 الخلاصة

هذا الدليل يغطي جميع صفحات ومسارات نظام الموارد البشرية في تطبيق Meena/HRMS. استخدمه كمرجع للتنقل وفهم بنية النظام وتحسين تجربة المستخدم (UX).

---

**تاريخ التحديث**: 7 فبراير 2026  
**الإصدار**: 1.0  
**المطور**: Meena Base App Team
