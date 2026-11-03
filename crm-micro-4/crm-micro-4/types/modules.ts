export interface SystemModule {
  id: string
  name: string
  description: string
  nameEn: string
  price: number // إضافة السعر
  originalPrice?: number // إضافة السعر الأصلي قبل الخصم
  icon?: string
  category?: 'core' | 'hr' | 'sales' | 'operations' | 'analytics'
}

export const SYSTEM_MODULES: SystemModule[] = [
  {
    id: 'hr-management',
    name: 'نظام الموارد البشرية',
    nameEn: 'HR Management System',
    description: 'نظام متكامل لإدارة الموظفين، والحضور، والإجازات والرواتب',
    price: 249, // بعد الخصم
    originalPrice: 349, // السعر الأصلي
    icon: 'users',
    category: 'hr'
  },
  {
    id: 'task-management',
    name: 'نظام إدارة المهام',
    nameEn: 'Task Management System',
    description: 'نظام شامل لإدارة المهام والمشاريع والفرق',
    price: 149, // بعد الخصم
    originalPrice: 199, // السعر الأصلي
    icon: 'clipboard-list',
    category: 'core'
  },
  {
    id: 'complaints-management',
    name: 'نظام إدارة الشكاوى',
    nameEn: 'Complaints Management System',
    description: 'نظام متكامل لإدارة شكاوى العملاء والموظفين',
    price: 149,
    icon: 'message-square',
    category: 'operations'
  },
  {
    id: 'pos-system',
    name: 'نظام نقاط البيع',
    nameEn: 'Point of Sale System',
    description: 'نظام متكامل لنقاط البيع والعملاء والتوزيعات والإيرادات',
    price: 299, // بعد الخصم
    originalPrice: 399, // السعر الأصلي
    icon: 'shopping-cart',
    category: 'sales'
  },
  {
    id: 'branch-management',
    name: 'نظام إدارة الفروع',
    nameEn: 'Branch Management System',
    description: 'نظام شامل لإدارة الفروع وتتبع المواقع',
    price: 249,
    icon: 'map-pin',
    category: 'operations'
  },
  {
    id: 'inventory-management',
    name: 'نظام إدارة المخزون',
    nameEn: 'Inventory Management System',
    description: 'نظام متكامل لإدارة المخزون والتسعيات والتقارير',
    price: 349,
    icon: 'package',
    category: 'operations'
  },
  {
    id: 'document-management',
    name: 'نظام إدارة المستندات',
    nameEn: 'Document Management System',
    description: 'تخزين وإدارة المستندات والملفات',
    price: 0, // مجاني
    icon: 'file-text',
    category: 'core'
  },
  {
    id: 'product-management',
    name: 'نظام إدارة المنتجات',
    nameEn: 'Product Management System',
    description: 'نظام شامل لإدارة المنتجات والتصنيعات والوحدات',
    price: 299,
    icon: 'box',
    category: 'operations'
  },
  {
    id: 'notifications-system',
    name: 'نظام الإشعارات',
    nameEn: 'Notifications System',
    description: 'نظام إشعارات وتنبيهات متقدم',
    price: 0, // مجاني
    icon: 'bell',
    category: 'core'
  },
  {
    id: 'reports-analytics',
    name: 'نظام التقارير والتحليلات',
    nameEn: 'Reports & Analytics System',
    description: 'تقارير شاملة وتحليلات متقدمة لجميع الأنظمة',
    price: 399, // بعد الخصم
    originalPrice: 499, // السعر الأصلي
    icon: 'bar-chart',
    category: 'analytics'
  },
  {
    id: 'settings-configuration',
    name: 'نظام الإعدادات',
    nameEn: 'Settings & Configuration',
    description: 'إعدادات وتخصيص النظام الشامل',
    price: 0, // مجاني
    icon: 'settings',
    category: 'core'
  },
  {
    id: 'financial-management',
    name: 'النظام المالي',
    nameEn: 'Financial Management',
    description: 'إدارة المصروفات والسلف والمحافظ المالية',
    price: 499,
    icon: 'dollar-sign',
    category: 'analytics'
  }
]

export interface SignUpFormData {
  // Step 1: Personal & Account Info
  fullName: string
  email: string
  phone: string // إضافة حقل رقم الجوال
  username: string
  password: string
  confirmPassword: string
  
  // Step 2: Organization Info
  organizationName: string
  subdomain: string
  
  // Step 3: Module Selection
  selectedModules: string[]
}
