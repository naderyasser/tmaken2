# 📋 HRMS App - Complete Design Guide for Figma

**Version:** 1.0  
**Date:** February 6, 2026  
**Purpose:** Comprehensive UI/UX structure for HR Management System (HRMS) Figma design

---

## 📑 Table of Contents
1. [Main Dashboard](#1-main-dashboard)
2. [Main Modules (9 Workspaces)](#2-main-modules-9-workspaces)
3. [Employee Master](#3-employee-master)
4. [Dashboards](#4-dashboards-2-main-dashboards)
5. [UI/UX Components](#5-uiux-components)
6. [Mobile Responsive Design](#6-mobile-responsive-design)
7. [User Roles & Permissions](#7-user-roles--permissions)
8. [Settings Pages](#8-settings-pages)

---

## 🎯 1. MAIN DASHBOARD (HR Home)

### A. Top Bar (Header)
```
┌─────────────────────────────────────────────────────────────┐
│ 🏢 Company Name    | 👤 User Menu | 🔔 Notifications | 🌐 Lang│
└─────────────────────────────────────────────────────────────┘
```

**Components:**
- **Company Logo/Name** (left side)
- **Search Bar** (center)
- **User Avatar** with name
- **Notification Bell** (with count badge)
- **Language Selector**
- **Settings Dropdown**

### B. Quick Stats Cards (Dashboard Widgets)
```
┌──────────────┬──────────────┬──────────────┬──────────────┐
│ 👥 Employees │ 📅 On Leave  │ ⏱️ Attendance│ 💰 Payroll   │
│    250       │     15       │    98.5%     │   Processing │
└──────────────┴──────────────┴──────────────┴──────────────┘
```

**Card Details:**
- **Employee Count:** Total active employees
- **On Leave:** Number of employees on leave today
- **Attendance Rate:** Percentage of attendance
- **Payroll Status:** Processing/Completed

### C. Quick Shortcuts Section
```
Your Shortcuts:
🧑 Employee  |  📊 HR Dashboard  |  💵 Payroll Dashboard
```

**Clickable Links:**
- Employee List (New/Quick Add)
- HR Dashboard Overview
- Payroll Dashboard

---

## 🗂️ 2. MAIN MODULES (9 Workspaces)

### 📌 2.1 HR (Main Module)

#### **EMPLOYEE**
```
┌─ EMPLOYEE ──────────────────────────┐
│ • Employee (Master List)            │
│ • Employee Group                    │
│ • Employee Grade                    │
└─────────────────────────────────────┘
```

#### **SETUP**
```
┌─ SETUP ─────────────────────────────┐
│ • Company                           │
│ • Branch                            │
│ • Department                        │
│ • Designation                       │
│ • Employment Type                   │
│ • Skill                             │
│ • Identification Document Type      │
└─────────────────────────────────────┘
```

#### **LEAVES**
```
┌─ LEAVES ────────────────────────────┐
│ • Leave Application                 │
│ • Compensatory Leave Request        │
│ • Leave Allocation                  │
│ • Leave Policy                      │
│ • Leave Period                      │
│ • Holiday List                      │
│ • Leave Block List                  │
└─────────────────────────────────────┘
```

#### **ATTENDANCE**
```
┌─ ATTENDANCE ────────────────────────┐
│ • Attendance                        │
│ • Attendance Request                │
│ • Employee Checkin                  │
│ • Upload Attendance                 │
│ • Employee Location Log             │
└─────────────────────────────────────┘
```

#### **EXPENSE CLAIM**
```
┌─ EXPENSE CLAIM ─────────────────────┐
│ • Expense Claim                     │
│ • Employee Advance                  │
│ • Travel Request                    │
│ • Travel Itinerary                  │
│ • Vehicle Log                       │
│ • Vehicle Service                   │
└─────────────────────────────────────┘
```

#### **KEY REPORTS**
```
┌─ KEY REPORTS ───────────────────────┐
│ • Monthly Attendance Sheet          │
│ • Recruitment Analytics             │
│ • Employee Analytics                │
│ • Employee Leave Balance            │
│ • Employee Leave Balance Summary    │
│ • Employee Advance Summary          │
│ • Employee Exits                    │
│ • Employee Location Map             │
└─────────────────────────────────────┘
```

#### **OTHER REPORTS**
```
┌─ OTHER REPORTS ─────────────────────┐
│ • Employee Information              │
│ • Employee Birthday                 │
│ • Employees Working on a Holiday    │
│ • Daily Work Summary Replies        │
│ • Employees by Department           │
│ • Active Employees Report           │
└─────────────────────────────────────┘
```

#### **SETTINGS**
```
┌─ SETTINGS ──────────────────────────┐
│ • HR Settings (Main Configuration)  │
│ • Leave Settings                    │
│ • Attendance Settings               │
│ • Employee Settings                 │
└─────────────────────────────────────┘
```

---

### 📌 2.2 Recruitment Module

#### **JOBS**
```
┌─ JOBS ──────────────────────────────┐
│ • Staffing Plan                     │
│ • Job Requisition                   │
│ • Job Opening                       │
│ • Job Applicant                     │
│ • Job Offer                         │
│ • Employee Referral                 │
│ • Job Applicant Source              │
└─────────────────────────────────────┘
```

#### **INTERVIEWS**
```
┌─ INTERVIEWS ────────────────────────┐
│ • Interview Type                    │
│ • Interview Round                   │
│ • Interview                         │
│ • Interview Feedback                │
│ • Interview Detail                  │
│ • Interviewer                       │
└─────────────────────────────────────┘
```

#### **APPOINTMENT**
```
┌─ APPOINTMENT ───────────────────────┐
│ • Appointment Letter Template       │
│ • Appointment Letter                │
│ • Appointment Letter Content        │
└─────────────────────────────────────┘
```

#### **REPORTS**
```
┌─ REPORTS ───────────────────────────┐
│ • Recruitment Analytics             │
│ • Job Opening Pipeline              │
│ • Applicant Status Report           │
└─────────────────────────────────────┘
```

#### **QUICK FEATURES**
```
📊 CHART: Department Wise Openings (Bar Chart)
📋 QUICK LIST: Interviews (This Week)
🎯 Shortcuts: Job Opening | Job Applicant | Job Offer
```

---

### 📌 2.3 Leaves Module

#### **SETUP**
```
┌─ SETUP ─────────────────────────────┐
│ • Holiday List                      │
│ • Leave Type                        │
│ • Leave Period                      │
│ • Leave Policy                      │
│ • Leave Block List                  │
│ • Leave Control Panel               │
│ • Leave Adjustment                  │
└─────────────────────────────────────┘
```

#### **APPLICATION**
```
┌─ APPLICATION ───────────────────────┐
│ • Leave Application                 │
│ • Compensatory Leave Request        │
│ • Leave Encashment                  │
│ • Attendance Request                │
└─────────────────────────────────────┘
```

#### **ALLOCATION**
```
┌─ ALLOCATION ────────────────────────┐
│ • Leave Allocation                  │
│ • Leave Policy Assignment           │
│ • Leave Control Panel               │
│ • Earned Leave Schedule             │
└─────────────────────────────────────┘
```

#### **REPORTS**
```
┌─ REPORTS ───────────────────────────┐
│ • Employee Leave Balance            │
│ • Employee Leave Balance Summary    │
│ • Employees working on a holiday    │
│ • Leave Allocation Register         │
│ • Leave Utilization Report          │
└─────────────────────────────────────┘
```

#### **QUICK ACCESS**
```
🎯 Shortcuts: Leave Application | Leave Allocation
```

---

### 📌 2.4 Shift & Attendance Module

#### **SHIFT MANAGEMENT**
```
┌─ SHIFT MANAGEMENT ──────────────────┐
│ • Shift Type                        │
│ • Shift Request                     │
│ • Shift Assignment                  │
│ • Shift Schedule                    │
│ • Shift Schedule Assignment         │
│ • Shift Location                    │
└─────────────────────────────────────┘
```

#### **ATTENDANCE**
```
┌─ ATTENDANCE ────────────────────────┐
│ • Attendance                        │
│ • Attendance Request                │
│ • Employee Checkin                  │
│ • Upload Attendance                 │
│ • Employee Attendance Tool          │
└─────────────────────────────────────┘
```

#### **REPORTS**
```
┌─ REPORTS ───────────────────────────┐
│ • Monthly Attendance Sheet          │
│ • Marked Attendance                 │
│ • Department Wise Attendance        │
│ • Shift-wise Attendance             │
└─────────────────────────────────────┘
```

#### **VISUALIZATIONS**
```
📊 CHART: Attendance Distribution (Pie Chart)
📊 CHART: Daily Attendance Trend (Line Chart)
```

---

### 📌 2.5 Expenses Module

#### **EXPENSE CLAIM**
```
┌─ EXPENSE CLAIM ─────────────────────┐
│ • Expense Claim                     │
│ • Expense Claim Type                │
│ • Expense Claim Detail              │
│ • Expense Claim Advance             │
│ • Expense Claim Account             │
│ • Expense Taxes and Charges         │
└─────────────────────────────────────┘
```

#### **TRAVEL**
```
┌─ TRAVEL ────────────────────────────┐
│ • Travel Request                    │
│ • Travel Itinerary                  │
│ • Travel Request Costing            │
│ • Purpose of Travel                 │
└─────────────────────────────────────┘
```

#### **VEHICLE**
```
┌─ VEHICLE ───────────────────────────┐
│ • Vehicle                           │
│ • Vehicle Log                       │
│ • Vehicle Service                   │
│ • Vehicle Service Item              │
└─────────────────────────────────────┘
```

#### **REPORTS**
```
┌─ REPORTS ───────────────────────────┐
│ • Expense Claim Analytics           │
│ • Employee Advance Summary          │
│ • Travel Request Status             │
│ • Vehicle Utilization               │
└─────────────────────────────────────┘
```

---

### 📌 2.6 Performance Module

#### **APPRAISAL**
```
┌─ APPRAISAL ─────────────────────────┐
│ • Appraisal Template                │
│ • Appraisal Cycle                   │
│ • Appraisal                         │
│ • Appraisal Goal                    │
│ • Appraisal Template Goal           │
└─────────────────────────────────────┘
```

#### **GOALS & KRA**
```
┌─ GOALS & KRA ───────────────────────┐
│ • Goal (Master)                     │
│ • KRA (Key Result Area)             │
│ • Appraisal Goals (Detail)          │
│ • Appraisal KRA                     │
└─────────────────────────────────────┘
```

#### **FEEDBACK**
```
┌─ FEEDBACK ──────────────────────────┐
│ • Employee Performance Feedback     │
│ • Employee Feedback Criteria        │
│ • Employee Feedback Rating          │
│ • Training Feedback                 │
└─────────────────────────────────────┘
```

#### **SKILLS**
```
┌─ SKILLS ────────────────────────────┐
│ • Skill (Master)                    │
│ • Skill Assessment                  │
│ • Employee Skill Map                │
│ • Designation Skill                 │
│ • Expected Skill Set                │
└─────────────────────────────────────┘
```

#### **TRAINING**
```
┌─ TRAINING ──────────────────────────┐
│ • Training Program                  │
│ • Training Event                    │
│ • Training Event Employee           │
│ • Training Result                   │
│ • Training Result Employee          │
│ • Training Feedback                 │
│ • Daily Work Summary                │
└─────────────────────────────────────┘
```

---

### 📌 2.7 Tenure (Employee Lifecycle) Module

#### **ONBOARDING**
```
┌─ ONBOARDING ────────────────────────┐
│ • Employee Onboarding Template      │
│ • Employee Onboarding               │
│ • Employee Boarding Activity        │
└─────────────────────────────────────┘
```

#### **EXIT / SEPARATION**
```
┌─ EXIT / SEPARATION ─────────────────┐
│ • Employee Separation Template      │
│ • Employee Separation               │
│ • Exit Interview                    │
│ • Full and Final Statement          │
│ • Full and Final Outstanding Stmt   │
│ • Full and Final Asset              │
└─────────────────────────────────────┘
```

#### **EMPLOYEE CHANGES**
```
┌─ EMPLOYEE CHANGES ──────────────────┐
│ • Employee Transfer                 │
│ • Employee Promotion                │
│ • Employee Grievance                │
│ • Grievance Type                    │
│ • Employee Property History         │
│ • Employee Property Update          │
└─────────────────────────────────────┘
```

#### **REPORTS**
```
┌─ REPORTS ───────────────────────────┐
│ • Employee Exits                    │
│ • Onboarding Status                 │
│ • Separation Status                 │
│ • Transfer History                  │
└─────────────────────────────────────┘
```

---

### 📌 2.8 Payroll Module

#### **PAYROLL PROCESSING**
```
┌─ PAYROLL PROCESSING ────────────────┐
│ • Salary Structure                  │
│ • Salary Structure Assignment       │
│ • Salary Slip                       │
│ • Payroll Entry                     │
│ • Payroll Period                    │
└─────────────────────────────────────┘
```

#### **SALARY COMPONENTS**
```
┌─ SALARY COMPONENTS ─────────────────┐
│ • Salary Component                  │
│ • Additional Salary                 │
│ • Retention Bonus                   │
│ • Employee Incentive                │
│ • Interest (Loan Interest)          │
└─────────────────────────────────────┘
```

#### **DEDUCTIONS**
```
┌─ DEDUCTIONS ────────────────────────┐
│ • Employee Advance                  │
│ • Loan                              │
│ • Loan Repayment                    │
│ • Over time Salary Component        │
│ • Over time Slip                    │
│ • Over time Details                 │
└─────────────────────────────────────┘
```

#### **REPORTS**
```
┌─ REPORTS ───────────────────────────┐
│ • Salary Register                   │
│ • Bank Remittance                   │
│ • Provident Fund Statement          │
│ • Income Tax Deductions             │
│ • Payroll Summary Report            │
│ • Monthly Payroll Report            │
└─────────────────────────────────────┘
```

#### **DASHBOARD**
```
📊 Dashboard: Payroll Dashboard (Overview)
```

---

### 📌 2.9 Tax & Benefits Module

#### **INCOME TAX**
```
┌─ INCOME TAX ────────────────────────┐
│ • Income Tax Slab                   │
│ • Tax Exemption Declaration         │
│ • Tax Exemption Proof Submission    │
│ • Employee Tax Exemption Declaration│
└─────────────────────────────────────┘
```

#### **BENEFITS**
```
┌─ BENEFITS ──────────────────────────┐
│ • Employee Benefit                  │
│ • Employee Benefit Application      │
│ • Employee Benefit Claim            │
│ • Employee Health Insurance         │
│ • Interest (Loan Interest)          │
└─────────────────────────────────────┘
```

#### **GRATUITY & PROVIDENT FUND**
```
┌─ GRATUITY & PROVIDENT FUND ─────────┐
│ • Gratuity                          │
│ • Gratuity Rule                     │
│ • Provident Fund                    │
│ • Employee Other Income             │
│ • Employee Finance Account          │
└─────────────────────────────────────┘
```

---

## 👤 3. EMPLOYEE MASTER (Most Important DocType)

### A. Employee Form Structure

#### **BASIC INFO**
```
┌─ BASIC INFO ────────────────────────┐
│ • Employee ID (Auto)                │
│ • First Name                        │
│ • Middle Name                       │
│ • Last Name                         │
│ • Employee Name (Full - Auto)       │
│ • Gender (M/F/Other)                │
│ • Date of Birth                     │
│ • Date of Joining                   │
│ • Status (Active/Left/Suspended)    │
│ • Employee Image/Avatar             │
│ • Salutation (Mr/Ms/Dr)             │
└─────────────────────────────────────┘
```

#### **ORGANIZATION**
```
┌─ ORGANIZATION ──────────────────────┐
│ • Company (Required)                │
│ • Department                        │
│ • Designation (Required)            │
│ • Branch                            │
│ • Reports To (Manager)              │
│ • Grade (Salary Grade)              │
│ • Notice Period (Days)              │
│ • Employment Type                   │
│ • Job Title                         │
│ • Payroll Cost Center               │
└─────────────────────────────────────┘
```

#### **CONTACT DETAILS**
```
┌─ CONTACT DETAILS ───────────────────┐
│ • Cell Number                       │
│ • Personal Email                    │
│ • Company Email                     │
│ • Current Address                   │
│ • Current Address Line 2            │
│ • Current City                      │
│ • Current State                     │
│ • Current Postal Code               │
│ • Current Country                   │
│ • Permanent Address (Full)          │
│ • Emergency Contact Name            │
│ • Emergency Contact Number          │
│ • Emergency Contact Relation        │
└─────────────────────────────────────┘
```

#### **PERSONAL DETAILS**
```
┌─ PERSONAL DETAILS ──────────────────┐
│ • Passport Number                   │
│ • Date of Issue                     │
│ • Valid Upto                        │
│ • Place of Issue                    │
│ • Passport Expiry (Calculated)      │
│ • Marital Status                    │
│ • Blood Group                       │
│ • Religion                          │
│ • Mother Tongue                     │
│ • Nationality                       │
│ • Family Background Table:          │
│   - Name                            │
│   - Relationship                    │
│   - Date of Birth                   │
│ • Health Details                    │
│ • Identification Document Type      │
│ • Identification Number             │
└─────────────────────────────────────┘
```

#### **EDUCATIONAL QUALIFICATIONS**
```
┌─ EDUCATIONAL QUALIFICATIONS ────────┐
│ Education Table:                    │
│ • School/University                 │
│ • Qualification                     │
│ • Level                             │
│ • Year of Passing                   │
│ • Class/Percentage/CGPA             │
│ • Division                          │
│ • Additional Details                │
│ • Continuing Education?             │
└─────────────────────────────────────┘
```

#### **PREVIOUS WORK EXPERIENCE**
```
┌─ PREVIOUS WORK EXPERIENCE ──────────┐
│ Experience Table:                   │
│ • Company Name                      │
│ • Designation                       │
│ • Salary (Base)                     │
│ • From Date                         │
│ • To Date                           │
│ • Total Experience (Calculated)     │
│ • Details/Responsibilities          │
│ • Reference Name                    │
│ • Reference Contact                 │
└─────────────────────────────────────┘
```

#### **ATTENDANCE & LEAVE**
```
┌─ ATTENDANCE & LEAVE ────────────────┐
│ • Holiday List                      │
│ • Default Shift                     │
│ • Attendance Device ID              │
│ • Flexible Shift Request?           │
│ • Working Hours Calculation         │
│ • Allow Overlapping Shifts?         │
│ • Employee Location Settings        │
│ • Track Location Coordinates?       │
└─────────────────────────────────────┘
```

#### **SALARY DETAILS**
```
┌─ SALARY DETAILS ────────────────────┐
│ • Payroll Cost Center               │
│ • Salary Mode (Bank/Cash/Cheque)    │
│ • Bank Name                         │
│ • Bank Account Number               │
│ • IBAN                              │
│ • MICR Code                         │
│ • IFSC Code                         │
│ • Salary Currency                   │
│ • Ctc (Cost to Company)             │
│ • Employee PF Account               │
│ • Employee ESI Account              │
│ • Employee UAN                      │
└─────────────────────────────────────┘
```

#### **EXIT / SEPARATION**
```
┌─ EXIT ──────────────────────────────┐
│ • Relieving Date                    │
│ • Reason for Leaving                │
│ • Leave Encashed?                   │
│ • Leave Encashment Date             │
│ • Held On (Date)                    │
│ • New Workplace (Next Employer)     │
│ • Separation Date                   │
│ • Separation Type                   │
│ • Final Settlement Status           │
│ • Re-hire Eligible?                 │
└─────────────────────────────────────┘
```

#### **ACTIONS & BUTTONS**
```
Buttons:
[Save] [Submit] [Amend] [Delete] [Duplicate] [Export]
[Send for Approval] [Actions Dropdown]

Quick Links:
→ View Leave Applications
→ View Attendance
→ View Salary Slips
→ View Expense Claims
```

---

## 📊 4. DASHBOARDS (2 Main Dashboards)

### A. HR Dashboard

#### **OVERVIEW SECTION**
```
┌─ OVERVIEW ──────────────────────────┐
│ 📊 Total Employees: 250             │
│ 👨‍💼 Active: 245  |  🚪 Left: 5       │
│ 👥 Male: 180  |  👩 Female: 70      │
│ 🔄 On Leave: 15  |  👤 On Duty: 235 │
└─────────────────────────────────────┘
```

#### **DEPARTMENT WISE**
```
Chart Type: Bar Chart
Data Points:
• Sales: 50 employees
• IT: 45 employees
• HR: 15 employees
• Finance: 30 employees
• Operations: 110 employees
```

#### **DESIGNATION WISE**
```
Chart Type: Pie Chart (Donut)
Data Points:
• Manager: 25
• Executive: 150
• Supervisor: 45
• Others: 30
```

#### **ATTENDANCE TODAY**
```
Card Display:
🟢 Present: 240 (96%)
🔴 Absent: 5 (2%)
🟡 On Leave: 5 (2%)
🟤 Holiday: 0
```

#### **LEAVES THIS MONTH**
```
Chart Type: Line Chart
Data Points:
• Casual Leave: 45
• Sick Leave: 12
• Privilege Leave: 8
• Other Leaves: 5

Legend: Stacked Area Chart
```

#### **RECRUITMENT STATUS**
```
Card Display:
• 📋 Open Positions: 15
• 📨 Applications Received: 85
• 📞 Interviews Scheduled: 12
• 💼 Offers Released: 5
• ✅ Candidates Joined: 3
```

#### **UPCOMING**
```
• 🎂 Birthdays This Week: 5
• 💍 Work Anniversaries: 3
• ⏰ Probation Ending: 7
• 📅 Upcoming Holidays: 2
```

#### **ADDITIONAL WIDGETS**
```
• Department-wise Headcount
• New Joiners Graph
• Employee Performance Overview
• Leave Balance Summary
• Payroll Status
```

---

### B. Payroll Dashboard

#### **PAYROLL SUMMARY**
```
┌─ PAYROLL SUMMARY ───────────────────┐
│ 💰 Total Payroll: $450,000          │
│ 📅 For Month: January 2026          │
│ ✅ Processed: 245 employees         │
│ ⏳ Pending: 5 employees             │
│ 📊 Processing %: 98%                │
└─────────────────────────────────────┘
```

#### **SALARY DISTRIBUTION**
```
Chart Type: Stacked Bar Chart
Data Points:
• Basic Salary: $250,000 (55%)
• Allowances: $100,000 (22%)
• Bonuses: $50,000 (11%)
• Deductions: $50,000 (12%)
```

#### **DEPARTMENT WISE COST**
```
Chart Type: Horizontal Bar Chart
• Sales: $100,000
• IT: $120,000
• Operations: $150,000
• Finance: $40,000
• HR: $20,000
• Others: $20,000
```

#### **ADVANCES & LOANS**
```
Card Display:
• 💸 Total Advances Pending: $25,000
• 🏦 Total Loans Outstanding: $85,000
• 📊 Pending Recoveries: $110,000
• 📈 Recovery Rate This Month: 85%
```

#### **TAX SUMMARY**
```
Card Display:
• 🏛️ TDS Deducted YTD: $35,000
• 📋 PF Contribution: $28,000
• 🏥 ESI: $12,000
• 💰 Net Deduction: $75,000
```

#### **SALARY SLIP TRENDS**
```
Chart Type: Line Chart (Time Series)
• Monthly Average
• Average Net Salary
• Average Deductions
• Average Allowances
```

#### **TOP EARNERS**
```
Table Display:
1. John Doe - $4,500
2. Jane Smith - $4,200
3. Mike Johnson - $3,800
4. Sarah Williams - $3,600
5. Tom Brown - $3,400
```

#### **COMPLIANCE**
```
Status Cards:
• ✅ PF Remittance: On Time
• ✅ ESI Remittance: On Time
• ✅ TDS Filing: Pending (Due: 15th)
• ⚠️ Tax Declaration: 5 Pending
```

---

## 🎨 5. UI/UX COMPONENTS

### A. Color Scheme & Typography

#### **PRIMARY COLORS**
```
Frappe Blue:        #2490EF (Main CTA, Links)
Orange:             #F16522 (Warnings, Alerts)
Success Green:      #28A745 (Positive actions)
Danger Red:         #DC3545 (Delete, Error)
Warning Yellow:     #FFC107 (Caution, Review)
Info Cyan:          #17A2B8 (Information)
Light Gray:         #F8F9FA (Background)
Dark Gray:          #36414C (Text, Headers)
Border Gray:        #D1D5DB (Borders)
```

#### **TYPOGRAPHY**
```
Headings:           Segoe UI / -apple-system (Bold, 24px-32px)
Body Text:          Segoe UI / -apple-system (Regular, 14px)
Labels:             Segoe UI / -apple-system (Medium, 12px)
Code/Data:          Monaco / Courier (Monospace, 12px)
```

---

### B. Card Component Design

#### **Simple Stat Card**
```
┌─────────────────────────────┐
│ 📊 Card Title               │
│                             │
│    [Big Number]             │
│    Description Text         │
│                             │
│ 🔗 View Details →           │
└─────────────────────────────┘

Dimensions:
- Width: 100% or Grid (12cols = 4cols each)
- Min Height: 200px
- Padding: 20px
- Border Radius: 8px
- Shadow: 0 2px 4px rgba(0,0,0,0.1)
```

#### **Alert/Status Card**
```
┌─────────────────────────────┐
│ ⚠️ Alert Title              │
│ ─────────────────────────── │
│ Alert description text      │
│ Additional context info     │
│                             │
│ [Action Button]             │
└─────────────────────────────┘
```

---

### C. List View (Table)

#### **Employee List Example**
```
┌──────────────────────────────────────────────────────────┐
│ 🔍 Search... [+ Add New] [⚙️ Filter] [☰ More] [📄 Export] │
├──────────────────────────────────────────────────────────┤
│ ☑️ | Name        │ Dept     │ Status    │ Actions        │
├────┼──────────────┼──────────┼───────────┼────────────────┤
│ ☑️ │Tom Doe       │IT        │ 🟢 Active │ 👁️ Edit Delete  │
│ ☑️ │Jane Smith    │HR        │ 🟢 Active │ 👁️ Edit Delete  │
│ ☑️ │Mike Johnson  │Sales     │ 🔴 Left   │ 👁️ Edit Delete  │
│ ☑️ │Sarah W.      │Finance   │ 🟢 Active │ 👁️ Edit Delete  │
│ ☑️ │Tom Brown     │Ops       │ 🟡 Susp.  │ 👁️ Edit Delete  │
└────┴──────────────┴──────────┴───────────┴────────────────┘

Pagination: [← ] 1 2 3 4 5 [ →] (Select 10 rows per page)
```

#### **Bulk Actions Bar**
```
When items selected:
☑️ 5 items selected | [Delete] [Mark as...] [Export] [Actions ▼]
```

---

### D. Form View

#### **Employee Form Layout**
```
┌────────────────────────────────────────────────────────┐
│ 📋 Employee                                  ID: EMP-001│
│ ─────────────────────────────────────────────────────── │
│                                                         │
│ Tabs: [Basic Info] [Organization] [Contact] [...etc]  │
│ ─────────────────────────────────────────────────────── │
│                                                         │
│ ┌─ BASIC INFO ──────────────────────────────────────┐ │
│ │ First Name:                                       │ │
│ │ [__________ ]                                     │ │
│ │                                                   │ │
│ │ Last Name:                                        │ │
│ │ [__________ ]                                     │ │
│ │                                                   │ │
│ │ Gender:        Department:                        │ │
│ │ [▼ Select ]    [▼ Select IT ]                     │ │
│ │                                                   │ │
│ │ Date of Joining:                                  │ │
│ │ [__ /__  / ____] 📅                               │ │
│ │                                                   │ │
│ └───────────────────────────────────────────────────┘ │
│                                                         │
│ [Save] [Submit] [Cancel] [Amend] [Delete] [More ...]  │
└────────────────────────────────────────────────────────┘
```

#### **Form Features**
- Tab-based organization
- Collapsed/Expandable sections
- Required field indicators (*)
- Field validation on blur/submit
- Save indicator (Saving... / Saved ✓)
- Auto-save draft every 2 minutes

---

### E. Number Cards (KPIs)

#### **KPI Card Group**
```
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│ 👥           │  │ 📈           │  │ 💰           │
│  250         │  │  +12%        │  │  $450K       │
│ Employees    │  │ Growth       │  │ Payroll      │
│ ↑ from 220   │  │ vs last mo   │  │ for Jan      │
└──────────────┘  └──────────────┘  └──────────────┘
```

#### **Design Specs**
- Width: 100% or 1/3 of container
- Height: 150px
- Icon: 48px (center, colored)
- Main Number: 32px + 6px Letter Spacing
- Label: 12px Gray + Icon
- Trend: Green (↑) or Red (↓)

---

### F. Button Styles

#### **Primary Button**
```
[Save]    Color: #2490EF    Padding: 10px 20px
Hover: #1a6bb3   Shadow: 0 2px 4px rgba(0,0,0,0.15)
```

#### **Secondary Button**
```
[Cancel]  Color: #6C757D    Padding: 10px 20px
Border: 1px solid #6C757D
```

#### **Danger Button**
```
[Delete]  Color: #DC3545    Padding: 10px 20px
Hover: #C82333   Requires Confirmation
```

#### **Success Button**
```
[Submit]  Color: #28A745    Padding: 10px 20px
Hover: #218838
```

---

### G. Input Components

#### **Text Input**
```
Label:
[Input Field]
<optional help text>
```

#### **Select Dropdown**
```
Label:
[▼ Option 1 / Option 2 / Option 3 ...]
```

#### **Date Picker**
```
Label:
[__ /__  / ____] 📅
Inline Calendar on focus
```

#### **Search Field**
```
🔍 [Search Employee...] [X]
Real-time filtering, Suggestions
```

#### **Switch/Toggle**
```
Track Attendance: [●  OFF  ] or [ON   ●]
Boolean values
```

---

## 📱 6. MOBILE RESPONSIVE DESIGN

### A. Mobile View (< 768px)

#### **Mobile Menu Layout**
```
┌─────────────────────┐
│ ☰  Mobile Menu      │
├─────────────────────┤
│ 👤 Profile          │
│ 🏠 Home             │
│ 👥 Employees        │
│ 📅 Leave            │
│ 📊 Reports          │
│ 💬 Messages         │
│ ⚙️ Settings         │
│ 🚪 Logout           │
└─────────────────────┘
```

#### **Top Bar (Mobile)**
```
┌────────────────────────┐
│ ☰ | 🏢 HRMS | 🔔 (5)   │
└────────────────────────┘
```

#### **Dashboard (Mobile)**
```
┌────────────────────────┐
│ 👥 Employees           │
│ 250                    │
├────────────────────────┤
│ 📅 On Leave            │
│ 15                     │
├────────────────────────┤
│ ⏱️ Attendance%          │
│ 98.5%                  │
├────────────────────────┤
│ 💰 Payroll             │
│ Processing             │
├────────────────────────┤
│ Quick Actions          │
│ [Employee] [Leave]     │
│ [Attendance]           │
└────────────────────────┘
```

#### **List View (Mobile)**
```
Stack card Items vertically
Each item:
┌────────────────────────┐
│ Name: John Doe         │
│ Dept: IT               │
│ Status: 🟢 Active      │
│ 👁️ Edit               │
└────────────────────────┘
```

---

### B. Tablet View (768px - 1024px)

- 2-column grid for cards
- Full navigation sidebar
- Medium font sizes
- Touch-friendly button sizes (48px minimum)

---

## 🔐 7. USER ROLES & PERMISSIONS

### Role Hierarchy
```
┌─────────────────────────────────────────┐
│ System Manager (Full Access)            │
│ ├─ HR Manager (All HR Actions)          │
│ │  ├─ HR User (Read/Create/Edit)        │
│ │  └─ Leave Approver (Approvals Only)   │
│ ├─ Payroll Manager (Payroll Full)       │
│ │  └─ Payroll User (View/Process)       │
│ ├─ Recruitment Manager (Full Recruit)   │
│ │  ├─ Interviewer (Interview Only)      │
│ │  └─ Job Opening Creator               │
│ ├─ Employee (Self Service Only)         │
│ │  ├─ View Own Profile                  │
│ │  ├─ Apply Leave                       │
│ │  ├─ Expense Claims                    │
│ │  └─ Attendance View                   │
│ └─ Reports Viewer (View Only)           │
└─────────────────────────────────────────┘
```

### Permission Matrix

| DocType | Mgr | User | Emp | View |
|---------|-----|------|-----|------|
| Employee | C+E | E | S | R |
| Leave App | C+E | C+E | C | R |
| Attendance | C+E | C+ | - | R |
| Expense Claim | C+E | C+E | C | - |
| Salary Slip | C+E | R | S | - |
| Appraisal | C+E | C | S | - |
| Job Opening | C+E | C+E | - | R |

**Legend:** C=Create, E=Edit, R=Read, S=Self, +=Approve/Submit

---

## ⚙️ 8. SETTINGS PAGES

### HR Settings
```
┌─ HR SETTINGS ───────────────────────┐
│ ☐ Auto Attendance                   │
│ ☑️ Stop Birthday Reminders           │
│ ☑️ Email Salary Slip                 │
│ ☑️ Encrypt Salary Slip               │
│ ☑️ Leave Approval Notification       │
│ ☑️ Attendance Approval Mandatory     │
│ ☑️ Expense Approver Mandatory       │
│ ☑️ Send Mail To Employee             │
│                                      │
│ Retirement Age: [65]                │
│ Default Shift: [▼ Select]            │
│ Default Holiday List: [▼ Select]    │
│                                      │
│ [Save Settings]                     │
└─────────────────────────────────────┘
```

### Leave Settings
```
┌─ LEAVE SETTINGS ───────────────────┐
│ ☑️ Auto Carry Forward               │
│ Max Days To Carry Forward: [10]      │
│ ☑️ Pro-rata Leave                   │
│ ☑️ Allow Negative Carry Forward      │
│ ☑️ Notify On Leave Extension        │
│ Notification Days Before: [2]       │
│                                      │
│ [Save Settings]                     │
└─────────────────────────────────────┘
```

### Attendance Settings
```
┌─ ATTENDANCE SETTINGS ───────────────┐
│ ☑️ Auto Mark Attendance              │
│ ☑️ Mark Checkin As Present          │
│ Default Late Threshold (Mins): [30]  │
│ ☑️ Auto Attendance From Devices     │
│ Device Type: [▼ Select]              │
│ ☑️ Email Attendance Report           │
│                                      │
│ [Save Settings]                     │
└─────────────────────────────────────┘
```

### Payroll Settings
```
┌─ PAYROLL SETTINGS ──────────────────┐
│ Payroll Frequency: [Monthly ▼]       │
│ Payroll Period: [1-30 ▼]             │
│ ☑️ Auto Salary Slip Generation      │
│ ☑️ Email Salary Slip                │
│ ☑️ Show Deduction Breakup           │
│ ☑️ Show Vehicle Log In Payroll      │
│ Default Bank Account: [▼ Select]    │
│                                      │
│ [Save Settings]                     │
└─────────────────────────────────────┘
```

---

## 📋 Summary Statistics

### DocTypes Count
- **Total DocTypes:** 150+
- **HR DocTypes:** 95+
- **Payroll DocTypes:** 30+
- **Setup DocTypes:** 25+

### Reports Count
- **Total Reports:** 40+
- **Query Reports:** 30+
- **Script Reports:** 10+

### Workspaces Count
- **Total Workspaces:** 9
- **Dashboard Pages:** 2
- **Setup Pages:** Multiple

### Fields Per Module
- **Employee Master:** 100+ fields
- **Salary Slip:** 80+ fields
- **Leave Application:** 30+ fields
- **Attendance:** 25+ fields

---

## 🎯 Design Guidelines for Figma

### Figma Artboard Sizes
```
Desktop:    1920px × 1080px (Full HD)
Tablet:     1024px × 768px
Mobile:     375px × 812px (iPhone X)
```

### Grid System
- **12 Column Grid**
- **Gutter:** 16px
- **Margin:** 20px

### Component Library
Create reusable components:
- [ ] Buttons (All Variants)
- [ ] Input Fields
- [ ] Cards (Stat, Info, Action)
- [ ] Headers & Footers
- [ ] Navigation Components
- [ ] Modal/Dialog
- [ ] Notification Toast
- [ ] Breadcrumb
- [ ] Tab Component
- [ ] Table/List Items

### States to Design
- **Default State**
- **Hover State**
- **Active State**
- **Disabled State**
- **Loading State**
- **Error State**
- **Success State**

---

## 📝 Design Tips for Figma

1. **Use Auto Layout** for responsive design
2. **Create Component Variants** for different states
3. **Use Master Components** for consistency
4. **Color Style Guide** for quick access
5. **Typography System** for font consistency
6. **Spacing System** (8px, 16px, 24px, 32px)
7. **Shadow System** for depth
8. **Icon Library** for consistency

---

## 🔗 Related Documentation

- **Frappe Framework:** https://frappe.io/docs
- **ERPNext HRMS:** https://docs.erpnext.com/docs/user/manual/en/human-resources
- **Design System:** Follow Frappe Design System

---

**Created:** February 6, 2026  
**Last Updated:** February 6, 2026  
**Version:** 1.0  
**Status:** Ready for Figma Design

---

## 📞 Support & Contact

For questions or clarifications about this guide:
- Refer to ERPNext official documentation
- Check Frappe GitHub repositories
- Contact development team

