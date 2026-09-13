# Holiday List API Documentation

> **دليل شامل للتعامل مع قوائم العطلات في Frappe/ERPNext**

هذا المستند يوفر جميع نقاط النهاية (API endpoints) للتعامل مع:
- ✅ **قراءة وعرض قوائم العطلات**
- ✅ **إنشاء قوائم عطلات جديدة**
- ✅ **تعيين قائمة العطل للموظف أو الشركة (حل خطأ ValidationError)**
- ✅ **إدارة أيام العطل داخل القائمة**

---

## 📋 جدول المحتويات
- [المصادقة (Authentication)](#المصادقة-authentication)
- [1. قراءة قوائم العطلات](#1-قراءة-قوائم-العطلات)
- [2. إنشاء قائمة عطل جديدة](#2-إنشاء-قائمة-عطل-جديدة)
- [3. تعيين قائمة العطل (حل خطأ ValidationError)](#3-تعيين-قائمة-العطل-حل-خطأ-validationerror)
- [4. إدارة أيام العطل](#4-إدارة-أيام-العطل)
- [5. التحقق من أيام العطل](#5-التحقق-من-أيام-العطل)
- [هياكل البيانات](#هياكل-البيانات)
- [معالجة الأخطاء](#معالجة-الأخطاء)

---

## 🔐 المصادقة (Authentication)

جميع استدعاءات API تتطلب مصادقة. قم بتضمين هذه الرؤوس:

```javascript
headers: {
  'Authorization': 'token <api_key>:<api_secret>',
  'Content-Type': 'application/json'
}
```

أو استخدم ملفات تعريف الارتباط (cookies) إذا كنت تستدعي من نفس النطاق بعد تسجيل الدخول.

---

## 1. قراءة قوائم العطلات

### 1.1 عرض جميع قوائم العطلات

**Endpoint:** `POST /api/method/frappe.client.get_list`

```javascript
// عرض جميع قوائم العطلات
const response = await fetch('/api/method/frappe.client.get_list', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'token <your_token>'
  },
  body: JSON.stringify({
    doctype: 'Holiday List',
    fields: [
      'name',           // اسم القائمة (ID)
      'holiday_list_name',  // الاسم الوصفي
      'from_date',      // تاريخ البداية
      'to_date',        // تاريخ النهاية
      'total_holidays', // عدد أيام العطل
      'weekly_off',     // يوم الإجازة الأسبوعية
      'company',        // الشركة
      'color'           // لون العرض
    ],
    order_by: 'from_date desc',
    limit_page_length: 100
  })
});

const holidayLists = await response.json();
console.log('قوائم العطلات:', holidayLists.message);
```

**Response:**
```json
{
  "message": [
    {
      "name": "HL-2026-القرعاوي",
      "holiday_list_name": "قائمة عطل القرعاوي 2026",
      "from_date": "2026-01-01",
      "to_date": "2026-12-31",
      "total_holidays": 52,
      "weekly_off": "Friday",
      "company": "القرعاوي",
      "color": "#3498db"
    }
  ]
}
```

### 1.2 عرض قائمة عطل محددة بالتفاصيل الكاملة

**Endpoint:** `POST /api/method/frappe.client.get`

```javascript
// عرض قائمة عطل واحدة مع جميع أيام العطل
const response = await fetch('/api/method/frappe.client.get', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    doctype: 'Holiday List',
    name: 'HL-2026-القرعاوي'
  })
});

const holidayList = await response.json();
console.log('أيام العطل:', holidayList.message.holidays);
```

**Response:**
```json
{
  "message": {
    "name": "HL-2026-القرعاوي",
    "holiday_list_name": "قائمة عطل القرعاوي 2026",
    "from_date": "2026-01-01",
    "to_date": "2026-12-31",
    "total_holidays": 52,
    "weekly_off": "Friday",
    "company": "القرعاوي",
    "holidays": [
      {
        "holiday_date": "2026-01-02",
        "description": "جمعة",
        "weekly_off": 1
      },
      {
        "holiday_date": "2026-01-25",
        "description": "عيد الثورة",
        "weekly_off": 0
      }
    ]
  }
}
```

### 1.3 البحث عن قوائم العطل حسب الشركة أو السنة

```javascript
// البحث عن قوائم العطل لشركة معينة
async function getHolidayListsByCompany(companyName) {
  const response = await fetch('/api/method/frappe.client.get_list', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      doctype: 'Holiday List',
      fields: ['name', 'holiday_list_name', 'from_date', 'to_date', 'total_holidays'],
      filters: [
        ['company', '=', companyName]
      ],
      order_by: 'from_date desc'
    })
  });
  
  return await response.json();
}

// البحث عن قوائم العطل لسنة معينة
async function getHolidayListsByYear(year) {
  const response = await fetch('/api/method/frappe.client.get_list', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      doctype: 'Holiday List',
      fields: ['name', 'holiday_list_name', 'from_date', 'to_date'],
      filters: [
        ['from_date', 'between', [`${year}-01-01`, `${year}-12-31`]]
      ]
    })
  });
  
  return await response.json();
}

// الاستخدام
const qarawi2026Lists = await getHolidayListsByCompany('القرعاوي');
const lists2026 = await getHolidayListsByYear(2026);
```

---

## 2. إنشاء قائمة عطل جديدة

### 2.1 إنشاء قائمة عطل فارغة

**Endpoint:** `POST /api/method/frappe.client.insert`

```javascript
// إنشاء قائمة عطل جديدة
const response = await fetch('/api/method/frappe.client.insert', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    doc: {
      doctype: 'Holiday List',
      holiday_list_name: 'قائمة عطل القرعاوي 2027',
      from_date: '2027-01-01',
      to_date: '2027-12-31',
      company: 'القرعاوي',
      weekly_off: 'Friday',  // الخيارات: Sunday, Monday, Tuesday, Wednesday, Thursday, Friday, Saturday
      color: '#3498db'
    }
  })
});

const newHolidayList = await response.json();
console.log('تم إنشاء قائمة العطل:', newHolidayList.message.name);
```

**Response:**
```json
{
  "message": {
    "name": "HL-2027-القرعاوي",
    "holiday_list_name": "قائمة عطل القرعاوي 2027",
    "from_date": "2027-01-01",
    "to_date": "2027-12-31"
  }
}
```

### 2.2 إنشاء قائمة عطل مع أيام العطل

```javascript
// إنشاء قائمة عطل كاملة مع أيام العطل
const response = await fetch('/api/method/frappe.client.insert', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    doc: {
      doctype: 'Holiday List',
      holiday_list_name: 'قائمة عطل القرعاوي 2027',
      from_date: '2027-01-01',
      to_date: '2027-12-31',
      company: 'القرعاوي',
      weekly_off: 'Friday',
      holidays: [
        {
          holiday_date: '2027-01-01',
          description: 'رأس السنة الميلادية',
          weekly_off: 0
        },
        {
          holiday_date: '2027-01-25',
          description: 'عيد الثورة',
          weekly_off: 0
        },
        {
          holiday_date: '2027-04-25',
          description: 'عيد تحرير سيناء',
          weekly_off: 0
        },
        {
          holiday_date: '2027-05-01',
          description: 'عيد العمال',
          weekly_off: 0
        },
        {
          holiday_date: '2027-06-30',
          description: 'عيد ثورة 30 يونيو',
          weekly_off: 0
        },
        {
          holiday_date: '2027-07-23',
          description: 'عيد ثورة 23 يوليو',
          weekly_off: 0
        },
        {
          holiday_date: '2027-10-06',
          description: 'عيد القوات المسلحة',
          weekly_off: 0
        }
      ]
    }
  })
});

const holidayList = await response.json();
```

### 2.3 إضافة جميع أيام الجمعة تلقائياً (Weekly Off)

**Endpoint:** `POST /api/method/hrms.hr.doctype.holiday_list.holiday_list.get_weekly_off_dates`

```javascript
// طريقة 1: استخدام API لحساب أيام الجمعة تلقائياً
async function createHolidayListWithWeeklyOffs(listName, fromDate, toDate, weeklyOff, company) {
  // 1. إنشاء القائمة الفارغة
  const createResponse = await fetch('/api/method/frappe.client.insert', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      doc: {
        doctype: 'Holiday List',
        holiday_list_name: listName,
        from_date: fromDate,
        to_date: toDate,
        weekly_off: weeklyOff,
        company: company
      }
    })
  });
  
  const holidayList = await createResponse.json();
  const holidayListName = holidayList.message.name;
  
  // 2. الحصول على جميع تواريخ weekly_off
  const weeklyOffResponse = await fetch('/api/method/hrms.hr.doctype.holiday_list.holiday_list.get_weekly_off_dates', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      start_date: fromDate,
      end_date: toDate,
      weekly_off: weeklyOff
    })
  });
  
  const weeklyOffDates = await weeklyOffResponse.json();
  
  // 3. إضافة التواريخ إلى القائمة
  const updateResponse = await fetch('/api/method/frappe.client.set_value', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      doctype: 'Holiday List',
      name: holidayListName,
      fieldname: {
        holidays: weeklyOffDates.message.map(date => ({
          holiday_date: date,
          description: weeklyOff,
          weekly_off: 1
        }))
      }
    })
  });
  
  return holidayListName;
}

// الاستخدام
const newList = await createHolidayListWithWeeklyOffs(
  'قائمة عطل 2027',
  '2027-01-01',
  '2027-12-31',
  'Friday',
  'القرعاوي'
);
```

### 2.4 إنشاء نسخة من قائمة عطل موجودة

```javascript
// نسخ قائمة عطل إلى سنة جديدة
async function copyHolidayList(sourceListName, newYear, newListName) {
  // 1. قراءة القائمة الأصلية
  const sourceResponse = await fetch('/api/method/frappe.client.get', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      doctype: 'Holiday List',
      name: sourceListName
    })
  });
  
  const sourceList = (await sourceResponse.json()).message;
  
  // 2. تحديث التواريخ للسنة الجديدة
  const newHolidays = sourceList.holidays.map(holiday => {
    const oldDate = new Date(holiday.holiday_date);
    const newDate = new Date(oldDate);
    newDate.setFullYear(newYear);
    
    return {
      holiday_date: newDate.toISOString().split('T')[0],
      description: holiday.description,
      weekly_off: holiday.weekly_off
    };
  });
  
  // 3. إنشاء القائمة الجديدة
  const createResponse = await fetch('/api/method/frappe.client.insert', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      doc: {
        doctype: 'Holiday List',
        holiday_list_name: newListName,
        from_date: `${newYear}-01-01`,
        to_date: `${newYear}-12-31`,
        company: sourceList.company,
        weekly_off: sourceList.weekly_off,
        holidays: newHolidays
      }
    })
  });
  
  return await createResponse.json();
}

// الاستخدام
const copied = await copyHolidayList('HL-2026-القرعاوي', 2027, 'قائمة عطل القرعاوي 2027');
```

---

## 3. تعيين قائمة العطل (حل خطأ ValidationError)

### ⚠️ حل الخطأ: "Please set a default Holiday List for Employee or Company"

هذا الخطأ يحدث عند:
- محاولة إنشاء أو تحديث طلب إجازة (Leave Application)
- محاولة معالجة الحضور (Attendance) للموظف
- الموظف والشركة ليس لديهم قائمة عطل محددة

**الحل:** تعيين قائمة عطل إما للموظف أو للشركة (أو كليهما).

---

### 3.1 تعيين قائمة عطل لموظف معين

**Endpoint:** `POST /api/method/frappe.client.set_value`

```javascript
// تعيين قائمة عطل لموظف محدد
const response = await fetch('/api/method/frappe.client.set_value', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    doctype: 'Employee',
    name: 'HR-EMP-00022',  // رقم الموظف
    fieldname: 'holiday_list',
    value: 'HL-2026-القرعاوي'  // اسم قائمة العطل
  })
});

const result = await response.json();
console.log('تم تعيين قائمة العطل للموظف:', result.message);
```

**أو باستخدام frappe.client.save:**

```javascript
// طريقة بديلة: تحديث الموظف مباشرة
const response = await fetch('/api/method/frappe.client.save', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    doc: {
      doctype: 'Employee',
      name: 'HR-EMP-00022',
      holiday_list: 'HL-2026-القرعاوي'
    }
  })
});
```

### 3.2 تعيين قائمة عطل افتراضية للشركة

**Endpoint:** `POST /api/method/frappe.client.set_value`

```javascript
// تعيين قائمة عطل افتراضية للشركة (تُطبق على جميع الموظفين)
const response = await fetch('/api/method/frappe.client.set_value', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    doctype: 'Company',
    name: 'القرعاوي',  // اسم الشركة
    fieldname: 'default_holiday_list',
    value: 'HL-2026-القرعاوي'  // اسم قائمة العطل
  })
});

const result = await response.json();
console.log('تم تعيين قائمة العطل الافتراضية للشركة:', result.message);
```

### 3.3 التحقق من قائمة العطل للموظف أو الشركة

```javascript
// التحقق من وجود قائمة عطل للموظف
async function checkEmployeeHolidayList(employeeId) {
  const empResponse = await fetch('/api/method/frappe.client.get', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      doctype: 'Employee',
      name: employeeId,
      fields: ['name', 'employee_name', 'company', 'holiday_list']
    })
  });
  
  const employee = (await empResponse.json()).message;
  
  // إذا لم يكن للموظف قائمة عطل، تحقق من الشركة
  if (!employee.holiday_list) {
    const companyResponse = await fetch('/api/method/frappe.client.get', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        doctype: 'Company',
        name: employee.company,
        fields: ['name', 'default_holiday_list']
      })
    });
    
    const company = (await companyResponse.json()).message;
    
    return {
      has_holiday_list: !!company.default_holiday_list,
      source: 'company',
      holiday_list: company.default_holiday_list,
      employee_id: employee.name,
      employee_name: employee.employee_name,
      company: employee.company
    };
  }
  
  return {
    has_holiday_list: true,
    source: 'employee',
    holiday_list: employee.holiday_list,
    employee_id: employee.name,
    employee_name: employee.employee_name
  };
}

// الاستخدام
const check = await checkEmployeeHolidayList('HR-EMP-00022');
if (!check.has_holiday_list) {
  console.error('لا توجد قائمة عطل للموظف أو الشركة!');
  // قم بتعيين قائمة عطل
}
```

### 3.4 تعيين قائمة عطل لجميع موظفي قسم معين

```javascript
// تعيين قائمة عطل لجميع موظفي قسم
async function setHolidayListForDepartment(department, holidayListName) {
  // 1. الحصول على جميع الموظفين في القسم
  const employeesResponse = await fetch('/api/method/frappe.client.get_list', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      doctype: 'Employee',
      fields: ['name', 'employee_name'],
      filters: [
        ['department', '=', department],
        ['status', '=', 'Active']
      ],
      limit_page_length: 0
    })
  });
  
  const employees = (await employeesResponse.json()).message;
  
  // 2. تعيين قائمة العطل لكل موظف
  const results = await Promise.all(
    employees.map(async (emp) => {
      try {
        await fetch('/api/method/frappe.client.set_value', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            doctype: 'Employee',
            name: emp.name,
            fieldname: 'holiday_list',
            value: holidayListName
          })
        });
        return { success: true, employee: emp.name };
      } catch (error) {
        return { success: false, employee: emp.name, error: error.message };
      }
    })
  );
  
  return results;
}

// الاستخدام
const results = await setHolidayListForDepartment('المبيعات', 'HL-2026-القرعاوي');
console.log('تم تحديث', results.filter(r => r.success).length, 'موظف');
```

### 3.5 تعيين قائمة عطل مختلفة لكل فرع

```javascript
// تعيين قوائم عطل مختلفة حسب الفرع
async function setHolidayListByBranch(branchHolidayMap) {
  // branchHolidayMap مثال: { 'القاهرة': 'HL-2026-القاهرة', 'الإسكندرية': 'HL-2026-الإسكندرية' }
  
  const results = [];
  
  for (const [branch, holidayList] of Object.entries(branchHolidayMap)) {
    // الحصول على موظفي الفرع
    const employeesResponse = await fetch('/api/method/frappe.client.get_list', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        doctype: 'Employee',
        fields: ['name'],
        filters: [
          ['branch', '=', branch],
          ['status', '=', 'Active']
        ]
      })
    });
    
    const employees = (await employeesResponse.json()).message;
    
    // تحديث كل موظف
    for (const emp of employees) {
      await fetch('/api/method/frappe.client.set_value', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          doctype: 'Employee',
          name: emp.name,
          fieldname: 'holiday_list',
          value: holidayList
        })
      });
    }
    
    results.push({ branch, employees_updated: employees.length });
  }
  
  return results;
}

// الاستخدام
const branchResults = await setHolidayListByBranch({
  'القاهرة': 'HL-2026-القاهرة',
  'الإسكندرية': 'HL-2026-الإسكندرية',
  'أسيوط': 'HL-2026-أسيوط'
});
```

---

## 4. إدارة أيام العطل

### 4.1 إضافة يوم عطل واحد

**Endpoint:** `POST /api/method/frappe.client.save`

```javascript
// إضافة يوم عطل جديد إلى قائمة موجودة
async function addHoliday(holidayListName, holidayDate, description) {
  // 1. قراءة القائمة الحالية
  const getResponse = await fetch('/api/method/frappe.client.get', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      doctype: 'Holiday List',
      name: holidayListName
    })
  });
  
  const holidayList = (await getResponse.json()).message;
  
  // 2. إضافة اليوم الجديد
  holidayList.holidays.push({
    holiday_date: holidayDate,
    description: description,
    weekly_off: 0
  });
  
  // 3. حفظ القائمة
  const saveResponse = await fetch('/api/method/frappe.client.save', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      doc: holidayList
    })
  });
  
  return await saveResponse.json();
}

// الاستخدام
await addHoliday('HL-2026-القرعاوي', '2026-12-25', 'عيد الميلاد');
```

### 4.2 إضافة عدة أيام عطل

```javascript
// إضافة عدة أيام عطل دفعة واحدة
async function addMultipleHolidays(holidayListName, holidays) {
  // holidays مثال: [{ date: '2026-01-01', desc: 'رأس السنة' }, ...]
  
  const getResponse = await fetch('/api/method/frappe.client.get', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      doctype: 'Holiday List',
      name: holidayListName
    })
  });
  
  const holidayList = (await getResponse.json()).message;
  
  // إضافة الأيام الجديدة
  holidays.forEach(holiday => {
    holidayList.holidays.push({
      holiday_date: holiday.date,
      description: holiday.desc,
      weekly_off: 0
    });
  });
  
  // حفظ
  const saveResponse = await fetch('/api/method/frappe.client.save', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ doc: holidayList })
  });
  
  return await saveResponse.json();
}

// الاستخدام
await addMultipleHolidays('HL-2026-القرعاوي', [
  { date: '2026-01-01', desc: 'رأس السنة الميلادية' },
  { date: '2026-01-25', desc: 'عيد الثورة' },
  { date: '2026-04-25', desc: 'عيد تحرير سيناء' }
]);
```

### 4.3 حذف يوم عطل من القائمة

```javascript
// حذف يوم عطل محدد
async function removeHoliday(holidayListName, holidayDate) {
  const getResponse = await fetch('/api/method/frappe.client.get', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      doctype: 'Holiday List',
      name: holidayListName
    })
  });
  
  const holidayList = (await getResponse.json()).message;
  
  // إزالة التاريخ المحدد
  holidayList.holidays = holidayList.holidays.filter(
    h => h.holiday_date !== holidayDate
  );
  
  // حفظ
  const saveResponse = await fetch('/api/method/frappe.client.save', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ doc: holidayList })
  });
  
  return await saveResponse.json();
}

// الاستخدام
await removeHoliday('HL-2026-القرعاوي', '2026-01-01');
```

### 4.4 تحديث وصف يوم عطل

```javascript
// تحديث وصف يوم عطل موجود
async function updateHolidayDescription(holidayListName, holidayDate, newDescription) {
  const getResponse = await fetch('/api/method/frappe.client.get', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      doctype: 'Holiday List',
      name: holidayListName
    })
  });
  
  const holidayList = (await getResponse.json()).message;
  
  // تحديث الوصف
  const holiday = holidayList.holidays.find(h => h.holiday_date === holidayDate);
  if (holiday) {
    holiday.description = newDescription;
  }
  
  // حفظ
  const saveResponse = await fetch('/api/method/frappe.client.save', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ doc: holidayList })
  });
  
  return await saveResponse.json();
}
```

---

## 5. التحقق من أيام العطل

### 5.1 التحقق من تاريخ معين هل هو عطلة

**Endpoint:** `POST /api/method/hrms.hr.doctype.holiday_list.holiday_list.is_holiday`

```javascript
// التحقق من تاريخ معين
const response = await fetch('/api/method/hrms.hr.doctype.holiday_list.holiday_list.is_holiday', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    holiday_list: 'HL-2026-القرعاوي',
    date: '2026-01-25'
  })
});

const result = await response.json();
console.log('هل اليوم عطلة؟', result.message);  // true أو false
```

### 5.2 الحصول على جميع العطلات في فترة زمنية

```javascript
// الحصول على العطلات بين تاريخين
async function getHolidaysBetweenDates(holidayListName, startDate, endDate) {
  const response = await fetch('/api/method/frappe.client.get', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      doctype: 'Holiday List',
      name: holidayListName
    })
  });
  
  const holidayList = (await response.json()).message;
  
  // تصفية الأيام حسب الفترة
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  const filteredHolidays = holidayList.holidays.filter(h => {
    const hDate = new Date(h.holiday_date);
    return hDate >= start && hDate <= end;
  });
  
  return filteredHolidays;
}

// الاستخدام
const holidays = await getHolidaysBetweenDates('HL-2026-القرعاوي', '2026-01-01', '2026-03-31');
console.log('عدد أيام العطل في الربع الأول:', holidays.length);
```

### 5.3 حساب عدد أيام العمل بين تاريخين

**Endpoint:** `POST /api/method/hrms.hr.doctype.holiday_list.holiday_list.get_working_days`

```javascript
// حساب أيام العمل (استثناء العطلات)
const response = await fetch('/api/method/hrms.hr.doctype.holiday_list.holiday_list.get_working_days', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    holiday_list: 'HL-2026-القرعاوي',
    start_date: '2026-01-01',
    end_date: '2026-01-31'
  })
});

const workingDays = await response.json();
console.log('أيام العمل في يناير 2026:', workingDays.message);
```

### 5.4 الحصول على أقرب يوم عمل

```javascript
// الحصول على أقرب يوم عمل (إذا كان التاريخ عطلة)
async function getNextWorkingDay(holidayListName, date) {
  const response = await fetch('/api/method/frappe.client.get', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      doctype: 'Holiday List',
      name: holidayListName
    })
  });
  
  const holidayList = (await response.json()).message;
  const holidayDates = holidayList.holidays.map(h => h.holiday_date);
  
  let currentDate = new Date(date);
  
  // تقدم في التواريخ حتى نجد يوم عمل
  while (holidayDates.includes(currentDate.toISOString().split('T')[0])) {
    currentDate.setDate(currentDate.getDate() + 1);
  }
  
  return currentDate.toISOString().split('T')[0];
}

// الاستخدام
const nextWorking = await getNextWorkingDay('HL-2026-القرعاوي', '2026-01-25');  // عيد الثورة
console.log('أقرب يوم عمل:', nextWorking);
```

---

## هياكل البيانات

### Holiday List Document Structure

```typescript
interface HolidayList {
  // الحقول الأساسية
  name: string;                 // ID تلقائي: "HL-2026-COMPANY"
  holiday_list_name: string;    // اسم وصفي: "قائمة عطل 2026"
  from_date: string;            // تاريخ البداية: "2026-01-01"
  to_date: string;              // تاريخ النهاية: "2026-12-31"
  
  // الإعدادات
  company?: string;             // الشركة (اختياري)
  weekly_off?: string;          // يوم الإجازة الأسبوعية: "Friday", "Saturday", etc.
  color?: string;               // لون العرض: "#3498db"
  
  // البيانات المحسوبة
  total_holidays?: number;      // إجمالي عدد أيام العطل (محسوب تلقائياً)
  
  // جدول أيام العطل (Child Table)
  holidays: Holiday[];
}

interface Holiday {
  holiday_date: string;         // التاريخ: "2026-01-01"
  description: string;          // الوصف: "رأس السنة"
  weekly_off: 0 | 1;           // هل هو weekly off؟ 0 = لا، 1 = نعم
}
```

### Employee Document (Holiday List Field)

```typescript
interface Employee {
  name: string;                 // "HR-EMP-00001"
  employee_name: string;
  company: string;
  holiday_list?: string;        // قائمة عطل الموظف: "HL-2026-القرعاوي"
  // ... باقي الحقول
}
```

### Company Document (Default Holiday List)

```typescript
interface Company {
  name: string;                     // "القرعاوي"
  company_name: string;
  default_holiday_list?: string;    // قائمة العطل الافتراضية: "HL-2026-القرعاوي"
  // ... باقي الحقول
}
```

---

## معالجة الأخطاء

### الأخطاء الشائعة والحلول

#### 1. ValidationError: Please set a default Holiday List

```javascript
// الخطأ
{
  "exception": "frappe.exceptions.ValidationError",
  "message": "يرجى تعيين قائمة العطل الافتراضية للموظف HR-EMP-00022 أو الشركة القرعاوي"
}

// الحل
async function fixMissingHolidayList(employeeId) {
  // الخيار 1: تعيين للموظف
  await fetch('/api/method/frappe.client.set_value', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      doctype: 'Employee',
      name: employeeId,
      fieldname: 'holiday_list',
      value: 'HL-2026-القرعاوي'
    })
  });
  
  // أو الخيار 2: تعيين للشركة (أفضل للتطبيق على جميع الموظفين)
  await fetch('/api/method/frappe.client.set_value', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      doctype: 'Company',
      name: 'القرعاوي',
      fieldname: 'default_holiday_list',
      value: 'HL-2026-القرعاوي'
    })
  });
}
```

#### 2. Holiday List not found

```javascript
// معالجة عدم وجود قائمة عطل
async function ensureHolidayListExists(holidayListName) {
  try {
    const response = await fetch('/api/method/frappe.client.get', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        doctype: 'Holiday List',
        name: holidayListName
      })
    });
    
    const result = await response.json();
    
    if (result.exc_type === 'DoesNotExistError') {
      // إنشاء القائمة إذا لم تكن موجودة
      return await createDefaultHolidayList(holidayListName);
    }
    
    return result.message;
  } catch (error) {
    console.error('خطأ في التحقق من قائمة العطل:', error);
    throw error;
  }
}

async function createDefaultHolidayList(name) {
  const currentYear = new Date().getFullYear();
  
  return await fetch('/api/method/frappe.client.insert', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      doc: {
        doctype: 'Holiday List',
        holiday_list_name: name,
        from_date: `${currentYear}-01-01`,
        to_date: `${currentYear}-12-31`,
        weekly_off: 'Friday'
      }
    })
  });
}
```

#### 3. التعامل مع التواريخ المتداخلة

```javascript
// التأكد من عدم تداخل التواريخ عند إضافة عطلات
async function addHolidayIfNotExists(holidayListName, holidayDate, description) {
  const response = await fetch('/api/method/frappe.client.get', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      doctype: 'Holiday List',
      name: holidayListName
    })
  });
  
  const holidayList = (await response.json()).message;
  
  // التحقق من عدم وجود التاريخ مسبقاً
  const exists = holidayList.holidays.some(h => h.holiday_date === holidayDate);
  
  if (exists) {
    console.log('التاريخ موجود بالفعل في قائمة العطل');
    return { success: false, message: 'Date already exists' };
  }
  
  // إضافة التاريخ
  holidayList.holidays.push({
    holiday_date: holidayDate,
    description: description,
    weekly_off: 0
  });
  
  // حفظ
  await fetch('/api/method/frappe.client.save', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ doc: holidayList })
  });
  
  return { success: true };
}
```

---

## أمثلة تطبيقية كاملة

### مثال 1: إعداد النظام للسنة الجديدة

```javascript
async function setupNewYearHolidays(year, company) {
  console.log(`إعداد قائمة العطل لسنة ${year}...`);
  
  // 1. إنشاء قائمة العطل
  const holidayListResponse = await fetch('/api/method/frappe.client.insert', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      doc: {
        doctype: 'Holiday List',
        holiday_list_name: `قائمة عطل ${company} ${year}`,
        from_date: `${year}-01-01`,
        to_date: `${year}-12-31`,
        company: company,
        weekly_off: 'Friday',
        holidays: [
          { holiday_date: `${year}-01-01`, description: 'رأس السنة الميلادية', weekly_off: 0 },
          { holiday_date: `${year}-01-25`, description: 'عيد الثورة', weekly_off: 0 },
          { holiday_date: `${year}-04-25`, description: 'عيد تحرير سيناء', weekly_off: 0 },
          { holiday_date: `${year}-05-01`, description: 'عيد العمال', weekly_off: 0 },
          { holiday_date: `${year}-06-30`, description: 'عيد ثورة 30 يونيو', weekly_off: 0 },
          { holiday_date: `${year}-07-23`, description: 'عيد ثورة 23 يوليو', weekly_off: 0 },
          { holiday_date: `${year}-10-06`, description: 'عيد القوات المسلحة', weekly_off: 0 }
        ]
      }
    })
  });
  
  const holidayList = (await holidayListResponse.json()).message;
  console.log('تم إنشاء قائمة العطل:', holidayList.name);
  
  // 2. تعيين القائمة كافتراضية للشركة
  await fetch('/api/method/frappe.client.set_value', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      doctype: 'Company',
      name: company,
      fieldname: 'default_holiday_list',
      value: holidayList.name
    })
  });
  
  console.log('تم تعيين قائمة العطل كافتراضية للشركة');
  
  return holidayList.name;
}

// الاستخدام
await setupNewYearHolidays(2027, 'القرعاوي');
```

### مثال 2: مراجعة وإصلاح الموظفين بدون قائمة عطل

```javascript
async function auditAndFixEmployeeHolidayLists(defaultHolidayList) {
  console.log('مراجعة قوائم العطل للموظفين...');
  
  // 1. الحصول على جميع الموظفين النشطين
  const employeesResponse = await fetch('/api/method/frappe.client.get_list', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      doctype: 'Employee',
      fields: ['name', 'employee_name', 'company', 'holiday_list'],
      filters: [['status', '=', 'Active']],
      limit_page_length: 0
    })
  });
  
  const employees = (await employeesResponse.json()).message;
  console.log(`إجمالي الموظفين: ${employees.length}`);
  
  // 2. تحديد الموظفين بدون قائمة عطل
  const employeesWithoutList = employees.filter(emp => !emp.holiday_list);
  console.log(`موظفون بدون قائمة عطل: ${employeesWithoutList.length}`);
  
  // 3. إصلاح الموظفين
  const results = {
    success: [],
    failed: []
  };
  
  for (const emp of employeesWithoutList) {
    try {
      await fetch('/api/method/frappe.client.set_value', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          doctype: 'Employee',
          name: emp.name,
          fieldname: 'holiday_list',
          value: defaultHolidayList
        })
      });
      
      results.success.push(emp.name);
      console.log(`✓ تم إصلاح: ${emp.employee_name}`);
    } catch (error) {
      results.failed.push({ employee: emp.name, error: error.message });
      console.error(`✗ فشل: ${emp.employee_name}`, error);
    }
  }
  
  console.log(`\nالنتائج النهائية:`);
  console.log(`- نجح: ${results.success.length}`);
  console.log(`- فشل: ${results.failed.length}`);
  
  return results;
}

// الاستخدام
const auditResults = await auditAndFixEmployeeHolidayLists('HL-2026-القرعاوي');
```

### مثال 3: واجهة مستخدم لإدارة العطلات

```javascript
// مثال كامل لواجهة إدارة العطلات
class HolidayManager {
  constructor(apiToken) {
    this.apiToken = apiToken;
    this.baseHeaders = {
      'Content-Type': 'application/json',
      'Authorization': `token ${apiToken}`
    };
  }
  
  // الحصول على جميع قوائم العطلات
  async getAllHolidayLists() {
    const response = await fetch('/api/method/frappe.client.get_list', {
      method: 'POST',
      headers: this.baseHeaders,
      body: JSON.stringify({
        doctype: 'Holiday List',
        fields: ['name', 'holiday_list_name', 'from_date', 'to_date', 'total_holidays', 'company'],
        order_by: 'from_date desc'
      })
    });
    return (await response.json()).message;
  }
  
  // إنشاء قائمة عطل جديدة
  async createHolidayList(name, fromDate, toDate, company, weeklyOff = 'Friday') {
    const response = await fetch('/api/method/frappe.client.insert', {
      method: 'POST',
      headers: this.baseHeaders,
      body: JSON.stringify({
        doc: {
          doctype: 'Holiday List',
          holiday_list_name: name,
          from_date: fromDate,
          to_date: toDate,
          company: company,
          weekly_off: weeklyOff
        }
      })
    });
    return (await response.json()).message;
  }
  
  // إضافة يوم عطل
  async addHoliday(holidayListName, date, description) {
    const list = await this.getHolidayList(holidayListName);
    list.holidays.push({
      holiday_date: date,
      description: description,
      weekly_off: 0
    });
    
    const response = await fetch('/api/method/frappe.client.save', {
      method: 'POST',
      headers: this.baseHeaders,
      body: JSON.stringify({ doc: list })
    });
    return (await response.json()).message;
  }
  
  // حذف يوم عطل
  async removeHoliday(holidayListName, date) {
    const list = await this.getHolidayList(holidayListName);
    list.holidays = list.holidays.filter(h => h.holiday_date !== date);
    
    const response = await fetch('/api/method/frappe.client.save', {
      method: 'POST',
      headers: this.baseHeaders,
      body: JSON.stringify({ doc: list })
    });
    return (await response.json()).message;
  }
  
  // تعيين قائمة عطل لموظف
  async assignToEmployee(employeeId, holidayListName) {
    const response = await fetch('/api/method/frappe.client.set_value', {
      method: 'POST',
      headers: this.baseHeaders,
      body: JSON.stringify({
        doctype: 'Employee',
        name: employeeId,
        fieldname: 'holiday_list',
        value: holidayListName
      })
    });
    return (await response.json()).message;
  }
  
  // تعيين قائمة عطل افتراضية للشركة
  async setCompanyDefault(companyName, holidayListName) {
    const response = await fetch('/api/method/frappe.client.set_value', {
      method: 'POST',
      headers: this.baseHeaders,
      body: JSON.stringify({
        doctype: 'Company',
        name: companyName,
        fieldname: 'default_holiday_list',
        value: holidayListName
      })
    });
    return (await response.json()).message;
  }
  
  // التحقق من تاريخ هل هو عطلة
  async isHoliday(holidayListName, date) {
    const response = await fetch('/api/method/hrms.hr.doctype.holiday_list.holiday_list.is_holiday', {
      method: 'POST',
      headers: this.baseHeaders,
      body: JSON.stringify({
        holiday_list: holidayListName,
        date: date
      })
    });
    return (await response.json()).message;
  }
  
  // دالة مساعدة
  async getHolidayList(name) {
    const response = await fetch('/api/method/frappe.client.get', {
      method: 'POST',
      headers: this.baseHeaders,
      body: JSON.stringify({
        doctype: 'Holiday List',
        name: name
      })
    });
    return (await response.json()).message;
  }
}

// الاستخدام
const manager = new HolidayManager('your_api_key:your_api_secret');

// عرض جميع القوائم
const lists = await manager.getAllHolidayLists();
console.log('قوائم العطل:', lists);

// إنشاء قائمة جديدة
const newList = await manager.createHolidayList(
  'قائمة عطل 2027',
  '2027-01-01',
  '2027-12-31',
  'القرعاوي',
  'Friday'
);

// إضافة يوم عطل
await manager.addHoliday(newList.name, '2027-01-01', 'رأس السنة');

// تعيين للشركة
await manager.setCompanyDefault('القرعاوي', newList.name);
```

---

## ملاحظات هامة

### أفضل الممارسات

1. **تعيين القائمة على مستوى الشركة:** أسهل من تعيين لكل موظف على حدة
2. **التحديث السنوي:** قم بإنشاء قائمة عطل جديدة كل سنة
3. **التحقق قبل العمليات:** تأكد من وجود قائمة عطل قبل إنشاء طلبات الإجازات
4. **استخدام Weekly Off:** استفد من خاصية Weekly Off لإضافة أيام الإجازة الأسبوعية تلقائياً

### الحد من الأخطاء

```javascript
// دالة شاملة للتحقق والإصلاح التلقائي
async function ensureEmployeeHasHolidayList(employeeId) {
  // 1. الحصول على بيانات الموظف
  const empResponse = await fetch('/api/method/frappe.client.get', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      doctype: 'Employee',
      name: employeeId,
      fields: ['name', 'company', 'holiday_list']
    })
  });
  
  const employee = (await empResponse.json()).message;
  
  // 2. إذا كان للموظف قائمة عطل، لا حاجة للمزيد
  if (employee.holiday_list) {
    return { success: true, source: 'employee', holiday_list: employee.holiday_list };
  }
  
  // 3. التحقق من القائمة الافتراضية للشركة
  const companyResponse = await fetch('/api/method/frappe.client.get', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      doctype: 'Company',
      name: employee.company,
      fields: ['default_holiday_list']
    })
  });
  
  const company = (await companyResponse.json()).message;
  
  if (company.default_holiday_list) {
    return { success: true, source: 'company', holiday_list: company.default_holiday_list };
  }
  
  // 4. لا توجد قائمة عطل - إنشاء واحدة
  console.warn('لا توجد قائمة عطل للموظف أو الشركة، سيتم الإنشاء تلقائياً');
  
  const year = new Date().getFullYear();
  const newListResponse = await fetch('/api/method/frappe.client.insert', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      doc: {
        doctype: 'Holiday List',
        holiday_list_name: `قائمة عطل ${employee.company} ${year}`,
        from_date: `${year}-01-01`,
        to_date: `${year}-12-31`,
        company: employee.company,
        weekly_off: 'Friday'
      }
    })
  });
  
  const newList = (await newListResponse.json()).message;
  
  // 5. تعيين القائمة الجديدة للشركة
  await fetch('/api/method/frappe.client.set_value', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      doctype: 'Company',
      name: employee.company,
      fieldname: 'default_holiday_list',
      value: newList.name
    })
  });
  
  return { success: true, source: 'created', holiday_list: newList.name };
}
```

---

## الخلاصة

هذا المستند يغطي جميع العمليات الأساسية للتعامل مع قوائم العطلات في Frappe/ERPNext:

✅ **قراءة وعرض** قوائم العطلات وأيام العطل  
✅ **إنشاء وتحديث** قوائم العطلات  
✅ **تعيين** قوائم العطلات للموظفين والشركات  
✅ **إدارة** أيام العطل (إضافة، حذف، تحديث)  
✅ **التحقق** من أيام العطل وحساب أيام العمل  
✅ **حل الأخطاء** الشائعة مثل ValidationError  

للمزيد من المساعدة، راجع:
- [Frappe Framework Documentation](https://frappeframework.com/docs)
- [ERPNext HR Documentation](https://docs.erpnext.com/docs/user/manual/en/human-resources)
