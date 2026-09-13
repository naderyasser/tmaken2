# دليل تدفقات تجربة المستخدم (UX Flow Guide) - نظام الموارد البشرية

## 📋 نظرة عامة
هذا الدليل يوضح تدفقات تجربة المستخدم (User Experience Flows) للعمليات الأساسية في نظام الموارد البشرية، مما يساعد في تحسين وتبسيط رحلة المستخدم.

---

## 👤 تدفقات الموظف (Employee Flows)

### 1. تعيين موظف جديد (New Employee Onboarding)

#### 📊 خريطة التدفق
```
Start → HR Dashboard → New Employee → Fill Basic Info → 
Add Contact Details → Set Salary Structure → Assign Leave Policy → 
Upload Documents → Submit → Email Notification → End
```

#### 🔗 المسارات خطوة بخطوة
```javascript
// الخطوة 1: البداية من HR Dashboard
URL: http://localhost:8000/app/hr

// الخطوة 2: إنشاء موظف جديد
Action: Click "موظف جديد" من Shortcuts
URL: http://localhost:8000/app/employee/new-employee-1

// الخطوة 3: ملء البيانات الأساسية
Fields:
- First Name (الاسم الأول)
- Last Name (اسم العائلة)
- Employee Number (رقم الموظف - تلقائي)
- Date of Birth (تاريخ الميلاد)
- Gender (الجنس)
- Date of Joining (تاريخ الالتحاق)

// الخطوة 4: إضافة البيانات الوظيفية
Fields:
- Department (القسم)
- Designation (المسمى الوظيفي)
- Branch (الفرع)
- Reports To (المدير المباشر)

// الخطوة 5: معلومات الاتصال
Fields:
- Cell Number (رقم الهاتف)
- Personal Email (البريد الشخصي)
- Company Email (البريد الرسمي)
- Current Address (العنوان الحالي)

// الخطوة 6: تعيين هيكل الراتب
Action: Navigate to "Salary Structure Assignment"
URL: http://localhost:8000/app/salary-structure-assignment/new

// الخطوة 7: تخصيص الإجازات
Action: Navigate to "Leave Allocation"
URL: http://localhost:8000/app/leave-allocation/new

// الخطوة 8: رفع المستندات
Fields:
- ID Copy (نسخة الهوية)
- Resume (السيرة الذاتية)
- Certificates (الشهادات)

// الخطوة 9: الحفظ والإرسال
Action: Click "Save" then "Submit"

// الخطوة 10: إشعار تلقائي
System: إرسال بريد إلكتروني بالمعلومات الأساسية
```

#### ⏱️ الوقت المتوقع
- **سريع**: 5-7 دقائق (البيانات الأساسية فقط)
- **كامل**: 15-20 دقيقة (مع جميع التفاصيل)

#### 🎯 نقاط تحسين UX
1. **Auto-save**: حفظ تلقائي كل 30 ثانية لتجنب فقدان البيانات
2. **Progress Indicator**: مؤشر تقدم يوضح الخطوات المكتملة
3. **Validation**: التحقق الفوري من البيانات المدخلة
4. **Quick Templates**: قوالب سريعة للأدوار الشائعة

---

### 2. البحث عن موظف (Employee Search)

#### 📊 خريطة التدفق
```
Start → Employee List → Search/Filter → 
View Results → Select Employee → View Details → End
```

#### 🔗 المسارات
```javascript
// الطريقة 1: من Dock
Click Meena Dock → HR Module → الموظفين
URL: http://localhost:8000/app/List/Employee/view/cards

// الطريقة 2: من Dashboard
Dashboard → Employee Card → Click
URL: http://localhost:8000/app/employee

// الطريقة 3: البحث العام
Keyboard: Ctrl+K → Type "Employee" → Enter
```

#### 🔍 خيارات البحث والفلترة
```javascript
// 1. البحث بالاسم
Filter: employee_name = "أحمد"

// 2. الفلترة حسب القسم
Filter: department = "Sales"

// 3. الفلترة حسب الحالة
Filter: status = "Active"

// 4. فلترة متقدمة
Filters: {
    department: "Sales",
    designation: "Sales Manager",
    status: "Active",
    date_of_joining: [">=", "2023-01-01"]
}
```

#### ⏱️ الوقت المتوقع
- **البحث البسيط**: 5-10 ثوانٍ
- **البحث المتقدم**: 20-30 ثانية

---

### 3. تحديث بيانات موظف (Update Employee Info)

#### 📊 خريطة التدفق
```
Search Employee → Open Form → Edit Fields → 
Verify Changes → Save → Update History → Email Notification
```

#### 🔗 المسار
```javascript
// الخطوة 1: فتح سجل الموظف
URL: http://localhost:8000/app/employee/HR-EMP-00001

// الخطوة 2: تفعيل وضع التعديل
Action: Click "Edit" button

// الخطوة 3: تعديل البيانات المطلوبة

// الخطوة 4: الحفظ
Action: Click "Save"

// التحقق من السجل
Action: View "Activity Log" to see changes
```

---

## 📅 تدفقات الحضور والانصراف

### 1. تسجيل حضور يدوي (Manual Attendance Entry)

#### 📊 خريطة التدفق
```
Start → Attendance List → New Entry → 
Select Employee → Select Date → Set Status → 
Add Check-in/out Time → Save → End
```

#### 🔗 المسار الكامل
```javascript
// الخطوة 1: فتح قائمة الحضور
URL: http://localhost:8000/app/attendance

// الخطوة 2: إنشاء سجل جديد
Click: "New Attendance"
URL: http://localhost:8000/app/attendance/new-attendance-1

// الخطوة 3: ملء البيانات
Fields:
- Employee (الموظف)
- Attendance Date (التاريخ)
- Status (Present/Absent/Half Day)
- Check In Time (وقت الدخول)
- Check Out Time (وقت الخروج)
- Working Hours (ساعات العمل - تلقائي)

// الخطوة 4: الحفظ
Action: Save
```

#### ⏱️ الوقت المتوقع
- **سجل واحد**: 30-45 ثانية
- **رفع ملف (Bulk)**: 2-3 دقائق لـ 50 موظف

---

### 2. مراجعة الحضور الشهري (Monthly Attendance Review)

#### 📊 خريطة التدفق
```
Start → Reports → Monthly Attendance Sheet → 
Set Filters (Month, Department) → Generate → 
Review Data → Export/Print → End
```

#### 🔗 المسار
```javascript
// الخطوة 1: فتح التقرير
URL: http://localhost:8000/app/query-report/Monthly%20Attendance%20Sheet

// الخطوة 2: تعيين الفلاتر
frappe.route_options = {
    month: '01',
    year: '2024',
    department: 'Sales'
};

// الخطوة 3: توليد التقرير
Action: Click "Refresh"

// الخطوة 4: التصدير
Actions:
- Export as Excel
- Print
- Email
```

---

## 🏖️ تدفقات الإجازات

### 1. طلب إجازة (Leave Application)

#### 📊 خريطة التدفق (من منظور الموظف)
```
Employee Login → My Dashboard → Apply Leave → 
Select Leave Type → Choose Dates → 
Check Balance → Add Reason → Submit → 
Wait for Approval → Receive Notification
```

#### 🔗 المسار الكامل
```javascript
// الخطوة 1: الدخول إلى صفحة الإجازات
URL: http://localhost:8000/app/leave-application

// الخطوة 2: طلب جديد
Click: "New Leave Application"
URL: http://localhost:8000/app/leave-application/new-leave-application-1

// الخطوة 3: ملء التفاصيل
Fields:
- Employee (الموظف - تلقائي)
- Leave Type (نوع الإجازة)
- From Date (من تاريخ)
- To Date (إلى تاريخ)
- Total Days (عدد الأيام - تلقائي)
- Leave Balance Before (الرصيد قبل)
- Leave Balance After (الرصيد بعد - تلقائي)
- Reason (السبب)
- Leave Approver (المدير الموافق - تلقائي)

// الخطوة 4: التحقق من الرصيد
Display: Available balance for selected leave type

// الخطوة 5: الإرسال
Action: Click "Save" then "Submit"

// الخطوة 6: الإشعار
System: Email to Leave Approver
Browser: Desktop notification
```

#### ⏱️ الوقت المتوقع
- **إدخال الطلب**: 2-3 دقائق
- **الموافقة**: 5-10 دقائق
- **الإجمالي**: 7-13 دقيقة

---

### 2. الموافقة على إجازة (Leave Approval)

#### 📊 خريطة التدفق (من منظور المدير)
```
Manager Login → Notifications/Dashboard → 
Pending Leave Applications → Review Details → 
Check Calendar → Approve/Reject → 
Add Comment (if needed) → Submit → 
Employee Notification
```

#### 🔗 المسار
```javascript
// الخطوة 1: عرض الطلبات المعلقة
frappe.route_options = {
    status: 'Open',
    leave_approver: frappe.session.user
};
URL: http://localhost:8000/app/leave-application

// الخطوة 2: فتح الطلب
Click: على الطلب المراد مراجعته

// الخطوة 3: المراجعة
Display:
- Employee details
- Leave type and duration
- Reason
- Current leave balance
- Team availability

// الخطوة 4: اتخاذ القرار
Actions:
- Approve → Status = "Approved"
- Reject → Status = "Rejected" + add comment

// الخطوة 5: الإشعار التلقائي
System: Email to employee with decision
```

---

### 3. عرض رصيد الإجازات (View Leave Balance)

#### 📊 خريطة التدفق
```
Login → Dashboard/Reports → Leave Balance Report → 
Filter by Employee/Department → View Summary → 
Drill Down to Details → Export if needed
```

#### 🔗 المسار
```javascript
// للموظف الفردي
URL: http://localhost:8000/app/query-report/Employee%20Leave%20Balance

// ملخص شامل
URL: http://localhost:8000/app/query-report/Employee%20Leave%20Balance%20Summary

// من ملف الموظف
URL: http://localhost:8000/app/employee/HR-EMP-00001
Section: "Leave Details" tab
```

---

## 💰 تدفقات الرواتب

### 1. إنشاء قسيمة راتب شهرية (Generate Salary Slips)

#### 📊 خريطة التدفق
```
Start → Payroll Entry → Select Period → 
Set Filters (Branch, Department) → 
Create Salary Slips (Bulk) → Validate → 
Generate Payment Entries → Bank File → 
Notify Employees → End
```

#### 🔗 المسار الكامل
```javascript
// الخطوة 1: إنشاء Payroll Entry
URL: http://localhost:8000/app/payroll-entry/new-payroll-entry-1

// الخطوة 2: تحديد الفترة
Fields:
- Company (الشركة)
- Payroll Period (فترة الرواتب)
- Month (الشهر)
- Year (السنة)
- Branch (الفرع - اختياري)
- Department (القسم - اختياري)

// الخطوة 3: إنشاء القسائم
Action: Click "Create Salary Slips"
System: يقوم بإنشاء قسيمة لكل موظف مؤهل

// الخطوة 4: المراجعة
Action: Review generated slips
URL: Check each salary slip link

// الخطوة 5: الإرسال
Action: Submit Payroll Entry
System: يغير حالة جميع القسائم إلى "Submitted"

// الخطوة 6: إنشاء سندات الدفع
Action: Click "Make Bank Entry"
System: ينشئ Journal Entry أو Payment Entry

// الخطوة 7: إشعار الموظفين
Action: Click "Email Salary Slips"
System: يرسل قسيمة الراتب لكل موظف
```

#### ⏱️ الوقت المتوقع
- **الإعداد والفلترة**: 2-3 دقائق
- **إنشاء القسائم**: 1-2 دقيقة (50 موظف)
- **المراجعة**: 5-10 دقائق
- **الإرسال والإشعارات**: 2-3 دقائق
- **الإجمالي**: 10-18 دقيقة لـ 50 موظف

---

### 2. عرض قسيمة راتب موظف (View Employee Salary Slip)

#### 📊 خريطة التدفق (الموظف)
```
Employee Login → Self Service → Salary Slips → 
Select Month → View Details → Download PDF → End
```

#### 🔗 المسار
```javascript
// الطريقة 1: من Dashboard الموظف
Shortcut: "My Salary Slips"
URL: http://localhost:8000/app/salary-slip

// الطريقة 2: فتح قسيمة محددة
URL: http://localhost:8000/app/salary-slip/HR-SAL-00123

// عرض PDF
Action: Click "Print" → "Download PDF"
```

---

## 👔 تدفقات التوظيف

### 1. إدارة عملية التوظيف الكاملة

#### 📊 خريطة التدفق
```
Job Opening → Applications Received → 
Initial Screening → Schedule Interview → 
Conduct Interview → Feedback → 
Decision (Accept/Reject) → Job Offer → 
Offer Acceptance → Onboarding
```

#### 🔗 المسار التفصيلي

##### الخطوة 1: إنشاء وظيفة شاغرة
```javascript
URL: http://localhost:8000/app/job-opening/new-job-opening-1

Fields:
- Job Title (عنوان الوظيفة)
- Department (القسم)
- Designation (المسمى)
- Vacancies (عدد الشواغر)
- Status (Open/Closed)
- Job Description (وصف الوظيفة)
- Published (نشر على الموقع)
```

##### الخطوة 2: استقبال المتقدمين
```javascript
URL: http://localhost:8000/app/List/Job%20Applicant/view/cards

Actions:
- Manual Entry (إدخال يدوي)
- Email Integration (من البريد)
- Website Form (من نموذج الموقع)

Fields per Applicant:
- Applicant Name
- Email
- Phone
- Resume
- Source (LinkedIn, Website, etc.)
- Job Opening Link
```

##### الخطوة 3: الفرز الأولي
```javascript
// عرض Kanban
URL: http://localhost:8000/app/job-applicant?view=kanban

Stages:
- Open (جديد)
- Hold (قيد المراجعة)
- Replied (تم الرد)
- Accepted (مقبول)
- Rejected (مرفوض)

// Drag & Drop بين المراحل
```

##### الخطوة 4: جدولة المقابلة
```javascript
URL: http://localhost:8000/app/interview/new-interview-1

Fields:
- Job Applicant (المتقدم)
- Interview Round (الجولة)
- Interview Type (نوع المقابلة)
- From Time (من)
- To Time (إلى)
- Interviewers (المقابلون)
- Designation (المسمى المطلوب)

System Actions:
- Send calendar invite
- Email to applicant
- Reminder notifications
```

##### الخطوة 5: إجراء المقابلة وإدخال التقييم
```javascript
URL: http://localhost:8000/app/interview-feedback/new

Fields:
- Interview (المقابلة)
- Interviewer (المقابل)
- Result (Cleared/Rejected)
- Rating (1-5)
- Feedback (التقييم النصي)
```

##### الخطوة 6: إرسال عرض العمل
```javascript
URL: http://localhost:8000/app/job-offer/new-job-offer-1

Fields:
- Job Applicant (المتقدم)
- Offer Date (تاريخ العرض)
- Designation (المسمى)
- Company (الشركة)
- Status (Awaiting Response/Accepted/Rejected)
- Offer Terms (شروط العرض)

Print Format: يمكن طباعة خطاب العرض الرسمي
```

##### الخطوة 7: قبول العرض والتعيين
```javascript
// عند قبول العرض
Action: Update Job Offer Status to "Accepted"

// إنشاء خطاب التعيين
URL: http://localhost:8000/app/appointment-letter/new

// تحويل إلى موظف
Action: Create Employee from Job Applicant
System: يحول المتقدم إلى موظف جديد
```

#### ⏱️ الوقت المتوقع
- **نشر الوظيفة**: 5-10 دقائق
- **الفرز الأولي**: 5-10 دقائق لكل متقدم
- **جدولة المقابلة**: 3-5 دقائق
- **إدخال التقييم**: 5-10 دقائق
- **إصدار عرض العمل**: 10-15 دقيقة
- **التعيين**: 15-20 دقيقة
- **الإجمالي للمتقدم الواحد**: 2-3 أسابيع (وقت فعلي)

---

## 💸 تدفقات المصروفات

### 1. تقديم مطالبة مصروف (Submit Expense Claim)

#### 📊 خريطة التدفق
```
Employee → New Expense Claim → 
Add Expense Details → Attach Receipts → 
Submit → Manager Approval → 
Accounts Verification → Payment → 
Employee Notification
```

#### 🔗 المسار
```javascript
// الخطوة 1: إنشاء مطالبة جديدة
URL: http://localhost:8000/app/expense-claim/new-expense-claim-1

// الخطوة 2: البيانات الأساسية
Fields:
- Employee (الموظف - تلقائي)
- Expense Approver (المدير الموافق - تلقائي)
- Posting Date (التاريخ)

// الخطوة 3: إضافة تفاصيل المصروف
Table: Expenses
Columns:
- Expense Date (تاريخ المصروف)
- Expense Claim Type (نوع المصروف)
- Description (الوصف)
- Amount (المبلغ)
- Sanctioned Amount (المبلغ المعتمد)

// الخطوة 4: رفع الإيصالات
Attachments:
- Receipts (الإيصالات)
- Invoices (الفواتير)
- Supporting Documents (مستندات داعمة)

// الخطوة 5: الإرسال
Action: Submit
System: إشعار للمدير

// الخطوة 6: الموافقة
Manager: يفتح المطالبة → يراجع → يوافق/يرفض

// الخطوة 7: الدفع
Accounts: ينشئ Payment Entry
URL: http://localhost:8000/app/payment-entry/new

// الخطوة 8: إشعار الموظف
System: Email notification مع تفاصيل الدفع
```

#### ⏱️ الوقت المتوقع
- **إدخال المطالبة**: 5-7 دقائق
- **الموافقة**: 5-10 دقائق
- **المراجعة المحاسبية**: 10-15 دقيقة
- **الدفع**: 2-3 أيام (حسب دورة الدفع)

---

## ⏱️ تدفقات تتبع الوقت

### 1. تسجيل ساعات العمل (Log Timesheet)

#### 📊 خريطة التدفق
```
Employee Login → Timesheet → New Entry → 
Select Project/Task → Add Activity → 
Set Hours → Mark Billable → Submit → 
Manager Approval → Billing (if applicable)
```

#### 🔗 المسار
```javascript
// الخطوة 1: إنشاء Timesheet جديد
URL: http://localhost:8000/app/timesheet/new-timesheet-1

// الخطوة 2: البيانات الأساسية
Fields:
- Employee (الموظف)
- Start Date (تاريخ البداية)
- End Date (تاريخ النهاية)

// الخطوة 3: إضافة الأنشطة
Table: Time Logs
Columns:
- Activity Type (نوع النشاط)
- Project (المشروع)
- Task (المهمة)
- From Time (من)
- To Time (إلى)
- Hours (الساعات - تلقائي)
- Billing Hours (ساعات الفوترة)
- Billable (قابل للفوترة)
- Costing Rate (معدل التكلفة)
- Billing Rate (معدل الفوترة)

// الخطوة 4: الإرسال
Action: Submit
System: إشعار للمدير

// الخطوة 5: الفوترة (إذا كان قابل للفوترة)
Action: Make Sales Invoice
System: إنشاء فاتورة مبيعات من Timesheet
```

---

## 📊 تدفقات التقارير والتحليلات

### 1. إنشاء تقرير مخصص (Generate Custom Report)

#### 📊 خريطة التدفق
```
Reports Dashboard → Select Report Type → 
Set Filters → Run Report → 
Analyze Data → Export/Schedule → Save View
```

#### 🔗 المسار
```javascript
// الخطوة 1: اختيار نوع التقرير
Options:
- Standard Reports (تقارير قياسية)
- Query Reports (تقارير استعلامية)
- Script Reports (تقارير مخصصة)

// مثال: Employee Analytics
URL: http://localhost:8000/app/query-report/Employee%20Analytics

// الخطوة 2: تعيين الفلاتر
Filters:
- Company
- Department
- Branch
- Date Range
- Employee Status

// الخطوة 3: تشغيل التقرير
Action: Click "Refresh"
System: يعرض البيانات في جدول أو رسم بياني

// الخطوة 4: التحليل
Features:
- Sort columns
- Group by fields
- Calculate totals
- View charts

// الخطوة 5: التصدير
Actions:
- Export as Excel
- Export as PDF
- Export as CSV
- Print

// الخطوة 6: جدولة التقرير
Action: Click "Set Email Report"
Settings:
- Frequency (يومي، أسبوعي، شهري)
- Recipients (المستلمون)
- Format (التنسيق)
```

---

## 🎯 نقاط تحسين UX العامة

### 1. تبسيط التنقل
```javascript
// التوصيات:
- استخدام Breadcrumbs واضحة
- Quick Access Buttons للعمليات الشائعة
- Recent Items List
- Favorites/Bookmarks System
```

### 2. التغذية الراجعة (Feedback)
```javascript
// تحسينات:
- Success messages واضحة وملونة
- Progress indicators للعمليات الطويلة
- Error messages مفيدة مع حلول مقترحة
- Confirmation dialogs للعمليات الحرجة
```

### 3. الأتمتة
```javascript
// فرص الأتمتة:
- Auto-save drafts
- Auto-fill repeated data
- Smart defaults based on user behavior
- Bulk operations للمهام المتكررة
```

### 4. إمكانية الوصول (Accessibility)
```javascript
// تحسينات:
- Keyboard shortcuts للعمليات الشائعة
- Screen reader compatibility
- High contrast mode
- Font size adjustment
```

### 5. الأداء
```javascript
// تحسينات:
- Lazy loading للقوائم الطويلة
- Pagination فعالة
- Caching للبيانات المتكررة
- Progressive enhancement
```

---

## 📱 تدفقات Mobile (المستقبلية)

### 1. تسجيل الحضور عبر Mobile
```
Open App → Biometric Login → 
Location Permission → Check In/Out → 
Automatic GPS Tagging → Sync to Server → 
Confirmation
```

### 2. طلب إجازة عبر Mobile
```
Open App → Quick Actions → 
Apply Leave → Select Type & Dates → 
View Balance → Submit → 
Push Notification on approval
```

---

## 🔄 تدفق الإشعارات (Notification Flow)

### أنواع الإشعارات
```javascript
1. Email Notifications
   - Leave application submitted
   - Salary slip generated
   - Expense claim approved
   
2. In-App Notifications
   - New task assigned
   - Document requires attention
   - System announcements

3. SMS Notifications (اختياري)
   - Critical approvals
   - Security alerts
   - Payment confirmations

4. Desktop Notifications
   - Real-time updates
   - Meeting reminders
   - Urgent messages
```

---

## 📝 خلاصة UX Best Practices

### Do's ✅
1. توفير shortcuts للعمليات المتكررة
2. أتمتة الحقول المتوقعة
3. Validate البيانات في real-time
4. توفير feedback فوري
5. السماح بحفظ draft للنماذج الطويلة
6. توفير help text واضح
7. استخدام icons معبرة
8. Multi-step forms للعمليات المعقدة
9. Allow to revert actions عند الممكن
10. Show progress indicators

### Don'ts ❌
1. تجنب الـ Popups الكثيرة
2. لا تخفي معلومات هامة
3. تجنب المصطلحات التقنية الغامضة
4. لا تطلب بيانات غير ضرورية
5. تجنب الـ page reloads غير الضرورية
6. لا تجبر المستخدم على خطوات زائدة
7. تجنب التنبيهات المتكررة
8. لا تستخدم colors فقط للتمييز
9. تجنب الأزرار الغامضة
10. لا تخفي خيارات الإلغاء

---

## ⏱️ جدول الأوقات المتوقعة (Benchmark Times)

| العملية | وقت مثالي | وقت متوسط | وقت بطيء |
|---------|-----------|-----------|----------|
| تسجيل موظف جديد | 5 دقائق | 15 دقيقة | 30 دقيقة |
| طلب إجازة | 2 دقيقة | 5 دقائق | 10 دقائق |
| الموافقة على إجازة | 1 دقيقة | 3 دقائق | 5 دقائق |
| تسجيل حضور | 30 ثانية | 1 دقيقة | 2 دقيقة |
| إنشاء مطالبة مصروف | 3 دقائق | 7 دقائق | 15 دقيقة |
| توليد رواتب شهرية | 5 دقائق | 15 دقيقة | 30 دقيقة |
| إنشاء تقرير | 1 دقيقة | 3 دقائق | 5 دقائق |
| البحث عن موظف | 10 ثوانٍ | 30 ثانية | 1 دقيقة |

---

**تاريخ التحديث**: 7 فبراير 2026  
**الإصدار**: 1.0  
**المطور**: Meena Base App Team
