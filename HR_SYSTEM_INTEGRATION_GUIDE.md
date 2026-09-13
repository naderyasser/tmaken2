# 🔗 دليل التكامل الشامل - نظام الموارد البشرية

## 📋 نظرة عامة على النظام

يتكون نظام إدارة الموارد البشرية (HRMS) من طبقتين رئيسيتين:

### 1. **Backend (الطبقة الخلفية)** - Frappe/ERPNext
- **Framework**: Frappe Framework + ERPNext
- **اللغة**: Python + JavaScript
- **المسار**: `/home/nader/frappe-bench/apps/`
- **الوظيفة**: Database، Business Logic، API، Authentication
- **الوصول**: `http://localhost:8000`

### 2. **Frontend (الواجهة الأمامية)** - Next.js (جديد) 🆕
- **Framework**: Next.js 16 + React 19
- **اللغة**: TypeScript
- **المسار**: `/home/nader/frappe-bench/hr-management-system-ui/`
- **الوظيفة**: User Interface، User Experience
- **الوصول**: `http://localhost:3000`

---

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        المستخدم (User)                       │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│            Next.js Frontend (Port 3000) 🆕                   │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Components:                                          │  │
│  │  • Header (Search, Notifications, User Menu)         │  │
│  │  • Sidebar (Module Navigation)                       │  │
│  │  • HR Dashboard (Stats, Quick Actions)               │  │
│  │  • Employee Profile (Forms)                          │  │
│  │  • Employees Dashboard (List View)                   │  │
│  └──────────────────────────────────────────────────────┘  │
└────────────────────────┬────────────────────────────────────┘
                         │
                         │ HTTP/REST API
                         │ (fetch/axios)
                         ▼
┌─────────────────────────────────────────────────────────────┐
│            Frappe Backend (Port 8000)                        │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  API Layer:                                           │  │
│  │  • /api/resource/Employee                            │  │
│  │  • /api/resource/Attendance                          │  │
│  │  • /api/resource/Leave Application                   │  │
│  │  • /api/resource/Salary Slip                         │  │
│  │  • /api/method/*                                     │  │
│  └────────────────┬─────────────────────────────────────┘  │
│                   │                                         │
│  ┌────────────────▼─────────────────────────────────────┐  │
│  │  Business Logic Layer:                               │  │
│  │  • DocType Controllers                               │  │
│  │  • Server Scripts                                    │  │
│  │  • Hooks & Validations                               │  │
│  └────────────────┬─────────────────────────────────────┘  │
│                   │                                         │
│  ┌────────────────▼─────────────────────────────────────┐  │
│  │  Data Layer:                                          │  │
│  │  • MariaDB Database                                  │  │
│  │  • DocTypes (Employee, Attendance, Leave, etc.)      │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

---

## 📊 مقارنة بين النظامين

| المعيار | Frappe UI (القديم) | Next.js UI (الجديد) 🆕 |
|---------|-------------------|----------------------|
| **التقنية** | Jinja Templates + Frappe JS | React Components + TypeScript |
| **التوجيه (Routing)** | Server-side (`/app/employee`) | Client-side (Module-based) |
| **الأداء** | متوسط (Server Rendering) | سريع جداً (Client Rendering + Caching) |
| **التصميم** | Bootstrap + Custom CSS | Tailwind CSS + Radix UI |
| **الكتابة** | JavaScript (غير مكتوب) | TypeScript (Type-safe) |
| **التفاعل** | jQuery + Frappe Framework | React Hooks + Modern JS |
| **الصيانة** | صعبة (Legacy Code) | سهلة (Component-based) |
| **التطوير** | بطيء (Build كامل للتغييرات) | سريع (Hot Module Replacement) |
| **Mobile Support** | محدود | ممتاز (Responsive Design) |
| **Dark Mode** | غير متاح | متاح ✓ |

---

## 🎯 ربط المكونات بـ DocTypes

### 1. Employee Module

#### Next.js Component ↔ Frappe DocType

| Component | Frappe DocType | API Endpoint |
|-----------|---------------|--------------|
| `employee-profile.tsx` | Employee | `/api/resource/Employee` |
| `employees-dashboard.tsx` | Employee (List) | `/api/resource/Employee?fields=["*"]&limit_page_length=50` |
| Employee Stats Card | Employee (Count) | `/api/resource/Employee?fields=["count"]` |

**مثال API Call**:
```typescript
// في Next.js Frontend
async function getEmployees() {
  const response = await fetch('http://localhost:8000/api/resource/Employee', {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    }
  })
  const data = await response.json()
  return data.data // Array of employees
}
```

---

### 2. Attendance Module

| Component | Frappe DocType | API Endpoint |
|-----------|---------------|--------------|
| `attendance-dashboard.tsx` | Attendance | `/api/resource/Attendance` |
| Attendance Stats Card | Attendance (Aggregation) | `/api/method/hrms.hr.utils.get_attendance_summary` |
| Check-in/Check-out | Attendance | POST `/api/resource/Attendance` |

**مثال API Call**:
```typescript
// Mark attendance
async function markAttendance(employeeId: string) {
  const response = await fetch('http://localhost:8000/api/resource/Attendance', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      employee: employeeId,
      attendance_date: new Date().toISOString().split('T')[0],
      status: 'Present'
    })
  })
  return response.json()
}
```

---

### 3. Leave Module

| Component | Frappe DocType | API Endpoint |
|-----------|---------------|--------------|
| `leaves-dashboard.tsx` | Leave Application | `/api/resource/Leave Application` |
| Leave Request Form | Leave Application | POST `/api/resource/Leave Application` |
| Leave Balance Card | Leave Allocation | `/api/resource/Leave Allocation` |

**مثال API Call**:
```typescript
// Apply for leave
async function applyLeave(data: LeaveApplication) {
  const response = await fetch('http://localhost:8000/api/resource/Leave Application', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      employee: data.employee,
      leave_type: data.leave_type,
      from_date: data.from_date,
      to_date: data.to_date,
      description: data.description
    })
  })
  return response.json()
}
```

---

### 4. Payroll Module

| Component | Frappe DocType | API Endpoint |
|-----------|---------------|--------------|
| `payroll-dashboard.tsx` | Salary Slip | `/api/resource/Salary Slip` |
| Salary Structure | Salary Structure | `/api/resource/Salary Structure` |
| Payroll Entry | Payroll Entry | `/api/resource/Payroll Entry` |

---

### 5. Recruitment Module

| Component | Frappe DocType | API Endpoint |
|-----------|---------------|--------------|
| `recruitment-dashboard.tsx` | Job Opening | `/api/resource/Job Opening` |
| Job Applicant | Job Applicant | `/api/resource/Job Applicant` |
| Job Offer | Job Offer | `/api/resource/Job Offer` |

---

## 🔐 Authentication & Authorization

### حالة الـ Authentication الحالية

#### Frappe Backend
```python
# يستخدم Frappe Session Management
# الـ Cookies يتم إرساله تلقائياً مع كل request

@frappe.whitelist()
def get_current_user():
    return frappe.session.user
```

#### Next.js Frontend (مخطط)
```typescript
// سيتم استخدام JWT Tokens
interface AuthResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  user: {
    email: string;
    full_name: string;
    roles: string[];
  }
}

// Login function
async function login(email: string, password: string) {
  const response = await fetch('http://localhost:8000/api/method/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ usr: email, pwd: password })
  })
  return response.json()
}
```

---

## 🚀 Module Navigation Mapping

### التنقل في النظام القديم (Frappe)
```
http://localhost:8000/app/hr
http://localhost:8000/app/employee
http://localhost:8000/app/attendance
http://localhost:8000/app/leave-application
http://localhost:8000/app/salary-slip
```

### التنقل في النظام الجديد (Next.js)
```typescript
// Client-side Module Switching
const [activeModule, setActiveModule] = useState<ModuleType>('hr')

// Modules:
'hr'           → Dashboard الرئيسي
'recruitment'  → التوظيف
'leaves'       → الإجازات
'attendance'   → الحضور
'expenses'     → المصروفات
'performance'  → الأداء
'tenure'       → فترة الخدمة
'payroll'      → الرواتب
'benefits'     → المزايا
'settings'     → الإعدادات
'new-employee' → إضافة موظف جديد
```

---

## 📊 Data Flow Examples

### مثال 1: عرض قائمة الموظفين

#### 1. المستخدم يفتح الصفحة الرئيسية
```
User → http://localhost:3000
```

#### 2. Next.js يقوم بتحميل HR Dashboard
```typescript
// app/page.tsx
export default function HomePage() {
  const [activeModule, setActiveModule] = useState('hr')
  
  return (
    <>
      <Header />
      <Sidebar activeModule={activeModule} onModuleChange={setActiveModule} />
      {activeModule === 'hr' && <HRDashboard />}
    </>
  )
}
```

#### 3. HR Dashboard يطلب البيانات من Frappe
```typescript
// components/hr-dashboard.tsx
useEffect(() => {
  async function fetchEmployeeStats() {
    // API Call to Frappe
    const response = await fetch('http://localhost:8000/api/method/hrms.hr.utils.get_employee_stats')
    const data = await response.json()
    setStats(data.message)
  }
  
  fetchEmployeeStats()
}, [])
```

#### 4. Frappe يرجع البيانات
```python
# hrms/hr/utils.py
@frappe.whitelist()
def get_employee_stats():
    total_employees = frappe.db.count('Employee', {'status': 'Active'})
    present_today = frappe.db.count('Attendance', {
        'attendance_date': today(),
        'status': 'Present'
    })
    on_leave = frappe.db.count('Attendance', {
        'attendance_date': today(),
        'status': 'On Leave'
    })
    
    return {
        'total': total_employees,
        'present': present_today,
        'on_leave': on_leave
    }
```

#### 5. Next.js يعرض البيانات
```typescript
<div className="grid grid-cols-4 gap-6">
  <NumberCard 
    title="Total Employees" 
    value={stats.total} 
  />
  <NumberCard 
    title="Present Today" 
    value={stats.present} 
  />
  <NumberCard 
    title="On Leave" 
    value={stats.on_leave} 
  />
</div>
```

---

### مثال 2: إضافة موظف جديد

#### 1. المستخدم يضغط على "Add Employee"
```typescript
// components/hr-dashboard.tsx
<Button onClick={() => onNavigate('new-employee')}>
  Add Employee
</Button>
```

#### 2. يتم عرض نموذج الموظف
```typescript
// components/employee-profile.tsx
export function EmployeeProfile({ onBack }: Props) {
  const [formData, setFormData] = useState<EmployeeFormData>({})
  
  async function handleSubmit(data: EmployeeFormData) {
    // POST to Frappe API
    const response = await fetch('http://localhost:8000/api/resource/Employee', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    })
    
    if (response.ok) {
      toast.success('Employee created successfully!')
      onBack() // العودة للـ Dashboard
    }
  }
  
  return (
    <form onSubmit={handleSubmit}>
      {/* Form fields */}
    </form>
  )
}
```

#### 3. Frappe يحفظ البيانات
```python
# frappe/desk/form/save.py
@frappe.whitelist()
def savedocs(doc, action):
    doc = frappe.get_doc(json.loads(doc))
    doc.insert() # أو doc.save()
    return doc
```

#### 4. يتم إرجاع الموظف المحفوظ
```json
{
  "data": {
    "name": "HR-EMP-00123",
    "employee_name": "Ahmed Mohamed",
    "status": "Active",
    "company": "Meena Company",
    "creation": "2026-02-07 10:30:00"
  }
}
```

---

## 🛠️ إعداد البيئة المحلية

### 1. تشغيل Frappe Backend

```bash
# في مجلد frappe-bench
cd /home/nader/frappe-bench

# بدء الـ bench
bench start

# في نافذة أخرى - بدء الـ scheduler
bench start --skip-redis scheduler

# الـ backend سيعمل على:
# http://localhost:8000
```

---

### 2. تشغيل Next.js Frontend

```bash
# في مجلد hr-management-system-ui
cd /home/nader/frappe-bench/hr-management-system-ui

# تثبيت الحزم (أول مرة)
pnpm install

# بدء Development Server
pnpm dev

# الـ frontend سيعمل على:
# http://localhost:3000
```

---

### 3. ربط Frontend بـ Backend

#### إضافة CORS في Frappe

```python
# في site_config.json
{
  "allow_cors": "*",
  "cors_headers": [
    "Authorization",
    "Content-Type",
    "Accept"
  ]
}
```

أو في `hooks.py`:
```python
# apps/hrms/hrms/hooks.py
doc_events = {
    "*": {
        "before_insert": "hrms.utils.add_cors_headers"
    }
}
```

---

#### إضافة API Client في Next.js

```typescript
// lib/api-client.ts
const FRAPPE_URL = process.env.NEXT_PUBLIC_FRAPPE_URL || 'http://localhost:8000'

export class FrappeClient {
  private baseUrl: string
  private token: string | null = null
  
  constructor(baseUrl: string = FRAPPE_URL) {
    this.baseUrl = baseUrl
  }
  
  setToken(token: string) {
    this.token = token
  }
  
  private getHeaders() {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    }
    
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`
    }
    
    return headers
  }
  
  async get(endpoint: string) {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: 'GET',
      headers: this.getHeaders()
    })
    return response.json()
  }
  
  async post(endpoint: string, data: any) {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(data)
    })
    return response.json()
  }
  
  async put(endpoint: string, data: any) {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify(data)
    })
    return response.json()
  }
  
  async delete(endpoint: string) {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: 'DELETE',
      headers: this.getHeaders()
    })
    return response.json()
  }
}

// Export singleton instance
export const frappeClient = new FrappeClient()
```

---

#### استخدام API Client

```typescript
// في أي Component
import { frappeClient } from '@/lib/api-client'

// GET request
const employees = await frappeClient.get('/api/resource/Employee')

// POST request
const newEmployee = await frappeClient.post('/api/resource/Employee', {
  employee_name: 'Ahmed Mohamed',
  company: 'Meena Company',
  department: 'Engineering'
})

// PUT request
const updatedEmployee = await frappeClient.put('/api/resource/Employee/HR-EMP-00123', {
  employee_name: 'Ahmed Mohamed Updated'
})

// DELETE request
await frappeClient.delete('/api/resource/Employee/HR-EMP-00123')
```

---

## 📝 العمليات الشائعة (Common Operations)

### 1. الحصول على قائمة الموظفين

#### Frappe API
```http
GET /api/resource/Employee
  ?fields=["name","employee_name","status","department"]
  &filters=[["Employee","status","=","Active"]]
  &limit_page_length=50
  &order_by=creation desc
```

#### Next.js Code
```typescript
async function getEmployees() {
  const params = new URLSearchParams({
    fields: JSON.stringify(['name', 'employee_name', 'status', 'department']),
    filters: JSON.stringify([['Employee', 'status', '=', 'Active']]),
    limit_page_length: '50',
    order_by: 'creation desc'
  })
  
  const response = await frappeClient.get(`/api/resource/Employee?${params}`)
  return response.data
}
```

---

### 2. البحث عن موظف

#### Frappe API
```http
GET /api/resource/Employee
  ?fields=["name","employee_name"]
  &filters=[["Employee","employee_name","like","%ahmed%"]]
```

#### Next.js Code
```typescript
async function searchEmployees(query: string) {
  const params = new URLSearchParams({
    fields: JSON.stringify(['name', 'employee_name', 'department']),
    filters: JSON.stringify([['Employee', 'employee_name', 'like', `%${query}%`]])
  })
  
  const response = await frappeClient.get(`/api/resource/Employee?${params}`)
  return response.data
}
```

---

### 3. الحصول على تفاصيل موظف واحد

#### Frappe API
```http
GET /api/resource/Employee/HR-EMP-00123
```

#### Next.js Code
```typescript
async function getEmployee(employeeId: string) {
  const response = await frappeClient.get(`/api/resource/Employee/${employeeId}`)
  return response.data
}
```

---

### 4. تحديث بيانات موظف

#### Frappe API
```http
PUT /api/resource/Employee/HR-EMP-00123
Content-Type: application/json

{
  "employee_name": "Ahmed Mohamed Updated",
  "department": "Sales"
}
```

#### Next.js Code
```typescript
async function updateEmployee(employeeId: string, updates: Partial<Employee>) {
  const response = await frappeClient.put(
    `/api/resource/Employee/${employeeId}`,
    updates
  )
  return response.data
}
```

---

### 5. حذف موظف

#### Frappe API
```http
DELETE /api/resource/Employee/HR-EMP-00123
```

#### Next.js Code
```typescript
async function deleteEmployee(employeeId: string) {
  await frappeClient.delete(`/api/resource/Employee/${employeeId}`)
}
```

---

## 🎨 UI Components Mapping

### الأزرار (Buttons)

#### Frappe UI
```javascript
frappe.ui.form.make_control({
    df: {
        fieldname: 'save_button',
        fieldtype: 'Button',
        label: 'Save'
    },
    parent: wrapper,
    only_input: true
});
```

#### Next.js UI
```typescript
import { Button } from '@/components/ui/button'

<Button variant="default" size="lg">
  Save
</Button>
```

---

### الحقول (Input Fields)

#### Frappe UI
```javascript
frappe.ui.form.make_control({
    df: {
        fieldname: 'employee_name',
        fieldtype: 'Data',
        label: 'Employee Name'
    },
    parent: wrapper
});
```

#### Next.js UI
```typescript
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

<div>
  <Label htmlFor="employee_name">Employee Name</Label>
  <Input 
    id="employee_name" 
    value={employeeName}
    onChange={(e) => setEmployeeName(e.target.value)}
  />
</div>
```

---

### القوائم المنسدلة (Dropdowns)

#### Frappe UI
```javascript
frappe.ui.form.make_control({
    df: {
        fieldname: 'department',
        fieldtype: 'Link',
        options: 'Department',
        label: 'Department'
    },
    parent: wrapper
});
```

#### Next.js UI
```typescript
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

<Select value={department} onValueChange={setDepartment}>
  <SelectTrigger>
    <SelectValue placeholder="Select Department" />
  </SelectTrigger>
  <SelectContent>
    <SelectItem value="HR">HR</SelectItem>
    <SelectItem value="Engineering">Engineering</SelectItem>
    <SelectItem value="Sales">Sales</SelectItem>
  </SelectContent>
</Select>
```

---

### التواريخ (Date Pickers)

#### Frappe UI
```javascript
frappe.ui.form.make_control({
    df: {
        fieldname: 'date_of_joining',
        fieldtype: 'Date',
        label: 'Date of Joining'
    },
    parent: wrapper
});
```

#### Next.js UI
```typescript
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

<Popover>
  <PopoverTrigger asChild>
    <Button variant="outline">
      {date ? format(date, 'PPP') : 'Pick a date'}
    </Button>
  </PopoverTrigger>
  <PopoverContent>
    <Calendar mode="single" selected={date} onSelect={setDate} />
  </PopoverContent>
</Popover>
```

---

### الجداول (Tables)

#### Frappe UI
```javascript
frappe.render_template('employee_list', {
    employees: employee_data
});
```

#### Next.js UI
```typescript
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

<Table>
  <TableHeader>
    <TableRow>
      <TableHead>Name</TableHead>
      <TableHead>Department</TableHead>
      <TableHead>Status</TableHead>
    </TableRow>
  </TableHeader>
  <TableBody>
    {employees.map((emp) => (
      <TableRow key={emp.name}>
        <TableCell>{emp.employee_name}</TableCell>
        <TableCell>{emp.department}</TableCell>
        <TableCell>{emp.status}</TableCell>
      </TableRow>
    ))}
  </TableBody>
</Table>
```

---

## 🔄 State Management

### في Frappe (القديم)
```javascript
// يستخدم jQuery و Global Variables
var employee_data = [];

function load_employees() {
    frappe.call({
        method: 'hrms.api.get_employees',
        callback: function(r) {
            employee_data = r.message;
            render_employees();
        }
    });
}
```

### في Next.js (الجديد)
```typescript
// يستخدم React Hooks
import { useState, useEffect } from 'react'

function EmployeesList() {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)
  
  useEffect(() => {
    async function loadEmployees() {
      setLoading(true)
      const data = await frappeClient.get('/api/resource/Employee')
      setEmployees(data.data)
      setLoading(false)
    }
    
    loadEmployees()
  }, [])
  
  if (loading) return <LoadingSpinner />
  
  return <EmployeesTable employees={employees} />
}
```

---

## 📱 Responsive Design

### Frappe UI (محدود)
```css
/* يستخدم Bootstrap Classes */
<div class="row">
  <div class="col-md-6">Content</div>
</div>
```

### Next.js UI (متقدم)
```typescript
// يستخدم Tailwind CSS Breakpoints
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
  <Card>Content</Card>
</div>

// Conditional rendering للموبايل
import { useMediaQuery } from '@/hooks/use-mobile'

function ResponsiveComponent() {
  const isMobile = useMediaQuery('(max-width: 768px)')
  
  return isMobile ? <MobileView /> : <DesktopView />
}
```

---

## 🚦 خطة الانتقال (Migration Plan)

### المرحلة 1: التجهيز (Preparation) ✓
- [x] إعداد مشروع Next.js
- [x] تثبيت المكونات الأساسية
- [x] إنشاء Header & Sidebar
- [x] إنشاء HR Dashboard

### المرحلة 2: التكامل الأساسي (Basic Integration) 🚧
- [ ] إعداد API Client
- [ ] تفعيل CORS في Frappe
- [ ] تطبيق Authentication
- [ ] ربط الصفحة الرئيسية بـ Backend

### المرحلة 3: بناء الصفحات (Pages Development) 📅
- [ ] صفحة قائمة الموظفين
- [ ] صفحة تفاصيل الموظف
- [ ] صفحة الحضور والانصراف
- [ ] صفحة طلبات الإجازات
- [ ] صفحة الرواتب
- [ ] صفحة التوظيف

### المرحلة 4: المميزات المتقدمة (Advanced Features) 📅
- [ ] Real-time Notifications
- [ ] Advanced Search & Filters
- [ ] Bulk Operations
- [ ] Export to Excel/PDF
- [ ] Print Functionality
- [ ] Reports & Analytics

### المرحلة 5: الاختبار والإطلاق (Testing & Launch) 📅
- [ ] Unit Testing
- [ ] Integration Testing
- [ ] E2E Testing
- [ ] Performance Optimization
- [ ] Security Audit
- [ ] Production Deployment

---

## 🔍 مثال تطبيقي كامل: صفحة الموظفين

### 1. Backend API (Frappe)

```python
# apps/hrms/hrms/api/employee.py
import frappe

@frappe.whitelist()
def get_employees_with_stats():
    """Get all employees with attendance stats"""
    employees = frappe.get_all(
        'Employee',
        fields=['name', 'employee_name', 'department', 'designation', 'status', 'image'],
        filters={'status': 'Active'},
        order_by='employee_name asc'
    )
    
    for emp in employees:
        # Get attendance stats for current month
        emp['attendance_stats'] = get_employee_attendance_stats(emp['name'])
        
        # Get leave balance
        emp['leave_balance'] = get_employee_leave_balance(emp['name'])
    
    return employees

@frappe.whitelist()
def get_employee_attendance_stats(employee_id):
    from frappe.utils import getdate, get_first_day
    
    first_day = get_first_day(getdate())
    
    stats = frappe.db.sql("""
        SELECT 
            COUNT(*) as total_days,
            SUM(CASE WHEN status = 'Present' THEN 1 ELSE 0 END) as present,
            SUM(CASE WHEN status = 'Absent' THEN 1 ELSE 0 END) as absent,
            SUM(CASE WHEN status = 'On Leave' THEN 1 ELSE 0 END) as on_leave
        FROM `tabAttendance`
        WHERE employee = %s 
          AND attendance_date >= %s
    """, (employee_id, first_day), as_dict=True)
    
    return stats[0] if stats else {}
```

---

### 2. Frontend Component (Next.js)

```typescript
// components/employees-list.tsx
'use client'

import { useState, useEffect } from 'react'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Search, UserPlus, Download } from 'lucide-react'
import { frappeClient } from '@/lib/api-client'

interface Employee {
  name: string
  employee_name: string
  department: string
  designation: string
  status: string
  image: string
  attendance_stats: {
    total_days: number
    present: number
    absent: number
    on_leave: number
  }
  leave_balance: {
    annual_leave: number
    sick_leave: number
  }
}

export function EmployeesList() {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [filteredEmployees, setFilteredEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  
  // Load employees on mount
  useEffect(() => {
    loadEmployees()
  }, [])
  
  // Filter employees when search query changes
  useEffect(() => {
    if (searchQuery) {
      const filtered = employees.filter(emp => 
        emp.employee_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        emp.department?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        emp.designation?.toLowerCase().includes(searchQuery.toLowerCase())
      )
      setFilteredEmployees(filtered)
    } else {
      setFilteredEmployees(employees)
    }
  }, [searchQuery, employees])
  
  async function loadEmployees() {
    try {
      setLoading(true)
      const response = await frappeClient.get('/api/method/hrms.api.employee.get_employees_with_stats')
      setEmployees(response.message)
      setFilteredEmployees(response.message)
    } catch (error) {
      console.error('Failed to load employees:', error)
    } finally {
      setLoading(false)
    }
  }
  
  function getAttendanceRate(stats: Employee['attendance_stats']) {
    if (!stats.total_days) return 0
    return Math.round((stats.present / stats.total_days) * 100)
  }
  
  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    )
  }
  
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Employees</h1>
          <p className="text-muted-foreground mt-1">
            Manage your organization's employees
          </p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" size="sm">
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
          <Button size="sm">
            <UserPlus className="w-4 h-4 mr-2" />
            Add Employee
          </Button>
        </div>
      </div>
      
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Employees
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{employees.length}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Active Today
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">
              {employees.filter(e => e.attendance_stats?.present > 0).length}
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              On Leave
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-orange-600">
              {employees.filter(e => e.attendance_stats?.on_leave > 0).length}
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Departments
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {new Set(employees.map(e => e.department).filter(Boolean)).size}
            </div>
          </CardContent>
        </Card>
      </div>
      
      {/* Search Bar */}
      <Card>
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <Input
              placeholder="Search employees by name, department, or designation..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>
      
      {/* Employees Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Designation</TableHead>
                <TableHead>Attendance Rate</TableHead>
                <TableHead>Leave Balance</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredEmployees.map((employee) => (
                <TableRow key={employee.name}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      {employee.image ? (
                        <img 
                          src={employee.image} 
                          alt={employee.employee_name}
                          className="w-10 h-10 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                          <span className="text-primary font-semibold">
                            {employee.employee_name.charAt(0)}
                          </span>
                        </div>
                      )}
                      <div>
                        <div className="font-medium">{employee.employee_name}</div>
                        <div className="text-sm text-muted-foreground">{employee.name}</div>
                      </div>
                    </div>
                  </TableCell>
                  
                  <TableCell>{employee.department || '-'}</TableCell>
                  
                  <TableCell>{employee.designation || '-'}</TableCell>
                  
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="w-full bg-gray-200 rounded-full h-2 max-w-[100px]">
                        <div 
                          className="bg-green-600 h-2 rounded-full"
                          style={{ width: `${getAttendanceRate(employee.attendance_stats)}%` }}
                        />
                      </div>
                      <span className="text-sm font-medium">
                        {getAttendanceRate(employee.attendance_stats)}%
                      </span>
                    </div>
                  </TableCell>
                  
                  <TableCell>
                    <div className="text-sm">
                      <div>Annual: {employee.leave_balance?.annual_leave || 0}</div>
                      <div className="text-muted-foreground">Sick: {employee.leave_balance?.sick_leave || 0}</div>
                    </div>
                  </TableCell>
                  
                  <TableCell>
                    <Badge variant={employee.status === 'Active' ? 'default' : 'secondary'}>
                      {employee.status}
                    </Badge>
                  </TableCell>
                  
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm">
                      View Details
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          
          {filteredEmployees.length === 0 && (
            <div className="text-center py-12">
              <p className="text-muted-foreground">No employees found</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
```

---

## 📚 الموارد الإضافية

### التوثيق الموجود
1. **HR_PAGES_DOCUMENTATION.md** - توثيق شامل لجميع صفحات الـ HR
2. **HR_ROUTING_GUIDE.md** - دليل التوجيه والتنقل
3. **HR_UX_FLOW_GUIDE.md** - دليل تجربة المستخدم
4. **HR_DASHBOARD_INDEX.md** - فهرس رئيسي للـ Dashboard

### موارد Frappe
- [Frappe Framework Docs](https://frappeframework.com/docs)
- [ERPNext HRMS Docs](https://docs.erpnext.com/docs/user/manual/en/human-resources)
- [Frappe REST API](https://frappeframework.com/docs/user/en/api)

### موارد Next.js
- [Next.js Documentation](https://nextjs.org/docs)
- [React Documentation](https://react.dev)
- [TypeScript Documentation](https://www.typescriptlang.org/docs)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
- [Radix UI Documentation](https://www.radix-ui.com/docs/primitives)

---

## 🎯 الخلاصة

هذا النظام يجمع بين قوة **Frappe/ERPNext** في إدارة البيانات وال Business Logic مع جمال و سلاسة **Next.js/React** في تجربة المستخدم.

### المميزات الرئيسية:
✅ **Backend قوي**: Frappe Framework + ERPNext HRMS  
✅ **Frontend حديث**: Next.js 16 + React 19 + TypeScript  
✅ **تصميم احترافي**: Tailwind CSS + Radix UI  
✅ **أداء عالي**: Server-side rendering + Client-side caching  
✅ **Type-safe**: TypeScript في كل مكان  
✅ **قابل للتوسع**: Component-based architecture  
✅ **سهل الصيانة**: Clean code + Best practices  

### الخطوات التالية:
1. إكمال التكامل مع Frappe API
2. تطبيق Authentication & Authorization
3. بناء باقي الصفحات والمكونات
4. إضافة Tests وال Documentation
5. Deployment إلى Production

---

**تاريخ الإنشاء**: 7 فبراير 2026  
**آخر تحديث**: 7 فبراير 2026  
**الإصدار**: 1.0.0  
**المؤلف**: Meena Base App Team  

---

