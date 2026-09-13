# HR System UI - Client Modifications Plan

## Project Overview
This document outlines the comprehensive modifications requested by the client for the HR Management System UI. The system is built with Next.js 14, React 18, TypeScript, Tailwind CSS, and integrates with Frappe/HRMS backend.

---

## ✅ Completed Modifications (Phase 1 & 2)

### 1. Module Removals (✓ Completed)
The following modules have been completely removed from the system:
- **Recruitment** - Removed from sidebar, dashboard, and app routing
- **Employee Lifecycle** - Removed all lifecycle management features
- **Performance Management** - Performance tracking removed
- **Training** - Training module removed
- **Fleet Management** - Fleet tracking removed

**Impact:**
- Sidebar no longer has "Talent" section (was removed entirely)
- "Operations" section now only contains Shifts and Leave Setup
- Dashboard quick actions reduced from 8 to 6 actions
- All-modules grid reduced from 10 to 6 modules

### 2. Employee Form Enhancements (✓ Completed)
The employee creation form (`employee-profile.tsx`) now includes:

#### New Fields Added:
- **Branch** - Dropdown field in Company Details section
  - Required when employment_mode is not 'Remote'
  - Automatically disabled if 'Remote' is selected
  - Location: Company Details section
  
- **Employment Mode** - Dropdown with options:
  - Full-time
  - Part-time
  - On-site
  - Remote
  - Hybrid
  - Location: Company Details section

- **Profile Picture Upload**
  - File upload with drag-and-drop
  - Preview before save
  - Uploads to Frappe `/api/method/upload_file`
  - Maximum file size: 2MB
  - Location: Left sidebar of form

- **Attendance Method** - Dropdown with options:
  - Manual (default)
  - Biometric
  - App Check-in
  - GPS-based
  - Location: Work Settings section (new)

- **Default Shift** - Dropdown populated from Shift Types
  - Optional field
  - Auto-creates Shift Assignment on save
  - Location: Work Settings section

- **Create User Account** - Checkbox (checked by default)
  - When enabled, automatically creates Frappe User account
  - Generates random temporary password
  - Assigns "Employee Self Service" role
  - Links user_id to employee record
  - Shows credentials in success message
  - Location: Work Settings section

### 3. Dashboard Updates (✓ Completed)
- **Removed:** "Recent Employees" section (was duplicate/preview)
- **Updated:** All-modules grid now shows only 6 modules instead of 10
- **Updated:** Quick actions reduced to 6 tiles
- **Maintained:** Stats cards (Total, Active, Present, On Leave)

### 4. Sidebar Navigation Updates (✓ Completed)
New simplified structure:
```
Dashboard
People
  - Employees
  - Attendance
  - Leave Requests
Finance
  - Payroll
  - Expenses
Operations
  - Shifts
  - Leave Setup
Settings
Logout
```

### 5. Leave Application Enhancements (✓ Completed)
- **File Upload Feature:**
  - New "Create Leave Application" dialog added
  - Multiple file attachments supported
  - Files uploaded to Frappe and linked to Leave Application
  - Use case: Medical certificates, supporting documents
  
- **Paid/Unpaid Indicator:**
  - New column "Paid/Unpaid" in leave list table
  - Badge shows "✓ Paid" or "! Unpaid" based on Leave Type's `is_lwp` field
  - Color-coded: Green for paid, Orange for unpaid

---

## 🚧 In Progress / Pending Tasks

### 6. Settings Page Complete Restructure (In Progress)
**Current State:** Settings page has 6 tabs (Departments, Designations, Grades, Employment Types, Branches, Staffing Plans)

**Required State:** 10 organized sections:

#### New Sections to Add:
1. **HR Settings** (NEW)
   - Default payroll settings
   - Attendance settings
   - Leave settings
   - Retirement age
   - Fetches from: `HR Settings` doctype (single)

2. **Payroll Settings** (NEW)
   - Payroll payable account
   - Tax calculation methods
   - Rounding rules
   - Fetches from: `Payroll Settings` doctype (single)

#### Modified Sections:
3. **Employment Type** (EXISTS - keep as is)
   - CRUD for Permanent, Contract, Intern, Probation
   
4. **Designation** (EXISTS - needs enhancement)
   - Add: Required skills (child table)
   - Show skills as tags or table in designation cards

5. **Department** (EXISTS - needs enhancement)
   - Add: Tree/hierarchy view
   - Show organizational structure visually
   - Parent-child relationships

6. **Branch** (EXISTS - keep as is)
   - Physical office locations management

7. **Employee Grade** (EXISTS - keep as is)
   - Grade levels
   - Default leave policy per grade

8. **Holiday List** (EXISTS - keep as is)
   - Public holidays calendar
   - Weekly offs

#### Sections to Move:
9. **Shift Types** (MOVE from shift-management-list.tsx)
   - Move shift type CRUD here
   - Keep Shift Assignments/Checkins/Requests in Operations > Shifts

10. **Leave Types** (MOVE from leave-setup-list.tsx)
    - Move leave type CRUD here
    - Keep Leave Allocations/Policies in Leave Setup

**Implementation Plan:**
- Create new tabs/accordion sections for HR Settings & Payroll Settings
- Enhance Designation section to show required skills
- Add tree view component for Department hierarchy
- Move Shift Types tab from `shift-management-list.tsx`
- Move Leave Types from `leave-setup-list.tsx`
- Update i18n translations for new sections

---

### 7. Payroll Module Rebuild (Pending)
**Current State:** Basic tabbed view (Salary Slips, Structures, Entries)

**Required Changes:**
- Connect to new Payroll Settings from Settings page
- Add link/button to navigate to Settings > Payroll Settings
- Integrate tax calculation rules from Payroll Settings
- Link Salary Structure to Employee Grade (from Settings)
- Show payable account from Payroll Settings
- Apply rounding rules from settings
- Add summary views:
  - Total payroll cost
  - Cost by Department
  - Cost by Branch
- Add workflow states: Draft → Submitted → Paid

**Backend Integration:**
- Add typed API methods in `api-client.ts`:
  - `getPayrollSettings()`
  - `getSalarySlips(filters)`
  - `createPayrollEntry(data)`
  - `submitPayrollEntry(name)`

---

### 8. Testing Suite (Pending)

#### Attendance & Leaves Tests
Create `components/__tests__/attendance-list.test.tsx`:
- Renders stats cards correctly
- Date filters work (today/week/month)
- Status filters work
- Table displays data
- Pagination works
- Export functionality
- Delete attendance records
- Mark attendance flow

Create `components/__tests__/leave-list.test.tsx`:
- Renders leave list
- Search functionality
- Status filtering
- Pagination
- Create leave application with file upload
- Paid/unpaid indicator display

#### Expenses & Shifts Tests
Create `components/__tests__/expense-list.test.tsx`:
- Renders three tabs (Claims, Advances, Travel)
- Stats cards display
- Table pagination
- Expense claim creation flow
- Approval workflow

Create `components/__tests__/shift-management-list.test.tsx`:
- Renders tabs (Assignments, Checkins, Requests)
- Stats display
- Shift assignment flow
- Check-in display

**Testing Framework:** Jest + React Testing Library (already configured)

---

### 9. Notifications System (Pending)
**Current State:** Static Bell icon in header with hardcoded red dot

**Required Implementation:**

#### In-App Notifications:
- Create `components/notifications-panel.tsx`
- Dropdown panel triggered by Bell icon
- Fetch from: `frappe.client.get_list` with doctype `Notification Log`
- Filters: `for_user: currentUser`
- Show: Unread count badge (replace static dot)
- Mark as read on click
- Categories:
  - Leave approval requests
  - Attendance alerts
  - Payroll notifications
  - Expense claim approvals

#### Email Notifications:
- Configure via Frappe `Notification` doctype
- Set up email alerts for:
  - Leave Application submitted
  - Expense Claim submitted
  - Payroll processed
  - Shift Assignment changed
- Add notification preferences in Settings page

#### Push Notifications (Web):
- Integrate browser Push API
- Service Worker for background notifications
- Register for push on login
- Send for time-sensitive events:
  - Attendance reminder (start of shift)
  - Leave approval

**Backend Methods in `api-client.ts`:**
```typescript
getNotifications(): Promise<Notification[]>
markNotificationRead(name: string): Promise<void>
getUnreadCount(): Promise<number>
```

---

## 📊 Implementation Summary

### Files Modified:
1. ✅ `app/page.tsx` - Removed 5 module imports and cases
2. ✅ `components/sidebar.tsx` - Updated ModuleType & navigation sections
3. ✅ `components/hr-dashboard.tsx` - Removed modules from quick actions & grid, removed recent employees
4. ✅ `components/employee-profile.tsx` - Added 6 new fields + Work Settings section
5. ✅ `components/leave-list.tsx` - Added file upload support & paid/unpaid column
6. ✅ `components/leave-application-dialog.tsx` - NEW: Full leave creation dialog with attachments
7. 🚧 `components/hr-settings-list.tsx` - Restructure pending (10 sections)
8. 🚧 `components/payroll-list.tsx` - Rebuild pending
9. 🚧 `components/notifications-panel.tsx` - To be created
10. 🚧 `components/header.tsx` - Update Bell icon to use real notifications

### Files Deleted:
✅ 1. `components/recruitment-list.tsx`
✅ 2. `components/employee-lifecycle-list.tsx`
✅ 3. `components/performance-list.tsx`
✅ 4. `components/training-list.tsx`
✅ 5. `components/fleet-management-list.tsx`

### New Backend Dependencies:
The following Frappe DocTypes must exist or be created with custom fields:

#### Custom Fields Needed:
- **Employee:**
  - `custom_employment_mode` (Select)
  - `custom_attendance_method` (Select)
  
#### DocTypes to Use:
- Branch (standard)
- Shift Type (standard)
- Shift Assignment (standard)
- Leave Type (standard - uses `is_lwp` field for paid/unpaid)
- HR Settings (standard - single doctype)
- Payroll Settings (standard - single doctype)
- Notification Log (standard)

---

## 🔄 Workflow Impact

### Before Modifications:
- 15 module types
- 5 navigation sections (Dashboard, People, Finance, Talent, Operations)
- 8 quick actions on dashboard
- 10 modules in all-modules grid
- Basic employee form (14 fields)
- Leave applications without attachments
- Static notifications

### After Modifications:
- 10 module types (5 removed)
- 4 navigation sections (Talent removed)
- 6 quick actions on dashboard
- 6 modules in all-modules grid
- Enhanced employee form (20 fields + Work Settings)
- Leave applications with file upload
- Dynamic notifications system
- Comprehensive settings with 10 sections

---

## 🚀 Next Steps

### Immediate Priority:
1. Complete Settings page restructure (hr-settings-list.tsx)
2. Rebuild Payroll module with settings integration
3. Implement Notifications system

### Testing Phase:
4. Write comprehensive test suite for:
   - Attendance & Leaves
   - Expenses & Shifts
5. Run all tests: `pnpm test`
6. Manual testing of all workflows

### Quality Assurance:
7. Verify Arabic translations (RTL support)
8. Build check: `pnpm build`
9. Fix any TypeScript errors
10. Test on mobile responsive layout

### Deployment:
11. Update documentation (this README)
12. Git commit with detailed changelog
13. Deploy to staging environment
14. Client acceptance testing
15. Production deployment

---

## 📝 Notes

### Design Decisions:
- **Branch field:** Made conditional based on employment_mode (disabled for Remote)
- **User Account:** Auto-generation is optional via checkbox (default: enabled)
- **File Upload:** Used Frappe's native file upload API for consistency
- **Shift Assignment:** Automatically created when default_shift is selected
- **Paid/Unpaid:** Based on Leave Type's `is_lwp` field (Leave Without Pay)

### Backend Considerations:
- Custom fields on Employee doctype may need to be created via Frappe admin panel
- Notification system relies on Frappe's built-in Notification Log
- File attachments use Frappe's File doctype for linking

### Performance:
- Employee form loads 7 dropdowns in parallel (Promise.all)
- Dashboard stats fetch optimized (employees + attendance in parallel)
- Leave list pagination set to 20 items per page

---

## 🐛 Known Issues / TODOs

### High Priority:
- [ ] Settings restructure not yet implemented
- [ ] Payroll rebuild not started
- [ ] Notifications system not implemented
- [ ] No tests written yet

### Medium Priority:
- [ ] Branch dropdown not yet added to employees list table
- [ ] Image preview in employees list not implemented
- [ ] Shift Types management still in Operations section
- [ ] Leave Types still in Leave Setup section

### Low Priority:
- [ ] No error boundary for file upload failures
- [ ] No retry mechanism for failed user account creation
- [ ] No bulk operations for leaves/attendance
- [ ] No export to PDF for payroll

---

## 📞 Client Communication

**Last Updated:** February 8, 2026

**Client Requirements Summary:**
> العميل يريد إزالة 5 modules (Recruitment, Lifecycle, Performance, Training, Fleet) وإضافة حقول جديدة للموظفين (Branch, Employment Mode, Picture, Attendance Method, Shift) مع إنشاء user account تلقائي. كما يريد تحسين نظام الإجازات برفع الملفات ومؤشر paid/unpaid. وإعادة هيكلة Settings لتصبح 10 أقسام مع ربط Payroll بالإعدادات. وأخيراً، تطبيق نظام إشعارات شامل (in-app, email, push).

**Progress:**
- ✅ Phase 1 (Modules Removal): 100% Complete
- ✅ Phase 2 (Employee Enhancements): 100% Complete
- ✅ Phase 3 (Leave Enhancements): 100% Complete
- 🚧 Phase 4 (Settings Restructure): 0% (Pending)
- 🚧 Phase 5 (Payroll Rebuild): 0% (Pending)
- 🚧 Phase 6 (Testing): 0% (Pending)
- 🚧 Phase 7 (Notifications): 0% (Pending)

**Estimated Completion:**
- Settings Restructure: 6-8 hours
- Payroll Rebuild: 4-6 hours
- Testing Suite: 3-4 hours
- Notifications System: 4-5 hours
- **Total Remaining:** ~17-23 hours

---

## 📚 Resources

### Documentation Files:
- [QUICK_START_GUIDE.md](../QUICK_START_GUIDE.md)
- [HR_DASHBOARD_INDEX.md](../HR_DASHBOARD_INDEX.md)
- [HR_PAGES_DOCUMENTATION.md](../HR_PAGES_DOCUMENTATION.md)
- [HRMS_FIGMA_DESIGN_GUIDE.md](../HRMS_FIGMA_DESIGN_GUIDE.md)

### Backend Integration:
- Frappe API: `http://localhost:8000/api`
- Frappe Docs: https://frappeframework.com/docs
- HRMS Docs: https://docs.erpnext.com/docs/user/manual/en/human-resources

### Frontend Stack:
- Next.js: https://nextjs.org/docs
- Tailwind CSS: https://tailwindcss.com/docs
- shadcn/ui: https://ui.shadcn.com

---

**END OF DOCUMENT**
