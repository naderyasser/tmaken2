# HR Attendance Manager APIs

Complete API documentation for HR Manager attendance system.

---

## 1. Dashboard Overview APIs

### 1.1 Get Today's Summary

**Endpoint:** `GET /api/method/frappe.client.get_list`

**Query Parameters:**
```
doctype=Attendance
&fields=["status","late_entry","early_exit","employee"]
&filters=[["attendance_date","=","2026-02-10"],["docstatus","=",1]]
```

**Response:**
```json
{
  "message": [
    {
      "name": "ATT-001",
      "status": "Present",
      "late_entry": 0,
      "early_exit": 0,
      "employee": "HR-EMP-00001"
    },
    {
      "name": "ATT-002",
      "status": "Present",
      "late_entry": 1,
      "early_exit": 0,
      "employee": "HR-EMP-00002"
    }
  ]
}
```

**Process client-side to get:**
- Total present count
- Total absent count
- Late entries count
- Early exits count

---

### 1.2 Get Live Employee Status

**Endpoint:** `GET /api/method/frappe.client.get_list`

**Query Parameters:**
```
doctype=Employee Checkin
&fields=["employee","employee_name","log_type","time","shift"]
&filters=[["time",">=","2026-02-10 00:00:00"],["time","<=","2026-02-10 23:59:59"]]
&order_by=time desc
&limit_page_length=500
```

**Response:**
```json
{
  "message": [
    {
      "name": "EMP-CHECKIN-001",
      "employee": "HR-EMP-00001",
      "employee_name": "Ahmed Ali",
      "log_type": "IN",
      "time": "2026-02-10 09:05:00",
      "shift": "Day Shift"
    },
    {
      "name": "EMP-CHECKIN-002",
      "employee": "HR-EMP-00001",
      "log_type": "OUT",
      "time": "2026-02-10 17:30:00",
      "shift": "Day Shift"
    }
  ]
}
```

**Process client-side:**
- Group by employee
- Determine status: IN/OUT/Not Checked In
- Calculate working hours for active sessions

---

### 1.3 Get All Employees List

**Endpoint:** `GET /api/method/frappe.client.get_list`

**Query Parameters:**
```
doctype=Employee
&fields=["name","employee_name","department","designation","status"]
&filters=[["status","=","Active"]]
&order_by=employee_name
&limit_page_length=0
```

**Response:**
```json
{
  "message": [
    {
      "name": "HR-EMP-00001",
      "employee_name": "Ahmed Ali",
      "department": "Sales",
      "designation": "Sales Executive",
      "status": "Active"
    }
  ]
}
```

---

### 1.4 Get Employees Without Today's Checkin

Combine results from 1.2 and 1.3 client-side to find employees with no check-in today.

---

## 2. Employee Details APIs

### 2.1 Get Employee Attendance Record for Today

**Endpoint:** `GET /api/method/frappe.client.get_list`

**Query Parameters:**
```
doctype=Attendance
&fields=["name","status","working_hours","in_time","out_time","late_entry","early_exit","shift"]
&filters=[["employee","=","HR-EMP-00001"],["attendance_date","=","2026-02-10"]]
```

**Response:**
```json
{
  "message": [
    {
      "name": "ATT-001",
      "status": "Present",
      "working_hours": 8.5,
      "in_time": "2026-02-10 09:05:00",
      "out_time": "2026-02-10 17:35:00",
      "late_entry": 0,
      "early_exit": 0,
      "shift": "Day Shift"
    }
  ]
}
```

---

### 2.2 Get Employee Monthly Summary

**Endpoint:** `GET /api/method/frappe.client.get_list`

**Query Parameters:**
```
doctype=Attendance
&fields=["status","working_hours","late_entry","early_exit","attendance_date"]
&filters=[["employee","=","HR-EMP-00001"],["attendance_date","between",["2026-02-01","2026-02-28"]],["docstatus","=",1]]
&order_by=attendance_date desc
```

**Response:**
```json
{
  "message": [
    {
      "name": "ATT-001",
      "status": "Present",
      "working_hours": 8.5,
      "late_entry": 0,
      "early_exit": 0,
      "attendance_date": "2026-02-10"
    },
    {
      "name": "ATT-002",
      "status": "Present",
      "working_hours": 9.2,
      "late_entry": 1,
      "early_exit": 0,
      "attendance_date": "2026-02-09"
    }
  ]
}
```

**Calculate client-side:**
- Total present days
- Total absent days
- Total late entries
- Total early exits
- Total working hours
- Average hours per day
- Attendance rate %

---

### 2.3 Get Employee Checkin History

**Endpoint:** `GET /api/method/frappe.client.get_list`

**Query Parameters:**
```
doctype=Employee Checkin
&fields=["employee","employee_name","log_type","time","latitude","longitude","checkin_method"]
&filters=[["employee","=","HR-EMP-00001"],["time","between",["2026-02-01 00:00:00","2026-02-28 23:59:59"]]]
&order_by=time desc
&limit_page_length=100
```

**Response:**
```json
{
  "message": [
    {
      "name": "EMP-CHECKIN-001",
      "employee": "HR-EMP-00001",
      "employee_name": "Ahmed Ali",
      "log_type": "IN",
      "time": "2026-02-10 09:05:00",
      "latitude": 24.7136,
      "longitude": 46.6753,
      "checkin_method": "Photo"
    }
  ]
}
```

---

## 3. Attendance Management APIs

### 3.1 Create Attendance (Manual)

**Endpoint:** `POST /api/method/frappe.client.insert`

**Request Body:**
```json
{
  "doctype": "Attendance",
  "employee": "HR-EMP-00001",
  "attendance_date": "2026-02-10",
  "status": "Present",
  "company": "Your Company",
  "shift": "Day Shift"
}
```

**Response:**
```json
{
  "data": {
    "name": "ATT-001",
    "employee": "HR-EMP-00001",
    "status": "Present",
    "docstatus": 0
  }
}
```

**Then Submit:**
```
POST /api/method/frappe.client.submit
```

**Request Body:**
```json
{
  "doc": {
    "doctype": "Attendance",
    "name": "ATT-001"
  }
}
```

---

### 3.2 Update Attendance

**Endpoint:** `PUT /api/method/frappe.client.set_value`

**Request Body:**
```json
{
  "doctype": "Attendance",
  "name": "ATT-001",
  "fieldname": "status",
  "value": "Absent"
}
```

**For multiple fields:**

**Endpoint:** `PUT /api/method/frappe.client.set_value`

**Request Body:**
```json
{
  "doctype": "Attendance",
  "name": "ATT-001",
  "fieldname": {
    "status": "Present",
    "late_entry": 1,
    "early_exit": 0
  }
}
```

---

### 3.3 Mark Attendance with Details

**Endpoint:** `POST /api/method/frappe.client.insert`

**Request Body:**
```json
{
  "doctype": "Attendance",
  "employee": "HR-EMP-00001",
  "attendance_date": "2026-02-10",
  "status": "Present",
  "company": "Your Company",
  "shift": "Day Shift",
  "in_time": "2026-02-10 09:05:00",
  "out_time": "2026-02-10 17:30:00",
  "working_hours": 8.4,
  "late_entry": 0,
  "early_exit": 0
}
```

---

### 3.4 Bulk Mark Attendance

**Endpoint:** `POST /api/method/hrms.hr.doctype.employee_attendance_tool.employee_attendance_tool.mark_employee_attendance`

**Request Body:**
```json
{
  "employee_list": ["HR-EMP-00001", "HR-EMP-00002", "HR-EMP-00003"],
  "status": "Present",
  "date": "2026-02-10",
  "company": "Your Company",
  "shift": "Day Shift"
}
```

**Response:**
```json
{
  "message": "Attendance marked successfully"
}
```

---

### 3.5 Cancel Attendance

**Endpoint:** `POST /api/method/frappe.client.cancel`

**Request Body:**
```json
{
  "doctype": "Attendance",
  "name": "ATT-001"
}
```

---

### 3.6 Delete Attendance

**Endpoint:** `DELETE /api/method/frappe.client.delete`

**Request Body:**
```json
{
  "doctype": "Attendance",
  "name": "ATT-001"
}
```

**Note:** Must be cancelled first before deletion.

---

## 4. Reporting & Filtering APIs

### 4.1 Get Attendance Report with Filters

**Endpoint:** `GET /api/method/frappe.client.get_list`

**Query Parameters:**
```
doctype=Attendance
&fields=["employee","employee_name","attendance_date","status","working_hours","in_time","out_time","late_entry","early_exit","department","shift"]
&filters=[["attendance_date","between",["2026-02-01","2026-02-28"]],["docstatus","=",1]]
&order_by=attendance_date desc
&limit_page_length=500
```

**With Department Filter:**
```
&filters=[["attendance_date","between",["2026-02-01","2026-02-28"]],["department","=","Sales"],["docstatus","=",1]]
```

**With Status Filter:**
```
&filters=[["attendance_date","=","2026-02-10"],["status","=","Present"],["docstatus","=",1]]
```

**Response:**
```json
{
  "message": [
    {
      "name": "ATT-001",
      "employee": "HR-EMP-00001",
      "employee_name": "Ahmed Ali",
      "attendance_date": "2026-02-10",
      "status": "Present",
      "working_hours": 8.5,
      "in_time": "2026-02-10 09:05:00",
      "out_time": "2026-02-10 17:35:00",
      "late_entry": 0,
      "early_exit": 0,
      "department": "Sales",
      "shift": "Day Shift"
    }
  ]
}
```

---

### 4.2 Get Late Entries List

**Endpoint:** `GET /api/method/frappe.client.get_list`

**Query Parameters:**
```
doctype=Attendance
&fields=["employee","employee_name","attendance_date","in_time","shift"]
&filters=[["late_entry","=",1],["attendance_date","=","2026-02-10"],["docstatus","=",1]]
&order_by=in_time desc
```

**Response:**
```json
{
  "message": [
    {
      "name": "ATT-002",
      "employee": "HR-EMP-00002",
      "employee_name": "Sara Mohamed",
      "attendance_date": "2026-02-10",
      "in_time": "2026-02-10 09:25:00",
      "shift": "Day Shift"
    }
  ]
}
```

---

### 4.3 Get Absent Employees List

**Endpoint:** `GET /api/method/frappe.client.get_list`

**Query Parameters:**
```
doctype=Attendance
&fields=["employee","employee_name","attendance_date","status","leave_type"]
&filters=[["status","=","Absent"],["attendance_date","=","2026-02-10"],["docstatus","=",1]]
```

**Response:**
```json
{
  "message": [
    {
      "name": "ATT-003",
      "employee": "HR-EMP-00003",
      "employee_name": "Omar Hassan",
      "attendance_date": "2026-02-10",
      "status": "Absent",
      "leave_type": null
    }
  ]
}
```

---

### 4.4 Get Early Exits List

**Endpoint:** `GET /api/method/frappe.client.get_list`

**Query Parameters:**
```
doctype=Attendance
&fields=["employee","employee_name","attendance_date","out_time","shift"]
&filters=[["early_exit","=",1],["attendance_date","=","2026-02-10"],["docstatus","=",1]]
```

---

### 4.5 Get Department-wise Summary

**Step 1: Get all departments**

**Endpoint:** `GET /api/method/frappe.client.get_list`

**Query Parameters:**
```
doctype=Department
&fields=["name"]
```

**Step 2: For each department, get attendance count**

**Endpoint:** `GET /api/method/frappe.client.get_count`

**Query Parameters:**
```
doctype=Attendance
&filters=[["department","=","Sales"],["attendance_date","=","2026-02-10"],["status","=","Present"],["docstatus","=",1]]
```

**Response:**
```json
{
  "message": 15
}
```

**Repeat for each status (Present, Absent, etc.) per department.**

---

### 4.6 Get Monthly Statistics

**Endpoint:** `GET /api/method/frappe.client.get_list`

**Query Parameters:**
```
doctype=Attendance
&fields=["status","COUNT(*) as count"]
&filters=[["attendance_date","between",["2026-02-01","2026-02-28"]],["docstatus","=",1]]
&group_by=status
```

**Note:** Use aggregation query or process client-side.

---

## 5. Shift & Schedule APIs

### 5.1 Get Shift Types

**Endpoint:** `GET /api/method/frappe.client.get_list`

**Query Parameters:**
```
doctype=Shift Type
&fields=["name","start_time","end_time","enable_auto_attendance"]
```

**Response:**
```json
{
  "message": [
    {
      "name": "Day Shift",
      "start_time": "09:00:00",
      "end_time": "17:00:00",
      "enable_auto_attendance": 1
    },
    {
      "name": "Night Shift",
      "start_time": "21:00:00",
      "end_time": "05:00:00",
      "enable_auto_attendance": 1
    }
  ]
}
```

---

### 5.2 Get Employee's Shift

**Endpoint:** `GET /api/method/frappe.client.get_list`

**Query Parameters:**
```
doctype=Shift Assignment
&fields=["shift_type","start_date","end_date","status"]
&filters=[["employee","=","HR-EMP-00001"],["docstatus","=",1],["status","=","Active"]]
&order_by=start_date desc
&limit=1
```

**Response:**
```json
{
  "message": [
    {
      "name": "SA-001",
      "shift_type": "Day Shift",
      "start_date": "2026-02-01",
      "end_date": null,
      "status": "Active"
    }
  ]
}
```

---

### 5.3 Get Shift Details

**Endpoint:** `GET /api/method/frappe.client.get`

**Query Parameters:**
```
doctype=Shift Type
&name=Day Shift
```

**Response:**
```json
{
  "data": {
    "name": "Day Shift",
    "start_time": "09:00:00",
    "end_time": "17:00:00",
    "enable_auto_attendance": 1,
    "working_hours_threshold_for_absent": 4.0,
    "working_hours_threshold_for_half_day": 6.0,
    "late_entry_grace_period": 15,
    "early_exit_grace_period": 15,
    "enable_late_entry_marking": 1,
    "enable_early_exit_marking": 1
  }
}
```

---

## 6. Alert & Notification APIs

### 6.1 Get Missing Check-out (Yesterday)

**Endpoint:** `GET /api/method/frappe.client.get_list`

**Query Parameters:**
```
doctype=Employee Checkin
&fields=["employee","employee_name","time","log_type"]
&filters=[["time","between",["2026-02-09 00:00:00","2026-02-09 23:59:59"]]]
&order_by=time desc
```

**Process client-side:**
- Group by employee
- Find employees with only "IN" log (no "OUT" log)

---

### 6.2 Get Employees Not Checked In (Today)

Compare:
- All active employees (API 1.3)
- Employees with check-in today (API 1.2)
- Difference = Not checked in yet

Process client-side.

---

### 6.3 Get Absent Without Leave

**Endpoint:** `GET /api/method/frappe.client.get_list`

**Query Parameters:**
```
doctype=Attendance
&fields=["employee","employee_name","attendance_date"]
&filters=[["status","=","Absent"],["leave_type","is","not set"],["attendance_date","=","2026-02-10"],["docstatus","=",1]]
```

**Response:**
```json
{
  "message": [
    {
      "name": "ATT-003",
      "employee": "HR-EMP-00003",
      "employee_name": "Omar Hassan",
      "attendance_date": "2026-02-10"
    }
  ]
}
```

---

## 7. Employee Search & Filter APIs

### 7.1 Search Employee by Name

**Endpoint:** `GET /api/method/frappe.client.get_list`

**Query Parameters:**
```
doctype=Employee
&fields=["name","employee_name","department"]
&filters=[["employee_name","like","%Ahmed%"],["status","=","Active"]]
```

---

### 7.2 Get Employees by Department

**Endpoint:** `GET /api/method/frappe.client.get_list`

**Query Parameters:**
```
doctype=Employee
&fields=["name","employee_name","designation"]
&filters=[["department","=","Sales"],["status","=","Active"]]
```

---

### 7.3 Get Departments List

**Endpoint:** `GET /api/method/frappe.client.get_list`

**Query Parameters:**
```
doctype=Department
&fields=["name","company"]
&filters=[["disabled","=",0]]
```

**Response:**
```json
{
  "message": [
    {
      "name": "Sales",
      "company": "Your Company"
    },
    {
      "name": "IT",
      "company": "Your Company"
    }
  ]
}
```

---

## 8. Statistics & Aggregation APIs

### 8.1 Get Count of Attendance by Status

**Endpoint:** `GET /api/method/frappe.client.get_count`

**Query Parameters:**
```
doctype=Attendance
&filters=[["status","=","Present"],["attendance_date","=","2026-02-10"],["docstatus","=",1]]
```

**Response:**
```json
{
  "message": 42
}
```

**Repeat for each status:**
- Present
- Absent
- Half Day
- On Leave
- Work From Home

---

### 8.2 Get Total Working Hours (Month)

**Endpoint:** `GET /api/method/frappe.client.get_list`

**Query Parameters:**
```
doctype=Attendance
&fields=["working_hours"]
&filters=[["employee","=","HR-EMP-00001"],["attendance_date","between",["2026-02-01","2026-02-28"]],["docstatus","=",1]]
```

**Sum `working_hours` client-side.**

---

### 8.3 Get Average Working Hours

Same as 8.2, then calculate average client-side.

---

## 9. Export & Download APIs

### 9.1 Export to Excel

**Endpoint:** `GET /api/method/frappe.desk.reportview.export_query`

**Query Parameters:**
```
doctype=Attendance
&file_format_type=Excel
&fields=["employee","employee_name","attendance_date","status","working_hours","in_time","out_time"]
&filters=[["attendance_date","between",["2026-02-01","2026-02-28"]]]
```

**Response:** File download

---

### 9.2 Export to CSV

**Endpoint:** `GET /api/method/frappe.desk.reportview.export_query`

**Query Parameters:**
```
doctype=Attendance
&file_format_type=CSV
&fields=["employee","employee_name","attendance_date","status"]
&filters=[["attendance_date","=","2026-02-10"]]
```

**Response:** File download

---

## 10. Advanced Queries

### 10.1 Get Attendance with Employee Details (Join)

**Endpoint:** `POST /api/method/frappe.client.get_list`

**Request Body:**
```json
{
  "doctype": "Attendance",
  "fields": ["name", "employee", "employee_name", "attendance_date", "status", "working_hours", "`tabEmployee`.department", "`tabEmployee`.designation"],
  "filters": [["attendance_date", "=", "2026-02-10"]],
  "order_by": "employee_name"
}
```

**Note:** Use backticks for joined fields.

---

### 10.2 Get Attendance Pattern (Recurring Late)

**Endpoint:** `GET /api/method/frappe.client.get_list`

**Query Parameters:**
```
doctype=Attendance
&fields=["employee","employee_name","COUNT(*) as late_count"]
&filters=[["late_entry","=",1],["attendance_date","between",["2026-02-01","2026-02-28"]],["docstatus","=",1]]
&group_by=employee
&order_by=late_count desc
```

**Note:** Requires custom API for GROUP BY, or process client-side.

---

## 11. Permission & Access APIs

### 11.1 Check User Permissions

**Endpoint:** `GET /api/method/frappe.client.get_list`

**Query Parameters:**
```
doctype=User Permission
&fields=["for_value","apply_to_all_doctypes"]
&filters=[["user","=","hr.manager@company.com"],["allow","=","Employee"]]
```

**Response:**
```json
{
  "message": [
    {
      "for_value": "HR-EMP-00001",
      "apply_to_all_doctypes": 0
    }
  ]
}
```

---

## 12. Real-time Updates APIs

### 12.1 Subscribe to Updates (WebSocket)

**Frappe uses Socket.IO for real-time updates.**

**Client-side (JavaScript):**
```javascript
frappe.realtime.on('attendance_update', (data) => {
  console.log('Attendance updated:', data);
  // Refresh dashboard
});
```

**Server-side trigger (Python):**
```python
frappe.publish_realtime('attendance_update', {
  'employee': employee,
  'status': 'Present'
})
```

---

## 13. Validation APIs

### 13.1 Check Duplicate Attendance

**Endpoint:** `GET /api/method/frappe.client.get_count`

**Query Parameters:**
```
doctype=Attendance
&filters=[["employee","=","HR-EMP-00001"],["attendance_date","=","2026-02-10"]]
```

**Response:**
```json
{
  "message": 0
}
```

**If count > 0, attendance already exists.**

---

### 13.2 Validate Shift Assignment

**Endpoint:** `GET /api/method/frappe.client.get_list`

**Query Parameters:**
```
doctype=Shift Assignment
&fields=["shift_type"]
&filters=[["employee","=","HR-EMP-00001"],["start_date","<=","2026-02-10"],["status","=","Active"],["docstatus","=",1]]
&or_filters=[["end_date",">=","2026-02-10"],["end_date","is","not set"]]
&limit=1
```

---

## 14. Custom Report APIs

### 14.1 Monthly Attendance Sheet

**Endpoint:** `GET /api/method/frappe.desk.query_report.run`

**Query Parameters:**
```
report_name=Monthly Attendance Sheet
&filters={"month":"2","year":"2026","company":"Your Company"}
```

**Response:** Report data

---

### 14.2 Shift Attendance Report

**Endpoint:** `GET /api/method/frappe.desk.query_report.run`

**Query Parameters:**
```
report_name=Shift Attendance
&filters={"from_date":"2026-02-01","to_date":"2026-02-28"}
```

---

## 15. Helper APIs

### 15.1 Get Current Date/Time

**Endpoint:** `GET /api/method/frappe.utils.now`

**Response:**
```json
{
  "message": "2026-02-10 14:30:00"
}
```

---

### 15.2 Get Today's Date

**Endpoint:** `GET /api/method/frappe.utils.today`

**Response:**
```json
{
  "message": "2026-02-10"
}
```

---

## API Usage Summary

### GET Requests:
- Get lists: `frappe.client.get_list`
- Get single doc: `frappe.client.get`
- Get count: `frappe.client.get_count`
- Get value: `frappe.client.get_value`
- Export: `frappe.desk.reportview.export_query`
- Run report: `frappe.desk.query_report.run`

### POST Requests:
- Insert doc: `frappe.client.insert`
- Submit doc: `frappe.client.submit`
- Bulk mark: `hrms.hr.doctype.employee_attendance_tool.employee_attendance_tool.mark_employee_attendance`

### PUT Requests:
- Update field: `frappe.client.set_value`
- Save doc: `frappe.client.save`

### DELETE Requests:
- Delete doc: `frappe.client.delete`
- Cancel doc: `frappe.client.cancel`

---

## Authentication

All requests require authentication:

**Headers:**
```
Cookie: sid=<session_id>
X-Frappe-CSRF-Token: <csrf_token>
```

**Or:**
```
Authorization: token <api_key>:<api_secret>
```

---

## Rate Limiting

- Default: 60 requests/minute per user
- Configurable in site_config.json

---

## Error Responses

**400 Bad Request:**
```json
{
  "exc_type": "ValidationError",
  "exception": "Invalid status value"
}
```

**401 Unauthorized:**
```json
{
  "exc_type": "AuthenticationError",
  "exception": "Not permitted"
}
```

**404 Not Found:**
```json
{
  "exc_type": "DoesNotExistError",
  "exception": "Attendance ATT-001 not found"
}
```

**500 Server Error:**
```json
{
  "exc_type": "ServerError",
  "exception": "Internal server error"
}
```

---

## Best Practices

1. **Use filters wisely** - Always filter by date range to limit results
2. **Pagination** - Use `limit_page_length` for large datasets
3. **Caching** - Cache department lists, shift types (rarely change)
4. **Batch requests** - Combine multiple GET requests when possible
5. **Error handling** - Always handle 401, 404, 500 errors
6. **Rate limiting** - Implement client-side rate limiting
7. **Real-time** - Use WebSocket for live updates instead of polling

---

**Last Updated:** February 10, 2026  
**Version:** 1.0  
**Framework:** Frappe v15+ / ERPNext / HRMS
