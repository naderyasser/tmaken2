# HRMS Admin Frontend API Documentation
## دليل شامل لـ APIs نظام إدارة الموارد البشرية للفرونت إند الإداري

---

## 📋 جدول المحتويات
1. [HR Settings - الإعدادات العامة](#hr-settings)
2. [Employee APIs - إدارة الموظفين](#employee-apis)
3. [Attendance APIs - الحضور والانصراف](#attendance-apis)
4. [Location Tracking APIs - تتبع المواقع](#location-tracking-apis)
5. [Radius Alert APIs - تنبيهات المسافة](#radius-alert-apis)
6. [Shift Management APIs - إدارة الشفتات](#shift-management-apis)
7. [Reports - التقارير](#reports)
8. [Check-in Methods - طرق الحضور](#checkin-methods)

---

## HR Settings - الإعدادات العامة

### نظرة عامة
HR Settings هي الإعدادات المركزية لكل نظام الموارد البشرية. يمكن للـ HR Manager التحكم في كل الخصائص من مكان واحد.

### الوصول للإعدادات
**المسار:** `HR > Settings > HR Settings`

**الصلاحيات المطلوبة:**
- HR Manager: قراءة وكتابة ✅
- HR User: قراءة فقط 👁️
- System Manager: كامل الصلاحيات ✅

---

### إعدادات الموظفين (Employee Settings)

#### 1. Employee Naming By
**الحقل:** `emp_created_by`
**الخيارات:**
- `Naming Series`: ترقيم تلقائي (HR-EMP-00001)
- `Employee Number`: استخدام رقم الموظف
- `Full Name`: استخدام الاسم الكامل

**مثال API:**
```javascript
frappe.call({
    method: 'frappe.client.set_value',
    args: {
        doctype: 'HR Settings',
        name: 'HR Settings',
        fieldname: 'emp_created_by',
        value: 'Naming Series'
    }
});
```

#### 2. Retirement Age
**الحقل:** `retirement_age`
**الوصف:** سن التقاعد الافتراضي بالسنوات

#### 3. Standard Working Hours
**الحقل:** `standard_working_hours`
**الوصف:** ساعات العمل القياسية في اليوم (مثال: 8.0)

---

### إعدادات الحضور (Attendance Settings)

#### 1. Allow Employee Checkin from Mobile App ✅
**الحقل:** `allow_employee_checkin_from_mobile_app`
**القيمة الافتراضية:** `1` (مفعّل)
**الوصف:** السماح للموظفين بتسجيل الحضور من تطبيق الموبايل

**مثال تفعيل/تعطيل:**
```javascript
// تفعيل
frappe.call({
    method: 'frappe.client.set_value',
    args: {
        doctype: 'HR Settings',
        name: 'HR Settings',
        fieldname: 'allow_employee_checkin_from_mobile_app',
        value: 1
    },
    callback: function(r) {
        frappe.show_alert({
            message: __('Mobile checkin enabled'),
            indicator: 'green'
        });
    }
});

// تعطيل
frappe.call({
    method: 'frappe.client.set_value',
    args: {
        doctype: 'HR Settings',
        name: 'HR Settings',
        fieldname: 'allow_employee_checkin_from_mobile_app',
        value: 0
    }
});
```

---

#### 2. Allow Geolocation Tracking 🗺️
**الحقل:** `allow_geolocation_tracking`
**القيمة الافتراضية:** `0` (معطّل)
**الوصف:** تفعيل تتبع المواقع الجغرافية للموظفين

**⚠️ مهم جداً:** يجب تفعيل هذا الإعداد لاستخدام:
- تتبع المواقع
- تنبيهات المسافة (Radius Alerts)
- عرض الحركة على الخريطة
- حفظ إحداثيات GPS

**مثال التفعيل:**
```javascript
// التفعيل من الكود
frappe.call({
    method: 'frappe.client.set_value',
    args: {
        doctype: 'HR Settings',
        name: 'HR Settings',
        fieldname: 'allow_geolocation_tracking',
        value: 1
    },
    callback: function(r) {
        frappe.msgprint({
            title: __('Location Tracking Enabled'),
            message: __('Employees can now be tracked. Make sure to get their consent in Employee Location Settings.'),
            indicator: 'green'
        });
    }
});

// من Terminal
bench --site your-site console
frappe.db.set_single_value("HR Settings", "allow_geolocation_tracking", 1)
frappe.db.commit()
```

**التحقق من الحالة:**
```javascript
frappe.call({
    method: 'frappe.client.get_value',
    args: {
        doctype: 'HR Settings',
        fieldname: 'allow_geolocation_tracking'
    },
    callback: function(r) {
        if (r.message.allow_geolocation_tracking) {
            console.log('Location tracking is enabled');
        } else {
            console.log('Location tracking is disabled');
        }
    }
});
```

---

### إعدادات الشفتات (Shift Settings)

#### Allow Multiple Shift Assignments
**الحقل:** `allow_multiple_shift_assignments`
**القيمة الافتراضية:** `0`
**الوصف:** السماح بتعيين أكثر من شفت للموظف في نفس اليوم

**مثال:**
```javascript
frappe.call({
    method: 'frappe.client.set_value',
    args: {
        doctype: 'HR Settings',
        name: 'HR Settings',
        fieldname: 'allow_multiple_shift_assignments',
        value: 1
    }
});
```

---

### إعدادات الإجازات (Leave Settings)

#### 1. Leave Approver Mandatory
**الحقل:** `leave_approver_mandatory_in_leave_application`
**القيمة الافتراضية:** `1`
**الوصف:** إلزامية تحديد مدير الإجازات

#### 2. Prevent Self Leave Approval
**الحقل:** `prevent_self_leave_approval`
**القيمة الافتراضية:** `0`
**الوصف:** منع الموظف من الموافقة على إجازته الخاصة

#### 3. Restrict Backdated Leave Application
**الحقل:** `restrict_backdated_leave_application`
**القيمة الافتراضية:** `0`
**الوصف:** منع طلبات الإجازة بأثر رجعي

#### 4. Send Leave Notification
**الحقل:** `send_leave_notification`
**القيمة الافتراضية:** `1`
**الوصف:** إرسال إشعارات البريد للإجازات

**مثال التحكم الشامل:**
```javascript
// تعطيل الموافقة الذاتية ومنع الإجازات المؤرخة
async function configureLeaveSettings() {
    await frappe.call({
        method: 'frappe.client.set_value',
        args: {
            doctype: 'HR Settings',
            name: 'HR Settings',
            fieldname: {
                'prevent_self_leave_approval': 1,
                'restrict_backdated_leave_application': 1,
                'leave_approver_mandatory_in_leave_application': 1
            }
        }
    });
    
    frappe.show_alert({
        message: __('Leave settings configured'),
        indicator: 'green'
    });
}
```

---

### إعدادات التنبيهات (Reminders Settings)

#### 1. Send Birthday Reminders
**الحقل:** `send_birthday_reminders`
**القيمة الافتراضية:** `1`

#### 2. Send Work Anniversary Reminders
**الحقل:** `send_work_anniversary_reminders`
**القيمة الافتراضية:** `1`

#### 3. Send Holiday Reminders
**الحقل:** `send_holiday_reminders`
**القيمة الافتراضية:** `1`

#### 4. Frequency
**الحقل:** `frequency`
**الخيارات:** `Weekly` | `Monthly`

**مثال:**
```javascript
// تفعيل كل التنبيهات
frappe.call({
    method: 'frappe.client.set_value',
    args: {
        doctype: 'HR Settings',
        name: 'HR Settings',
        fieldname: {
            'send_birthday_reminders': 1,
            'send_work_anniversary_reminders': 1,
            'send_holiday_reminders': 1,
            'frequency': 'Weekly'
        }
    }
});
```

---

### إعدادات التوظيف (Hiring Settings)

#### 1. Check Vacancies
**الحقل:** `check_vacancies`
**الوصف:** التحقق من الشواغر عند إنشاء عرض عمل

#### 2. Send Interview Reminder
**الحقل:** `send_interview_reminder`
**الوصف:** إرسال تذكير بالمقابلات

#### 3. Remind Before
**الحقل:** `remind_before`
**الوصف:** وقت التذكير قبل المقابلة (مثال: 00:15:00)

---

### إعدادات المصروفات (Expense Settings)

#### 1. Expense Approver Mandatory
**الحقل:** `expense_approver_mandatory_in_expense_claim`
**القيمة الافتراضية:** `1`

#### 2. Prevent Self Expense Approval
**الحقل:** `prevent_self_expense_approval`
**القيمة الافتراضية:** `0`

---

## 🔧 API للحصول على جميع الإعدادات

### Get HR Settings
```javascript
// الحصول على كل الإعدادات
frappe.call({
    method: 'frappe.client.get',
    args: {
        doctype: 'HR Settings',
        name: 'HR Settings'
    },
    callback: function(r) {
        let settings = r.message;
        console.log('Geolocation:', settings.allow_geolocation_tracking);
        console.log('Mobile Checkin:', settings.allow_employee_checkin_from_mobile_app);
        console.log('Multiple Shifts:', settings.allow_multiple_shift_assignments);
    }
});
```

### Get Specific Setting
```javascript
// الحصول على إعداد محدد
frappe.db.get_single_value('HR Settings', 'allow_geolocation_tracking')
    .then(value => {
        console.log('Location tracking:', value);
    });
```

### Update Multiple Settings
```javascript
// تحديث عدة إعدادات مرة واحدة
frappe.call({
    method: 'frappe.client.set_value',
    args: {
        doctype: 'HR Settings',
        name: 'HR Settings',
        fieldname: {
            'allow_geolocation_tracking': 1,
            'allow_employee_checkin_from_mobile_app': 1,
            'allow_multiple_shift_assignments': 1,
            'prevent_self_leave_approval': 1,
            'standard_working_hours': 8.0
        }
    },
    callback: function(r) {
        frappe.show_alert({
            message: __('Settings updated successfully'),
            indicator: 'green'
        });
    }
});
```

---

## 🎛️ لوحة تحكم شاملة للإعدادات

### مثال: إنشاء صفحة إعدادات مخصصة

```javascript
class HRSettingsPanel {
    constructor() {
        this.settings = {};
        this.load();
    }
    
    async load() {
        const r = await frappe.call({
            method: 'frappe.client.get',
            args: {
                doctype: 'HR Settings',
                name: 'HR Settings'
            }
        });
        
        this.settings = r.message;
        this.render();
    }
    
    render() {
        let html = `
            <div class="hr-settings-panel">
                <h3>إعدادات الحضور</h3>
                <div class="setting-item">
                    <label>
                        <input type="checkbox" 
                               id="allow_geolocation_tracking" 
                               ${this.settings.allow_geolocation_tracking ? 'checked' : ''}>
                        تفعيل التتبع الجغرافي
                    </label>
                </div>
                
                <div class="setting-item">
                    <label>
                        <input type="checkbox" 
                               id="allow_employee_checkin_from_mobile_app" 
                               ${this.settings.allow_employee_checkin_from_mobile_app ? 'checked' : ''}>
                        السماح بالحضور من الموبايل
                    </label>
                </div>
                
                <div class="setting-item">
                    <label>
                        <input type="checkbox" 
                               id="allow_multiple_shift_assignments" 
                               ${this.settings.allow_multiple_shift_assignments ? 'checked' : ''}>
                        السماح بشفتات متعددة في نفس اليوم
                    </label>
                </div>
                
                <h3>إعدادات الإجازات</h3>
                <div class="setting-item">
                    <label>
                        <input type="checkbox" 
                               id="prevent_self_leave_approval" 
                               ${this.settings.prevent_self_leave_approval ? 'checked' : ''}>
                        منع الموافقة الذاتية على الإجازات
                    </label>
                </div>
                
                <div class="setting-item">
                    <label>
                        <input type="checkbox" 
                               id="restrict_backdated_leave_application" 
                               ${this.settings.restrict_backdated_leave_application ? 'checked' : ''}>
                        منع الإجازات بأثر رجعي
                    </label>
                </div>
                
                <button class="btn btn-primary" onclick="hrSettingsPanel.save()">
                    حفظ الإعدادات
                </button>
            </div>
        `;
        
        $('#settings-container').html(html);
    }
    
    async save() {
        const settings = {
            'allow_geolocation_tracking': $('#allow_geolocation_tracking').is(':checked') ? 1 : 0,
            'allow_employee_checkin_from_mobile_app': $('#allow_employee_checkin_from_mobile_app').is(':checked') ? 1 : 0,
            'allow_multiple_shift_assignments': $('#allow_multiple_shift_assignments').is(':checked') ? 1 : 0,
            'prevent_self_leave_approval': $('#prevent_self_leave_approval').is(':checked') ? 1 : 0,
            'restrict_backdated_leave_application': $('#restrict_backdated_leave_application').is(':checked') ? 1 : 0
        };
        
        await frappe.call({
            method: 'frappe.client.set_value',
            args: {
                doctype: 'HR Settings',
                name: 'HR Settings',
                fieldname: settings
            }
        });
        
        frappe.show_alert({
            message: __('Settings saved successfully'),
            indicator: 'green'
        });
        
        this.load(); // Reload to show updated values
    }
}

// Usage
let hrSettingsPanel = new HRSettingsPanel();
```

---

## ⚙️ تطبيق الإعدادات على مستوى الموظف

بعض الإعدادات يمكن تخصيصها لكل موظف في **Employee Location Settings**:

### مثال: تفعيل التتبع لموظف واحد
```javascript
frappe.call({
    method: 'frappe.client.set_value',
    args: {
        doctype: 'Employee Location Settings',
        name: 'HR-EMP-00001',
        fieldname: {
            'enable_tracking': 1,
            'employee_consent': 1,
            'tracking_interval': 'Minutes',
            'interval_number': 5
        }
    }
});
```

### مثال: تفعيل التتبع لعدة موظفين
```javascript
async function enableTrackingForEmployees(employees) {
    for (let emp of employees) {
        await frappe.call({
            method: 'frappe.client.insert',
            args: {
                doc: {
                    doctype: 'Employee Location Settings',
                    employee: emp,
                    enable_tracking: 1,
                    employee_consent: 1,
                    tracking_interval: 'Minutes',
                    interval_number: 5
                }
            }
        });
    }
    
    frappe.show_alert({
        message: __(`Tracking enabled for ${employees.length} employees`),
        indicator: 'green'
    });
}

// Usage
enableTrackingForEmployees(['HR-EMP-00001', 'HR-EMP-00002', 'HR-EMP-00003']);
```

---

## 📋 Checklist للإعدادات الأساسية

عند إعداد النظام لأول مرة، تأكد من:

### إعدادات الحضور:
- [ ] تفعيل `allow_geolocation_tracking` إذا كنت تريد التتبع
- [ ] تفعيل `allow_employee_checkin_from_mobile_app` للموبايل
- [ ] تحديد `standard_working_hours`

### إعدادات الإجازات:
- [ ] تفعيل `send_leave_notification`
- [ ] تحديد `leave_approval_notification_template`
- [ ] تفعيل `prevent_self_leave_approval` (موصى به)

### إعدادات الشفتات:
- [ ] تحديد `allow_multiple_shift_assignments` حسب الحاجة

### إعدادات التنبيهات:
- [ ] تفعيل التنبيهات المطلوبة
- [ ] تحديد `frequency` للتنبيهات
- [ ] تحديد `sender` و `sender_email`

---

## 🔐 الصلاحيات والأمان

### من يمكنه تعديل HR Settings؟
- ✅ **System Manager**: كامل الصلاحيات
- ✅ **HR Manager**: قراءة وكتابة
- 👁️ **HR User**: قراءة فقط
- 👁️ **Employee**: قراءة محدودة

### أفضل الممارسات:
1. قم بتغيير الإعدادات الحساسة من حساب HR Manager فقط
2. راجع سجل التغييرات (Track Changes مفعّل)
3. اختبر الإعدادات على موظف واحد قبل التطبيق الشامل
4. احتفظ بنسخة احتياطية قبل التغييرات الكبيرة

---

## Employee APIs - إدارة الموظفين

### 1. البحث عن الموظفين
**Endpoint:** `hrms.hr.api.employee_search_api.search_employees`

**الوصف:** البحث عن الموظفين بمعايير متعددة

**Parameters:**
- `query` (str, optional): نص البحث (يبحث في الاسم، رقم الموظف، البريد الإلكتروني، رقم الهاتف)
- `filters` (dict, optional): فلاتر إضافية
  - `department` (str): القسم
  - `designation` (str): المسمى الوظيفي
  - `company` (str): الشركة
  - `branch` (str): الفرع
  - `status` (str): الحالة (افتراضياً "Active")
- `limit` (int, optional): الحد الأقصى للنتائج (افتراضياً 20)

**Example Request:**
```javascript
frappe.call({
    method: 'hrms.hr.api.employee_search_api.search_employees',
    args: {
        query: 'أحمد',
        filters: {
            department: 'HR Department',
            status: 'Active'
        },
        limit: 10
    },
    callback: function(r) {
        console.log(r.message);
    }
});
```

**Response:**
```json
[
    {
        "name": "HR-EMP-00001",
        "employee_id": "EMP001",
        "employee_name": "أحمد محمد",
        "company_email": "ahmed@company.com",
        "personal_email": "ahmed@gmail.com",
        "cell_number": "+966501234567",
        "gender": "Male",
        "date_of_birth": "1990-01-15",
        "date_of_joining": "2020-03-01",
        "department": "HR Department",
        "designation": "HR Manager",
        "company": "شركة النموذج",
        "branch": "الفرع الرئيسي",
        "grade": "A",
        "reports_to": "HR-EMP-00005",
        "status": "Active",
        "image": "/files/ahmed.jpg"
    }
]
```

---

### 2. الحصول على موظف بالرقم
**Endpoint:** `hrms.hr.api.employee_search_api.get_employee_by_id`

**الوصف:** الحصول على بيانات موظف باستخدام employee_id

**Parameters:**
- `employee_id` (str, required): رقم الموظف

**Example Request:**
```javascript
frappe.call({
    method: 'hrms.hr.api.employee_search_api.get_employee_by_id',
    args: {
        employee_id: 'EMP001'
    },
    callback: function(r) {
        console.log(r.message);
    }
});
```

---

### 3. تفاصيل موظف شاملة
**Endpoint:** `hrms.hr.api.employee_search_api.get_employee_details`

**الوصف:** الحصول على معلومات شاملة عن الموظف بما فيها الحضور، الشفت، إعدادات التتبع

**Parameters:**
- `employee` (str, required): اسم الموظف (المفتاح الأساسي)

**Example Request:**
```javascript
frappe.call({
    method: 'hrms.hr.api.employee_search_api.get_employee_details',
    args: {
        employee: 'HR-EMP-00001'
    },
    callback: function(r) {
        console.log(r.message);
    }
});
```

**Response:**
```json
{
    "name": "HR-EMP-00001",
    "employee_id": "EMP001",
    "employee_name": "أحمد محمد",
    "company_email": "ahmed@company.com",
    "department": "HR Department",
    "designation": "HR Manager",
    "current_shift": {
        "shift_type": "Morning Shift",
        "start_time": "08:00:00",
        "end_time": "16:00:00",
        "color": "#3498db"
    },
    "location_settings": {
        "enable_tracking": 1,
        "employee_consent": 1,
        "checkin_method": "Photo + Biometric",
        "enable_radius_alert": 1,
        "alert_radius": 500
    },
    "recent_attendance": [
        {
            "attendance_date": "2026-02-09",
            "status": "Present",
            "shift": "Morning Shift",
            "in_time": "2026-02-09 08:15:00",
            "out_time": "2026-02-09 16:30:00",
            "working_hours": 8.25
        }
    ]
}
```

---

### 4. الموظفين حسب القسم
**Endpoint:** `hrms.hr.api.employee_search_api.get_employees_by_department`

**Parameters:**
- `department` (str, required): اسم القسم
- `include_child_departments` (int, optional): تضمين الأقسام الفرعية (0 أو 1)

---

### 5. الموظفين حسب المسمى الوظيفي
**Endpoint:** `hrms.hr.api.employee_search_api.get_employees_by_designation`

**Parameters:**
- `designation` (str, required): المسمى الوظيفي

---

### 6. الهيكل التنظيمي للموظف
**Endpoint:** `hrms.hr.api.employee_search_api.get_employee_hierarchy`

**الوصف:** الحصول على المدير المباشر والمرؤوسين للموظف

**Parameters:**
- `employee` (str, required): اسم الموظف

**Response:**
```json
{
    "employee": {
        "name": "HR-EMP-00001",
        "employee_id": "EMP001",
        "employee_name": "أحمد محمد",
        "designation": "HR Manager"
    },
    "manager": {
        "name": "HR-EMP-00005",
        "employee_id": "EMP005",
        "employee_name": "خالد أحمد",
        "designation": "HR Director"
    },
    "subordinates": [
        {
            "name": "HR-EMP-00010",
            "employee_id": "EMP010",
            "employee_name": "سارة علي",
            "designation": "HR Specialist"
        }
    ]
}
```

---

### 7. إحصائيات الموظف
**Endpoint:** `hrms.hr.api.employee_search_api.get_employee_statistics`

**الوصف:** الحصول على إحصائيات الحضور، الإجازات، التأخير والخروج المبكر

**Parameters:**
- `employee` (str, required): اسم الموظف

**Response:**
```json
{
    "attendance_summary": {
        "Present": 18,
        "Absent": 1,
        "On Leave": 2
    },
    "leave_balance": [
        {
            "leave_type": "Annual Leave",
            "total_leaves_allocated": 30,
            "unused_leaves": 22
        }
    ],
    "late_entries": 3,
    "early_exits": 1
}
```

---

### 8. تحديث جماعي للموظفين
**Endpoint:** `hrms.hr.api.employee_search_api.bulk_update_employees`

**الوصف:** تحديث حقل معين لعدة موظفين

**Parameters:**
- `employees` (list, required): قائمة أسماء الموظفين
- `field` (str, required): الحقل المراد تحديثه
  - الحقول المسموحة: `department`, `designation`, `branch`, `grade`, `reports_to`, `company_email`, `cell_number`
- `value` (any, required): القيمة الجديدة

**Example Request:**
```javascript
frappe.call({
    method: 'hrms.hr.api.employee_search_api.bulk_update_employees',
    args: {
        employees: ['HR-EMP-00001', 'HR-EMP-00002', 'HR-EMP-00003'],
        field: 'department',
        value: 'IT Department'
    },
    callback: function(r) {
        frappe.msgprint(r.message.message);
    }
});
```

---

## Attendance APIs - الحضور والانصراف

### 1. الحصول على سجلات الحضور
**Endpoint:** `frappe.client.get_list`

**Example:**
```javascript
frappe.call({
    method: 'frappe.client.get_list',
    args: {
        doctype: 'Attendance',
        filters: {
            employee: 'HR-EMP-00001',
            attendance_date: ['between', ['2026-02-01', '2026-02-28']],
            docstatus: 1
        },
        fields: ['name', 'attendance_date', 'status', 'shift', 'in_time', 'out_time', 'working_hours', 'late_entry', 'early_exit'],
        order_by: 'attendance_date desc',
        limit: 50
    },
    callback: function(r) {
        console.log(r.message);
    }
});
```

---

### 2. إنشاء سجل حضور
**Endpoint:** `frappe.client.insert`

**Example:**
```javascript
frappe.call({
    method: 'frappe.client.insert',
    args: {
        doc: {
            doctype: 'Attendance',
            employee: 'HR-EMP-00001',
            attendance_date: '2026-02-09',
            status: 'Present',
            shift: 'Morning Shift',
            company: 'شركة النموذج'
        }
    },
    callback: function(r) {
        console.log('Attendance created:', r.message.name);
    }
});
```

---

### 3. Employee Checkin
**Endpoint:** `frappe.client.get_list`

**الوصف:** الحصول على سجلات تسجيل الدخول والخروج

**Example:**
```javascript
frappe.call({
    method: 'frappe.client.get_list',
    args: {
        doctype: 'Employee Checkin',
        filters: {
            employee: 'HR-EMP-00001',
            time: ['between', ['2026-02-09 00:00:00', '2026-02-09 23:59:59']]
        },
        fields: ['name', 'time', 'log_type', 'shift', 'latitude', 'longitude', 'checkin_method', 'biometric_verified'],
        order_by: 'time desc'
    },
    callback: function(r) {
        console.log(r.message);
    }
});
```

---

## Location Tracking APIs - تتبع المواقع

### 1. حفظ موقع الموظف
**Endpoint:** `hrms.hr.doctype.employee_location_log.location_api.save_location`

**الوصف:** حفظ موقع الموظف الحالي

**Parameters:**
- `employee` (str, required): اسم الموظف
- `latitude` (float, required): خط العرض
- `longitude` (float, required): خط الطول
- `accuracy` (float, optional): دقة الموقع بالأمتار
- `notes` (str, optional): ملاحظات
- `attendance` (str, optional): ربط بسجل الحضور
- `checkin` (str, optional): ربط بسجل التسجيل

**Example Request:**
```javascript
frappe.call({
    method: 'hrms.hr.doctype.employee_location_log.location_api.save_location',
    args: {
        employee: 'HR-EMP-00001',
        latitude: 24.7136,
        longitude: 46.6753,
        accuracy: 15.5,
        checkin: 'CHK-00123'
    },
    callback: function(r) {
        if (r.message.success) {
            console.log('Location saved:', r.message.name);
        }
    }
});
```

---

### 2. الحصول على مواقع الموظف
**Endpoint:** `hrms.hr.doctype.employee_location_log.location_api.get_employee_locations`

**Parameters:**
- `employee` (str, required): اسم الموظف
- `date` (str, optional): تاريخ محدد
- `from_date` (str, optional): من تاريخ
- `to_date` (str, optional): إلى تاريخ

**Example Request:**
```javascript
frappe.call({
    method: 'hrms.hr.doctype.employee_location_log.location_api.get_employee_locations',
    args: {
        employee: 'HR-EMP-00001',
        date: '2026-02-09'
    },
    callback: function(r) {
        console.log('Locations:', r.message);
    }
});
```

**Response:**
```json
[
    {
        "log_datetime": "2026-02-09 08:15:23",
        "latitude": 24.7136,
        "longitude": 46.6753,
        "accuracy": 15.5,
        "address": "الرياض، المملكة العربية السعودية"
    }
]
```

---

### 3. بدء تتبع الموقع عند التسجيل
**Endpoint:** `hrms.hr.doctype.employee_location_log.location_api.start_tracking_for_checkin`

**Parameters:**
- `employee` (str, required): اسم الموظف
- `checkin` (str, required): اسم سجل التسجيل

**Response:**
```json
{
    "success": true,
    "tracking_enabled": true,
    "employee_consent": true,
    "interval_ms": 60000,
    "checkin": "CHK-00123"
}
```

---

### 4. إعدادات التتبع للموظف
**Endpoint:** `hrms.hr.doctype.employee_location_log.location_api.get_tracking_settings`

**Parameters:**
- `employee` (str, required): اسم الموظف

---

### 5. الحضور الحالي للموظف
**Endpoint:** `hrms.hr.doctype.employee_location_log.location_api.get_current_attendance`

**Parameters:**
- `employee` (str, required): اسم الموظف

---

## Radius Alert APIs - تنبيهات المسافة

### 1. فحص تنبيه المسافة
**Endpoint:** `hrms.hr.doctype.employee_location_settings.radius_alert_api.check_radius_alert`

**الوصف:** فحص ما إذا كان الموظف خارج نطاق المسافة المحددة

**Parameters:**
- `employee` (str, required): اسم الموظف
- `latitude` (float, required): خط العرض الحالي
- `longitude` (float, required): خط الطول الحالي

**Example Request:**
```javascript
frappe.call({
    method: 'hrms.hr.doctype.employee_location_settings.radius_alert_api.check_radius_alert',
    args: {
        employee: 'HR-EMP-00001',
        latitude: 24.7136,
        longitude: 46.6753
    },
    callback: function(r) {
        if (r.message.outside_radius) {
            frappe.show_alert({
                message: __('Employee is outside designated radius!'),
                indicator: 'red'
            });
        }
    }
});
```

**Response:**
```json
{
    "success": true,
    "alert_enabled": true,
    "distance": 753.45,
    "alert_radius": 500,
    "outside_radius": true,
    "message": "Employee is 753.45 meters from center location"
}
```

---

### 2. الحصول على سجلات التنبيهات
**Endpoint:** `hrms.hr.doctype.employee_location_settings.radius_alert_api.get_radius_alerts`

**Parameters:**
- `employee` (str, optional): اسم الموظف
- `from_date` (str, optional): من تاريخ
- `to_date` (str, optional): إلى تاريخ

**Example Request:**
```javascript
frappe.call({
    method: 'hrms.hr.doctype.employee_location_settings.radius_alert_api.get_radius_alerts',
    args: {
        employee: 'HR-EMP-00001',
        from_date: '2026-02-01',
        to_date: '2026-02-09'
    },
    callback: function(r) {
        console.log('Alerts:', r.message);
    }
});
```

**Response:**
```json
[
    {
        "name": "ALERT-HR-EMP-00001-001",
        "employee": "HR-EMP-00001",
        "employee_name": "أحمد محمد",
        "alert_datetime": "2026-02-09 10:45:12",
        "distance_from_center": 753.45,
        "alert_radius": 500,
        "latitude": 24.7136,
        "longitude": 46.6753
    }
]
```

---

## Shift Management APIs - إدارة الشفتات

### 1. الحصول على كل الشفتات
**Endpoint:** `hrms.hr.doctype.shift_assignment.shift_management_api.get_all_shifts`

**Parameters:**
- `filters` (dict, optional): فلاتر إضافية

**Example Request:**
```javascript
frappe.call({
    method: 'hrms.hr.doctype.shift_assignment.shift_management_api.get_all_shifts',
    args: {
        filters: {
            disabled: 0
        }
    },
    callback: function(r) {
        console.log('Shifts:', r.message);
    }
});
```

**Response:**
```json
[
    {
        "name": "Morning Shift",
        "start_time": "08:00:00",
        "end_time": "16:00:00",
        "enable_auto_attendance": 1,
        "late_entry_grace_period": 15,
        "early_exit_grace_period": 15,
        "color": "#3498db",
        "disabled": 0
    }
]
```

---

### 2. تفاصيل شفت محدد
**Endpoint:** `hrms.hr.doctype.shift_assignment.shift_management_api.get_shift_details`

**Parameters:**
- `shift_name` (str, required): اسم الشفت

---

### 3. إنشاء شفت جديد
**Endpoint:** `hrms.hr.doctype.shift_assignment.shift_management_api.create_shift`

**Parameters:**
- `shift_data` (dict, required): بيانات الشفت

**Example Request:**
```javascript
frappe.call({
    method: 'hrms.hr.doctype.shift_assignment.shift_management_api.create_shift',
    args: {
        shift_data: {
            name: 'Evening Shift',
            start_time: '16:00:00',
            end_time: '00:00:00',
            enable_auto_attendance: 1,
            late_entry_grace_period: 15,
            color: '#e74c3c'
        }
    },
    callback: function(r) {
        if (r.message.success) {
            frappe.msgprint(__('Shift created successfully'));
        }
    }
});
```

---

### 4. تحديث شفت
**Endpoint:** `hrms.hr.doctype.shift_assignment.shift_management_api.update_shift`

**Parameters:**
- `shift_name` (str, required): اسم الشفت
- `shift_data` (dict, required): البيانات المحدثة

---

### 5. تعيين شفت لموظف
**Endpoint:** `hrms.hr.doctype.shift_assignment.shift_management_api.assign_shift_to_employee`

**Parameters:**
- `employee` (str, required): اسم الموظف
- `shift_type` (str, required): نوع الشفت
- `start_date` (str, required): تاريخ البداية
- `end_date` (str, optional): تاريخ النهاية
- `company` (str, optional): الشركة

**Example Request:**
```javascript
frappe.call({
    method: 'hrms.hr.doctype.shift_assignment.shift_management_api.assign_shift_to_employee',
    args: {
        employee: 'HR-EMP-00001',
        shift_type: 'Morning Shift',
        start_date: '2026-02-09',
        end_date: '2026-03-09'
    },
    callback: function(r) {
        if (r.message.success) {
            frappe.msgprint(__('Shift assigned successfully'));
        }
    }
});
```

---

### 6. شفتات الموظف
**Endpoint:** `hrms.hr.doctype.shift_assignment.shift_management_api.get_employee_shifts`

**Parameters:**
- `employee` (str, required): اسم الموظف
- `from_date` (str, optional): من تاريخ
- `to_date` (str, optional): إلى تاريخ

---

### 7. الشفت النشط للموظف
**Endpoint:** `hrms.hr.doctype.shift_assignment.shift_management_api.get_active_shift_for_employee`

**Parameters:**
- `employee` (str, required): اسم الموظف
- `date` (str, optional): التاريخ (افتراضياً اليوم)

**Response:**
```json
{
    "shift_type": "Morning Shift",
    "start_time": "08:00:00",
    "end_time": "16:00:00",
    "color": "#3498db",
    "assignment_name": "SA-00123"
}
```

---

### 8. تحديث تعيين شفت
**Endpoint:** `hrms.hr.doctype.shift_assignment.shift_management_api.update_shift_assignment`

**Parameters:**
- `assignment_name` (str, required): اسم التعيين
- `data` (dict, required): البيانات المحدثة

---

### 9. إلغاء تعيين شفت
**Endpoint:** `hrms.hr.doctype.shift_assignment.shift_management_api.cancel_shift_assignment`

**Parameters:**
- `assignment_name` (str, required): اسم التعيين

---

## Reports - التقارير

### 1. تقرير الحضور التفصيلي
**Report Name:** `Employee Attendance Detail Report`

**الوصف:** تقرير شامل يعرض كل تفاصيل الحضور بما فيها التأخير، الخروج المبكر، ساعات العمل

**Filters:**
- `from_date` (Date, required): من تاريخ
- `to_date` (Date, required): إلى تاريخ
- `employee` (Link, optional): موظف محدد
- `employee_id` (Data, optional): رقم الموظف
- `department` (Link, optional): القسم
- `shift` (Link, optional): الشفت
- `company` (Link, optional): الشركة
- `status` (Select, optional): حالة الحضور

**Access Report:**
```javascript
frappe.set_route('query-report', 'Employee Attendance Detail Report', {
    from_date: '2026-02-01',
    to_date: '2026-02-28',
    employee: 'HR-EMP-00001'
});
```

---

### 2. تقرير تتبع الحركة على الخريطة
**Report Name:** `Employee Location Tracking Report`

**الوصف:** تقرير يعرض مسار حركة الموظف على الخريطة طوال فترة الشفت

**Filters:**
- `employee` (Link, required): الموظف
- `date` (Date, required): التاريخ
- `shift` (Link, optional): الشفت

**Features:**
- عرض المسار على خريطة تفاعلية
- حساب المسافات بين النقاط
- حساب الوقت بين كل نقطة
- زر "View on Map" لعرض الخريطة التفاعلية

**Access Report:**
```javascript
frappe.set_route('query-report', 'Employee Location Tracking Report', {
    employee: 'HR-EMP-00001',
    date: '2026-02-09'
});
```

---

## Check-in Methods - طرق الحضور

### 1. الحصول على طريقة الحضور للموظف
**Endpoint:** `hrms.hr.doctype.employee_location_settings.checkin_method_api.get_checkin_method`

**Parameters:**
- `employee` (str, required): اسم الموظف

**Response:**
```json
{
    "checkin_method": "Photo + Biometric",
    "require_photo": 1,
    "require_biometric": 1
}
```

---

### 2. التحقق من بيانات التسجيل
**Endpoint:** `hrms.hr.doctype.employee_location_settings.checkin_method_api.validate_checkin_data`

**Parameters:**
- `employee` (str, required): اسم الموظف
- `log_type` (str, required): نوع التسجيل (IN/OUT)
- `checkin_method` (str, required): طريقة التسجيل
- `photo` (str, optional): الصورة (إذا مطلوبة)
- `biometric_verified` (int, optional): تم التحقق البيومتري (إذا مطلوب)
- `biometric_type` (str, optional): نوع البيومتري

**الطرق المتاحة:**
- `Manual`: ضغطة زر بسيطة
- `Photo`: يتطلب صورة
- `Biometric`: يتطلب بصمة أو Face ID
- `Photo + Biometric`: يتطلب الصورة والبصمة معاً

---

## 📊 أمثلة شاملة

### مثال 1: البحث عن موظف وعرض تفاصيله
```javascript
// 1. البحث عن الموظف
frappe.call({
    method: 'hrms.hr.api.employee_search_api.search_employees',
    args: {
        query: 'EMP001'
    },
    callback: function(r) {
        if (r.message && r.message.length > 0) {
            let employee = r.message[0];
            
            // 2. الحصول على التفاصيل الشاملة
            frappe.call({
                method: 'hrms.hr.api.employee_search_api.get_employee_details',
                args: {
                    employee: employee.name
                },
                callback: function(details) {
                    console.log('Employee Details:', details.message);
                    displayEmployeeInfo(details.message);
                }
            });
        }
    }
});
```

---

### مثال 2: تتبع موقع موظف في الوقت الفعلي
```javascript
let locationInterval;

function startLocationTracking(employee, checkin) {
    // بدء التتبع
    frappe.call({
        method: 'hrms.hr.doctype.employee_location_log.location_api.start_tracking_for_checkin',
        args: {
            employee: employee,
            checkin: checkin
        },
        callback: function(r) {
            if (r.message.success && r.message.tracking_enabled) {
                let interval_ms = r.message.interval_ms;
                
                // حفظ الموقع بشكل دوري
                locationInterval = setInterval(() => {
                    if (navigator.geolocation) {
                        navigator.geolocation.getCurrentPosition((position) => {
                            saveLocation(
                                employee,
                                position.coords.latitude,
                                position.coords.longitude,
                                position.coords.accuracy,
                                checkin
                            );
                        });
                    }
                }, interval_ms);
            }
        }
    });
}

function saveLocation(employee, lat, lng, accuracy, checkin) {
    frappe.call({
        method: 'hrms.hr.doctype.employee_location_log.location_api.save_location',
        args: {
            employee: employee,
            latitude: lat,
            longitude: lng,
            accuracy: accuracy,
            checkin: checkin
        },
        callback: function(r) {
            if (r.message.success) {
                console.log('Location saved');
            }
        }
    });
}

function stopLocationTracking() {
    if (locationInterval) {
        clearInterval(locationInterval);
    }
}
```

---

### مثال 3: إنشاء شفت وتعيينه لموظفين
```javascript
// 1. إنشاء شفت جديد
frappe.call({
    method: 'hrms.hr.doctype.shift_assignment.shift_management_api.create_shift',
    args: {
        shift_data: {
            name: 'Night Shift',
            start_time: '22:00:00',
            end_time: '06:00:00',
            enable_auto_attendance: 1,
            late_entry_grace_period: 15,
            early_exit_grace_period: 15,
            color: '#9b59b6'
        }
    },
    callback: function(r) {
        if (r.message.success) {
            // 2. تعيين الشفت لعدة موظفين
            let employees = ['HR-EMP-00001', 'HR-EMP-00002', 'HR-EMP-00003'];
            
            employees.forEach(emp => {
                frappe.call({
                    method: 'hrms.hr.doctype.shift_assignment.shift_management_api.assign_shift_to_employee',
                    args: {
                        employee: emp,
                        shift_type: 'Night Shift',
                        start_date: '2026-03-01'
                    }
                });
            });
            
            frappe.msgprint(__('Shift created and assigned successfully'));
        }
    }
});
```

---

### مثال 4: عرض تقرير حضور مع إحصائيات
```javascript
function displayAttendanceReport(employee, from_date, to_date) {
    // فتح التقرير
    frappe.set_route('query-report', 'Employee Attendance Detail Report', {
        from_date: from_date,
        to_date: to_date,
        employee: employee
    });
    
    // الحصول على الإحصائيات
    frappe.call({
        method: 'hrms.hr.api.employee_search_api.get_employee_statistics',
        args: {
            employee: employee
        },
        callback: function(r) {
            if (r.message) {
                displayStatistics(r.message);
            }
        }
    });
}

function displayStatistics(stats) {
    let html = `
        <div class="statistics-card">
            <h4>إحصائيات الحضور</h4>
            <div class="stat-row">
                <span>الحضور:</span>
                <span class="badge badge-success">${stats.attendance_summary.Present || 0}</span>
            </div>
            <div class="stat-row">
                <span>الغياب:</span>
                <span class="badge badge-danger">${stats.attendance_summary.Absent || 0}</span>
            </div>
            <div class="stat-row">
                <span>التأخيرات:</span>
                <span class="badge badge-warning">${stats.late_entries}</span>
            </div>
            <div class="stat-row">
                <span>الخروج المبكر:</span>
                <span class="badge badge-warning">${stats.early_exits}</span>
            </div>
        </div>
    `;
    
    frappe.msgprint({
        title: __('Statistics'),
        message: html,
        indicator: 'blue'
    });
}
```

---

## 🔐 ملاحظات الأمان (Security Notes)

1. **الصلاحيات:**
   - كل الـ APIs تتطلب دور `HR Manager` أو `HR User`
   - بعض APIs تتطلب `HR Manager` فقط
   - يتم التحقق من الصلاحيات تلقائياً

2. **البيانات الحساسة:**
   - يتم تشفير البيانات الشخصية
   - المواقع الجغرافية محمية بموافقة الموظف

3. **Rate Limiting:**
   - يُنصح بعدم إرسال طلبات متكررة بسرعة عالية
   - استخدم intervals مناسبة للتتبع الجغرافي

---

## 📱 دعم التطبيقات

كل الـ APIs متوافقة مع:
- تطبيقات الويب (Web Apps)
- تطبيقات الموبايل (Mobile Apps)
- Progressive Web Apps (PWA)

---

## 🆘 استكشاف الأخطاء

### خطأ: "Permission Denied"
**الحل:** تأكد من أن المستخدم لديه الدور المناسب (HR Manager أو HR User)

### خطأ: "Employee not found"
**الحل:** تأكد من استخدام الـ name (المفتاح الأساسي) وليس employee_id

### خطأ: "Location tracking not enabled"
**الحل:** تأكد من تفعيل التتبع في Employee Location Settings وموافقة الموظف

---

## 📞 الدعم الفني

لأي استفسارات أو مشاكل تقنية، يرجى التواصل مع فريق الدعم الفني.

**تاريخ التحديث:** 9 فبراير 2026
**الإصدار:** 1.0.0


# HRMS Admin System - فهرس التوثيق
## Documentation Index - دليل شامل للنظام

---

## 📚 محتويات التوثيق

### 1. 📖 README الرئيسي
**الملف:** [HRMS_ADMIN_SYSTEM_README.md](HRMS_ADMIN_SYSTEM_README.md)

**المحتوى:**
- نظرة عامة على النظام
- الخصائص الرئيسية
- التثبيت والإعداد
- دليل الاستخدام السريع
- استكشاف الأخطاء
- الصلاحيات والأمان

**متى تستخدمه:**
- أول مرة تتعامل مع النظام
- تثبيت النظام لأول مرة
- فهم الخصائص المتاحة
- حل المشاكل الشائعة

---

### 2. 🔌 التوثيق الكامل للـ APIs
**الملف:** [HRMS_ADMIN_API_DOCUMENTATION.md](HRMS_ADMIN_API_DOCUMENTATION.md)

**المحتوى:**
- تفاصيل كاملة لكل API
- Parameters والـ Response لكل Endpoint
- أمثلة عملية مع الكود
- شرح كل الـ Features بالتفصيل
- أمثلة شاملة للاستخدام

**الأقسام:**
1. Employee APIs - إدارة الموظفين
2. Attendance APIs - الحضور والانصراف
3. Location Tracking APIs - تتبع المواقع
4. Radius Alert APIs - تنبيهات المسافة
5. Shift Management APIs - إدارة الشفتات
6. Reports - التقارير
7. Check-in Methods - طرق الحضور

**متى تستخدمه:**
- تطوير Frontend جديد
- التكامل مع أنظمة خارجية
- فهم تفاصيل API معين
- الحاجة لأمثلة متقدمة

---

### 3. ⚡ الدليل السريع للمطورين
**الملف:** [HRMS_ADMIN_QUICK_REFERENCE.md](HRMS_ADMIN_QUICK_REFERENCE.md)

**المحتوى:**
- أهم الـ APIs مختصرة
- أمثلة كود جاهزة للنسخ
- UI Components جاهزة
- Utility Functions
- Best Practices
- Performance Tips

**متى تستخدمه:**
- بحث سريع عن API
- نسخ أمثلة كود جاهزة
- استخدام Components جاهزة
- مراجعة سريعة

---

### 4. 📱 دليل طرق الحضور
**الملف:** [CHECKIN_METHODS_GUIDE.md](CHECKIN_METHODS_GUIDE.md)

**المحتوى:**
- شرح تفصيلي لطرق الحضور الأربعة
- Manual, Photo, Biometric, Photo + Biometric
- كيفية الإعداد والاستخدام
- التكامل مع التطبيقات
- أمثلة Frontend وBackend

**متى تستخدمه:**
- تطبيق طرق حضور جديدة
- تخصيص طرق الحضور
- فهم آلية العمل
- التكامل مع أنظمة البصمة

---

### 5. 🗺️ دليل التتبع الجغرافي
**الملف:** [MOBILE_APP_LOCATION_TRACKING.md](MOBILE_APP_LOCATION_TRACKING.md)

**المحتوى:**
- آلية التتبع الجغرافي
- التكامل مع تطبيقات الموبايل
- حفظ ومعالجة المواقع
- Geocoding والعناوين
- Privacy والموافقات

**متى تستخدمه:**
- تطوير تطبيق موبايل
- فهم آلية التتبع
- حل مشاكل GPS
- تحسين دقة المواقع

---

## 🎯 دليل الاستخدام حسب الاحتياج

### أنا مطور Frontend جديد
**ابدأ بهذا الترتيب:**
1. [HRMS_ADMIN_SYSTEM_README.md](HRMS_ADMIN_SYSTEM_README.md) - للفهم العام
2. [HRMS_ADMIN_QUICK_REFERENCE.md](HRMS_ADMIN_QUICK_REFERENCE.md) - للبدء السريع
3. [HRMS_ADMIN_API_DOCUMENTATION.md](HRMS_ADMIN_API_DOCUMENTATION.md) - للتفاصيل

### أنا مطور Backend
**ابدأ بهذا الترتيب:**
1. [HRMS_ADMIN_SYSTEM_README.md](HRMS_ADMIN_SYSTEM_README.md) - للتثبيت
2. [HRMS_ADMIN_API_DOCUMENTATION.md](HRMS_ADMIN_API_DOCUMENTATION.md) - لفهم الـ APIs
3. [CHECKIN_METHODS_GUIDE.md](CHECKIN_METHODS_GUIDE.md) - للتفاصيل التقنية

### أنا مطور Mobile App
**ابدأ بهذا الترتيب:**
1. [MOBILE_APP_LOCATION_TRACKING.md](MOBILE_APP_LOCATION_TRACKING.md) - للتتبع
2. [CHECKIN_METHODS_GUIDE.md](CHECKIN_METHODS_GUIDE.md) - للحضور
3. [HRMS_ADMIN_API_DOCUMENTATION.md](HRMS_ADMIN_API_DOCUMENTATION.md) - للـ APIs

### أنا HR Manager
**ابدأ بهذا الترتيب:**
1. [HRMS_ADMIN_SYSTEM_README.md](HRMS_ADMIN_SYSTEM_README.md) - دليل المستخدم
2. قسم "دليل الاستخدام" في README
3. قسم "التقارير" في README

---

## 📋 ملخص الخصائص المتوفرة

### ✅ ما هو متاح حالياً:

#### 1. إدارة الموظفين
- ✅ بحث متقدم عن الموظفين
- ✅ عرض تفاصيل شاملة
- ✅ إحصائيات الحضور والإجازات
- ✅ الهيكل التنظيمي
- ✅ تحديث جماعي

**APIs:**
- `search_employees`
- `get_employee_by_id`
- `get_employee_details`
- `get_employee_statistics`
- `get_employee_hierarchy`

---

#### 2. تتبع الحضور
- ✅ سجلات الحضور الكاملة
- ✅ حساب التأخير والخروج المبكر
- ✅ ساعات العمل
- ✅ تقارير تفصيلية
- ✅ إحصائيات شاملة

**التقارير:**
- Employee Attendance Detail Report

---

#### 3. التتبع الجغرافي
- ✅ تتبع مواقع الموظفين
- ✅ حفظ المواقع بشكل دوري
- ✅ عرض المسار على الخريطة
- ✅ حساب المسافات والأوقات
- ✅ Geocoding تلقائي

**APIs:**
- `save_location`
- `get_employee_locations`
- `start_tracking_for_checkin`

**التقارير:**
- Employee Location Tracking Report

---

#### 4. تنبيهات المسافة
- ✅ تحديد نطاق مسافة لكل موظف
- ✅ تنبيهات تلقائية للـ HR Manager
- ✅ سجل كامل للتنبيهات
- ✅ رسائل مخصصة
- ✅ تحكم في التوقيت

**APIs:**
- `check_radius_alert`
- `get_radius_alerts`

**DocTypes:**
- Employee Radius Alert Log

---

#### 5. طرق حضور متعددة
- ✅ Manual (ضغطة زر)
- ✅ Photo (صورة سيلفي)
- ✅ Biometric (بصمة/Face ID)
- ✅ Photo + Biometric (كلاهما)
- ✅ تخصيص لكل موظف

**APIs:**
- `get_checkin_method`
- `validate_checkin_data`

---

#### 6. إدارة الشفتات
- ✅ إنشاء شفتات جديدة
- ✅ تعديل شفتات موجودة
- ✅ تعيين شفتات للموظفين
- ✅ جدولة متقدمة
- ✅ عرض الشفت النشط

**APIs:**
- `get_all_shifts`
- `create_shift`
- `update_shift`
- `assign_shift_to_employee`
- `get_employee_shifts`
- `get_active_shift_for_employee`

---

## 🔧 أمثلة الاستخدام السريع

### مثال 1: البحث عن موظف وعرض بياناته
```javascript
// 1. بحث
const employees = await frappe.call({
    method: 'hrms.hr.api.employee_search_api.search_employees',
    args: { query: 'أحمد' }
});

// 2. تفاصيل
const details = await frappe.call({
    method: 'hrms.hr.api.employee_search_api.get_employee_details',
    args: { employee: employees.message[0].name }
});

console.log(details.message);
```

---

### مثال 2: بدء تتبع موقع موظف
```javascript
// بدء التتبع
const tracking = await frappe.call({
    method: 'hrms.hr.doctype.employee_location_log.location_api.start_tracking_for_checkin',
    args: {
        employee: 'HR-EMP-00001',
        checkin: 'CHK-00123'
    }
});

// حفظ موقع كل دقيقة
setInterval(async () => {
    navigator.geolocation.getCurrentPosition(async (pos) => {
        await frappe.call({
            method: 'hrms.hr.doctype.employee_location_log.location_api.save_location',
            args: {
                employee: 'HR-EMP-00001',
                latitude: pos.coords.latitude,
                longitude: pos.coords.longitude,
                checkin: 'CHK-00123'
            }
        });
    });
}, 60000);
```

---

### مثال 3: فتح تقرير الحضور
```javascript
frappe.set_route('query-report', 'Employee Attendance Detail Report', {
    from_date: '2026-02-01',
    to_date: '2026-02-28',
    employee: 'HR-EMP-00001'
});
```

---

### مثال 4: إنشاء وتعيين شفت
```javascript
// إنشاء شفت
await frappe.call({
    method: 'hrms.hr.doctype.shift_assignment.shift_management_api.create_shift',
    args: {
        shift_data: {
            name: 'Morning Shift',
            start_time: '08:00:00',
            end_time: '16:00:00'
        }
    }
});

// تعيين لموظف
await frappe.call({
    method: 'hrms.hr.doctype.shift_assignment.shift_management_api.assign_shift_to_employee',
    args: {
        employee: 'HR-EMP-00001',
        shift_type: 'Morning Shift',
        start_date: '2026-02-09'
    }
});
```

---

## 🎓 دروس تعليمية (Tutorials)

### Tutorial 1: إنشاء صفحة بحث عن موظفين
راجع: [HRMS_ADMIN_QUICK_REFERENCE.md](HRMS_ADMIN_QUICK_REFERENCE.md) - قسم "UI Components Examples"

### Tutorial 2: تطبيق تتبع موقع
راجع: [MOBILE_APP_LOCATION_TRACKING.md](MOBILE_APP_LOCATION_TRACKING.md)

### Tutorial 3: إنشاء تقرير مخصص
راجع: [HRMS_ADMIN_API_DOCUMENTATION.md](HRMS_ADMIN_API_DOCUMENTATION.md) - قسم "Reports"

---

## ❓ أسئلة شائعة (FAQ)

### س: كيف أبدأ في تطوير Frontend؟
**ج:** ابدأ بقراءة [HRMS_ADMIN_QUICK_REFERENCE.md](HRMS_ADMIN_QUICK_REFERENCE.md) واستخدم الـ Components الجاهزة

### س: أين أجد تفاصيل API معين؟
**ج:** راجع [HRMS_ADMIN_API_DOCUMENTATION.md](HRMS_ADMIN_API_DOCUMENTATION.md) وابحث عن اسم الـ API

### س: كيف أفعّل طريقة حضور معينة؟
**ج:** راجع [CHECKIN_METHODS_GUIDE.md](CHECKIN_METHODS_GUIDE.md)

### س: كيف أحل مشكلة في التتبع الجغرافي؟
**ج:** راجع [MOBILE_APP_LOCATION_TRACKING.md](MOBILE_APP_LOCATION_TRACKING.md) - قسم Troubleshooting

### س: كيف أنشئ تقرير مخصص؟
**ج:** راجع التقارير الموجودة كأمثلة في:
- `hrms/hr/report/employee_attendance_detail_report/`
- `hrms/hr/report/employee_location_tracking_report/`

---

## 🔗 روابط مفيدة

### الوثائق الرسمية
- [Frappe Framework Documentation](https://frappeframework.com/docs)
- [ERPNext Documentation](https://docs.erpnext.com)
- [HRMS Documentation](https://docs.erpnext.com/docs/user/manual/en/human-resources)

### APIs خارجية مستخدمة
- [OpenStreetMap Nominatim](https://nominatim.org/release-docs/develop/api/Overview/) - Geocoding
- [Leaflet.js](https://leafletjs.com/) - عرض الخرائط
- [Google Maps API](https://developers.google.com/maps/documentation) - خرائط بديلة

---

## 📞 الدعم

### لمشاكل تقنية:
- راجع قسم "استكشاف الأخطاء" في [HRMS_ADMIN_SYSTEM_README.md](HRMS_ADMIN_SYSTEM_README.md)
- تواصل مع فريق الدعم الفني

### للأسئلة العامة:
- راجع الوثائق المناسبة حسب احتياجك
- انظر الأمثلة في Quick Reference

### للتطوير والمساهمة:
- راجع قسم "المساهمة" في README
- افتح Issue أو Pull Request في المشروع

---

## 📊 خريطة المشروع (Project Structure)

```
hrms/
├── hr/
│   ├── doctype/
│   │   ├── employee_location_settings/
│   │   │   ├── employee_location_settings.json
│   │   │   ├── employee_location_settings.py
│   │   │   ├── radius_alert_api.py
│   │   │   └── checkin_method_api.py
│   │   ├── employee_radius_alert_log/
│   │   │   ├── employee_radius_alert_log.json
│   │   │   └── employee_radius_alert_log.py
│   │   ├── employee_location_log/
│   │   │   └── location_api.py
│   │   └── shift_assignment/
│   │       └── shift_management_api.py
│   ├── report/
│   │   ├── employee_attendance_detail_report/
│   │   │   ├── employee_attendance_detail_report.js
│   │   │   ├── employee_attendance_detail_report.py
│   │   │   └── employee_attendance_detail_report.json
│   │   └── employee_location_tracking_report/
│   │       ├── employee_location_tracking_report.js
│   │       ├── employee_location_tracking_report.py
│   │       └── employee_location_tracking_report.json
│   └── api/
│       └── employee_search_api.py
└── docs/
    ├── HRMS_ADMIN_SYSTEM_README.md
    ├── HRMS_ADMIN_API_DOCUMENTATION.md
    ├── HRMS_ADMIN_QUICK_REFERENCE.md
    ├── HRMS_ADMIN_DOCUMENTATION_INDEX.md (هذا الملف)
    ├── CHECKIN_METHODS_GUIDE.md
    └── MOBILE_APP_LOCATION_TRACKING.md
```

---

## ✅ Checklist للبدء

### للمطورين الجدد:
- [ ] قراءة [HRMS_ADMIN_SYSTEM_README.md](HRMS_ADMIN_SYSTEM_README.md)
- [ ] تثبيت النظام وإعداده
- [ ] قراءة [HRMS_ADMIN_QUICK_REFERENCE.md](HRMS_ADMIN_QUICK_REFERENCE.md)
- [ ] تجربة أول API call
- [ ] إنشاء أول Component

### لمطوري Frontend:
- [ ] فهم الـ APIs المتاحة
- [ ] نسخ الـ Components الجاهزة
- [ ] تجربة الـ Examples
- [ ] إنشاء UI مخصص

### لمطوري Backend:
- [ ] فهم البنية التحتية
- [ ] قراءة كود الـ APIs
- [ ] تجربة الـ APIs
- [ ] إضافة Features جديدة

---

**تاريخ التحديث:** 9 فبراير 2026
**الإصدار:** 1.0.0

---

© 2026 HRMS Admin System - All rights reserved
