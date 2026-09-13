# 📋 دليل هيكلية مشروع Frappe Bench (نسخة Slack)

## 🎯 نظرة عامة

مشروع Frappe Bench يحتوي على **4 تطبيقات رئيسية**:

| التطبيق | الوصف |
|---------|-------|
| **Frappe Framework** | الإطار الأساسي |
| **ERPNext** | نظام ERP متكامل |
| **HRMS** | نظام الموارد البشرية |
| **Base Meena** | تطبيق تخصيص UI/UX |

---

## 📁 هيكلية المشروع

```
frappe-bench/
├── apps/          # التطبيقات (frappe, erpnext, hrms, base_meena)
├── config/        # ملفات التكوين (Redis, Scheduler)
├── sites/         # المواقع والملفات الثابتة
└── README.md      # ملف القراءة الشامل
```

---

## 🚀 التطبيقات بالتفصيل

### 1️⃣ Frappe Framework (الإطار الأساسي)

**الوحدات (12 وحدة):**
- Core, Website, Workflow, Email, Custom
- Geo, Desk, Integrations, Printing, Contacts
- Social, Automation

**أنواع DocTypes الأساسية:**
- User, Role, DocType, DocField, DocPerm
- File, Comment, Communication, System Settings
- Report, Page, Web Form, Workspace
- Scheduled Job, Server Script, Translation

---

### 2️⃣ ERPNext (نظام ERP)

**الوحدات (21 وحدة):**
- Accounts, CRM, Buying, Selling, Stock
- Manufacturing, Projects, Support, Assets
- Maintenance, Quality Management, Utilities
- Portal, Setup, Regional, Integrations
- Communication, Telephony, Bulk Transaction
- Subcontracting, EDI

**المكونات لكل وحدة:**
- doctype/, page/, report/, print_format/
- dashboard_chart/, workspace/, notification/
- number_card/, test/, custom/

---

### 3️⃣ HRMS (الموارد البشرية)

**الوحدات (2 وحدة):**
- **HR** - إدارة الموظفين، الإجازات، الحضور
- **Payroll** - الرواتب، كشوف المرتبات

**المكونات:**
- doctype/, report/, print_format/
- dashboard_chart/, workspace/, notification/
- web_form/, hr_dashboard/, payroll_dashboard/

---

### 4️⃣ Base Meena (تطبيق التخصيص)

**الميزات الرئيسية:**
- ✅ Meena Dock - شريط تنقل سفلي عصري
- ✅ 12 موديول كامل مع روابط سريعة
- ✅ تصميم Glassmorphism احترافي
- ✅ متوافق مع جميع موديولات Frappe/ERPNext/HRMS

**الموديولات الـ 12:**
| الموديول | اللون |
|----------|-------|
| 🔵 HR (الموارد البشرية) |
| 🟢 Sales (المبيعات) |
| 🟠 Purchasing (المشتريات) |
| 🟡 Inventory (المخزون) |
| 🟣 Accounting (المحاسبة) |
| 🔴 Manufacturing (التصنيع) |
| 🩵 Projects (المشاريع) |
| 🩷 Support (خدمة العملاء) |
| 🔷 Website (الموقع الإلكتروني) |
| 🔵 Quality (الجودة) |
| ⚫ Assets (الأصول) |
| 🔴 POS (نقاط البيع) |

**DocTypes المخصصة:**
- Meena Dock Module
- Meena Dock Menu Item
- Meena Dock Settings

**الصفحات المخصصة:**
- Dock Config
- Dock Settings

---

## 🛠️ التقنيات المستخدمة

**Backend:**
- Python + Frappe Framework
- MariaDB/MySQL (قاعدة البيانات)
- Redis (التخزين المؤقت)

**Frontend:**
- JavaScript + Vue.js
- Bootstrap + Chart.js

**أدوات التطوير:**
- Bench, Git, Pre-commit
- ESLint, Prettier, Ruff

---

## 📊 البنية المعمارية

```
UI Layer (Meena Dock + Frappe Desk)
    ↓
Apps Layer (ERPNext + HRMS + Base Meena)
    ↓
Framework Layer (Frappe)
    ↓
Database Layer (MariaDB/MySQL)
    ↓
Cache Layer (Redis)
```

---

## 🔑 المفاهيم الأساسية

| المفهوم | الوصف |
|---------|-------|
| **DocType** | تعريف نوع مستند (Customer, Invoice) |
| **Module** | مجموعة DocTypes ذات صلة (Accounts, HR) |
| **Workspace** | لوحة تحكم مخصصة لوحدة معينة |
| **Page** | صفحة مخصصة في النظام |
| **Report** | تقرير مخصص |
| **Hook** | نقطة تخصيص في النظام |

---

## 💻 أوامر Bench الأساسية

```bash
# بدء/إيقاف/إعادة تشغيل الخادم
bench start | bench stop | bench restart

# تحديث/ترقية التطبيقات
bench update | bench upgrade

# ترحيل قاعدة البيانات
bench migrate

# بناء الملفات الثابتة
bench build

# تثبيت تطبيق
bench get-app <app-name>
bench install-app <app-name>

# إنشاء موقع جديد
bench new-site <site-name>

# استخدام موقع
bench use <site-name>
```

---

## 📚 الروابط المفيدة

- [Frappe Documentation](https://frappeframework.com/docs)
- [ERPNext Documentation](https://docs.erpnext.com)
- [HRMS Documentation](https://docs.frappe.io/hrms)
- [Frappe Forum](https://discuss.frappe.io)

---

## 📝 الترخيص

- Frappe Framework: MIT License
- ERPNext: GNU GPL v3.0
- HRMS: GNU GPL v3.0
- Base Meena: MIT License

---

## ✅ الخلاصة

نظام متكامل يجمع بين:
- قوة Frappe Framework
- شمولية ERPNext
- كفاءة HRMS
- جمالية Base Meena

---

*للمزيد من التفاصيل، راجع ملف README.md الشامل*
