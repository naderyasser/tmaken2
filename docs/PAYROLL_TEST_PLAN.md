# Payroll System — Manual QA Test Plan

> **Version**: 1.0  
> **Target Release**: Base Meena v3  
> **Tester**: Engineer Ahmed Yasser / Product QA Team  
> **Test Environment**: Staging (qarawi.base.meena.sa)

---

## 1. Penalty Policy Manager (`لائحة الجزاءات`)

| ID | Test Case | Steps | Expected Result |
|----|-----------|-------|-----------------|
| PP-01 | Load existing policy | Navigate to Payroll → Penalty Policy tab | Policy form loads with existing rules (if any) or empty form with company pre-filled |
| PP-02 | Create new policy | Fill Policy Name, leave defaults, add 2 rules, click Save | Toast: "Policy created and submitted". Redirected back. Policy loads with saved rules |
| PP-03 | Amend existing policy | Change one rule's 1st occurrence from 10% to 15%, click Save | Toast: "Policy amended and submitted". Old policy cancelled, new one active |
| PP-04 | Add rule to table | Click "Add Rule" button | New row appears with default values (delay_15, 0-15 min, Warning/5%/10%/20%) |
| PP-05 | Delete rule from table | Click trash icon on a rule row | Row removed from table immediately |
| PP-06 | Set Warning type | Set all 4 occurrences to "Warning", Save | Each occurrence shows no value input. Policy saves successfully |
| PP-07 | Fixed Amount penalty | Set occurrence to "Fixed Amount", enter 50. Save | Amount field visible. Policy saves with fixed amount |
| PP-08 | Percentage of Daily Wage | Set occurrence to "Percentage of Daily Wage", enter 25. Save | Value field shows % placeholder. Policy saves with percentage |
| PP-09 | Validation — empty name | Clear Policy Name, click Save | Toast: "Policy name and company are required" |
| PP-10 | Validation — no rules | Remove all rules, click Save | Toast: "At least one rule is required" |

---

## 2. Smart Deductions — Manual Mode (`خصم حر`)

| ID | Test Case | Steps | Expected Result |
|----|-----------|-------|-----------------|
| SD-01 | Open manual form | Navigate to Deductions tab → Click "Add Deduction" | Dialog opens with Manual mode selected |
| SD-02 | Select employee | Pick an employee from dropdown | Blue info card appears with Base Salary and Shift Hours. Hourly Rate auto-fills |
| SD-03 | Edit hourly rate | Manually change the hourly rate value | The value updates. HR can override |
| SD-04 | Calculate total | Fill Reason, Hours=2, Multiplier=2x | Red total card shows: `hours × multiplier × rate = -total` |
| SD-05 | Submit manual deduction | Fill all fields, click Submit | Toast: "Deduction created successfully". Deduction appears in table |
| SD-06 | Delete deduction | Click trash icon → confirm | Toast: "Deduction deleted". Row removed from table |
| SD-07 | Date picker | Click date field → select a date from calendar | Formatted date shown in button. Shadcn calendar works in both LTR/RTL |

---

## 3. Smart Deductions — Policy Matrix Mode (`تطبيق اللائحة`)

| ID | Test Case | Steps | Expected Result |
|----|-----------|-------|-----------------|
| SM-01 | Switch to matrix mode | Click "Policy Matrix" radio | Policy loads from API. Violation type dropdown populates from active policy |
| SM-02 | Policy loading skeleton | Wait for API response while no policy cached | Skeleton loader appears briefly, then dropdowns populate |
| SM-03 | No policy fallback | Navigate when no active policy exists | Amber card: "No active penalty policy found. Please create one..." |
| SM-04 | Select violation type | Choose "Delay up to 15 minutes" | Occurrence dropdown activates |
| SM-05 | Select occurrence & calculate | Choose "2nd time" | Total card shows deduction = Daily Wage × policy percentage |
| SM-06 | Warning outcome | Select a violation+occurrence that maps to Warning | Amber Warning card: "Written Warning. No deduction applied." |
| SM-07 | Submit matrix deduction | Fill all fields, click Submit | Toast: "Deduction created successfully". Description field sent to backend |

---

## 4. Penalty Engine (Backend Automation)

| ID | Test Case | Steps | Expected Result |
|----|-----------|-------|-----------------|
| PE-01 | Manual trigger UI | Navigate to Auto-Attendance page | Orange "Run Penalty Engine" button visible next to green "Run Now" |
| PE-02 | Confirmation dialog | Click "Run Penalty Engine" | Dialog: "This will process all unprocessed check-ins..." with Run/Cancel buttons |
| PE-03 | Engine runs successfully | Confirm → wait | Loading spinner on button → success toast with stats (processed X, Y violations) |
| PE-04 | Check-in flagged | After engine run, check a check-in record in Frappe Desk | `custom_penalty_processed` = 1 |
| PE-05 | Violation log created | After engine run, check `Employee Violation Log` list | New records with: employee, violation_type, occurrence, minutes_late, penalty_applied |
| PE-06 | Additional Salary created | Check `Additional Salary` list for deductions | New record with: type=Deduction, auto-generated description, linked to employee |
| PE-07 | Idempotency | Run engine twice for same date | Second run: 0 processed, 0 violations. No duplicates |
| PE-08 | Grace period respected | Employee late by 3 min when grace=5 min | No violation log created. Check-in still flagged as processed |
| PE-09 | On-time check-in | Employee checks in before shift start | No violation. Check-in flagged as processed |
| PE-10 | Occurrence counting | Create 3 violations of same type in one month | 1st=occurrence 0, 2nd=1, 3rd=2. Each gets correct penalty from matrix |
| PE-11 | Scheduled job runs | Wait for daily cron (or trigger bench execute manually) | `bench execute base_meena.penalty_management.penalty_engine.process_daily_attendance_penalties` — works |

---

## 5. Payroll Processing Cycle (`إغلاق الشهر`)

| ID | Test Case | Steps | Expected Result |
|----|-----------|-------|-----------------|
| PR-01 | Create payroll entry | Fill frequency, start/end dates. Click Create | Step 1 completes (green check). Badges show company, frequency, dates, entry number |
| PR-02 | Fetch employees | Click Fetch Employees | Step 2 completes. Badge: "N employees loaded" |
| PR-03 | Generate salary slips | Click Generate Salary Slips | Loading state. Step 3 completes. Badge: "Slips generated" |
| PR-04 | Submit salary slips | Click Submit Salary Slips | Step 4 completes. Badge: "Submitted" in green |
| PR-05 | Salary slip includes penalties | Check a generated Salary Slip in Frappe Desk | Deduction section includes the auto-generated Penalty Deduction |
| PR-06 | New Entry button | Click "New Entry" after completing cycle | All steps reset. Form clears for new entry |
| PR-07 | Error — no employees loaded | Click Fetch Employees when no salary structure assignments | Toast with error message from backend |
| PR-08 | Error — attendance missing | Try submit with unmarked attendance | Toast with error message (if backend rejects) |

---

## 6. Cross-Module Integration

| ID | Test Case | Steps | Expected Result |
|----|-----------|-------|-----------------|
| CM-01 | Penalty → Payroll flow | 1. Run Penalty Engine (creates deductions) → 2. Process Payroll (generates slips) | Salary Slip includes the auto-generated penalty deduction amount |
| CM-02 | Policy change → Deduction form | 1. Update Penalty Policy rules → 2. Open Deduction form in matrix mode | Violation dropdown reflects new/updated violation types |
| CM-03 | Employee with no salary | Select employee with no Salary Structure Assignment → try manual deduction | Error or toast: "Employee has no base salary assigned" |
| CM-04 | Zero base salary edge case | Employee has assignment but base=0 | Daily Wage = 0. Percentage deduction = 0. No negative amounts |

---

## 7. Localization (RTL/Arabic)

| ID | Test Case | Steps | Expected Result |
|----|-----------|-------|-----------------|
| LC-01 | Arabic labels | Switch to Arabic. Navigate all payroll tabs | All tab labels, buttons, and form fields show Arabic text |
| LC-02 | Date picker Arabic | Open date picker in matrix mode | Calendar shows Arabic month names |
| LC-03 | Number formatting | Check deduction amounts in Arabic mode | Numbers formatted with Arabic numerals (١٢٣) and SAR currency |
| LC-04 | RTL layout | Arabic mode active | All forms, tables, dialogs render right-to-left. Suffix positions correct |

---

## 8. Edge Cases & Negative Scenarios

| ID | Test Case | Steps | Expected Result |
|----|-----------|-------|-----------------|
| EC-01 | Negative deduction amount | Try to create a deduction with negative amount | Form validation prevents it (min=0) |
| EC-02 | Employee on leave | Employee has approved leave on check-in date | Penalty engine skips (or attendance already "On Leave") |
| EC-03 | Off-shift check-in | Check-in with `offshift=1` | Penalty engine skips (filters `offshift=0`) |
| EC-04 | Already processed check-in | Submit a check-in that was already processed | Penalty engine skips (filters `custom_penalty_processed=0`) |
| EC-05 | Missing shift | Check-in with no `shift` set | Penalty engine skips (filters `shift is set`) |
| EC-06 | Concurrent penalty engine runs | Two admins trigger engine simultaneously | No duplicate violations (idempotent) |
| EC-07 | No active Penalty Policy | Run engine when policy doesn't exist | Engine logs warning, skips all, no crashes |
| EC-08 | Salary component not found | No "Penalty Deduction" component in DB | Engine auto-creates one and continues |
| EC-09 | Large batch (100+ check-ins) | Run engine with 100+ unprocessed check-ins | Processes all without timeout. Stats correct |
| EC-10 | Company mismatch | Check-in employee from Company A, policy for Company B | Employee's own company used for policy lookup. Correct policy applied |

---

## 9. Accounting Integration (Frappe Desk Verification)

| ID | Test Case | Steps | Expected Result |
|----|-----------|-------|-----------------|
| AC-01 | Journal Entry created | After submitting payroll entry → check Journal Entry list | Accrual JE created with debit to salary accounts, credit to Payroll Payable |
| AC-02 | Salary Slip balances | Open generated Salary Slips | Gross Pay = sum of earnings. Net Pay = Gross - Deductions - Loan Repayment |
| AC-03 | Loan repayment | Employee has active loan → payroll processed | Loan repayment appears in salary slip. JE includes loan account entries |
| AC-04 | Multi-company isolation | Process payroll for Company A only | Only Company A employees in the entry. Only Company A slips generated |

---

## Sign-Off

| Role | Name | Date | Signature |
|------|------|------|-----------|
| QA Engineer | | | |
| HR Product Lead | | | |
| Engineering Lead | | | |
