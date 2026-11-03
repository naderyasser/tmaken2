# 🎨 Sales Rep Mobile App — Full UI/UX Identity Guide

> **For new frontend developers joining the project.**
> This document covers every design decision, color, component pattern, animation, spacing, and interaction used in the `/sales-rep` mobile-first application.

---

## 📋 Table of Contents

1. [App Overview](#app-overview)
2. [Tech Stack](#tech-stack)
3. [Design Philosophy](#design-philosophy)
4. [Color System](#color-system)
5. [Typography](#typography)
6. [Layout & Spacing](#layout--spacing)
7. [Component Patterns](#component-patterns)
8. [Page-by-Page Breakdown](#page-by-page-breakdown)
9. [Animations](#animations)
10. [Icons](#icons)
11. [RTL & Internationalization](#rtl--internationalization)
12. [Dark Mode](#dark-mode)
13. [Responsive Behavior](#responsive-behavior)
14. [PWA & Installability](#pwa--installability)

---

## App Overview

The **Sales Rep App** is a mobile-first web application used by field sales representatives (مندوبين مبيعات) to:
- View their assigned customers sorted by GPS distance
- Create new customers on-the-fly
- Place sales orders from their personal inventory (van stock)
- Withdraw/return products from customer inventory
- Apply discounts and generate invoices
- Track inventory movements

The UI language is **Arabic (RTL)** and all text is right-to-left.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | **Next.js** (App Router, `"use client"` pages) |
| UI Library | **shadcn/ui** (Radix primitives + Tailwind) |
| Styling | **Tailwind CSS** with CSS variables (HSL) |
| Icons | **Lucide React** |
| Fonts | **Inter** (Latin) + **Noto Sans Arabic** (Arabic) |
| State | React Context (`SalesRepContext`) + `useState`/`useEffect` |
| Backend | **Frappe/ERPNext** REST API |

---

## Design Philosophy

| Principle | Implementation |
|-----------|---------------|
| **Mobile-first** | All pages designed for 375px+ screens, then scale up with `md:` breakpoints |
| **Card-based UI** | Every data group lives inside a `<Card>` with `rounded-2xl` |
| **Touch-friendly** | Buttons are `h-11` to `py-6` (44-48px+ tap targets) |
| **Bottom-sticky actions** | Primary actions fixed to the bottom of the viewport |
| **Gradient headers** | Hero sections use blue→indigo gradients with `rounded-b-[2rem]` |
| **No sidebar** | Unlike the admin panel, the sales rep has no sidebar — full-screen mobile UX |
| **Minimal navigation** | Back arrows (`ArrowRight` in RTL) + bottom action buttons |

---

## Color System

### Primary Palette (CSS Variables — Light Mode)

```
--primary:            217 91.2% 59.8%   →  hsl(217, 91%, 60%)  →  #4B8BF5 (Blue)
--primary-foreground: 0 0% 100%         →  #FFFFFF
--background:         0 0% 100%         →  #FFFFFF
--foreground:         217 32.6% 17.5%   →  #1E293B (Slate-900)
--muted:              0 0% 96.3%        →  #F5F5F5
--muted-foreground:   217 16.9% 48.6%   →  #64748B (Slate-500)
--destructive:        0 84.2% 60.2%     →  #EF4444 (Red)
--border:             0 0% 93.3%        →  #EDEDED
--card:               0 0% 100%         →  #FFFFFF
--ring:               217 91.2% 59.8%   →  Blue (focus rings)
```

### Hardcoded Colors Used in Sales Rep Pages

| Purpose | Tailwind Class | Hex Value | Where Used |
|---------|---------------|-----------|------------|
| **Header gradient start** | `from-blue-600` | `#2563EB` | Dashboard hero header |
| **Header gradient middle** | `via-blue-700` | `#1D4ED8` | Dashboard hero header |
| **Header gradient end** | `to-indigo-800` | `#3730A3` | Dashboard hero header |
| **Page background** | `bg-slate-50` | `#F8FAFC` | All pages body |
| **Card background** | `bg-white` | `#FFFFFF` | All cards |
| **Primary action button** | `bg-blue-600` / `hover:bg-blue-700` | `#2563EB` | "أنا وصلت" button |
| **CTA on header** | `bg-white text-blue-700` | White on blue | "إضافة عميل جديد" |
| **Active tab** | `data-[state=active]:bg-blue-600` | `#2563EB` | Tab triggers |
| **Tab background** | `bg-white` | `#FFFFFF` | `TabsList` container |
| **Customer group badge** | `bg-emerald-100 text-emerald-700` | `#D1FAE5` / `#047857` | Customer cards |
| **Distance indicator** | `bg-blue-50 text-blue-600` | `#EFF6FF` / `#2563EB` | Distance circle |
| **Stock quantity** | `text-green-600` | `#16A34A` | Inventory amounts |
| **Stock card border** | `border-green-200 bg-green-50/50` | `#BBF7D0` | Inventory items |
| **Withdraw/return area** | `bg-orange-50 border-orange-200` | `#FFF7ED` / `#FED7AA` | Withdraw sections |
| **Withdraw button** | `border-orange-500 text-orange-600` | `#F97316` / `#EA580C` | "سحب منتج" |
| **Submit/confirm** | `bg-emerald-600 hover:bg-emerald-700` | `#059669` / `#047857` | Final invoice submit |
| **Destructive tab** | `bg-destructive` | `#EF4444` | "لم يتم التنزيل" tab |
| **Info card** | `bg-blue-50 border-blue-200` | `#EFF6FF` / `#BFDBFE` | Info alerts |
| **Selected item border** | `border-primary bg-primary/5` | Blue with 5% opacity | Selected product card |
| **Incoming stock** | `bg-green-100 text-green-600` | `#DCFCE7` / `#16A34A` | Stock ledger IN |
| **Outgoing stock** | `bg-red-100 text-red-600` | `#FEE2E2` / `#DC2626` | Stock ledger OUT |
| **Voucher: Stock Entry** | `bg-blue-100 text-blue-700` | `#DBEAFE` / `#1D4ED8` | Badge |
| **Voucher: Delivery Note** | `bg-orange-100 text-orange-700` | `#FFEDD5` / `#C2410C` | Badge |
| **Voucher: Sales Invoice** | `bg-green-100 text-green-700` | `#DCFCE7` / `#15803D` | Badge |
| **Voucher: Purchase Receipt** | `bg-purple-100 text-purple-700` | `#F3E8FF` / `#7E22CE` | Badge |

### Color Semantic Map

```
🔵 Blue (#2563EB)     → Primary actions, navigation, branding, active states
🟢 Green (#16A34A)    → Success, stock available, positive quantities, confirm/submit
🟠 Orange (#F97316)   → Warnings, withdrawals, returns, attention needed
🔴 Red (#EF4444)      → Destructive actions, "no order" flow, errors
🟣 Purple (#7E22CE)   → Secondary data (purchase receipts)
⚫ Slate (#1E293B)    → Text headings, high-emphasis content
⚪ Slate-50 (#F8FAFC) → Page backgrounds
```

---

## Typography

### Font Stack
```css
/* Arabic (primary for sales rep - RTL) */
font-family: 'Noto Sans Arabic', -apple-system, sans-serif;
font-weight: 500; /* Default for Arabic */

/* Latin fallback */
font-family: 'Inter', sans-serif;
```

### Font Sizes Used

| Element | Tailwind | Approx Size |
|---------|----------|-------------|
| Page title (header) | `text-2xl font-bold` | 24px, 700 |
| Section heading | `text-lg font-bold` | 18px, 700 |
| Card title | `text-base font-bold` | 16px, 700 |
| Body text | `text-sm` | 14px, 400-500 |
| Small labels | `text-xs` | 12px |
| Tiny text | `text-[10px]` | 10px |
| Large number (stat) | `text-2xl font-bold` to `text-3xl font-bold` | 24-30px |
| Button text | `text-base font-bold` | 16px, 700 |
| CTA button | `text-lg font-bold` | 18px, 700 |

### Text Colors

| Role | Class |
|------|-------|
| Primary heading | `text-slate-800` or `text-foreground` |
| Secondary text | `text-muted-foreground` or `text-slate-500` |
| Hint/caption | `text-muted-foreground/60` or `text-slate-500` |
| White on dark | `text-white` (headers), `text-blue-100` (sub-header) |
| Link/action | `text-blue-600 hover:text-blue-700` |

---

## Layout & Spacing

### Page Structure Pattern

```
┌──────────────────────────────┐
│  Gradient Header (rounded-b) │  ← bg-gradient-to-br from-blue-600 ... rounded-b-[2rem]
│  pt-8, px-5, pb-8           │
│  ┌────────────────────────┐  │
│  │ Title + Refresh + Stat │  │
│  └────────────────────────┘  │
│  ┌────────────────────────┐  │
│  │ CTA Button (full-width)│  │  ← bg-white text-blue-700, rounded-2xl, py-6
│  └────────────────────────┘  │
└──────────────────────────────┘
┌──────────────────────────────┐
│  Content Area                │  ← px-4 md:px-6, py-5
│  ┌────────────────────────┐  │
│  │ TabsList (2 columns)   │  │  ← bg-white, rounded-2xl, h-14, p-1.5
│  └────────────────────────┘  │
│  ┌────────────────────────┐  │
│  │ Card (customer/item)   │  │  ← p-4, rounded-2xl, border-slate-200
│  └────────────────────────┘  │
│  ┌────────────────────────┐  │
│  │ Card (customer/item)   │  │
│  └────────────────────────┘  │
└──────────────────────────────┘
┌──────────────────────────────┐
│  Fixed Bottom Bar            │  ← fixed bottom-0, bg-card, border-t-2, z-20
│  ┌────────────────────────┐  │
│  │ Total + Action Button  │  │  ← px-4 py-4
│  └────────────────────────┘  │
└──────────────────────────────┘
```

### Sub-page Structure (no gradient)

```
┌──────────────────────────────┐
│  Sticky Header               │  ← bg-primary, sticky top-0, z-10, shadow-lg
│  [←] Title [Action]          │  ← py-5, px-4 md:px-6
└──────────────────────────────┘
┌──────────────────────────────┐
│  Content                     │  ← px-4 md:px-6, py-6, pb-24 (for bottom bar)
│  ...                         │
└──────────────────────────────┘
```

### Spacing Rules

| Context | Value |
|---------|-------|
| Page horizontal padding | `px-4 md:px-6` (16px → 24px) |
| Card internal padding | `p-4` or `p-5` |
| Space between cards | `space-y-3` or `space-y-4` |
| Header top padding | `pt-8 md:pt-10` |
| Bottom padding (for fixed bar) | `pb-24` or `pb-28` or `pb-36` |
| Gap between flex items | `gap-2` to `gap-4` |
| Section margin bottom | `mb-4` to `mb-6` |

### Border Radius

| Element | Value |
|---------|-------|
| Cards | `rounded-2xl` (16px) |
| Buttons | `rounded-xl` (12px) or `rounded-2xl` (16px) |
| Badges | Default from shadcn |
| Header bottom | `rounded-b-[2rem]` (32px) |
| Icons in circles | `rounded-xl` (12px) or `rounded-full` |
| Tab triggers | `rounded-xl` (12px) |
| Quantity controls | `rounded-full` |
| Input fields | Default (6px from shadcn) |

---

## Component Patterns

### 1. Customer Card
```
┌──────────────────────────────────────┐
│  Customer Name  [Group Badge]        │  ← font-bold, emerald badge
│  📍 Territory                        │  ← text-slate-500, text-sm
│  🕐 Last Visit: date  |  ض: TAX_ID  │  ← text-xs, text-slate-500
│                                      │
│  [────── أنا وصلت ──────] [المخزون]  │  ← blue-600, outline
└──────────────────────────────────────┘
                                    ┌──────┐
                    Distance →      │ 2.3  │  ← bg-blue-50, text-blue-600
                                    │  كم  │
                                    └──────┘
```

### 2. Inventory Item Card
```
┌──────────────────────────────────────┐
│  [IMG]  Item Name                 45 │  ← green-600, text-3xl
│         item_code              وحدة  │
│         stock_uom                    │
│         السعر: 125.00 ر.س           │
└──────────────────────────────────────┘
Border: border-2 border-green-200 bg-green-50/50
```

### 3. Product Selection Card (Order Flow)
```
┌──────────────────────────────────────┐
│  [IMG]  Product Name                 │
│         UOM                          │
│         [Group Badge]  125.00 ر.س    │
│         متوفر: 50 وحدة              │
│         [المحدد: 3]                  │
│                                      │
│  [−]  3  [+]         (quantity)      │  ← bg-primary/10 rounded-full
└──────────────────────────────────────┘
Selected: border-primary bg-primary/5
Unselected: border-border
```

### 4. Bottom Action Bar
```
┌──────────────────────────────────────┐
│  إجمالي المنتجات      [إنهاء الطلب] │
│  3 منتج (text-2xl)   (rounded-2xl)  │
└──────────────────────────────────────┘
Always: fixed bottom-0, bg-card, border-t-2, shadow-lg, z-20
```

### 5. Loading State
```
         ⟳  (animate-spin, text-primary)
    جاري تحميل البيانات...
```
Icon: `Loader2` with `animate-spin text-primary`, centered with `min-h-screen flex items-center justify-center`

### 6. Empty State
```
    📦  (w-16 h-16, text-muted-foreground/50)
    لا يوجد عملاء
    لم يتم تعيين عملاء لك بعد
```
Icon: contextual (User, Package, etc.), `text-muted-foreground/50`, followed by bold title + muted description.

### 7. Error State
```
    ⚠️  (w-16 h-16, text-destructive)
    خطأ
    {error message}
    [إعادة المحاولة]  ← variant="outline"
```

### 8. Stat Card
```
┌──────────────────────┐
│  [Icon]  Number      │
│          Label       │
└──────────────────────┘
```
Two variants:
- `bg-primary/5 border-primary/30` with primary-colored icon
- `bg-blue-50 border-blue-200` with blue icon

### 9. Tab System
```
┌────────────────────────────────┐
│  [  العملاء  ] [  مخزوني   ]  │  ← grid grid-cols-2, bg-white, p-1.5
└────────────────────────────────┘
Active: data-[state=active]:bg-blue-600 text-white shadow-md
Inactive: transparent
Height: h-14
Shape: rounded-2xl (container), rounded-xl (triggers)
```

---

## Page-by-Page Breakdown

### `/sales-rep` — Dashboard (Main Page)
- **Header**: Gradient hero with welcome message, GPS status, refresh button, customer count stat
- **CTA**: Full-width white button "إضافة عميل جديد"
- **Tabs**: العملاء (Customers) | مخزوني (My Inventory)
- **Customers tab**: Sorted by GPS distance, each in a Card with action buttons
- **Inventory tab**: Stats grid (2 cols) + stock items list with green borders

### `/sales-rep/new-order` — New Order (Multi-stage)
- **Stage 1 (New Customer)**: Customer info form with gradient header, inputs in a Card
- **Stage 2 (Wants Order?)**: Simple yes/no with emerald green + outline buttons
- **Stage 3 (Existing Customer)**: Tab toggle "يبي ينزّل" | "لم يتم التنزيل"
  - Order flow: Customer inventory review → Product selection → Invoice
  - No-order flow: Checkbox list of rejection reasons
- **Sub-page header**: `bg-primary` sticky bar (not gradient) with back arrow

### `/sales-rep/invoice` — Invoice/Checkout
- **Header**: `bg-primary` sticky, shows "الفاتورة" + customer name
- **Content**: Withdrawn items (orange card) → Order items with discount controls → Summary card
- **Summary card**: `bg-primary/5 border-primary/30` with line items, subtotal, discount, VAT, grand total
- **Bottom**: Fixed emerald green submit button

### `/sales-rep/customer-inventory` — Customer Inventory View
- **Header**: `bg-primary` sticky
- **Customer info**: Card with `bg-primary/5 border-primary/30`
- **Inventory list**: Simple cards with item name + quantity
- **History**: Muted cards (`bg-muted/50`) for older records

### `/sales-rep/inventory-records` — Stock Ledger
- **Header**: `bg-primary` sticky with refresh
- **Summary**: 3-column grid (total, incoming green, outgoing red)
- **Records**: Cards with directional icons (TrendingUp green / TrendingDown red) + colored voucher badges

---

## Animations

All custom animations are defined in `globals.css`:

| Animation | Class | Duration | Usage |
|-----------|-------|----------|-------|
| Slide up | `animate-slide-up-in` | 0.4s ease-out | Content entry |
| Slide down | `animate-slide-down-in` | 0.4s ease-out | Header entry |
| Input fade | `animate-input-fade` | 0.3s ease-out | Form field appearance |
| Pulse slow | `animate-pulse-slow` | 2s infinite | Loading indicators |
| Loading bar | `animate-loading-bar` | 1.5s infinite | Progress bars |
| Bounce in | `animate-bounce-in` | 0.5s ease-out | Success animations |

### Tailwind Built-in Animations Used
- `animate-spin` — Loading spinners (Loader2, RefreshCw)
- `transition-all duration-300` — Card hover effects
- `transition-colors` — Button hover states

---

## Icons

All icons come from **Lucide React**. Key icons used:

| Icon | Usage |
|------|-------|
| `MapPin` | Location, territory, GPS |
| `Plus` / `Minus` | Quantity controls, add item |
| `Navigation` | Refresh location |
| `Clock` | Last visit date |
| `Package` | Inventory, stock |
| `History` | Records, past data |
| `RefreshCw` | Refresh/reload data |
| `Loader2` | Loading spinner (always with `animate-spin`) |
| `User` | Customer, profile |
| `AlertCircle` | Errors, info alerts |
| `ArrowRight` | Back button (RTL — points left visually) |
| `ChevronRight` | Next/forward actions |
| `XCircle` | Withdraw/remove |
| `Check` | Confirm/submit |
| `Percent` | Discount percentage |
| `DollarSign` | Fixed amount discount |
| `TrendingUp` | Incoming stock |
| `TrendingDown` | Outgoing stock |
| `FileText` | Voucher reference |
| `ShieldAlert` | Auth/permission errors |

---

## RTL & Internationalization

### Direction
- The entire `/sales-rep` layout sets `dir="rtl" lang="ar"` on the root container
- All text is Arabic
- Back arrows use `ArrowRight` (which visually points left in RTL)
- Margins use `ml-2` (which becomes right margin in RTL context for icon spacing)

### Font Handling
```css
[dir="rtl"] body {
  font-family: 'Noto Sans Arabic', -apple-system, sans-serif;
  font-weight: 500;
}
```

### Important RTL Considerations
- `text-right` is used sparingly (already default in RTL)
- Phone inputs and code get `dir="ltr"` override
- Currency amounts display: `125.00 ر.س` (number + SAR symbol)
- Dates use `toLocaleDateString("ar-SA")` for Hijri-compatible formatting

---

## Dark Mode

The app supports dark mode via the `.dark` class on the root element. CSS variables switch automatically:

| Variable | Light | Dark |
|----------|-------|------|
| `--background` | `#FFFFFF` | `#0A0A0A` |
| `--foreground` | `#1E293B` | `#FAFAFA` |
| `--card` | `#FFFFFF` | `#0A0A0A` |
| `--primary` | Blue | White |
| `--muted` | `#F5F5F5` | `#262626` |
| `--border` | `#EDEDED` | `#262626` |

**Note**: Many hardcoded colors (bg-slate-50, bg-blue-600, etc.) do NOT change in dark mode. For full dark mode support, these should be replaced with CSS variable-based utilities.

---

## Responsive Behavior

The app is **mobile-first** but scales gracefully:

| Breakpoint | Layout Change |
|------------|--------------|
| `< 768px` (default) | Single column, `px-4`, full-width cards |
| `md: (768px+)` | `px-6`, slightly wider spacing |

No desktop-specific layouts exist — this is intentionally a mobile app accessed via browser.

---

## PWA & Installability

The app includes a **Progressive Web App** manifest and service worker, allowing installation as a standalone app on:
- **Android** (Chrome → "Add to Home Screen" / install prompt)
- **iOS** (Safari → "Add to Home Screen")  
- **Windows** (Edge/Chrome → Install app)

### Manifest
- App name: "مندوب مينا" (Meena Sales Rep)
- Theme color: `#2563EB` (Blue-600)
- Background: `#F8FAFC` (Slate-50)
- Display: `standalone` (no browser chrome)
- Start URL: `/sales-rep`
- Scope: `/sales-rep`

See `/public/sales-rep-manifest.json` and `/public/sales-rep-sw.js` for implementation.

---

## Quick Reference: Design Tokens Summary

```
┌─────────────────────────────────────────────────────┐
│  🎨 SALES REP DESIGN TOKENS                         │
├─────────────────────────────────────────────────────┤
│  Brand Blue:       #2563EB  (blue-600)              │
│  Brand Gradient:   blue-600 → blue-700 → indigo-800 │
│  Page Background:  #F8FAFC  (slate-50)              │
│  Card Background:  #FFFFFF  (white)                 │
│  Text Primary:     #1E293B  (slate-800)             │
│  Text Secondary:   #64748B  (slate-500)             │
│  Success Green:    #059669  (emerald-600)           │
│  Warning Orange:   #F97316  (orange-500)            │
│  Error Red:        #EF4444  (red-500)               │
│  Border:           #E2E8F0  (slate-200)             │
│                                                     │
│  Border Radius:    Cards=16px, Btns=12-16px         │
│  Font:             Noto Sans Arabic 500             │
│  Min Tap Target:   44px (h-11)                      │
│  Header Shape:     rounded-b-[2rem]                 │
│  Shadows:          shadow-sm (cards), shadow-lg     │
│                    (header, bottom bar)              │
└─────────────────────────────────────────────────────┘
```

---

## File Structure

```
app/sales-rep/
├── layout.tsx              → Auth guard + SalesRepProvider + RTL wrapper
├── page.tsx                → Dashboard (customers + inventory tabs)
├── new-order/
│   ├── loading.tsx         → Loading skeleton
│   └── page.tsx            → Multi-stage order flow (customer info → order → products)
├── invoice/
│   └── page.tsx            → Invoice review + discount + submit
├── customer-inventory/
│   ├── loading.tsx         → Loading skeleton  
│   └── page.tsx            → Customer's inventory view
└── inventory-records/
    └── page.tsx            → Stock ledger entries

contexts/
└── SalesRepContext.tsx      → Global state: salesPerson, customers, items, repStock

components/ui/               → shadcn/ui components (Card, Button, Badge, Tabs, etc.)
```

---

*Last updated: February 2026*
