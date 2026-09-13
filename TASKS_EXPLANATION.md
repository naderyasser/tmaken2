# 📋 شرح تفصيلي لمتطلبات نظام المبيعات الموبايل

## نظرة عامة

هذا مشروع نظام مبيعات موبايل متقدم مبني على Frappe/ERPNext، يتكون من **6 وحدات رئيسية** و **15 تاسك فرعي**.

---

# 📦 Module 1: إدارة المخازن والمستودعات (Inventory Management)

## Task 1: هيكلة أنواع المستودعات

### الوصف
إنشاء هيكل يدعم أنواع مختلفة من المستودعات مع إمكانية إنشاء مستودعات ديناميكية.

### الحل في Frappe/ERPNext

#### 1. تعديل DocType: Warehouse

**الحقول المطلوبة:**

| Field Name | Type | Options | Description |
|------------|------|---------|-------------|
| `warehouse_type` | Select | Main, Van, Customer Location, Temporary | نوع المستودع |
| `is_dynamic` | Check | - | هل هو مستودع ديناميكي |
| `linked_salesman` | Link | Salesman | المندوب المرتبط (للمستودع Van) |
| `linked_customer` | Link | Customer | العميل المرتبط (للمستودع لدى العميل) |
| `parent_warehouse` | Link | Warehouse | المستودع الرئيسي |
| `gps_coordinates` | Geolocation | - | إحداثيات المستودع |

#### 2. إنشاء DocType جديد: Warehouse Template

```json
{
  "doctype": "DocType",
  "module": "Stock",
  "name": "Warehouse Template",
  "fields": [
    {"fieldname": "template_name", "fieldtype": "Data", "label": "Template Name"},
    {"fieldname": "warehouse_type", "fieldtype": "Select", "options": "Main\nVan\nCustomer Location"},
    {"fieldname": "default_warehouse_group", "fieldtype": "Link", "options": "Warehouse Group"},
    {"fieldname": "auto_create_warehouse", "fieldtype": "Check", "label": "Auto Create on Salesman Creation"}
  ]
}
```

#### 3. Python Script: إنشاء مستودع ديناميكي

```python
# hooks.py
warehouse_events = {
    "before_insert": "custom_app.warehouse.create_dynamic_warehouse"
}

# warehouse.py
def create_dynamic_warehouse(doc, method):
    """إنشاء مستودع Van تلقائياً عند إنشاء مندوب جديد"""
    if doc.doctype == "Salesman" and doc.warehouse_type == "Van":
        warehouse = frappe.new_doc("Warehouse")
        warehouse.warehouse_name = f"Van - {doc.salesman_name}"
        warehouse.warehouse_type = "Van"
        warehouse.linked_salesman = doc.name
        warehouse.is_group = 0
        warehouse.insert()
```

---

## Task 2: تصنيف حالة المخزون (Stock Statuses)

### الوصف
إضافة حالات مختلفة للصنف: نشط، تالف، اكسباير، رجيع.

### الحل في Frappe/ERPNext

#### 1. إنشاء DocType جديد: Stock Status

```json
{
  "doctype": "DocType",
  "module": "Stock",
  "name": "Stock Status",
  "fields": [
    {"fieldname": "status_name", "fieldtype": "Data", "label": "Status Name"},
    {"fieldname": "status_code", "fieldtype": "Data", "label": "Status Code"},
    {"fieldname": "color", "fieldtype": "Color", "label": "Color"},
    {"fieldname": "is_active", "fieldtype": "Check", "label": "Is Active"},
    {"fieldname": "description", "fieldtype": "Text", "label": "Description"}
  ]
}
```

#### 2. تعديل DocType: Stock Ledger Entry

**إضافة الحقول:**

| Field Name | Type | Options | Description |
|------------|------|---------|-------------|
| `stock_status` | Link | Stock Status | حالة المخزون |
| `expiry_date` | Date | - | تاريخ الانتهاء |
| `batch_no` | Link | Batch | رقم الباتش |

#### 3. تعديل DocType: Batch

**إضافة الحقول:**

| Field Name | Type | Options | Description |
|------------|------|---------|-------------|
| `stock_status` | Link | Stock Status | حالة المخزون الافتراضية |
| `is_expired` | Check | - | هل منتهي الصلاحية |
| `is_damaged` | Check | - | هل تالف |

#### 4. Python Script: تحديث حالة المخزون تلقائياً

```python
# stock_status.py
@frappe.whitelist()
def update_stock_status(batch_no):
    """تحديث حالة المخزون بناءً على تاريخ الانتهاء"""
    batch = frappe.get_doc("Batch", batch_no)
    
    # التحقق من الانتهاء
    if batch.expiry_date and batch.expiry_date < frappe.utils.today():
        batch.stock_status = "Expired"
        batch.is_expired = 1
    
    # حفظ التغييرات
    batch.save()
    
    # تحديث Stock Ledger Entries
    frappe.db.sql("""
        UPDATE `tabStock Ledger Entry`
        SET stock_status = %s
        WHERE batch_no = %s
    """, (batch.stock_status, batch_no))
```

---

## Task 3: تطوير لوجيك المخزون الرجيع (Custom Return Logic)

### الوصف
عند عمل ارتجاع، يتم زيادة الكمية في المخزون النشط وإنشاء سجل منفصل للتقارير.

### الحل في Frappe/ERPNext

#### 1. إنشاء DocType جديد: Return Log

```json
{
  "doctype": "DocType",
  "module": "Stock",
  "name": "Return Log",
  "fields": [
    {"fieldname": "return_date", "fieldtype": "Date", "label": "Return Date"},
    {"fieldname": "customer", "fieldtype": "Link", "options": "Customer"},
    {"fieldname": "sales_invoice", "fieldtype": "Link", "options": "Sales Invoice"},
    {"fieldname": "warehouse", "fieldtype": "Link", "options": "Warehouse"},
    {"fieldname": "return_reason", "fieldtype": "Select", "options": "Damaged\nExpired\nWrong Item\nCustomer Request"},
    {"fieldname": "items", "fieldtype": "Table", "label": "Items"},
    {"fieldname": "total_quantity", "fieldtype": "Float", "label": "Total Quantity"},
    {"fieldname": "total_value", "fieldtype": "Currency", "label": "Total Value"},
    {"fieldname": "created_by", "fieldtype": "Link", "options": "User"}
  ],
  "child_tables": [
    {
      "fieldname": "items",
      "doctype": "Return Log Item"
    }
  ]
}
```

#### 2. إنشاء DocType: Return Log Item

```json
{
  "doctype": "DocType",
  "module": "Stock",
  "name": "Return Log Item",
  "fields": [
    {"fieldname": "item_code", "fieldtype": "Link", "options": "Item"},
    {"fieldname": "item_name", "fieldtype": "Data", "label": "Item Name"},
    {"fieldname": "batch_no", "fieldtype": "Link", "options": "Batch"},
    {"fieldname": "quantity", "fieldtype": "Float", "label": "Quantity"},
    {"fieldname": "uom", "fieldtype": "Link", "options": "UOM"},
    {"fieldname": "rate", "fieldtype": "Currency", "label": "Rate"},
    {"fieldname": "amount", "fieldtype": "Currency", "label": "Amount"},
    {"fieldname": "stock_status", "fieldtype": "Link", "options": "Stock Status"}
  ]
}
```

#### 3. Python Script: لوجيك الرجيع

```python
# return_logic.py
@frappe.whitelist()
def process_stock_return(return_data):
    """معالجة ارتجاع المخزون"""
    import json
    
    data = json.loads(return_data)
    
    # 1. إنشاء Stock Entry للرجيع
    stock_entry = frappe.new_doc("Stock Entry")
    stock_entry.purpose = "Material Receipt"
    stock_entry.stock_entry_type = "Return"
    stock_entry.set_posting_time = 1
    stock_entry.posting_date = data.get("return_date")
    stock_entry.return_reason = data.get("return_reason")
    
    # 2. إضافة الأصناف
    for item in data.get("items"):
        stock_entry.append("items", {
            "item_code": item.get("item_code"),
            "qty": item.get("quantity"),
            "uom": item.get("uom"),
            "batch_no": item.get("batch_no"),
            "warehouse": data.get("warehouse"),
            "stock_status": "Active"  # زيادة في المخزون النشط
        })
    
    # 3. حفظ وإرسال Stock Entry
    stock_entry.submit()
    
    # 4. إنشاء سجل Return Log
    return_log = frappe.new_doc("Return Log")
    return_log.return_date = data.get("return_date")
    return_log.customer = data.get("customer")
    return_log.sales_invoice = data.get("sales_invoice")
    return_log.warehouse = data.get("warehouse")
    return_log.return_reason = data.get("return_reason")
    
    # إضافة الأصناف
    total_qty = 0
    total_value = 0
    
    for item in data.get("items"):
        return_log.append("items", {
            "item_code": item.get("item_code"),
            "item_name": frappe.db.get_value("Item", item.get("item_code"), "item_name"),
            "batch_no": item.get("batch_no"),
            "quantity": item.get("quantity"),
            "uom": item.get("uom"),
            "rate": item.get("rate"),
            "amount": item.get("rate") * item.get("quantity"),
            "stock_status": "Returned"
        })
        
        total_qty += item.get("quantity")
        total_value += item.get("rate") * item.get("quantity")
    
    return_log.total_quantity = total_qty
    return_log.total_value = total_value
    return_log.created_by = frappe.session.user
    
    # حفظ Return Log
    return_log.save()
    
    return {
        "stock_entry": stock_entry.name,
        "return_log": return_log.name,
        "status": "Success"
    }
```

#### 4. Hooks Configuration

```python
# hooks.py
doc_events = {
    "Stock Entry": {
        "on_submit": "custom_app.return_logic.create_return_log"
    }
}
```

---

## Task 4: سجل حركة المخزون (Audit Trail)

### الوصف
ضمان عدم حذف سجلات حركة الصنف حتى لو تم تصفير الكمية.

### الحل في Frappe/ERPNext

#### 1. إنشاء DocType جديد: Stock Movement Audit

```json
{
  "doctype": "DocType",
  "module": "Stock",
  "name": "Stock Movement Audit",
  "fields": [
    {"fieldname": "movement_date", "fieldtype": "Date", "label": "Movement Date"},
    {"fieldname": "movement_time", "fieldtype": "Time", "label": "Movement Time"},
    {"fieldname": "item_code", "fieldtype": "Link", "options": "Item"},
    {"fieldname": "warehouse", "fieldtype": "Link", "options": "Warehouse"},
    {"fieldname": "batch_no", "fieldtype": "Link", "options": "Batch"},
    {"fieldname": "quantity_change", "fieldtype": "Float", "label": "Quantity Change"},
    {"fieldname": "previous_qty", "fieldtype": "Float", "label": "Previous Quantity"},
    {"fieldname": "new_qty", "fieldtype": "Float", "label": "New Quantity"},
    {"fieldname": "movement_type", "fieldtype": "Select", "options": "In\nOut\nTransfer\nReturn"},
    {"fieldname": "reference_doc", "fieldtype": "Data", "label": "Reference Document"},
    {"fieldname": "user", "fieldtype": "Link", "options": "User"},
    {"fieldname": "ip_address", "fieldtype": "Data", "label": "IP Address"},
    {"fieldname": "action", "fieldtype": "Select", "options": "Create\nUpdate\nDelete"}
  ]
}
```

#### 2. Python Script: منع حذف سجلات المخزون

```python
# stock_audit.py
from frappe.permissions import has_permission

def validate_stock_entry_deletion(doc, method):
    """منع حذف Stock Entries"""
    if doc.doctype == "Stock Entry":
        # التحقق من الصلاحيات
        if not has_permission("Stock Entry", "delete", doc):
            frappe.throw("You don't have permission to delete Stock Entries")
        
        # التحقق من العمر (لا يمكن حذف بعد 30 يوم)
        from datetime import datetime, timedelta
        if doc.posting_date < (datetime.now() - timedelta(days=30)).date():
            frappe.throw("Cannot delete Stock Entries older than 30 days")

def create_audit_log(doc, method):
    """إنشاء سجل تدقيق لكل حركة مخزون"""
    if doc.doctype in ["Stock Entry", "Stock Ledger Entry"]:
        audit_log = frappe.new_doc("Stock Movement Audit")
        audit_log.movement_date = frappe.utils.today()
        audit_log.movement_time = frappe.utils.nowtime()
        audit_log.item_code = doc.item_code
        audit_log.warehouse = doc.warehouse
        audit_log.batch_no = doc.batch_no
        audit_log.quantity_change = doc.qty if doc.doctype == "Stock Entry" else doc.actual_qty
        audit_log.movement_type = doc.purpose if doc.doctype == "Stock Entry" else "Movement"
        audit_log.reference_doc = f"{doc.doctype}: {doc.name}"
        audit_log.user = frappe.session.user
        audit_log.ip_address = frappe.local.request_ip if frappe.local.request else None
        
        # حفظ بدون إرسال (للسجلات فقط)
        audit_log.save(ignore_permissions=True)
```

#### 3. Hooks Configuration

```python
# hooks.py
doc_events = {
    "Stock Entry": {
        "on_trash": "custom_app.stock_audit.validate_stock_entry_deletion",
        "after_insert": "custom_app.stock_audit.create_audit_log"
    },
    "Stock Ledger Entry": {
        "after_insert": "custom_app.stock_audit.create_audit_log"
    }
}
```

---

## Task 5: دورة عمل نقل المخزون (Transfer Workflow)

### الوصف
نظام "طلب وقبول": عند تحويل بضاعة من المستودع للمندوب، لا تدخل ذمة المندوب إلا بعد قبوله.

### الحل في Frappe/ERPNext

#### 1. إنشاء DocType جديد: Stock Transfer Request

```json
{
  "doctype": "DocType",
  "module": "Stock",
  "name": "Stock Transfer Request",
  "fields": [
    {"fieldname": "request_date", "fieldtype": "Date", "label": "Request Date", "default": "Today"},
    {"fieldname": "from_warehouse", "fieldtype": "Link", "options": "Warehouse", "label": "From Warehouse"},
    {"fieldname": "to_warehouse", "fieldtype": "Link", "options": "Warehouse", "label": "To Warehouse"},
    {"fieldname": "salesman", "fieldtype": "Link", "options": "Salesman"},
    {"fieldname": "status", "fieldtype": "Select", "options": "Pending\nAccepted\nRejected\nCompleted"},
    {"fieldname": "items", "fieldtype": "Table", "label": "Items"},
    {"fieldname": "total_quantity", "fieldtype": "Float", "label": "Total Quantity"},
    {"fieldname": "rejection_reason", "fieldtype": "Text", "label": "Rejection Reason"},
    {"fieldname": "stock_entry", "fieldtype": "Link", "options": "Stock Entry"},
    {"fieldname": "created_by", "fieldtype": "Link", "options": "User"},
    {"fieldname": "accepted_by", "fieldtype": "Link", "options": "User"},
    {"fieldname": "accepted_date", "fieldtype": "Date", "label": "Accepted Date"}
  ],
  "child_tables": [
    {
      "fieldname": "items",
      "doctype": "Stock Transfer Request Item"
    }
  ]
}
```

#### 2. إنشاء DocType: Stock Transfer Request Item

```json
{
  "doctype": "DocType",
  "module": "Stock",
  "name": "Stock Transfer Request Item",
  "fields": [
    {"fieldname": "item_code", "fieldtype": "Link", "options": "Item"},
    {"fieldname": "item_name", "fieldtype": "Data", "label": "Item Name"},
    {"fieldname": "batch_no", "fieldtype": "Link", "options": "Batch"},
    {"fieldname": "requested_qty", "fieldtype": "Float", "label": "Requested Quantity"},
    {"fieldname": "accepted_qty", "fieldtype": "Float", "label": "Accepted Quantity"},
    {"fieldname": "uom", "fieldtype": "Link", "options": "UOM"},
    {"fieldname": "stock_status", "fieldtype": "Link", "options": "Stock Status"}
  ]
}
```

#### 3. إنشاء Workflow

```python
# workflow.py
def create_stock_transfer_workflow():
    """إنشاء Workflow لنقل المخزون"""
    if not frappe.db.exists("Workflow", "Stock Transfer Request"):
        workflow = frappe.new_doc("Workflow")
        workflow.workflow_name = "Stock Transfer Request"
        workflow.document_type = "Stock Transfer Request"
        workflow.workflow_state_field = "status"
        workflow.send_email_alert = 1
        
        # States
        workflow.append("workflow_states", {
            "state": "Pending",
            "is_optional_state": 0
        })
        workflow.append("workflow_states", {
            "state": "Accepted",
            "is_optional_state": 0
        })
        workflow.append("workflow_states", {
            "state": "Rejected",
            "is_optional_state": 0
        })
        workflow.append("workflow_states", {
            "state": "Completed",
            "is_optional_state": 0
        })
        
        # Transitions
        workflow.append("workflow_transitions", {
            "state": "Pending",
            "action": "Accept",
            "next_state": "Accepted",
            "allowed": "Salesman"
        })
        workflow.append("workflow_transitions", {
            "state": "Pending",
            "action": "Reject",
            "next_state": "Rejected",
            "allowed": "Salesman"
        })
        workflow.append("workflow_transitions", {
            "state": "Accepted",
            "action": "Complete Transfer",
            "next_state": "Completed",
            "allowed": "Stock Manager"
        })
        
        workflow.insert()
```

#### 4. Python Script: معالجة القبول والرفض

```python
# stock_transfer.py
@frappe.whitelist()
def accept_transfer_request(request_name):
    """قبول طلب نقل المخزون"""
    request = frappe.get_doc("Stock Transfer Request", request_name)
    
    # التحقق من الحالة
    if request.status != "Pending":
        frappe.throw("This request is not pending")
    
    # تحديث الحالة
    request.status = "Accepted"
    request.accepted_by = frappe.session.user
    request.accepted_date = frappe.utils.today()
    
    # تحديث الكميات المقبولة
    for item in request.items:
        item.accepted_qty = item.requested_qty
    
    request.save()
    
    # إرسال إشعار للمدير
    frappe.sendmail(
        recipients=get_managers_email(),
        subject=f"Stock Transfer Request Accepted: {request.name}",
        message=f"Salesman {request.salesman} has accepted the stock transfer request."
    )
    
    return {"status": "Accepted", "request": request.name}

@frappe.whitelist()
def reject_transfer_request(request_name, rejection_reason):
    """رفض طلب نقل المخزون"""
    request = frappe.get_doc("Stock Transfer Request", request_name)
    
    # التحقق من الحالة
    if request.status != "Pending":
        frappe.throw("This request is not pending")
    
    # تحديث الحالة
    request.status = "Rejected"
    request.rejection_reason = rejection_reason
    
    # عودة الكميات للمستودع (لا يتم إنشاء Stock Entry)
    request.save()
    
    # إرسال إشعار للمدير
    frappe.sendmail(
        recipients=get_managers_email(),
        subject=f"Stock Transfer Request Rejected: {request.name}",
        message=f"Salesman {request.salesman} has rejected the stock transfer request.\n\nReason: {rejection_reason}"
    )
    
    return {"status": "Rejected", "request": request.name}

@frappe.whitelist()
def complete_transfer_request(request_name):
    """إتمام طلب نقل المخزون (بعد القبول)"""
    request = frappe.get_doc("Stock Transfer Request", request_name)
    
    # التحقق من الحالة
    if request.status != "Accepted":
        frappe.throw("This request must be accepted first")
    
    # إنشاء Stock Entry
    stock_entry = frappe.new_doc("Stock Entry")
    stock_entry.purpose = "Material Transfer"
    stock_entry.stock_transfer_request = request.name
    
    # إضافة الأصناف
    for item in request.items:
        stock_entry.append("items", {
            "item_code": item.item_code,
            "qty": item.accepted_qty,
            "uom": item.uom,
            "batch_no": item.batch_no,
            "s_warehouse": request.from_warehouse,
            "t_warehouse": request.to_warehouse
        })
    
    # حفظ وإرسال Stock Entry
    stock_entry.submit()
    
    # تحديث الطلب
    request.stock_entry = stock_entry.name
    request.status = "Completed"
    request.save()
    
    return {"status": "Completed", "stock_entry": stock_entry.name}
```

---

# 📦 Module 2: إدارة المنتجات (Product Master & UOMs)

## Task 6: دعم تعدد اللغات

### الوصف
إضافة حقول الاسم (عربي/إنجليزي) وعرضها في الفواتير والطباعة حسب الإعدادات.

### الحل في Frappe/ERPNext

#### 1. تعديل DocType: Item

**إضافة الحقول:**

| Field Name | Type | Options | Description |
|------------|------|---------|-------------|
| `item_name_ar` | Data | - | اسم الصنف بالعربية |
| `item_name_en` | Data | - | اسم الصنف بالإنجليزية |
| `description_ar` | Text | - | وصف الصنف بالعربية |
| `description_en` | Text | - | وصف الصنف بالإنجليزية |

#### 2. إنشاء DocType جديد: System Language Settings

```json
{
  "doctype": "DocType",
  "module": "System",
  "name": "System Language Settings",
  "fields": [
    {"fieldname": "default_language", "fieldtype": "Select", "options": "ar\nen", "label": "Default Language"},
    {"fieldname": "use_arabic_in_print", "fieldtype": "Check", "label": "Use Arabic in Print"},
    {"fieldname": "use_arabic_in_invoices", "fieldtype": "Check", "label": "Use Arabic in Invoices"},
    {"fieldname": "rtl_direction", "fieldtype": "Check", "label": "RTL Direction"}
  ]
}
```

#### 3. Client Script: تبديل اللغة

```javascript
// item_client_script.js
frappe.ui.form.on('Item', {
    refresh: function(frm) {
        // إضافة زر تبديل اللغة
        if(frappe.user.has_role('System Manager')) {
            frm.add_custom_button('Toggle Language', function() {
                toggle_item_language(frm);
            });
        }
    }
});

function toggle_item_language(frm) {
    var settings = frappe.get_doc('System Language Settings');
    var current_lang = settings.default_language;
    
    if(current_lang === 'ar') {
        // عرض بالإنجليزية
        frm.set_value('item_name', frm.doc.item_name_en);
        frm.set_value('description', frm.doc.description_en);
    } else {
        // عرض بالعربية
        frm.set_value('item_name', frm.doc.item_name_ar);
        frm.set_value('description', frm.doc.description_ar);
    }
}
```

#### 4. Python Script: الحصول على الاسم حسب اللغة

```python
# item_utils.py
@frappe.whitelist()
def get_item_name(item_code, language=None):
    """الحصول على اسم الصنف حسب اللغة"""
    if not language:
        settings = frappe.get_single("System Language Settings")
        language = settings.default_language or "en"
    
    item = frappe.get_doc("Item", item_code)
    
    if language == "ar":
        return item.item_name_ar or item.item_name
    else:
        return item.item_name_en or item.item_name

@frappe.whitelist()
def get_item_description(item_code, language=None):
    """الحصول على وصف الصنف حسب اللغة"""
    if not language:
        settings = frappe.get_single("System Language Settings")
        language = settings.default_language or "en"
    
    item = frappe.get_doc("Item", item_code)
    
    if language == "ar":
        return item.description_ar or item.description
    else:
        return item.description_en or item.description
```

#### 5. Print Format: دعم اللغات

```jinja
{# sales_invoice_print_format.html #}
{% set settings = frappe.get_doc('System Language Settings') %}
{% set use_arabic = settings.use_arabic_in_print %}

{% if use_arabic %}
    <div dir="rtl">
        <h1>فاتورة مبيعات</h1>
        {% for item in doc.items %}
            <p>{{ item.item_name_ar or item.item_name }}</p>
            <p>{{ item.description_ar or item.description }}</p>
        {% endfor %}
    </div>
{% else %}
    <div dir="ltr">
        <h1>Sales Invoice</h1>
        {% for item in doc.items %}
            <p>{{ item.item_name_en or item.item_name }}</p>
            <p>{{ item.description_en or item.description }}</p>
        {% endfor %}
    </div>
{% endif %}
```

---

## Task 7: نظام وحدات القياس الذكي (Smart UOMs)

### الوصف
بناء Logic للتحويل بين الوحدات مع حماية للتحويل عند حذف الوحدة الوسيطة.

### الحل في Frappe/ERPNext

#### 1. تعديل DocType: Item

**إضافة الحقول:**

| Field Name | Type | Options | Description |
|------------|------|---------|-------------|
| `base_uom` | Link | UOM | الوحدة الأساسية (أصغر وحدة) |
| `base_conversion_factor` | Float | - | معامل التحويل للوحدة الأساسية |
| `default_uom` | Link | UOM | الوحدة الافتراضية للعرض |
| `uom_conversion_data` | JSON | - | بيانات التحويل المحفوظة |

#### 2. إنشاء DocType جديد: UOM Conversion Matrix

```json
{
  "doctype": "DocType",
  "module": "Stock",
  "name": "UOM Conversion Matrix",
  "fields": [
    {"fieldname": "item_code", "fieldtype": "Link", "options": "Item"},
    {"fieldname": "from_uom", "fieldtype": "Link", "options": "UOM"},
    {"fieldname": "to_uom", "fieldtype": "Link", "options": "UOM"},
    {"fieldname": "conversion_factor", "fieldtype": "Float", "label": "Conversion Factor"},
    {"fieldname": "is_base_conversion", "fieldtype": "Check", "label": "Is Base Conversion"}
  ]
}
```

#### 3. Python Script: معامل التحويل المحمي

```python
# uom_conversion.py
@frappe.whitelist()
def save_uom_conversion(item_code, from_uom, to_uom, conversion_factor):
    """حفظ معامل التحويل مع الحماية"""
    item = frappe.get_doc("Item", item_code)
    
    # حفظ بيانات التحويل في JSON
    if not item.uom_conversion_data:
        item.uom_conversion_data = {}
    
    if isinstance(item.uom_conversion_data, str):
        import json
        item.uom_conversion_data = json.loads(item.uom_conversion_data)
    
    # حفظ التحويل
    key = f"{from_uom}_to_{to_uom}"
    item.uom_conversion_data[key] = {
        "conversion_factor": conversion_factor,
        "saved_at": frappe.utils.now(),
        "saved_by": frappe.session.user
    }
    
    # حفظ كـ JSON string
    item.uom_conversion_data = json.dumps(item.uom_conversion_data)
    item.save()
    
    return {"status": "Success"}

@frappe.whitelist()
def get_conversion_factor(item_code, from_uom, to_uom):
    """الحصول على معامل التحويل مع الحماية"""
    item = frappe.get_doc("Item", item_code)
    
    # 1. محاولة الحصول من UOM Conversion Matrix
    conversion = frappe.db.get_value("UOM Conversion Matrix", {
        "item_code": item_code,
        "from_uom": from_uom,
        "to_uom": to_uom
    }, "conversion_factor")
    
    if conversion:
        return conversion
    
    # 2. محاولة الحصول من البيانات المحفوظة
    if item.uom_conversion_data:
        import json
        if isinstance(item.uom_conversion_data, str):
            data = json.loads(item.uom_conversion_data)
        else:
            data = item.uom_conversion_data
        
        key = f"{from_uom}_to_{to_uom}"
        if key in data:
            return data[key]["conversion_factor"]
    
    # 3. حساب من الوحدة الأساسية
    if item.base_uom:
        # الحصول على معامل التحويل للوحدة الأساسية
        from_base = get_uom_to_base_factor(item_code, from_uom)
        to_base = get_uom_to_base_factor(item_code, to_uom)
        
        if from_base and to_base:
            return from_base / to_base
    
    # 4. استخدام معامل التحويل الافتراضي
    default_conversion = frappe.db.get_value("UOM Conversion Detail", {
        "parent": item_code,
        "uom": from_uom
    }, "conversion_factor")
    
    if default_conversion:
        return default_conversion
    
    frappe.throw(f"No conversion factor found for {from_uom} to {to_uom}")

def get_uom_to_base_factor(item_code, uom):
    """الحصول على معامل التحويل من الوحدة للوحدة الأساسية"""
    item = frappe.get_doc("Item", item_code)
    
    if uom == item.base_uom:
        return 1.0
    
    # البحث في البيانات المحفوظة
    if item.uom_conversion_data:
        import json
        if isinstance(item.uom_conversion_data, str):
            data = json.loads(item.uom_conversion_data)
        else:
            data = item.uom_conversion_data
        
        key = f"{uom}_to_{item.base_uom}"
        if key in data:
            return data[key]["conversion_factor"]
    
    return None

@frappe.whitelist()
def convert_quantity(item_code, quantity, from_uom, to_uom):
    """تحويل الكمية بين وحدتين"""
    conversion_factor = get_conversion_factor(item_code, from_uom, to_uom)
    return quantity * conversion_factor
```

#### 4. Client Script: التحويل التلقائي

```javascript
// item_client_script.js
frappe.ui.form.on('Item', {
    refresh: function(frm) {
        // إضافة زر اختبار التحويل
        frm.add_custom_button('Test UOM Conversion', function() {
            test_uom_conversion(frm);
        });
    },
    
    base_uom: function(frm) {
        // عند تغيير الوحدة الأساسية
        update_uom_display(frm);
    }
});

function test_uom_conversion(frm) {
    var dialog = new frappe.ui.Dialog({
        title: 'Test UOM Conversion',
        fields: [
            {fieldname: 'quantity', fieldtype: 'Float', label: 'Quantity'},
            {fieldname: 'from_uom', fieldtype: 'Link', options: 'UOM', label: 'From UOM'},
            {fieldname: 'to_uom', fieldtype: 'Link', options: 'UOM', label: 'To UOM'}
        ],
        primary_action: function() {
            var data = dialog.get_values();
            
            frappe.call({
                method: 'custom_app.uom_conversion.convert_quantity',
                args: {
                    item_code: frm.doc.name,
                    quantity: data.quantity,
                    from_uom: data.from_uom,
                    to_uom: data.to_uom
                },
                callback: function(r) {
                    frappe.msgprint(`Converted Quantity: ${r.message}`);
                }
            });
            
            dialog.hide();
        }
    });
    
    dialog.show();
}

function update_uom_display(frm) {
    // تحديث عرض الوحدات
    if(frm.doc.default_uom && frm.doc.base_uom) {
        frappe.call({
            method: 'custom_app.uom_conversion.get_conversion_factor',
            args: {
                item_code: frm.doc.name,
                from_uom: frm.doc.default_uom,
                to_uom: frm.doc.base_uom
            },
            callback: function(r) {
                if(r.message) {
                    frm.dashboard.set_indicator(`1 ${frm.doc.default_uom} = ${r.message} ${frm.doc.base_uom}`, 'blue');
                }
            }
        });
    }
}
```

---

# 💰 Module 3: المبيعات والمالية (Sales & Finance)

## Task 8: نظام الصلاحيات والخصومات

### الوصف
إعداد Permissions للمناديب لتطبيق الخصومات على مستوى المنتج أو الفاتورة.

### الحل في Frappe/ERPNext

#### 1. إنشاء DocType جديد: Salesman Discount Rules

```json
{
  "doctype": "DocType",
  "module": "Selling",
  "name": "Salesman Discount Rules",
  "fields": [
    {"fieldname": "salesman", "fieldtype": "Link", "options": "Salesman"},
    {"fieldname": "max_discount_percentage", "fieldtype": "Percent", "label": "Max Discount %"},
    {"fieldname": "max_discount_amount", "fieldtype": "Currency", "label": "Max Discount Amount"},
    {"fieldname": "allow_item_level_discount", "fieldtype": "Check", "label": "Allow Item Level Discount"},
    {"fieldname": "allow_invoice_level_discount", "fieldtype": "Check", "label": "Allow Invoice Level Discount"},
    {"fieldname": "require_manager_approval", "fieldtype": "Check", "label": "Require Manager Approval"},
    {"fieldname": "effective_from", "fieldtype": "Date", "label": "Effective From"},
    {"fieldname": "effective_to", "fieldtype": "Date", "label": "Effective To"},
    {"fieldname": "is_active", "fieldtype": "Check", "label": "Is Active", "default": 1}
  ]
}
```

#### 2. تعديل DocType: Sales Invoice

**إضافة الحقول:**

| Field Name | Type | Options | Description |
|------------|------|---------|-------------|
| `discount_approval_status` | Select | Pending, Approved, Rejected | حالة موافقة الخصم |
| `discount_approved_by` | Link | User | من وافق على الخصم |
| `discount_approval_date` | Date | - | تاريخ الموافقة على الخصم |
| `discount_rejection_reason` | Text | - | سبب رفض الخصم |

#### 3. Python Script: التحقق من الخصومات

```python
# discount_validation.py
@frappe.whitelist()
def validate_salesman_discount(invoice_data):
    """التحقق من خصومات المندوب"""
    import json
    
    data = json.loads(invoice_data)
    salesman = data.get("salesman")
    
    # الحصول على قواعد الخصم
    discount_rules = frappe.db.get_value("Salesman Discount Rules", {
        "salesman": salesman,
        "is_active": 1,
        "effective_from": ["<=", frappe.utils.today()],
        "effective_to": [">=", frappe.utils.today()]
    }, ["max_discount_percentage", "max_discount_amount", "allow_item_level_discount", "allow_invoice_level_discount"])
    
    if not discount_rules:
        frappe.throw("No active discount rules found for this salesman")
    
    # التحقق من الخصم على مستوى الفاتورة
    invoice_discount = data.get("discount_amount", 0)
    if invoice_discount > 0:
        if not discount_rules.allow_invoice_level_discount:
            frappe.throw("This salesman is not allowed to apply invoice-level discounts")
        
        if discount_rules.max_discount_amount and invoice_discount > discount_rules.max_discount_amount:
            if discount_rules.require_manager_approval:
                return {
                    "status": "Approval Required",
                    "reason": f"Invoice discount {invoice_discount} exceeds maximum allowed {discount_rules.max_discount_amount}"
                }
            else:
                frappe.throw(f"Invoice discount {invoice_discount} exceeds maximum allowed {discount_rules.max_discount_amount}")
    
    # التحقق من الخصم على مستوى الصنف
    for item in data.get("items", []):
        item_discount = item.get("discount_percentage", 0)
        if item_discount > 0:
            if not discount_rules.allow_item_level_discount:
                frappe.throw("This salesman is not allowed to apply item-level discounts")
            
            if discount_rules.max_discount_percentage and item_discount > discount_rules.max_discount_percentage:
                if discount_rules.require_manager_approval:
                    return {
                        "status": "Approval Required",
                        "reason": f"Item discount {item_discount}% exceeds maximum allowed {discount_rules.max_discount_percentage}%"
                    }
                else:
                    frappe.throw(f"Item discount {item_discount}% exceeds maximum allowed {discount_rules.max_discount_percentage}%")
    
    return {"status": "Valid"}

@frappe.whitelist()
def approve_discount(invoice_name, approval_notes=""):
    """موافقة على الخصم"""
    invoice = frappe.get_doc("Sales Invoice", invoice_name)
    
    # التحقق من الصلاحيات
    if not frappe.has_permission("Sales Invoice", "write", invoice):
        frappe.throw("You don't have permission to approve discounts")
    
    # تحديث الحالة
    invoice.discount_approval_status = "Approved"
    invoice.discount_approved_by = frappe.session.user
    invoice.discount_approval_date = frappe.utils.today()
    
    invoice.save()
    
    # إرسال إشعار للمندوب
    frappe.sendmail(
        recipients=[invoice.salesman_email],
        subject=f"Discount Approved for Invoice {invoice.name}",
        message=f"Your discount request has been approved.\n\nNotes: {approval_notes}"
    )
    
    return {"status": "Approved"}

@frappe.whitelist()
def reject_discount(invoice_name, rejection_reason):
    """رفض الخصم"""
    invoice = frappe.get_doc("Sales Invoice", invoice_name)
    
    # التحقق من الصلاحيات
    if not frappe.has_permission("Sales Invoice", "write", invoice):
        frappe.throw("You don't have permission to reject discounts")
    
    # تحديث الحالة
    invoice.discount_approval_status = "Rejected"
    invoice.discount_rejection_reason = rejection_reason
    
    # إزالة الخصم
    invoice.discount_amount = 0
    invoice.additional_discount_percentage = 0
    
    invoice.save()
    
    # إرسال إشعار للمندوب
    frappe.sendmail(
        recipients=[invoice.salesman_email],
        subject=f"Discount Rejected for Invoice {invoice.name}",
        message=f"Your discount request has been rejected.\n\nReason: {rejection_reason}"
    )
    
    return {"status": "Rejected"}
```

#### 4. Client Script: التحقق في الواجهة

```javascript
// sales_invoice_client_script.js
frappe.ui.form.on('Sales Invoice', {
    validate: function(frm) {
        // التحقق من الخصم قبل الحفظ
        if(frm.doc.salesman && (frm.doc.discount_amount > 0 || has_item_discount(frm))) {
            validate_discount(frm);
        }
    },
    
    discount_amount: function(frm) {
        // عند تغيير الخصم
        check_discount_limit(frm);
    }
});

function has_item_discount(frm) {
    // التحقق من وجود خصم على الأصناف
    var has_discount = false;
    frm.doc.items.forEach(function(item) {
        if(item.discount_percentage > 0 || item.discount_amount > 0) {
            has_discount = true;
        }
    });
    return has_discount;
}

function validate_discount(frm) {
    frappe.call({
        method: 'custom_app.discount_validation.validate_salesman_discount',
        args: {
            invoice_data: JSON.stringify({
                salesman: frm.doc.salesman,
                discount_amount: frm.doc.discount_amount,
                items: frm.doc.items
            })
        },
        callback: function(r) {
            if(r.message.status === "Approval Required") {
                // عرض طلب الموافقة
                show_discount_approval_dialog(frm, r.message.reason);
            }
        }
    });
}

function check_discount_limit(frm) {
    frappe.call({
        method: 'custom_app.discount_validation.validate_salesman_discount',
        args: {
            invoice_data: JSON.stringify({
                salesman: frm.doc.salesman,
                discount_amount: frm.doc.discount_amount,
                items: frm.doc.items
            })
        },
        callback: function(r) {
            if(r.message.status !== "Valid") {
                frappe.msgprint({
                    title: 'Discount Warning',
                    message: r.message.reason,
                    indicator: 'orange'
                });
            }
        }
    });
}

function show_discount_approval_dialog(frm, reason) {
    var dialog = new frappe.ui.Dialog({
        title: 'Discount Approval Required',
        fields: [
            {fieldname: 'reason', fieldtype: 'Text', label: 'Reason', default: reason, read_only: 1},
            {fieldname: 'approval_notes', fieldtype: 'Text', label: 'Approval Notes'}
        ],
        primary_action_label: 'Request Approval',
        primary_action: function() {
            var notes = dialog.get_value('approval_notes');
            
            // حفظ الفاتورة بحالة "Pending Approval"
            frm.doc.discount_approval_status = "Pending";
            frm.save();
            
            // إرسال طلب الموافقة
            frappe.call({
                method: 'frappe.desk.doctype.notification.notification.create_notification',
                args: {
                    for_user: get_manager_email(),
                    notification_type: 'Alert',
                    document_type: 'Sales Invoice',
                    document_name: frm.doc.name,
                    subject: 'Discount Approval Required',
                    message: `Discount approval required for invoice ${frm.doc.name}.\n\nReason: ${reason}\n\nNotes: ${notes}`
                }
            });
            
            dialog.hide();
            frappe.msgprint('Discount approval request sent to manager');
        }
    });
    
    dialog.show();
}
```

---

## Task 9: الإدارة المالية للمندوب

### الوصف
دعم طرق الدفع المتعددة ودورة عمل "طلب مصروفات".

### الحل في Frappe/ERPNext

#### 1. تعديل DocType: Sales Invoice

**إضافة الحقول:**

| Field Name | Type | Options | Description |
|------------|------|---------|-------------|
| `payment_method` | Select | Cash, Credit, Network | طريقة الدفع |
| `credit_period` | Int | - | فترة السداد (بالأيام) |
| `credit_due_date` | Date | - | تاريخ استحقاق السداد |
| `is_collected` | Check | - | هل تم التحصيل |
| `collection_date` | Date | - | تاريخ التحصيل |

#### 2. إنشاء DocType جديد: Salesman Expense Request

```json
{
  "doctype": "DocType",
  "module": "HR",
  "name": "Salesman Expense Request",
  "fields": [
    {"fieldname": "request_date", "fieldtype": "Date", "label": "Request Date", "default": "Today"},
    {"fieldname": "salesman", "fieldtype": "Link", "options": "Salesman"},
    {"fieldname": "employee", "fieldtype": "Link", "options": "Employee"},
    {"fieldname": "expense_type", "fieldtype": "Select", "options": "Travel\nFood\nAccommodation\nFuel\nOther"},
    {"fieldname": "status", "fieldtype": "Select", "options": "Draft\nPending Approval\nApproved\nRejected\nPaid"},
    {"fieldname": "total_amount", "fieldtype": "Currency", "label": "Total Amount"},
    {"fieldname": "approved_amount", "fieldtype": "Currency", "label": "Approved Amount"},
    {"fieldname": "expenses", "fieldtype": "Table", "label": "Expenses"},
    {"fieldname": "approval_notes", "fieldtype": "Text", "label": "Approval Notes"},
    {"fieldname": "rejection_reason", "fieldtype": "Text", "label": "Rejection Reason"},
    {"fieldname": "expense_claim", "fieldtype": "Link", "options": "Expense Claim"},
    {"fieldname": "payment_entry", "fieldtype": "Link", "options": "Payment Entry"}
  ],
  "child_tables": [
    {
      "fieldname": "expenses",
      "doctype": "Salesman Expense Item"
    }
  ]
}
```

#### 3. إنشاء DocType: Salesman Expense Item

```json
{
  "doctype": "DocType",
  "module": "HR",
  "name": "Salesman Expense Item",
  "fields": [
    {"fieldname": "expense_date", "fieldtype": "Date", "label": "Expense Date"},
    {"fieldname": "expense_type", "fieldtype": "Select", "options": "Travel\nFood\nAccommodation\nFuel\nOther"},
    {"fieldname": "description", "fieldtype": "Data", "label": "Description"},
    {"fieldname": "amount", "fieldtype": "Currency", "label": "Amount"},
    {"fieldname": "receipt_no", "fieldtype": "Data", "label": "Receipt No"},
    {"fieldname": "attachment", "fieldtype": "Attach", "label": "Attachment"}
  ]
}
```

#### 4. Python Script: معالجة المصروفات

```python
# expense_management.py
@frappe.whitelist()
def submit_expense_request(request_data):
    """إرسال طلب مصروفات"""
    import json
    
    data = json.loads(request_data)
    
    # إنشاء طلب المصروفات
    expense_request = frappe.new_doc("Salesman Expense Request")
    expense_request.request_date = frappe.utils.today()
    expense_request.salesman = data.get("salesman")
    expense_request.employee = data.get("employee")
    expense_request.status = "Pending Approval"
    
    # إضافة المصروفات
    total_amount = 0
    for expense in data.get("expenses"):
        expense_request.append("expenses", {
            "expense_date": expense.get("expense_date"),
            "expense_type": expense.get("expense_type"),
            "description": expense.get("description"),
            "amount": expense.get("amount"),
            "receipt_no": expense.get("receipt_no"),
            "attachment": expense.get("attachment")
        })
        total_amount += expense.get("amount")
    
    expense_request.total_amount = total_amount
    
    # حفظ وإرسال
    expense_request.submit()
    
    # إرسال إشعار للمدير
    manager_email = get_manager_email()
    frappe.sendmail(
        recipients=[manager_email],
        subject=f"Expense Request: {expense_request.name}",
        message=f"Salesman {data.get('salesman')} has submitted an expense request of {total_amount}."
    )
    
    return {"status": "Submitted", "request": expense_request.name}

@frappe.whitelist()
def approve_expense_request(request_name, approved_amount, approval_notes=""):
    """موافقة على طلب المصروفات"""
    request = frappe.get_doc("Salesman Expense Request", request_name)
    
    # التحقق من الحالة
    if request.status != "Pending Approval":
        frappe.throw("This request is not pending approval")
    
    # تحديث الحالة
    request.status = "Approved"
    request.approved_amount = approved_amount
    request.approval_notes = approval_notes
    
    request.save()
    
    # إنشاء Expense Claim
    expense_claim = frappe.new_doc("Expense Claim")
    expense_claim.employee = request.employee
    expense_claim.expense_approver = frappe.session.user
    expense_claim.approval_status = "Approved"
    expense_claim.total_sanctioned_amount = approved_amount
    
    # إضافة المصروفات
    for expense in request.expenses:
        expense_claim.append("expenses", {
            "expense_date": expense.expense_date,
            "expense_type": expense.expense_type,
            "description": expense.description,
            "sanctioned_amount": expense.amount,
            "amount": expense.amount
        })
    
    # حفظ وإرسال Expense Claim
    expense_claim.submit()
    
    # ربط Expense Claim بالطلب
    request.expense_claim = expense_claim.name
    request.save()
    
    # إرسال إشعار للمندوب
    frappe.sendmail(
        recipients=[get_salesman_email(request.salesman)],
        subject=f"Expense Request Approved: {request.name}",
        message=f"Your expense request has been approved.\n\nApproved Amount: {approved_amount}"
    )
    
    return {"status": "Approved", "expense_claim": expense_claim.name}

@frappe.whitelist()
def reject_expense_request(request_name, rejection_reason):
    """رفض طلب المصروفات"""
    request = frappe.get_doc("Salesman Expense Request", request_name)
    
    # التحقق من الحالة
    if request.status != "Pending Approval":
        frappe.throw("This request is not pending approval")
    
    # تحديث الحالة
    request.status = "Rejected"
    request.rejection_reason = rejection_reason
    
    request.save()
    
    # إرسال إشعار للمندوب
    frappe.sendmail(
        recipients=[get_salesman_email(request.salesman)],
        subject=f"Expense Request Rejected: {request.name}",
        message=f"Your expense request has been rejected.\n\nReason: {rejection_reason}"
    )
    
    return {"status": "Rejected"}

@frappe.whitelist()
def pay_expense_claim(claim_name, payment_method, payment_date):
    """دفع Expense Claim"""
    claim = frappe.get_doc("Expense Claim", claim_name)
    
    # التحقق من الحالة
    if claim.approval_status != "Approved":
        frappe.throw("This expense claim is not approved")
    
    # إنشاء Payment Entry
    payment = frappe.new_doc("Payment Entry")
    payment.payment_type = "Pay"
    payment.party_type = "Employee"
    payment.party = claim.employee
    payment.paid_from = get_payment_account(payment_method)
    payment.paid_amount = claim.total_sanctioned_amount
    payment.reference_no = claim.name
    payment.reference_date = payment_date
    
    # حفظ وإرسال Payment Entry
    payment.submit()
    
    # تحديث حالة الطلب
    expense_request = frappe.db.get_value("Salesman Expense Request", {"expense_claim": claim_name})
    if expense_request:
        request = frappe.get_doc("Salesman Expense Request", expense_request)
        request.status = "Paid"
        request.payment_entry = payment.name
        request.save()
    
    return {"status": "Paid", "payment": payment.name}
```

---

## Task 10: تخطيط المسارات (Routes & Territories)

### الوصف
إنشاء نظام لربط العملاء بمناطق جغرافية ومسارات سير للمناديب.

### الحل في Frappe/ERPNext

#### 1. تعديل DocType: Territory

**إضافة الحقول:**

| Field Name | Type | Options | Description |
|------------|------|---------|-------------|
| `gps_coordinates` | Geolocation | - | إحداثيات المنطقة |
| `polygon_coordinates` | JSON | - | إحداثيات المضلع |
| `salesman` | Link | Salesman | المندوب المسؤول |
| `is_active_route` | Check | - | هل هي مسار نشط |
| `route_order` | Int | - | ترتيب المسار |

#### 2. إنشاء DocType جديد: Sales Route

```json
{
  "doctype": "DocType",
  "module": "Selling",
  "name": "Sales Route",
  "fields": [
    {"fieldname": "route_name", "fieldtype": "Data", "label": "Route Name"},
    {"fieldname": "territory", "fieldtype": "Link", "options": "Territory"},
    {"fieldname": "salesman", "fieldtype": "Link", "options": "Salesman"},
    {"fieldname": "start_date", "fieldtype": "Date", "label": "Start Date"},
    {"fieldname": "end_date", "fieldtype": "Date", "label": "End Date"},
    {"fieldname": "status", "fieldtype": "Select", "options": "Active\nInactive\nCompleted"},
    {"fieldname": "route_customers", "fieldtype": "Table", "label": "Route Customers"},
    {"fieldname": "total_customers", "fieldtype": "Int", "label": "Total Customers"},
    {"fieldname": "estimated_duration", "fieldtype": "Time", "label": "Estimated Duration"},
    {"fieldname": "route_map", "fieldtype": "Attach", "label": "Route Map"}
  ],
  "child_tables": [
    {
      "fieldname": "route_customers",
      "doctype": "Route Customer"
    }
  ]
}
```

#### 3. إنشاء DocType: Route Customer

```json
{
  "doctype": "DocType",
  "module": "Selling",
  "name": "Route Customer",
  "fields": [
    {"fieldname": "customer", "fieldtype": "Link", "options": "Customer"},
    {"fieldname": "customer_name", "fieldtype": "Data", "label": "Customer Name"},
    {"fieldname": "visit_order", "fieldtype": "Int", "label": "Visit Order"},
    {"fieldname": "visit_frequency", "fieldtype": "Select", "options": "Daily\nWeekly\nMonthly"},
    {"fieldname": "preferred_time", "fieldtype": "Time", "label": "Preferred Time"},
    {"fieldname": "gps_coordinates", "fieldtype": "Geolocation", "label": "GPS Coordinates"},
    {"fieldname": "estimated_visit_duration", "fieldtype": "Int", "label": "Estimated Visit Duration (Minutes)"}
  ]
}
```

#### 4. Python Script: تكامل Google Maps

```python
# route_management.py
import requests
import json

GOOGLE_MAPS_API_KEY = "YOUR_API_KEY"

@frappe.whitelist()
def get_route_coordinates(route_name):
    """الحصول على إحداثيات المسار من Google Maps"""
    route = frappe.get_doc("Sales Route", route_name)
    
    # جمع إحداثيات العملاء
    coordinates = []
    for customer in route.route_customers:
        cust = frappe.get_doc("Customer", customer.customer)
        if cust.gps_coordinates:
            coordinates.append({
                "customer": customer.customer,
                "order": customer.visit_order,
                "coordinates": cust.gps_coordinates
            })
    
    # ترتيب حسب Visit Order
    coordinates.sort(key=lambda x: x["order"])
    
    return coordinates

@frappe.whitelist()
def optimize_route(route_name):
    """تحسين المسار باستخدام Google Maps Directions API"""
    route = frappe.get_doc("Sales Route", route_name)
    
    # جمع نقاط البداية والنهاية
    waypoints = []
    for customer in route.route_customers:
        cust = frappe.get_doc("Customer", customer.customer)
        if cust.gps_coordinates:
            waypoints.append(cust.gps_coordinates)
    
    if len(waypoints) < 2:
        frappe.throw("Need at least 2 customers to optimize route")
    
    # استدعاء Google Maps Directions API
    origin = waypoints[0]
    destination = waypoints[-1]
    waypoints_str = "|".join(waypoints[1:-1])
    
    url = f"https://maps.googleapis.com/maps/api/directions/json?origin={origin}&destination={destination}&waypoints=optimize:true|{waypoints_str}&key={GOOGLE_MAPS_API_KEY}"
    
    response = requests.get(url)
    data = response.json()
    
    if data["status"] != "OK":
        frappe.throw(f"Error optimizing route: {data['status']}")
    
    # استخراج المسار المحسن
    optimized_route = data["routes"][0]
    total_distance = optimized_route["legs"][0]["distance"]["value"]  # in meters
    total_duration = optimized_route["legs"][0]["duration"]["value"]  # in seconds
    
    # تحديث المسار
    route.estimated_duration = frappe.utils.timedelta(seconds=total_duration)
    
    # حفظ المسار المحسن
    route.save()
    
    return {
        "total_distance": total_distance,
        "total_duration": total_duration,
        "optimized_waypoints": data["routes"][0]["waypoint_order"]
    }

@frappe.whitelist()
def get_customer_distance(customer1, customer2):
    """حساب المسافة بين عميلين"""
    cust1 = frappe.get_doc("Customer", customer1)
    cust2 = frappe.get_doc("Customer", customer2)
    
    if not cust1.gps_coordinates or not cust2.gps_coordinates:
        frappe.throw("Both customers must have GPS coordinates")
    
    # استدعاء Google Maps Distance Matrix API
    url = f"https://maps.googleapis.com/maps/api/distancematrix/json?origins={cust1.gps_coordinates}&destinations={cust2.gps_coordinates}&key={GOOGLE_MAPS_API_KEY}"
    
    response = requests.get(url)
    data = response.json()
    
    if data["status"] != "OK":
        frappe.throw(f"Error calculating distance: {data['status']}")
    
    distance = data["rows"][0]["elements"][0]["distance"]["value"]  # in meters
    duration = data["rows"][0]["elements"][0]["duration"]["value"]  # in seconds
    
    return {
        "distance": distance,
        "duration": duration
    }

@frappe.whitelist()
def assign_customers_to_route(route_name, customer_list):
    """تعيين العملاء للمسار"""
    import json
    
    route = frappe.get_doc("Sales Route", route_name)
    
    # مسح العملاء الحاليين
    route.route_customers = []
    
    # إضافة العملاء الجدد
    for i, customer_data in enumerate(json.loads(customer_list)):
        customer = frappe.get_doc("Customer", customer_data["customer"])
        route.append("route_customers", {
            "customer": customer.name,
            "customer_name": customer.customer_name,
            "visit_order": i + 1,
            "visit_frequency": customer_data.get("visit_frequency", "Weekly"),
            "preferred_time": customer_data.get("preferred_time"),
            "gps_coordinates": customer.gps_coordinates,
            "estimated_visit_duration": customer_data.get("estimated_visit_duration", 30)
        })
    
    route.total_customers = len(route.route_customers)
    route.save()
    
    return {"status": "Success", "total_customers": route.total_customers}
```

#### 5. Client Script: عرض المسار على الخريطة

```javascript
// sales_route_client_script.js
frappe.ui.form.on('Sales Route', {
    refresh: function(frm) {
        // إضافة زر عرض المسار
        frm.add_custom_button('Show Route on Map', function() {
            show_route_on_map(frm);
        });
        
        // إضافة زر تحسين المسار
        frm.add_custom_button('Optimize Route', function() {
            optimize_route(frm);
        });
    }
});

function show_route_on_map(frm) {
    frappe.call({
        method: 'custom_app.route_management.get_route_coordinates',
        args: {
            route_name: frm.doc.name
        },
        callback: function(r) {
            if(r.message) {
                var coordinates = r.message;
                var map_url = "https://www.google.com/maps/dir/";
                
                coordinates.forEach(function(coord, index) {
                    if(index < coordinates.length - 1) {
                        map_url += coord.coordinates + "/";
                    } else {
                        map_url += coord.coordinates;
                    }
                });
                
                window.open(map_url, '_blank');
            }
        }
    });
}

function optimize_route(frm) {
    frappe.msgprint("Optimizing route...");
    
    frappe.call({
        method: 'custom_app.route_management.optimize_route',
        args: {
            route_name: frm.doc.name
        },
        callback: function(r) {
            if(r.message) {
                var distance_km = (r.message.total_distance / 1000).toFixed(2);
                var duration_min = (r.message.total_duration / 60).toFixed(0);
                
                frappe.msgprint({
                    title: 'Route Optimized',
                    message: `Total Distance: ${distance_km} km<br>Total Duration: ${duration_min} minutes`,
                    indicator: 'green'
                });
                
                frm.reload_doc();
            }
        }
    });
}
```

---

# 📍 Module 4: التتبع والموقع (GPS & Tracking)

## Task 11: مؤقت الزيارات (Visit Duration)

### الوصف
تسجيل وقت الدخول والخروج عند العميل أوتوماتيكياً.

### الحل في Frappe/ERPNext

#### 1. إنشاء DocType جديد: Customer Visit

```json
{
  "doctype": "DocType",
  "module": "Selling",
  "name": "Customer Visit",
  "fields": [
    {"fieldname": "visit_date", "fieldtype": "Date", "label": "Visit Date", "default": "Today"},
    {"fieldname": "salesman", "fieldtype": "Link", "options": "Salesman"},
    {"fieldname": "customer", "fieldtype": "Link", "options": "Customer"},
    {"fieldname": "check_in_time", "fieldtype": "Datetime", "label": "Check-in Time"},
    {"fieldname": "check_out_time", "fieldtype": "Datetime", "label": "Check-out Time"},
    {"fieldname": "visit_duration", "fieldtype": "Time", "label": "Visit Duration"},
    {"fieldname": "check_in_location", "fieldtype": "Geolocation", "label": "Check-in Location"},
    {"fieldname": "check_out_location", "fieldtype": "Geolocation", "label": "Check-out Location"},
    {"fieldname": "distance_from_customer", "fieldtype": "Float", "label": "Distance from Customer (meters)"},
    {"fieldname": "visit_purpose", "fieldtype": "Select", "options": "Sales\nCollection\nDelivery\nFollow-up\nOther"},
    {"fieldname": "visit_notes", "fieldtype": "Text", "label": "Visit Notes"},
    {"fieldname": "visit_status", "fieldtype": "Select", "options": "Checked-in\nCompleted\nCancelled"},
    {"fieldname": "sales_invoice", "fieldtype": "Link", "options": "Sales Invoice"},
    {"fieldname": "payment_collected", "fieldtype": "Currency", "label": "Payment Collected"}
  ]
}
```

#### 2. Python Script: تسجيل الزيارات

```python
# visit_tracking.py
from datetime import datetime, timedelta

@frappe.whitelist()
def check_in_customer(salesman, customer, location_data):
    """تسجيل دخول المندوب عند العميل"""
    import json
    
    location = json.loads(location_data)
    
    # التحقق من عدم وجود زيارة نشطة
    active_visit = frappe.db.get_value("Customer Visit", {
        "salesman": salesman,
        "visit_status": "Checked-in"
    })
    
    if active_visit:
        frappe.throw("You have an active visit. Please check out first.")
    
    # الحصول على موقع العميل
    customer_doc = frappe.get_doc("Customer", customer)
    if not customer_doc.gps_coordinates:
        frappe.throw("Customer location not set")
    
    # حساب المسافة من موقع العميل
    distance = calculate_distance(
        location["latitude"],
        location["longitude"],
        customer_doc.gps_coordinates.split(",")[0],
        customer_doc.gps_coordinates.split(",")[1]
    )
    
    # إنشاء سجل الزيارة
    visit = frappe.new_doc("Customer Visit")
    visit.visit_date = frappe.utils.today()
    visit.salesman = salesman
    visit.customer = customer
    visit.check_in_time = frappe.utils.now()
    visit.check_in_location = f"{location['latitude']},{location['longitude']}"
    visit.distance_from_customer = distance
    visit.visit_status = "Checked-in"
    
    visit.save()
    
    return {
        "status": "Checked-in",
        "visit": visit.name,
        "distance": distance
    }

@frappe.whitelist()
def check_out_customer(visit_name, location_data, visit_notes="", payment_collected=0, sales_invoice=""):
    """تسجيل خروج المندوب من العميل"""
    import json
    
    location = json.loads(location_data)
    
    # الحصول على سجل الزيارة
    visit = frappe.get_doc("Customer Visit", visit_name)
    
    if visit.visit_status != "Checked-in":
        frappe.throw("This visit is not active")
    
    # تحديث وقت الخروج
    visit.check_out_time = frappe.utils.now()
    visit.check_out_location = f"{location['latitude']},{location['longitude']}"
    visit.visit_notes = visit_notes
    visit.payment_collected = payment_collected
    visit.sales_invoice = sales_invoice
    visit.visit_status = "Completed"
    
    # حساب مدة الزيارة
    check_in = datetime.strptime(visit.check_in_time, "%Y-%m-%d %H:%M:%S.%f")
    check_out = datetime.strptime(visit.check_out_time, "%Y-%m-%d %H:%M:%S.%f")
    duration = check_out - check_in
    visit.visit_duration = str(duration)
    
    visit.save()
    
    return {
        "status": "Checked-out",
        "visit": visit.name,
        "duration": str(duration)
    }

@frappe.whitelist()
def get_active_visit(salesman):
    """الحصول على الزيارة النشطة للمندوب"""
    visit = frappe.db.get_value("Customer Visit", {
        "salesman": salesman,
        "visit_status": "Checked-in"
    }, ["name", "customer", "check_in_time", "check_in_location"])
    
    if visit:
        return visit
    
    return None

def calculate_distance(lat1, lon1, lat2, lon2):
    """حساب المسافة بين نقطتين (Haversine formula)"""
    from math import radians, cos, sin, asin, sqrt
    
    # تحويل الإحداثيات إلى راديان
    lat1, lon1, lat2, lon2 = map(radians, [float(lat1), float(lon1), float(lat2), float(lon2)])
    
    # حساب الفرق
    dlat = lat2 - lat1
    dlon = lon2 - lon1
    
    # Haversine formula
    a = sin(dlat/2)**2 + cos(lat1) * cos(lat2) * sin(dlon/2)**2
    c = 2 * asin(sqrt(a))
    
    # نصف قطر الأرض بالكيلومتر
    r = 6371
    
    # المسافة بالمتر
    distance = c * r * 1000
    
    return distance
```

#### 3. Client Script: تسجيل تلقائي

```javascript
// visit_client_script.js
var activeVisit = null;

frappe.ui.form.on('Customer', {
    refresh: function(frm) {
        // إضافة زر Check-in
        if(!activeVisit) {
            frm.add_custom_button('Check-in', function() {
                check_in(frm);
            }, 'Visit');
        } else {
            // إضافة زر Check-out
            frm.add_custom_button('Check-out', function() {
                check_out(frm);
            }, 'Visit');
        }
    }
});

function check_in(frm) {
    // الحصول على الموقع الحالي
    if(navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(function(position) {
            var location = {
                latitude: position.coords.latitude,
                longitude: position.coords.longitude
            };
            
            frappe.call({
                method: 'custom_app.visit_tracking.check_in_customer',
                args: {
                    salesman: frappe.session.user,
                    customer: frm.doc.name,
                    location_data: JSON.stringify(location)
                },
                callback: function(r) {
                    if(r.message.status === "Checked-in") {
                        activeVisit = r.message.visit;
                        frappe.msgprint({
                            title: 'Checked-in',
                            message: `Successfully checked in. Distance from customer: ${r.message.distance.toFixed(0)} meters`,
                            indicator: 'green'
                        });
                        frm.reload_doc();
                    }
                }
            });
        }, function(error) {
            frappe.msgprint('Error getting location: ' + error.message);
        });
    } else {
        frappe.msgprint('Geolocation is not supported by this browser');
    }
}

function check_out(frm) {
    // الحصول على الموقع الحالي
    if(navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(function(position) {
            var location = {
                latitude: position.coords.latitude,
                longitude: position.coords.longitude
            };
            
            frappe.call({
                method: 'custom_app.visit_tracking.check_out_customer',
                args: {
                    visit_name: activeVisit,
                    location_data: JSON.stringify(location)
                },
                callback: function(r) {
                    if(r.message.status === "Checked-out") {
                        activeVisit = null;
                        frappe.msgprint({
                            title: 'Checked-out',
                            message: `Successfully checked out. Visit duration: ${r.message.duration}`,
                            indicator: 'green'
                        });
                        frm.reload_doc();
                    }
                }
            });
        }, function(error) {
            frappe.msgprint('Error getting location: ' + error.message);
        });
    } else {
        frappe.msgprint('Geolocation is not supported by this browser');
    }
}

// التحقق من زيارة نشطة عند التحميل
$(document).ready(function() {
    frappe.call({
        method: 'custom_app.visit_tracking.get_active_visit',
        args: {
            salesman: frappe.session.user
        },
        callback: function(r) {
            if(r.message) {
                activeVisit = r.message.name;
            }
        }
    });
});
```

---

## Task 12: تحليل السلوك (Speed & Delay)

### الوصف
Integration مع Google Maps API لحساب ETA ومقارنة الوقت الفعلي بالمتوقع.

### الحل في Frappe/ERPNext

#### 1. إنشاء DocType جديد: GPS Tracking Log

```json
{
  "doctype": "DocType",
  "module": "Selling",
  "name": "GPS Tracking Log",
  "fields": [
    {"fieldname": "timestamp", "fieldtype": "Datetime", "label": "Timestamp"},
    {"fieldname": "salesman", "fieldtype": "Link", "options": "Salesman"},
    {"fieldname": "latitude", "fieldtype": "Float", "label": "Latitude"},
    {"fieldname": "longitude", "fieldtype": "Float", "label": "Longitude"},
    {"fieldname": "speed", "fieldtype": "Float", "label": "Speed (km/h)"},
    {"fieldname": "heading", "fieldtype": "Float", "label": "Heading (degrees)"},
    {"fieldname": "accuracy", "fieldtype": "Float", "label": "Accuracy (meters)"},
    {"fieldname": "destination", "fieldtype": "Link", "options": "Customer"},
    {"fieldname": "expected_eta", "fieldtype": "Datetime", "label": "Expected ETA"},
    {"fieldname": "actual_arrival", "fieldtype": "Datetime", "label": "Actual Arrival"},
    {"fieldname": "delay", "fieldtype": "Time", "label": "Delay"},
    {"fieldname": "is_delayed", "fieldtype": "Check", "label": "Is Delayed"},
    {"fieldname": "delay_reason", "fieldtype": "Select", "options": "Traffic\nWeather\nBreak\nOther"}
  ]
}
```

#### 2. Python Script: تحليل السلوك

```python
# behavior_analysis.py
import requests
import json
from datetime import datetime, timedelta

GOOGLE_MAPS_API_KEY = "YOUR_API_KEY"
DELAY_THRESHOLD_MINUTES = 15  # عتبة التأخير

@frappe.whitelist()
def log_gps_position(salesman, position_data):
    """تسجيل موقع GPS"""
    import json
    
    position = json.loads(position_data)
    
    # إنشاء سجل GPS
    gps_log = frappe.new_doc("GPS Tracking Log")
    gps_log.timestamp = frappe.utils.now()
    gps_log.salesman = salesman
    gps_log.latitude = position.get("latitude")
    gps_log.longitude = position.get("longitude")
    gps_log.speed = position.get("speed", 0)
    gps_log.heading = position.get("heading", 0)
    gps_log.accuracy = position.get("accuracy", 0)
    
    gps_log.save()
    
    return {"status": "Logged"}

@frappe.whitelist()
def calculate_eta(salesman, destination_customer):
    """حساب الوقت المتوقع للوصول"""
    # الحصول على آخر موقع للمندوب
    last_position = frappe.db.get_value("GPS Tracking Log", {
        "salesman": salesman
    }, ["latitude", "longitude"], order_by="timestamp desc")
    
    if not last_position:
        frappe.throw("No GPS data found for this salesman")
    
    # الحصول على موقع العميل
    customer = frappe.get_doc("Customer", destination_customer)
    if not customer.gps_coordinates:
        frappe.throw("Customer location not set")
    
    # استدعاء Google Maps Distance Matrix API
    origin = f"{last_position[0]},{last_position[1]}"
    destination = customer.gps_coordinates
    
    url = f"https://maps.googleapis.com/maps/api/distancematrix/json?origins={origin}&destinations={destination}&departure_time=now&key={GOOGLE_MAPS_API_KEY}"
    
    response = requests.get(url)
    data = response.json()
    
    if data["status"] != "OK":
        frappe.throw(f"Error calculating ETA: {data['status']}")
    
    # استخراج الوقت المتوقع
    duration = data["rows"][0]["elements"][0]["duration"]["value"]  # in seconds
    eta = datetime.now() + timedelta(seconds=duration)
    
    # تحديث آخر سجل GPS
    last_log = frappe.db.get_value("GPS Tracking Log", {
        "salesman": salesman
    }, "name", order_by="timestamp desc")
    
    if last_log:
        log = frappe.get_doc("GPS Tracking Log", last_log)
        log.destination = destination_customer
        log.expected_eta = eta
        log.save()
    
    return {
        "eta": eta.strftime("%Y-%m-%d %H:%M:%S"),
        "duration_minutes": duration / 60
    }

@frappe.whitelist()
def check_delay(salesman, visit_name):
    """التحقق من التأخير"""
    visit = frappe.get_doc("Customer Visit", visit_name)
    
    # الحصول على آخر سجل GPS مع ETA
    gps_log = frappe.db.get_value("GPS Tracking Log", {
        "salesman": salesman,
        "destination": visit.customer
    }, ["expected_eta", "actual_arrival"], order_by="timestamp desc")
    
    if not gps_log:
        return {"is_delayed": False}
    
    expected_eta = datetime.strptime(gps_log[0], "%Y-%m-%d %H:%M:%S")
    actual_arrival = datetime.strptime(visit.check_in_time, "%Y-%m-%d %H:%M:%S.%f")
    
    # حساب التأخير
    delay = actual_arrival - expected_eta
    delay_minutes = delay.total_seconds() / 60
    
    # التحقق من التأخير
    is_delayed = delay_minutes > DELAY_THRESHOLD_MINUTES
    
    # تحديث سجل GPS
    log = frappe.get_doc("GPS Tracking Log", gps_log.name)
    log.actual_arrival = visit.check_in_time
    log.delay = str(delay)
    log.is_delayed = is_delayed
    log.save()
    
    return {
        "is_delayed": is_delayed,
        "delay_minutes": delay_minutes,
        "expected_eta": gps_log[0],
        "actual_arrival": visit.check_in_time
    }

@frappe.whitelist()
def log_speed_alert(salesman, speed_data):
    """تسجيل تنبيه السرعة"""
    import json
    
    data = json.loads(speed_data)
    speed = data.get("speed", 0)
    
    # عتبة السرعة (مثلاً 120 كم/س)
    SPEED_THRESHOLD = 120
    
    if speed > SPEED_THRESHOLD:
        # إنشاء تنبيه
        alert = frappe.new_doc("GPS Tracking Log")
        alert.timestamp = frappe.utils.now()
        alert.salesman = salesman
        alert.latitude = data.get("latitude")
        alert.longitude = data.get("longitude")
        alert.speed = speed
        alert.heading = data.get("heading", 0)
        alert.accuracy = data.get("accuracy", 0)
        alert.is_delayed = 1
        alert.delay_reason = "Speeding"
        
        alert.save()
        
        # إرسال إشعار للمدير
        frappe.sendmail(
            recipients=[get_manager_email()],
            subject=f"Speed Alert: {salesman}",
            message=f"Salesman {salesman} is driving at {speed} km/h (Threshold: {SPEED_THRESHOLD} km/h)"
        )
        
        return {"status": "Alert Sent", "speed": speed}
    
    return {"status": "Normal", "speed": speed}
```

#### 3. Client Script: تسجيل GPS المستمر

```javascript
// gps_tracking_client_script.js
var gpsInterval = null;
var isTracking = false;

function start_gps_tracking() {
    if(isTracking) {
        frappe.msgprint('GPS tracking is already active');
        return;
    }
    
    if(navigator.geolocation) {
        isTracking = true;
        frappe.msgprint('GPS tracking started');
        
        // تسجيل الموقع كل 30 ثانية
        gpsInterval = setInterval(function() {
            navigator.geolocation.getCurrentPosition(
                function(position) {
                    var position_data = {
                        latitude: position.coords.latitude,
                        longitude: position.coords.longitude,
                        speed: position.coords.speed || 0,
                        heading: position.coords.heading || 0,
                        accuracy: position.coords.accuracy || 0
                    };
                    
                    // إرسال الموقع للسيرفر
                    frappe.call({
                        method: 'custom_app.behavior_analysis.log_gps_position',
                        args: {
                            salesman: frappe.session.user,
                            position_data: JSON.stringify(position_data)
                        },
                        callback: function(r) {
                            // التحقق من السرعة
                            if(r.message && position.coords.speed) {
                                var speed_kmh = position.coords.speed * 3.6; // تحويل من m/s إلى km/h
                                frappe.call({
                                    method: 'custom_app.behavior_analysis.log_speed_alert',
                                    args: {
                                        salesman: frappe.session.user,
                                        speed_data: JSON.stringify({
                                            ...position_data,
                                            speed: speed_kmh
                                        })
                                    }
                                });
                            }
                        }
                    });
                },
                function(error) {
                    console.error('GPS Error:', error);
                },
                {
                    enableHighAccuracy: true,
                    timeout: 5000,
                    maximumAge: 0
                }
            );
        }, 30000); // كل 30 ثانية
    } else {
        frappe.msgprint('Geolocation is not supported by this browser');
    }
}

function stop_gps_tracking() {
    if(gpsInterval) {
        clearInterval(gpsInterval);
        gpsInterval = null;
        isTracking = false;
        frappe.msgprint('GPS tracking stopped');
    }
}

// بدء التتبع عند تسجيل الدخول
$(document).ready(function() {
    if(frappe.user.has_role('Salesman')) {
        start_gps_tracking();
    }
});

// إيقاف التتبع عند الخروج
$(window).on('beforeunload', function() {
    stop_gps_tracking();
});
```

---

# 👥 Module 5: العملاء والفرص (CRM & Leads)

## Task 13: إدارة بيانات العملاء

### الوصف
Workflow لتعديل/حذف موقع العميل وتقرير العملاء المهملين.

### الحل في Frappe/ERPNext

#### 1. تعديل DocType: Customer

**إضافة الحقول:**

| Field Name | Type | Options | Description |
|------------|------|---------|-------------|
| `gps_coordinates` | Geolocation | - | إحداثيات العميل |
| `location_change_request` | Link | Location Change Request | طلب تغيير الموقع |
| `last_interaction_date` | Date | - | تاريخ آخر تفاعل |
| `customer_rating` | Rating | - | تقييم العميل |
| `is_inactive` | Check | - | هل العميل غير نشط |

#### 2. إنشاء DocType جديد: Location Change Request

```json
{
  "doctype": "DocType",
  "module": "Selling",
  "name": "Location Change Request",
  "fields": [
    {"fieldname": "request_date", "fieldtype": "Date", "label": "Request Date", "default": "Today"},
    {"fieldname": "customer", "fieldtype": "Link", "options": "Customer"},
    {"fieldname": "current_location", "fieldtype": "Geolocation", "label": "Current Location"},
    {"fieldname": "new_location", "fieldtype": "Geolocation", "label": "New Location"},
    {"fieldname": "change_reason", "fieldtype": "Text", "label": "Change Reason"},
    {"fieldname": "status", "fieldtype": "Select", "options": "Pending\nApproved\nRejected"},
    {"fieldname": "approved_by", "fieldtype": "Link", "options": "User"},
    {"fieldname": "approval_date", "fieldtype": "Date", "label": "Approval Date"},
    {"fieldname": "rejection_reason", "fieldtype": "Text", "label": "Rejection Reason"},
    {"fieldname": "requested_by", "fieldtype": "Link", "options": "User"}
  ]
}
```

#### 3. Python Script: إدارة تغيير الموقع

```python
# location_management.py
@frappe.whitelist()
def request_location_change(customer, new_location, change_reason):
    """طلب تغيير موقع العميل"""
    customer_doc = frappe.get_doc("Customer", customer)
    
    # إنشاء طلب تغيير الموقع
    request = frappe.new_doc("Location Change Request")
    request.request_date = frappe.utils.today()
    request.customer = customer
    request.current_location = customer_doc.gps_coordinates
    request.new_location = new_location
    request.change_reason = change_reason
    request.status = "Pending"
    request.requested_by = frappe.session.user
    
    request.save()
    
    # إرسال إشعار للمدير
    frappe.sendmail(
        recipients=[get_manager_email()],
        subject=f"Location Change Request: {request.name}",
        message=f"Customer {customer} has requested a location change.\n\nReason: {change_reason}"
    )
    
    return {"status": "Submitted", "request": request.name}

@frappe.whitelist()
def approve_location_change(request_name):
    """موافقة على تغيير الموقع"""
    request = frappe.get_doc("Location Change Request", request_name)
    
    # التحقق من الحالة
    if request.status != "Pending":
        frappe.throw("This request is not pending")
    
    # تحديث موقع العميل
    customer = frappe.get_doc("Customer", request.customer)
    customer.gps_coordinates = request.new_location
    customer.location_change_request = request.name
    customer.save()
    
    # تحديث الطلب
    request.status = "Approved"
    request.approved_by = frappe.session.user
    request.approval_date = frappe.utils.today()
    request.save()
    
    # إرسال إشعار للمندوب
    frappe.sendmail(
        recipients=[request.requested_by],
        subject=f"Location Change Approved: {request.name}",
        message=f"Your location change request has been approved."
    )
    
    return {"status": "Approved"}

@frappe.whitelist()
def reject_location_change(request_name, rejection_reason):
    """رفض تغيير الموقع"""
    request = frappe.get_doc("Location Change Request", request_name)
    
    # التحقق من الحالة
    if request.status != "Pending":
        frappe.throw("This request is not pending")
    
    # تحديث الطلب
    request.status = "Rejected"
    request.rejection_reason = rejection_reason
    request.save()
    
    # إرسال إشعار للمندوب
    frappe.sendmail(
        recipients=[request.requested_by],
        subject=f"Location Change Rejected: {request.name}",
        message=f"Your location change request has been rejected.\n\nReason: {rejection_reason}"
    )
    
    return {"status": "Rejected"}
```

#### 4. Report: العملاء المهملين

```python
# inactive_customers_report.py
from frappe import _
import frappe
from frappe.utils import getdate, add_days

def execute(filters=None):
    columns = [
        {
            "fieldname": "customer",
            "label": _("Customer"),
            "fieldtype": "Link",
            "options": "Customer",
            "width": 200
        },
        {
            "fieldname": "customer_name",
            "label": _("Customer Name"),
            "fieldtype": "Data",
            "width": 200
        },
        {
            "fieldname": "territory",
            "label": _("Territory"),
            "fieldtype": "Link",
            "options": "Territory",
            "width": 150
        },
        {
            "fieldname": "last_interaction_date",
            "label": _("Last Interaction Date"),
            "fieldtype": "Date",
            "width": 150
        },
        {
            "fieldname": "days_inactive",
            "label": _("Days Inactive"),
            "fieldtype": "Int",
            "width": 100
        },
        {
            "fieldname": "customer_rating",
            "label": _("Rating"),
            "fieldtype": "Rating",
            "width": 100
        },
        {
            "fieldname": "total_sales",
            "label": _("Total Sales"),
            "fieldtype": "Currency",
            "width": 150
        }
    ]
    
    # الحصول على الفلاتر
    days_threshold = filters.get("days_threshold", 30)
    territory = filters.get("territory")
    
    # حساب تاريخ العتبة
    threshold_date = add_days(getdate(), -days_threshold)
    
    # الاستعلام عن العملاء
    query = """
        SELECT
            c.name as customer,
            c.customer_name,
            c.territory,
            c.last_interaction_date,
            c.customer_rating,
            COALESCE(SUM(si.grand_total), 0) as total_sales
        FROM `tabCustomer` c
        LEFT JOIN `tabSales Invoice` si ON c.name = si.customer
            AND si.docstatus = 1
            AND si.posting_date >= %s
        WHERE c.last_interaction_date < %s
            AND c.is_inactive = 0
    """
    
    params = [threshold_date, threshold_date]
    
    if territory:
        query += " AND c.territory = %s"
        params.append(territory)
    
    query += " GROUP BY c.name ORDER BY c.last_interaction_date"
    
    data = frappe.db.sql(query, params, as_dict=True)
    
    # حساب عدد الأيام غير النشطة
    for row in data:
        if row.last_interaction_date:
            row.days_inactive = (getdate() - getdate(row.last_interaction_date)).days
    
    return columns, data
```

---

## Task 14: نظام الفلترة والتحويل (Lead Management)

### الوصف
فلترة الـ Leads وتحويلهم لعملاء وجلب العملاء من Google Places.

### الحل في Frappe/ERPNext

#### 1. تعديل DocType: Lead

**إضافة الحقول:**

| Field Name | Type | Options | Description |
|------------|------|---------|-------------|
| `lead_score` | Int | - | نقاط الفرصة |
| `source` | Select | Google Places, Website, Referral, Other | مصدر الفرصة |
| `google_place_id` | Data | - | معرف Google Place |
| `is_duplicate` | Check | - | هل مكرر |

#### 2. Python Script: Google Places Scraping

```python
# lead_management.py
import requests
import json

GOOGLE_PLACES_API_KEY = "YOUR_API_KEY"

@frappe.whitelist()
def scrape_google_places(query, location, radius=5000):
    """جلب العملاء من Google Places"""
    url = f"https://maps.googleapis.com/maps/api/place/textsearch/json?query={query}&location={location}&radius={radius}&key={GOOGLE_PLACES_API_KEY}"
    
    response = requests.get(url)
    data = response.json()
    
    if data["status"] != "OK":
        frappe.throw(f"Error fetching places: {data['status']}")
    
    results = []
    
    for place in data["results"]:
        # التحقق من التكرار
        if is_duplicate_lead(place["name"], place.get("formatted_phone_number")):
            continue
        
        # الحصول على تفاصيل المكان
        place_details = get_place_details(place["place_id"])
        
        lead_data = {
            "lead_name": place["name"],
            "company_name": place["name"],
            "address": place.get("formatted_address"),
            "phone": place.get("formatted_phone_number"),
            "website": place.get("website"),
            "gps_coordinates": f"{place['geometry']['location']['lat']},{place['geometry']['location']['lng']}",
            "google_place_id": place["place_id"],
            "source": "Google Places",
            "lead_score": calculate_lead_score(place_details)
        }
        
        results.append(lead_data)
    
    return results

def get_place_details(place_id):
    """الحصول على تفاصيل المكان"""
    url = f"https://maps.googleapis.com/maps/api/place/details/json?place_id={place_id}&fields=name,rating,review_count,formatted_phone_number,website,formatted_address&key={GOOGLE_PLACES_API_KEY}"
    
    response = requests.get(url)
    data = response.json()
    
    if data["status"] == "OK":
        return data["result"]
    
    return {}

def calculate_lead_score(place_details):
    """حساب نقاط الفرصة"""
    score = 50  # النقاط الأساسية
    
    # إضافة نقاط للتقييم
    if place_details.get("rating"):
        score += place_details["rating"] * 10
    
    # إضافة نقاط لعدد المراجعات
    if place_details.get("review_count"):
        score += min(place_details["review_count"], 100)
    
    # إضافة نقاط للموقع الإلكتروني
    if place_details.get("website"):
        score += 20
    
    return min(score, 100)

def is_duplicate_lead(name, phone):
    """التحقق من تكرار الفرصة"""
    # التحقق بالاسم
    existing_name = frappe.db.exists("Lead", {"lead_name": name})
    if existing_name:
        return True
    
    # التحقق بالهاتف
    if phone:
        existing_phone = frappe.db.exists("Lead", {"phone": phone})
        if existing_phone:
            return True
    
    # التحقق من العملاء
    existing_customer = frappe.db.exists("Customer", {"customer_name": name})
    if existing_customer:
        return True
    
    return False

@frappe.whitelist()
def convert_lead_to_customer(lead_name):
    """تحويل الفرصة لعميل"""
    lead = frappe.get_doc("Lead", lead_name)
    
    # إنشاء عميل
    customer = frappe.new_doc("Customer")
    customer.customer_name = lead.lead_name
    customer.territory = lead.territory
    customer.customer_type = lead.lead_type
    customer.gps_coordinates = lead.gps_coordinates
    customer.customer_group = "Commercial"
    
    # إضافة معلومات الاتصال
    if lead.phone:
        customer.append("contacts", {
            "is_primary_contact": 1,
            "first_name": lead.lead_name,
            "phone": lead.phone
        })
    
    if lead.email_id:
        customer.append("contacts", {
            "is_primary_contact": 1,
            "first_name": lead.lead_name,
            "email_id": lead.email_id
        })
    
    # إضافة العنوان
    if lead.address_line1:
        customer.append("addresses", {
            "address_title": lead.lead_name,
            "address_type": "Billing",
            "address_line1": lead.address_line1,
            "city": lead.city,
            "state": lead.state,
            "country": lead.country,
            "pincode": lead.pincode
        })
    
    customer.save()
    
    # تحديث حالة الفرصة
    lead.status = "Converted"
    lead.converted = 1
    lead.save()
    
    return {"status": "Converted", "customer": customer.name}

@frappe.whitelist()
def filter_leads(filters):
    """فلترة الفرص"""
    import json
    
    filter_data = json.loads(filters)
    
    # بناء الاستعلام
    query = """
        SELECT
            name,
            lead_name,
            company_name,
            lead_status,
            lead_score,
            source,
            territory,
            creation
        FROM `tabLead`
        WHERE 1=1
    """
    
    params = []
    
    # الفلترة بالحالة
    if filter_data.get("status"):
        query += " AND lead_status = %s"
        params.append(filter_data["status"])
    
    # الفلترة بالنقاط
    if filter_data.get("min_score"):
        query += " AND lead_score >= %s"
        params.append(filter_data["min_score"])
    
    if filter_data.get("max_score"):
        query += " AND lead_score <= %s"
        params.append(filter_data["max_score"])
    
    # الفلترة بالمصدر
    if filter_data.get("source"):
        query += " AND source = %s"
        params.append(filter_data["source"])
    
    # الفلترة بالمنطقة
    if filter_data.get("territory"):
        query += " AND territory = %s"
        params.append(filter_data["territory"])
    
    query += " ORDER BY lead_score DESC"
    
    data = frappe.db.sql(query, params, as_dict=True)
    
    return data
```

#### 3. Client Script: تحويل الفرص

```javascript
// lead_client_script.js
frappe.ui.form.on('Lead', {
    refresh: function(frm) {
        // إضافة زر تحويل لعميل
        if(frm.doc.status !== 'Converted') {
            frm.add_custom_button('Convert to Customer', function() {
                convert_to_customer(frm);
            });
        }
        
        // إضافة زر جلب من Google Places
        if(frappe.user.has_role('Sales Manager')) {
            frm.add_custom_button('Scrape Google Places', function() {
                scrape_google_places(frm);
            });
        }
    }
});

function convert_to_customer(frm) {
    frappe.call({
        method: 'custom_app.lead_management.convert_lead_to_customer',
        args: {
            lead_name: frm.doc.name
        },
        callback: function(r) {
            if(r.message.status === "Converted") {
                frappe.msgprint({
                    title: 'Converted',
                    message: `Lead converted to customer: ${r.message.customer}`,
                    indicator: 'green'
                });
                frm.reload_doc();
            }
        }
    });
}

function scrape_google_places(frm) {
    var dialog = new frappe.ui.Dialog({
        title: 'Scrape Google Places',
        fields: [
            {fieldname: 'query', fieldtype: 'Data', label: 'Search Query', reqd: 1},
            {fieldname: 'location', fieldtype: 'Geolocation', label: 'Location', reqd: 1},
            {fieldname: 'radius', fieldtype: 'Int', label: 'Radius (meters)', default: 5000}
        ],
        primary_action: function() {
            var data = dialog.get_values();
            
            frappe.call({
                method: 'custom_app.lead_management.scrape_google_places',
                args: {
                    query: data.query,
                    location: data.location,
                    radius: data.radius
                },
                callback: function(r) {
                    if(r.message) {
                        frappe.msgprint(`Found ${r.message.length} leads`);
                        
                        // عرض النتائج
                        show_leads_dialog(r.message);
                    }
                }
            });
            
            dialog.hide();
        }
    });
    
    dialog.show();
}

function show_leads_dialog(leads) {
    var dialog = new frappe.ui.Dialog({
        title: 'Google Places Results',
        fields: [
            {fieldname: 'leads', fieldtype: 'HTML', label: 'Leads'}
        ],
        size: 'large'
    });
    
    var html = '<table class="table table-bordered">' +
        '<thead><tr><th>Name</th><th>Phone</th><th>Address</th><th>Score</th><th>Action</th></tr></thead>' +
        '<tbody>';
    
    leads.forEach(function(lead) {
        html += '<tr>' +
            '<td>' + lead.lead_name + '</td>' +
            '<td>' + (lead.phone || '-') + '</td>' +
            '<td>' + (lead.address || '-') + '</td>' +
            '<td>' + lead.lead_score + '</td>' +
            '<td><button class="btn btn-xs btn-primary" onclick="import_lead(\'' + JSON.stringify(lead).replace(/'/g, "\\'") + '\')">Import</button></td>' +
            '</tr>';
    });
    
    html += '</tbody></table>';
    
    dialog.fields_dict.leads.$wrapper.html(html);
    dialog.show();
}

window.import_lead = function(lead_data) {
    frappe.call({
        method: 'frappe.client.insert',
        args: {
            doc: {
                doctype: 'Lead',
                lead_name: lead_data.lead_name,
                company_name: lead_data.company_name,
                phone: lead_data.phone,
                website: lead_data.website,
                gps_coordinates: lead_data.gps_coordinates,
                google_place_id: lead_data.google_place_id,
                source: lead_data.source,
                lead_score: lead_data.lead_score
            }
        },
        callback: function(r) {
            frappe.msgprint('Lead imported successfully');
        }
    });
};
```

---

# 📊 Module 6: التقارير والتقييم (Analytics & KPIs)

## Task 15: نظام التقييم (Rating System)

### الوصف
لوجيك لتقييم المندوب والعملاء.

### الحل في Frappe/ERPNext

#### 1. إنشاء DocType جديد: Salesman Evaluation

```json
{
  "doctype": "DocType",
  "module": "Selling",
  "name": "Salesman Evaluation",
  "fields": [
    {"fieldname": "evaluation_date", "fieldtype": "Date", "label": "Evaluation Date", "default": "Today"},
    {"fieldname": "salesman", "fieldtype": "Link", "options": "Salesman"},
    {"fieldname": "evaluation_period", "fieldtype": "Select", "options": "Monthly\nQuarterly\nYearly"},
    {"fieldname": "period_start", "fieldtype": "Date", "label": "Period Start"},
    {"fieldname": "period_end", "fieldtype": "Date", "label": "Period End"},
    {"fieldname": "total_score", "fieldtype": "Percent", "label": "Total Score"},
    {"fieldname": "sales_score", "fieldtype": "Percent", "label": "Sales Score (40%)"},
    {"fieldname": "visits_score", "fieldtype": "Percent", "label": "Visits Score (30%)"},
    {"fieldname": "compliance_score", "fieldtype": "Percent", "label": "Compliance Score (30%)"},
    {"fieldname": "total_sales", "fieldtype": "Currency", "label": "Total Sales"},
    {"fieldname": "sales_target", "fieldtype": "Currency", "label": "Sales Target"},
    {"fieldname": "planned_visits", "fieldtype": "Int", "label": "Planned Visits"},
    {"fieldname": "completed_visits", "fieldtype": "Int", "label": "Completed Visits"},
    {"fieldname": "on_time_visits", "fieldtype": "Int", "label": "On Time Visits"},
    {"fieldname": "evaluation_notes", "fieldtype": "Text", "label": "Evaluation Notes"},
    {"fieldname": "evaluated_by", "fieldtype": "Link", "options": "User"}
  ]
}
```

#### 2. إنشاء DocType جديد: Customer Evaluation

```json
{
  "doctype": "DocType",
  "module": "Selling",
  "name": "Customer Evaluation",
  "fields": [
    {"fieldname": "evaluation_date", "fieldtype": "Date", "label": "Evaluation Date", "default": "Today"},
    {"fieldname": "customer", "fieldtype": "Link", "options": "Customer"},
    {"fieldname": "total_score", "fieldtype": "Percent", "label": "Total Score"},
    {"fieldname": "volume_score", "fieldtype": "Percent", "label": "Volume Score (40%)"},
    {"fieldname": "payment_score", "fieldtype": "Percent", "label": "Payment Score (30%)"},
    {"fieldname": "loyalty_score", "fieldtype": "Percent", "label": "Loyalty Score (30%)"},
    {"fieldname": "total_purchases", "fieldtype": "Currency", "label": "Total Purchases"},
    {"fieldname": "payment_history", "fieldtype": "Select", "options": "Excellent\nGood\nAverage\nPoor"},
    {"fieldname": "customer_since", "fieldtype": "Date", "label": "Customer Since"},
    {"fieldname": "evaluation_notes", "fieldtype": "Text", "label": "Evaluation Notes"},
    {"fieldname": "evaluated_by", "fieldtype": "Link", "options": "User"}
  ]
}
```

#### 3. Python Script: تقييم المندوب

```python
# salesman_evaluation.py
from datetime import datetime, timedelta

@frappe.whitelist()
def calculate_salesman_score(salesman, period_start, period_end):
    """حساب تقييم المندوب"""
    
    # 1. Sales Score (40%)
    total_sales = frappe.db.sql("""
        SELECT SUM(grand_total)
        FROM `tabSales Invoice`
        WHERE salesman = %s
            AND docstatus = 1
            AND posting_date BETWEEN %s AND %s
    """, (salesman, period_start, period_end))[0][0] or 0
    
    sales_target = frappe.db.get_value("Salesman", salesman, "sales_target") or 1
    sales_score = (total_sales / sales_target) * 40
    
    # 2. Visits Score (30%)
    planned_visits = frappe.db.count("Sales Route", {
        "salesman": salesman,
        "start_date": ["between", [period_start, period_end]]
    })
    
    completed_visits = frappe.db.count("Customer Visit", {
        "salesman": salesman,
        "visit_date": ["between", [period_start, period_end]],
        "visit_status": "Completed"
    })
    
    if planned_visits > 0:
        visits_score = (completed_visits / planned_visits) * 30
    else:
        visits_score = 0
    
    # 3. Compliance Score (30%)
    on_time_visits = frappe.db.sql("""
        SELECT COUNT(*)
        FROM `tabCustomer Visit`
        WHERE salesman = %s
            AND visit_date BETWEEN %s AND %s
            AND visit_status = 'Completed'
            AND delay <= '00:15:00'
    """, (salesman, period_start, period_end))[0][0] or 0
    
    if completed_visits > 0:
        compliance_score = (on_time_visits / completed_visits) * 30
    else:
        compliance_score = 0
    
    # Total Score
    total_score = sales_score + visits_score + compliance_score
    
    return {
        "total_score": total_score,
        "sales_score": sales_score,
        "visits_score": visits_score,
        "compliance_score": compliance_score,
        "total_sales": total_sales,
        "sales_target": sales_target,
        "planned_visits": planned_visits,
        "completed_visits": completed_visits,
        "on_time_visits": on_time_visits
    }

@frappe.whitelist()
def create_salesman_evaluation(salesman, period_start, period_end):
    """إنشاء تقييم المندوب"""
    scores = calculate_salesman_score(salesman, period_start, period_end)
    
    # إنشاء التقييم
    evaluation = frappe.new_doc("Salesman Evaluation")
    evaluation.evaluation_date = frappe.utils.today()
    evaluation.salesman = salesman
    evaluation.period_start = period_start
    evaluation.period_end = period_end
    evaluation.total_score = scores["total_score"]
    evaluation.sales_score = scores["sales_score"]
    evaluation.visits_score = scores["visits_score"]
    evaluation.compliance_score = scores["compliance_score"]
    evaluation.total_sales = scores["total_sales"]
    evaluation.sales_target = scores["sales_target"]
    evaluation.planned_visits = scores["planned_visits"]
    evaluation.completed_visits = scores["completed_visits"]
    evaluation.on_time_visits = scores["on_time_visits"]
    evaluation.evaluated_by = frappe.session.user
    
    evaluation.save()
    
    return {"status": "Created", "evaluation": evaluation.name, "scores": scores}

@frappe.whitelist()
def get_salesman_rankings(period_start, period_end):
    """الحصول على ترتيب المندوبين"""
    rankings = frappe.db.sql("""
        SELECT
            s.name as salesman,
            s.salesman_name,
            COALESCE(SUM(si.grand_total), 0) as total_sales,
            COALESCE(COUNT(DISTINCT cv.name), 0) as total_visits
        FROM `tabSalesman` s
        LEFT JOIN `tabSales Invoice` si ON s.name = si.salesman
            AND si.docstatus = 1
            AND si.posting_date BETWEEN %s AND %s
        LEFT JOIN `tabCustomer Visit` cv ON s.name = cv.salesman
            AND cv.visit_date BETWEEN %s AND %s
            AND cv.visit_status = 'Completed'
        GROUP BY s.name
        ORDER BY total_sales DESC
    """, (period_start, period_end, period_start, period_end), as_dict=True)
    
    # إضافة التقييم
    for i, ranking in enumerate(rankings):
        scores = calculate_salesman_score(ranking["salesman"], period_start, period_end)
        ranking["rank"] = i + 1
        ranking["total_score"] = scores["total_score"]
        ranking["sales_score"] = scores["sales_score"]
        ranking["visits_score"] = scores["visits_score"]
        ranking["compliance_score"] = scores["compliance_score"]
    
    return rankings
```

#### 4. Python Script: تقييم العميل

```python
# customer_evaluation.py
@frappe.whitelist()
def calculate_customer_score(customer):
    """حساب تقييم العميل"""
    
    # 1. Volume Score (40%)
    total_purchases = frappe.db.sql("""
        SELECT SUM(grand_total)
        FROM `tabSales Invoice`
        WHERE customer = %s
            AND docstatus = 1
    """, customer)[0][0] or 0
    
    # مقارنة بمتوسط الشراء
    avg_purchase = frappe.db.sql("""
        SELECT AVG(grand_total)
        FROM `tabSales Invoice`
        WHERE docstatus = 1
    """)[0][0] or 1
    
    volume_score = (total_purchases / avg_purchase) * 40
    volume_score = min(volume_score, 40)  # الحد الأقصى 40
    
    # 2. Payment Score (30%)
    # حساب نسبة الدفع في الوقت
    on_time_payments = frappe.db.sql("""
        SELECT COUNT(*)
        FROM `tabPayment Entry`
        WHERE party = %s
            AND payment_type = 'Receive'
            AND posting_date <= due_date
    """, customer)[0][0] or 0
    
    total_payments = frappe.db.sql("""
        SELECT COUNT(*)
        FROM `tabPayment Entry`
        WHERE party = %s
            AND payment_type = 'Receive'
    """, customer)[0][0] or 1
    
    if total_payments > 0:
        payment_score = (on_time_payments / total_payments) * 30
    else:
        payment_score = 0
    
    # 3. Loyalty Score (30%)
    customer_since = frappe.db.get_value("Customer", customer, "creation")
    if customer_since:
        days_since = (datetime.now() - customer_since).days
        loyalty_score = min(days_since / 365 * 30, 30)  # 30 نقطة لكل سنة
    else:
        loyalty_score = 0
    
    # Total Score
    total_score = volume_score + payment_score + loyalty_score
    
    return {
        "total_score": total_score,
        "volume_score": volume_score,
        "payment_score": payment_score,
        "loyalty_score": loyalty_score,
        "total_purchases": total_purchases
    }

@frappe.whitelist()
def create_customer_evaluation(customer):
    """إنشاء تقييم العميل"""
    scores = calculate_customer_score(customer)
    
    # إنشاء التقييم
    evaluation = frappe.new_doc("Customer Evaluation")
    evaluation.evaluation_date = frappe.utils.today()
    evaluation.customer = customer
    evaluation.total_score = scores["total_score"]
    evaluation.volume_score = scores["volume_score"]
    evaluation.payment_score = scores["payment_score"]
    evaluation.loyalty_score = scores["loyalty_score"]
    evaluation.total_purchases = scores["total_purchases"]
    evaluation.evaluated_by = frappe.session.user
    
    evaluation.save()
    
    # تحديث تقييم العميل
    customer_doc = frappe.get_doc("Customer", customer)
    customer_doc.customer_rating = scores["total_score"]
    
    # تصنيف العميل
    if scores["total_score"] >= 80:
        customer_doc.customer_group = "VIP"
    elif scores["total_score"] >= 60:
        customer_doc.customer_group = "Regular"
    else:
        customer_doc.customer_group = "Low Priority"
    
    customer_doc.save()
    
    return {"status": "Created", "evaluation": evaluation.name, "scores": scores}

@frappe.whitelist()
def classify_customers():
    """تصنيف جميع العملاء"""
    customers = frappe.db.get_all("Customer", {"is_inactive": 0})
    
    results = []
    for customer in customers:
        scores = calculate_customer_score(customer["name"])
        
        classification = "Low Priority"
        if scores["total_score"] >= 80:
            classification = "VIP"
        elif scores["total_score"] >= 60:
            classification = "Regular"
        
        results.append({
            "customer": customer["name"],
            "total_score": scores["total_score"],
            "classification": classification
        })
    
    return results
```

#### 5. Reports: تقارير KPI

```python
# kpi_reports.py
from frappe import _

def execute_sales_performance_report(filters=None):
    """تقرير أداء المبيعات"""
    columns = [
        {"fieldname": "salesman", "label": _("Salesman"), "fieldtype": "Link", "options": "Salesman", "width": 150},
        {"fieldname": "total_sales", "label": _("Total Sales"), "fieldtype": "Currency", "width": 150},
        {"fieldname": "sales_target", "label": _("Sales Target"), "fieldtype": "Currency", "width": 150},
        {"fieldname": "achievement", "label": _("Achievement %"), "fieldtype": "Percent", "width": 100},
        {"fieldname": "total_invoices", "label": _("Total Invoices"), "fieldtype": "Int", "width": 100},
        {"fieldname": "avg_invoice", "label": _("Avg Invoice"), "fieldtype": "Currency", "width": 150}
    ]
    
    period_start = filters.get("period_start")
    period_end = filters.get("period_end")
    
    data = frappe.db.sql("""
        SELECT
            s.name as salesman,
            s.salesman_name,
            COALESCE(SUM(si.grand_total), 0) as total_sales,
            s.sales_target,
            COALESCE(COUNT(si.name), 0) as total_invoices
        FROM `tabSalesman` s
        LEFT JOIN `tabSales Invoice` si ON s.name = si.salesman
            AND si.docstatus = 1
            AND si.posting_date BETWEEN %s AND %s
        GROUP BY s.name
    """, (period_start, period_end), as_dict=True)
    
    # حساب نسبة الإنجاز
    for row in data:
        if row.sales_target > 0:
            row.achievement = (row.total_sales / row.sales_target) * 100
        else:
            row.achievement = 0
        
        if row.total_invoices > 0:
            row.avg_invoice = row.total_sales / row.total_invoices
        else:
            row.avg_invoice = 0
    
    return columns, data

def execute_visit_compliance_report(filters=None):
    """تقرير التزام الزيارات"""
    columns = [
        {"fieldname": "salesman", "label": _("Salesman"), "fieldtype": "Link", "options": "Salesman", "width": 150},
        {"fieldname": "planned_visits", "label": _("Planned Visits"), "fieldtype": "Int", "width": 100},
        {"fieldname": "completed_visits", "label": _("Completed Visits"), "fieldtype": "Int", "width": 100},
        {"fieldname": "on_time_visits", "label": _("On Time Visits"), "fieldtype": "Int", "width": 100},
        {"fieldname": "completion_rate", "label": _("Completion %"), "fieldtype": "Percent", "width": 100},
        {"fieldname": "on_time_rate", "label": _("On Time %"), "fieldtype": "Percent", "width": 100}
    ]
    
    period_start = filters.get("period_start")
    period_end = filters.get("period_end")
    
    data = frappe.db.sql("""
        SELECT
            s.name as salesman,
            s.salesman_name,
            COUNT(DISTINCT sr.name) as planned_visits,
            COUNT(DISTINCT cv.name) as completed_visits,
            COUNT(DISTINCT CASE WHEN cv.delay <= '00:15:00' THEN cv.name END) as on_time_visits
        FROM `tabSalesman` s
        LEFT JOIN `tabSales Route` sr ON s.name = sr.salesman
            AND sr.start_date BETWEEN %s AND %s
        LEFT JOIN `tabCustomer Visit` cv ON s.name = cv.salesman
            AND cv.visit_date BETWEEN %s AND %s
            AND cv.visit_status = 'Completed'
        GROUP BY s.name
    """, (period_start, period_end, period_start, period_end), as_dict=True)
    
    # حساب النسب
    for row in data:
        if row.planned_visits > 0:
            row.completion_rate = (row.completed_visits / row.planned_visits) * 100
        else:
            row.completion_rate = 0
        
        if row.completed_visits > 0:
            row.on_time_rate = (row.on_time_visits / row.completed_visits) * 100
        else:
            row.on_time_rate = 0
    
    return columns, data
```

---

# 📋 خطة التنفيذ والأولويات

## المرحلة 1: الأساسيات (الأولوية العالية)

| Task | الوصف | المدة المقدرة |
|------|-------|----------------|
| Task 1 | هيكلة أنواع المستودعات | 3 أيام |
| Task 2 | تصنيف حالة المخزون | 2 يوم |
| Task 6 | دعم تعدد اللغات | 2 يوم |
| Task 11 | مؤقت الزيارات | 3 أيام |

**الإجمالي:** 10 أيام

## المرحلة 2: الميزات الأساسية (الأولوية المتوسطة)

| Task | الوصف | المدة المقدرة |
|------|-------|----------------|
| Task 3 | لوجيك المخزون الرجيع | 4 أيام |
| Task 5 | دورة عمل نقل المخزون | 5 أيام |
| Task 8 | صلاحيات الخصومات | 3 أيام |
| Task 13 | إدارة بيانات العملاء | 4 أيام |

**الإجمالي:** 16 يوم

## المرحلة 3: التحسينات (الأولوية المنخفضة)

| Task | الوصف | المدة المقدرة |
|------|-------|----------------|
| Task 4 | سجل تدقيق المخزون | 3 أيام |
| Task 7 | وحدات القياس الذكية | 5 أيام |
| Task 9 | الإدارة المالية للمندوب | 4 أيام |
| Task 10 | تخطيط المسارات | 5 أيام |
| Task 12 | تحليل السلوك | 6 أيام |
| Task 14 | نظام الفلترة | 4 أيام |
| Task 15 | نظام التقييم | 5 أيام |

**الإجمالي:** 32 يوم

---

# 🚨 التحديات والحلول

## التحدي 1: GPS Tracking
**المشكلة:** يحتاج Mobile App حقيقي للتتبع المستمر.

**الحل:**
- استخدام Frappe Mobile Framework
- تطبيق React Native أو Flutter
- استخدام Background Geolocation Service

## التحدي 2: Google Maps API Cost
**المشكلة:** Google Maps API له تكلفة عالية.

**الحل:**
- استخدام OpenStreetMap كبديل مجاني
- استخدام Mapbox API (أرخص)
- تطبيق Caching للمسارات المتكررة

## التحدي 3: Real-time Tracking
**المشكلة:** يحتاج WebSocket للتحديث الفوري.

**الحل:**
- استخدام Frappe Realtime (Socket.io)
- استخدام Firebase Cloud Messaging للإشعارات
- تطبيق Offline Mode مع Sync

## التحدي 4: Offline Mode
**المشكلة:** المندوب قد يعمل بدون إنترنت.

**الحل:**
- استخدام Frappe Sync API
- تطبيق Local Storage للبيانات
- Sync تلقائي عند العودة للإنترنت

---

# 📚 الموارد والمراجع

## Frappe/ERPNext Documentation
- [Frappe Framework Docs](https://frappeframework.com/docs)
- [ERPNext Documentation](https://docs.erpnext.com)
- [Frappe API Reference](https://frappeframework.com/docs/v14/user/en/api)
- [Frappe Developer Guide](https://frappeframework.com/docs/v14/user/en/development)

## Google Maps API
- [Google Maps JavaScript API](https://developers.google.com/maps/documentation/javascript)
- [Google Places API](https://developers.google.com/maps/documentation/places)
- [Google Distance Matrix API](https://developers.google.com/maps/documentation/distance-matrix)

## Mobile Development
- [Frappe Mobile](https://github.com/frappe/mobile)
- [React Native](https://reactnative.dev/)
- [Flutter](https://flutter.dev/)

---

# ✅ الخلاصة

هذا المشروع نظام مبيعات موبايل متقدم يتطلب:

1. **6 وحدات رئيسية** و **15 تاسك فرعي**
2. **9 DocTypes جديدة** مخصصة
3. **تعديل 7 DocTypes موجودة**
4. **تكامل مع Google Maps API**
5. **تطبيق Mobile App للتتبع**
6. **نظام تقييم شامل**

**المدة الإجمالية المقدرة:** 58 يوم (حوالي 3 أشهر)

**النصيحة:** البدء بالمرحلة 1 (الأساسيات) ثم التدرج في المراحل التالية.