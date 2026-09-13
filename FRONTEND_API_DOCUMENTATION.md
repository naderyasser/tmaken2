# Backend API Documentation for Frontend Implementation

> **Complete guide for implementing HR features in your custom frontend design**

This document provides all backend API endpoints, structures, and examples for implementing:
1. ✅ **Creating user accounts for multiple employees (bulk/individual)**
2. ✅ **Location tracking with 100-meter radius geofencing & HR notifications**
3. ✅ **Employee reports download with unique ID filtering**

---

## 📋 Table of Contents
- [Authentication](#authentication)
- [1. Employee Account Creation](#1-employee-account-creation)
- [2. Location Tracking & Geofencing](#2-location-tracking--geofencing)
- [3. Employee Reports & Data Export](#3-employee-reports--data-export)
- [Data Structures](#data-structures)
- [Error Handling](#error-handling)

---

## 🔐 Authentication

All API calls require authentication. Include these headers:

```javascript
headers: {
  'Authorization': 'token <api_key>:<api_secret>',
  'Content-Type': 'application/json'
}
```

Or use cookies if calling from same domain after login.

---

## 1. Employee Account Creation

### 1.1 Create Single Employee with User Account

**Endpoint:** `POST /api/method/frappe.client.insert`

**Use Case:** Create one employee and automatically create their user account

```javascript
// Example: Create Employee with User Account
const response = await fetch('/api/method/frappe.client.insert', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'token <your_token>'
  },
  body: JSON.stringify({
    doc: {
      doctype: 'Employee',
      first_name: 'John',
      last_name: 'Doe',
      employee_name: 'John Doe',
      gender: 'Male',
      date_of_birth: '1990-05-15',
      date_of_joining: '2026-01-01',
      status: 'Active',
      company: 'Your Company',
      // User credentials (optional but creates user account)
      user_id: 'john.doe@company.com',  // This will create User automatically
      cell_number: '+1234567890',
      // Add department, designation as needed
      department: 'Sales',
      designation: 'Sales Executive'
    }
  })
});

const employee = await response.json();
console.log('Employee ID:', employee.message.name);  // e.g., "HR-EMP-00001"
```

**Response:**
```json
{
  "message": {
    "name": "HR-EMP-00001",
    "employee_name": "John Doe",
    "user_id": "john.doe@company.com",
    "status": "Active"
  }
}
```

### 1.2 Create User Account for Existing Employee

**Endpoint:** `POST /api/method/erpnext.setup.doctype.employee.employee.create_user`

**Use Case:** Employee exists but has no user account yet

```javascript
// Create user account for existing employee
const response = await fetch('/api/method/erpnext.setup.doctype.employee.employee.create_user', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    employee: 'HR-EMP-00001',
    email: 'john.doe@company.com'  // User will be created with this email
  })
});

const result = await response.json();
console.log('User created:', result.message);  // Returns user_id
```

**Backend Logic:**
- Automatically creates User document
- Links user to employee via `user_id` field
- Splits employee name into first/last name
- Copies phone, gender, DOB to user
- Sends welcome email (optional)

### 1.3 Bulk Create Employees with User Accounts

**Endpoint:** Multiple calls to `frappe.client.insert` OR use Data Import

**Option A: Loop through employees (for < 30 employees)**

```javascript
async function createMultipleEmployees(employeeList) {
  const results = [];
  
  for (const emp of employeeList) {
    try {
      const response = await fetch('/api/method/frappe.client.insert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          doc: {
            doctype: 'Employee',
            first_name: emp.first_name,
            last_name: emp.last_name,
            employee_name: `${emp.first_name} ${emp.last_name}`,
            gender: emp.gender,
            date_of_birth: emp.date_of_birth,
            date_of_joining: emp.date_of_joining,
            company: emp.company,
            status: 'Active',
            cell_number: emp.phone,
            // Create user account
            user_id: emp.email
          }
        })
      });
      
      const result = await response.json();
      
      // If you want to create user separately with password
      if (emp.password) {
        await createUserWithPassword(result.message.name, emp.email, emp.password);
      }
      
      results.push({ success: true, employee: result.message.name });
    } catch (error) {
      results.push({ success: false, error: error.message, data: emp });
    }
  }
  
  return results;
}

// Helper: Create user with custom password
async function createUserWithPassword(employee, email, password) {
  await fetch('/api/method/frappe.client.insert', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      doc: {
        doctype: 'User',
        email: email,
        first_name: employee.split(' ')[0],
        new_password: password,
        send_welcome_email: 0,
        roles: [{ role: 'Employee' }]
      }
    })
  });
}
```

**Option B: Use Data Import Tool (for bulk > 100 employees)**

```javascript
// 1. Upload CSV file
const formData = new FormData();
formData.append('file', csvFile);
formData.append('doctype', 'Employee');

const uploadResponse = await fetch('/api/method/frappe.core.api.file.upload_file', {
  method: 'POST',
  body: formData
});

// 2. Start import
await fetch('/api/method/frappe.core.doctype.data_import.data_import.start_import', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    data_import: 'DATA-IMP-2026-00001',
    import_type: 'Insert New Records'
  })
});
```

**CSV Format for Bulk Import:**
```csv
first_name,last_name,gender,date_of_birth,date_of_joining,company,user_id,cell_number,department,designation
John,Doe,Male,1990-01-15,2026-01-01,Company Name,john@company.com,+1234567890,Sales,Executive
Jane,Smith,Female,1992-05-20,2026-01-05,Company Name,jane@company.com,+1234567891,HR,Manager
```

---

## 2. Location Tracking & Geofencing

### 2.1 Enable Location Tracking for Employee

**Endpoint:** `POST /api/method/frappe.client.insert` (Create Employee Location Settings)

```javascript
// Enable tracking for employee
const response = await fetch('/api/method/frappe.client.insert', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    doc: {
      doctype: 'Employee Location Settings',
      employee: 'HR-EMP-00001',
      enable_tracking: 1,
      employee_consent: 1,  // Required for GDPR compliance
      tracking_interval: 'Minutes',  // Options: 'Instant', 'Seconds', 'Minutes', 'Hours'
      interval_number: 1  // Track every 1 minute
    }
  })
});
```

**Tracking Intervals:**
- `Instant`: Real-time (every 2 seconds)
- `Seconds`: Every X seconds (e.g., 30 seconds)
- `Minutes`: Every X minutes (e.g., 1 minute = 60000ms)
- `Hours`: Every X hours

### 2.2 Start Tracking After Check-In

**Endpoint:** `POST /api/method/hrms.hr.doctype.employee_location_log.location_api.start_tracking_for_checkin`

```javascript
// 1. Employee checks in
const checkinResponse = await fetch('/api/method/frappe.client.insert', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    doc: {
      doctype: 'Employee Checkin',
      employee: 'HR-EMP-00001',
      log_type: 'IN',
      time: new Date().toISOString().slice(0, 19).replace('T', ' '),
      latitude: 31.2344576,
      longitude: 30.0056576
    }
  })
});

const checkin = await checkinResponse.json();

// 2. Check if tracking is enabled and get settings
const trackingResponse = await fetch('/api/method/hrms.hr.doctype.employee_location_log.location_api.start_tracking_for_checkin', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    employee: 'HR-EMP-00001',
    checkin: checkin.message.name
  })
});

const trackingSettings = await trackingResponse.json();

if (trackingSettings.message.success && trackingSettings.message.tracking_enabled) {
  // Start tracking with interval_ms
  startLocationTracking(
    'HR-EMP-00001',
    checkin.message.name,
    trackingSettings.message.interval_ms  // e.g., 60000 for 1 minute
  );
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
    "checkin": "CHECKIN-00001"
  }
}
```

### 2.3 Save Location Periodically

**Endpoint:** `POST /api/method/hrms.hr.doctype.employee_location_log.location_api.save_location`

```javascript
// Call this at interval specified in interval_ms
function captureAndSaveLocation(employee, checkin) {
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const response = await fetch('/api/method/hrms.hr.doctype.employee_location_log.location_api.save_location', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            employee: employee,
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,  // GPS accuracy in meters
            checkin: checkin,
            notes: ''  // Optional notes
          })
        });
        
        const result = await response.json();
        if (result.message.success) {
          console.log('Location saved:', result.message.name);
        }
      },
      (error) => {
        console.error('GPS Error:', error);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      }
    );
  }
}

// Start continuous tracking
let trackingInterval;
function startLocationTracking(employee, checkin, intervalMs) {
  // Capture immediately
  captureAndSaveLocation(employee, checkin);
  
  // Then at intervals
  trackingInterval = setInterval(() => {
    captureAndSaveLocation(employee, checkin);
  }, intervalMs);
}

// Stop tracking on check-out
function stopLocationTracking() {
  if (trackingInterval) {
    clearInterval(trackingInterval);
    trackingInterval = null;
  }
}
```

**Response:**
```json
{
  "message": {
    "success": true,
    "name": "LOC-2026-00001"
  }
}
```

### 2.4 Geofencing: 100-Meter Radius Validation

**How it works:**
- Backend automatically validates distance when employee checks in
- If employee is > 100 meters from assigned location, validation fails
- HR is notified via system notification

**Check-In with Geofencing:**

```javascript
// Frontend just sends check-in with coordinates
// Backend validates automatically
const response = await fetch('/api/method/frappe.client.insert', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    doc: {
      doctype: 'Employee Checkin',
      employee: 'HR-EMP-00001',
      log_type: 'IN',
      time: new Date().toISOString().slice(0, 19).replace('T', ' '),
      latitude: 31.2344576,
      longitude: 30.0056576
    }
  })
});

// If outside radius, backend throws error:
// "You must be within 100 meters of your shift location to check in."
```

**Backend Configuration (Shift Location):**
- Navigate to: Shift Location doctype
- Set `checkin_radius`: 100 (meters)
- Set `latitude` and `longitude` for the work location
- When employee checks in, distance is calculated automatically

**Get Distance Validation Result:**

```javascript
// After check-in, check validation status
const checkin = await response.json();

if (checkin.exception) {
  // Employee was outside allowed radius
  alert('You are too far from work location. Please move closer.');
} else {
  // Check-in successful
  console.log('Checked in successfully:', checkin.message.name);
}
```

### 2.5 HR Notifications for Geofencing Violations

**How Notifications Work:**

1. **Automatic Notification on Violation:**
   - When employee checks in outside 100m radius
   - System creates notification for HR Manager
   - Notification includes: employee name, distance, location

2. **Get Notifications (HR Manager View):**

```javascript
// Get all notifications for HR Manager
const response = await fetch('/api/method/frappe.client.get_list', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    doctype: 'Notification Log',
    fields: ['name', 'subject', 'document_type', 'document_name', 'for_user', 'creation'],
    filters: [
      ['for_user', '=', 'hr.manager@company.com'],  // HR Manager's email
      ['read', '=', 0]  // Unread only
    ],
    order_by: 'creation desc',
    limit: 50
  })
});

const notifications = await response.json();

// Each notification contains:
// {
//   "name": "NLOG-00001",
//   "subject": "Employee Check-in Outside Allowed Radius",
//   "document_type": "Employee Checkin",
//   "document_name": "CHECKIN-00001",
//   "for_user": "hr.manager@company.com",
//   "creation": "2026-02-09 14:30:00"
// }
```

3. **Mark Notification as Read:**

```javascript
await fetch('/api/method/frappe.client.set_value', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    doctype: 'Notification Log',
    name: 'NLOG-00001',
    fieldname: 'read',
    value: 1
  })
});
```

### 2.6 Get Employee Location History

**Endpoint:** `POST /api/method/hrms.hr.doctype.employee_location_log.location_api.get_employee_locations`

```javascript
// Get locations for specific employee
const response = await fetch('/api/method/hrms.hr.doctype.employee_location_log.location_api.get_employee_locations', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    employee: 'HR-EMP-00001',
    date: '2026-02-09'  // Or use from_date and to_date for range
  })
});

const locations = await response.json();

// Response:
// [
//   {
//     "name": "LOC-2026-00001",
//     "log_datetime": "2026-02-09 10:00:00",
//     "latitude": 31.2344576,
//     "longitude": 30.0056576,
//     "accuracy": 15.5,
//     "address": "123 Main St, City, Country",
//     "notes": ""
//   }
// ]
```

**Display on Map:**

```javascript
// Using Google Maps
function displayEmployeeTrack(locations) {
  const map = new google.maps.Map(document.getElementById('map'), {
    center: { lat: locations[0].latitude, lng: locations[0].longitude },
    zoom: 13
  });
  
  const path = locations.map(loc => ({
    lat: parseFloat(loc.latitude),
    lng: parseFloat(loc.longitude)
  }));
  
  const polyline = new google.maps.Polyline({
    path: path,
    geodesic: true,
    strokeColor: '#FF0000',
    strokeOpacity: 1.0,
    strokeWeight: 2
  });
  
  polyline.setMap(map);
  
  // Add markers
  locations.forEach((loc, index) => {
    new google.maps.Marker({
      position: { lat: parseFloat(loc.latitude), lng: parseFloat(loc.longitude) },
      map: map,
      label: `${index + 1}`,
      title: loc.log_datetime
    });
  });
}
```

---

## 3. Employee Reports & Data Export

### 3.1 Get All Employees

**Endpoint:** `POST /api/method/frappe.client.get_list`

```javascript
// Get all active employees
const response = await fetch('/api/method/frappe.client.get_list', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    doctype: 'Employee',
    fields: [
      'name',  // Unique ID (e.g., "HR-EMP-00001")
      'employee_name',
      'first_name',
      'last_name',
      'gender',
      'date_of_birth',
      'date_of_joining',
      'user_id',
      'cell_number',
      'company',
      'department',
      'designation',
      'status'
    ],
    filters: [
      ['status', '=', 'Active']
    ],
    order_by: 'creation desc',
    limit_page_length: 1000  // Adjust as needed
  })
});

const employees = await response.json();
```

**Response:**
```json
{
  "message": [
    {
      "name": "HR-EMP-00001",
      "employee_name": "John Doe",
      "first_name": "John",
      "last_name": "Doe",
      "gender": "Male",
      "date_of_birth": "1990-01-15",
      "date_of_joining": "2026-01-01",
      "user_id": "john.doe@company.com",
      "cell_number": "+1234567890",
      "company": "Company Name",
      "department": "Sales",
      "designation": "Executive",
      "status": "Active"
    }
  ]
}
```

### 3.2 Get Single Employee by Unique ID

**Endpoint:** `POST /api/method/frappe.client.get`

```javascript
// Get employee by unique ID (name field)
const response = await fetch('/api/method/frappe.client.get', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    doctype: 'Employee',
    name: 'HR-EMP-00001'  // This is the unique ID
  })
});

const employee = await response.json();
```

### 3.3 Get Employee Attendance Report

**Endpoint:** `POST /api/method/frappe.client.get_list`

```javascript
// Get attendance for specific employee
const response = await fetch('/api/method/frappe.client.get_list', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    doctype: 'Attendance',
    fields: [
      'name',
      'employee',
      'employee_name',
      'attendance_date',
      'status',  // Present, Absent, Half Day, On Leave
      'shift',
      'in_time',
      'out_time',
      'working_hours'
    ],
    filters: [
      ['employee', '=', 'HR-EMP-00001'],
      ['attendance_date', 'between', ['2026-01-01', '2026-01-31']]
    ],
    order_by: 'attendance_date desc'
  })
});

const attendance = await response.json();
```

### 3.4 Get Employee Check-In/Check-Out Logs

```javascript
// Get check-in logs for employee
const response = await fetch('/api/method/frappe.client.get_list', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    doctype: 'Employee Checkin',
    fields: [
      'name',
      'employee',
      'employee_name',
      'log_type',  // IN or OUT
      'time',
      'latitude',
      'longitude',
      'shift'
    ],
    filters: [
      ['employee', '=', 'HR-EMP-00001'],
      ['time', 'between', ['2026-01-01 00:00:00', '2026-01-31 23:59:59']]
    ],
    order_by: 'time desc'
  })
});

const checkins = await response.json();
```

### 3.5 Download Employee Report (Excel/CSV)

**Method 1: Export via Report API**

```javascript
// Generate and download attendance report
async function downloadEmployeeReport(employeeId, fromDate, toDate, format = 'xlsx') {
  const response = await fetch('/api/method/frappe.desk.query_report.export_query', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      report_name: 'Monthly Attendance Sheet',
      file_format_type: format === 'xlsx' ? 'Excel' : 'CSV',
      filters: {
        employee: employeeId,
        month: fromDate.split('-')[1],
        year: fromDate.split('-')[0],
        company: 'Your Company'
      },
      include_filters: 1
    })
  });
  
  // This returns binary data - download as file
  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `employee_${employeeId}_report.${format}`;
  a.click();
}
```

**Method 2: Generate Custom Report**

```javascript
async function generateCustomEmployeeReport(employeeId) {
  // 1. Fetch all data
  const employee = await getEmployee(employeeId);
  const attendance = await getAttendance(employeeId);
  const checkins = await getCheckins(employeeId);
  const locations = await getLocations(employeeId);
  
  // 2. Format as needed
  const reportData = {
    employee_id: employee.name,
    employee_name: employee.employee_name,
    department: employee.department,
    attendance_records: attendance.message,
    checkin_logs: checkins.message,
    location_track: locations.message
  };
  
  // 3. Convert to Excel using library (e.g., xlsx.js)
  const XLSX = require('xlsx');
  const workbook = XLSX.utils.book_new();
  
  // Sheet 1: Employee Info
  const infoSheet = XLSX.utils.json_to_sheet([{
    'Employee ID': employee.name,
    'Name': employee.employee_name,
    'Department': employee.department,
    'Designation': employee.designation,
    'Joining Date': employee.date_of_joining
  }]);
  XLSX.utils.book_append_sheet(workbook, infoSheet, 'Employee Info');
  
  // Sheet 2: Attendance
  const attendanceSheet = XLSX.utils.json_to_sheet(attendance.message);
  XLSX.utils.book_append_sheet(workbook, attendanceSheet, 'Attendance');
  
  // Sheet 3: Location Logs
  const locationsSheet = XLSX.utils.json_to_sheet(locations.message);
  XLSX.utils.book_append_sheet(workbook, locationsSheet, 'Location Track');
  
  // Download
  XLSX.writeFile(workbook, `employee_${employeeId}_full_report.xlsx`);
}
```

### 3.6 Filter Employees by Unique ID

```javascript
// Search employees by ID pattern
const response = await fetch('/api/method/frappe.client.get_list', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    doctype: 'Employee',
    fields: ['name', 'employee_name', 'department'],
    filters: [
      ['name', 'like', '%EMP-00001%']  // Search for specific ID pattern
    ]
  })
});
```

**Advanced Search:**

```javascript
// Multi-criteria search
async function searchEmployees(criteria) {
  const filters = [];
  
  if (criteria.employee_id) {
    filters.push(['name', '=', criteria.employee_id]);
  }
  if (criteria.email) {
    filters.push(['user_id', '=', criteria.email]);
  }
  if (criteria.phone) {
    filters.push(['cell_number', 'like', `%${criteria.phone}%`]);
  }
  if (criteria.department) {
    filters.push(['department', '=', criteria.department]);
  }
  
  const response = await fetch('/api/method/frappe.client.get_list', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      doctype: 'Employee',
      fields: ['name', 'employee_name', 'user_id', 'cell_number', 'department'],
      filters: filters,
      limit_page_length: 100
    })
  });
  
  return await response.json();
}
```

### 3.7 Get Reports for All Employees

```javascript
// Comprehensive report for all employees
async function getAllEmployeesReport() {
  const employees = await fetch('/api/method/frappe.client.get_list', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      doctype: 'Employee',
      fields: ['name', 'employee_name', 'user_id', 'department', 'status'],
      filters: [['status', '=', 'Active']],
      limit_page_length: 0  // No limit
    })
  });
  
  const employeeList = (await employees.json()).message;
  
  // Get attendance summary for each
  const reports = await Promise.all(
    employeeList.map(async (emp) => {
      const attendance = await fetch('/api/method/frappe.client.get_count', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          doctype: 'Attendance',
          filters: [
            ['employee', '=', emp.name],
            ['attendance_date', '>=', '2026-01-01'],
            ['status', '=', 'Present']
          ]
        })
      });
      
      const presentDays = (await attendance.json()).message;
      
      return {
        employee_id: emp.name,
        employee_name: emp.employee_name,
        email: emp.user_id,
        department: emp.department,
        present_days: presentDays
      };
    })
  );
  
  return reports;
}
```

---

## Data Structures

### Employee Document Structure

```typescript
interface Employee {
  name: string;              // Unique ID: "HR-EMP-00001"
  employee_name: string;     // Full name
  first_name: string;
  middle_name?: string;
  last_name: string;
  gender: 'Male' | 'Female' | 'Other';
  date_of_birth: string;     // Format: "YYYY-MM-DD"
  date_of_joining: string;
  relieving_date?: string;
  status: 'Active' | 'Inactive' | 'Left';
  
  // Contact
  user_id?: string;          // Email/User account
  cell_number?: string;
  personal_email?: string;
  company_email?: string;
  
  // Work Details
  company: string;
  department?: string;
  designation?: string;
  branch?: string;
  reports_to?: string;       // Manager's Employee ID
  
  // Location
  current_location_lat?: string;
  current_location_lng?: string;
}
```

### Employee Location Log Structure

```typescript
interface EmployeeLocationLog {
  name: string;              // "LOC-2026-00001"
  employee: string;          // Employee ID
  log_datetime: string;      // "2026-02-09 14:30:00"
  latitude: string;
  longitude: string;
  accuracy?: number;         // GPS accuracy in meters
  address?: string;          // Auto-populated via geocoding
  notes?: string;
  employee_checkin?: string; // Linked check-in ID
  attendance?: string;       // Linked attendance ID
}
```

### Employee Checkin Structure

```typescript
interface EmployeeCheckin {
  name: string;              // "CHECKIN-00001"
  employee: string;          // Employee ID
  log_type: 'IN' | 'OUT';
  time: string;              // "2026-02-09 09:00:00"
  latitude?: string;
  longitude?: string;
  shift?: string;
  attendance?: string;       // Auto-linked attendance
}
```

### Attendance Structure

```typescript
interface Attendance {
  name: string;              // "ATT-2026-00001"
  employee: string;          // Employee ID
  employee_name: string;
  attendance_date: string;   // "2026-02-09"
  status: 'Present' | 'Absent' | 'Half Day' | 'On Leave' | 'Work From Home';
  shift?: string;
  in_time?: string;
  out_time?: string;
  working_hours?: number;
  late_entry?: boolean;
  early_exit?: boolean;
}
```

---

## Error Handling

### Common Error Responses

```javascript
// 1. Permission Error
{
  "exception": "frappe.exceptions.PermissionError",
  "exc_type": "PermissionError",
  "message": "You do not have permission to access this resource"
}

// 2. Validation Error (e.g., outside geofence)
{
  "exception": "frappe.exceptions.ValidationError",
  "exc_type": "ValidationError",
  "message": "You must be within 100 meters of your shift location to check in."
}

// 3. Duplicate Entry
{
  "exception": "frappe.exceptions.DuplicateEntryError",
  "message": "User with email already exists"
}

// 4. Invalid Data
{
  "exception": "frappe.exceptions.MandatoryError",
  "message": "Mandatory field missing: employee_name"
}
```

### Error Handling Template

```javascript
async function handleAPICall(url, data) {
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    
    const result = await response.json();
    
    // Check for errors
    if (result.exception || result.exc_type) {
      throw new Error(result.message || 'An error occurred');
    }
    
    return result;
  } catch (error) {
    console.error('API Error:', error);
    
    // Show user-friendly message
    if (error.message.includes('permission')) {
      alert('You do not have permission to perform this action');
    } else if (error.message.includes('meters')) {
      alert('You are too far from the work location');
    } else {
      alert(`Error: ${error.message}`);
    }
    
    throw error;
  }
}
```

---

## Complete Frontend Implementation Example

### Full Employee Management Dashboard

```html
<!DOCTYPE html>
<html>
<head>
  <title>HR Dashboard</title>
  <script src="https://maps.googleapis.com/maps/api/js?key=YOUR_API_KEY"></script>
</head>
<body>
  <div id="app">
    <!-- 1. Create Employees -->
    <section id="create-employee">
      <h2>Create Employee</h2>
      <form id="employee-form">
        <input name="first_name" placeholder="First Name" required>
        <input name="last_name" placeholder="Last Name" required>
        <input name="email" type="email" placeholder="Email" required>
        <input name="phone" placeholder="Phone">
        <input name="password" type="password" placeholder="Password">
        <select name="gender">
          <option value="Male">Male</option>
          <option value="Female">Female</option>
        </select>
        <input name="date_of_birth" type="date" required>
        <input name="date_of_joining" type="date" required>
        <button type="submit">Create Employee</button>
      </form>
    </section>

    <!-- 2. Location Tracking -->
    <section id="tracking">
      <h2>Location Tracking</h2>
      <select id="employee-select"></select>
      <button id="start-tracking">Start Tracking</button>
      <button id="stop-tracking">Stop Tracking</button>
      <div id="map" style="width: 100%; height: 400px;"></div>
    </section>

    <!-- 3. Reports -->
    <section id="reports">
      <h2>Employee Reports</h2>
      <input id="search-employee" placeholder="Search by ID or Name">
      <button id="download-report">Download Report</button>
      <table id="employee-table"></table>
    </section>
  </div>

  <script>
    const API_BASE = '/api/method';
    let trackingInterval;

    // 1. Create Employee
    document.getElementById('employee-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const formData = new FormData(e.target);
      const data = Object.fromEntries(formData);

      try {
        // Create employee
        const response = await fetch(`${API_BASE}/frappe.client.insert`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            doc: {
              doctype: 'Employee',
              first_name: data.first_name,
              last_name: data.last_name,
              employee_name: `${data.first_name} ${data.last_name}`,
              gender: data.gender,
              date_of_birth: data.date_of_birth,
              date_of_joining: data.date_of_joining,
              cell_number: data.phone,
              company: 'Default Company',
              status: 'Active'
            }
          })
        });

        const employee = await response.json();

        // Create user account
        if (data.email && data.password) {
          await fetch(`${API_BASE}/frappe.client.insert`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              doc: {
                doctype: 'User',
                email: data.email,
                first_name: data.first_name,
                new_password: data.password,
                send_welcome_email: 0,
                roles: [{ role: 'Employee' }]
              }
            })
          });

          // Link user to employee
          await fetch(`${API_BASE}/frappe.client.set_value`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              doctype: 'Employee',
              name: employee.message.name,
              fieldname: 'user_id',
              value: data.email
            })
          });
        }

        alert(`Employee created: ${employee.message.name}`);
        e.target.reset();
        loadEmployees();
      } catch (error) {
        alert(`Error: ${error.message}`);
      }
    });

    // 2. Location Tracking
    document.getElementById('start-tracking').addEventListener('click', async () => {
      const employeeId = document.getElementById('employee-select').value;

      // Check-in
      const checkinResponse = await fetch(`${API_BASE}/frappe.client.insert`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          doc: {
            doctype: 'Employee Checkin',
            employee: employeeId,
            log_type: 'IN',
            time: new Date().toISOString().slice(0, 19).replace('T', ' ')
          }
        })
      });

      const checkin = await checkinResponse.json();

      // Start tracking
      const trackingSettings = await fetch(`${API_BASE}/hrms.hr.doctype.employee_location_log.location_api.start_tracking_for_checkin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employee: employeeId,
          checkin: checkin.message.name
        })
      });

      const settings = await trackingSettings.json();

      if (settings.message.success) {
        trackingInterval = setInterval(() => {
          captureLocation(employeeId, checkin.message.name);
        }, settings.message.interval_ms);
        alert('Tracking started');
      }
    });

    function captureLocation(employee, checkin) {
      navigator.geolocation.getCurrentPosition(async (position) => {
        await fetch(`${API_BASE}/hrms.hr.doctype.employee_location_log.location_api.save_location`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            employee: employee,
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
            checkin: checkin
          })
        });
      });
    }

    // 3. Load Employees
    async function loadEmployees() {
      const response = await fetch(`${API_BASE}/frappe.client.get_list`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          doctype: 'Employee',
          fields: ['name', 'employee_name', 'user_id', 'department'],
          filters: [['status', '=', 'Active']],
          limit_page_length: 100
        })
      });

      const employees = await response.json();
      
      // Populate select
      const select = document.getElementById('employee-select');
      select.innerHTML = employees.message.map(emp => 
        `<option value="${emp.name}">${emp.employee_name} (${emp.name})</option>`
      ).join('');
    }

    // Load employees on page load
    loadEmployees();
  </script>
</body>
</html>
```

---

## Quick Reference

### Key Endpoints Summary

| Feature | Endpoint | Method |
|---------|----------|--------|
| Create Employee | `/api/method/frappe.client.insert` | POST |
| Create User for Employee | `/api/method/erpnext.setup.doctype.employee.employee.create_user` | POST |
| Get Employee List | `/api/method/frappe.client.get_list` | POST |
| Get Single Employee | `/api/method/frappe.client.get` | POST |
| Start Location Tracking | `/api/method/hrms.hr.doctype.employee_location_log.location_api.start_tracking_for_checkin` | POST |
| Save Location | `/api/method/hrms.hr.doctype.employee_location_log.location_api.save_location` | POST |
| Get Location History | `/api/method/hrms.hr.doctype.employee_location_log.location_api.get_employee_locations` | POST |
| Get Attendance | `/api/method/frappe.client.get_list` (doctype: Attendance) | POST |
| Export Report | `/api/method/frappe.desk.query_report.export_query` | POST |

### Important Notes

1. **Employee Unique ID**: Always use the `name` field (e.g., "HR-EMP-00001")
2. **Geofencing**: Set `checkin_radius` in Shift Location (default: 100 meters)
3. **Tracking Consent**: Always get `employee_consent = 1` before tracking
4. **Location Accuracy**: GPS accuracy typically 5-50 meters; < 100m is good
5. **Notifications**: HR Managers automatically notified on geofence violations
6. **Reports**: Can filter by date range, employee ID, department, etc.

---

## Support & Questions

If you need clarification on any endpoint or feature, check:
- DocType definitions in `/apps/hrms/hrms/hr/doctype/`
- API file: `/apps/hrms/hrms/hr/doctype/employee_location_log/location_api.py`
- Test files for usage examples

**Contact:** Development Team
**Last Updated:** February 9, 2026
