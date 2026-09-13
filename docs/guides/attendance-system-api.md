# توثيق نظام الحضور الإداري (Employee Attendance Management System)

## نظرة عامة
هذا التوثيق يغطي جميع الـ APIs الخاصة بنظام الحضور الإداري في ERPNext/HRMS. النظام يعتمد على DocType اسمه **Employee Checkin** لتسجيل عمليات الدخول والخروج للموظفين، مع دعم كامل لـ:
- تسجيل الحضور عبر تطبيق الموبايل
- التقاط الصور (Selfie) أثناء الحضور
- تتبع الموقع الجغرافي (GPS)
- التحقق البيومتري (بصمة، Face ID)
- الربط التلقائي بسجلات الحضور (Attendance)

---

## جدول المحتويات
1. [هيكل Employee Checkin DocType](#employee-checkin-doctype)
2. [APIs - الحصول على البيانات (GET)](#apis-get)
3. [APIs - إنشاء سجلات جديدة (POST)](#apis-post)
4. [APIs - تحديث السجلات (PUT)](#apis-put)
5. [APIs - الحذف (DELETE)](#apis-delete)
6. [APIs - تتبع الموقع (Location Tracking)](#location-tracking-apis)
7. [APIs - التقارير والإحصائيات](#reports-apis)
8. [أمثلة عملية](#examples)
9. [معلومات إضافية](#additional-info)

---

## <a name="employee-checkin-doctype"></a>1. هيكل Employee Checkin DocType

### الحقول الأساسية (Core Fields)

| الحقل | النوع | الوصف | مطلوب |
|------|------|------|------|
| `name` | String | معرف فريد (Auto: EMP-CKIN-.MM.-.YYYY.-.######) | تلقائي |
| `employee` | Link | رابط للموظف (Employee) | نعم ✓ |
| `employee_name` | Data | اسم الموظف (يُسحب تلقائياً) | لا |
| `time` | Datetime | وقت التسجيل | نعم ✓ |
| `log_type` | Select | نوع التسجيل: IN / OUT | لا |
| `shift` | Link | الوردية (Shift Type) | لا |
| `overtime_type` | Link | نوع الوقت الإضافي | لا |
| `device_id` | Data | معرف الجهاز/الموقع | لا |
| `skip_auto_attendance` | Check | تخطي الحضور التلقائي | لا (افتراضي: 0) |
| `attendance` | Link | الحضور المرتبط (Attendance) | لا (للقراءة فقط) |

### حقول التحقق (Verification Fields)

| الحقل | النوع | الوصف | مطلوب |
|------|------|------|------|
| `checkin_method` | Data | طريقة التسجيل (Manual/Photo/Biometric) | لا |
| `photo_image` | Attach Image | صورة السيلفي المرفقة | لا |
| `biometric_verified` | Check | تم التحقق بيومترياً | لا (افتراضي: 0) |
| `biometric_type` | Select | نوع التحقق: Fingerprint/Face ID/Touch ID | لا |

### حقول الموقع (Location Fields)

| الحقل | النوع | الوصف | مطلوب |
|------|------|------|------|
| `latitude` | Float | خط العرض (دقة 7) | لا |
| `longitude` | Float | خط الطول (دقة 7) | لا |
| `geolocation` | Geolocation | عنصر الخريطة التفاعلي | لا (للقراءة فقط) |
| `fetch_geolocation` | Button | زر لجلب الموقع | - |

### حقول الوردية (Shift Timing Fields)

| الحقل | النوع | الوصف | 
|------|------|------|
| `shift_start` | Datetime | بداية الوردية |
| `shift_end` | Datetime | نهاية الوردية |
| `shift_actual_start` | Datetime | البداية الفعلية للوردية |
| `shift_actual_end` | Datetime | النهاية الفعلية للوردية |
| `offshift` | Check | خارج الوردية |

---

## <a name="apis-get"></a>2. APIs - الحصول على البيانات (GET)

### 2.1 الحصول على سجل حضور واحد (Get Single Checkin)

**Endpoint:**
```
GET /api/resource/Employee Checkin/{name}
```

**Authentication:** Required (API Key/Secret أو Session)

**Parameters:**
- `name` (required): اسم السجل (مثال: EMP-CKIN-01-2026-000001)

**Response Example:**
```json
{
  "data": {
    "name": "EMP-CKIN-01-2026-000001",
    "employee": "EMP-00001",
    "employee_name": "أحمد محمد",
    "time": "2026-02-10 09:00:00",
    "log_type": "IN",
    "shift": "Morning Shift",
    "device_id": "Mobile App - iOS",
    "checkin_method": "Photo + Biometric",
    "photo_image": "/files/checkin_photo_12345.jpg",
    "biometric_verified": 1,
    "biometric_type": "Face ID",
    "latitude": 24.7136,
    "longitude": 46.6753,
    "geolocation": {
      "type": "FeatureCollection",
      "features": [{
        "type": "Feature",
        "properties": {},
        "geometry": {
          "type": "Point",
          "coordinates": [46.6753, 24.7136]
        }
      }]
    },
    "attendance": "ATT-00001",
    "skip_auto_attendance": 0,
    "shift_start": "2026-02-10 08:00:00",
    "shift_end": "2026-02-10 17:00:00",
    "shift_actual_start": "2026-02-10 07:30:00",
    "shift_actual_end": "2026-02-10 17:30:00",
    "offshift": 0,
    "creation": "2026-02-10 09:00:05.123456",
    "modified": "2026-02-10 09:00:05.123456",
    "owner": "emp001@company.com"
  }
}
```

**عرض الصورة:**
الصورة متاحة على الرابط:
```
https://your-domain.com/files/checkin_photo_12345.jpg
```

---

### 2.2 الحصول على قائمة سجلات الحضور (Get List)

**Endpoint:**
```
GET /api/resource/Employee Checkin
```

**Authentication:** Required

**Query Parameters:**

| Parameter | Type | Description | مثال |
|-----------|------|-------------|------|
| `filters` | JSON | فلاتر البحث | `[["employee","=","EMP-00001"]]` |
| `fields` | JSON | الحقول المطلوبة | `["name","employee","time","log_type"]` |
| `limit_start` | Integer | بداية الصفحة | `0` |
| `limit_page_length` | Integer | عدد السجلات | `20` |
| `order_by` | String | الترتيب | `time desc` |

**أمثلة الفلاتر (Filters Examples):**

#### 1. حضور موظف معين
```json
{
  "filters": [["employee", "=", "EMP-00001"]]
}
```

#### 2. حضور موظف في يوم معين
```json
{
  "filters": [
    ["employee", "=", "EMP-00001"],
    ["time", "between", ["2026-02-10 00:00:00", "2026-02-10 23:59:59"]]
  ]
}
```

#### 3. جميع عمليات الدخول (IN) لموظف
```json
{
  "filters": [
    ["employee", "=", "EMP-00001"],
    ["log_type", "=", "IN"]
  ]
}
```

#### 4. الحضور في فترة زمنية
```json
{
  "filters": [
    ["time", ">=", "2026-02-01 00:00:00"],
    ["time", "<=", "2026-02-28 23:59:59"]
  ]
}
```

#### 5. الحضور مع صور فقط
```json
{
  "filters": [
    ["photo_image", "is", "set"]
  ]
}
```

#### 6. الحضور المتحقق بيومترياً
```json
{
  "filters": [
    ["biometric_verified", "=", 1]
  ]
}
```

#### 7. حضور موظفين متعددين
```json
{
  "filters": [
    ["employee", "in", ["EMP-00001", "EMP-00002", "EMP-00003"]]
  ]
}
```

#### 8. الحضور في وردية معينة
```json
{
  "filters": [
    ["shift", "=", "Morning Shift"],
    ["time", "between", ["2026-02-10 00:00:00", "2026-02-10 23:59:59"]]
  ]
}
```

**Request Example (cURL):**
```bash
curl -X GET \
  'https://your-domain.com/api/resource/Employee%20Checkin?filters=[["employee","=","EMP-00001"]]&fields=["name","employee","employee_name","time","log_type","photo_image","latitude","longitude"]&limit_page_length=50&order_by=time%20desc' \
  -H 'Authorization: token api_key:api_secret'
```

**Request Example (JavaScript):**
```javascript
fetch('https://your-domain.com/api/resource/Employee%20Checkin', {
  method: 'GET',
  headers: {
    'Authorization': 'token api_key:api_secret',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    filters: [["employee", "=", "EMP-00001"]],
    fields: ["name", "employee", "time", "log_type", "photo_image", "latitude", "longitude"],
    limit_page_length: 50,
    order_by: "time desc"
  })
})
.then(response => response.json())
.then(data => console.log(data));
```

**Request Example (Python):**
```python
import requests

url = "https://your-domain.com/api/resource/Employee Checkin"
headers = {
    "Authorization": "token api_key:api_secret"
}
params = {
    "filters": '[["employee","=","EMP-00001"]]',
    "fields": '["name","employee","time","log_type","photo_image","latitude","longitude"]',
    "limit_page_length": 50,
    "order_by": "time desc"
}

response = requests.get(url, headers=headers, params=params)
data = response.json()
```

**Response Example:**
```json
{
  "data": [
    {
      "name": "EMP-CKIN-02-2026-000015",
      "employee": "EMP-00001",
      "employee_name": "أحمد محمد",
      "time": "2026-02-10 17:00:00",
      "log_type": "OUT",
      "photo_image": "/files/checkout_12345.jpg",
      "latitude": 24.7136,
      "longitude": 46.6753
    },
    {
      "name": "EMP-CKIN-02-2026-000012",
      "employee": "EMP-00001",
      "employee_name": "أحمد محمد",
      "time": "2026-02-10 09:00:00",
      "log_type": "IN",
      "photo_image": "/files/checkin_12345.jpg",
      "latitude": 24.7138,
      "longitude": 46.6755
    }
  ]
}
```

---

### 2.3 إحصائيات حضور موظف (Get Employee Checkin Stats)

**Endpoint (Custom API):**
```
GET /api/method/hrms.hr.doctype.employee_checkin.employee_checkin_api.get_employee_checkin_stats
```

**Parameters:**
```json
{
  "employee": "EMP-00001",
  "from_date": "2026-02-01",
  "to_date": "2026-02-28"
}
```

**Response Example:**
```json
{
  "message": {
    "total_checkins": 40,
    "total_days": 20,
    "in_count": 20,
    "out_count": 20,
    "with_photo": 38,
    "with_biometric": 35,
    "average_checkin_time": "08:55:00",
    "average_checkout_time": "17:05:00",
    "late_checkins": 3,
    "early_checkouts": 2
  }
}
```

---

### 2.4 الحصول على حضور اليوم لجميع الموظفين (Today's Checkins)

**Endpoint:**
```
GET /api/method/hrms.hr.doctype.employee_checkin.employee_checkin_api.get_todays_checkins
```

**Parameters:**
```json
{
  "department": "Sales",  // اختياري
  "shift": "Morning Shift"  // اختياري
}
```

**Response Example:**
```json
{
  "message": [
    {
      "employee": "EMP-00001",
      "employee_name": "أحمد محمد",
      "checkin_time": "2026-02-10 09:00:00",
      "checkout_time": null,
      "status": "Checked In",
      "photo": "/files/checkin_001.jpg",
      "location": {
        "latitude": 24.7136,
        "longitude": 46.6753
      },
      "shift": "Morning Shift",
      "is_late": false
    },
    {
      "employee": "EMP-00002",
      "employee_name": "فاطمة علي",
      "checkin_time": "2026-02-10 08:55:00",
      "checkout_time": null,
      "status": "Checked In",
      "photo": "/files/checkin_002.jpg",
      "location": {
        "latitude": 24.7140,
        "longitude": 46.6760
      },
      "shift": "Morning Shift",
      "is_late": false
    }
  ]
}
```

---

### 2.5 حضور موظف مع الصور (Get Checkins with Photos)

**Endpoint:**
```
GET /api/resource/Employee Checkin
```

**Parameters:**
```json
{
  "filters": [
    ["employee", "=", "EMP-00001"],
    ["photo_image", "is", "set"],
    ["time", "between", ["2026-02-01 00:00:00", "2026-02-28 23:59:59"]]
  ],
  "fields": ["name", "employee_name", "time", "log_type", "photo_image", "latitude", "longitude"],
  "order_by": "time desc"
}
```

---

## <a name="apis-post"></a>3. APIs - إنشاء سجلات جديدة (POST)

### 3.1 تسجيل حضور بسيط (Simple Checkin)

**Endpoint:**
```
POST /api/resource/Employee Checkin
```

**Authentication:** Required

**Request Body:**
```json
{
  "employee": "EMP-00001",
  "time": "2026-02-10 09:00:00",
  "log_type": "IN",
  "device_id": "Mobile App"
}
```

**Response:**
```json
{
  "data": {
    "name": "EMP-CKIN-02-2026-000020",
    "employee": "EMP-00001",
    "time": "2026-02-10 09:00:00",
    "log_type": "IN",
    "device_id": "Mobile App"
  }
}
```

---

### 3.2 تسجيل حضور مع صورة (Checkin with Photo)

**الخطوة 1: رفع الصورة**

**Endpoint:**
```
POST /api/method/upload_file
```

**Content-Type:** `multipart/form-data`

**Form Data:**
```
file: [Binary Image Data]
is_private: 0
folder: "Home/Attachments"
```

**cURL Example:**
```bash
curl -X POST \
  'https://your-domain.com/api/method/upload_file' \
  -H 'Authorization: token api_key:api_secret' \
  -F 'file=@/path/to/selfie.jpg' \
  -F 'is_private=0' \
  -F 'folder=Home/Attachments'
```

**Response:**
```json
{
  "message": {
    "file_url": "/files/selfie_12345.jpg",
    "file_name": "selfie_12345.jpg"
  }
}
```

**الخطوة 2: إنشاء سجل الحضور**

**Endpoint:**
```
POST /api/resource/Employee Checkin
```

**Request Body:**
```json
{
  "employee": "EMP-00001",
  "time": "2026-02-10 09:00:00",
  "log_type": "IN",
  "device_id": "iPhone 14 Pro",
  "checkin_method": "Photo",
  "photo_image": "/files/selfie_12345.jpg",
  "latitude": 24.7136,
  "longitude": 46.6753
}
```

---

### 3.3 تسجيل حضور مع التحقق البيومتري (Checkin with Biometric)

**Endpoint:**
```
POST /api/resource/Employee Checkin
```

**Request Body:**
```json
{
  "employee": "EMP-00001",
  "time": "2026-02-10 09:00:00",
  "log_type": "IN",
  "device_id": "iPhone 14 Pro",
  "checkin_method": "Photo + Biometric",
  "photo_image": "/files/selfie_12345.jpg",
  "biometric_verified": 1,
  "biometric_type": "Face ID",
  "latitude": 24.7136,
  "longitude": 46.6753
}
```

---

### 3.4 تسجيل حضور عبر كود الموظف (Add Log by Employee Field)

**Endpoint:**
```
POST /api/method/hrms.hr.doctype.employee_checkin.employee_checkin.add_log_based_on_employee_field
```

**Request Body:**
```json
{
  "employee_field_value": "ATT-001",
  "timestamp": "2026-02-10 09:00:00",
  "device_id": "Attendance Device 1",
  "log_type": "IN",
  "skip_auto_attendance": 0,
  "employee_fieldname": "attendance_device_id",
  "latitude": 24.7136,
  "longitude": 46.6753
}
```

**Parameters:**
- `employee_field_value`: قيمة الحقل في Employee DocType
- `employee_fieldname`: اسم الحقل (افتراضي: attendance_device_id)
- `timestamp`: وقت التسجيل
- `device_id`: معرف الجهاز (اختياري)
- `log_type`: IN أو OUT (اختياري)
- `latitude`, `longitude`: الموقع (اختياري)

---

### 3.5 تسجيل حضور متعدد (Bulk Checkin Creation)

**Endpoint:**
```
POST /api/method/hrms.hr.doctype.employee_checkin.employee_checkin_api.bulk_create_checkins
```

**Request Body:**
```json
{
  "checkins": [
    {
      "employee": "EMP-00001",
      "time": "2026-02-10 09:00:00",
      "log_type": "IN",
      "latitude": 24.7136,
      "longitude": 46.6753
    },
    {
      "employee": "EMP-00002",
      "time": "2026-02-10 09:05:00",
      "log_type": "IN",
      "latitude": 24.7140,
      "longitude": 46.6760
    },
    {
      "employee": "EMP-00003",
      "time": "2026-02-10 09:10:00",
      "log_type": "IN",
      "latitude": 24.7145,
      "longitude": 46.6765
    }
  ]
}
```

**Response:**
```json
{
  "message": {
    "success": 3,
    "failed": 0,
    "created": [
      "EMP-CKIN-02-2026-000021",
      "EMP-CKIN-02-2026-000022",
      "EMP-CKIN-02-2026-000023"
    ],
    "errors": []
  }
}
```

---

## <a name="apis-put"></a>4. APIs - تحديث السجلات (PUT)

### 4.1 تحديث سجل حضور (Update Checkin)

**Endpoint:**
```
PUT /api/resource/Employee Checkin/{name}
```

**Request Body:**
```json
{
  "log_type": "OUT",
  "device_id": "Updated Device ID"
}
```

**ملاحظة مهمة:** 
- لا يمكن تعديل حقل `time` إذا كان السجل مرتبطاً بـ Attendance
- لا يمكن تعديل `employee` بعد الإنشاء

---

### 4.2 تحديث الموقع الجغرافي (Update Geolocation)

**Endpoint:**
```
PUT /api/resource/Employee Checkin/{name}
```

**Request Body:**
```json
{
  "latitude": 24.7136,
  "longitude": 46.6753
}
```

الموقع على الخريطة (geolocation) يتم تحديثه تلقائياً عند حفظ السجل.

---

### 4.3 ربط صورة بسجل موجود (Attach Photo to Existing Checkin)

**Endpoint:**
```
PUT /api/resource/Employee Checkin/{name}
```

**Request Body:**
```json
{
  "photo_image": "/files/new_photo.jpg",
  "checkin_method": "Photo"
}
```

---

### 4.4 تحديث الوردية يدوياً (Manual Shift Update)

**Endpoint:**
```
POST /api/method/hrms.hr.doctype.employee_checkin.employee_checkin.bulk_fetch_shift
```

**Request Body:**
```json
{
  "checkins": ["EMP-CKIN-02-2026-000021", "EMP-CKIN-02-2026-000022"]
}
```

هذا سيقوم بجلب الوردية المناسبة لكل سجل بناءً على الوقت والموظف.

---

## <a name="apis-delete"></a>5. APIs - الحذف (DELETE)

### 5.1 حذف سجل حضور (Delete Checkin)

**Endpoint:**
```
DELETE /api/resource/Employee Checkin/{name}
```

**ملاحظة:** 
- يجب أن يكون المستخدم لديه صلاحية الحذف
- إذا كان السجل مرتبطاً بـ Attendance، قد يفشل الحذف

---

## <a name="location-tracking-apis"></a>6. APIs - تتبع الموقع (Location Tracking)

### 6.1 حفظ موقع الموظف (Save Employee Location)

**Endpoint:**
```
POST /api/method/hrms.hr.doctype.employee_location_log.location_api.save_location
```

**Request Body:**
```json
{
  "employee": "EMP-00001",
  "latitude": 24.7136,
  "longitude": 46.6753,
  "accuracy": 10,
  "notes": "في الموقع",
  "checkin": "EMP-CKIN-02-2026-000021"
}
```

**Response:**
```json
{
  "message": {
    "success": true,
    "name": "EMP-LOC-00001"
  }
}
```

---

### 6.2 بدء تتبع الموقع عند الحضور (Start Location Tracking)

**Endpoint:**
```
POST /api/method/hrms.hr.doctype.employee_location_log.location_api.start_tracking_for_checkin
```

**Request Body:**
```json
{
  "employee": "EMP-00001",
  "checkin": "EMP-CKIN-02-2026-000021"
}
```

**Response:**
```json
{
  "message": {
    "success": true,
    "tracking_enabled": true,
    "employee_consent": true,
    "interval_ms": 60000,
    "checkin": "EMP-CKIN-02-2026-000021"
  }
}
```

---

### 6.3 الحصول على مواقع الموظف (Get Employee Locations)

**Endpoint:**
```
GET /api/method/hrms.hr.doctype.employee_location_log.location_api.get_employee_locations
```

**Parameters:**
```json
{
  "employee": "EMP-00001",
  "date": "2026-02-10"
}
```

أو للفترة الزمنية:
```json
{
  "employee": "EMP-00001",
  "from_date": "2026-02-01",
  "to_date": "2026-02-28"
}
```

**Response:**
```json
{
  "message": [
    {
      "name": "EMP-LOC-00001",
      "log_datetime": "2026-02-10 09:00:00",
      "latitude": 24.7136,
      "longitude": 46.6753,
      "accuracy": 10,
      "address": "شارع الملك فهد، الرياض",
      "notes": "في الموقع"
    },
    {
      "name": "EMP-LOC-00002",
      "log_datetime": "2026-02-10 09:15:00",
      "latitude": 24.7138,
      "longitude": 46.6755,
      "accuracy": 8,
      "address": "شارع الملك فهد، الرياض",
      "notes": null
    }
  ]
}
```

---

### 6.4 إعدادات تتبع الموقع (Get Tracking Settings)

**Endpoint:**
```
GET /api/method/hrms.hr.doctype.employee_location_log.location_api.get_tracking_settings
```

**Parameters:**
```json
{
  "employee": "EMP-00001"
}
```

**Response:**
```json
{
  "message": {
    "enable_tracking": 1,
    "interval_in_milliseconds": 60000,
    "employee_consent": 1
  }
}
```

---

## <a name="reports-apis"></a>7. APIs - التقارير والإحصائيات

### 7.1 تقرير حضور الموظفين التفصيلي

**Endpoint:**
```
GET /api/method/hrms.hr.report.employee_attendance_detail_report.employee_attendance_detail_report.execute
```

**Parameters:**
```json
{
  "filters": {
    "from_date": "2026-02-01",
    "to_date": "2026-02-28",
    "employee": "EMP-00001"
  }
}
```

---

### 7.2 تقرير تتبع موقع الموظفين

**Endpoint:**
```
GET /api/method/hrms.hr.report.employee_location_tracking_report.employee_location_tracking_report.execute
```

**Parameters:**
```json
{
  "filters": {
    "from_date": "2026-02-01",
    "to_date": "2026-02-28",
    "employee": "EMP-00001"
  }
}
```

---

### 7.3 إحصائيات الحضور حسب الوردية

**Endpoint:**
```
GET /api/method/hrms.hr.report.shift_attendance.shift_attendance.execute
```

**Parameters:**
```json
{
  "filters": {
    "from_date": "2026-02-01",
    "to_date": "2026-02-28",
    "shift": "Morning Shift"
  }
}
```

---

## <a name="examples"></a>8. أمثلة عملية

### مثال 1: تسجيل حضور موظف عبر تطبيق الموبايل (كامل)

```javascript
// الخطوة 1: رفع الصورة
const uploadPhoto = async (imageBlob) => {
  const formData = new FormData();
  formData.append('file', imageBlob, 'checkin.jpg');
  formData.append('is_private', '0');
  
  const response = await fetch('https://your-domain.com/api/method/upload_file', {
    method: 'POST',
    headers: {
      'Authorization': 'token api_key:api_secret'
    },
    body: formData
  });
  
  const data = await response.json();
  return data.message.file_url;
};

// الخطوة 2: الحصول على الموقع
const getLocation = () => {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy
        });
      },
      (error) => reject(error)
    );
  });
};

// الخطوة 3: تسجيل الحضور
const checkin = async (employee, photoBlob) => {
  try {
    // رفع الصورة
    const photoUrl = await uploadPhoto(photoBlob);
    
    // الحصول على الموقع
    const location = await getLocation();
    
    // إنشاء سجل الحضور
    const response = await fetch('https://your-domain.com/api/resource/Employee%20Checkin', {
      method: 'POST',
      headers: {
        'Authorization': 'token api_key:api_secret',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        employee: employee,
        time: new Date().toISOString().slice(0, 19).replace('T', ' '),
        log_type: 'IN',
        device_id: 'Mobile App - ' + navigator.platform,
        checkin_method: 'Photo + Biometric',
        photo_image: photoUrl,
        biometric_verified: 1,
        biometric_type: 'Face ID',
        latitude: location.latitude,
        longitude: location.longitude
      })
    });
    
    const data = await response.json();
    
    // بدء تتبع الموقع
    await startLocationTracking(employee, data.data.name);
    
    return data.data;
  } catch (error) {
    console.error('Checkin failed:', error);
    throw error;
  }
};

// الخطوة 4: بدء تتبع الموقع
const startLocationTracking = async (employee, checkinId) => {
  const response = await fetch('https://your-domain.com/api/method/hrms.hr.doctype.employee_location_log.location_api.start_tracking_for_checkin', {
    method: 'POST',
    headers: {
      'Authorization': 'token api_key:api_secret',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      employee: employee,
      checkin: checkinId
    })
  });
  
  const data = await response.json();
  
  if (data.message.tracking_enabled) {
    // بدء إرسال الموقع بشكل دوري
    const intervalMs = data.message.interval_ms || 60000;
    setInterval(() => {
      sendLocation(employee, checkinId);
    }, intervalMs);
  }
};

// إرسال الموقع
const sendLocation = async (employee, checkinId) => {
  const location = await getLocation();
  
  await fetch('https://your-domain.com/api/method/hrms.hr.doctype.employee_location_log.location_api.save_location', {
    method: 'POST',
    headers: {
      'Authorization': 'token api_key:api_secret',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      employee: employee,
      latitude: location.latitude,
      longitude: location.longitude,
      accuracy: location.accuracy,
      checkin: checkinId
    })
  });
};

// الاستخدام
checkin('EMP-00001', photoBlob);
```

---

### مثال 2: عرض حضور اليوم في لوحة التحكم

```python
import frappe
import requests
from datetime import datetime

def get_todays_attendance_dashboard():
    """
    الحصول على حضور اليوم لجميع الموظفين مع الصور والمواقع
    """
    today = datetime.now().strftime('%Y-%m-%d')
    
    # الحصول على جميع سجلات الحضور اليوم
    checkins = frappe.get_all(
        'Employee Checkin',
        filters={
            'time': ['between', [f'{today} 00:00:00', f'{today} 23:59:59']]
        },
        fields=[
            'name', 'employee', 'employee_name', 'time', 'log_type',
            'photo_image', 'latitude', 'longitude', 'shift',
            'biometric_verified', 'biometric_type'
        ],
        order_by='time desc'
    )
    
    # تنظيم البيانات حسب الموظف
    employees_data = {}
    
    for checkin in checkins:
        emp_id = checkin['employee']
        
        if emp_id not in employees_data:
            employees_data[emp_id] = {
                'employee': emp_id,
                'employee_name': checkin['employee_name'],
                'checkin': None,
                'checkout': None,
                'shift': checkin.get('shift'),
                'status': 'Not Checked In',
                'working_hours': 0,
                'last_location': None
            }
        
        if checkin['log_type'] == 'IN':
            employees_data[emp_id]['checkin'] = {
                'time': checkin['time'],
                'photo': checkin.get('photo_image'),
                'location': {
                    'latitude': checkin.get('latitude'),
                    'longitude': checkin.get('longitude')
                },
                'biometric_verified': checkin.get('biometric_verified')
            }
            employees_data[emp_id]['status'] = 'Checked In'
        
        elif checkin['log_type'] == 'OUT':
            employees_data[emp_id]['checkout'] = {
                'time': checkin['time'],
                'photo': checkin.get('photo_image'),
                'location': {
                    'latitude': checkin.get('latitude'),
                    'longitude': checkin.get('longitude')
                }
            }
            employees_data[emp_id]['status'] = 'Checked Out'
        
        # حساب ساعات العمل
        if employees_data[emp_id]['checkin'] and employees_data[emp_id]['checkout']:
            checkin_time = employees_data[emp_id]['checkin']['time']
            checkout_time = employees_data[emp_id]['checkout']['time']
            
            time_diff = (checkout_time - checkin_time).total_seconds() / 3600
            employees_data[emp_id]['working_hours'] = round(time_diff, 2)
    
    return list(employees_data.values())

# استخدام
dashboard_data = get_todays_attendance_dashboard()
print(f"Total employees: {len(dashboard_data)}")
for emp in dashboard_data:
    print(f"{emp['employee_name']}: {emp['status']}")
```

---

### مثال 3: تقرير حضور موظف مع عرض الصور على الخريطة

```python
import frappe
from datetime import datetime, timedelta

def get_employee_attendance_with_map(employee, from_date, to_date):
    """
    الحصول على حضور موظف مع المواقع والصور
    """
    checkins = frappe.get_all(
        'Employee Checkin',
        filters={
            'employee': employee,
            'time': ['between', [f'{from_date} 00:00:00', f'{to_date} 23:59:59']]
        },
        fields=[
            'name', 'time', 'log_type', 'photo_image',
            'latitude', 'longitude', 'shift', 'attendance',
            'biometric_verified', 'biometric_type', 'device_id'
        ],
        order_by='time asc'
    )
    
    # تنظيم البيانات حسب اليوم
    days_data = {}
    
    for checkin in checkins:
        date = checkin['time'].strftime('%Y-%m-%d')
        
        if date not in days_data:
            days_data[date] = {
                'date': date,
                'checkins': [],
                'locations': [],
                'total_hours': 0,
                'attendance': None
            }
        
        # إضافة بيانات الحضور
        days_data[date]['checkins'].append({
            'id': checkin['name'],
            'time': checkin['time'].strftime('%H:%M:%S'),
            'type': checkin['log_type'],
            'photo': checkin.get('photo_image'),
            'biometric': checkin.get('biometric_verified'),
            'device': checkin.get('device_id')
        })
        
        # إضافة الموقع على الخريطة
        if checkin.get('latitude') and checkin.get('longitude'):
            days_data[date]['locations'].append({
                'lat': checkin['latitude'],
                'lng': checkin['longitude'],
                'time': checkin['time'].strftime('%H:%M:%S'),
                'type': checkin['log_type'],
                'photo': checkin.get('photo_image')
            })
        
        # الحضور المرتبط
        if checkin.get('attendance'):
            days_data[date]['attendance'] = checkin['attendance']
    
    # حساب ساعات العمل لكل يوم
    for date, data in days_data.items():
        checkins = data['checkins']
        if len(checkins) >= 2:
            # البحث عن أول IN وآخر OUT
            in_times = [c for c in checkins if c['type'] == 'IN']
            out_times = [c for c in checkins if c['type'] == 'OUT']
            
            if in_times and out_times:
                first_in = datetime.strptime(f"{date} {in_times[0]['time']}", '%Y-%m-%d %H:%M:%S')
                last_out = datetime.strptime(f"{date} {out_times[-1]['time']}", '%Y-%m-%d %H:%M:%S')
                
                hours = (last_out - first_in).total_seconds() / 3600
                data['total_hours'] = round(hours, 2)
    
    return {
        'employee': employee,
        'from_date': from_date,
        'to_date': to_date,
        'days': list(days_data.values()),
        'total_days': len(days_data),
        'total_checkins': len(checkins)
    }

# استخدام
report_data = get_employee_attendance_with_map(
    'EMP-00001',
    '2026-02-01',
    '2026-02-28'
)

# عرض النتائج
for day in report_data['days']:
    print(f"\nDate: {day['date']}")
    print(f"Total Hours: {day['total_hours']}")
    print(f"Checkins: {len(day['checkins'])}")
    print(f"Locations: {len(day['locations'])}")
    
    for checkin in day['checkins']:
        print(f"  - {checkin['type']} at {checkin['time']}")
        if checkin['photo']:
            print(f"    Photo: {checkin['photo']}")
```

---

### مثال 4: API لعرض الصور في Dashboard

```javascript
// React Component للوحة تحكم الحضور
import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';

const AttendanceDashboard = () => {
  const [checkins, setCheckins] = useState([]);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    fetchTodaysCheckins();
  }, []);
  
  const fetchTodaysCheckins = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const response = await fetch(
        `https://your-domain.com/api/resource/Employee%20Checkin?` +
        `filters=[["time","between",["${today} 00:00:00","${today} 23:59:59"]]]&` +
        `fields=["name","employee","employee_name","time","log_type","photo_image","latitude","longitude"]&` +
        `order_by=time desc`,
        {
          headers: {
            'Authorization': 'token api_key:api_secret'
          }
        }
      );
      
      const data = await response.json();
      setCheckins(data.data);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching checkins:', error);
      setLoading(false);
    }
  };
  
  if (loading) return <div>Loading...</div>;
  
  return (
    <div className="attendance-dashboard">
      <h1>حضور اليوم</h1>
      
      {/* الخريطة */}
      <div className="map-container">
        <MapContainer center={[24.7136, 46.6753]} zoom={13} style={{ height: '400px' }}>
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; OpenStreetMap contributors'
          />
          {checkins.map(checkin => (
            checkin.latitude && checkin.longitude && (
              <Marker
                key={checkin.name}
                position={[checkin.latitude, checkin.longitude]}
              >
                <Popup>
                  <div>
                    <h3>{checkin.employee_name}</h3>
                    <p>{checkin.log_type} - {new Date(checkin.time).toLocaleTimeString('ar-SA')}</p>
                    {checkin.photo_image && (
                      <img 
                        src={`https://your-domain.com${checkin.photo_image}`} 
                        alt="Checkin Photo"
                        style={{ width: '100px', height: '100px', objectFit: 'cover' }}
                      />
                    )}
                  </div>
                </Popup>
              </Marker>
            )
          ))}
        </MapContainer>
      </div>
      
      {/* قائمة الحضور */}
      <div className="checkins-list">
        {checkins.map(checkin => (
          <div key={checkin.name} className="checkin-card">
            <div className="checkin-photo">
              {checkin.photo_image ? (
                <img 
                  src={`https://your-domain.com${checkin.photo_image}`} 
                  alt={checkin.employee_name}
                />
              ) : (
                <div className="no-photo">No Photo</div>
              )}
            </div>
            <div className="checkin-details">
              <h3>{checkin.employee_name}</h3>
              <p><strong>الموظف:</strong> {checkin.employee}</p>
              <p><strong>النوع:</strong> {checkin.log_type}</p>
              <p><strong>الوقت:</strong> {new Date(checkin.time).toLocaleString('ar-SA')}</p>
              {checkin.latitude && checkin.longitude && (
                <p><strong>الموقع:</strong> {checkin.latitude.toFixed(4)}, {checkin.longitude.toFixed(4)}</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default AttendanceDashboard;
```

---

## <a name="additional-info"></a>9. معلومات إضافية

### 9.1 الصلاحيات (Permissions)

الأدوار التي لها صلاحيات على Employee Checkin:

| الدور | قراءة | كتابة | إنشاء | حذف | استيراد | تصدير |
|------|------|------|------|------|--------|--------|
| System Manager | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| HR Manager | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| HR User | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Employee | ✓ | ✓ | ✓ | ✓ | - | - |

### 9.2 الإعدادات (Settings)

**HR Settings** للتحكم في الحضور:

1. **Allow Employee Checkin from Mobile App**: السماح بالحضور من التطبيق
2. **Allow Geolocation Tracking**: السماح بتتبع الموقع
3. **Max Checkin Radius**: نصف قطر الحضور المسموح (بالأمتار)

**الوصول للإعدادات:**
```
GET /api/resource/HR Settings
```

### 9.3 التحقق من صحة البيانات (Validation)

عند إنشاء سجل حضور، يتم التحقق من:

1. **الموظف نشط**: الموظف يجب أن يكون في حالة "Active"
2. **عدم التكرار**: لا يمكن إنشاء سجل مكرر لنفس الموظف في نفس الوقت
3. **المسافة من موقع العمل**: إذا كان enabled، يجب أن يكون الموظف ضمن النطاق المسموح
4. **الوقت**: لا يمكن تعديل الوقت إذا كان السجل مرتبط بـ Attendance

### 9.4 الربط التلقائي بالحضور (Auto-Attendance)

عند إنشاء سجلات Employee Checkin، يمكن أن يتم إنشاء Attendance تلقائياً بناءً على:

- **Shift Type Settings**: إعدادات الوردية
- **Working Hours**: ساعات العمل المطلوبة
- **Grace Period**: فترة السماح للتأخير

### 9.5 معالجة الأخطاء (Error Handling)

**أخطاء شائعة:**

| كود الخطأ | الوصف | الحل |
|-----------|-------|-----|
| 401 | غير مصرح | تحقق من API Key/Secret |
| 403 | لا توجد صلاحيات | تحقق من دور المستخدم |
| 404 | السجل غير موجود | تحقق من اسم السجل |
| 409 | سجل مكرر | سجل موجود بالفعل لنفس الوقت |
| 422 | بيانات غير صحيحة | تحقق من البيانات المرسلة |
| 500 | خطأ في الخادم | تحقق من السجلات (logs) |

**مثال على معالجة الأخطاء:**

```javascript
try {
  const response = await fetch(url, options);
  
  if (!response.ok) {
    const error = await response.json();
    
    switch (response.status) {
      case 401:
        console.error('Authentication failed');
        // إعادة تسجيل الدخول
        break;
      case 403:
        console.error('Permission denied');
        // إظهار رسالة للمستخدم
        break;
      case 409:
        console.error('Duplicate checkin:', error.message);
        // تخطي الإنشاء
        break;
      default:
        console.error('Error:', error);
    }
  }
  
  const data = await response.json();
  return data;
} catch (error) {
  console.error('Network error:', error);
  throw error;
}
```

### 9.6 الأداء والتحسينات (Performance)

**نصائح للأداء الأفضل:**

1. **استخدم filters محددة** لتقليل عدد السجلات المسترجعة
2. **حدد fields المطلوبة فقط** بدلاً من جلب جميع الحقول
3. **استخدم Pagination** للقوائم الطويلة (limit_start, limit_page_length)
4. **Cache الصور** في التطبيق لتقليل الطلبات
5. **استخدم Background Jobs** لتحديث العناوين من الـ GPS

### 9.7 الأمان (Security)

**أفضل الممارسات:**

1. **استخدم HTTPS** دائماً
2. **لا تشارك API Keys** في الكود المفتوح
3. **استخدم Token-based Authentication** بدلاً من Session
4. **قم بتحديث API Keys** بشكل دوري
5. **تحقق من الصلاحيات** على مستوى الـ API
6. **استخدم Rate Limiting** لمنع الإساءة

---

## Webhooks (Optional)

يمكن إنشاء Webhooks لإرسال إشعارات عند:

1. **إنشاء سجل حضور جديد**
2. **تحديث سجل حضور**
3. **حذف سجل حضور**

**إنشاء Webhook:**

```
POST /api/resource/Webhook
```

**Body:**
```json
{
  "webhook_doctype": "Employee Checkin",
  "webhook_docevent": "after_insert",
  "request_url": "https://your-webhook-url.com/checkin",
  "request_method": "POST",
  "enabled": 1
}
```

---

## الخلاصة

هذا التوثيق يغطي جميع جوانب نظام الحضور الإداري في HRMS. للمزيد من المعلومات:

- **ERPNext Documentation**: https://docs.erpnext.com
- **Frappe Framework**: https://frappeframework.com/docs
- **HRMS Module**: https://github.com/frappe/hrms

---

**ملاحظات:**
- جميع التواريخ والأوقات بصيغة: `YYYY-MM-DD HH:MM:SS`
- جميع الإحداثيات بنظام WGS84 (GPS)
- الصور يجب أن تكون بصيغة: JPG, PNG (حجم أقصى 5MB)
- API Rate Limit: 1000 طلب/ساعة (حسب الإعدادات)

**التحديث الأخير:** فبراير 2026
**الإصدار:** 1.0
