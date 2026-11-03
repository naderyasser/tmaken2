# Frontend API Reference - HRMS

Complete API documentation for frontend integration.

---

## 🔐 1. User Authentication & Creation

### 1.1 Create Employee with User Account
Create a new employee and user account in one call.

**Endpoint:**
```
POST /api/method/hrms.hr.doctype.employee.employee_user_api.create_employee_with_user
```

**Request Body:**
```json
{
  "employee_data": {
    "doctype": "Employee",
    "first_name": "Ahmed",
    "last_name": "Ali",
    "company": "Your Company",
    "department": "Sales",
    "designation": "Sales Executive"
  },
  "user_email": "ahmed.ali@company.com",
  "user_password": "SecurePass123"
}
```

**Response:**
```json
{
  "message": {
    "employee": {
      "name": "HR-EMP-00001",
      "first_name": "Ahmed",
      "employee_name": "Ahmed Ali",
      "user_id": "ahmed.ali@company.com"
    },
    "user_created": true
  }
}
```

---

### 1.2 Create User for Existing Employee
Add user account to an existing employee.

**Endpoint:**
```
POST /api/method/hrms.hr.doctype.employee.employee_user_api.create_user_for_employee
```

**Request Body:**
```json
{
  "employee": "HR-EMP-00001",
  "email": "user@company.com",
  "password": "SecurePass123"
}
```

**Response:**
```json
{
  "message": {
    "email": "user@company.com"
  }
}
```

**Notes:**
- ✅ Password is set correctly (NOT using buggy `new_password` field)
- ✅ User can login immediately with email + password
- ✅ User gets "Employee" role automatically

---

### 1.3 Login
Authenticate user and get session.

**Endpoint:**
```
POST /api/method/login
```

**Request Body:**
```json
{
  "usr": "user@company.com",
  "pwd": "password123"
}
```

**Response:**
```json
{
  "message": "Logged In",
  "home_page": "/app",
  "full_name": "Ahmed Ali"
}
```

---

### 1.4 Logout
End user session.

**Endpoint:**
```
GET /api/method/logout
```

---

## 📍 2. Check-in Method Configuration

### 2.1 Get Employee Check-in Method
Get the check-in method configured for an employee.

**Endpoint:**
```
GET /api/method/hrms.hr.doctype.employee_location_settings.checkin_method_api.get_checkin_method
```

**Query Parameters:**
- `employee` (required): Employee ID (e.g., "HR-EMP-00001")

**Example:**
```
GET /api/method/hrms.hr.doctype.employee_location_settings.checkin_method_api.get_checkin_method?employee=HR-EMP-00001
```

**Response:**
```json
{
  "message": {
    "checkin_method": "Photo",
    "require_photo": true,
    "require_biometric": false
  }
}
```

**Possible Values:**
- `"Manual"`: Simple button click (no requirements)
- `"Photo"`: Selfie required
- `"Biometric"`: Fingerprint/Face ID/Touch ID required
- `"Photo + Biometric"`: Both photo and biometric required

**Default:** If no settings exist, returns `"Manual"` with both requirements as `false`.

---

### 2.2 Validate Check-in Data
Validate check-in data before submission.

**Endpoint:**
```
POST /api/method/hrms.hr.doctype.employee_location_settings.checkin_method_api.validate_checkin_data
```

**Request Body:**
```json
{
  "employee": "HR-EMP-00001",
  "log_type": "IN",
  "checkin_method": "Photo",
  "photo": "base64_image_or_file_url",
  "biometric_verified": 0,
  "biometric_type": null
}
```

**Parameters:**
- `employee` (required): Employee ID
- `log_type` (required): "IN" or "OUT"
- `checkin_method` (required): Method used
- `photo` (optional): Photo data if required
- `biometric_verified` (optional): 1 if verified, 0 otherwise
- `biometric_type` (optional): "Fingerprint", "Face ID", or "Touch ID"

**Response:**
```json
{
  "message": true
}
```

**Error Response:**
```json
{
  "exc": "Photo is required for check-in<br>Biometric verification is required for check-in"
}
```

---

## ⏰ 3. Employee Check-in

### 3.1 Create Check-in
Record employee check-in or check-out.

**Endpoint:**
```
POST /api/method/frappe.client.insert
```

**Request Body (Manual):**
```json
{
  "doctype": "Employee Checkin",
  "employee": "HR-EMP-00001",
  "log_type": "IN",
  "time": "2026-02-10 09:00:00",
  "checkin_method": "Manual",
  "latitude": 24.7136,
  "longitude": 46.6753
}
```

**Request Body (Photo):**
```json
{
  "doctype": "Employee Checkin",
  "employee": "HR-EMP-00001",
  "log_type": "IN",
  "time": "2026-02-10 09:00:00",
  "checkin_method": "Photo",
  "photo_image": "/files/checkin_photo.jpg",
  "latitude": 24.7136,
  "longitude": 46.6753
}
```

**Request Body (Biometric):**
```json
{
  "doctype": "Employee Checkin",
  "employee": "HR-EMP-00001",
  "log_type": "IN",
  "time": "2026-02-10 09:00:00",
  "checkin_method": "Biometric",
  "biometric_verified": 1,
  "biometric_type": "Face ID",
  "latitude": 24.7136,
  "longitude": 46.6753
}
```

**Request Body (Photo + Biometric):**
```json
{
  "doctype": "Employee Checkin",
  "employee": "HR-EMP-00001",
  "log_type": "IN",
  "time": "2026-02-10 09:00:00",
  "checkin_method": "Photo + Biometric",
  "photo_image": "/files/checkin_photo.jpg",
  "biometric_verified": 1,
  "biometric_type": "Fingerprint",
  "latitude": 24.7136,
  "longitude": 46.6753
}
```

**Response:**
```json
{
  "data": {
    "name": "EMP-CHECKIN-0001",
    "employee": "HR-EMP-00001",
    "log_type": "IN",
    "time": "2026-02-10 09:00:00",
    "checkin_method": "Photo"
  }
}
```

**Notes:**
- `log_type`: "IN" or "OUT"
- `time`: Format "YYYY-MM-DD HH:MM:SS"
- `latitude` & `longitude`: Optional but recommended
- `photo_image`: File URL after upload (use upload API first)

---

### 3.2 Get Last Check-in
Get the most recent check-in for an employee.

**Endpoint:**
```
GET /api/method/frappe.client.get_list
```

**Query Parameters:**
```
doctype=Employee Checkin
&filters=[["employee","=","HR-EMP-00001"]]
&fields=["name","log_type","time","checkin_method","photo_image","biometric_verified"]
&order_by=time desc
&limit_page_length=1
```

**Response:**
```json
{
  "message": [
    {
      "name": "EMP-CHECKIN-0001",
      "log_type": "IN",
      "time": "2026-02-10 09:00:00",
      "checkin_method": "Photo",
      "photo_image": "/files/photo.jpg",
      "biometric_verified": 0
    }
  ]
}
```

---

### 3.3 Get Check-in History
Get check-in history for an employee.

**Endpoint:**
```
GET /api/method/frappe.client.get_list
```

**Query Parameters:**
```
doctype=Employee Checkin
&filters=[["employee","=","HR-EMP-00001"],["time","between",["2026-02-01","2026-02-28"]]]
&fields=["name","log_type","time","checkin_method","latitude","longitude"]
&order_by=time desc
&limit_page_length=50
```

---

## 📍 4. Location Tracking

### 4.1 Get Tracking Settings
Get location tracking configuration for an employee.

**Endpoint:**
```
GET /api/method/hrms.hr.doctype.employee_location_log.location_api.get_tracking_settings
```

**Query Parameters:**
- `employee` (required): Employee ID

**Example:**
```
GET /api/method/hrms.hr.doctype.employee_location_log.location_api.get_tracking_settings?employee=HR-EMP-00001
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

**Default:** If no settings exist:
```json
{
  "enable_tracking": 0,
  "interval_in_milliseconds": 0,
  "employee_consent": 0
}
```

---

### 4.2 Save Location
Save employee's current location.

**Endpoint:**
```
POST /api/method/hrms.hr.doctype.employee_location_log.location_api.save_location
```

**Request Body:**
```json
{
  "employee": "HR-EMP-00001",
  "latitude": 24.7136,
  "longitude": 46.6753,
  "accuracy": 10.5,
  "notes": "Optional note",
  "attendance": "ATT-00001",
  "checkin": "EMP-CHECKIN-0001"
}
```

**Parameters:**
- `employee` (required): Employee ID
- `latitude` (required): GPS latitude
- `longitude` (required): GPS longitude
- `accuracy` (optional): GPS accuracy in meters
- `notes` (optional): Additional notes
- `attendance` (optional): Link to Attendance record
- `checkin` (optional): Link to Employee Checkin record

**Response:**
```json
{
  "message": {
    "success": true,
    "log_name": "LOC-LOG-0001",
    "message": "Location saved successfully"
  }
}
```

**Error Response:**
```json
{
  "message": {
    "success": false,
    "message": "Location tracking is not enabled for this employee"
  }
}
```

---

### 4.3 Start Tracking for Check-in
Initialize location tracking when employee checks in.

**Endpoint:**
```
POST /api/method/hrms.hr.doctype.employee_location_log.location_api.start_tracking_for_checkin
```

**Request Body:**
```json
{
  "employee": "HR-EMP-00001",
  "checkin": "EMP-CHECKIN-0001"
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
    "checkin": "EMP-CHECKIN-0001"
  }
}
```

**Notes:**
- Call this API immediately after successful check-in (log_type="IN")
- Use `interval_ms` to determine how frequently to send location updates
- Stop tracking when employee checks out (log_type="OUT")

---

### 4.4 Get Current Attendance
Get today's attendance record for an employee.

**Endpoint:**
```
GET /api/method/hrms.hr.doctype.employee_location_log.location_api.get_current_attendance
```

**Query Parameters:**
- `employee` (required): Employee ID

**Response:**
```json
{
  "message": {
    "name": "ATT-00001",
    "time": "09:00:00",
    "status": "Present"
  }
}
```

---

## 📤 5. File Upload

### 5.1 Upload Photo
Upload a photo for check-in.

**Endpoint:**
```
POST /api/method/upload_file
```

**Request (multipart/form-data):**
```
file: [binary file data]
is_private: 0
doctype: Employee Checkin
docname: [optional - name of existing doc]
```

**Response:**
```json
{
  "message": {
    "file_url": "/files/checkin_photo.jpg",
    "file_name": "checkin_photo.jpg"
  }
}
```

**Usage:**
1. Upload photo first using this endpoint
2. Get `file_url` from response
3. Use `file_url` in `photo_image` field when creating check-in

---

## 🌍 6. Geolocation

### 6.1 Get User Location (Browser API)
Use browser's Geolocation API:

```javascript
navigator.geolocation.getCurrentPosition(
  (position) => {
    const latitude = position.coords.latitude;
    const longitude = position.coords.longitude;
    const accuracy = position.coords.accuracy;
    
    // Use these values in check-in or location tracking
  },
  (error) => {
    console.error("Location error:", error);
  },
  {
    enableHighAccuracy: true,
    timeout: 5000,
    maximumAge: 0
  }
);
```

---

## 🔐 7. Biometric Verification

### 7.1 Web Authentication API
Use browser's WebAuthn API for biometric verification:

```javascript
// Check if biometric is available
if (window.PublicKeyCredential) {
  // Request biometric authentication
  navigator.credentials.get({
    publicKey: {
      challenge: new Uint8Array([/* challenge from server */]),
      timeout: 60000,
      userVerification: "required"
    }
  }).then((credential) => {
    // Biometric verified successfully
    const biometric_verified = 1;
    const biometric_type = "Face ID"; // or "Fingerprint" or "Touch ID"
    
    // Use in check-in
  }).catch((error) => {
    console.error("Biometric failed:", error);
  });
}
```

**Detecting Biometric Type:**
```javascript
// iOS Safari
if (window.webkit) {
  biometric_type = "Face ID"; // or "Touch ID"
}
// Android Chrome
else if (navigator.userAgent.includes("Android")) {
  biometric_type = "Fingerprint";
}
```

---

## 📸 8. Camera Access

### 8.1 Capture Photo (Browser API)
Use MediaDevices API to capture selfie:

```javascript
// Request camera access
navigator.mediaDevices.getUserMedia({ 
  video: { facingMode: "user" } // Front camera
})
.then((stream) => {
  // Display video preview
  videoElement.srcObject = stream;
  
  // Capture photo
  const canvas = document.createElement('canvas');
  canvas.width = videoElement.videoWidth;
  canvas.height = videoElement.videoHeight;
  canvas.getContext('2d').drawImage(videoElement, 0, 0);
  
  // Convert to blob
  canvas.toBlob((blob) => {
    // Upload blob using upload API
    const formData = new FormData();
    formData.append('file', blob, 'checkin_photo.jpg');
    formData.append('is_private', '0');
    
    fetch('/api/method/upload_file', {
      method: 'POST',
      body: formData
    }).then(response => response.json())
      .then(data => {
        const photo_url = data.message.file_url;
        // Use photo_url in check-in
      });
  }, 'image/jpeg');
  
  // Stop camera
  stream.getTracks().forEach(track => track.stop());
});
```

---

## 🔄 9. Common Workflows

### Workflow 1: Complete Check-in with Photo
```javascript
// Step 1: Get check-in method
const methodResponse = await fetch(
  '/api/method/hrms.hr.doctype.employee_location_settings.checkin_method_api.get_checkin_method?employee=HR-EMP-00001'
);
const method = await methodResponse.json();

// Step 2: Get location
navigator.geolocation.getCurrentPosition(async (position) => {
  const { latitude, longitude, accuracy } = position.coords;
  
  // Step 3: Capture photo if required
  let photo_url = null;
  if (method.message.require_photo) {
    // Capture photo (see Camera Access section)
    const photoBlob = await capturePhoto();
    
    // Upload photo
    const formData = new FormData();
    formData.append('file', photoBlob, 'checkin.jpg');
    const uploadRes = await fetch('/api/method/upload_file', {
      method: 'POST',
      body: formData
    });
    const uploadData = await uploadRes.json();
    photo_url = uploadData.message.file_url;
  }
  
  // Step 4: Validate (optional)
  await fetch('/api/method/hrms.hr.doctype.employee_location_settings.checkin_method_api.validate_checkin_data', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      employee: 'HR-EMP-00001',
      log_type: 'IN',
      checkin_method: method.message.checkin_method,
      photo: photo_url
    })
  });
  
  // Step 5: Create check-in
  const checkinRes = await fetch('/api/method/frappe.client.insert', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      doctype: 'Employee Checkin',
      employee: 'HR-EMP-00001',
      log_type: 'IN',
      time: new Date().toISOString().slice(0, 19).replace('T', ' '),
      checkin_method: method.message.checkin_method,
      photo_image: photo_url,
      latitude: latitude,
      longitude: longitude
    })
  });
  const checkin = await checkinRes.json();
  
  // Step 6: Start location tracking
  await fetch('/api/method/hrms.hr.doctype.employee_location_log.location_api.start_tracking_for_checkin', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      employee: 'HR-EMP-00001',
      checkin: checkin.data.name
    })
  });
});
```

---

### Workflow 2: Create Employee with User Account
```javascript
// Complete employee creation with login access
const response = await fetch(
  '/api/method/hrms.hr.doctype.employee.employee_user_api.create_employee_with_user',
  {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      employee_data: {
        doctype: 'Employee',
        first_name: 'Ahmed',
        last_name: 'Ali',
        company: 'Your Company',
        department: 'Sales',
        designation: 'Sales Executive',
        date_of_joining: '2026-02-10',
        gender: 'Male',
        status: 'Active'
      },
      user_email: 'ahmed.ali@company.com',
      user_password: 'SecurePass123'
    })
  }
);

const result = await response.json();

if (result.message.user_created) {
  // Success! User can now login
  // Redirect to login page or auto-login
  await fetch('/api/method/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      usr: 'ahmed.ali@company.com',
      pwd: 'SecurePass123'
    })
  });
}
```

---

### Workflow 3: Location Tracking Loop
```javascript
// After successful check-in, start tracking loop
async function startLocationTracking(employee, checkin) {
  // Get tracking settings
  const settingsRes = await fetch(
    `/api/method/hrms.hr.doctype.employee_location_log.location_api.get_tracking_settings?employee=${employee}`
  );
  const settings = await settingsRes.json();
  
  if (!settings.message.enable_tracking) {
    return; // Tracking disabled
  }
  
  const interval = settings.message.interval_in_milliseconds;
  
  // Track location at intervals
  const trackingInterval = setInterval(() => {
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        await fetch('/api/method/hrms.hr.doctype.employee_location_log.location_api.save_location', {
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
      },
      (error) => console.error('Location error:', error),
      { enableHighAccuracy: true }
    );
  }, interval);
  
  // Store interval ID to stop later
  window.locationTrackingInterval = trackingInterval;
}

// Stop tracking on check-out
function stopLocationTracking() {
  if (window.locationTrackingInterval) {
    clearInterval(window.locationTrackingInterval);
    window.locationTrackingInterval = null;
  }
}
```

---

## ❗ Error Handling

### Common Error Responses

**401 Unauthorized:**
```json
{
  "exc_type": "AuthenticationError",
  "exception": "Not permitted"
}
```
→ User not logged in or session expired

**403 Forbidden:**
```json
{
  "exc_type": "PermissionError",
  "exception": "Insufficient Permission for Employee Checkin"
}
```
→ User doesn't have required permissions

**404 Not Found:**
```json
{
  "exc_type": "DoesNotExistError",
  "exception": "Employee HR-EMP-00001 not found"
}
```
→ Resource doesn't exist

**500 Server Error:**
```json
{
  "exc_type": "ValidationError",
  "exception": "Photo is required for check-in"
}
```
→ Validation failed or server error

---

## 🔒 Security Notes

1. **CSRF Protection**: All POST requests require CSRF token. Get it from cookies (`csrf_token`) and include in headers:
   ```javascript
   headers: {
     'X-Frappe-CSRF-Token': getCookie('csrf_token')
   }
   ```

2. **Session Management**: Login creates session cookie. Include credentials in requests:
   ```javascript
   fetch(url, {
     credentials: 'include' // Send cookies
   })
   ```

3. **Password Security**:
   - ✅ Use HTTPS in production
   - ✅ Passwords are hashed on server using `update_password()`
   - ✅ Never log passwords in frontend

4. **Permissions**:
   - Employee role: Can create own check-ins and view own data
   - HR Manager role: Can view all employees and check-ins
   - System Manager: Full access

---

## 📊 Response Status Codes

- `200 OK`: Successful request
- `201 Created`: Resource created successfully
- `400 Bad Request`: Invalid request data
- `401 Unauthorized`: Authentication required
- `403 Forbidden`: Insufficient permissions
- `404 Not Found`: Resource not found
- `500 Internal Server Error`: Server error

---

## 🚀 Quick Start Example

```html
<!DOCTYPE html>
<html>
<head>
  <title>HRMS Check-in</title>
</head>
<body>
  <h1>Employee Check-in</h1>
  
  <!-- Login Form -->
  <div id="login-form">
    <input type="email" id="email" placeholder="Email">
    <input type="password" id="password" placeholder="Password">
    <button onclick="login()">Login</button>
  </div>
  
  <!-- Check-in Form -->
  <div id="checkin-form" style="display:none;">
    <h2>Welcome, <span id="employee-name"></span></h2>
    <button onclick="checkIn()">Check In</button>
    <button onclick="checkOut()">Check Out</button>
  </div>
  
  <script>
    let currentEmployee = null;
    
    async function login() {
      const email = document.getElementById('email').value;
      const password = document.getElementById('password').value;
      
      const response = await fetch('/api/method/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ usr: email, pwd: password }),
        credentials: 'include'
      });
      
      if (response.ok) {
        // Get employee data
        const empRes = await fetch(
          `/api/method/frappe.client.get_value?doctype=Employee&filters={"user_id":"${email}"}&fieldname=["name","employee_name"]`,
          { credentials: 'include' }
        );
        const empData = await empRes.json();
        currentEmployee = empData.message.name;
        
        document.getElementById('login-form').style.display = 'none';
        document.getElementById('checkin-form').style.display = 'block';
        document.getElementById('employee-name').textContent = empData.message.employee_name;
      }
    }
    
    async function checkIn() {
      // Get location
      navigator.geolocation.getCurrentPosition(async (position) => {
        // Get check-in method
        const methodRes = await fetch(
          `/api/method/hrms.hr.doctype.employee_location_settings.checkin_method_api.get_checkin_method?employee=${currentEmployee}`,
          { credentials: 'include' }
        );
        const method = await methodRes.json();
        
        // Create check-in
        const checkinRes = await fetch('/api/method/frappe.client.insert', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            doctype: 'Employee Checkin',
            employee: currentEmployee,
            log_type: 'IN',
            time: new Date().toISOString().slice(0, 19).replace('T', ' '),
            checkin_method: method.message.checkin_method,
            latitude: position.coords.latitude,
            longitude: position.coords.longitude
          }),
          credentials: 'include'
        });
        
        if (checkinRes.ok) {
          alert('Checked in successfully!');
        }
      });
    }
    
    async function checkOut() {
      navigator.geolocation.getCurrentPosition(async (position) => {
        const methodRes = await fetch(
          `/api/method/hrms.hr.doctype.employee_location_settings.checkin_method_api.get_checkin_method?employee=${currentEmployee}`,
          { credentials: 'include' }
        );
        const method = await methodRes.json();
        
        const checkinRes = await fetch('/api/method/frappe.client.insert', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            doctype: 'Employee Checkin',
            employee: currentEmployee,
            log_type: 'OUT',
            time: new Date().toISOString().slice(0, 19).replace('T', ' '),
            checkin_method: method.message.checkin_method,
            latitude: position.coords.latitude,
            longitude: position.coords.longitude
          }),
          credentials: 'include'
        });
        
        if (checkinRes.ok) {
          alert('Checked out successfully!');
        }
      });
    }
  </script>
</body>
</html>
```

---

## 📞 Support

For issues or questions:
- Check error messages in console
- Verify user permissions
- Ensure bench is restarted after backend changes
- Check browser console for JavaScript errors

---

**Last Updated:** February 10, 2026  
**Version:** 1.0  
**Framework:** Frappe v15+ / ERPNext / HRMS
