# Inventory Management Module

A full-featured inventory management system built on top of **Frappe/ERPNext**, integrated into the Base Meena frontend.

---

## Features

| Feature | Description |
|---|---|
| **Products** | Browse, search, create, and manage items with full details |
| **Barcode Scanning** | Scan barcodes via device camera when searching or creating items |
| **Warehouses** | View and manage warehouse list with stock levels |
| **Stock Transfers** | Create and track stock transfer requests between warehouses |
| **Stock Reconciliation** | Perform physical stock counts and reconcile differences |
| **Purchase Requests** | Raise and manage internal purchase requests |

---

## Components

```
components/inventory/
├── inventory-management.tsx   # Main entry — Products, Warehouses, Transfers, Reconciliation
├── purchase-requests-view.tsx # Purchase requests management
└── readme.me                  # This file
```

---

## Barcode Scanning

The item search input and the **New Product** dialog both support live barcode scanning using the device camera (powered by `html5-qrcode`).

- Click the **Scan** button next to the Item Code field
- Point the camera at a barcode or QR code
- The decoded value is automatically populated into the field

---

## API

All inventory API calls are handled via `lib/stock-api.ts` which communicates with the Frappe REST API:

| Method | Endpoint | Description |
|---|---|---|
| `getItems()` | `GET /api/resource/Item` | Fetch item list |
| `createItem()` | `POST /api/resource/Item` | Create new item |
| `getWarehouses()` | `GET /api/resource/Warehouse` | Fetch warehouses |
| `createStockEntry()` | `POST /api/resource/Stock Entry` | Create stock transfer |
| `getStockBalance()` | Frappe method | Get current stock levels |

---

## Usage

The inventory page is accessible at `/inventory` and is protected by role-based access control. Users need the `Stock Manager` or `Stock User` role to access it.
