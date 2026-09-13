# 🏢 نظام إدارة الموارد البشرية - Meena HRMS

نظام متكامل لإدارة الموارد البشرية مبني على **Frappe/ERPNext** مع واجهة مستخدم حديثة بتقنية **Next.js**

---

## 📋 نظرة عامة

هذا نظام شامل لإدارة الموارد البشرية يتكون من طبقتين:
- 🔧 **Backend**: Frappe/ERPNext - `http://localhost:8000`
- 🎨 **Frontend**: Next.js/React - `http://localhost:3000`

### المميزات الرئيسية
✅ إدارة الموظفين (Employee Management)  
✅ الحضور والانصراف (Attendance)  
✅ إدارة الإجازات (Leave Management)  
✅ الرواتب (Payroll)  
✅ التوظيف (Recruitment)  
✅ تقييم الأداء (Performance)  
✅ المصروفات (Expenses)  
✅ التقارير والتحليلات (Reports & Analytics)  

---

## 🚀 البدء السريع

### الخطوة 1: تشغيل Backend
```bash
cd /home/nader/frappe-bench
bench start
```

### الخطوة 2: تشغيل Frontend
```bash
cd hr-management-system-ui
pnpm install  # أول مرة فقط
pnpm dev
```

### الخطوة 3: فتح النظام
- **Frappe UI**: http://localhost:8000
- **Next.js UI**: http://localhost:3000

📖 **للمزيد من التفاصيل**: راجع [QUICK_START_GUIDE.md](./QUICK_START_GUIDE.md)

---

## 📚 التوثيق الكامل

### 🎯 للبدء السريع
| الملف | الوصف | الوقت |
|-------|-------|-------|
| [QUICK_START_GUIDE.md](./QUICK_START_GUIDE.md) | دليل البدء السريع | 10 دقائق |
| [HR_DASHBOARD_INDEX.md](./HR_DASHBOARD_INDEX.md) | الفهرس الشامل | 5 دقائق |

### 🔧 للمطورين Backend
| الملف | الوصف | الوقت |
|-------|-------|-------|
| [HR_PAGES_DOCUMENTATION.md](./HR_PAGES_DOCUMENTATION.md) | 100+ صفحة، 150+ مسار | 15 دقيقة |
| [HR_ROUTING_GUIDE.md](./HR_ROUTING_GUIDE.md) | دليل التوجيه | 15 دقيقة |

### 🎨 للمطورين Frontend
| الملف | الوصف | الوقت |
|-------|-------|-------|
| [hr-management-system-ui/README.md](./hr-management-system-ui/README.md) | توثيق Next.js شامل | 25 دقيقة |

### 🔗 للمطورين Full Stack
| الملف | الوصف | الوقت |
|-------|-------|-------|
| [HR_SYSTEM_INTEGRATION_GUIDE.md](./HR_SYSTEM_INTEGRATION_GUIDE.md) | دليل التكامل الشامل | 40 دقيقة |

### 👤 لمصممي UX
| الملف | الوصف | الوقت |
|-------|-------|-------|
| [HR_UX_FLOW_GUIDE.md](./HR_UX_FLOW_GUIDE.md) | 15 تدفق مستخدم | 20 دقيقة |

---

## 🏗️ البنية التقنية

```
┌──────────────────────────────────────────────────────┐
│                    User Interface                     │
└─────────────────────┬────────────────────────────────┘
                      │
         ┌────────────┴─────────────┐
         │                          │
         ▼                          ▼
┌─────────────────┐        ┌─────────────────┐
│   Next.js UI    │        │   Frappe UI     │
│   (Port 3000)   │        │   (Port 8000)   │
│    🆕 Modern    │        │   📊 Classic    │
└────────┬────────┘        └────────┬────────┘
         │                          │
         └────────────┬─────────────┘
                      │
         ┌────────────▼─────────────┐
         │    Frappe/ERPNext API    │
         │       (Port 8000)        │
         └────────────┬─────────────┘
                      │
         ┌────────────▼─────────────┐
         │    Business Logic        │
         │  (Python + JavaScript)   │
         └────────────┬─────────────┘
                      │
         ┌────────────▼─────────────┐
         │   MariaDB Database       │
         │     (Port 3306)          │
         └──────────────────────────┘
```

---

## 📂 هيكل المشروع

```
/home/nader/frappe-bench/
│
├── apps/                              # Frappe Applications
│   ├── frappe/                       # Frappe Framework Core
│   ├── erpnext/                      # ERPNext Core
│   ├── hrms/                         # HR Module ⭐
│   │   ├── hrms/
│   │   │   ├── hr/                   # HR DocTypes & Controllers
│   │   │   ├── payroll/              # Payroll Module
│   │   │   └── api/                  # REST APIs
│   │   └── docs/                     # Documentation
│   │
│   ├── base_meena/                   # Meena Customizations ⭐
│   │   ├── base_meena/
│   │   │   ├── public/               # JS/CSS Assets
│   │   │   ├── templates/            # Jinja Templates
│   │   │   └── hooks.py              # Frappe Hooks
│   │   └── README.md
│   │
│   └── hr_custom/                    # HR-specific Customizations
│
├── sites/                             # Sites Configuration
│   └── meena.localhost/              # Your Site
│       ├── site_config.json          # Site Config
│       └── private/files/            # Uploaded Files
│
├── hr-management-system-ui/          # Next.js Frontend 🆕
│   ├── app/                          # Next.js App Router
│   │   ├── page.tsx                  # Main Page
│   │   └── layout.tsx                # Root Layout
│   │
│   ├── components/                   # React Components
│   │   ├── hr-dashboard.tsx         # HR Dashboard
│   │   ├── sidebar.tsx              # Sidebar Navigation
│   │   ├── header.tsx               # Header Component
│   │   ├── employee-profile.tsx     # Employee Form
│   │   └── ui/                      # 50+ UI Components
│   │
│   ├── lib/                         # Utilities & Helpers
│   │   ├── utils.ts                 # Helper Functions
│   │   └── api-client.ts            # API Client (planned)
│   │
│   ├── public/                      # Static Assets
│   ├── styles/                      # Global Styles
│   ├── package.json                 # Dependencies
│   ├── tsconfig.json                # TypeScript Config
│   ├── tailwind.config.ts           # Tailwind Config
│   ├── next.config.mjs              # Next.js Config
│   └── README.md                    # Frontend Documentation
│
├── config/                          # Bench Configuration
├── logs/                            # Log Files
├── env/                             # Python Virtual Environment
│
└── Documentation/                   # 📚 Project Documentation
    ├── HR_DASHBOARD_INDEX.md        # الفهرس الشامل
    ├── HR_PAGES_DOCUMENTATION.md    # توثيق الصفحات (100+ صفحة)
    ├── HR_ROUTING_GUIDE.md          # دليل التوجيه
    ├── HR_UX_FLOW_GUIDE.md          # دليل UX (15 تدفق)
    ├── HR_SYSTEM_INTEGRATION_GUIDE.md  # دليل التكامل
    ├── QUICK_START_GUIDE.md         # دليل البدء السريع
    └── README.md                     # هذا الملف
```

---

## 🎯 المكونات الرئيسية

### Backend (Frappe/ERPNext)
```python
# المسارات الرئيسية
/app/hr                    # HR Dashboard
/app/employee              # Employee List
/app/attendance            # Attendance Module
/app/leave-application     # Leave Management
/app/salary-slip           # Payroll
/app/job-opening           # Recruitment
```

**DocTypes الرئيسية**:
- Employee
- Attendance
- Leave Application
- Salary Slip
- Payroll Entry
- Job Opening
- Expense Claim

---

### Frontend (Next.js/React)
```typescript
// المكونات الرئيسية
<Header />                 // الشريط العلوي
<Sidebar />                // القائمة الجانبية
<HRDashboard />           // لوحة القيادة
<EmployeeProfile />       // نموذج الموظف
<EmployeesList />         // قائمة الموظفين (قيد التطوير)
```

**Modules المتاحة**:
```typescript
type ModuleType = 
  | 'hr'           // Dashboard الرئيسي
  | 'recruitment'  // التوظيف
  | 'leaves'       // الإجازات
  | 'attendance'   // الحضور
  | 'expenses'     // المصروفات
  | 'performance'  // الأداء
  | 'payroll'      // الرواتب
  | 'benefits'     // المزايا
  | 'settings'     // الإعدادات
  | 'new-employee' // إضافة موظف
```

---

## 🔗 التكامل بين Frontend و Backend

### مثال: الحصول على قائمة الموظفين

#### 1. في Frontend (Next.js)
```typescript
// components/employees-list.tsx
async function getEmployees() {
  const response = await fetch('http://localhost:8000/api/resource/Employee', {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  })
  return response.json()
}
```

#### 2. Backend يرجع البيانات
```json
{
  "data": [
    {
      "name": "HR-EMP-00001",
      "employee_name": "Ahmed Mohamed",
      "department": "Engineering",
      "status": "Active"
    }
  ]
}
```

#### 3. Frontend يعرض البيانات
```typescript
function EmployeesList({ employees }) {
  return (
    <Table>
      {employees.map(emp => (
        <TableRow key={emp.name}>
          <TableCell>{emp.employee_name}</TableCell>
          <TableCell>{emp.department}</TableCell>
        </TableRow>
      ))}
    </Table>
  )
}
```

---

## 🛠️ التقنيات المستخدمة

### Backend Stack
| التقنية | الإصدار | الاستخدام |
|---------|---------|-----------|
| Python | 3.10+ | Backend Language |
| Frappe | 15.x | Framework |
| ERPNext | 15.x | ERP Core |
| MariaDB | 10.6+ | Database |
| Redis | 7.x | Cache & Queue |
| Node.js | 18+ | Build Tools |

### Frontend Stack
| التقنية | الإصدار | الاستخدام |
|---------|---------|-----------|
| Next.js | 16.1.6 | React Framework |
| React | 19 | UI Library |
| TypeScript | 5.x | Type Safety |
| Tailwind CSS | 3.x | Styling |
| Radix UI | Latest | UI Components |
| Lucide React | Latest | Icons |

---

## 📊 إحصائيات المشروع

### Backend
- **100+ صفحة** موثقة
- **150+ مسار** محدد
- **15+ DocTypes** رئيسي
- **50+ API Endpoints**

### Frontend
- **50+ UI Components** جاهزة
- **10+ صفحات** رئيسية (قيد التطوير)
- **12 Modules** مختلفة
- **TypeScript 100%**

### التوثيق
- **6 ملفات** توثيق شاملة
- **5000+ سطر** من التوثيق
- **أمثلة برمجية** لكل feature
- **تحديث دوري** للوثائق

---

## 🚦 حالة المشروع

### ✅ جاهز للإنتاج
- [x] Frappe Backend (HRMS Module)
- [x] Employee Management
- [x] Attendance Module
- [x] Leave Management
- [x] Payroll Module
- [x] Recruitment Module
- [x] Expense Claims
- [x] Reports & Analytics

### 🚧 قيد التطوير
- [ ] Next.js Frontend (UI Components)
- [ ] API Integration (Frontend ↔ Backend)
- [ ] Authentication System
- [ ] Real-time Notifications
- [ ] Advanced Search & Filters
- [ ] Mobile Responsive (Full)

### 🔮 مخطط مستقبلي
- [ ] Mobile App (React Native)
- [ ] Advanced Analytics Dashboard
- [ ] AI-powered Insights
- [ ] Bulk Operations
- [ ] Export to Excel/PDF (Frontend)
- [ ] Print Functionality
- [ ] E2E Tests
- [ ] Performance Optimization

---

## 🧪 اختبار النظام

### اختبار Backend
```bash
# تشغيل Tests
cd /home/nader/frappe-bench
bench --site meena.localhost run-tests --app hrms

# اختبار API
curl http://localhost:8000/api/resource/Employee \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### اختبار Frontend
```bash
# تشغيل Development Server
cd hr-management-system-ui
pnpm dev

# Build للإنتاج
pnpm build

# تشغيل Production Build
pnpm start
```

---

## 📸 لقطات الشاشة

### Frappe UI (Classic)
```
┌──────────────────────────────────────────────┐
│  Meena    [Search...]   [+] Notifications   │
├──────────────────────────────────────────────┤
│  HR Dashboard                                │
│  ┌────────┐ ┌────────┐ ┌────────┐          │
│  │  248   │ │  235   │ │   8    │          │
│  │Employees│ │Present │ │On Leave│          │
│  └────────┘ └────────┘ └────────┘          │
│                                              │
│  Recent Activity                             │
│  • Ahmed joined                              │
│  • Sarah on leave                            │
│  • New payroll entry                         │
└──────────────────────────────────────────────┘
```

### Next.js UI (Modern) 🆕
```
┌──────────────────────────────────────────────┐
│  Meena  [Search...]  🔔  👤                  │
├──┬───────────────────────────────────────────┤
│≡ │  HR Dashboard                             │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ │
│H │  │   248    │ │   235    │ │    8     │ │
│R │  │Employees │ │ Present  │ │On Leave  │ │
│  │  │  +5.2%   │ │  +2.1%   │ │  -3.4%   │ │
│📊│  └──────────┘ └──────────┘ └──────────┘ │
│  │                                           │
│  │  Quick Actions                            │
│👥│  [Add Employee] [Leave Request] [Reports]│
│  │  [Payroll] [Attendance] [Recruitment]    │
│📅│                                           │
│  │  Recent Activity  ⋯                      │
│💰│  🟢 Ahmed joined - 2 hours ago           │
│  │  🟡 Sarah on leave - 5 hours ago         │
│⚙️│  🔵 Payroll processed - Yesterday        │
└──┴───────────────────────────────────────────┘
```

---

## 🔐 الأمان (Security)

### Backend Security
- ✅ Role-based Access Control (RBAC)
- ✅ Session Management
- ✅ SQL Injection Protection
- ✅ CSRF Protection
- ✅ XSS Protection

### Frontend Security
- ✅ JWT Token Authentication (planned)
- ✅ HTTPS Only (production)
- ✅ Input Validation
- ✅ CORS Configuration
- ✅ Secure Headers

---

## 🌍 البيئات (Environments)

### Development
```bash
# Backend
http://localhost:8000

# Frontend
http://localhost:3000

# Database
localhost:3306
```

### Production (مخطط)
```bash
# Backend
https://api.meena.com

# Frontend
https://hr.meena.com

# Database
production-db.meena.com:3306
```

---

## 📖 الموارد التعليمية

### للمبتدئين
1. [QUICK_START_GUIDE.md](./QUICK_START_GUIDE.md) - ابدأ من هنا!
2. [HR_DASHBOARD_INDEX.md](./HR_DASHBOARD_INDEX.md) - نظرة عامة
3. [Frappe Framework Basics](https://frappeframework.com/docs)
4. [React Basics](https://react.dev/learn)

### للمتقدمين
1. [HR_SYSTEM_INTEGRATION_GUIDE.md](./HR_SYSTEM_INTEGRATION_GUIDE.md) - تكامل كامل
2. [Frappe REST API](https://frappeframework.com/docs/user/en/api)
3. [Next.js App Router](https://nextjs.org/docs/app)
4. [TypeScript Deep Dive](https://www.typescriptlang.org/docs)

---

## 🤝 المساهمة (Contributing)

نرحب بمساهماتك! 

### كيف تساهم؟
1. Fork المشروع
2. إنشاء Branch جديد (`git checkout -b feature/AmazingFeature`)
3. Commit التغييرات (`git commit -m 'Add AmazingFeature'`)
4. Push للـ Branch (`git push origin feature/AmazingFeature`)
5. فتح Pull Request

### معايير الكود
- ✅ اتبع PEP 8 للـ Python
- ✅ اتبع TypeScript Standards للـ Frontend
- ✅ اكتب Comments واضحة
- ✅ أضف Tests للـ Features الجديدة
- ✅ حدّث التوثيق

---

## 🐛 الإبلاغ عن المشاكل

وجدت مشكلة (Bug)؟
1. تأكد أنها غير مسجلة بالفعل
2. افتح Issue جديدة على GitHub
3. اذكر:
   - وصف المشكلة
   - خطوات إعادة الإنتاج
   - النتيجة المتوقعة
   - النتيجة الفعلية
   - لقطات شاشة (إن وجدت)

---

## 📞 الدعم والتواصل

### التوثيق
- 📚 [HR_DASHBOARD_INDEX.md](./HR_DASHBOARD_INDEX.md) - الفهرس الشامل
- 🚀 [QUICK_START_GUIDE.md](./QUICK_START_GUIDE.md) - دليل البدء

### الفريق
- **Backend Team**: فريق Frappe/ERPNext
- **Frontend Team**: فريق Next.js/React
- **Documentation Team**: فريق التوثيق

---

## 📝 الترخيص (License)

هذا المشروع مرخص تحت رخصة MIT - راجع ملف LICENSE للتفاصيل.

---

## 🙏 شكر خاص

شكراً لجميع المساهمين في:
- Frappe Framework
- ERPNext
- Next.js
- React
- TypeScript
- Tailwind CSS
- Radix UI
- وجميع المكتبات مفتوحة المصدر المستخدمة

---

## 📈 إحصائيات Git

```bash
# احصائيات المشروع
git log --oneline | wc -l         # عدد الـ Commits
git shortlog -sn --no-merges      # المساهمون
git log --shortstat               # إحصائيات التغييرات
```

---

## 🎯 Roadmap

### Q1 2026
- [x] إطلاق Frappe Backend
- [x] إعداد Next.js Frontend
- [ ] تكامل كامل للـ API
- [ ] Authentication System

### Q2 2026
- [ ] إكمال جميع الصفحات الرئيسية
- [ ] Mobile Responsive Design
- [ ] Real-time Notifications
- [ ] Advanced Reports

### Q3 2026
- [ ] Mobile App (React Native)
- [ ] AI-powered Features
- [ ] Performance Optimization
- [ ] Security Audit

### Q4 2026
- [ ] Multi-language Support
- [ ] Advanced Analytics
- [ ] Integrations (Slack, Email, etc.)
- [ ] Beta Release

---

## 🎉 شكراً لاستخدامك نظام Meena HRMS!

نأمل أن يكون هذا النظام مفيداً لك ولفريقك. إذا كان لديك أي أسئلة أو اقتراحات، لا تتردد في التواصل معنا.

**Happy Coding! 🚀**

---

**آخر تحديث**: 7 فبراير 2026  
**الإصدار**: 1.0.0  
**المطور**: Meena Base App Team  
**الحالة**: 🚧 قيد التطوير النشط
