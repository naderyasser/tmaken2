# Progress Report — HR Management System UI

**Team Member:** Nader Yasser  
**Team Leader:** Ahmed Yasser  
**Reporting Period:** Sprint covering the most recent development cycle

---

## Executive Summary

This sprint focused on **hardening the HRMS frontend** across three critical areas: **security vulnerabilities**, **payroll document lifecycle correctness**, and **biometric filter reliability**. A comprehensive security audit identified and resolved 8 security issues (including API proxy path traversal, LIKE injection, and credential exposure in toasts) and 7 bug fixes. On the payroll side, the Salary Structure Assignment and Additional Salary flows were re-engineered to properly handle Frappe's submitted-document workflow — cancelling before edit/delete and submitting after creation — eliminating a class of errors where operations on submitted docs would silently fail. Biometric log filters were cleaned up to remove conflicting filter duplication. Together, these changes significantly reduce the surface area for security exploits and make the payroll module production-ready.

---

## 🔒 Security Fixes (S1–S8)

| ID | Issue | Resolution | Files Changed |
|----|-------|------------|---------------|
| S1 | API proxy accepted arbitrary paths, allowing path traversal (`..`) and protocol-relative URLs (`//`); CORS used wildcard `*` origin | Implemented path allowlisting (`/api/method/`, `/api/resource/`, `/api/frappe/`), blocked dangerous methods (`frappe.client.delete`, `frappe.client.bulk_update`), added 10MB request size limit, switched CORS to reflect request origin | `app/api/frappe/route.ts` |
| S2 | Wildcard subdomain matching in `client-config.ts` allowed `evil-example.com` to match `*.example.com` | Changed matching to require a dot separator: `domain === baseDomain \|\| domain.endsWith('.' + baseDomain)` | `lib/client-config.ts` |
| S3 | LIKE wildcards (`%`, `_`, `\`) in search queries were unescaped, enabling LIKE injection in `stock-api.ts` | Added `escapeLike()` utility that escapes `\`, `%`, and `_` before interpolation | `lib/stock-api.ts` |
| S4 | Employee creation success toast displayed the user's plaintext password | Removed password from toast; message now says "A password reset link has been sent to their email" | `components/employee-profile.tsx` |
| S5 | `shift-management-list.tsx`, `employees-list.tsx`, and `sales-reps-list.tsx` used raw `fetch()` bypassing CSRF/auth tokens | Replaced all `fetch()` calls with `frappeClient` methods (`frappeClient.post()`, `frappeClient.put()`, `frappeClient.get()`, `frappeClient.getList()`, `frappeClient.delete()`) | `components/shift-management-list.tsx`, `components/employees-list.tsx`, `components/sales/sales-reps-list.tsx` |
| S6 | Employee delete flow interpolated email into URL for user lookup/deletion, breaking on special characters | Replaced with `frappeClient.getList()` for filtering and `frappeClient.delete()` for proper encoding | `components/employees-list.tsx` |
| S7 | CSV export in `customers-list.tsx` and `salary-statistics.tsx` did not escape commas, quotes, or newlines | Added `escapeCsv()` function with proper RFC 4180 escaping; also added `URL.revokeObjectURL()` to prevent memory leaks | `components/sales/customers-list.tsx`, `components/payroll/salary-statistics.tsx` |
| S8 | PWA meta tags in `sales-rep/layout.tsx` were added to `<head>` dynamically but never cleaned up on unmount, causing DOM leaks | Replaced `querySelector` checks with tracked `addedElements[]` array; added cleanup `return` in `useEffect` to remove elements on unmount | `app/sales-rep/layout.tsx` |

---

## 🐛 Bug Fixes (B1–B7)

| ID | Bug | Fix | Files Changed |
|----|-----|-----|---------------|
| B1 | `route-map-page.tsx` used `forEach` + `async` — polylines rendered out of order before `fitBounds` | Replaced with `for...of` sequential async iteration; changed `return` to `continue` inside the loop | `components/sales/route-map-page.tsx` |
| B2 | `app/admin/sales/page.tsx` had no `<Toaster />`, so toast notifications never appeared | Added `<Toaster />` component | `app/admin/sales/page.tsx` |
| B3 | `leave-application-dialog.tsx` hardcoded company fallback `'fayez'` and had no guard if company was missing | Removed hardcoded fallback; added early return with toast error if employee has no company | `components/leave-application-dialog.tsx` |
| B4 | `salary-structures.tsx` hardcoded currency as `'EGP'` instead of using the active company's currency | Replaced with `useCompany()` hook, defaulting to `'SAR'` when company is unavailable | `components/payroll/salary-structures.tsx` |
| B5 | `biometric-prompt.tsx` had `disabled` prop always `true`, `onVerified` callback was unreachable dead code | Wired `disabled` prop to `<Button>` directly; added `onClick` handler that calls `onVerified(true, 'fingerprint')` when enabled | `components/biometric-prompt.tsx` |
| B6 | `simple-expense.tsx` was an empty file (0 bytes) with no exports — dead code | Deleted the file entirely | `components/simple-expense.tsx` |
| B7 | PWA metadata cleanup (see S8 above — tracked with both security and bug dimensions) | — | `app/sales-rep/layout.tsx` |

---

## 💰 Payroll Module — Document Lifecycle Overhaul

### Salary Structure Assignment (SSA)

- **Cancel-before-edit pattern:** Previously, editing a submitted SSA would attempt an `update` call that Frappe rejects on submitted docs. The new flow cancels the existing SSA via `frappe.client.cancel`, then creates a fresh SSA and submits it.
- **Cancel-before-delete pattern:** Deleting an SSA now cancels it first before calling `deleteSalaryStructureAssignment`.
- **Created vs. mutated:** `updateSalaryStructureAssignment` is no longer used for existing assignments. A new assignment is created each time to avoid Frappe docstate violations.
- **Company fallback fix:** In `additional-salary.tsx`, the company fallback incorrectly used `selectedEmployee?.name` (employee ID) instead of `selectedEmployee?.company`. Fixed to use `activeCompany`.
- **State mutation fix:** In `salary-structure-assignment.tsx`, pushing to the `structures` array directly mutated React state. Replaced with `setStructures(prev => [...prev, selectedStructure!])`.
- **Fields addition:** Added `company` and `currency` fields to the Additional Salary creation payload, required by Frappe for submission.
- **docstatus filtering:** Added `docstatus != 2` (cancelled) filter to both SSA and Additional Salary list queries so cancelled documents don't clutter the UI.

**Files changed:**
- `components/payroll/salary-structure-assignment.tsx`
- `components/payroll/additional-salary.tsx`
- `components/employee/employee-profile.tsx`
- `components/__tests__/employee-profile-salary-assignment.test.tsx`
- `components/payroll/__tests__/salary-structure-assignment.test.tsx`
- `components/payroll/__tests__/additional-salary.test.tsx`

### Additional Salary

- **Submit after create:** New Additional Salary records are now automatically submitted via `frappe.client.submit` after creation.
- **Cancel before delete:** Before deleting, the system cancels the document via `frappe.client.cancel`.
- **Required fields:** Added `company`, `currency`, and `overwrite_salary_structure_amount` to the creation payload.
- **Amount validation:** Added a guard to reject zero or negative amounts before submission.

### Employee Profile — Salary Integration

- Added `date_of_joining > date_of_birth` validation (`dojAfterDob` translation key) to prevent nonsensical date combinations.
- SSA creation now includes `company` field from the employee record.
- On edit, the old SSA is cancelled and a new one is created+submitted, matching the same cancel-then-create pattern used in the standalone SSA component.

---

## 🔍 Biometric Module — Filter Fix

- Removed duplicate/conflicting `branch` and `work_shift_system` filters from the classification filter pass-through in `BiometricLogsTab`. These filters were being applied **in addition to** the dedicated branch and shift-type dropdowns, causing conflicting WHERE clauses and empty result sets.
- Added `hideBranch` prop to the `EmployeeClassificationFilters` component call to prevent the branch filter from appearing at all in the biometric context.
- Wired the "Clear" button to reset `classFilters` state to `{}`, ensuring all classification filters are properly cleared.

**Files changed:** `components/biometric/biometric-logs-tab.tsx`

---

## 📄 Documentation

- Updated `README.md` with comprehensive descriptions of the Accounting, Cashier, Purchases, Tasks, and Biometrics modules (145 additions, 19 deletions).

---

## 🧪 Test Coverage Additions

| Test File | Scope |
|-----------|-------|
| `components/payroll/__tests__/salary-structure-assignment.test.tsx` | Updated to verify cancel-before-edit/delete SSA flow; added `docstatus` field assertion; tests `frappeClient.call('frappe.client.cancel')` invocation |
| `components/payroll/__tests__/additional-salary.test.tsx` | Added `frappeClient.get` and `frappeClient.call` mocks; asserts `company` and `currency` in payload; verifies cancel-before-delete and submit-after-create |
| `components/__tests__/employee-profile-salary-assignment.test.tsx` | New 352-line test suite covering employee creation with salary assignment, cancel-then-create SSA on edit, company field propagation, and date validation |
| `components/__tests__/self-service-profile.test.tsx` | Added new test cases (18 additions) |

---

## ♻️ Refactoring & Architecture

- **Replaced raw `fetch()` with `frappeClient`** across 3 components (`shift-management-list`, `employees-list`, `sales-reps-list`) for consistent CSRF, auth cookie, and error handling.
- **Payroll standardization:** Established the cancel → create → submit pattern as the canonical way to handle Frappe submitted documents across all payroll components.
- **Removed dead code:** Deleted empty `simple-expense.tsx`, removed inline comments from `biometric-prompt.tsx`.

---

## 📊 Summary Metrics

| Metric | Count |
|--------|-------|
| Security issues resolved | 8 |
| Bug fixes | 7 |
| Payroll lifecycle changes | 6 |
| Biometric filter fixes | 1 |
| Files modified (source) | ~20 |
| New/updated test cases | 4 files |
| Documentation updates | 1 file |