# Changelog — User-to-Sales-Person Lookup Fix

**Date:** 2026-02-19  
**Type:** Bug Fix / Design Improvement  
**Scope:** Backend (2 Python files) + Documentation (1 section)

---

## Problem

The system was identifying "which Sales Person is this logged-in user?" by checking `Sales Person.mobile_app_user` first.  
This was wrong for internal field reps who are already linked through the standard ERPNext HR chain (`Employee.user_id`).

---

## Files Changed

### 1. `apps/erpnext/erpnext/selling/page/sales_rep_dashboard/sales_rep_dashboard.py`

**Function:** `get_sales_person_for_user()`

**Before:**
```python
def get_sales_person_for_user():
    user = frappe.session.user
    # Direct link via mobile_app_user
    sales_person = frappe.db.get_value(
        "Sales Person", {"mobile_app_user": user},
        ["name", "sales_person_name"], as_dict=True
    )
    if sales_person:
        return sales_person
    # Fallback: resolve via Employee
    employee = frappe.db.get_value("Employee", {"user_id": user}, "name")
    if employee:
        return frappe.db.get_value(
            "Sales Person", {"employee": employee},
            ["name", "sales_person_name"], as_dict=True
        )
    return None
```

**After:**
```python
def get_sales_person_for_user():
    """Lookup order:
    1. Employee.user_id -> Sales Person.employee  (primary, standard HR chain)
    2. Sales Person.mobile_app_user              (fallback, legacy / external agents)
    """
    user = frappe.session.user
    # Primary: resolve via the standard HR chain
    employee = frappe.db.get_value("Employee", {"user_id": user}, "name")
    if employee:
        sales_person = frappe.db.get_value(
            "Sales Person", {"employee": employee},
            ["name", "sales_person_name"], as_dict=True
        )
        if sales_person:
            return sales_person
    # Fallback: direct link via mobile_app_user
    return frappe.db.get_value(
        "Sales Person", {"mobile_app_user": user},
        ["name", "sales_person_name"], as_dict=True
    )
```

---

### 2. `apps/erpnext/erpnext/selling/discount_validation.py`

**Function:** `get_sales_person_for_current_user()`

**Before:**
```python
def get_sales_person_for_current_user():
    try:
        user = frappe.session.user
        # Direct link via mobile_app_user
        sales_person = frappe.db.get_value("Sales Person", {"mobile_app_user": user}, "name")
        if sales_person:
            return sales_person
        # Fallback: resolve via Employee
        employee = frappe.db.get_value("Employee", {"user_id": user}, "name")
        if employee:
            return frappe.db.get_value("Sales Person", {"employee": employee}, "name")
        return None
    except Exception as e:
        frappe.log_error(...)
        return None
```

**After:**
```python
def get_sales_person_for_current_user():
    """Lookup order:
    1. Employee.user_id -> Sales Person.employee  (primary)
    2. Sales Person.mobile_app_user              (fallback)
    """
    try:
        user = frappe.session.user
        # Primary
        employee = frappe.db.get_value("Employee", {"user_id": user}, "name")
        if employee:
            sales_person = frappe.db.get_value("Sales Person", {"employee": employee}, "name")
            if sales_person:
                return sales_person
        # Fallback
        return frappe.db.get_value("Sales Person", {"mobile_app_user": user}, "name")
    except Exception as e:
        frappe.log_error(...)
        return None
```

---

### 3. `SALES_ADMIN_FRONTEND_DOCUMENTATION.md` — Section 10

**What changed:**
- Added a lookup chain diagram explaining the new resolution order
- Updated the `Key Fields` table: `employee` marked as **Primary**, `mobile_app_user` marked as **Fallback only**
- Added a **3-step creation flow** (User → Employee → Sales Person)
- Added a helper query to check if a user is already linked to an Employee
- Updated the `get_sales_person_for_user` API description
- Updated the `Doctype Reference Summary` row for `Sales Person`

---

## New Lookup Chain (both files)

```
frappe.session.user
       │
       ▼ PRIMARY
Employee.user_id == user
       │
       └─► Sales Person.employee == that Employee  →  ✅ resolved

       │ (only if no Employee match found)
       ▼ FALLBACK
Sales Person.mobile_app_user == user  →  ✅ resolved
```

---

## What Was NOT Changed

| Item | Reason |
|------|--------|
| `setup_custom_fields.py` | Only declares the `mobile_app_user` field — no lookup logic |
| `mobile_app_user` field itself | Kept as fallback for external agents without HR Employee records |
| `discount_approval_request.py` | Had no `mobile_app_user` reference at all |
| Frontend (`crm-micro-4`) | No `mobile_app_user` references exist in the frontend |

---

## Tests Run

```
✅ SYNTAX OK: sales_rep_dashboard.py
✅ SYNTAX OK: discount_validation.py
✅ ORDER CORRECT in discount_validation.py: Employee.user_id (line 36) BEFORE mobile_app_user (line 43)
✅ ORDER CORRECT in sales_rep_dashboard.py: Employee.user_id (line 21) BEFORE mobile_app_user (line 32)
```
