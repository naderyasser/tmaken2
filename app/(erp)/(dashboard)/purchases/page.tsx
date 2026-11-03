'use client'

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { useI18n } from '@/lib/i18n'
import { Header } from '@/components/header'
import {
    purchaseApi,
    type Supplier,
    type SupplierGroup,
    type PurchaseOrder,
    type PurchaseOrderItem,
    type PurchaseReceipt,
    type PurchaseInvoice,
    type MaterialRequest,
    type PurchaseDashboard,
    type PurchaseItem,
    type ItemGroup,
    type PaymentTermsTemplate,
} from '@/lib/purchase-api'
import { walletApi, type Wallet as WalletType } from '@/lib/wallet-api'
import {
    LayoutDashboard, Users, ShoppingCart, PackageCheck, FileText,
    ClipboardList, BarChart3, Plus, Search, Filter, ChevronDown,
    ChevronRight, ChevronLeft, Edit, Trash2, Eye, Send, X,
    RefreshCw, Building2, Calendar, DollarSign, TrendingUp,
    Package, AlertCircle, CheckCircle, Clock, ArrowRight,
    Ban, MoreHorizontal, Loader2, Info, Shield, LogIn,
    PanelLeftClose, PanelLeft, Home, LogOut, ClipboardCheck,
    Receipt, FileCheck, Copy, CalendarClock, Repeat, ChevronUp, Printer, Wallet, CreditCard,
} from 'lucide-react'

// ==================== Labels (bilingual inline) ====================

const L = {
    en: {
        purchases: 'Purchases',
        purchasesSubtitle: 'Manage suppliers, orders, receipts & invoices',
        dashboard: 'Dashboard',
        suppliers: 'Suppliers',
        purchaseOrders: 'Purchase Orders',
        receipts: 'Goods Receipt',
        invoices: 'Purchase Invoices',
        materialRequests: 'Material Requests',
        reports: 'Reports',
        // Dashboard
        totalSuppliers: 'Total Suppliers',
        totalPOs: 'Purchase Orders',
        pendingOrders: 'Pending Orders',
        totalReceipts: 'Goods Receipts',
        totalInvoices: 'Purchase Invoices',
        totalMRs: 'Material Requests',
        totalPurchaseValue: 'Total Purchase Value',
        monthlyTrend: 'Monthly Purchase Trend',
        topSuppliers: 'Top Suppliers',
        noDataYet: 'No data yet',
        startByCreating: 'Start by creating suppliers and purchase orders',
        // Supplier
        newSupplier: 'New Supplier',
        editSupplier: 'Edit Supplier',
        supplierName: 'Supplier Name',
        supplierGroup: 'Supplier Group',
        supplierType: 'Supplier Type',
        individual: 'Individual',
        company: 'Company',
        country: 'Country',
        taxId: 'Tax ID / VAT Number',
        mobileNo: 'Mobile Number',
        emailAddress: 'Email Address',
        paymentTerms: 'Payment Terms',
        noSuppliers: 'No Suppliers',
        noSuppliersDesc: 'Add your first supplier to start purchasing',
        supplierCreated: 'Supplier created successfully',
        supplierUpdated: 'Supplier updated successfully',
        supplierDeleted: 'Supplier deleted',
        confirmDeleteSupplier: 'Are you sure you want to delete this supplier?',
        enabled: 'Enabled',
        disabled: 'Disabled',
        allGroups: 'All Groups',
        // PO
        newPO: 'New Purchase Order',
        editPO: 'Edit Purchase Order',
        selectSupplier: 'Select Supplier',
        orderDate: 'Date Issued',
        requiredBy: 'Delivery Deadline',
        addItem: 'Add Item',
        itemCode: 'Item Code',
        itemName: 'Item Name',
        quantity: 'Qty',
        uom: 'Unit',
        rate: 'Rate',
        amount: 'Amount',
        warehouse: 'Receiving Warehouse',
        total: 'Total',
        grandTotal: 'Grand Total',
        save: 'Save',
        saveDraft: 'Save Draft',
        submit: 'Submit',
        cancel: 'Cancel',
        delete: 'Delete',
        close: 'Close',
        confirm: 'Confirm',
        draft: 'Draft',
        submitted: 'Submitted',
        cancelled: 'Cancelled',
        completed: 'Completed',
        noPOs: 'No Purchase Orders',
        noPOsDesc: 'Create your first purchase order',
        poCreated: 'Purchase Order created',
        poSubmitted: 'Purchase Order submitted',
        poCancelled: 'Purchase Order cancelled',
        poDeleted: 'Purchase Order deleted',
        confirmSubmit: 'Submit this document? This action cannot be undone.',
        confirmCancel: 'Cancel this document?',
        confirmDelete: 'Delete this record? This cannot be undone.',
        toReceive: 'To Receive',
        toBill: 'To Bill',
        received: '% Received',
        billed: '% Billed',
        // Receipt
        newReceipt: 'New Goods Receipt',
        postingDate: 'Receipt Date',
        getFromPO: 'Get Items from Purchase Order',
        selectPO: 'Select Purchase Order',
        noReceipts: 'No Goods Receipts',
        noReceiptsDesc: 'Receive goods against purchase orders',
        receiptCreated: 'Goods Receipt created',
        receiptSubmitted: 'Goods Receipt submitted',
        batchNo: 'Batch No',
        // Invoice
        newInvoice: 'New Purchase Invoice',
        dueDate: 'Due Date',
        outstanding: 'Outstanding',
        noInvoices: 'No Purchase Invoices',
        noInvoicesDesc: 'Create invoices for purchased goods',
        invoiceCreated: 'Purchase Invoice created',
        invoiceSubmitted: 'Purchase Invoice submitted',
        // MR
        newMR: 'New Material Request',
        requestDate: 'Date Issued',
        scheduledDate: 'Needed By',
        convertToPO: 'Convert to PO',
        noMRs: 'No Material Requests',
        noMRsDesc: 'Create material requests for needed items',
        mrCreated: 'Material Request created',
        mrSubmitted: 'Material Request submitted',
        mrConverted: 'Converted to Purchase Order',
        ordered: 'Ordered %',
        // Reports
        purchasesByMonth: 'Purchases by Month',
        purchasesBySupplier: 'Purchases by Supplier',
        purchasesByItem: 'Purchases by Item Group',
        count: 'Count',
        value: 'Value',
        // Statuses
        statusDraft: 'Draft',
        statusToReceiveAndBill: 'To Receive & Bill',
        statusToReceive: 'To Receive',
        statusToBill: 'To Bill',
        statusCompleted: 'Completed',
        statusCancelled: 'Cancelled',
        statusClosed: 'Closed',
        statusPending: 'Pending',
        statusPartiallyOrdered: 'Partially Ordered',
        statusOrdered: 'Ordered',
        statusPaid: 'Paid',
        statusUnpaid: 'Unpaid',
        statusOverdue: 'Overdue',
        statusReturn: 'Return',
        // Common
        companyLabel: 'Company',
        selectCompany: 'Select Company',
        allCompanies: 'All Companies',
        loading: 'Loading...',
        error: 'Error',
        retry: 'Retry',
        noResults: 'No results found',
        searchPlaceholder: 'Search...',
        filterByStatus: 'Filter by Status',
        supplier: 'Supplier',
        status: 'Status',
        selectItem: 'Select Item',
        allStatuses: 'All Statuses',
        actions: 'Actions',
        view: 'View',
        edit: 'Edit',
        currency: 'SAR',
        unauthorized: 'Purchase access required',
        unauthorizedDesc: 'You need Purchase Manager, Purchase User, or Stock roles to access this module.',
        goHome: 'Go to Home',
        backToHome: 'Back to Home',
        logoutBtn: 'Logout',
        createAndSubmit: 'Create & Submit',
        creating: 'Creating...',
        createReceipt: 'Receive Goods',
        createInvoice: 'Create Invoice',
        poActions: 'PO Actions',
        stockCount: 'Stock Count',
        stockCountDesc: 'Reconcile physical stock with system records',
        noStockCount: 'No Stock Reconciliation',
        noStockCountDesc: 'Create a stock count to reconcile inventory',
        newStockCount: 'New Stock Count',
        stockCountCreated: 'Stock Reconciliation created',
        purpose: 'Purpose',
        stockReconciliation: 'Stock Reconciliation',
        currentQty: 'System Qty',
        physicalQty: 'Physical Qty',
        difference: 'Difference',
        selectWarehouse: 'Select Warehouse',
        autoSubmitted: 'Created & submitted successfully',
        printDocument: 'Print',
        printReport: 'Print Report',
        duplicateOrder: 'Duplicate Order',
        orderDuplicated: 'Order duplicated — edit and submit',
        scheduleRecurring: 'Schedule Recurring',
        scheduleCreated: 'Recurring schedule created',
        frequency: 'Frequency',
        weekly: 'Weekly',
        monthly: 'Monthly',
        quarterly: 'Quarterly',
        halfYearly: 'Half-yearly',
        yearly: 'Yearly',
        startDate: 'Start Date',
        endDate: 'End Date (optional)',
        addNewUOM: '+ Add new unit',
        searchUOM: 'Search unit...',
        uomName: 'Unit name',
        uomCreated: 'Unit created successfully',
        valuationRate: 'Valuation Rate',
        autoFilledPrice: 'Price auto-filled from last purchase',
        stockAdjusted: 'Stock adjusted successfully',
        scheduled: 'Scheduled',
        recurringActive: 'Recurring',
        nextOrder: 'Next order',
        scheduledOrders: 'Scheduled Orders',
        noScheduledOrders: 'No scheduled orders',
        noScheduledOrdersDesc: 'Schedule a recurring order from the Purchase Orders section',
        disableSchedule: 'Disable',
        scheduleDisabled: 'Schedule disabled',
        payInvoice: 'Pay',
        paymentAmount: 'Payment Amount',
        modeOfPayment: 'Mode of Payment',
        referenceNo: 'Reference No.',
        paymentCreated: 'Payment recorded successfully',
        paying: 'Recording payment...',
        paid: 'Paid',
        partiallyPaid: 'Partially Paid',
        // Wallet
        companyWallet: 'Company Wallet',
        walletBalance: 'Wallet Balance',
        topUpWallet: 'Top Up',
        topUpAmount: 'Top Up Amount',
        topUpRemarks: 'Remarks (optional)',
        topUpSuccess: 'Wallet topped up successfully',
        payFromWallet: 'Pay from Wallet',
        walletPayment: 'Wallet Payment',
        accountingPayment: 'Accounting Payment',
        insufficientBalance: 'Insufficient wallet balance',
        walletPaid: 'Paid from wallet successfully',
        paymentError: 'Payment failed',
        topUpError: 'Failed to top up wallet',
        scheduleError: 'Failed to create schedule',
        optionalRemarks: 'Optional remarks...',
        supplierNamePlaceholder: 'e.g. United Supplies Co.',
        untilDate: 'until',
        indefinitely: 'indefinitely',
        confirmDisableSchedule: 'Disable this schedule?',
        saveDraftHint: 'Saves privately — not visible in reports or sent for approval',
        submitHint: 'Locks the record and starts the approval workflow',
        lockedBannerTitle: 'This order is locked',
        lockedBannerDesc: 'Submitted orders cannot be edited. Cancel this order, then duplicate it to create a new editable draft.',
    },
    ar: {
        purchases: 'المشتريات',
        purchasesSubtitle: 'إدارة الموردين والطلبات والاستلام والفواتير',
        dashboard: 'لوحة التحكم',
        suppliers: 'الموردين',
        purchaseOrders: 'أوامر الشراء',
        receipts: 'استلام البضائع',
        invoices: 'فواتير المشتريات',
        materialRequests: 'طلبات المواد',
        reports: 'التقارير',
        totalSuppliers: 'إجمالي الموردين',
        totalPOs: 'أوامر الشراء',
        pendingOrders: 'الطلبات المعلقة',
        totalReceipts: 'إيصالات الاستلام',
        totalInvoices: 'فواتير المشتريات',
        totalMRs: 'طلبات المواد',
        totalPurchaseValue: 'إجمالي قيمة المشتريات',
        monthlyTrend: 'اتجاه المشتريات الشهري',
        topSuppliers: 'أفضل الموردين',
        noDataYet: 'لا توجد بيانات بعد',
        startByCreating: 'ابدأ بإضافة الموردين وإنشاء أوامر الشراء',
        newSupplier: 'مورد جديد',
        editSupplier: 'تعديل المورد',
        supplierName: 'اسم المورد',
        supplierGroup: 'مجموعة الموردين',
        supplierType: 'نوع المورد',
        individual: 'فرد',
        company: 'شركة',
        country: 'الدولة',
        taxId: 'الرقم الضريبي',
        mobileNo: 'رقم الجوال',
        emailAddress: 'البريد الإلكتروني',
        paymentTerms: 'شروط الدفع',
        noSuppliers: 'لا يوجد موردين',
        noSuppliersDesc: 'أضف أول مورد لبدء عمليات الشراء',
        supplierCreated: 'تم إنشاء المورد بنجاح',
        supplierUpdated: 'تم تحديث المورد بنجاح',
        supplierDeleted: 'تم حذف المورد',
        confirmDeleteSupplier: 'هل أنت متأكد من حذف هذا المورد؟',
        enabled: 'مفعّل',
        disabled: 'معطّل',
        allGroups: 'جميع المجموعات',
        newPO: 'أمر شراء جديد',
        editPO: 'تعديل أمر الشراء',
        selectSupplier: 'اختر المورد',
        orderDate: 'تاريخ الإصدار',
        requiredBy: 'موعد التسليم',
        addItem: 'إضافة صنف',
        itemCode: 'رمز الصنف',
        itemName: 'اسم الصنف',
        quantity: 'الكمية',
        uom: 'الوحدة',
        rate: 'السعر',
        amount: 'المبلغ',
        warehouse: 'مستودع الاستلام',
        total: 'الإجمالي',
        grandTotal: 'المجموع الكلي',
        save: 'حفظ',
        saveDraft: 'حفظ كمسودة',
        submit: 'اعتماد',
        cancel: 'إلغاء',
        delete: 'حذف',
        close: 'إغلاق',
        confirm: 'تأكيد',
        draft: 'مسودة',
        submitted: 'معتمد',
        cancelled: 'ملغي',
        completed: 'مكتمل',
        noPOs: 'لا توجد أوامر شراء',
        noPOsDesc: 'أنشئ أول أمر شراء',
        poCreated: 'تم إنشاء أمر الشراء',
        poSubmitted: 'تم اعتماد أمر الشراء',
        poCancelled: 'تم إلغاء أمر الشراء',
        poDeleted: 'تم حذف أمر الشراء',
        confirmSubmit: 'هل تريد اعتماد هذا المستند؟ لا يمكن التراجع.',
        confirmCancel: 'هل تريد إلغاء هذا المستند؟',
        confirmDelete: 'حذف هذا السجل؟ لا يمكن التراجع.',
        toReceive: 'للاستلام',
        toBill: 'للفوترة',
        received: '% تم استلامه',
        billed: '% تمت فوترته',
        newReceipt: 'استلام بضائع جديد',
        postingDate: 'تاريخ الاستلام',
        getFromPO: 'جلب الأصناف من أمر الشراء',
        selectPO: 'اختر أمر الشراء',
        noReceipts: 'لا توجد إيصالات استلام',
        noReceiptsDesc: 'استلم البضائع مقابل أوامر الشراء',
        receiptCreated: 'تم إنشاء إيصال الاستلام',
        receiptSubmitted: 'تم اعتماد إيصال الاستلام',
        batchNo: 'رقم الدفعة',
        newInvoice: 'فاتورة شراء جديدة',
        dueDate: 'تاريخ الاستحقاق',
        outstanding: 'المبلغ المتبقي',
        noInvoices: 'لا توجد فواتير شراء',
        noInvoicesDesc: 'أنشئ فواتير للبضائع المشتراة',
        invoiceCreated: 'تم إنشاء فاتورة الشراء',
        invoiceSubmitted: 'تم اعتماد فاتورة الشراء',
        newMR: 'طلب مواد جديد',
        requestDate: 'تاريخ الإصدار',
        scheduledDate: 'تاريخ الاحتياج',
        convertToPO: 'تحويل لأمر شراء',
        noMRs: 'لا توجد طلبات مواد',
        noMRsDesc: 'أنشئ طلبات للمواد المطلوبة',
        mrCreated: 'تم إنشاء طلب المواد',
        mrSubmitted: 'تم اعتماد طلب المواد',
        mrConverted: 'تم التحويل لأمر شراء',
        ordered: 'نسبة الطلب',
        purchasesByMonth: 'المشتريات حسب الشهر',
        purchasesBySupplier: 'المشتريات حسب المورد',
        purchasesByItem: 'المشتريات حسب مجموعة الأصناف',
        count: 'العدد',
        value: 'القيمة',
        statusDraft: 'مسودة',
        statusToReceiveAndBill: 'للاستلام والفوترة',
        statusToReceive: 'للاستلام',
        statusToBill: 'للفوترة',
        statusCompleted: 'مكتمل',
        statusCancelled: 'ملغي',
        statusClosed: 'مغلق',
        statusPending: 'معلق',
        statusPartiallyOrdered: 'مطلوب جزئياً',
        statusOrdered: 'تم الطلب',
        statusPaid: 'مدفوع',
        statusUnpaid: 'غير مدفوع',
        statusOverdue: 'متأخر',
        statusReturn: 'مرتجع',
        companyLabel: 'الشركة',
        selectCompany: 'اختر الشركة',
        allCompanies: 'جميع الشركات',
        loading: 'جاري التحميل...',
        error: 'خطأ',
        retry: 'إعادة المحاولة',
        noResults: 'لا توجد نتائج',
        searchPlaceholder: 'بحث...',
        filterByStatus: 'تصفية حسب الحالة',
        supplier: 'المورد',
        status: 'الحالة',
        selectItem: 'اختر الصنف',
        allStatuses: 'جميع الحالات',
        actions: 'الإجراءات',
        view: 'عرض',
        edit: 'تعديل',
        currency: 'ر.س',
        unauthorized: 'مطلوب صلاحية المشتريات',
        unauthorizedDesc: 'تحتاج دور مدير المشتريات أو مستخدم مشتريات أو أدوار المخزون للوصول.',
        goHome: 'الرجوع للرئيسية',
        backToHome: 'العودة للرئيسية',
        logoutBtn: 'تسجيل الخروج',
        createAndSubmit: 'إنشاء واعتماد',
        creating: 'جاري الإنشاء...',
        createReceipt: 'استلام البضائع',
        createInvoice: 'إنشاء فاتورة',
        poActions: 'إجراءات أمر الشراء',
        stockCount: 'جرد المخزون',
        stockCountDesc: 'مطابقة المخزون الفعلي مع السجلات',
        noStockCount: 'لا يوجد جرد',
        noStockCountDesc: 'أنشئ عملية جرد لمطابقة المخزون',
        newStockCount: 'جرد جديد',
        stockCountCreated: 'تم إنشاء عملية الجرد',
        purpose: 'الغرض',
        stockReconciliation: 'تسوية المخزون',
        currentQty: 'الكمية بالنظام',
        physicalQty: 'الكمية الفعلية',
        difference: 'الفرق',
        selectWarehouse: 'اختر المستودع',
        autoSubmitted: 'تم الإنشاء والاعتماد بنجاح',
        printDocument: 'طباعة',
        printReport: 'طباعة التقرير',
        duplicateOrder: 'تكرار الطلب',
        orderDuplicated: 'تم تكرار الطلب — عدّل واعتمد',
        scheduleRecurring: 'جدولة متكررة',
        scheduleCreated: 'تم إنشاء الجدولة المتكررة',
        frequency: 'التكرار',
        weekly: 'أسبوعي',
        monthly: 'شهري',
        quarterly: 'ربع سنوي',
        halfYearly: 'نصف سنوي',
        yearly: 'سنوي',
        startDate: 'تاريخ البداية',
        endDate: 'تاريخ النهاية (اختياري)',
        addNewUOM: '+ إضافة وحدة جديدة',
        searchUOM: 'بحث عن وحدة...',
        uomName: 'اسم الوحدة',
        uomCreated: 'تم إنشاء الوحدة بنجاح',
        valuationRate: 'سعر التقييم',
        autoFilledPrice: 'السعر من آخر عملية شراء',
        stockAdjusted: 'تم تعديل المخزون بنجاح',
        scheduled: 'مجدول',
        recurringActive: 'متكرر',
        nextOrder: 'الطلب القادم',
        scheduledOrders: 'الطلبات المجدولة',
        noScheduledOrders: 'لا توجد طلبات مجدولة',
        noScheduledOrdersDesc: 'جدول طلب متكرر من قسم أوامر الشراء',
        disableSchedule: 'إيقاف',
        scheduleDisabled: 'تم إيقاف الجدولة',
        payInvoice: 'دفع',
        paymentAmount: 'مبلغ الدفع',
        modeOfPayment: 'طريقة الدفع',
        referenceNo: 'رقم المرجع',
        paymentCreated: 'تم تسجيل الدفعة بنجاح',
        paying: 'جاري تسجيل الدفعة...',
        paid: 'مدفوع',
        partiallyPaid: 'مدفوع جزئياً',
        // Wallet
        companyWallet: 'محفظة الشركة',
        walletBalance: 'رصيد المحفظة',
        topUpWallet: 'شحن المحفظة',
        topUpAmount: 'مبلغ الشحن',
        topUpRemarks: 'ملاحظات (اختياري)',
        topUpSuccess: 'تم شحن المحفظة بنجاح',
        payFromWallet: 'دفع من المحفظة',
        walletPayment: 'دفع من المحفظة',
        accountingPayment: 'دفع محاسبي',
        insufficientBalance: 'رصيد المحفظة غير كافي',
        walletPaid: 'تم الدفع من المحفظة بنجاح',
        paymentError: 'فشل الدفع',
        topUpError: 'فشل شحن المحفظة',
        scheduleError: 'فشل إنشاء الجدولة',
        optionalRemarks: 'ملاحظات اختيارية...',
        supplierNamePlaceholder: 'مثال: شركة التوريدات المتحدة',
        untilDate: 'حتى',
        indefinitely: 'بدون نهاية',
        confirmDisableSchedule: 'هل تريد إيقاف هذه الجدولة؟',
        saveDraftHint: 'يحفظ بشكل خاص — لا يظهر في التقارير أو يُرسل للاعتماد',
        submitHint: 'يغلق السجل ويبدأ مسار الاعتماد',
        lockedBannerTitle: 'هذا الطلب مقفل',
        lockedBannerDesc: 'لا يمكن تعديل الطلبات المعتمدة. قم بإلغاء هذا الطلب، ثم نسخه لإنشاء مسودة قابلة للتعديل.',
    },
}

// ==================== Helpers ====================

type Section = 'dashboard' | 'suppliers' | 'purchase-orders' | 'receipts' | 'invoices' | 'material-requests' | 'stock-count' | 'scheduled-orders' | 'reports'

interface SidebarItem {
    id: Section
    labelKey: keyof typeof L.en
    icon: React.ElementType
}

const SECTIONS: SidebarItem[] = [
    { id: 'dashboard', labelKey: 'dashboard', icon: LayoutDashboard },
    { id: 'suppliers', labelKey: 'suppliers', icon: Users },
    { id: 'purchase-orders', labelKey: 'purchaseOrders', icon: ShoppingCart },
    { id: 'receipts', labelKey: 'receipts', icon: PackageCheck },
    { id: 'invoices', labelKey: 'invoices', icon: FileText },
    { id: 'material-requests', labelKey: 'materialRequests', icon: ClipboardList },
    { id: 'stock-count', labelKey: 'stockCount', icon: ClipboardCheck },
    { id: 'scheduled-orders', labelKey: 'scheduledOrders', icon: CalendarClock },
    { id: 'reports', labelKey: 'reports', icon: BarChart3 },
]

function formatCurrency(v: number | undefined | null, lang: 'en' | 'ar'): string {
    if (v == null) return '-'
    const formatted = new Intl.NumberFormat(lang === 'ar' ? 'ar-SA' : 'en-SA', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(v)
    return `${formatted} ${lang === 'ar' ? 'ر.س' : 'SAR'}`
}

function formatDate(d: string | undefined | null): string {
    if (!d) return '-'
    return d.substring(0, 10)
}

function statusColor(status?: string): string {
    switch (status) {
        case 'Draft': return 'bg-gray-100 text-gray-700'
        case 'To Receive and Bill': return 'bg-amber-100 text-amber-700'
        case 'To Receive': return 'bg-blue-100 text-blue-700'
        case 'To Bill': return 'bg-purple-100 text-purple-700'
        case 'Completed': return 'bg-green-100 text-green-700'
        case 'Cancelled': return 'bg-red-100 text-red-700'
        case 'Closed': return 'bg-slate-100 text-slate-700'
        case 'Pending': return 'bg-yellow-100 text-yellow-700'
        case 'Partially Ordered': return 'bg-orange-100 text-orange-700'
        case 'Ordered': return 'bg-emerald-100 text-emerald-700'
        case 'Paid': return 'bg-green-100 text-green-700'
        case 'Unpaid': return 'bg-red-100 text-red-700'
        case 'Overdue': return 'bg-red-200 text-red-800'
        case 'Return': return 'bg-pink-100 text-pink-700'
        default: return 'bg-gray-100 text-gray-600'
    }
}

function statusLabel(status: string | undefined, lang: 'en' | 'ar'): string {
    if (!status) return '-'
    const map: Record<string, keyof typeof L.en> = {
        'Draft': 'statusDraft',
        'To Receive and Bill': 'statusToReceiveAndBill',
        'To Receive': 'statusToReceive',
        'To Bill': 'statusToBill',
        'Completed': 'statusCompleted',
        'Cancelled': 'statusCancelled',
        'Closed': 'statusClosed',
        'Pending': 'statusPending',
        'Partially Ordered': 'statusPartiallyOrdered',
        'Ordered': 'statusOrdered',
        'Paid': 'statusPaid',
        'Unpaid': 'statusUnpaid',
        'Overdue': 'statusOverdue',
        'Return': 'statusReturn',
    }
    const k = map[status]
    return k ? L[lang][k] : status
}

const today = () => new Date().toISOString().split('T')[0]
const futureDate = (days: number) => {
    const d = new Date(); d.setDate(d.getDate() + days)
    return d.toISOString().split('T')[0]
}

/** Open ERPNext print view for a document in a new tab */
const printDoc = (doctype: string, name: string) => {
    const origin = typeof window !== 'undefined' ? window.location.origin : ''
    window.open(`${origin}/printview?doctype=${encodeURIComponent(doctype)}&name=${encodeURIComponent(name)}&format=Standard`, '_blank')
}

/** Print the current page content */
const printPage = () => window.print()

// ==================== UOM Combobox ====================

function UOMCombobox({ value, uoms, lang, onChange, onAddNew }: {
    value: string; uoms: Array<{ name: string }>; lang: 'en' | 'ar'
    onChange: (v: string) => void; onAddNew: (name: string) => void
}) {
    const t = L[lang]
    const [open, setOpen] = useState(false)
    const [search, setSearch] = useState('')
    const [adding, setAdding] = useState(false)
    const [newName, setNewName] = useState('')
    const triggerRef = useRef<HTMLInputElement>(null)
    const dropRef = useRef<HTMLDivElement>(null)
    const [pos, setPos] = useState<{ top: number; left: number; width: number }>({ top: 0, left: 0, width: 200 })

    // Update dropdown position when opening
    useEffect(() => {
        if (open && triggerRef.current) {
            const rect = triggerRef.current.getBoundingClientRect()
            setPos({ top: rect.bottom + 2, left: rect.left, width: rect.width })
        }
    }, [open])

    // Close on outside click
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            const target = e.target as Node
            if (triggerRef.current?.contains(target)) return
            if (dropRef.current?.contains(target)) return
            setOpen(false); setAdding(false)
        }
        document.addEventListener('mousedown', handler)
        return () => document.removeEventListener('mousedown', handler)
    }, [])

    const filtered = uoms.filter(u => u.name.toLowerCase().includes(search.toLowerCase()))

    const dropdown = open ? createPortal(
        <div ref={dropRef}
            style={{ position: 'fixed', top: pos.top, left: pos.left, width: pos.width, zIndex: 99999 }}
            className="bg-white border rounded-lg shadow-xl max-h-48 overflow-auto text-sm">
            {filtered.length === 0 && <div className="px-3 py-2 text-gray-400">{t.noResults}</div>}
            {filtered.map(u => (
                <div key={u.name}
                    onClick={() => { onChange(u.name); setOpen(false); setSearch('') }}
                    className={`px-3 py-1.5 cursor-pointer hover:bg-gray-100 ${u.name === value ? 'bg-emerald-50 font-medium text-emerald-700' : ''}`}>
                    {u.name}
                </div>
            ))}
            <div className="border-t">
                {!adding ? (
                    <div onClick={() => setAdding(true)}
                        className="px-3 py-2 cursor-pointer hover:bg-emerald-50 text-emerald-600 font-medium flex items-center gap-1">
                        <Plus className="w-3.5 h-3.5" /> {t.addNewUOM}
                    </div>
                ) : (
                    <div className="px-3 py-2 flex items-center gap-2">
                        <input className="flex-1 border rounded px-2 py-1 text-sm" placeholder={t.uomName}
                            value={newName} onChange={e => setNewName(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter' && newName.trim()) { onAddNew(newName.trim()); setNewName(''); setAdding(false); setOpen(false) } }}
                            autoFocus />
                        <button onClick={() => { if (newName.trim()) { onAddNew(newName.trim()); setNewName(''); setAdding(false); setOpen(false) } }}
                            className="p-1 bg-emerald-600 text-white rounded hover:bg-emerald-700"><CheckCircle className="w-4 h-4" /></button>
                    </div>
                )}
            </div>
        </div>,
        document.body
    ) : null

    return (
        <div className="relative">
            <input
                ref={triggerRef}
                className="w-full border rounded px-2 py-1.5 text-sm"
                value={open ? search : value || ''}
                placeholder={t.searchUOM}
                onChange={e => { setSearch(e.target.value); if (!open) setOpen(true) }}
                onFocus={() => { setOpen(true); setSearch('') }}
            />
            {dropdown}
        </div>
    )
}

// ==================== Toast ====================

function Toast({ message, type, onClose }: { message: string; type: 'success' | 'error'; onClose: () => void }) {
    useEffect(() => { const t = setTimeout(onClose, 3500); return () => clearTimeout(t) }, [onClose])
    return (
        <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-[200] px-5 py-3 rounded-xl shadow-xl flex items-center gap-2 text-sm font-medium animate-in slide-in-from-top ${type === 'success' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'}`}>
            {type === 'success' ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
            {message}
            <button onClick={onClose} className="ml-2 hover:opacity-70"><X className="w-3.5 h-3.5" /></button>
        </div>
    )
}

// ==================== Stat Card ====================

function StatCard({ icon: Icon, label, value, color }: {
    icon: React.ElementType; label: string; value: string | number; color: string
}) {
    return (
        <div className="bg-white rounded-xl border p-4 flex items-center gap-4 hover:shadow-md transition-shadow">
            <div className={`w-12 h-12 rounded-xl ${color} flex items-center justify-center flex-shrink-0`}>
                <Icon className="w-6 h-6" />
            </div>
            <div className="min-w-0">
                <p className="text-sm text-gray-500 truncate">{label}</p>
                <p className="text-xl font-bold text-gray-900 truncate">{value}</p>
            </div>
        </div>
    )
}

// ==================== DASHBOARD ====================

function DashboardView({ lang, company, showToast }: { lang: 'en' | 'ar'; company?: string | null; showToast: (m: string, t: 'success' | 'error') => void }) {
    const t = L[lang]
    const [data, setData] = useState<PurchaseDashboard | null>(null)
    const [loading, setLoading] = useState(true)
    const [wallet, setWallet] = useState<WalletType | null>(null)
    const [showTopUp, setShowTopUp] = useState(false)
    const [topUpAmount, setTopUpAmount] = useState('')
    const [topUpRemarks, setTopUpRemarks] = useState('')
    const [topUpSaving, setTopUpSaving] = useState(false)

    const load = useCallback(async () => {
        setLoading(true)
        try {
            const [d, w] = await Promise.all([
                purchaseApi.getDashboard(company || undefined),
                walletApi.getCompanyWallet(company || undefined),
            ])
            setData(d)
            setWallet(w)
        } catch { /* ignore */ }
        setLoading(false)
    }, [company])

    useEffect(() => { load() }, [load])

    if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-emerald-500" /></div>
    if (!data) return <div className="text-center py-20 text-gray-400">{t.error}</div>

    const maxTrend = Math.max(...(data.monthly_trend?.map(m => m.total) || [1]), 1)
    const maxTopSup = Math.max(...(data.top_suppliers?.map(s => s.total_amount) || [1]), 1)

    const MAX_TOPUP_AMOUNT = 100000 // Maximum single top-up amount

    const handleTopUp = async () => {
        const amt = parseFloat(topUpAmount)
        if (!amt || amt <= 0 || !wallet) return
        if (amt > MAX_TOPUP_AMOUNT) {
            alert(`Maximum top-up amount is ${MAX_TOPUP_AMOUNT.toLocaleString()}. Please enter a smaller amount.`)
            return
        }
        setTopUpSaving(true)
        try {
            await walletApi.topUp(wallet.name, amt, topUpRemarks || undefined)
            const w = await walletApi.getCompanyWallet(company || undefined)
            setWallet(w)
            setShowTopUp(false)
            setTopUpAmount('')
            setTopUpRemarks('')
            showToast(t.topUpSuccess, 'success')
        } catch (e: any) { showToast(e?.message || t.topUpError, 'error') }
        setTopUpSaving(false)
    }

    return (
        <div className="space-y-6">
            {/* Wallet card */}
            {wallet && (
                <div className="bg-gradient-to-r from-emerald-600 to-emerald-700 rounded-2xl p-6 text-white shadow-lg">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center">
                                <Wallet className="w-6 h-6" />
                            </div>
                            <div>
                                <h3 className="text-lg font-bold">{t.companyWallet}</h3>
                                <p className="text-emerald-200 text-sm">{wallet.wallet_name}</p>
                            </div>
                        </div>
                        <button
                            onClick={() => setShowTopUp(true)}
                            className="flex items-center gap-2 bg-white/20 hover:bg-white/30 transition-colors px-4 py-2 rounded-lg text-sm font-medium"
                        >
                            <Plus className="w-4 h-4" />
                            {t.topUpWallet}
                        </button>
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                        <div>
                            <p className="text-emerald-200 text-xs mb-1">{t.walletBalance}</p>
                            <p className="text-2xl font-bold">{formatCurrency(wallet.balance || 0, lang)}</p>
                        </div>
                        <div>
                            <p className="text-emerald-200 text-xs mb-1">{lang === 'ar' ? 'إجمالي الإيداعات' : 'Total Credits'}</p>
                            <p className="text-lg font-semibold">{formatCurrency(wallet.total_credits || 0, lang)}</p>
                        </div>
                        <div>
                            <p className="text-emerald-200 text-xs mb-1">{lang === 'ar' ? 'إجمالي المسحوبات' : 'Total Debits'}</p>
                            <p className="text-lg font-semibold">{formatCurrency(wallet.total_debits || 0, lang)}</p>
                        </div>
                    </div>
                </div>
            )}

            {/* Top-up dialog */}
            {showTopUp && wallet && createPortal(
                <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/50" onClick={() => setShowTopUp(false)}>
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 mx-4" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-lg font-bold text-gray-800">{t.topUpWallet}</h3>
                            <button onClick={() => setShowTopUp(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
                        </div>
                        <div className="space-y-4">
                            <div>
                                <label className="text-sm font-medium text-gray-700 mb-1 block">{t.topUpAmount}</label>
                                <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={topUpAmount}
                                    onChange={e => setTopUpAmount(e.target.value)}
                                    className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                                    placeholder="0.00"
                                    autoFocus
                                />
                            </div>
                            <div>
                                <label className="text-sm font-medium text-gray-700 mb-1 block">{t.topUpRemarks}</label>
                                <input
                                    type="text"
                                    value={topUpRemarks}
                                    onChange={e => setTopUpRemarks(e.target.value)}
                                    className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                                    placeholder={t.optionalRemarks}
                                />
                            </div>
                            <div className="flex gap-3 pt-2">
                                <button onClick={() => setShowTopUp(false)} className="flex-1 border rounded-lg py-2 text-sm font-medium text-gray-600 hover:bg-gray-50">{t.cancel}</button>
                                <button
                                    onClick={handleTopUp}
                                    disabled={topUpSaving || !topUpAmount || parseFloat(topUpAmount) <= 0}
                                    className="flex-1 bg-emerald-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-emerald-700 disabled:opacity-50 flex items-center justify-center gap-2"
                                >
                                    {topUpSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                                    {t.topUpWallet}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {/* Stats grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard icon={Users} label={t.totalSuppliers} value={data.suppliers} color="bg-emerald-100 text-emerald-600" />
                <StatCard icon={ShoppingCart} label={t.totalPOs} value={data.purchase_orders} color="bg-blue-100 text-blue-600" />
                <StatCard icon={Clock} label={t.pendingOrders} value={data.pending_orders} color="bg-amber-100 text-amber-600" />
                <StatCard icon={DollarSign} label={t.totalPurchaseValue} value={formatCurrency(data.total_purchase_value, lang)} color="bg-purple-100 text-purple-600" />
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard icon={PackageCheck} label={t.totalReceipts} value={data.purchase_receipts} color="bg-teal-100 text-teal-600" />
                <StatCard icon={FileText} label={t.totalInvoices} value={data.purchase_invoices} color="bg-indigo-100 text-indigo-600" />
                <StatCard icon={ClipboardList} label={t.totalMRs} value={data.material_requests} color="bg-orange-100 text-orange-600" />
                <StatCard icon={TrendingUp} label={t.monthlyTrend} value={data.monthly_trend?.length || 0} color="bg-pink-100 text-pink-600" />
            </div>

            {/* Charts row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Monthly trend */}
                <div className="bg-white rounded-xl border p-5">
                    <h3 className="font-semibold text-gray-800 mb-4">{t.monthlyTrend}</h3>
                    {data.monthly_trend && data.monthly_trend.length > 0 ? (
                        <div className="space-y-2">
                            {data.monthly_trend.map((m) => (
                                <div key={m.month} className="flex items-center gap-3">
                                    <span className="text-xs text-gray-500 w-16 flex-shrink-0">{m.month}</span>
                                    <div className="flex-1 h-6 bg-gray-100 rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-emerald-500 rounded-full transition-all"
                                            style={{ width: `${(m.total / maxTrend) * 100}%` }}
                                        />
                                    </div>
                                    <span className="text-xs font-medium text-gray-700 w-24 text-end">
                                        {formatCurrency(m.total, lang)}
                                    </span>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-gray-400 text-sm text-center py-8">{t.noDataYet}</p>
                    )}
                </div>

                {/* Top suppliers */}
                <div className="bg-white rounded-xl border p-5">
                    <h3 className="font-semibold text-gray-800 mb-4">{t.topSuppliers}</h3>
                    {data.top_suppliers && data.top_suppliers.length > 0 ? (
                        <div className="space-y-3">
                            {data.top_suppliers.map((s, i) => (
                                <div key={s.supplier} className="flex items-center gap-3">
                                    <span className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 text-xs flex items-center justify-center font-bold">{i + 1}</span>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium text-gray-800 truncate">{s.supplier_name || s.supplier}</p>
                                        <div className="h-2 bg-gray-100 rounded-full mt-1 overflow-hidden">
                                            <div className="h-full bg-emerald-400 rounded-full" style={{ width: `${(s.total_amount / maxTopSup) * 100}%` }} />
                                        </div>
                                    </div>
                                    <div className="text-end flex-shrink-0">
                                        <p className="text-xs font-medium">{formatCurrency(s.total_amount, lang)}</p>
                                        <p className="text-[10px] text-gray-400">{s.order_count} {lang === 'ar' ? 'طلب' : 'orders'}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-gray-400 text-sm text-center py-8">{t.noDataYet}</p>
                    )}
                </div>
            </div>

            {/* Empty state if everything is 0 */}
            {data.suppliers === 0 && data.purchase_orders === 0 && (
                <div className="text-center py-12 bg-white rounded-xl border">
                    <Package className="w-16 h-16 mx-auto text-emerald-300 mb-4" />
                    <h3 className="text-lg font-semibold text-gray-700 mb-2">{t.noDataYet}</h3>
                    <p className="text-gray-400">{t.startByCreating}</p>
                </div>
            )}
        </div>
    )
}

// ==================== SUPPLIERS ====================

function SupplierDialog({ lang, supplier, groups, paymentTemplates, onSave, onClose }: {
    lang: 'en' | 'ar'
    supplier?: Supplier | null
    groups: SupplierGroup[]
    paymentTemplates: PaymentTermsTemplate[]
    onSave: (data: Partial<Supplier>) => Promise<void>
    onClose: () => void
}) {
    const t = L[lang]
    const isEdit = !!supplier
    const [form, setForm] = useState({
        supplier_name: supplier?.supplier_name || '',
        supplier_group: supplier?.supplier_group || (groups.find(g => !g.is_group)?.name || ''),
        supplier_type: supplier?.supplier_type || 'Company',
        country: supplier?.country || 'Saudi Arabia',
        tax_id: supplier?.tax_id || '',
        mobile_no: supplier?.mobile_no || '',
        email_id: supplier?.email_id || '',
        payment_terms: supplier?.payment_terms || '',
    })
    const [saving, setSaving] = useState(false)

    const handleSave = async () => {
        if (!form.supplier_name.trim()) return
        setSaving(true)
        try { await onSave(form); onClose() } catch { /* error handled by parent */ }
        setSaving(false)
    }

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40" onClick={onClose}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between p-5 border-b">
                    <h2 className="text-lg font-bold text-gray-800">{isEdit ? t.editSupplier : t.newSupplier}</h2>
                    <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
                </div>
                <div className="p-5 space-y-4">
                    {/* Name */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">{t.supplierName} *</label>
                        <input className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                            value={form.supplier_name} onChange={e => setForm(f => ({ ...f, supplier_name: e.target.value }))}
                            placeholder={t.supplierNamePlaceholder} />
                    </div>
                    {/* Group + Type row */}
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">{t.supplierGroup}</label>
                            <select className="w-full border rounded-lg px-3 py-2 text-sm"
                                value={form.supplier_group} onChange={e => setForm(f => ({ ...f, supplier_group: e.target.value }))}>
                                {groups.filter(g => !g.is_group).map(g => <option key={g.name} value={g.name}>{g.name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">{t.supplierType}</label>
                            <select className="w-full border rounded-lg px-3 py-2 text-sm"
                                value={form.supplier_type} onChange={e => setForm(f => ({ ...f, supplier_type: e.target.value }))}>
                                <option value="Company">{t.company}</option>
                                <option value="Individual">{t.individual}</option>
                            </select>
                        </div>
                    </div>
                    {/* Country + Tax */}
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">{t.country}</label>
                            <input className="w-full border rounded-lg px-3 py-2 text-sm"
                                value={form.country} onChange={e => setForm(f => ({ ...f, country: e.target.value }))} />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">{t.taxId}</label>
                            <input className="w-full border rounded-lg px-3 py-2 text-sm" dir="ltr"
                                value={form.tax_id} onChange={e => setForm(f => ({ ...f, tax_id: e.target.value }))}
                                placeholder="3XXXXXXXXXX0003" />
                        </div>
                    </div>
                    {/* Contact */}
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">{t.mobileNo}</label>
                            <input className="w-full border rounded-lg px-3 py-2 text-sm" dir="ltr"
                                value={form.mobile_no} onChange={e => setForm(f => ({ ...f, mobile_no: e.target.value }))}
                                placeholder="+966 5XX XXX XXX" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">{t.emailAddress}</label>
                            <input className="w-full border rounded-lg px-3 py-2 text-sm" dir="ltr" type="email"
                                value={form.email_id} onChange={e => setForm(f => ({ ...f, email_id: e.target.value }))}
                                placeholder="supplier@example.com" />
                        </div>
                    </div>
                    {/* Payment terms */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">{t.paymentTerms}</label>
                        <select className="w-full border rounded-lg px-3 py-2 text-sm"
                            value={form.payment_terms} onChange={e => setForm(f => ({ ...f, payment_terms: e.target.value }))}>
                            <option value="">-</option>
                            {paymentTemplates.map(pt => <option key={pt.name} value={pt.name}>{pt.name}</option>)}
                        </select>
                    </div>
                </div>
                <div className="flex justify-end gap-2 p-5 border-t">
                    <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">{t.cancel}</button>
                    <button onClick={handleSave} disabled={saving || !form.supplier_name.trim()}
                        className="px-5 py-2 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-2">
                        {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                        {t.save}
                    </button>
                </div>
            </div>
        </div>
    )
}

function SuppliersView({ lang, company, showToast }: { lang: 'en' | 'ar'; company?: string | null; showToast: (m: string, t: 'success' | 'error') => void }) {
    const t = L[lang]
    const [suppliers, setSuppliers] = useState<Supplier[]>([])
    const [groups, setGroups] = useState<SupplierGroup[]>([])
    const [paymentTemplates, setPaymentTemplates] = useState<PaymentTermsTemplate[]>([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [filterGroup, setFilterGroup] = useState('')
    const [showDialog, setShowDialog] = useState(false)
    const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null)

    const load = useCallback(async () => {
        setLoading(true)
        try {
            const [s, g, pt] = await Promise.all([
                purchaseApi.getSuppliers({ company: company || undefined }),
                purchaseApi.getSupplierGroups(),
                purchaseApi.getPaymentTermsTemplates(),
            ])
            setSuppliers(s)
            setGroups(g)
            setPaymentTemplates(pt)
        } catch { /* ignore */ }
        setLoading(false)
    }, [company])

    useEffect(() => { load() }, [load])

    const filtered = useMemo(() => {
        let list = suppliers
        if (search) {
            const q = search.toLowerCase()
            list = list.filter(s => s.supplier_name?.toLowerCase().includes(q) || s.name?.toLowerCase().includes(q) || s.tax_id?.includes(q))
        }
        if (filterGroup) list = list.filter(s => s.supplier_group === filterGroup)
        return list
    }, [suppliers, search, filterGroup])

    const handleSave = async (data: Partial<Supplier>) => {
        if (editingSupplier) {
            await purchaseApi.updateSupplier(editingSupplier.name, data)
            showToast(t.supplierUpdated, 'success')
        } else {
            await purchaseApi.createSupplier(data)
            showToast(t.supplierCreated, 'success')
        }
        load()
    }

    const handleDelete = async (name: string) => {
        if (!confirm(t.confirmDeleteSupplier)) return
        try {
            await purchaseApi.deleteSupplier(name)
            showToast(t.supplierDeleted, 'success')
            load()
        } catch { showToast(t.error, 'error') }
    }

    const handleToggle = async (s: Supplier) => {
        try {
            await purchaseApi.toggleSupplier(s.name, !s.disabled)
            load()
        } catch { showToast(t.error, 'error') }
    }

    if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-emerald-500" /></div>

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex flex-wrap items-center gap-3">
                <div className="relative flex-1 min-w-[200px]">
                    <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input className="w-full ps-10 pe-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-emerald-500"
                        placeholder={t.searchPlaceholder} value={search} onChange={e => setSearch(e.target.value)} />
                </div>
                <select className="border rounded-lg px-3 py-2 text-sm" value={filterGroup} onChange={e => setFilterGroup(e.target.value)}>
                    <option value="">{t.allGroups}</option>
                    {groups.filter(g => !g.is_group).map(g => <option key={g.name} value={g.name}>{g.name}</option>)}
                </select>
                <button onClick={() => { setEditingSupplier(null); setShowDialog(true) }}
                    className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm hover:bg-emerald-700">
                    <Plus className="w-4 h-4" /> {t.newSupplier}
                </button>
                <button onClick={load} className="p-2 border rounded-lg hover:bg-gray-50"><RefreshCw className="w-4 h-4" /></button>
            </div>

            {/* List */}
            {filtered.length === 0 ? (
                <div className="text-center py-16 bg-white rounded-xl border">
                    <Users className="w-14 h-14 mx-auto text-emerald-200 mb-3" />
                    <h3 className="font-semibold text-gray-600 mb-1">{t.noSuppliers}</h3>
                    <p className="text-sm text-gray-400">{t.noSuppliersDesc}</p>
                </div>
            ) : (
                <div className="bg-white rounded-xl border overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-gray-50 text-gray-600">
                                <tr>
                                    <th className="text-start px-4 py-3 font-medium">{t.supplierName}</th>
                                    <th className="text-start px-4 py-3 font-medium">{t.supplierGroup}</th>
                                    <th className="text-start px-4 py-3 font-medium">{t.taxId}</th>
                                    <th className="text-start px-4 py-3 font-medium">{t.mobileNo}</th>
                                    <th className="text-start px-4 py-3 font-medium">{t.paymentTerms}</th>
                                    <th className="text-center px-4 py-3 font-medium">{t.actions}</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {filtered.map(s => (
                                    <tr key={s.name} className="hover:bg-gray-50">
                                        <td className="px-4 py-3">
                                            <p className="font-medium text-gray-800">{s.supplier_name}</p>
                                            <p className="text-xs text-gray-400">{s.name}</p>
                                        </td>
                                        <td className="px-4 py-3 text-gray-600">{s.supplier_group || '-'}</td>
                                        <td className="px-4 py-3 text-gray-600 font-mono text-xs" dir="ltr">{s.tax_id || '-'}</td>
                                        <td className="px-4 py-3 text-gray-600" dir="ltr">{s.mobile_no || '-'}</td>
                                        <td className="px-4 py-3 text-gray-600">{s.payment_terms || '-'}</td>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center justify-center gap-1">
                                                <button onClick={() => { setEditingSupplier(s); setShowDialog(true) }}
                                                    className="p-1.5 hover:bg-emerald-50 rounded-lg text-emerald-600" title={t.edit}>
                                                    <Edit className="w-4 h-4" />
                                                </button>
                                                <button onClick={() => handleToggle(s)}
                                                    className={`p-1.5 rounded-lg ${s.disabled ? 'hover:bg-green-50 text-green-600' : 'hover:bg-amber-50 text-amber-600'}`}
                                                    title={s.disabled ? t.enabled : t.disabled}>
                                                    {s.disabled ? <CheckCircle className="w-4 h-4" /> : <Ban className="w-4 h-4" />}
                                                </button>
                                                <button onClick={() => handleDelete(s.name)}
                                                    className="p-1.5 hover:bg-red-50 rounded-lg text-red-500" title={t.delete}>
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Dialog */}
            {showDialog && (
                <SupplierDialog
                    lang={lang} supplier={editingSupplier} groups={groups}
                    paymentTemplates={paymentTemplates}
                    onSave={handleSave} onClose={() => setShowDialog(false)}
                />
            )}
        </div>
    )
}

// ==================== PURCHASE ORDERS ====================

function POItemRow({ item, index, lang, items, uoms, onUpdate, onRemove, onAddUOM }: {
    item: PurchaseOrderItem; index: number; lang: 'en' | 'ar'
    items: PurchaseItem[]; uoms: Array<{ name: string }>; onUpdate: (i: number, data: Partial<PurchaseOrderItem>) => void; onRemove: (i: number) => void
    onAddUOM: (name: string) => void
}) {
    const t = L[lang]
    return (
        <tr className="border-b last:border-b-0">
            <td className="px-3 py-2">
                <select className="w-full border rounded px-2 py-1.5 text-sm"
                    value={item.item_code}
                    onChange={e => {
                        const picked = items.find(i => i.name === e.target.value)
                        onUpdate(index, {
                            item_code: e.target.value,
                            item_name: picked?.item_name || '',
                            uom: picked?.stock_uom || 'Nos',
                            rate: picked?.last_purchase_rate || picked?.standard_rate || 0,
                        })
                    }}>
                    <option value="">{t.selectItem}...</option>
                    {items.map(i => <option key={i.name} value={i.name}>{i.item_name} ({i.name})</option>)}
                </select>
            </td>
            <td className="px-3 py-2">
                <input type="number" min={1} className="w-20 border rounded px-2 py-1.5 text-sm text-center"
                    value={item.qty || ''} onChange={e => onUpdate(index, { qty: Number(e.target.value) })} />
            </td>
            <td className="px-3 py-2">
                <UOMCombobox value={item.uom || 'Nos'} uoms={uoms} lang={lang}
                    onChange={v => onUpdate(index, { uom: v })}
                    onAddNew={onAddUOM} />
            </td>
            <td className="px-3 py-2">
                <input type="number" min={0} step={0.01} className="w-24 border rounded px-2 py-1.5 text-sm text-center" dir="ltr"
                    value={item.rate || ''} onChange={e => onUpdate(index, { rate: Number(e.target.value) })} />
            </td>
            <td className="px-3 py-2 text-sm font-medium text-end" dir="ltr">
                {formatCurrency((item.qty || 0) * (item.rate || 0), lang)}
            </td>
            <td className="px-3 py-2 text-center">
                <button onClick={() => onRemove(index)} className="p-1 hover:bg-red-50 rounded text-red-400"><X className="w-4 h-4" /></button>
            </td>
        </tr>
    )
}

function PurchaseOrderForm({ lang, company, suppliers, onSaved, onClose }: {
    lang: 'en' | 'ar'; company: string; suppliers: Supplier[]
    onSaved: () => void; onClose: () => void
}) {
    const t = L[lang]
    const [supplier, setSupplier] = useState('')
    const [txnDate, setTxnDate] = useState(today())
    const [schedDate, setSchedDate] = useState(today())
    const [poItems, setPOItems] = useState<PurchaseOrderItem[]>([{ item_code: '', item_name: '', qty: 1, rate: 0, uom: 'Nos' }])
    const [purchaseItems, setPurchaseItems] = useState<PurchaseItem[]>([])
    const [warehouses, setWarehouses] = useState<Array<{ name: string; warehouse_name: string }>>([])
    const [warehouse, setWarehouse] = useState('')
    const [uoms, setUoms] = useState<Array<{ name: string }>>([{ name: 'Nos' }, { name: 'Unit' }, { name: 'Box' }, { name: 'Kg' }])
    const [saving, setSaving] = useState(false)

    useEffect(() => {
        purchaseApi.getWarehouses(company).then(whs => {
            setWarehouses(whs)
            const stores = whs.find(w => w.warehouse_name === 'Stores')
            if (stores && !warehouse) setWarehouse(stores.name)
        }).catch(() => { })
        purchaseApi.getUOMs().then(setUoms).catch(() => { })
    }, [company])

    useEffect(() => {
        purchaseApi.getPurchaseItems(supplier || undefined, undefined, company).then(setPurchaseItems).catch(() => { })
    }, [supplier, company])

    const updateItem = (i: number, data: Partial<PurchaseOrderItem>) => {
        setPOItems(prev => prev.map((item, idx) => idx === i ? { ...item, ...data } : item))
    }
    const removeItem = (i: number) => setPOItems(prev => prev.filter((_, idx) => idx !== i))
    const addItem = () => setPOItems(prev => [...prev, { item_code: '', item_name: '', qty: 1, rate: 0, uom: 'Nos' }])

    const grandTotal = poItems.reduce((sum, it) => sum + (it.qty || 0) * (it.rate || 0), 0)

    const handleSave = async () => {
        if (!supplier || poItems.every(it => !it.item_code)) return
        setSaving(true)
        try {
            const created = await purchaseApi.createPurchaseOrder({
                supplier,
                company,
                transaction_date: txnDate,
                schedule_date: schedDate,
                items: poItems.filter(it => it.item_code).map(it => ({
                    item_code: it.item_code,
                    qty: it.qty,
                    rate: it.rate,
                    uom: it.uom || 'Nos',
                    warehouse: warehouse,
                    schedule_date: schedDate,
                })),
            })
            // Auto-submit immediately
            if (created?.name) {
                try { await purchaseApi.submitPurchaseOrder(created.name) } catch { /* submit failed, still saved as draft */ }
            }
            onSaved()
        } catch { /* handled */ }
        setSaving(false)
    }

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40" onClick={onClose}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl mx-4 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between p-5 border-b">
                    <h2 className="text-lg font-bold text-gray-800">{t.newPO}</h2>
                    <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
                </div>
                <div className="p-5 space-y-4">
                    {/* Header fields */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">{t.selectSupplier} *</label>
                            <select className="w-full border rounded-lg px-3 py-2 text-sm" value={supplier} onChange={e => setSupplier(e.target.value)}>
                                <option value="">--</option>
                                {suppliers.map(s => <option key={s.name} value={s.name}>{s.supplier_name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">{t.warehouse} *</label>
                            <select className="w-full border rounded-lg px-3 py-2 text-sm" value={warehouse} onChange={e => setWarehouse(e.target.value)}>
                                <option value="">--</option>
                                {warehouses.map(w => <option key={w.name} value={w.name}>{w.warehouse_name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">{t.orderDate}</label>
                            <input type="date" className="w-full border rounded-lg px-3 py-2 text-sm" value={txnDate} onChange={e => setTxnDate(e.target.value)} />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">{t.requiredBy}</label>
                            <input type="date" className="w-full border rounded-lg px-3 py-2 text-sm" value={schedDate} onChange={e => setSchedDate(e.target.value)} />
                        </div>
                    </div>

                    {/* Items table */}
                    <div className="border rounded-lg overflow-hidden">
                        <table className="w-full text-sm">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="text-start px-3 py-2 font-medium">{t.itemName}</th>
                                    <th className="text-center px-3 py-2 font-medium w-20">{t.quantity}</th>
                                    <th className="text-center px-3 py-2 font-medium w-16">{t.uom}</th>
                                    <th className="text-center px-3 py-2 font-medium w-24">{t.rate}</th>
                                    <th className="text-end px-3 py-2 font-medium w-28">{t.amount}</th>
                                    <th className="w-10"></th>
                                </tr>
                            </thead>
                            <tbody>
                                {poItems.map((item, i) => (
                                    <POItemRow key={i} item={item} index={i} lang={lang} items={purchaseItems} uoms={uoms} onUpdate={updateItem} onRemove={removeItem}
                                        onAddUOM={async (name) => { try { await purchaseApi.createUOM(name); const fresh = await purchaseApi.getUOMs(); setUoms(fresh); updateItem(i, { uom: name }) } catch { } }} />
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <div className="flex items-center justify-between">
                        <button onClick={addItem} className="flex items-center gap-1 text-sm text-emerald-600 hover:text-emerald-700">
                            <Plus className="w-4 h-4" /> {t.addItem}
                        </button>
                        <div className="text-base font-bold text-gray-800">
                            {t.grandTotal}: {formatCurrency(grandTotal, lang)}
                        </div>
                    </div>
                </div>
                <div className="flex justify-end gap-2 p-5 border-t">
                    <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">{t.cancel}</button>
                    <button onClick={handleSave} disabled={saving || !supplier || !warehouse}
                        className="px-5 py-2 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-2">
                        {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                        {saving ? t.creating : t.createAndSubmit}
                    </button>
                </div>
            </div>
        </div>
    )
}

function PurchaseOrdersView({ lang, company, showToast }: { lang: 'en' | 'ar'; company?: string | null; showToast: (m: string, t: 'success' | 'error') => void }) {
    const t = L[lang]
    const [orders, setOrders] = useState<PurchaseOrder[]>([])
    const [suppliers, setSuppliers] = useState<Supplier[]>([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [statusFilter, setStatusFilter] = useState('')
    const [showForm, setShowForm] = useState(false)
    const [viewingPO, setViewingPO] = useState<PurchaseOrder | null>(null)
    const [receiptFromPO, setReceiptFromPO] = useState<PurchaseOrder | null>(null)
    const [invoiceFromPO, setInvoiceFromPO] = useState<PurchaseOrder | null>(null)
    const [duplicatingPO, setDuplicatingPO] = useState<PurchaseOrder | null>(null)
    const [schedulingPO, setSchedulingPO] = useState<PurchaseOrder | null>(null)

    const load = useCallback(async () => {
        setLoading(true)
        try {
            const [o, s] = await Promise.all([
                purchaseApi.getPurchaseOrders({ company: company || undefined, status: statusFilter || undefined }),
                purchaseApi.getSuppliers({ company: company || undefined }),
            ])
            setOrders(o)
            setSuppliers(s)
        } catch { /* */ }
        setLoading(false)
    }, [company, statusFilter])

    useEffect(() => { load() }, [load])

    const filtered = useMemo(() => {
        if (!search) return orders
        const q = search.toLowerCase()
        return orders.filter(o => o.name?.toLowerCase().includes(q) || o.supplier_name?.toLowerCase().includes(q))
    }, [orders, search])

    const handleSubmit = async (name: string) => {
        if (!confirm(t.confirmSubmit)) return
        try {
            await purchaseApi.submitPurchaseOrder(name)
            showToast(t.poSubmitted, 'success')
            load()
        } catch (e: any) { showToast(e?.message || t.error, 'error') }
    }

    const handleCancel = async (name: string) => {
        if (!confirm(t.confirmCancel)) return
        try {
            await purchaseApi.cancelPurchaseOrder(name)
            showToast(t.poCancelled, 'success')
            load()
        } catch (e: any) { showToast(e?.message || t.error, 'error') }
    }

    const handleDelete = async (name: string) => {
        if (!confirm(t.confirmDelete)) return
        try {
            await purchaseApi.deletePurchaseOrder(name)
            showToast(t.poDeleted, 'success')
            load()
        } catch (e: any) { showToast(e?.message || t.error, 'error') }
    }

    const handleView = async (name: string) => {
        try {
            const full = await purchaseApi.getPurchaseOrder(name)
            setViewingPO(full)
        } catch { /* */ }
    }

    if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-emerald-500" /></div>

    const PO_STATUSES = ['To Receive and Bill', 'To Receive', 'To Bill', 'Completed', 'Cancelled', 'Draft', 'Closed']

    return (
        <div className="space-y-4">
            {/* Toolbar */}
            <div className="flex flex-wrap items-center gap-3">
                <div className="relative flex-1 min-w-[200px]">
                    <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input className="w-full ps-10 pe-3 py-2 border rounded-lg text-sm" placeholder={t.searchPlaceholder} value={search} onChange={e => setSearch(e.target.value)} />
                </div>
                <select className="border rounded-lg px-3 py-2 text-sm" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
                    <option value="">{t.allStatuses}</option>
                    {PO_STATUSES.map(s => <option key={s} value={s}>{statusLabel(s, lang)}</option>)}
                </select>
                <button onClick={() => setShowForm(true)} className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm hover:bg-emerald-700">
                    <Plus className="w-4 h-4" /> {t.newPO}
                </button>
                <button onClick={load} className="p-2 border rounded-lg hover:bg-gray-50"><RefreshCw className="w-4 h-4" /></button>
            </div>

            {/* Table */}
            {filtered.length === 0 ? (
                <div className="text-center py-16 bg-white rounded-xl border">
                    <ShoppingCart className="w-14 h-14 mx-auto text-emerald-200 mb-3" />
                    <h3 className="font-semibold text-gray-600 mb-1">{t.noPOs}</h3>
                    <p className="text-sm text-gray-400">{t.noPOsDesc}</p>
                </div>
            ) : (
                <div className="bg-white rounded-xl border overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-gray-50 text-gray-600">
                                <tr>
                                    <th className="text-start px-4 py-3 font-medium">#</th>
                                    <th className="text-start px-4 py-3 font-medium">{t.supplier}</th>
                                    <th className="text-start px-4 py-3 font-medium">{t.orderDate}</th>
                                    <th className="text-end px-4 py-3 font-medium">{t.grandTotal}</th>
                                    <th className="text-center px-4 py-3 font-medium">{t.status}</th>
                                    <th className="text-center px-4 py-3 font-medium">{t.actions}</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {filtered.map(o => (
                                    <tr key={o.name} className="hover:bg-gray-50">
                                        <td className="px-4 py-3 font-mono text-xs text-emerald-700">{o.name}</td>
                                        <td className="px-4 py-3 font-medium text-gray-800">{o.supplier_name || o.supplier}</td>
                                        <td className="px-4 py-3 text-gray-600">{formatDate(o.transaction_date)}</td>
                                        <td className="px-4 py-3 text-end font-medium" dir="ltr">{formatCurrency(o.grand_total, lang)}</td>
                                        <td className="px-4 py-3 text-center">
                                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColor(o.status)}`}>
                                                {statusLabel(o.status, lang)}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center justify-center gap-0.5 flex-wrap">
                                                <button onClick={() => handleView(o.name)} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500" title={t.view}><Eye className="w-4 h-4" /></button>
                                                {o.docstatus === 1 && (
                                                    <button onClick={() => printDoc('Purchase Order', o.name)} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500" title={t.printDocument}><Printer className="w-4 h-4" /></button>
                                                )}
                                                {o.docstatus === 1 && (o.per_received ?? 0) < 100 && (
                                                    <button onClick={async () => { const full = await purchaseApi.getPurchaseOrder(o.name); setReceiptFromPO(full) }}
                                                        className="p-1.5 hover:bg-teal-50 rounded-lg text-teal-600" title={t.createReceipt}><PackageCheck className="w-4 h-4" /></button>
                                                )}
                                                {o.docstatus === 1 && (o.per_billed ?? 0) < 100 && (
                                                    <button onClick={async () => { const full = await purchaseApi.getPurchaseOrder(o.name); setInvoiceFromPO(full) }}
                                                        className="p-1.5 hover:bg-indigo-50 rounded-lg text-indigo-600" title={t.createInvoice}><FileText className="w-4 h-4" /></button>
                                                )}
                                                {o.docstatus === 1 && (
                                                    <button onClick={async () => { const full = await purchaseApi.getPurchaseOrder(o.name); setDuplicatingPO(full) }}
                                                        className="p-1.5 hover:bg-amber-50 rounded-lg text-amber-600" title={t.duplicateOrder}><Copy className="w-4 h-4" /></button>
                                                )}
                                                {o.docstatus === 0 && (
                                                    <>
                                                        <button onClick={() => handleSubmit(o.name)} className="p-1.5 hover:bg-emerald-50 rounded-lg text-emerald-600" title={t.submit}><Send className="w-4 h-4" /></button>
                                                        <button onClick={() => handleDelete(o.name)} className="p-1.5 hover:bg-red-50 rounded-lg text-red-500" title={t.delete}><Trash2 className="w-4 h-4" /></button>
                                                    </>
                                                )}
                                                {o.docstatus === 1 && (
                                                    <button onClick={() => handleCancel(o.name)} className="p-1.5 hover:bg-red-50 rounded-lg text-red-500" title={t.cancel}><Ban className="w-4 h-4" /></button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* PO Form */}
            {showForm && company && (
                <PurchaseOrderForm
                    lang={lang} company={company} suppliers={suppliers}
                    onSaved={() => { setShowForm(false); showToast(t.poCreated, 'success'); load() }}
                    onClose={() => setShowForm(false)}
                />
            )}

            {/* PO Detail View */}
            {viewingPO && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40" onClick={() => setViewingPO(null)}>
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl mx-4 max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between p-5 border-b">
                            <div>
                                <h2 className="text-lg font-bold text-gray-800">{viewingPO.name}</h2>
                                <p className="text-sm text-gray-500">{viewingPO.supplier_name}</p>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColor(viewingPO.status)}`}>
                                    {statusLabel(viewingPO.status, lang)}
                                </span>
                                <button onClick={() => printDoc('Purchase Order', viewingPO.name)} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500" title={t.printDocument}><Printer className="w-4 h-4" /></button>
                                <button onClick={() => setViewingPO(null)} className="p-1 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
                            </div>
                        </div>
                        <div className="p-5 space-y-4">
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                                <div><span className="text-gray-500">{t.orderDate}:</span><br /><span className="font-medium">{formatDate(viewingPO.transaction_date)}</span></div>
                                <div><span className="text-gray-500">{t.requiredBy}:</span><br /><span className="font-medium">{formatDate(viewingPO.schedule_date)}</span></div>
                                <div><span className="text-gray-500">{t.grandTotal}:</span><br /><span className="font-medium">{formatCurrency(viewingPO.grand_total, lang)}</span></div>
                                <div><span className="text-gray-500">{t.received}/{t.billed}:</span><br /><span className="font-medium">{viewingPO.per_received ?? 0}% / {viewingPO.per_billed ?? 0}%</span></div>
                            </div>
                            {viewingPO.items && viewingPO.items.length > 0 && (
                                <div className="border rounded-lg overflow-hidden">
                                    <table className="w-full text-sm">
                                        <thead className="bg-gray-50">
                                            <tr>
                                                <th className="text-start px-3 py-2">{t.itemName}</th>
                                                <th className="text-center px-3 py-2">{t.quantity}</th>
                                                <th className="text-end px-3 py-2">{t.rate}</th>
                                                <th className="text-end px-3 py-2">{t.amount}</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y">
                                            {viewingPO.items.map((it, i) => (
                                                <tr key={i}>
                                                    <td className="px-3 py-2">{it.item_name || it.item_code}</td>
                                                    <td className="px-3 py-2 text-center">{it.qty}</td>
                                                    <td className="px-3 py-2 text-end" dir="ltr">{formatCurrency(it.rate, lang)}</td>
                                                    <td className="px-3 py-2 text-end" dir="ltr">{formatCurrency(it.amount, lang)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}

                            {/* ── PO Quick Actions ── */}
                            {viewingPO.docstatus === 1 && (
                                <div className="border-t pt-4 space-y-3">
                                    <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                                        <ArrowRight className="w-4 h-4 text-emerald-500" /> {t.poActions}
                                    </h3>
                                    <div className="flex flex-wrap gap-2">
                                        {(viewingPO.per_received ?? 0) < 100 && (
                                            <button
                                                onClick={() => { setReceiptFromPO(viewingPO); setViewingPO(null) }}
                                                className="flex items-center gap-2 px-4 py-2.5 bg-teal-50 text-teal-700 border border-teal-200 rounded-xl text-sm font-medium hover:bg-teal-100 transition-colors"
                                            >
                                                <PackageCheck className="w-4 h-4" /> {t.createReceipt}
                                            </button>
                                        )}
                                        {(viewingPO.per_billed ?? 0) < 100 && (
                                            <button
                                                onClick={() => { setInvoiceFromPO(viewingPO); setViewingPO(null) }}
                                                className="flex items-center gap-2 px-4 py-2.5 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-xl text-sm font-medium hover:bg-indigo-100 transition-colors"
                                            >
                                                <FileText className="w-4 h-4" /> {t.createInvoice}
                                            </button>
                                        )}
                                        <button
                                            onClick={() => { setDuplicatingPO(viewingPO); setViewingPO(null) }}
                                            className="flex items-center gap-2 px-4 py-2.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-xl text-sm font-medium hover:bg-amber-100 transition-colors"
                                        >
                                            <Copy className="w-4 h-4" /> {t.duplicateOrder}
                                        </button>
                                        <button
                                            onClick={() => { setSchedulingPO(viewingPO); setViewingPO(null) }}
                                            className="flex items-center gap-2 px-4 py-2.5 bg-violet-50 text-violet-700 border border-violet-200 rounded-xl text-sm font-medium hover:bg-violet-100 transition-colors"
                                        >
                                            <CalendarClock className="w-4 h-4" /> {t.scheduleRecurring}
                                        </button>
                                        {viewingPO.status === 'Completed' && (
                                            <span className="flex items-center gap-2 px-4 py-2.5 bg-green-50 text-green-700 rounded-xl text-sm font-medium">
                                                <CheckCircle className="w-4 h-4" /> {statusLabel('Completed', lang)}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Receipt from PO dialog */}
            {receiptFromPO && company && (
                <ReceiptFromPODialog
                    lang={lang} company={company} suppliers={suppliers}
                    pendingPOs={[]} preSelectedPO={receiptFromPO}
                    onCreated={() => { setReceiptFromPO(null); showToast(t.autoSubmitted, 'success'); load() }}
                    onClose={() => setReceiptFromPO(null)}
                />
            )}

            {/* Invoice from PO dialog */}
            {invoiceFromPO && company && (
                <InvoiceFromPODialog
                    lang={lang} company={company}
                    po={invoiceFromPO}
                    onCreated={() => { setInvoiceFromPO(null); showToast(t.autoSubmitted, 'success'); load() }}
                    onClose={() => setInvoiceFromPO(null)}
                />
            )}

            {/* Duplicate PO dialog */}
            {duplicatingPO && company && (
                <DuplicatePODialog
                    lang={lang} company={company} suppliers={suppliers} sourcePO={duplicatingPO}
                    onCreated={() => { setDuplicatingPO(null); showToast(t.orderDuplicated, 'success'); load() }}
                    onClose={() => setDuplicatingPO(null)}
                />
            )}

            {/* Schedule recurring PO dialog */}
            {schedulingPO && (
                <SchedulePODialog
                    lang={lang} po={schedulingPO}
                    onCreated={() => { setSchedulingPO(null); showToast(t.scheduleCreated, 'success') }}
                    onClose={() => setSchedulingPO(null)}
                    showToast={showToast}
                />
            )}
        </div>
    )
}

// ==================== DUPLICATE PO ====================

function DuplicatePODialog({ lang, company, suppliers, sourcePO, onCreated, onClose }: {
    lang: 'en' | 'ar'; company: string; suppliers: Supplier[]; sourcePO: PurchaseOrder
    onCreated: () => void; onClose: () => void
}) {
    const t = L[lang]
    const [supplier, setSupplier] = useState(sourcePO.supplier || '')
    const [txnDate, setTxnDate] = useState(today())
    const [schedDate, setSchedDate] = useState(today())
    const [warehouse, setWarehouse] = useState('')
    const [warehouses, setWarehouses] = useState<Array<{ name: string; warehouse_name: string }>>([])
    const [items, setItems] = useState(
        (sourcePO.items || []).map(it => ({ item_code: it.item_code, item_name: it.item_name || '', qty: it.qty, rate: it.rate, uom: it.uom || 'Nos' }))
    )
    const [saving, setSaving] = useState(false)

    useEffect(() => {
        purchaseApi.getWarehouses(company).then(whs => {
            setWarehouses(whs)
            // Try to match original warehouse
            const orig = sourcePO.items?.[0]?.warehouse
            const match = whs.find(w => w.name === orig)
            setWarehouse(match ? match.name : whs.find(w => w.warehouse_name === 'Stores')?.name || whs[0]?.name || '')
        }).catch(() => { })
    }, [company])

    const grandTotal = items.reduce((s, it) => s + (it.qty || 0) * (it.rate || 0), 0)

    const handleCreate = async () => {
        if (!supplier || items.every(it => !it.item_code)) return
        setSaving(true)
        try {
            const created = await purchaseApi.createPurchaseOrder({
                supplier, company,
                transaction_date: txnDate,
                schedule_date: schedDate,
                items: items.filter(it => it.item_code).map(it => ({
                    item_code: it.item_code, qty: it.qty, rate: it.rate, uom: it.uom, warehouse, schedule_date: schedDate,
                })),
            })
            if (created?.name) {
                try { await purchaseApi.submitPurchaseOrder(created.name) } catch { /* draft is fine */ }
            }
            onCreated()
        } catch { /* */ }
        setSaving(false)
    }

    const updateItem = (i: number, data: Partial<typeof items[0]>) => {
        setItems(prev => prev.map((item, idx) => idx === i ? { ...item, ...data } : item))
    }

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40" onClick={onClose}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl mx-4 max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between p-5 border-b">
                    <div>
                        <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2"><Copy className="w-5 h-5 text-amber-600" /> {t.duplicateOrder}</h2>
                        <p className="text-xs text-gray-400 mt-0.5">{lang === 'ar' ? `نسخة من ${sourcePO.name}` : `Copy of ${sourcePO.name}`}</p>
                    </div>
                    <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
                </div>
                <div className="p-5 space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">{t.selectSupplier}</label>
                            <select className="w-full border rounded-lg px-3 py-2 text-sm" value={supplier} onChange={e => setSupplier(e.target.value)}>
                                <option value="">--</option>
                                {suppliers.map(s => <option key={s.name} value={s.name}>{s.supplier_name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">{t.warehouse}</label>
                            <select className="w-full border rounded-lg px-3 py-2 text-sm" value={warehouse} onChange={e => setWarehouse(e.target.value)}>
                                <option value="">--</option>
                                {warehouses.map(w => <option key={w.name} value={w.name}>{w.warehouse_name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">{t.orderDate}</label>
                            <input type="date" className="w-full border rounded-lg px-3 py-2 text-sm" value={txnDate} onChange={e => setTxnDate(e.target.value)} />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">{t.requiredBy}</label>
                            <input type="date" className="w-full border rounded-lg px-3 py-2 text-sm" value={schedDate} onChange={e => setSchedDate(e.target.value)} />
                        </div>
                    </div>
                    <div className="border rounded-lg overflow-hidden">
                        <table className="w-full text-sm">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="text-start px-3 py-2 font-medium">{t.itemName}</th>
                                    <th className="text-center px-3 py-2 font-medium w-20">{t.quantity}</th>
                                    <th className="text-center px-3 py-2 font-medium w-24">{t.rate}</th>
                                    <th className="text-end px-3 py-2 font-medium w-28">{t.amount}</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {items.map((it, i) => (
                                    <tr key={i}>
                                        <td className="px-3 py-2 text-gray-700">{it.item_name || it.item_code}</td>
                                        <td className="px-3 py-2">
                                            <input type="number" min={1} className="w-full border rounded px-2 py-1 text-sm text-center"
                                                value={it.qty} onChange={e => updateItem(i, { qty: Number(e.target.value) })} />
                                        </td>
                                        <td className="px-3 py-2">
                                            <input type="number" min={0} step={0.01} className="w-full border rounded px-2 py-1 text-sm text-center" dir="ltr"
                                                value={it.rate} onChange={e => updateItem(i, { rate: Number(e.target.value) })} />
                                        </td>
                                        <td className="px-3 py-2 text-end font-medium" dir="ltr">{formatCurrency((it.qty || 0) * (it.rate || 0), lang)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <div className="text-end text-base font-bold text-gray-800">{t.grandTotal}: {formatCurrency(grandTotal, lang)}</div>
                </div>
                <div className="flex justify-end gap-2 p-5 border-t">
                    <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">{t.cancel}</button>
                    <button onClick={handleCreate} disabled={saving || !supplier || !warehouse}
                        className="px-5 py-2 text-sm bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50 flex items-center gap-2">
                        {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                        {saving ? t.creating : t.createAndSubmit}
                    </button>
                </div>
            </div>
        </div>
    )
}

// ==================== SCHEDULE RECURRING PO ====================

function SchedulePODialog({ lang, po, onCreated, onClose, showToast }: {
    lang: 'en' | 'ar'; po: PurchaseOrder; onCreated: () => void; onClose: () => void
    showToast: (m: string, t: 'success' | 'error') => void
}) {
    const t = L[lang]
    const [frequency, setFrequency] = useState('Weekly')
    const [startDate, setStartDate] = useState(futureDate(7))
    const [endDate, setEndDate] = useState('')
    const [saving, setSaving] = useState(false)

    const freqOptions = [
        { value: 'Weekly', label: t.weekly },
        { value: 'Monthly', label: t.monthly },
        { value: 'Quarterly', label: t.quarterly },
        { value: 'Half-yearly', label: t.halfYearly },
        { value: 'Yearly', label: t.yearly },
    ]

    const handleCreate = async () => {
        setSaving(true)
        try {
            await purchaseApi.createAutoRepeat({
                reference_doctype: 'Purchase Order',
                reference_document: po.name,
                frequency,
                start_date: startDate,
                end_date: endDate || undefined,
                submit_on_creation: 1,
            })
            onCreated()
        } catch (e: any) { showToast(e?.message || t.scheduleError, 'error') }
        setSaving(false)
    }

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40" onClick={onClose}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between p-5 border-b">
                    <div>
                        <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2"><CalendarClock className="w-5 h-5 text-violet-600" /> {t.scheduleRecurring}</h2>
                        <p className="text-xs text-gray-400 mt-0.5">{po.name} — {po.supplier_name}</p>
                    </div>
                    <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
                </div>
                <div className="p-5 space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">{t.frequency} *</label>
                        <select className="w-full border rounded-lg px-3 py-2 text-sm" value={frequency} onChange={e => setFrequency(e.target.value)}>
                            {freqOptions.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                        </select>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">{t.startDate} *</label>
                            <input type="date" className="w-full border rounded-lg px-3 py-2 text-sm" value={startDate} onChange={e => setStartDate(e.target.value)} />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">{t.endDate}</label>
                            <input type="date" className="w-full border rounded-lg px-3 py-2 text-sm" value={endDate} onChange={e => setEndDate(e.target.value)} />
                        </div>
                    </div>
                    <div className="bg-violet-50 rounded-lg p-3 text-sm text-violet-700">
                        <Repeat className="w-4 h-4 inline-block mr-1" />
                        {lang === 'ar'
                            ? `سيتم تكرار هذا الطلب ${freqOptions.find(f => f.value === frequency)?.label} بدءاً من ${startDate}`
                            : `This order will repeat ${frequency.toLowerCase()} starting ${startDate}`}
                        {endDate ? ` ${t.untilDate} ${endDate}` : ` ${t.indefinitely}`}
                    </div>
                </div>
                <div className="flex justify-end gap-2 p-5 border-t">
                    <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">{t.cancel}</button>
                    <button onClick={handleCreate} disabled={saving || !startDate}
                        className="px-5 py-2 text-sm bg-violet-600 text-white rounded-lg hover:bg-violet-700 disabled:opacity-50 flex items-center gap-2">
                        {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                        {saving ? t.creating : t.scheduleRecurring}
                    </button>
                </div>
            </div>
        </div>
    )
}

// ==================== PURCHASE RECEIPTS ====================

function ReceiptsView({ lang, company, showToast }: { lang: 'en' | 'ar'; company?: string | null; showToast: (m: string, t: 'success' | 'error') => void }) {
    const t = L[lang]
    const [receipts, setReceipts] = useState<PurchaseReceipt[]>([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [showCreate, setShowCreate] = useState(false)
    const [suppliers, setSuppliers] = useState<Supplier[]>([])
    const [pendingPOs, setPendingPOs] = useState<PurchaseOrder[]>([])

    const load = useCallback(async () => {
        setLoading(true)
        try {
            const [r, s, po] = await Promise.all([
                purchaseApi.getPurchaseReceipts({ company: company || undefined }),
                purchaseApi.getSuppliers({ company: company || undefined }),
                purchaseApi.getPurchaseOrders({ company: company || undefined, status: 'To Receive and Bill' }),
            ])
            setReceipts(r)
            setSuppliers(s)
            setPendingPOs(po)
        } catch { /* */ }
        setLoading(false)
    }, [company])

    useEffect(() => { load() }, [load])

    const filtered = useMemo(() => {
        if (!search) return receipts
        const q = search.toLowerCase()
        return receipts.filter(r => r.name?.toLowerCase().includes(q) || r.supplier_name?.toLowerCase().includes(q))
    }, [receipts, search])

    const handleSubmit = async (name: string) => {
        if (!confirm(t.confirmSubmit)) return
        try { await purchaseApi.submitPurchaseReceipt(name); showToast(t.receiptSubmitted, 'success'); load() }
        catch (e: any) { showToast(e?.message || t.error, 'error') }
    }

    if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-emerald-500" /></div>

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
                <div className="relative flex-1 min-w-[200px]">
                    <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input className="w-full ps-10 pe-3 py-2 border rounded-lg text-sm" placeholder={t.searchPlaceholder} value={search} onChange={e => setSearch(e.target.value)} />
                </div>
                <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm hover:bg-emerald-700">
                    <Plus className="w-4 h-4" /> {t.newReceipt}
                </button>
                <button onClick={load} className="p-2 border rounded-lg hover:bg-gray-50"><RefreshCw className="w-4 h-4" /></button>
            </div>

            {filtered.length === 0 ? (
                <div className="text-center py-16 bg-white rounded-xl border">
                    <PackageCheck className="w-14 h-14 mx-auto text-emerald-200 mb-3" />
                    <h3 className="font-semibold text-gray-600 mb-1">{t.noReceipts}</h3>
                    <p className="text-sm text-gray-400">{t.noReceiptsDesc}</p>
                </div>
            ) : (
                <div className="bg-white rounded-xl border overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-gray-50 text-gray-600">
                                <tr>
                                    <th className="text-start px-4 py-3 font-medium">#</th>
                                    <th className="text-start px-4 py-3 font-medium">{t.supplier}</th>
                                    <th className="text-start px-4 py-3 font-medium">{t.postingDate}</th>
                                    <th className="text-end px-4 py-3 font-medium">{t.grandTotal}</th>
                                    <th className="text-center px-4 py-3 font-medium">{t.status}</th>
                                    <th className="text-center px-4 py-3 font-medium">{t.actions}</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {filtered.map(r => (
                                    <tr key={r.name} className="hover:bg-gray-50">
                                        <td className="px-4 py-3 font-mono text-xs text-emerald-700">{r.name}</td>
                                        <td className="px-4 py-3 font-medium text-gray-800">{r.supplier_name || r.supplier}</td>
                                        <td className="px-4 py-3 text-gray-600">{formatDate(r.posting_date)}</td>
                                        <td className="px-4 py-3 text-end font-medium" dir="ltr">{formatCurrency(r.grand_total, lang)}</td>
                                        <td className="px-4 py-3 text-center">
                                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColor(r.status)}`}>
                                                {statusLabel(r.status, lang)}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center justify-center gap-1">
                                                {r.docstatus === 0 && (
                                                    <button onClick={() => handleSubmit(r.name)} className="p-1.5 hover:bg-emerald-50 rounded-lg text-emerald-600" title={t.submit}><Send className="w-4 h-4" /></button>
                                                )}
                                                <button onClick={() => printDoc('Purchase Receipt', r.name)} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500" title={t.printDocument}><Printer className="w-4 h-4" /></button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Simple create dialog for receipts from PO */}
            {showCreate && (
                <ReceiptFromPODialog
                    lang={lang} company={company || ''} suppliers={suppliers} pendingPOs={pendingPOs}
                    onCreated={() => { setShowCreate(false); showToast(t.receiptCreated, 'success'); load() }}
                    onClose={() => setShowCreate(false)}
                />
            )}
        </div>
    )
}

function ReceiptFromPODialog({ lang, company, suppliers, pendingPOs, preSelectedPO, onCreated, onClose }: {
    lang: 'en' | 'ar'; company: string; suppliers: Supplier[]
    pendingPOs: PurchaseOrder[]; preSelectedPO?: PurchaseOrder | null; onCreated: () => void; onClose: () => void
}) {
    const t = L[lang]
    const [selectedPO, setSelectedPO] = useState(preSelectedPO?.name || '')
    const [poDetail, setPODetail] = useState<PurchaseOrder | null>(preSelectedPO || null)
    const [postingDate, setPostingDate] = useState(today())
    const [saving, setSaving] = useState(false)

    useEffect(() => {
        if (preSelectedPO) {
            // Already have the detail from the parent
            setPODetail(preSelectedPO)
            setSelectedPO(preSelectedPO.name)
            // Refresh for latest data
            purchaseApi.getPurchaseOrder(preSelectedPO.name).then(setPODetail).catch(() => { })
        }
    }, [preSelectedPO])

    useEffect(() => {
        if (selectedPO && !preSelectedPO) {
            purchaseApi.getPurchaseOrder(selectedPO).then(setPODetail).catch(() => { })
        } else if (!selectedPO) { setPODetail(null) }
    }, [selectedPO, preSelectedPO])

    const handleCreate = async () => {
        if (!poDetail || !poDetail.items?.length) return
        setSaving(true)
        try {
            const created = await purchaseApi.createPurchaseReceipt({
                supplier: poDetail.supplier,
                company,
                posting_date: postingDate,
                items: poDetail.items.map(it => ({
                    item_code: it.item_code,
                    qty: it.qty - (it.received_qty || 0),
                    rate: it.rate,
                    uom: it.uom || 'Nos',
                    warehouse: it.warehouse,
                    purchase_order: poDetail.name,
                    purchase_order_item: it.name,
                })).filter(it => it.qty > 0),
            })
            // Auto-submit immediately
            if (created?.name) {
                try { await purchaseApi.submitPurchaseReceipt(created.name) } catch { /* submit failed, still saved as draft */ }
            }
            onCreated()
        } catch { /* */ }
        setSaving(false)
    }

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40" onClick={onClose}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between p-5 border-b">
                    <h2 className="text-lg font-bold text-gray-800">{t.newReceipt}</h2>
                    <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
                </div>
                <div className="p-5 space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">{t.selectPO} *</label>
                        {preSelectedPO ? (
                            <div className="w-full border rounded-lg px-3 py-2 text-sm bg-gray-50 text-gray-700 font-medium">
                                {preSelectedPO.name} — {preSelectedPO.supplier_name}
                            </div>
                        ) : (
                            <select className="w-full border rounded-lg px-3 py-2 text-sm" value={selectedPO} onChange={e => setSelectedPO(e.target.value)}>
                                <option value="">--</option>
                                {pendingPOs.map(po => <option key={po.name} value={po.name}>{po.name} — {po.supplier_name}</option>)}
                            </select>
                        )}
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">{t.postingDate}</label>
                        <input type="date" className="w-full border rounded-lg px-3 py-2 text-sm" value={postingDate} onChange={e => setPostingDate(e.target.value)} />
                    </div>
                    {poDetail && poDetail.items && (
                        <div className="border rounded-lg p-3 space-y-2">
                            <p className="text-sm font-medium text-gray-700">{t.grandTotal}: {formatCurrency(poDetail.grand_total, lang)}</p>
                            {poDetail.items.filter(it => it.qty - (it.received_qty || 0) > 0).map((it, i) => (
                                <div key={i} className="flex items-center justify-between text-sm bg-gray-50 rounded px-3 py-2">
                                    <span>{it.item_name || it.item_code}</span>
                                    <span className="font-medium">{it.qty - (it.received_qty || 0)} {it.uom}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
                <div className="flex justify-end gap-2 p-5 border-t">
                    <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">{t.cancel}</button>
                    <button onClick={handleCreate} disabled={saving || !selectedPO}
                        className="px-5 py-2 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-2">
                        {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                        {saving ? t.creating : t.createAndSubmit}
                    </button>
                </div>
            </div>
        </div>
    )
}

// ==================== PURCHASE INVOICES ====================

function InvoiceFromPODialog({ lang, company, po, onCreated, onClose }: {
    lang: 'en' | 'ar'; company: string; po: PurchaseOrder; onCreated: () => void; onClose: () => void
}) {
    const t = L[lang]
    const [poDetail, setPODetail] = useState<PurchaseOrder>(po)
    const [postingDate, setPostingDate] = useState(today())
    const [saving, setSaving] = useState(false)

    useEffect(() => {
        purchaseApi.getPurchaseOrder(po.name).then(setPODetail).catch(() => { })
    }, [po.name])

    const handleCreate = async () => {
        if (!poDetail.items?.length) return
        setSaving(true)
        try {
            // Don't send due_date — let ERPNext calculate it from supplier payment terms
            const created = await purchaseApi.createPurchaseInvoice({
                supplier: poDetail.supplier,
                company,
                posting_date: postingDate,
                items: poDetail.items.map(it => ({
                    item_code: it.item_code,
                    qty: it.qty,
                    rate: it.rate,
                    warehouse: it.warehouse,
                    purchase_order: poDetail.name,
                })).filter(it => it.qty > 0),
            })
            // Auto-submit immediately
            if (created?.name) {
                try { await purchaseApi.submitPurchaseInvoice(created.name) } catch { /* submit failed, still saved as draft */ }
            }
            onCreated()
        } catch { /* */ }
        setSaving(false)
    }

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40" onClick={onClose}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between p-5 border-b">
                    <h2 className="text-lg font-bold text-gray-800">{t.newInvoice}</h2>
                    <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
                </div>
                <div className="p-5 space-y-4">
                    <div className="w-full border rounded-lg px-3 py-2 text-sm bg-gray-50 text-gray-700 font-medium">
                        {po.name} — {po.supplier_name}
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">{t.postingDate}</label>
                        <input type="date" className="w-full border rounded-lg px-3 py-2 text-sm" value={postingDate} onChange={e => setPostingDate(e.target.value)} />
                    </div>
                    {poDetail.items && (
                        <div className="border rounded-lg p-3 space-y-2">
                            <p className="text-sm font-medium text-gray-700">{t.grandTotal}: {formatCurrency(poDetail.grand_total, lang)}</p>
                            {poDetail.items.map((it, i) => (
                                <div key={i} className="flex items-center justify-between text-sm bg-gray-50 rounded px-3 py-2">
                                    <span>{it.item_name || it.item_code}</span>
                                    <span className="font-medium">{it.qty} × {formatCurrency(it.rate, lang)}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
                <div className="flex justify-end gap-2 p-5 border-t">
                    <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">{t.cancel}</button>
                    <button onClick={handleCreate} disabled={saving}
                        className="px-5 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2">
                        {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                        {saving ? t.creating : t.createAndSubmit}
                    </button>
                </div>
            </div>
        </div>
    )
}

function InvoicesView({ lang, company, showToast }: { lang: 'en' | 'ar'; company?: string | null; showToast: (m: string, t: 'success' | 'error') => void }) {
    const t = L[lang]
    const [invoices, setInvoices] = useState<PurchaseInvoice[]>([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [showCreate, setShowCreate] = useState(false)
    const [billablePOs, setBillablePOs] = useState<PurchaseOrder[]>([])
    const [selectedPOForInvoice, setSelectedPOForInvoice] = useState<PurchaseOrder | null>(null)
    const [payingInvoice, setPayingInvoice] = useState<PurchaseInvoice | null>(null)

    const load = useCallback(async () => {
        setLoading(true)
        try {
            const [inv, pos] = await Promise.all([
                purchaseApi.getPurchaseInvoices({ company: company || undefined }),
                purchaseApi.getPurchaseOrders({ company: company || undefined, status: 'To Bill' }),
            ])
            setInvoices(inv)
            setBillablePOs(pos)
            // Also add "To Receive and Bill" POs
            try {
                const morePOs = await purchaseApi.getPurchaseOrders({ company: company || undefined, status: 'To Receive and Bill' })
                setBillablePOs(prev => [...prev, ...morePOs])
            } catch { /* */ }
        } catch { /* */ }
        setLoading(false)
    }, [company])

    useEffect(() => { load() }, [load])

    const filtered = useMemo(() => {
        if (!search) return invoices
        const q = search.toLowerCase()
        return invoices.filter(i => i.name?.toLowerCase().includes(q) || i.supplier_name?.toLowerCase().includes(q))
    }, [invoices, search])

    const handleSubmit = async (name: string) => {
        if (!confirm(t.confirmSubmit)) return
        try { await purchaseApi.submitPurchaseInvoice(name); showToast(t.invoiceSubmitted, 'success'); load() }
        catch (e: any) { showToast(e?.message || t.error, 'error') }
    }

    if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-emerald-500" /></div>

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
                <div className="relative flex-1 min-w-[200px]">
                    <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input className="w-full ps-10 pe-3 py-2 border rounded-lg text-sm" placeholder={t.searchPlaceholder} value={search} onChange={e => setSearch(e.target.value)} />
                </div>
                <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700">
                    <Plus className="w-4 h-4" /> {t.newInvoice}
                </button>
                <button onClick={load} className="p-2 border rounded-lg hover:bg-gray-50"><RefreshCw className="w-4 h-4" /></button>
            </div>

            {filtered.length === 0 ? (
                <div className="text-center py-16 bg-white rounded-xl border">
                    <FileText className="w-14 h-14 mx-auto text-emerald-200 mb-3" />
                    <h3 className="font-semibold text-gray-600 mb-1">{t.noInvoices}</h3>
                    <p className="text-sm text-gray-400">{t.noInvoicesDesc}</p>
                    {billablePOs.length > 0 && (
                        <button onClick={() => setShowCreate(true)} className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700">
                            {t.newInvoice}
                        </button>
                    )}
                </div>
            ) : (
                <div className="bg-white rounded-xl border overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-gray-50 text-gray-600">
                                <tr>
                                    <th className="text-start px-4 py-3 font-medium">#</th>
                                    <th className="text-start px-4 py-3 font-medium">{t.supplier}</th>
                                    <th className="text-start px-4 py-3 font-medium">{t.postingDate}</th>
                                    <th className="text-start px-4 py-3 font-medium">{t.dueDate}</th>
                                    <th className="text-end px-4 py-3 font-medium">{t.grandTotal}</th>
                                    <th className="text-end px-4 py-3 font-medium">{t.outstanding}</th>
                                    <th className="text-center px-4 py-3 font-medium">{t.status}</th>
                                    <th className="text-center px-4 py-3 font-medium">{t.actions}</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {filtered.map(inv => (
                                    <tr key={inv.name} className="hover:bg-gray-50">
                                        <td className="px-4 py-3 font-mono text-xs text-emerald-700">{inv.name}</td>
                                        <td className="px-4 py-3 font-medium text-gray-800">{inv.supplier_name || inv.supplier}</td>
                                        <td className="px-4 py-3 text-gray-600">{formatDate(inv.posting_date)}</td>
                                        <td className="px-4 py-3 text-gray-600">{formatDate(inv.due_date)}</td>
                                        <td className="px-4 py-3 text-end font-medium" dir="ltr">{formatCurrency(inv.grand_total, lang)}</td>
                                        <td className="px-4 py-3 text-end" dir="ltr">
                                            <span className={inv.outstanding_amount ? 'text-red-600 font-medium' : 'text-green-600'}>
                                                {formatCurrency(inv.outstanding_amount, lang)}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColor(inv.status)}`}>
                                                {statusLabel(inv.status, lang)}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center justify-center gap-1">
                                                {inv.docstatus === 0 && (
                                                    <button onClick={() => handleSubmit(inv.name)} className="p-1.5 hover:bg-emerald-50 rounded-lg text-emerald-600" title={t.submit}><Send className="w-4 h-4" /></button>
                                                )}
                                                {inv.docstatus === 1 && (inv.outstanding_amount ?? 0) > 0 && (
                                                    <button onClick={() => setPayingInvoice(inv)} className="p-1.5 hover:bg-blue-50 rounded-lg text-blue-600" title={t.payInvoice}><Wallet className="w-4 h-4" /></button>
                                                )}
                                                <button onClick={() => printDoc('Purchase Invoice', inv.name)} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500" title={t.printDocument}><Printer className="w-4 h-4" /></button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* PO selection dialog for creating invoice */}
            {showCreate && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40" onClick={() => setShowCreate(false)}>
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between p-5 border-b">
                            <h2 className="text-lg font-bold text-gray-800">{t.newInvoice}</h2>
                            <button onClick={() => setShowCreate(false)} className="p-1 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
                        </div>
                        <div className="p-5 space-y-3">
                            <label className="block text-sm font-medium text-gray-700 mb-1">{t.selectPO}</label>
                            {billablePOs.length > 0 ? (
                                <div className="space-y-2 max-h-60 overflow-y-auto">
                                    {billablePOs.map(po => (
                                        <button key={po.name}
                                            onClick={() => { setSelectedPOForInvoice(po); setShowCreate(false) }}
                                            className="w-full flex items-center justify-between p-3 bg-gray-50 hover:bg-indigo-50 rounded-lg text-sm transition-colors text-start">
                                            <div>
                                                <p className="font-medium text-gray-800">{po.name}</p>
                                                <p className="text-xs text-gray-500">{po.supplier_name}</p>
                                            </div>
                                            <span className="font-medium text-gray-700">{formatCurrency(po.grand_total, lang)}</span>
                                        </button>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-sm text-gray-400 text-center py-4">{t.noPOs}</p>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Invoice creation from selected PO */}
            {selectedPOForInvoice && company && (
                <InvoiceFromPODialog
                    lang={lang} company={company}
                    po={selectedPOForInvoice}
                    onCreated={() => { setSelectedPOForInvoice(null); showToast(t.autoSubmitted, 'success'); load() }}
                    onClose={() => setSelectedPOForInvoice(null)}
                />
            )}

            {/* Payment dialog */}
            {payingInvoice && (
                <PayInvoiceDialog
                    lang={lang}
                    invoice={payingInvoice}
                    onPaid={() => { setPayingInvoice(null); showToast(t.paymentCreated, 'success'); load() }}
                    onClose={() => setPayingInvoice(null)}
                    showToast={showToast}
                />
            )}
        </div>
    )
}

// ==================== PAY INVOICE DIALOG ====================

function PayInvoiceDialog({ lang, invoice, onPaid, onClose, showToast }: {
    lang: 'en' | 'ar'; invoice: PurchaseInvoice; onPaid: () => void; onClose: () => void
    showToast: (m: string, t: 'success' | 'error') => void
}) {
    const t = L[lang]
    const [amount, setAmount] = useState(invoice.outstanding_amount || 0)
    const [mode, setMode] = useState('Cash')
    const [modes, setModes] = useState<Array<{ name: string }>>([])
    const [refNo, setRefNo] = useState('')
    const [refDate, setRefDate] = useState('')
    const [saving, setSaving] = useState(false)
    const [payMethod, setPayMethod] = useState<'wallet' | 'accounting'>('wallet')
    const [wallet, setWallet] = useState<WalletType | null>(null)
    const [walletLoading, setWalletLoading] = useState(true)

    useEffect(() => {
        purchaseApi.getModesOfPayment().then(setModes).catch(() => setModes([{ name: 'Cash' }]))
        walletApi.getCompanyWallet().then(w => { setWallet(w); setWalletLoading(false) }).catch(() => setWalletLoading(false))
    }, [])

    const handlePay = async () => {
        if (!amount || amount <= 0) return
        setSaving(true)
        try {
            if (payMethod === 'wallet' && wallet) {
                await walletApi.payFromWallet({
                    wallet: wallet.name,
                    amount,
                    invoice_name: invoice.name,
                    supplier: invoice.supplier,
                    supplier_name: invoice.supplier_name || invoice.supplier,
                    remarks: `${t.payInvoice}: ${invoice.name}`,
                })
                // Also make the accounting payment entry so ERPNext marks it paid
                try {
                    await purchaseApi.makePaymentEntry({
                        invoice_name: invoice.name,
                        amount,
                        mode_of_payment: 'Cash',
                    })
                } catch { /* wallet deducted, accounting entry failed - still proceed */ }
            } else {
                await purchaseApi.makePaymentEntry({
                    invoice_name: invoice.name,
                    amount,
                    mode_of_payment: mode,
                    reference_no: refNo || undefined,
                    reference_date: refDate || undefined,
                })
            }
            onPaid()
        } catch (e: any) { showToast(e?.message || t.paymentError, 'error'); setSaving(false) }
    }

    const showRef = mode !== 'Cash' && mode !== 'نقد'
    const insufficientWallet = payMethod === 'wallet' && wallet && amount > (wallet.balance || 0)

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40" onClick={onClose}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between p-5 border-b">
                    <div>
                        <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2"><Wallet className="w-5 h-5 text-blue-600" /> {t.payInvoice}</h2>
                        <p className="text-xs text-gray-400 mt-0.5">{invoice.name} — {invoice.supplier_name || invoice.supplier}</p>
                    </div>
                    <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
                </div>
                <div className="p-5 space-y-4">
                    {/* Summary */}
                    <div className="bg-gray-50 rounded-lg p-3 grid grid-cols-2 gap-2 text-sm">
                        <div>
                            <span className="text-gray-500">{t.grandTotal}:</span>
                            <span className="font-medium ms-1" dir="ltr">{formatCurrency(invoice.grand_total, lang)}</span>
                        </div>
                        <div>
                            <span className="text-gray-500">{t.outstanding}:</span>
                            <span className="font-medium ms-1 text-red-600" dir="ltr">{formatCurrency(invoice.outstanding_amount, lang)}</span>
                        </div>
                    </div>

                    {/* Payment method toggle */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">{lang === 'ar' ? 'طريقة الدفع' : 'Payment Method'}</label>
                        <div className="grid grid-cols-2 gap-2">
                            <button
                                onClick={() => setPayMethod('wallet')}
                                className={`flex items-center justify-center gap-2 px-3 py-3 rounded-xl border-2 text-sm font-medium transition-all ${payMethod === 'wallet'
                                    ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                                    : 'border-gray-200 text-gray-500 hover:border-gray-300'
                                    }`}
                            >
                                <Wallet className="w-4 h-4" />
                                {t.walletPayment}
                            </button>
                            <button
                                onClick={() => setPayMethod('accounting')}
                                className={`flex items-center justify-center gap-2 px-3 py-3 rounded-xl border-2 text-sm font-medium transition-all ${payMethod === 'accounting'
                                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                                    : 'border-gray-200 text-gray-500 hover:border-gray-300'
                                    }`}
                            >
                                <CreditCard className="w-4 h-4" />
                                {t.accountingPayment}
                            </button>
                        </div>
                    </div>

                    {/* Wallet info */}
                    {payMethod === 'wallet' && (
                        <div className={`rounded-xl p-3 ${insufficientWallet ? 'bg-red-50 border border-red-200' : 'bg-emerald-50 border border-emerald-200'}`}>
                            {walletLoading ? (
                                <div className="flex items-center gap-2 text-gray-500 text-sm"><Loader2 className="w-4 h-4 animate-spin" /> Loading...</div>
                            ) : wallet ? (
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <Wallet className={`w-5 h-5 ${insufficientWallet ? 'text-red-500' : 'text-emerald-600'}`} />
                                        <div>
                                            <p className="text-xs text-gray-500">{t.walletBalance}</p>
                                            <p className={`font-bold ${insufficientWallet ? 'text-red-600' : 'text-emerald-700'}`} dir="ltr">
                                                {formatCurrency(wallet.balance || 0, lang)}
                                            </p>
                                        </div>
                                    </div>
                                    {insufficientWallet && (
                                        <span className="text-xs text-red-500 font-medium flex items-center gap-1">
                                            <AlertCircle className="w-3.5 h-3.5" />
                                            {t.insufficientBalance}
                                        </span>
                                    )}
                                </div>
                            ) : (
                                <p className="text-sm text-gray-500">{lang === 'ar' ? 'لا توجد محفظة' : 'No wallet found'}</p>
                            )}
                        </div>
                    )}

                    {/* Amount */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">{t.paymentAmount} *</label>
                        <input type="number" min={0.01} max={invoice.outstanding_amount || 0} step={0.01}
                            className="w-full border rounded-lg px-3 py-2 text-sm" dir="ltr"
                            value={amount} onChange={e => setAmount(Number(e.target.value))} />
                    </div>

                    {/* Mode of Payment (only for accounting method) */}
                    {payMethod === 'accounting' && (
                        <>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">{t.modeOfPayment} *</label>
                                <select className="w-full border rounded-lg px-3 py-2 text-sm" value={mode} onChange={e => setMode(e.target.value)}>
                                    {modes.map(m => <option key={m.name} value={m.name}>{m.name}</option>)}
                                </select>
                            </div>

                            {/* Reference No & Date (for non-cash) */}
                            {showRef && (
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">{t.referenceNo}</label>
                                        <input className="w-full border rounded-lg px-3 py-2 text-sm" value={refNo} onChange={e => setRefNo(e.target.value)} />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">{t.postingDate}</label>
                                        <input type="date" className="w-full border rounded-lg px-3 py-2 text-sm" value={refDate} onChange={e => setRefDate(e.target.value)} />
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>
                <div className="flex justify-end gap-2 p-5 border-t">
                    <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">{t.cancel}</button>
                    <button onClick={handlePay} disabled={saving || !amount || amount <= 0 || (payMethod === 'wallet' && (insufficientWallet || !wallet))}
                        className={`px-5 py-2 text-sm text-white rounded-lg disabled:opacity-50 flex items-center gap-2 ${payMethod === 'wallet' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-blue-600 hover:bg-blue-700'
                            }`}>
                        {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                        {payMethod === 'wallet' ? <Wallet className="w-4 h-4" /> : <CreditCard className="w-4 h-4" />}
                        {saving ? t.paying : payMethod === 'wallet' ? t.payFromWallet : t.payInvoice}
                    </button>
                </div>
            </div>
        </div>
    )
}

// ==================== MATERIAL REQUESTS ====================

function MaterialRequestForm({ lang, company, onSaved, onClose }: {
    lang: 'en' | 'ar'; company: string; onSaved: () => void; onClose: () => void
}) {
    const t = L[lang]
    const [txnDate, setTxnDate] = useState(today())
    const [schedDate, setSchedDate] = useState(today())
    const [mrItems, setMRItems] = useState<Array<{ item_code: string; item_name: string; qty: number; uom: string }>>([
        { item_code: '', item_name: '', qty: 1, uom: 'Nos' },
    ])
    const [purchaseItems, setPurchaseItems] = useState<PurchaseItem[]>([])
    const [warehouses, setWarehouses] = useState<Array<{ name: string; warehouse_name: string }>>([])
    const [warehouse, setWarehouse] = useState('')
    const [uoms, setUoms] = useState<Array<{ name: string }>>([{ name: 'Nos' }, { name: 'Unit' }, { name: 'Box' }, { name: 'Kg' }])
    const [saving, setSaving] = useState(false)

    useEffect(() => {
        purchaseApi.getWarehouses(company).then(whs => {
            setWarehouses(whs)
            const stores = whs.find(w => w.warehouse_name === 'Stores')
            if (stores && !warehouse) setWarehouse(stores.name)
        }).catch(() => { })
        purchaseApi.getUOMs().then(setUoms).catch(() => { })
    }, [company])

    useEffect(() => {
        purchaseApi.getPurchaseItems(undefined, undefined, company).then(setPurchaseItems).catch(() => { })
    }, [company])

    const updateItem = (i: number, data: Partial<typeof mrItems[0]>) => {
        setMRItems(prev => prev.map((item, idx) => idx === i ? { ...item, ...data } : item))
    }
    const addItem = () => setMRItems(prev => [...prev, { item_code: '', item_name: '', qty: 1, uom: 'Nos' }])
    const removeItem = (i: number) => setMRItems(prev => prev.filter((_, idx) => idx !== i))

    const handleSave = async () => {
        if (mrItems.every(it => !it.item_code)) return
        setSaving(true)
        try {
            const created = await purchaseApi.createMaterialRequest({
                company,
                transaction_date: txnDate,
                schedule_date: schedDate,
                items: mrItems.filter(it => it.item_code).map(it => ({
                    item_code: it.item_code, qty: it.qty, uom: it.uom, warehouse: warehouse, schedule_date: schedDate,
                })),
            })
            // Auto-submit immediately
            if (created?.name) {
                try { await purchaseApi.submitMaterialRequest(created.name) } catch { /* submit failed */ }
            }
            onSaved()
        } catch { /* */ }
        setSaving(false)
    }

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40" onClick={onClose}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between p-5 border-b">
                    <h2 className="text-lg font-bold text-gray-800">{t.newMR}</h2>
                    <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
                </div>
                <div className="p-5 space-y-4">
                    <div className="grid grid-cols-3 gap-3">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">{t.warehouse} *</label>
                            <select className="w-full border rounded-lg px-3 py-2 text-sm" value={warehouse} onChange={e => setWarehouse(e.target.value)}>
                                <option value="">--</option>
                                {warehouses.map(w => <option key={w.name} value={w.name}>{w.warehouse_name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">{t.requestDate}</label>
                            <input type="date" className="w-full border rounded-lg px-3 py-2 text-sm" value={txnDate} onChange={e => setTxnDate(e.target.value)} />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">{t.scheduledDate}</label>
                            <input type="date" className="w-full border rounded-lg px-3 py-2 text-sm" value={schedDate} onChange={e => setSchedDate(e.target.value)} />
                        </div>
                    </div>

                    <div className="border rounded-lg overflow-hidden">
                        <table className="w-full text-sm">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="text-start px-3 py-2 font-medium">{t.itemName}</th>
                                    <th className="text-center px-3 py-2 font-medium w-20">{t.quantity}</th>
                                    <th className="text-center px-3 py-2 font-medium w-16">{t.uom}</th>
                                    <th className="w-10"></th>
                                </tr>
                            </thead>
                            <tbody>
                                {mrItems.map((item, i) => (
                                    <tr key={i} className="border-b">
                                        <td className="px-3 py-2">
                                            <select className="w-full border rounded px-2 py-1.5 text-sm" value={item.item_code}
                                                onChange={e => {
                                                    const picked = purchaseItems.find(p => p.name === e.target.value)
                                                    updateItem(i, { item_code: e.target.value, item_name: picked?.item_name || '', uom: picked?.stock_uom || 'Nos' })
                                                }}>
                                                <option value="">--</option>
                                                {purchaseItems.map(p => <option key={p.name} value={p.name}>{p.item_name} ({p.name})</option>)}
                                            </select>
                                        </td>
                                        <td className="px-3 py-2">
                                            <input type="number" min={1} className="w-full border rounded px-2 py-1.5 text-sm text-center"
                                                value={item.qty} onChange={e => updateItem(i, { qty: Number(e.target.value) })} />
                                        </td>
                                        <td className="px-3 py-2">
                                            <UOMCombobox value={item.uom || 'Nos'} uoms={uoms} lang={lang}
                                                onChange={v => updateItem(i, { uom: v })}
                                                onAddNew={async (name) => { try { await purchaseApi.createUOM(name); const fresh = await purchaseApi.getUOMs(); setUoms(fresh); updateItem(i, { uom: name }) } catch { } }} />
                                        </td>
                                        <td className="px-3 py-2 text-center">
                                            <button onClick={() => removeItem(i)} className="p-1 hover:bg-red-50 rounded text-red-400"><X className="w-4 h-4" /></button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <button onClick={addItem} className="flex items-center gap-1 text-sm text-emerald-600 hover:text-emerald-700">
                        <Plus className="w-4 h-4" /> {t.addItem}
                    </button>
                </div>
                <div className="flex justify-end gap-2 p-5 border-t">
                    <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">{t.cancel}</button>
                    <button onClick={handleSave} disabled={saving}
                        className="px-5 py-2 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-2">
                        {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                        {saving ? t.creating : t.createAndSubmit}
                    </button>
                </div>
            </div>
        </div>
    )
}

function MaterialRequestsView({ lang, company, showToast }: { lang: 'en' | 'ar'; company?: string | null; showToast: (m: string, t: 'success' | 'error') => void }) {
    const t = L[lang]
    const [requests, setRequests] = useState<MaterialRequest[]>([])
    const [suppliers, setSuppliers] = useState<Supplier[]>([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [showForm, setShowForm] = useState(false)
    const [convertingMR, setConvertingMR] = useState<string | null>(null)
    const [convertSupplier, setConvertSupplier] = useState('')

    const load = useCallback(async () => {
        setLoading(true)
        try {
            const [r, s] = await Promise.all([
                purchaseApi.getMaterialRequests({ company: company || undefined }),
                purchaseApi.getSuppliers({ company: company || undefined }),
            ])
            setRequests(r)
            setSuppliers(s)
        } catch { /* */ }
        setLoading(false)
    }, [company])

    useEffect(() => { load() }, [load])

    const filtered = useMemo(() => {
        if (!search) return requests
        const q = search.toLowerCase()
        return requests.filter(r => r.name?.toLowerCase().includes(q) || r.title?.toLowerCase().includes(q))
    }, [requests, search])

    const handleSubmit = async (name: string) => {
        if (!confirm(t.confirmSubmit)) return
        try { await purchaseApi.submitMaterialRequest(name); showToast(t.mrSubmitted, 'success'); load() }
        catch (e: any) { showToast(e?.message || t.error, 'error') }
    }

    const handleConvert = async () => {
        if (!convertingMR) return
        try {
            await purchaseApi.convertMRtoPO(convertingMR, convertSupplier || undefined)
            showToast(t.mrConverted, 'success')
            setConvertingMR(null)
            setConvertSupplier('')
            load()
        } catch (e: any) { showToast(e?.message || t.error, 'error') }
    }

    if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-emerald-500" /></div>

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
                <div className="relative flex-1 min-w-[200px]">
                    <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input className="w-full ps-10 pe-3 py-2 border rounded-lg text-sm" placeholder={t.searchPlaceholder} value={search} onChange={e => setSearch(e.target.value)} />
                </div>
                <button onClick={() => setShowForm(true)} className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm hover:bg-emerald-700">
                    <Plus className="w-4 h-4" /> {t.newMR}
                </button>
                <button onClick={load} className="p-2 border rounded-lg hover:bg-gray-50"><RefreshCw className="w-4 h-4" /></button>
            </div>

            {filtered.length === 0 ? (
                <div className="text-center py-16 bg-white rounded-xl border">
                    <ClipboardList className="w-14 h-14 mx-auto text-emerald-200 mb-3" />
                    <h3 className="font-semibold text-gray-600 mb-1">{t.noMRs}</h3>
                    <p className="text-sm text-gray-400">{t.noMRsDesc}</p>
                </div>
            ) : (
                <div className="bg-white rounded-xl border overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-gray-50 text-gray-600">
                                <tr>
                                    <th className="text-start px-4 py-3 font-medium">#</th>
                                    <th className="text-start px-4 py-3 font-medium">{t.requestDate}</th>
                                    <th className="text-start px-4 py-3 font-medium">{t.scheduledDate}</th>
                                    <th className="text-center px-4 py-3 font-medium">{t.ordered}</th>
                                    <th className="text-center px-4 py-3 font-medium">{t.status}</th>
                                    <th className="text-center px-4 py-3 font-medium">{t.actions}</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {filtered.map(mr => (
                                    <tr key={mr.name} className="hover:bg-gray-50">
                                        <td className="px-4 py-3 font-mono text-xs text-emerald-700">{mr.name}</td>
                                        <td className="px-4 py-3 text-gray-600">{formatDate(mr.transaction_date)}</td>
                                        <td className="px-4 py-3 text-gray-600">{formatDate(mr.schedule_date)}</td>
                                        <td className="px-4 py-3 text-center">{mr.per_ordered ?? 0}%</td>
                                        <td className="px-4 py-3 text-center">
                                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColor(mr.status)}`}>
                                                {statusLabel(mr.status, lang)}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center justify-center gap-1">
                                                {mr.docstatus === 0 && (
                                                    <button onClick={() => handleSubmit(mr.name)} className="p-1.5 hover:bg-emerald-50 rounded-lg text-emerald-600" title={t.submit}><Send className="w-4 h-4" /></button>
                                                )}
                                                {mr.docstatus === 1 && mr.status !== 'Ordered' && (
                                                    <button onClick={() => setConvertingMR(mr.name)}
                                                        className="px-2 py-1 text-xs bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 flex items-center gap-1">
                                                        <ArrowRight className="w-3 h-3" /> {t.convertToPO}
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Create form */}
            {showForm && company && (
                <MaterialRequestForm
                    lang={lang} company={company}
                    onSaved={() => { setShowForm(false); showToast(t.mrCreated, 'success'); load() }}
                    onClose={() => setShowForm(false)}
                />
            )}

            {/* Convert to PO dialog */}
            {convertingMR && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40" onClick={() => setConvertingMR(null)}>
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4" onClick={e => e.stopPropagation()}>
                        <div className="p-5 border-b">
                            <h3 className="font-bold text-gray-800">{t.convertToPO}</h3>
                            <p className="text-sm text-gray-500">{convertingMR}</p>
                        </div>
                        <div className="p-5">
                            <label className="block text-sm font-medium text-gray-700 mb-1">{t.selectSupplier}</label>
                            <select className="w-full border rounded-lg px-3 py-2 text-sm" value={convertSupplier} onChange={e => setConvertSupplier(e.target.value)}>
                                <option value="">--</option>
                                {suppliers.map(s => <option key={s.name} value={s.name}>{s.supplier_name}</option>)}
                            </select>
                        </div>
                        <div className="flex justify-end gap-2 p-5 border-t">
                            <button onClick={() => setConvertingMR(null)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">{t.cancel}</button>
                            <button onClick={handleConvert} className="px-5 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">{t.confirm}</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

// ==================== STOCK COUNT (جرد) ====================

function StockCountView({ lang, company, showToast }: { lang: 'en' | 'ar'; company?: string | null; showToast: (m: string, t: 'success' | 'error') => void }) {
    const t = L[lang]
    const [records, setRecords] = useState<Array<{
        name: string; company: string; posting_date: string; purpose: string; docstatus?: number; creation?: string
    }>>([])
    const [loading, setLoading] = useState(true)
    const [showForm, setShowForm] = useState(false)

    // Form state
    const [warehouses, setWarehouses] = useState<Array<{ name: string; warehouse_name: string }>>([])
    const [warehouse, setWarehouse] = useState('')
    const [purchaseItems, setPurchaseItems] = useState<Array<{ name: string; item_name: string; stock_uom?: string }>>([])
    const [countItems, setCountItems] = useState<Array<{ item_code: string; item_name: string; qty: number; valuation_rate: number }>>([
        { item_code: '', item_name: '', qty: 0, valuation_rate: 0 },
    ])
    const [postingDate, setPostingDate] = useState(today())
    const [saving, setSaving] = useState(false)

    const load = useCallback(async () => {
        setLoading(true)
        try {
            const recs = await purchaseApi.getStockReconciliations({ company: company || undefined })
            setRecords(recs)
        } catch { /* */ }
        setLoading(false)
    }, [company])

    useEffect(() => { load() }, [load])

    useEffect(() => {
        if (showForm && company) {
            purchaseApi.getWarehouses(company).then(whs => {
                setWarehouses(whs)
                const stores = whs.find(w => w.warehouse_name === 'Stores')
                if (stores) setWarehouse(stores.name)
            }).catch(() => { })
            purchaseApi.getPurchaseItems(undefined, undefined, company).then(setPurchaseItems).catch(() => { })
        }
    }, [showForm, company])

    const updateCountItem = (i: number, data: Partial<typeof countItems[0]>) => {
        setCountItems(prev => prev.map((item, idx) => idx === i ? { ...item, ...data } : item))
    }
    const addCountItem = () => setCountItems(prev => [...prev, { item_code: '', item_name: '', qty: 0, valuation_rate: 0 }])
    const removeCountItem = (i: number) => setCountItems(prev => prev.filter((_, idx) => idx !== i))

    // Auto-fill valuation rate when item is picked
    const pickItem = async (i: number, itemCode: string) => {
        const picked = purchaseItems.find(p => p.name === itemCode)
        updateCountItem(i, { item_code: itemCode, item_name: picked?.item_name || '' })
        if (itemCode && warehouse) {
            const rate = await purchaseApi.getItemValuation(itemCode, warehouse)
            if (rate > 0) updateCountItem(i, { item_code: itemCode, item_name: picked?.item_name || '', valuation_rate: rate })
        }
    }

    const handleSave = async () => {
        if (!company || !warehouse || countItems.every(it => !it.item_code)) return
        setSaving(true)
        try {
            const created = await purchaseApi.createStockReconciliation({
                company,
                posting_date: postingDate,
                purpose: 'Stock Reconciliation',
                items: countItems.filter(it => it.item_code).map(it => ({
                    item_code: it.item_code,
                    warehouse: warehouse,
                    qty: it.qty,
                    valuation_rate: it.valuation_rate || undefined,
                })),
            })
            // Auto-submit
            if (created?.name) {
                try { await purchaseApi.submitStockReconciliation(created.name) } catch { /* */ }
            }
            showToast(t.stockAdjusted, 'success')
            setShowForm(false)
            setCountItems([{ item_code: '', item_name: '', qty: 0, valuation_rate: 0 }])
            load()
        } catch (e: any) { showToast(e?.message || t.error, 'error') }
        setSaving(false)
    }

    const srStatus = (docstatus?: number) => {
        if (docstatus === 1) return { label: t.submitted, cls: 'bg-green-100 text-green-700' }
        if (docstatus === 2) return { label: t.cancelled, cls: 'bg-red-100 text-red-700' }
        return { label: t.draft, cls: 'bg-gray-100 text-gray-700' }
    }

    if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-emerald-500" /></div>

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
                <div className="flex-1">
                    <h2 className="text-lg font-bold text-gray-800">{t.stockCount}</h2>
                    <p className="text-xs text-gray-400">{t.stockCountDesc}</p>
                </div>
                <button onClick={() => setShowForm(true)} className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm hover:bg-emerald-700">
                    <Plus className="w-4 h-4" /> {t.newStockCount}
                </button>
                <button onClick={load} className="p-2 border rounded-lg hover:bg-gray-50"><RefreshCw className="w-4 h-4" /></button>
            </div>

            {records.length === 0 ? (
                <div className="text-center py-16 bg-white rounded-xl border">
                    <ClipboardCheck className="w-14 h-14 mx-auto text-emerald-200 mb-3" />
                    <h3 className="font-semibold text-gray-600 mb-1">{t.noStockCount}</h3>
                    <p className="text-sm text-gray-400">{t.noStockCountDesc}</p>
                </div>
            ) : (
                <div className="bg-white rounded-xl border overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-gray-50 text-gray-600">
                                <tr>
                                    <th className="text-start px-4 py-3 font-medium">#</th>
                                    <th className="text-start px-4 py-3 font-medium">{t.postingDate}</th>
                                    <th className="text-start px-4 py-3 font-medium">{t.purpose}</th>
                                    <th className="text-center px-4 py-3 font-medium">{t.status}</th>
                                    <th className="text-center px-4 py-3 font-medium">{t.actions}</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {records.map(r => {
                                    const st = srStatus(r.docstatus)
                                    return (
                                        <tr key={r.name} className="hover:bg-gray-50">
                                            <td className="px-4 py-3 font-mono text-xs text-emerald-700">{r.name}</td>
                                            <td className="px-4 py-3 text-gray-600">{formatDate(r.posting_date)}</td>
                                            <td className="px-4 py-3 text-gray-600">{r.purpose}</td>
                                            <td className="px-4 py-3 text-center">
                                                <span className={`px-2 py-1 rounded-full text-xs font-medium ${st.cls}`}>{st.label}</span>
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                <button onClick={() => printDoc('Stock Reconciliation', r.name)} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500" title={t.printDocument}><Printer className="w-4 h-4" /></button>
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Stock Count Form */}
            {showForm && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40" onClick={() => setShowForm(false)}>
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between p-5 border-b">
                            <h2 className="text-lg font-bold text-gray-800">{t.newStockCount}</h2>
                            <button onClick={() => setShowForm(false)} className="p-1 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
                        </div>
                        <div className="p-5 space-y-4">
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">{t.warehouse} *</label>
                                    <select className="w-full border rounded-lg px-3 py-2 text-sm" value={warehouse} onChange={e => setWarehouse(e.target.value)}>
                                        <option value="">--</option>
                                        {warehouses.map(w => <option key={w.name} value={w.name}>{w.warehouse_name}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">{t.postingDate}</label>
                                    <input type="date" className="w-full border rounded-lg px-3 py-2 text-sm" value={postingDate} onChange={e => setPostingDate(e.target.value)} />
                                </div>
                            </div>

                            <div className="border rounded-lg overflow-hidden">
                                <table className="w-full text-sm">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            <th className="text-start px-3 py-2 font-medium">{t.itemName}</th>
                                            <th className="text-center px-3 py-2 font-medium w-28">{t.physicalQty}</th>
                                            <th className="w-10"></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {countItems.map((item, i) => (
                                            <tr key={i} className="border-b">
                                                <td className="px-3 py-2">
                                                    <select className="w-full border rounded px-2 py-1.5 text-sm" value={item.item_code}
                                                        onChange={e => pickItem(i, e.target.value)}>
                                                        <option value="">--</option>
                                                        {purchaseItems.map(p => <option key={p.name} value={p.name}>{p.item_name} ({p.name})</option>)}
                                                    </select>
                                                </td>
                                                <td className="px-3 py-2">
                                                    <input type="number" min={0} className="w-full border rounded px-2 py-1.5 text-sm text-center"
                                                        value={item.qty} onChange={e => updateCountItem(i, { qty: Number(e.target.value) })}
                                                        placeholder="0" />
                                                </td>
                                                <td className="px-3 py-2 text-center">
                                                    <button onClick={() => removeCountItem(i)} className="p-1 hover:bg-red-50 rounded text-red-400"><X className="w-4 h-4" /></button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            <div className="flex items-center justify-between">
                                <button onClick={addCountItem} className="flex items-center gap-1 text-sm text-emerald-600 hover:text-emerald-700">
                                    <Plus className="w-4 h-4" /> {t.addItem}
                                </button>
                                <p className="text-xs text-gray-400 flex items-center gap-1"><Info className="w-3 h-3" /> {t.autoFilledPrice}</p>
                            </div>
                        </div>
                        <div className="flex justify-end gap-2 p-5 border-t">
                            <button onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">{t.cancel}</button>
                            <button onClick={handleSave} disabled={saving || !warehouse}
                                className="px-5 py-2 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-2">
                                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                                {saving ? t.creating : t.createAndSubmit}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

// ==================== SCHEDULED ORDERS ====================

function ScheduledOrdersView({ lang, showToast }: { lang: 'en' | 'ar'; showToast: (m: string, t: 'success' | 'error') => void }) {
    const t = L[lang]
    const [schedules, setSchedules] = useState<Array<{
        name: string; reference_doctype: string; reference_document: string
        frequency: string; start_date: string; end_date?: string; status: string; next_schedule_date?: string; disabled?: number
    }>>([])
    const [loading, setLoading] = useState(true)

    const load = useCallback(async () => {
        setLoading(true)
        try {
            const data = await purchaseApi.getAutoRepeats('Purchase Order')
            setSchedules(data)
        } catch { /* */ }
        setLoading(false)
    }, [])

    useEffect(() => { load() }, [load])

    const handleDisable = async (name: string) => {
        if (!confirm(t.confirmDisableSchedule)) return
        try {
            await purchaseApi.disableAutoRepeat(name)
            showToast(t.scheduleDisabled, 'success')
            load()
        } catch (e: any) { showToast(e?.message || t.error, 'error') }
    }

    const freqLabel = (f: string) => {
        const map: Record<string, string> = lang === 'ar'
            ? { Weekly: 'أسبوعي', Monthly: 'شهري', Quarterly: 'ربع سنوي', 'Half-yearly': 'نصف سنوي', Yearly: 'سنوي', Daily: 'يومي' }
            : { Weekly: 'Weekly', Monthly: 'Monthly', Quarterly: 'Quarterly', 'Half-yearly': 'Half-yearly', Yearly: 'Yearly', Daily: 'Daily' }
        return map[f] || f
    }

    if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-emerald-500" /></div>

    return (
        <div className="space-y-4">
            <div className="flex items-center gap-3">
                <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                    <CalendarClock className="w-5 h-5 text-violet-600" /> {t.scheduledOrders}
                </h2>
                <button onClick={load} className="p-2 border rounded-lg hover:bg-gray-50 ms-auto"><RefreshCw className="w-4 h-4" /></button>
            </div>

            {schedules.length === 0 ? (
                <div className="text-center py-16 bg-white rounded-xl border">
                    <CalendarClock className="w-14 h-14 mx-auto text-violet-200 mb-3" />
                    <h3 className="font-semibold text-gray-600 mb-1">{t.noScheduledOrders}</h3>
                    <p className="text-sm text-gray-400">{t.noScheduledOrdersDesc}</p>
                </div>
            ) : (
                <div className="grid gap-3">
                    {schedules.map(s => {
                        const isActive = s.status === 'Active' && !s.disabled
                        return (
                            <div key={s.name} className={`bg-white rounded-xl border p-4 flex items-start gap-4 ${!isActive ? 'opacity-60' : ''}`}>
                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${isActive ? 'bg-violet-100' : 'bg-gray-100'}`}>
                                    <Repeat className={`w-5 h-5 ${isActive ? 'text-violet-600' : 'text-gray-400'}`} />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <span className="font-mono text-sm text-emerald-700">{s.reference_document}</span>
                                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${isActive ? 'bg-violet-100 text-violet-700' : 'bg-gray-100 text-gray-600'}`}>
                                            {isActive ? t.recurringActive : (s.status === 'Disabled' || s.disabled ? t.disableSchedule : s.status)}
                                        </span>
                                        <span className="px-2 py-0.5 rounded-full text-xs bg-blue-50 text-blue-700">
                                            {freqLabel(s.frequency)}
                                        </span>
                                    </div>
                                    <div className="flex flex-wrap gap-4 mt-1.5 text-xs text-gray-500">
                                        <span>{t.startDate}: {formatDate(s.start_date)}</span>
                                        {s.end_date && <span>{t.endDate}: {formatDate(s.end_date)}</span>}
                                        {s.next_schedule_date && isActive && (
                                            <span className="text-violet-600 font-medium">{t.nextOrder}: {formatDate(s.next_schedule_date)}</span>
                                        )}
                                    </div>
                                </div>
                                {isActive && (
                                    <button onClick={() => handleDisable(s.name)}
                                        className="px-3 py-1.5 text-xs border border-red-200 text-red-600 rounded-lg hover:bg-red-50 flex items-center gap-1">
                                        <Ban className="w-3.5 h-3.5" /> {t.disableSchedule}
                                    </button>
                                )}
                            </div>
                        )
                    })}
                </div>
            )}
        </div>
    )
}

// ==================== REPORTS ====================

function ReportsView({ lang, company }: { lang: 'en' | 'ar'; company?: string | null }) {
    const t = L[lang]
    const [data, setData] = useState<PurchaseDashboard | null>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        setLoading(true)
        purchaseApi.getDashboard(company || undefined).then(setData).catch(() => { }).finally(() => setLoading(false))
    }, [company])

    if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-emerald-500" /></div>
    if (!data) return <div className="text-center py-20 text-gray-400">{t.error}</div>

    const maxTrend = Math.max(...(data.monthly_trend?.map(m => m.total) || [1]), 1)
    const maxSupplier = Math.max(...(data.top_suppliers?.map(s => s.total_amount) || [1]), 1)

    return (
        <div className="space-y-6 print:space-y-4">
            {/* Print button */}
            <div className="flex justify-end print:hidden">
                <button onClick={printPage} className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm hover:bg-gray-200">
                    <Printer className="w-4 h-4" /> {t.printReport}
                </button>
            </div>
            {/* Monthly */}
            <div className="bg-white rounded-xl border p-5">
                <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
                    <BarChart3 className="w-5 h-5 text-emerald-500" /> {t.purchasesByMonth}
                </h3>
                {data.monthly_trend && data.monthly_trend.length > 0 ? (
                    <div className="space-y-2.5">
                        {data.monthly_trend.map(m => (
                            <div key={m.month} className="flex items-center gap-3">
                                <span className="text-sm text-gray-500 w-20 flex-shrink-0 font-mono">{m.month}</span>
                                <div className="flex-1 h-7 bg-gray-100 rounded-lg overflow-hidden">
                                    <div className="h-full bg-gradient-to-r from-emerald-400 to-emerald-600 rounded-lg flex items-center ps-2"
                                        style={{ width: `${Math.max((m.total / maxTrend) * 100, 2)}%` }}>
                                        {(m.total / maxTrend) > 0.25 && <span className="text-[10px] text-white font-medium">{m.count}</span>}
                                    </div>
                                </div>
                                <span className="text-sm font-medium text-gray-700 w-28 text-end">{formatCurrency(m.total, lang)}</span>
                            </div>
                        ))}
                    </div>
                ) : <p className="text-gray-400 text-sm text-center py-8">{t.noDataYet}</p>}
            </div>

            {/* By Supplier */}
            <div className="bg-white rounded-xl border p-5">
                <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
                    <Users className="w-5 h-5 text-emerald-500" /> {t.purchasesBySupplier}
                </h3>
                {data.top_suppliers && data.top_suppliers.length > 0 ? (
                    <div className="space-y-3">
                        {data.top_suppliers.map((s, i) => (
                            <div key={s.supplier} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                                <span className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-700 text-sm flex items-center justify-center font-bold flex-shrink-0">{i + 1}</span>
                                <div className="flex-1 min-w-0">
                                    <p className="font-medium text-gray-800 truncate">{s.supplier_name || s.supplier}</p>
                                    <div className="h-2 bg-gray-200 rounded-full mt-1.5 overflow-hidden">
                                        <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${(s.total_amount / maxSupplier) * 100}%` }} />
                                    </div>
                                </div>
                                <div className="text-end flex-shrink-0">
                                    <p className="text-sm font-bold text-gray-800">{formatCurrency(s.total_amount, lang)}</p>
                                    <p className="text-xs text-gray-400">{s.order_count} {lang === 'ar' ? 'طلب' : 'orders'}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : <p className="text-gray-400 text-sm text-center py-8">{t.noDataYet}</p>}
            </div>
        </div>
    )
}

// ==================== MAIN PAGE ====================

export default function PurchasesPage() {
    const { isAuthenticated, isLoading: authLoading, user, moduleAccess, activeCompany, logout } = useAuth()
    const { lang } = useI18n()
    const router = useRouter()
    const isRTL = lang === 'ar'
    const t = L[lang]

    const [activeSection, setActiveSection] = useState<Section>('dashboard')
    const [sidebarOpen, setSidebarOpen] = useState(true)
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

    // Track which tabs have been loaded
    const [loadedTabs, setLoadedTabs] = useState<Set<Section>>(new Set(['dashboard']))

    const showToast = useCallback((message: string, type: 'success' | 'error') => {
        setToast({ message, type })
    }, [])

    // Lazy load tab data
    const switchSection = useCallback((s: Section) => {
        setActiveSection(s)
        setLoadedTabs(prev => new Set([...prev, s]))
    }, [])

    // Permission check
    const hasPurchaseAccess = useMemo(() => {
        if (!user?.roles) return false
        if (moduleAccess.admin) return true
        return user.roles.some(r => [
            'Purchase Manager', 'Purchase User', 'Purchase Master Manager',
            'Stock Manager', 'Stock User', 'Accounts Manager', 'Accounts User',
        ].includes(r))
    }, [user, moduleAccess])

    // Loading state
    if (authLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="text-center space-y-4">
                    <Loader2 className="w-10 h-10 animate-spin text-emerald-500 mx-auto" />
                    <p className="text-gray-500">{t.loading}</p>
                </div>
            </div>
        )
    }

    // Not logged in
    if (!isAuthenticated) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50" dir={isRTL ? 'rtl' : 'ltr'}>
                <div className="text-center space-y-4">
                    <LogIn className="w-16 h-16 mx-auto text-emerald-300" />
                    <h2 className="text-xl font-bold text-gray-700">{t.unauthorized}</h2>
                    <a href="/" className="inline-block px-6 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700">{t.goHome}</a>
                </div>
            </div>
        )
    }

    // No purchase access
    if (!hasPurchaseAccess) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50" dir={isRTL ? 'rtl' : 'ltr'}>
                <div className="text-center space-y-4 max-w-md mx-auto px-4">
                    <Shield className="w-16 h-16 mx-auto text-emerald-300" />
                    <h2 className="text-xl font-bold text-gray-700">{t.unauthorized}</h2>
                    <p className="text-gray-500 text-sm">{t.unauthorizedDesc}</p>
                    <a href="/" className="inline-block px-6 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700">{t.goHome}</a>
                </div>
            </div>
        )
    }

    return (
        <div className="flex flex-col h-screen bg-[#f8f9fb]" dir={isRTL ? 'rtl' : 'ltr'}>
            {/* Toast */}
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

            {/* Shared Header */}
            <Header showHomeButton onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} sidebarExpanded={sidebarOpen} />

            <div className="flex flex-1 overflow-hidden">
                {/* Sidebar — matches inventory / HR style */}
                <aside className={`h-full bg-white flex flex-col flex-shrink-0 transition-all duration-300 ease-in-out relative group/sidebar ${isRTL ? 'border-l' : 'border-r'} border-gray-200/80 ${sidebarOpen ? 'w-[240px]' : 'w-[68px]'}`}>
                    {/* Collapse toggle circle */}
                    <button
                        onClick={() => setSidebarOpen(!sidebarOpen)}
                        className={`absolute top-6 z-10 w-6 h-6 bg-white border border-gray-200 rounded-full flex items-center justify-center shadow-sm hover:shadow-md hover:bg-gray-50 transition-all opacity-0 group-hover/sidebar:opacity-100 ${isRTL ? '-left-3' : '-right-3'}`}
                    >
                        {sidebarOpen
                            ? (isRTL ? <ChevronRight className="h-3 w-3 text-gray-500" /> : <ChevronLeft className="h-3 w-3 text-gray-500" />)
                            : (isRTL ? <ChevronLeft className="h-3 w-3 text-gray-500" /> : <ChevronRight className="h-3 w-3 text-gray-500" />)
                        }
                    </button>

                    <nav className="flex-1 overflow-y-auto overflow-x-hidden p-2 pt-3 space-y-0.5">
                        {sidebarOpen && (
                            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider px-3 mb-2">
                                {isRTL ? 'الأقسام' : 'Sections'}
                            </p>
                        )}
                        {SECTIONS.map(sec => {
                            const Icon = sec.icon
                            const isActive = activeSection === sec.id
                            return (
                                <button
                                    key={sec.id}
                                    onClick={() => switchSection(sec.id)}
                                    title={!sidebarOpen ? t[sec.labelKey] : undefined}
                                    className={`w-full flex items-center gap-2.5 rounded-lg transition-all duration-150 relative group/item ${sidebarOpen ? 'px-3 py-2' : 'px-0 py-2 justify-center'} ${isActive ? 'bg-emerald-50 text-emerald-700' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'}`}
                                >
                                    {isActive && (
                                        <div className={`absolute top-1/2 -translate-y-1/2 w-[3px] h-4 bg-emerald-600 rounded-full ${isRTL ? 'right-0' : 'left-0'}`} />
                                    )}
                                    <Icon className={`h-[16px] w-[16px] flex-shrink-0 ${isActive ? 'text-emerald-600' : 'text-gray-400'}`} />
                                    {sidebarOpen && (
                                        <span className={`text-[13px] ${isActive ? 'font-semibold' : 'font-medium'}`}>{t[sec.labelKey]}</span>
                                    )}
                                    {!sidebarOpen && (
                                        <div className={`absolute px-2.5 py-1.5 bg-gray-900 text-white text-xs rounded-lg whitespace-nowrap opacity-0 pointer-events-none group-hover/item:opacity-100 transition-opacity shadow-lg z-50 ${isRTL ? 'right-full mr-2' : 'left-full ml-2'}`}>
                                            {t[sec.labelKey]}
                                        </div>
                                    )}
                                </button>
                            )
                        })}
                    </nav>

                    {/* Bottom: Home + Logout */}
                    <div className="border-t border-gray-100 p-2 space-y-0.5">
                        <button
                            onClick={() => router.push('/')}
                            title={!sidebarOpen ? (isRTL ? 'الرئيسية' : 'Home') : undefined}
                            className={`w-full flex items-center gap-2.5 rounded-lg text-gray-500 hover:bg-emerald-50 hover:text-emerald-600 transition-colors group/item relative ${sidebarOpen ? 'px-3 py-2' : 'px-0 py-2 justify-center'}`}
                        >
                            <Home className="h-4 w-4 flex-shrink-0" />
                            {sidebarOpen && <span className="text-[13px] font-medium">{isRTL ? 'الرئيسية' : 'Home'}</span>}
                            {!sidebarOpen && (
                                <div className={`absolute px-2.5 py-1.5 bg-gray-900 text-white text-xs rounded-lg whitespace-nowrap opacity-0 pointer-events-none group-hover/item:opacity-100 transition-opacity shadow-lg z-50 ${isRTL ? 'right-full mr-2' : 'left-full ml-2'}`}>
                                    {isRTL ? 'الرئيسية' : 'Home'}
                                </div>
                            )}
                        </button>
                        <button
                            onClick={logout}
                            title={!sidebarOpen ? (isRTL ? 'تسجيل الخروج' : 'Logout') : undefined}
                            className={`w-full flex items-center gap-2.5 rounded-lg text-gray-500 hover:bg-red-50 hover:text-red-600 transition-colors group/item relative ${sidebarOpen ? 'px-3 py-2' : 'px-0 py-2 justify-center'}`}
                        >
                            <LogOut className="h-4 w-4 flex-shrink-0" />
                            {sidebarOpen && <span className="text-[13px] font-medium">{isRTL ? 'تسجيل الخروج' : 'Logout'}</span>}
                            {!sidebarOpen && (
                                <div className={`absolute px-2.5 py-1.5 bg-gray-900 text-white text-xs rounded-lg whitespace-nowrap opacity-0 pointer-events-none group-hover/item:opacity-100 transition-opacity shadow-lg z-50 ${isRTL ? 'right-full mr-2' : 'left-full ml-2'}`}>
                                    {isRTL ? 'تسجيل الخروج' : 'Logout'}
                                </div>
                            )}
                        </button>
                    </div>
                </aside>

                {/* Main content */}
                <main className="flex-1 overflow-auto p-4 sm:p-6 min-w-0">
                    {activeSection === 'dashboard' && <DashboardView lang={lang} company={activeCompany} showToast={showToast} />}
                    {activeSection === 'suppliers' && loadedTabs.has('suppliers') && <SuppliersView lang={lang} company={activeCompany} showToast={showToast} />}
                    {activeSection === 'purchase-orders' && loadedTabs.has('purchase-orders') && <PurchaseOrdersView lang={lang} company={activeCompany} showToast={showToast} />}
                    {activeSection === 'receipts' && loadedTabs.has('receipts') && <ReceiptsView lang={lang} company={activeCompany} showToast={showToast} />}
                    {activeSection === 'invoices' && loadedTabs.has('invoices') && <InvoicesView lang={lang} company={activeCompany} showToast={showToast} />}
                    {activeSection === 'material-requests' && loadedTabs.has('material-requests') && <MaterialRequestsView lang={lang} company={activeCompany} showToast={showToast} />}
                    {activeSection === 'stock-count' && loadedTabs.has('stock-count') && <StockCountView lang={lang} company={activeCompany} showToast={showToast} />}
                    {activeSection === 'scheduled-orders' && loadedTabs.has('scheduled-orders') && <ScheduledOrdersView lang={lang} showToast={showToast} />}
                    {activeSection === 'reports' && loadedTabs.has('reports') && <ReportsView lang={lang} company={activeCompany} />}
                </main>
            </div>
        </div>
    )
}
