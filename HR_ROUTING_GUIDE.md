# دليل المسارات والتوجيه (Routing Guide) - نظام الموارد البشرية

## 📋 نظرة عامة
هذا الدليل يشرح بالتفصيل كيفية عمل نظام المسارات (Routing) في تطبيق Meena/HRMS للموارد البشرية، وكيفية التنقل بين الصفحات برمجياً.

---

## 🛣️ أنماط المسارات (Route Patterns)

### 1. Workspace Routes
```javascript
Pattern: /app/<workspace-name>
Example: http://localhost:8000/app/hr

// الوصول برمجياً
frappe.set_route('app', 'hr');
frappe.set_route('app', 'payroll');
frappe.set_route('app', 'recruitment');
```

### 2. List View Routes
```javascript
Pattern: /app/<doctype>
Example: http://localhost:8000/app/employee

// الوصول برمجياً
frappe.set_route('List', 'Employee');
frappe.set_route('List', 'Attendance');
frappe.set_route('List', 'Salary Slip');
```

### 3. Custom List View Routes
```javascript
Pattern: /app/List/<DocType>/view/<view-type>
Example: http://localhost:8000/app/List/Employee/view/cards

// الوصول برمجياً
frappe.set_route('List', 'Employee', 'view', 'cards');
frappe.set_route('List', 'Job Applicant', 'view', 'cards');
```

### 4. Form Routes (New)
```javascript
Pattern: /app/<doctype>/new-<doctype>-1
Example: http://localhost:8000/app/employee/new-employee-1

// الوصول برمجياً
frappe.set_route('Form', 'Employee', 'new-employee-1');
frappe.new_doc('Employee');
```

### 5. Form Routes (Existing)
```javascript
Pattern: /app/<doctype>/<document-name>
Example: http://localhost:8000/app/employee/HR-EMP-00001

// الوصول برمجياً
frappe.set_route('Form', 'Employee', 'HR-EMP-00001');
```

### 6. Report Routes
```javascript
Pattern: /app/query-report/<report-name>
Example: http://localhost:8000/app/query-report/Monthly%20Attendance%20Sheet

// الوصول برمجياً
frappe.set_route('query-report', 'Monthly Attendance Sheet');
frappe.set_route('query-report', 'Employee Analytics');
```

### 7. Page Routes
```javascript
Pattern: /app/<page-name>
Example: http://localhost:8000/app/organizational-chart

// الوصول برمجياً
frappe.set_route('organizational-chart');
frappe.set_route('team-updates');
```

---

## 🔄 نظام التوجيه في Meena Dock

### كود التوجيه الأساسي
```javascript
// ملف: /apps/base_meena/base_meena/public/js/hr_dashboard_view.js

// Menu item click
$(document).on('click', '.meena-dock-menu-item', function() {
    const route = $(this).data('route');
    if (route) {
        if (route === 'user-profile') {
            // فتح بروفايل المستخدم
            if (frappe.session.user) {
                frappe.set_route('Form', 'User', frappe.session.user);
            }
        } else if (route === 'logout') {
            // تسجيل الخروج
            frappe.app.logout();
        } else {
            // التوجيه العادي
            frappe.set_route(route);
        }
        $('.meena-dock-menu').removeClass('active');
    }
});
```

### خريطة المسارات في Dock
```javascript
// تعريف عناصر القائمة
const menuItems = [
    { 
        label: 'لوحة القيادة', 
        icon: getDashboardIcon(), 
        iconColor: 'text-blue', 
        route: 'app/hr' 
    },
    { 
        label: 'الموظفين', 
        icon: getUsersIcon(), 
        iconColor: 'text-sky', 
        route: 'List/Employee/view/cards' 
    },
    { 
        label: 'التوظيف', 
        icon: getUserPlusIcon(), 
        iconColor: 'text-green', 
        route: 'List/Job Applicant/view/cards' 
    },
    { 
        label: 'الحضور', 
        icon: getCalendarIcon(), 
        iconColor: 'text-amber', 
        route: 'List/Attendance/view/cards' 
    },
    { 
        label: 'الإجازات', 
        icon: getCalendarIcon(), 
        iconColor: 'text-amber', 
        route: 'List/Leave Application/view/cards' 
    },
    { 
        label: 'الرواتب', 
        icon: getDollarIcon(), 
        iconColor: 'text-emerald', 
        route: 'List/Salary Slip/view/cards' 
    },
    { 
        label: 'المصروفات', 
        icon: getReceiptIcon(), 
        iconColor: 'text-orange', 
        route: 'List/Expense Claim/view/cards' 
    }
];
```

---

## 🎯 Frappe Router API

### الدوال الأساسية

#### 1. frappe.set_route()
```javascript
// أنماط الاستخدام المختلفة

// Workspace
frappe.set_route('app', 'hr');

// List View
frappe.set_route('List', 'Employee');

// List View مع فلتر
frappe.set_route('List', 'Employee', {status: 'Active'});

// Form View
frappe.set_route('Form', 'Employee', 'HR-EMP-00001');

// Form جديد
frappe.set_route('Form', 'Employee', 'new-employee-1');

// Report
frappe.set_route('query-report', 'Employee Analytics');

// Page
frappe.set_route('organizational-chart');

// Tree View
frappe.set_route('Tree', 'Department');
```

#### 2. frappe.new_doc()
```javascript
// إنشاء مستند جديد مباشرة
frappe.new_doc('Employee');
frappe.new_doc('Leave Application');
frappe.new_doc('Salary Slip');

// مع قيم افتراضية
frappe.new_doc('Leave Application', {
    employee: 'HR-EMP-00001',
    from_date: frappe.datetime.get_today()
});
```

#### 3. frappe.route_options
```javascript
// تعيين فلاتر قبل التوجيه
frappe.route_options = {
    employee: 'HR-EMP-00001',
    status: 'Open'
};
frappe.set_route('List', 'Leave Application');
```

#### 4. frappe.get_route()
```javascript
// الحصول على المسار الحالي
const route = frappe.get_route();
// مثال: ['List', 'Employee', 'view', 'cards']

// الحصول على نوع المسار
const route_type = frappe.get_route()[0];
// 'List', 'Form', 'query-report', etc.

// الحصول على DocType
const doctype = frappe.get_route()[1];
```

#### 5. frappe.router.on()
```javascript
// مراقبة تغيير المسارات
frappe.router.on('change', function() {
    const route = frappe.get_route();
    console.log('Route changed to:', route);
    
    // تنفيذ كود مخصص عند تغيير المسار
    if (route[0] === 'List' && route[1] === 'Employee') {
        console.log('Navigated to Employee List');
    }
});
```

---

## 🔍 فلترة المسارات (Route Filtering)

### 1. فلترة List View
```javascript
// طريقة 1: باستخدام frappe.route_options
frappe.route_options = {
    department: 'Sales',
    status: 'Active'
};
frappe.set_route('List', 'Employee');

// طريقة 2: باستخدام كائن الفلتر
frappe.set_route('List', 'Employee', {
    department: 'Sales',
    status: 'Active'
});

// طريقة 3: فلتر متقدم
frappe.route_options = {
    department: ['in', ['Sales', 'Marketing']],
    creation: ['>', '2023-01-01']
};
frappe.set_route('List', 'Employee');
```

### 2. فلترة Reports
```javascript
// تعيين فلاتر قبل فتح التقرير
frappe.route_options = {
    from_date: '2024-01-01',
    to_date: '2024-01-31',
    employee: 'HR-EMP-00001'
};
frappe.set_route('query-report', 'Monthly Attendance Sheet');
```

---

## 🎨 Custom View Routing (Meena)

### Cards View Implementation
```javascript
// ملف: /apps/base_meena/base_meena/public/js/cards_view.js

// التبديل إلى Cards View
function goToCardsView(doctype) {
    const route = frappe.get_route();
    if (!route.includes('cards')) {
        frappe.set_route('List', doctype, 'view', 'cards');
    }
}

// مراقبة المسار وتفعيل Cards View
frappe.router.on('change', function() {
    const route = frappe.get_route();
    const path = window.location.pathname;
    
    if (path.endsWith('/view/cards')) {
        console.log('Cards view detected');
        activateCardsView();
    }
});
```

### Employee Cards Routing
```javascript
// ملف: /apps/base_meena/base_meena/public/js/employee_cards.js

function activateEmployeeCards() {
    const route = frappe.get_route();
    
    // التحقق من أننا في صفحة Employee List
    if (route[0] === 'List' && route[1] === 'Employee') {
        // تفعيل عرض البطاقات
        initializeEmployeeCardsView();
    }
}

// مراقبة تغيير المسار
frappe.router.on('change', activateEmployeeCards);
```

### Recruitment Cards Routing
```javascript
// ملف: /apps/base_meena/base_meena/public/js/recruitment_view.js

function activateRecruitmentView() {
    const route = frappe.get_route();
    
    // التحقق من صفحة Job Applicants
    if (route[0] === 'List' && route[1] === 'Job Applicant') {
        console.log('On Job Applicant list page');
        initializeRecruitmentCards();
    }
}

frappe.router.on('change', activateRecruitmentView);
```

---

## 🚀 أمثلة عملية للتوجيه

### مثال 1: التنقل من Dashboard إلى Form
```javascript
// في صفحة HR Dashboard
$(document).on('click', '.employee-card', function() {
    const employee_id = $(this).data('employee-id');
    frappe.set_route('Form', 'Employee', employee_id);
});
```

### مثال 2: فتح طلب إجازة جديد لموظف محدد
```javascript
function createLeaveApplication(employee_id) {
    frappe.route_options = {
        employee: employee_id,
        from_date: frappe.datetime.get_today()
    };
    frappe.new_doc('Leave Application');
}
```

### مثال 3: عرض تقرير الحضور لموظف
```javascript
function showAttendanceReport(employee_id, from_date, to_date) {
    frappe.route_options = {
        employee: employee_id,
        from_date: from_date,
        to_date: to_date
    };
    frappe.set_route('query-report', 'Monthly Attendance Sheet');
}
```

### مثال 4: التنقل الشرطي
```javascript
function navigateBasedOnRole() {
    const user = frappe.session.user;
    
    if (frappe.user.has_role('HR Manager')) {
        // المدير يذهب إلى Dashboard
        frappe.set_route('app', 'hr');
    } else if (frappe.user.has_role('Employee')) {
        // الموظف يذهب إلى ملفه الشخصي
        frappe.call({
            method: 'frappe.client.get_value',
            args: {
                doctype: 'Employee',
                filters: { user_id: user },
                fieldname: 'name'
            },
            callback: function(r) {
                if (r.message) {
                    frappe.set_route('Form', 'Employee', r.message.name);
                }
            }
        });
    }
}
```

---

## 📊 Route Detection and Handling

### كشف نوع الصفحة الحالية
```javascript
function getCurrentPageType() {
    const route = frappe.get_route();
    const path = window.location.pathname;
    
    // كشف نوع الصفحة
    if (route[0] === 'Form') {
        return {
            type: 'form',
            doctype: route[1],
            docname: route[2]
        };
    } else if (route[0] === 'List') {
        return {
            type: 'list',
            doctype: route[1],
            view: route[3] || 'list' // cards, kanban, etc.
        };
    } else if (route[0] === 'query-report') {
        return {
            type: 'report',
            report_name: route[1]
        };
    } else if (route[0] === 'app') {
        return {
            type: 'workspace',
            workspace: route[1]
        };
    } else {
        return {
            type: 'page',
            page_name: route[0]
        };
    }
}
```

### معالج مسارات شامل
```javascript
frappe.router.on('change', function() {
    const pageInfo = getCurrentPageType();
    
    switch(pageInfo.type) {
        case 'form':
            console.log('Form:', pageInfo.doctype, pageInfo.docname);
            handleFormView(pageInfo);
            break;
            
        case 'list':
            console.log('List:', pageInfo.doctype, pageInfo.view);
            handleListView(pageInfo);
            break;
            
        case 'report':
            console.log('Report:', pageInfo.report_name);
            handleReportView(pageInfo);
            break;
            
        case 'workspace':
            console.log('Workspace:', pageInfo.workspace);
            handleWorkspace(pageInfo);
            break;
            
        case 'page':
            console.log('Page:', pageInfo.page_name);
            handleCustomPage(pageInfo);
            break;
    }
});
```

---

## 🎯 Dashboard Specific Routing

### التوجيه من HR Dashboards المختلفة
```javascript
// ملف: /apps/base_meena/base_meena/public/js/frappe_dashboard_integration.js

window.navigateToPage = function(page) {
    console.log('Navigating to:', page);
    
    const routeMap = {
        // HR Routes
        'employees': ['List', 'Employee', 'view', 'cards'],
        'employee-form': ['Form', 'Employee', 'new-employee-1'],
        'attendance': ['List', 'Attendance', 'view', 'cards'],
        'leaves': ['List', 'Leave Application', 'view', 'cards'],
        'salary-slips': ['List', 'Salary Slip', 'view', 'cards'],
        'recruitment': ['List', 'Job Applicant', 'view', 'cards'],
        'expenses': ['List', 'Expense Claim', 'view', 'cards'],
        
        // Reports
        'employee-report': ['query-report', 'Employee Analytics'],
        'attendance-report': ['query-report', 'Monthly Attendance Sheet'],
        'salary-register': ['query-report', 'Salary Register'],
        
        // Settings
        'departments': ['List', 'Department'],
        'designations': ['List', 'Designation'],
        'branches': ['List', 'Branch']
    };
    
    const route = routeMap[page];
    if (route) {
        frappe.set_route(route);
    } else {
        console.error('Unknown page:', page);
        frappe.show_alert({
            message: 'الصفحة غير موجودة',
            indicator: 'red'
        });
    }
};
```

---

## 🔗 URL Generation

### توليد URLs يدوياً
```javascript
function generateFrappeURL(route_parts) {
    const base_url = window.location.origin;
    const route_string = route_parts.join('/');
    return `${base_url}/app/${route_string}`;
}

// أمثلة
const employee_url = generateFrappeURL(['employee', 'HR-EMP-00001']);
// http://localhost:8000/app/employee/HR-EMP-00001

const list_url = generateFrappeURL(['List', 'Employee', 'view', 'cards']);
// http://localhost:8000/app/List/Employee/view/cards
```

### URL Encoding للأسماء العربية
```javascript
function generateEncodedURL(route_parts) {
    const base_url = window.location.origin;
    const encoded_parts = route_parts.map(part => encodeURIComponent(part));
    return `${base_url}/app/${encoded_parts.join('/')}`;
}

// مثال مع نص عربي
const arabic_url = generateEncodedURL(['Form', 'Employee', 'موظف-001']);
```

---

## 🎨 Route-based UI Changes

### تغيير واجهة المستخدم حسب المسار
```javascript
frappe.router.on('change', function() {
    const route = frappe.get_route();
    
    // إخفاء Dock في صفحات معينة
    if (route[0] === 'print') {
        $('#meena-dock').hide();
        $('.small-square-wrapper').hide();
    } else {
        $('#meena-dock').show();
        $('.small-square-wrapper').show();
    }
    
    // تغيير لون الـ Dock حسب الوحدة
    const workspace = route[1];
    const colors = {
        'hr': '#2563eb',
        'payroll': '#9333ea',
        'recruitment': '#16a34a'
    };
    
    if (colors[workspace]) {
        $('.meena-dock-container').css('border-color', colors[workspace]);
    }
});
```

---

## 🛡️ Route Guards (حماية المسارات)

### التحقق من الصلاحيات قبل التوجيه
```javascript
function navigateWithPermissionCheck(route, required_role) {
    if (frappe.user.has_role(required_role)) {
        frappe.set_route(route);
    } else {
        frappe.msgprint({
            title: __('Access Denied'),
            message: __('You do not have permission to access this page'),
            indicator: 'red'
        });
    }
}

// استخدام
navigateWithPermissionCheck(['app', 'payroll'], 'HR Manager');
```

### إعادة التوجيه التلقائي
```javascript
frappe.router.on('change', function() {
    const route = frappe.get_route();
    const user = frappe.session.user;
    
    // إعادة توجيه الضيف إلى تسجيل الدخول
    if (user === 'Guest' && route[0] !== 'login') {
        frappe.set_route('login');
        return;
    }
    
    // إعادة توجيه غير المصرح لهم
    if (route[0] === 'app' && route[1] === 'payroll') {
        if (!frappe.user.has_role(['HR Manager', 'Accounts Manager'])) {
            frappe.set_route('app', 'hr');
            frappe.show_alert({
                message: 'غير مصرح بالوصول إلى صفحة الرواتب',
                indicator: 'orange'
            });
        }
    }
});
```

---

## 📱 Deep Linking

### روابط مباشرة قابلة للمشاركة
```javascript
// إنشاء رابط مباشر لتقرير محدد
function generateReportDeepLink(report_name, filters) {
    const base_url = window.location.origin;
    const encoded_filters = encodeURIComponent(JSON.stringify(filters));
    
    return `${base_url}/app/query-report/${encodeURIComponent(report_name)}?filters=${encoded_filters}`;
}

// استخدام
const link = generateReportDeepLink('Monthly Attendance Sheet', {
    employee: 'HR-EMP-00001',
    month: '01',
    year: '2024'
});

// نسخ الرابط
navigator.clipboard.writeText(link);
frappe.show_alert({
    message: 'تم نسخ الرابط',
    indicator: 'green'
});
```

---

## 🔄 Route History Management

### التنقل في التاريخ
```javascript
// العودة للصفحة السابقة
function goBack() {
    window.history.back();
}

// الذهاب للأمام
function goForward() {
    window.history.forward();
}

// العودة إلى صفحة محددة في التاريخ
function goToHistoryIndex(index) {
    window.history.go(index); // -1 للخلف، 1 للأمام
}
```

### حفظ حالة التطبيق
```javascript
// حفظ الفلاتر الحالية في Session Storage
function saveCurrentFilters() {
    const route = frappe.get_route();
    const filters = cur_list ? cur_list.get_filters_for_args() : {};
    
    sessionStorage.setItem('last_filters_' + route[1], JSON.stringify(filters));
}

// استعادة الفلاتر
function restoreFilters() {
    const route = frappe.get_route();
    const saved_filters = sessionStorage.getItem('last_filters_' + route[1]);
    
    if (saved_filters && cur_list) {
        const filters = JSON.parse(saved_filters);
        cur_list.filter_area.clear();
        Object.keys(filters).forEach(key => {
            cur_list.filter_area.add(key, filters[key]);
        });
    }
}
```

---

## 🎯 Best Practices للتوجيه

### 1. استخدم دوال Frappe الأصلية
```javascript
// ✅ صحيح
frappe.set_route('List', 'Employee');

// ❌ خطأ
window.location.href = '/app/employee';
```

### 2. تجنب Reload غير الضروري
```javascript
// ✅ صحيح - يستخدم Single Page Navigation
frappe.set_route('Form', 'Employee', employee_id);

// ❌ خطأ - يعيد تحميل الصفحة كلها
window.location.href = '/app/employee/' + employee_id;
```

### 3. استخدم Route Options للفلترة
```javascript
// ✅ صحيح
frappe.route_options = {status: 'Active'};
frappe.set_route('List', 'Employee');

// ❌ أقل كفاءة
frappe.set_route('List', 'Employee');
setTimeout(() => {
    cur_list.filter_area.add('status', 'Active');
}, 500);
```

### 4. تحقق من وجود المسار قبل التوجيه
```javascript
// ✅ صحيح
if (frappe.get_route()[0] !== 'List') {
    frappe.set_route('List', 'Employee');
}

// ❌ يمكن أن يسبب loops
frappe.set_route('List', 'Employee'); // في router.on('change')
```

---

## 🔍 Debugging Routes

### Console Commands للاختبار
```javascript
// في Console المتصفح

// 1. عرض المسار الحالي
frappe.get_route()

// 2. عرض تاريخ المسارات
frappe.route_history

// 3. التوجيه مع Logging
frappe.set_route('List', 'Employee');
console.log('Navigated to:', frappe.get_route());

// 4. مراقبة تغييرات المسارات
frappe.router.on('change', () => console.log('Route:', frappe.get_route()));

// 5. اختبار Route Options
frappe.route_options = {status: 'Active'};
console.log('Options set:', frappe.route_options);
```

---

## 📝 خلاصة

- استخدم `frappe.set_route()` للتنقل بين الصفحات
- استخدم `frappe.route_options` لتمرير الفلاتر
- راقب تغييرات المسارات باستخدام `frappe.router.on()`
- تجنب استخدام `window.location` مباشرة
- استفد من Custom View Routes في Meena
- تحقق من الصلاحيات قبل التوجيه للصفحات الحساسة

---

**تاريخ التحديث**: 7 فبراير 2026  
**الإصدار**: 1.0  
**المطور**: Meena Base App Team
