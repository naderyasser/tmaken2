# Daily Route Plan — Frontend Developer Guide

> **DocType:** `Daily Route Plan`  
> **Is Submittable:** Yes (Draft → Active → Completed / Cancelled)  
> **Auto-name format:** `ROUTE-{sales_person}-{route_date}` (e.g. `ROUTE-Nader Yasser-2026-02-20`)

---

## Required Fields

| Field | Type | Required | Notes |
|---|---|---|---|
| `route_date` | Date `"YYYY-MM-DD"` | ✅ | The date of the route |
| `sales_person` | Link → Sales Person | ✅ | Use the Sales Person `name` field |
| `customers` | Child table | ✅ | At least one customer row required |
| `territory` | Link → Territory | — | Optional |
| `notes` | Text | — | Optional |

---

## `customers` Child Row Fields (`Route Plan Customer`)

| Field | Type | Required | Default | Notes |
|---|---|---|---|---|
| `sequence` | Int | ✅ | — | Order of the stop (1, 2, 3…) |
| `customer` | Link → Customer | ✅ | — | Customer `name` field |
| `customer_name` | Data | — | auto-fetched | Read-only, fetched from Customer |
| `visit_type` | Select | — | `Regular Visit` | See valid values below |
| `priority` | Select | — | `Medium` | `High` / `Medium` / `Low` |
| `scheduled_time` | Time `"HH:MM:SS"` | — | — | **Planned arrival time** for this stop |
| `estimated_duration_minutes` | Int | — | `30` | Expected visit duration in minutes |
| `notes` | Small Text | — | — | Special instructions for this stop |

### Read-only child fields (auto-populated on submit)

| Field | Description |
|---|---|
| `visit_created` | `0` / `1` — whether a Sales Person Visit was auto-created |
| `visit` | Link to the auto-created `Sales Person Visit` |
| `visit_status` | Synced from the linked visit via `update_visit_status` |

### Valid `visit_type` Values

> ⚠️ These are the Route Plan's own values — **different from** Sales Person Visit's values.

| Value | Mapped to on the auto-created Visit |
|---|---|
| `Regular Visit` *(default)* | `Follow-up` |
| `Follow-up` | `Follow-up` |
| `New Customer` | `Sales Order` |
| `Urgent` | `Follow-up` |

### Valid `priority` Values

`High` / `Medium` *(default)* / `Low`

---

## Read-only Parent Fields (auto-calculated)

| Field | Description |
|---|---|
| `status` | `Draft` → `Active` (on submit) → `Completed` (auto) / `Cancelled` |
| `total_customers` | Count of rows in `customers` table |
| `visited_customers` | Count of rows where `visit_status == "Completed"` |
| `pending_customers` | `total_customers - visited_customers` |
| `docstatus` | `0` = Draft, `1` = Submitted, `2` = Cancelled |

---

## Status Flow

```
Draft (docstatus=0)
  │
  ▼ Submit
Active (docstatus=1, status="Active")
  │  → Auto-creates a "Scheduled" Sales Person Visit for every customer row
  │  → If scheduled_time was set, it's copied to the visit's scheduled_check_in_time
  │
  ├──► [auto] Completed (when all visits are done — via update_visit_status)
  └──► Cancel → Cancelled (docstatus=2)
            └─ All "Scheduled" visits are auto-cancelled
```

---

## Backend Behavior on Submit

When a plan is submitted, for each customer row the backend:

1. Creates a `Sales Person Visit` with status `Scheduled`
2. Maps `visit_type` from the route plan's values → the visit's valid values
3. **Copies `scheduled_time` → `scheduled_check_in_time`** on the visit (so on-time logic works)
4. Sets `visit_created = 1` and links the `visit` on the child row

### Backend Behavior on Cancel

When a plan is cancelled:
1. All linked visits that are still `Scheduled` are auto-set to `Cancelled`
2. Visits that are already `In Progress` or `Completed` are **not touched**

### Auto-completion

When you call `update_visit_status` and all visits are either `Completed` or `Cancelled`, the plan's status automatically changes to `Completed`.

---

## Validation Rules

| Rule | Error if violated |
|---|---|
| Same customer listed twice | `Customer {X} appears more than once in the route.` |
| Invalid `visit_type` | `Visit Type cannot be {}. Must be one of...` |
| `sequence` missing | `MandatoryError: sequence` |
| `customer` missing | `MandatoryError: customer` |
| One plan per rep per date | `ValidationError: already exists` (because name is `ROUTE-{rep}-{date}`) |

---

## API Operations

### 1 — Create (Draft)

```
POST /api/resource/Daily Route Plan
Content-Type: application/json
```

```json
{
  "route_date": "2026-02-21",
  "sales_person": "Nader Yasser",
  "territory": "Riyadh",
  "notes": "Morning route - industrial area",
  "customers": [
    {
      "sequence": 1,
      "customer": "Ayman",
      "visit_type": "Regular Visit",
      "priority": "High",
      "scheduled_time": "09:00:00",
      "estimated_duration_minutes": 30,
      "notes": "Check stock levels"
    },
    {
      "sequence": 2,
      "customer": "CUST-0002",
      "visit_type": "New Customer",
      "priority": "Medium",
      "scheduled_time": "10:00:00",
      "estimated_duration_minutes": 45
    },
    {
      "sequence": 3,
      "customer": "CUST-0003",
      "scheduled_time": "11:30:00"
    }
  ]
}
```

**Response:**
```json
{
  "data": {
    "name": "ROUTE-Nader Yasser-2026-02-21",
    "docstatus": 0,
    "status": "Draft",
    "total_customers": 3,
    "visited_customers": 0,
    "pending_customers": 3,
    ...
  }
}
```

---

### 2 — Submit (Activate + Create Visits)

> ⚠️ **Two-step pattern required.** Frappe uses optimistic locking — the `modified` timestamp changes after insert (hooks recalculate totals). You must re-fetch before submitting.

**Step A — Re-fetch the doc:**
```
GET /api/resource/Daily Route Plan/ROUTE-Nader Yasser-2026-02-21
```

**Step B — Submit with the full doc from Step A:**
```
POST /api/method/frappe.client.submit
Content-Type: application/json

{
  "doc": { ...entire response.data from Step A... }
}
```

**TypeScript helper:**
```ts
async function createAndSubmitRoutePlan(payload: object) {
  // 1. Create draft
  const created = await api.post("/api/resource/Daily Route Plan", payload);
  const name = created.data.name;

  // 2. Re-fetch (timestamp changed due to on-save hooks)
  const latest = await api.get(`/api/resource/Daily Route Plan/${name}`);

  // 3. Submit with fresh doc
  const submitted = await api.post("/api/method/frappe.client.submit", {
    doc: latest.data,
  });

  return submitted;
}
```

**After submit:**
- `docstatus` → `1`, `status` → `"Active"`
- A `Sales Person Visit` (status `"Scheduled"`) is created for each customer
- Each visit gets `scheduled_check_in_time` from the customer row's `scheduled_time`

---

### 3 — List Plans

```
GET /api/resource/Daily Route Plan
  ?fields=["name","route_date","sales_person","status","territory",
           "total_customers","visited_customers","pending_customers","docstatus"]
  &order_by=route_date desc
  &limit_page_length=500
```

**Filter by rep:**
```
&filters=[["sales_person","=","Nader Yasser"]]
```

**Filter by status:**
```
&filters=[["status","in","Draft,Active"]]
```

**Filter by date range:**
```
&filters=[["route_date",">=","2026-02-01"],["route_date","<=","2026-02-28"]]
```

---

### 4 — Get Single Plan (with customers child table)

```
GET /api/resource/Daily Route Plan/ROUTE-Nader Yasser-2026-02-21
```

Returns the full document including the `customers` child table rows with `visit`, `visit_status`, `visit_created`, `scheduled_time`, `estimated_duration_minutes`, etc.

---

### 5 — Update (Draft only)

Only `docstatus=0` (Draft) plans can be edited.

```
PUT /api/resource/Daily Route Plan/ROUTE-Nader Yasser-2026-02-21
Content-Type: application/json
```

```json
{
  "territory": "Jeddah",
  "notes": "Updated route",
  "customers": [
    { "sequence": 1, "customer": "Ayman", "scheduled_time": "09:30:00" },
    { "sequence": 2, "customer": "CUST-0003", "scheduled_time": "11:00:00" }
  ]
}
```

> ⚠️ Sending `customers` **replaces** the entire child table. If you want to add a stop, fetch the existing rows first and include them all.

**To update a single field only (without touching customers):**
```
POST /api/method/frappe.client.set_value

{
  "doctype": "Daily Route Plan",
  "name": "ROUTE-Nader Yasser-2026-02-21",
  "fieldname": { "territory": "Jeddah" }
}
```

---

### 6 — Cancel (Submitted plans only)

```
POST /api/method/frappe.client.cancel
Content-Type: application/json

{ "doctype": "Daily Route Plan", "name": "ROUTE-Nader Yasser-2026-02-21" }
```

Sets `docstatus=2`, `status="Cancelled"`. All visits still in `Scheduled` status are auto-cancelled. Visits already `In Progress` or `Completed` are not affected.

---

### 7 — Delete

| State | Action |
|---|---|
| **Draft** (`docstatus=0`) | Delete directly |
| **Submitted** (`docstatus=1`) | Cancel first, then delete |
| **Cancelled** (`docstatus=2`) | Delete directly |

```
DELETE /api/resource/Daily Route Plan/ROUTE-Nader Yasser-2026-02-21
```

---

### 8 — Sync Visit Statuses (Refresh Progress)

Call this to pull the latest status from each linked visit and update `visited_customers` / `pending_customers`. If all are done, the plan auto-completes.

```
POST /api/resource/Daily Route Plan/ROUTE-Nader Yasser-2026-02-21
Content-Type: application/json

{ "run_method": "update_visit_status" }
```

**Use this for:** a "Refresh" button on the route plan detail page, or on a polling interval.

---

### 9 — Get Suggested Customers for a Rep

```
POST /api/method/erpnext.selling.doctype.daily_route_plan.daily_route_plan.get_suggested_customers
Content-Type: application/json

{
  "sales_person": "Nader Yasser",
  "route_date": "2026-02-21",
  "territory": "Riyadh",
  "include_due": true,
  "max_distance_km": 10
}
```

**Response:**
```json
[
  {
    "name": "Ayman",
    "customer_name": "Ayman Trading",
    "last_visit_date": "2026-02-10",
    "visit_frequency_days": 7,
    "customer_lat": "24.688",
    "customer_lng": "46.722",
    "territory": "Riyadh",
    "priority": "High",
    "days_since_visit": 11
  }
]
```

**Priority logic:**
- `"High"` — never visited, or overdue by more than 20% of their frequency
- `"Medium"` — due but not yet overdue

**Sorting:** High priority first, then most overdue first.

Use this to populate a customer picker when creating a new route plan.

---

## Common Errors & Fixes

| Error | Cause | Fix |
|---|---|---|
| `MandatoryError: sequence` | Using `visit_sequence` instead of `sequence` | Rename field to `sequence` |
| `ValidationError: Visit Type cannot be {}` | Using Sales Person Visit values like `Sales Order` | Use Route Plan values: `Regular Visit`, `Follow-up`, `New Customer`, `Urgent` |
| `TimestampMismatchError` | Submitting with stale `modified` timestamp | Re-fetch doc between create and submit |
| `ValidationError: already exists` | Two plans for same rep + date | Name is `ROUTE-{rep}-{date}` — unique per rep per day |
| `ValidationError: Customer X appears more than once` | Duplicate customer in the route | Remove the duplicate row |

---

## State Reference

| `docstatus` | `status` | Visits created? | Editable? | Deletable? |
|---|---|---|---|---|
| `0` | `Draft` | No | ✅ | ✅ |
| `1` | `Active` | ✅ (auto on submit) | ❌ | Cancel first |
| `1` | `Completed` | Already done | ❌ | Cancel first |
| `2` | `Cancelled` | Scheduled ones auto-cancelled | ❌ | ✅ |

---

## Full Create → Submit → Monitor Flow (TypeScript)

```ts
// 1. Get suggested customers
const suggestions = await api.post(
  "/api/method/erpnext.selling.doctype.daily_route_plan.daily_route_plan.get_suggested_customers",
  {
    sales_person: "Nader Yasser",
    route_date: "2026-02-21",
    territory: "Riyadh",
    include_due: true,
  }
);

// 2. Build the payload (user picks customers + sets times in the UI)
const payload = {
  route_date: "2026-02-21",
  sales_person: "Nader Yasser",
  territory: "Riyadh",
  customers: [
    { sequence: 1, customer: "Ayman", scheduled_time: "09:00:00", priority: "High" },
    { sequence: 2, customer: "CUST-0002", scheduled_time: "10:30:00" },
  ],
};

// 3. Create + submit (always re-fetch between create and submit!)
const created = await api.post("/api/resource/Daily Route Plan", payload);
const latest = await api.get(`/api/resource/Daily Route Plan/${created.data.name}`);
await api.post("/api/method/frappe.client.submit", { doc: latest.data });

// 4. Later — refresh visit progress
await api.post(`/api/resource/Daily Route Plan/${created.data.name}`, {
  run_method: "update_visit_status",
});

// 5. Re-fetch to check if auto-completed
const plan = await api.get(`/api/resource/Daily Route Plan/${created.data.name}`);
console.log(plan.data.status);           // "Active" or "Completed"
console.log(plan.data.visited_customers); // e.g. 2
console.log(plan.data.pending_customers); // e.g. 0
```
