'use client'

import React, { useState, useEffect, useRef } from "react"
import { ArrowLeft, Save, Upload, Loader2, CheckCircle, AlertCircle, User, MapPin, Package, CalendarDays, Car, Users, FileText, Printer, Info, CreditCard } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { frappeClient, frappeApiUrl } from "@/lib/api-client"
import { frappeImageUrl } from "@/lib/utils"
import { updateDoc } from "@/lib/api"
import { useAuthSafe } from "@/lib/auth-context"
import { EmployeeDocuments } from "@/components/employee/employee-documents"
import { CustodyItems } from "@/components/custody/custody-items"
import { LeaveApplicationDialog } from "@/components/leave/leave-application-dialog"
import { useNavigationGuard } from "@/lib/use-navigation-guard"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { useI18n } from "@/lib/i18n"
import { translateEnum } from "@/lib/enums"
import { LocalizedDateInput } from "@/components/ui/localized-date-input"
import { COUNTRY_AR } from "@/lib/country-names-ar"
import { formatSAR, dualDate } from "@/lib/format"
import { printContract, OPTIONAL_CLAUSES, optionalClauseText, type ContractDocData } from "@/lib/hr/contract-document"
import { IdExpiryBadge } from "@/components/employee/id-expiry-badge"
import dynamic from "next/dynamic"

type Locale = 'ar' | 'en'

// Display-only Arabic maps for <select> option labels. The VALUE sent to the
// backend (English) is never changed — only the visible label is localized.
const CUSTODY_CATEGORY_AR: Record<string, string> = {
  'Phone': 'هاتف',
  'SIM Card': 'شريحة اتصال',
  'Laptop': 'لابتوب',
  'Tablet': 'تابلت',
  'Uniform': 'زي رسمي',
  'Keys': 'مفاتيح',
  'Vehicle': 'مركبة',
  'Tools': 'أدوات',
  'Other': 'أخرى',
}

// Interactive Leaflet map (OpenStreetMap, no API key) for picking the home location.
const LocationPickerMap = dynamic(
  () => import('@/components/sales/location-picker-map').then(m => m.LocationPickerMap),
  { ssr: false, loading: () => <div className="h-[300px] rounded-lg bg-muted animate-pulse" /> }
)

const L = {
  en: {
    // Header
    editEmployee: 'Edit Employee',
    newEmployee: 'New Employee',
    editSubtitle: 'Update employee information',
    newSubtitle: 'Create a new employee record',
    cancel: 'Cancel',
    previous: '← Previous',
    next: 'Next',
    saving: 'Saving...',
    saveEmployee: 'Save Employee',
    // Stepper
    stepPersonal: 'Personal Details',
    stepPersonalSub: 'Name, gender & ID',
    stepEmployment: 'Employment',
    stepEmploymentSub: 'Company, role & branch',
    stepContact: 'Contact',
    stepContactSub: 'Phone & email',
    stepWork: 'Work & Access',
    stepWorkSub: 'Schedule, tracking & login',
    stepDocuments: 'Documents',
    stepDocumentsSub: 'Attachments & files',
    // Photo
    uploading: 'Uploading...',
    profilePhoto: 'Profile Photo',
    clickToUpload: 'Click to upload (max 2MB)',
    imageTypeError: 'Please select an image file',
    imageSizeError: 'Image size must be less than 2MB',
    imageUploaded: 'Image uploaded successfully',
    imageFailed: 'Failed to upload image',
    // Required fields sidebar
    requiredThisStep: 'Required this step',
    allRequiredComplete: 'All required fields complete',
    stepOf: 'Step {current} of {total}',
    // Step 1 - Personal
    personalDetails: 'Personal Details',
    firstName: 'First Name',
    middleName: 'Middle Name',
    lastName: 'Last Name',
    gender: 'Gender',
    selectGender: 'Select Gender',
    male: 'Male',
    female: 'Female',
    dateOfBirth: 'Date of Birth',
    dateOfJoining: 'Date of Joining',
    idType: 'ID Type',
    idExpiry: 'ID / Iqama Expiry',
    idIssue: 'ID / Iqama Issue',
    fromPersonalInfo: 'from Personal Information',
    enterInPersonal: 'Enter it in Personal Information ↑',
    identityDetails: 'Identity details',
    selectIdType: 'Select ID Type',
    nationalId: 'National ID - هوية وطنية',
    iqama: 'Iqama - إقامة',
    idNumber: 'National ID / Iqama Number',
    enterFirstName: 'Enter first name',
    enterMiddleName: 'Enter middle name',
    enterLastName: 'Enter last name',
    enterNationalId: 'Enter National ID number',
    enterIqama: 'Enter Iqama number',
    idDigitsWarning: 'ID number should be 10 digits',
    // Step 2 - Company
    companyDetails: 'Company Details',
    company: 'Company',
    selectCompany: 'Select Company',
    department: 'Department',
    selectCompanyFirst: 'Select Company First',
    selectDepartment: 'Select Department',
    designation: 'Designation',
    selectDesignation: 'Select Designation',
    employmentMode: 'Employment Mode',
    selectMode: 'Select Mode',
    fullTime: 'Full-time',
    partTime: 'Part-time',
    onSite: 'On-site',
    remote: 'Remote',
    hybrid: 'Hybrid',
    branch: 'Branch',
    selectBranch: 'Select Branch',
    workFromHome: 'Work From Home',
    status: 'Status',
    baseSalary: 'Base Salary',
    enterBaseSalary: 'Enter base salary (optional)',
    salaryAssignmentCreated: 'Base salary assignment created automatically.',
    salaryAssignmentNoStructure: 'Warning: Employee created, but no salary structure was found to assign base salary.',
    salaryAssignmentFailed: 'Warning: Employee created, but base salary assignment failed.',
    salaryAssignmentUpdated: 'Salary updated successfully.',
    shiftAssignmentFailed: 'Warning: Shift assignment could not be created.',
    active: 'Active',
    inactive: 'Inactive',
    suspended: 'Suspended',
    left: 'Left',
    // Step 3 - Contact
    contactInfo: 'Contact Information',
    mobileNumber: 'Mobile Number',
    personalEmail: 'Personal Email',
    companyEmail: 'Company Email',
    // Step 4 - Work
    workSettings: 'Work Settings',
    // Employment Contract (optional onboarding section)
    contractSection: 'Employment Contract',
    contractEnable: 'Add an employment contract (optional)',
    contractType: 'Contract Type',
    contractSelectType: 'Select type',
    ctPermanent: 'Permanent',
    ctFixedTerm: 'Fixed Term',
    ctProbation: 'Probation',
    ctPartTime: 'Part-time',
    contractStart: 'Start Date',
    contractEnd: 'End Date',
    housingAllowance: 'Housing Allowance',
    transportAllowance: 'Transport Allowance',
    otherAllowance: 'Other Allowance',
    probationMonths: 'Probation (months)',
    noticeDays: 'Notice Period (days)',
    annualLeaveDays: 'Annual Leave (days)',
    workingHoursPerDay: 'Working Hours / Day',
    contractStatus: 'Status',
    ctDraft: 'Draft',
    ctActive: 'Active',
    contractBasicNote: 'Basic salary is taken from the "Base Salary" field above (SAR).',
    sar: '(SAR)',
    probationHint: 'Max 180 days (6 months).',
    probationWarn: 'Exceeds the 6-month legal maximum.',
    noticeHint: 'Indefinite term: 60 days by employer, 30 days on resignation.',
    annualLeaveHint: 'Minimum 21 days (30 after 5 years of service).',
    annualLeaveWarn: 'Below the 21-day legal minimum.',
    workingHoursHint: 'Max 8 hours/day, 48/week (6 in Ramadan).',
    workingHoursWarn: 'Exceeds the 8-hour/day legal maximum.',
    monthlyPackage: 'Total Monthly Package',
    contractEndBeforeStart: 'Contract end date must be on or after the start date.',
    nonCompeteIncomplete: 'Non-Compete is enabled — enter a duration (1–24 months) and the scope/activity.',
    contractCreated: 'Employment contract created.',
    contractFailed: 'Warning: employee saved, but the employment contract could not be created.',
    // Contract — expanded sections (Saudi-labor-law-aligned)
    secType: 'Type & Term',
    secJob: 'Job & Skill',
    secWork: 'Place, Hours & Days',
    secWage: 'Wage & Allowances',
    secLeaveNotice: 'Leave & Notice',
    secClauses: 'Optional Clauses',
    skillLevel: 'Skill Level',
    skillSelect: 'Select level',
    skillHigh: 'High-skilled',
    skillSkilled: 'Skilled',
    skillBasic: 'Basic / Labor',
    skillHint: 'Affects Qiwa / visa / Saudization.',
    autoRenew: 'Auto-renew the contract',
    renewalTerm: 'Renewal Term (months)',
    termTypeHint: 'A fixed-term contract renewed 3 consecutive times or reaching 4 years converts to indefinite (Saudis); a foreign national\'s contract must be fixed-term.',
    workLocation: 'Work Location',
    workLocationHint: 'Relocation changing the employee\'s residence needs written consent (Art. 58).',
    workDays: 'Work Days',
    workDaysPh: 'e.g. Sunday – Thursday',
    weeklyRest: 'Weekly Rest Day',
    restSelect: 'Select rest day',
    restFriday: 'Friday',
    restSaturday: 'Saturday',
    restSunday: 'Sunday',
    restFriSat: 'Friday & Saturday',
    gosiDeduction: 'GOSI Deduction',
    gosiHint: 'Employee GOSI share deducted from the salary.',
    netSalary: 'Net Salary (after GOSI)',
    salaryPaymentDay: 'Salary Payment Day',
    salaryPaymentDayHint: 'Day of the month wages are paid (1–31).',
    clausesHint: 'Toggle the clauses to include in the generated contract document.',
    clConfidentiality: 'Confidentiality',
    clNonCompete: 'Non-Compete',
    nonCompeteDuration: 'Duration (months, max 24)',
    nonCompeteScope: 'Scope, place & type of work',
    nonCompeteHint: 'Max 2 years, with a defined place and type of work (Art. 83).',
    clIP: 'Intellectual Property',
    clMobility: 'Mobility / Travel',
    clRemote: 'Remote Work',
    clTraining: 'Training Commitment',
    trainingDetails: 'Training commitment details',
    womenTitle: 'Provisions for Female Employees',
    womenNote: 'Statutory provisions for female employees (maternity leave, no hazardous work, suitable environment, equal pay) apply by law and appear on the document.',
    qiwaNote: 'This is an internal contract record. The official binding contract is authenticated and approved via the Qiwa platform.',
    arabicPrevails: 'On the generated document, the Arabic text prevails in case of discrepancy, and a specialist legal review is recommended.',
    previewContract: 'Preview / Print Contract',
    clausePreviewLabel: 'Preview the exact clause text',
    clausePreviewTitle: 'Text inserted into the contract:',
    ncRequired: 'Required when Non-Compete is on',
    ncDurationRange: 'Between 1 and 24 months (max 2 years).',
    ncScopePh: 'Geographic scope + type of business/activity',
    sectionsHeading: 'Jump to section',
    summaryHeading: 'Live summary',
    sumJob: 'Job title',
    sumContract: 'Contract type',
    sumNotSet: 'Not set',
    checkinMethod: 'Check-in Method',
    manual: 'Manual (Simple Click)',
    photo: 'Photo (Selfie Required)',
    biometric: 'Biometric (Coming Soon - Hardware Device)',
    photoBiometric: 'Photo + Biometric (Coming Soon)',
    manualDesc: '✓ Simple button click for check-in/out',
    photoDesc: '📸 Employee must take selfie for verification',
    biometricDesc: '⚠️ Requires biometric hardware device (coming soon)',
    photoBiometricDesc: '⚠️ Requires both photo and biometric (coming soon)',
    defaultShift: 'Default Shift',
    noDefaultShift: 'No Default Shift',
    enableTracking: 'Enable Tracking',
    enableTrackingLabel: 'Enable location tracking for this employee',
    employeeConsent: 'Employee Consent',
    employeeConsentLabel: 'Employee approved location tracking',
    trackingInterval: 'Tracking Interval',
    minutes: 'Minutes',
    hours: 'Hours',
    seconds: 'Seconds',
    intervalNumber: 'Interval Number',
    // User account
    userAccountExists: 'User account exists for:',
    noUserAccount: "This employee doesn't have a user account yet. Check the box below to create one.",
    updateUserAccount: 'Update/Replace user account',
    createUserAccount: 'Create user account for this employee (allows app login)',
    userEmail: 'User Email',
    setPasswordDirectly: 'Set password directly (user can login immediately)',
    password: 'Password',
    passwordMin8: 'At least 8 characters',
    passwordUpper: 'One uppercase letter (A-Z)',
    passwordLower: 'One lowercase letter (a-z)',
    passwordNumber: 'One number (0-9)',
    passwordSpecial: 'One special character (!@#$%^&*)',
    passwordLoginNow: 'User can login immediately with this password. Make sure to save it!',
    welcomeEmail: 'User will receive a welcome email with password reset link',
    userAccountInfo: 'If enabled, a user account will be created automatically with Employee Self-Service role.',
    userAccountFor: 'User account will be created for:',
    userAccountReady: 'Login account saved',
    userAccountUsername: 'Username',
    userAccountSavePassword: 'Save this password — the employee can sign in with it right away.',
    userAccountWelcomeSent: 'A welcome email with a password-reset link has been sent.',
    userAccountLinkedElsewhere: 'is already linked to another employee',
    userAccountUseAnotherEmail: 'Please use a different email address.',
    userAccountFailed: 'The login account was NOT changed. The employee still signs in with the old account.',
    // Validation
    firstNameRequired: 'First Name is required',
    genderRequired: 'Gender is required',
    dobRequired: 'Date of Birth is required',
    dojRequired: 'Date of Joining is required',
    dojAfterDob: 'Date of Joining must be after Date of Birth',
    companyRequired: 'Company is required',
    intervalRequired: 'Tracking interval number must be greater than 0',
    consentRequired: 'Employee consent is required when tracking is enabled',
    emailRequired: 'Email is required to create user account',
    loginByIdHint: 'No email? Leave it blank — the employee signs in with their national/iqama number',
    loginIdIs: 'Sign-in name',
    loginIdMissing: 'Add the national/iqama number above — it becomes the sign-in name',
    loginSkippedNoPassword: 'No login was created: set a password, or enter an email address',
    emailInvalid: 'Please enter a valid email address',
    nationalityRequired: 'Nationality is required',
    passwordMin: 'Password must be at least 8 characters long',
    passwordNeedUpper: 'Password must contain at least one uppercase letter',
    passwordNeedLower: 'Password must contain at least one lowercase letter',
    passwordNeedNumber: 'Password must contain at least one number',
    passwordNeedSpecial: 'Password must contain at least one special character (!@#$%^&* etc.)',
    pleaseFixFields: 'Please fix these fields:',
    pleaseComplete: 'Please complete:',
    loadFailed: 'Failed to load employee data',
    updated: 'updated successfully!',
    created: 'created successfully!',
    // Stepper (Custody & Leaves step)
    stepCustody: 'Custody & Leaves',
    stepCustodySub: 'Assets & balances',
    // Step 1 — extra
    nationality: 'Nationality',
    selectNationality: 'Select Nationality',
    arrivalDate: 'Arrival Date (KSA)',
    dutyStartDate: 'Duty Start Date',
    // Step 2 — branch manager / vehicle
    reportsTo: 'Reports To (Manager)',
    selectManager: 'No manager (top level)',
    reportsToHint: 'The direct manager this employee reports to — this is what builds the org chart.',
    isBranchManager: 'Branch Manager',
    isBranchManagerLabel: 'This employee manages a branch',
    managedBranch: 'Managed Branch',
    selectManagedBranch: 'Select Managed Branch',
    hasCompanyVehicle: 'Vehicle',
    hasCompanyVehicleLabel: 'This employee has a vehicle',
    vehiclePlate: 'Plate Number',
    enterVehiclePlate: 'Enter plate number',
    vehicleModel: 'Vehicle Type / Model',
    enterVehicleModel: 'Enter vehicle type / model',
    vehicleSection: 'Employee Vehicle',
    vehicleSectionSub: 'Car details & ownership',
    vehicleOwnership: 'Ownership',
    selectOwnership: 'Select ownership',
    ownershipPersonal: 'Personal (employee-owned)',
    ownershipCompany: 'Company-owned',
    familySection: 'Family & Emergency Contacts',
    familySectionSub: 'Family address and contacts — used as emergency contacts',
    requiredFields: 'Required fields',
    // Step 3 — addresses
    currentAddress: 'Current Address',
    enterCurrentAddress: 'Enter current address',
    permanentAddress: 'Permanent Address',
    enterPermanentAddress: 'Enter permanent address',
    // Step 3 — home location
    homeLocation: 'Home Location',
    homeAddress: 'Home Address',
    enterHomeAddress: 'Enter home address',
    homeLatitude: 'Latitude',
    homeLongitude: 'Longitude',
    useCurrentLocation: 'Use current location',
    capturingLocation: 'Getting location...',
    locationError: 'Failed to get your location. Please enable location services.',
    geolocationUnsupported: 'Geolocation is not supported by your browser',
    viewOnMap: 'View on Map',
    // Step 3 — emergency contacts
    emergencyContacts: 'Emergency Contacts',
    emergencyContact1: 'Primary Emergency Contact',
    emergencyContact2: 'Secondary Emergency Contact',
    emergencyContact3: 'Third Emergency Contact',
    contactName: 'Contact Name',
    enterContactName: 'Enter contact name',
    relationLabel: 'Relation',
    enterRelation: 'e.g. Father, Spouse, Friend',
    emergencyPhone: 'Phone Number',
    enterEmergencyPhone: 'Enter phone number',
    // Documents hint
    documentsHint: 'Upload the employment contract and ID documents. For residents: Passport + Iqama. For Saudis: National ID.',
    documentsHintResident: 'Resident: please upload Passport + Iqama.',
    documentsHintSaudi: 'Saudi: please upload National ID.',
    documentsReady: 'Employee created. You can now upload documents below.',
    // Custody & Leaves
    custodyTitle: 'Custody Items',
    custodySub: 'Assets currently assigned to this employee',
    leaveBalanceTitle: 'Leave Balances',
    leaveBalanceSub: 'Remaining balance per leave type',
    noLeaveTypes: 'No leave types found',
    days: 'days',
    loadingBalances: 'Loading balances...',
  },
  ar: {
    // Header
    editEmployee: 'تعديل موظف',
    newEmployee: 'موظف جديد',
    editSubtitle: 'تحديث بيانات الموظف',
    newSubtitle: 'إنشاء سجل موظف جديد',
    cancel: 'إلغاء',
    previous: 'السابق ←',
    next: 'التالي',
    saving: 'جاري الحفظ...',
    saveEmployee: 'حفظ الموظف',
    // Stepper
    stepPersonal: 'البيانات الشخصية',
    stepPersonalSub: 'الاسم والجنس والهوية',
    stepEmployment: 'التوظيف',
    stepEmploymentSub: 'الشركة والوظيفة والفرع',
    stepContact: 'التواصل',
    stepContactSub: 'الهاتف والبريد',
    stepWork: 'العمل والوصول',
    stepWorkSub: 'الدوام والتتبع والدخول',
    stepDocuments: 'المستندات',
    stepDocumentsSub: 'المرفقات والملفات',
    // Photo
    uploading: 'جاري الرفع...',
    profilePhoto: 'صورة الملف الشخصي',
    clickToUpload: 'اضغط للرفع (حد أقصى 2 ميجا)',
    imageTypeError: 'الرجاء اختيار ملف صورة',
    imageSizeError: 'حجم الصورة يجب أن يكون أقل من 2 ميجا',
    imageUploaded: 'تم رفع الصورة بنجاح',
    imageFailed: 'فشل رفع الصورة',
    // Required fields sidebar
    requiredThisStep: 'مطلوب في هذه الخطوة',
    allRequiredComplete: 'تم إكمال جميع الحقول المطلوبة',
    stepOf: 'الخطوة {current} من {total}',
    // Step 1 - Personal
    personalDetails: 'البيانات الشخصية',
    firstName: 'الاسم الأول',
    middleName: 'الاسم الأوسط',
    lastName: 'اسم العائلة',
    gender: 'الجنس',
    selectGender: 'اختر الجنس',
    male: 'ذكر',
    female: 'أنثى',
    dateOfBirth: 'تاريخ الميلاد',
    dateOfJoining: 'تاريخ الالتحاق',
    idType: 'نوع الهوية',
    idExpiry: 'تاريخ نهاية الهوية / الإقامة',
    idIssue: 'تاريخ إصدار الهوية / الإقامة',
    fromPersonalInfo: 'من البيانات الشخصية',
    enterInPersonal: 'أدخله في البيانات الشخصية ↑',
    identityDetails: 'بيانات الهوية',
    selectIdType: 'اختر نوع الهوية',
    nationalId: 'هوية وطنية - National ID',
    iqama: 'إقامة - Iqama',
    idNumber: 'رقم الهوية الوطنية / الإقامة',
    enterFirstName: 'أدخل الاسم الأول',
    enterMiddleName: 'أدخل الاسم الأوسط',
    enterLastName: 'أدخل اسم العائلة',
    enterNationalId: 'أدخل رقم الهوية الوطنية',
    enterIqama: 'أدخل رقم الإقامة',
    idDigitsWarning: 'يجب أن يكون رقم الهوية مكون من 10 أرقام',
    // Step 2 - Company
    companyDetails: 'بيانات الشركة',
    company: 'الشركة',
    selectCompany: 'اختر الشركة',
    department: 'القسم',
    selectCompanyFirst: 'اختر الشركة أولاً',
    selectDepartment: 'اختر القسم',
    designation: 'المسمى الوظيفي',
    selectDesignation: 'اختر المسمى الوظيفي',
    employmentMode: 'نمط العمل',
    selectMode: 'اختر النمط',
    fullTime: 'دوام كامل',
    partTime: 'دوام جزئي',
    onSite: 'في الموقع',
    remote: 'عن بُعد',
    hybrid: 'هجين',
    branch: 'الفرع',
    selectBranch: 'اختر الفرع',
    workFromHome: 'عمل من المنزل',
    status: 'الحالة',
    baseSalary: 'الراتب الأساسي',
    enterBaseSalary: 'أدخل الراتب الأساسي (اختياري)',
    salaryAssignmentCreated: 'تم إنشاء تعيين الراتب الأساسي تلقائيًا.',
    salaryAssignmentNoStructure: 'تحذير: تم إنشاء الموظف لكن لم يتم العثور على هيكل راتب لتعيين الراتب الأساسي.',
    salaryAssignmentFailed: 'تحذير: تم إنشاء الموظف لكن فشل تعيين الراتب الأساسي.',
    salaryAssignmentUpdated: 'تم تحديث الراتب بنجاح.',
    shiftAssignmentFailed: 'تحذير: تعذّر إنشاء تعيين الوردية.',
    active: 'نشط',
    inactive: 'غير نشط',
    suspended: 'معلّق',
    left: 'مغادر',
    // Step 3 - Contact
    contactInfo: 'بيانات التواصل',
    mobileNumber: 'رقم الجوال',
    personalEmail: 'البريد الشخصي',
    companyEmail: 'بريد الشركة',
    // Step 4 - Work
    workSettings: 'إعدادات العمل',
    // عقد العمل (قسم اختياري عند الإضافة)
    contractSection: 'عقد العمل',
    contractEnable: 'إضافة عقد عمل (اختياري)',
    contractType: 'نوع العقد',
    contractSelectType: 'اختر النوع',
    ctPermanent: 'دائم',
    ctFixedTerm: 'محدد المدة',
    ctProbation: 'تحت التجربة',
    ctPartTime: 'دوام جزئي',
    contractStart: 'تاريخ البداية',
    contractEnd: 'تاريخ النهاية',
    housingAllowance: 'بدل سكن',
    transportAllowance: 'بدل نقل',
    otherAllowance: 'بدل آخر',
    probationMonths: 'فترة التجربة (أشهر)',
    noticeDays: 'مدة الإشعار (أيام)',
    annualLeaveDays: 'الإجازة السنوية (أيام)',
    workingHoursPerDay: 'ساعات العمل / اليوم',
    contractStatus: 'الحالة',
    ctDraft: 'مسودة',
    ctActive: 'نشط',
    contractBasicNote: 'الراتب الأساسي مأخوذ من حقل "الراتب الأساسي" أعلاه (ريال).',
    sar: '(ريال)',
    probationHint: 'الحد الأقصى 180 يوم (6 شهور).',
    probationWarn: 'يتجاوز الحد الأقصى القانوني (6 شهور).',
    noticeHint: 'غير محددة المدة: 60 يوم من جهة العمل، 30 يوم عند الاستقالة.',
    annualLeaveHint: 'الحد الأدنى 21 يوم (30 بعد 5 سنين خدمة).',
    annualLeaveWarn: 'أقل من الحد الأدنى القانوني (21 يوم).',
    workingHoursHint: 'الحد الأقصى 8 ساعات/يوم، 48/أسبوع (6 في رمضان).',
    workingHoursWarn: 'يتجاوز الحد الأقصى القانوني (8 ساعات/اليوم).',
    monthlyPackage: 'إجمالي الحزمة الشهرية',
    contractEndBeforeStart: 'تاريخ نهاية العقد يجب أن يكون في تاريخ البداية أو بعده.',
    nonCompeteIncomplete: 'بند عدم المنافسة مُفعّل — أدخل المدة (1–24 شهراً) والنطاق/النشاط.',
    contractCreated: 'تم إنشاء عقد العمل.',
    contractFailed: 'تحذير: تم حفظ الموظف لكن تعذّر إنشاء عقد العمل.',
    // العقد — أقسام موسّعة (متوافقة مع نظام العمل السعودي)
    secType: 'نوع العقد ومدته',
    secJob: 'المسمى وتصنيف المهارة',
    secWork: 'مكان وساعات وأيام العمل',
    secWage: 'الأجر والبدلات',
    secLeaveNotice: 'الإجازات والإشعار',
    secClauses: 'بنود اختيارية',
    skillLevel: 'تصنيف المهارة',
    skillSelect: 'اختر التصنيف',
    skillHigh: 'عالي المهارة',
    skillSkilled: 'ماهر',
    skillBasic: 'أساسي (عمالة)',
    skillHint: 'يؤثر على قِوى والتأشيرة والسعودة.',
    autoRenew: 'تجديد تلقائي للعقد',
    renewalTerm: 'مدة التجديد (أشهر)',
    termTypeHint: 'العقد محدد المدة الذي يُجدَّد 3 مرات متتالية أو يبلغ 4 سنوات يتحول إلى غير محدد المدة (للسعوديين)؛ ويجب أن يكون عقد غير السعودي محدد المدة.',
    workLocation: 'مكان العمل',
    workLocationHint: 'النقل إلى مكان يغيّر محل إقامة الموظف يتطلب موافقته الكتابية (المادة 58).',
    workDays: 'أيام العمل',
    workDaysPh: 'مثال: الأحد – الخميس',
    weeklyRest: 'يوم الراحة الأسبوعية',
    restSelect: 'اختر يوم الراحة',
    restFriday: 'الجمعة',
    restSaturday: 'السبت',
    restSunday: 'الأحد',
    restFriSat: 'الجمعة والسبت',
    gosiDeduction: 'خصم التأمينات (GOSI)',
    gosiHint: 'حصة الموظف من التأمينات المخصومة من الراتب.',
    netSalary: 'صافي الراتب (بعد التأمينات)',
    salaryPaymentDay: 'يوم صرف الراتب',
    salaryPaymentDayHint: 'يوم صرف الراتب من كل شهر (1–31).',
    clausesHint: 'فعّل البنود لإضافتها إلى وثيقة العقد المُولَّدة.',
    clConfidentiality: 'السرية',
    clNonCompete: 'عدم المنافسة',
    nonCompeteDuration: 'المدة (أشهر، بحد أقصى 24)',
    nonCompeteScope: 'النطاق والمكان ونوع العمل',
    nonCompeteHint: 'بحد أقصى سنتان، مع تحديد المكان ونوع العمل (المادة 83).',
    clIP: 'الملكية الفكرية',
    clMobility: 'التنقل والسفر',
    clRemote: 'العمل عن بُعد',
    clTraining: 'الالتزام بالتدريب',
    trainingDetails: 'تفاصيل الالتزام بالتدريب',
    womenTitle: 'أحكام خاصة بالمرأة العاملة',
    womenNote: 'تُطبَّق بحكم النظام الأحكام الخاصة بالموظفات (إجازة الوضع، حظر الأعمال الخطرة، بيئة عمل ملائمة، المساواة في الأجر) وتظهر في الوثيقة.',
    qiwaNote: 'هذا سجل داخلي للعقد. العقد الرسمي المُلزم يُوثَّق ويُعتمد عبر منصة قِوى.',
    arabicPrevails: 'في الوثيقة المُولَّدة، يُعتمد النص العربي عند الاختلاف، ويُنصح بالمراجعة القانونية المتخصصة.',
    previewContract: 'معاينة / طباعة العقد',
    clausePreviewLabel: 'معاينة نص البند كما سيظهر في العقد',
    clausePreviewTitle: 'النص المُدرج في العقد:',
    ncRequired: 'مطلوب عند تفعيل عدم المنافسة',
    ncDurationRange: 'بين 1 و 24 شهراً (بحد أقصى سنتان).',
    ncScopePh: 'النطاق الجغرافي ونوع النشاط/العمل',
    sectionsHeading: 'الانتقال إلى قسم',
    summaryHeading: 'ملخص مباشر',
    sumJob: 'المسمى الوظيفي',
    sumContract: 'نوع العقد',
    sumNotSet: 'غير محدد',
    checkinMethod: 'طريقة تسجيل الحضور',
    manual: 'يدوي (نقرة بسيطة)',
    photo: 'صورة (سيلفي مطلوب)',
    biometric: 'بصمة (قريباً - جهاز بصمة)',
    photoBiometric: 'صورة + بصمة (قريباً)',
    manualDesc: '✓ نقرة بسيطة لتسجيل الحضور والانصراف',
    photoDesc: '📸 يجب على الموظف التقاط صورة سيلفي للتحقق',
    biometricDesc: '⚠️ يتطلب جهاز بصمة (قريباً)',
    photoBiometricDesc: '⚠️ يتطلب صورة وبصمة معاً (قريباً)',
    defaultShift: 'الوردية الافتراضية',
    noDefaultShift: 'بدون وردية افتراضية',
    enableTracking: 'تفعيل التتبع',
    enableTrackingLabel: 'تفعيل تتبع الموقع لهذا الموظف',
    employeeConsent: 'موافقة الموظف',
    employeeConsentLabel: 'الموظف وافق على تتبع الموقع',
    trackingInterval: 'فترة التتبع',
    minutes: 'دقائق',
    hours: 'ساعات',
    seconds: 'ثوانٍ',
    intervalNumber: 'رقم الفترة',
    // User account
    userAccountExists: 'حساب المستخدم موجود لـ:',
    noUserAccount: 'هذا الموظف ليس لديه حساب مستخدم بعد. حدد المربع أدناه لإنشاء واحد.',
    updateUserAccount: 'تحديث/استبدال حساب المستخدم',
    createUserAccount: 'إنشاء حساب مستخدم لهذا الموظف (يسمح بتسجيل الدخول)',
    userEmail: 'بريد المستخدم',
    setPasswordDirectly: 'تعيين كلمة المرور مباشرة (المستخدم يمكنه الدخول فوراً)',
    password: 'كلمة المرور',
    passwordMin8: '8 أحرف على الأقل',
    passwordUpper: 'حرف كبير واحد على الأقل (A-Z)',
    passwordLower: 'حرف صغير واحد على الأقل (a-z)',
    passwordNumber: 'رقم واحد على الأقل (0-9)',
    passwordSpecial: 'رمز خاص واحد على الأقل (!@#$%^&*)',
    passwordLoginNow: 'المستخدم يمكنه تسجيل الدخول فوراً بهذه كلمة المرور. تأكد من حفظها!',
    welcomeEmail: 'سيتلقى المستخدم بريد ترحيب مع رابط إعادة تعيين كلمة المرور',
    userAccountInfo: 'إذا تم التفعيل، سيتم إنشاء حساب مستخدم تلقائياً بصلاحية الخدمة الذاتية للموظف.',
    userAccountFor: 'سيتم إنشاء حساب مستخدم لـ:',
    userAccountReady: 'تم حفظ حساب الدخول',
    userAccountUsername: 'اسم المستخدم',
    userAccountSavePassword: 'احفظ كلمة المرور — يستطيع الموظف تسجيل الدخول بها فوراً.',
    userAccountWelcomeSent: 'تم إرسال بريد ترحيب يحتوي رابط تعيين كلمة المرور.',
    userAccountLinkedElsewhere: 'مرتبط مسبقاً بموظف آخر',
    userAccountUseAnotherEmail: 'الرجاء استخدام بريد إلكتروني مختلف.',
    userAccountFailed: 'لم يتم تغيير حساب الدخول. لا يزال الموظف يسجّل الدخول بالحساب القديم.',
    // Validation
    firstNameRequired: 'الاسم الأول مطلوب',
    genderRequired: 'الجنس مطلوب',
    dobRequired: 'تاريخ الميلاد مطلوب',
    dojRequired: 'تاريخ الالتحاق مطلوب',
    dojAfterDob: 'تاريخ الالتحاق يجب أن يكون بعد تاريخ الميلاد',
    companyRequired: 'الشركة مطلوبة',
    intervalRequired: 'رقم فترة التتبع يجب أن يكون أكبر من 0',
    consentRequired: 'موافقة الموظف مطلوبة عند تفعيل التتبع',
    emailRequired: 'البريد الإلكتروني مطلوب لإنشاء حساب المستخدم',
    loginByIdHint: 'لا يوجد بريد؟ اتركه فارغًا — يدخل الموظف برقم الهوية / الإقامة',
    loginIdIs: 'اسم الدخول',
    loginIdMissing: 'أدخل رقم الهوية / الإقامة أعلاه — هو اسم الدخول',
    loginSkippedNoPassword: 'لم يُنشأ حساب دخول: عيّن كلمة مرور، أو أدخل بريدًا إلكترونيًا',
    emailInvalid: 'الرجاء إدخال بريد إلكتروني صحيح',
    nationalityRequired: 'الجنسية مطلوبة',
    passwordMin: 'كلمة المرور يجب أن تكون 8 أحرف على الأقل',
    passwordNeedUpper: 'كلمة المرور يجب أن تحتوي على حرف كبير واحد على الأقل',
    passwordNeedLower: 'كلمة المرور يجب أن تحتوي على حرف صغير واحد على الأقل',
    passwordNeedNumber: 'كلمة المرور يجب أن تحتوي على رقم واحد على الأقل',
    passwordNeedSpecial: 'كلمة المرور يجب أن تحتوي على رمز خاص واحد على الأقل (!@#$%^&* إلخ)',
    pleaseFixFields: 'الرجاء تصحيح هذه الحقول:',
    pleaseComplete: 'الرجاء إكمال:',
    loadFailed: 'فشل تحميل بيانات الموظف',
    updated: 'تم التحديث بنجاح!',
    created: 'تم الإنشاء بنجاح!',
    // Stepper (Custody & Leaves step)
    stepCustody: 'العهد والإجازات',
    stepCustodySub: 'الأصول والأرصدة',
    // Step 1 — extra
    nationality: 'الجنسية',
    selectNationality: 'اختر الجنسية',
    arrivalDate: 'تاريخ الوصول (للسعودية)',
    dutyStartDate: 'تاريخ مباشرة العمل',
    // Step 2 — branch manager / vehicle
    reportsTo: 'يتبع لـ (المدير المباشر)',
    selectManager: 'بدون مدير (المستوى الأعلى)',
    reportsToHint: 'المدير المباشر الذي يتبع له الموظف — منه يُبنى الهيكل التنظيمي.',
    isBranchManager: 'مدير فرع',
    isBranchManagerLabel: 'هذا الموظف يدير فرعاً',
    managedBranch: 'الفرع المُدار',
    selectManagedBranch: 'اختر الفرع المُدار',
    hasCompanyVehicle: 'مركبة',
    hasCompanyVehicleLabel: 'هذا الموظف لديه مركبة',
    vehiclePlate: 'رقم اللوحة',
    enterVehiclePlate: 'أدخل رقم اللوحة',
    vehicleModel: 'نوع / موديل المركبة',
    enterVehicleModel: 'أدخل نوع / موديل المركبة',
    vehicleSection: 'مركبة الموظف',
    vehicleSectionSub: 'بيانات السيارة وملكيتها',
    vehicleOwnership: 'الملكية',
    selectOwnership: 'اختر الملكية',
    ownershipPersonal: 'شخصية (ملك الموظف)',
    ownershipCompany: 'ملك الشركة',
    familySection: 'العائلة وجهات اتصال الطوارئ',
    familySectionSub: 'عنوان العائلة وجهات الاتصال — تُستخدم كجهات اتصال للطوارئ',
    requiredFields: 'الحقول المطلوبة',
    // Step 3 — addresses
    currentAddress: 'العنوان الحالي',
    enterCurrentAddress: 'أدخل العنوان الحالي',
    permanentAddress: 'العنوان الدائم',
    enterPermanentAddress: 'أدخل العنوان الدائم',
    // Step 3 — home location
    homeLocation: 'موقع السكن',
    homeAddress: 'عنوان السكن',
    enterHomeAddress: 'أدخل عنوان السكن',
    homeLatitude: 'خط العرض',
    homeLongitude: 'خط الطول',
    useCurrentLocation: 'استخدام الموقع الحالي',
    capturingLocation: 'جاري تحديد الموقع...',
    locationError: 'فشل تحديد موقعك. الرجاء تفعيل خدمات الموقع.',
    geolocationUnsupported: 'متصفحك لا يدعم تحديد الموقع الجغرافي',
    viewOnMap: 'عرض على الخريطة',
    // Step 3 — emergency contacts
    emergencyContacts: 'جهات الاتصال للطوارئ',
    emergencyContact1: 'جهة الاتصال الأساسية للطوارئ',
    emergencyContact2: 'جهة الاتصال الثانية للطوارئ',
    emergencyContact3: 'جهة الاتصال الثالثة للطوارئ',
    contactName: 'اسم جهة الاتصال',
    enterContactName: 'أدخل اسم جهة الاتصال',
    relationLabel: 'صلة القرابة',
    enterRelation: 'مثال: الأب، الزوج، صديق',
    emergencyPhone: 'رقم الهاتف',
    enterEmergencyPhone: 'أدخل رقم الهاتف',
    // Documents hint
    documentsHint: 'قم برفع عقد العمل ووثائق الهوية. للمقيمين: جواز السفر + الإقامة. للسعوديين: الهوية الوطنية.',
    documentsHintResident: 'مقيم: يرجى رفع جواز السفر + الإقامة.',
    documentsHintSaudi: 'سعودي: يرجى رفع الهوية الوطنية.',
    documentsReady: 'تم إنشاء الموظف. يمكنك الآن رفع المستندات أدناه.',
    // Custody & Leaves
    custodyTitle: 'العهد',
    custodySub: 'الأصول المُسلّمة حالياً لهذا الموظف',
    leaveBalanceTitle: 'أرصدة الإجازات',
    leaveBalanceSub: 'الرصيد المتبقي لكل نوع إجازة',
    noLeaveTypes: 'لا توجد أنواع إجازات',
    days: 'يوم',
    loadingBalances: 'جاري تحميل الأرصدة...',
  },
} as const

interface EmployeeProfileProps {
  onBack: () => void
  employeeId?: string
}

interface FormData {
  first_name: string
  middle_name: string
  last_name: string
  gender: string
  date_of_birth: string
  date_of_joining: string
  company: string
  department: string
  designation: string
  employment_mode: string
  branch: string
  status: string
  cell_number: string
  personal_email: string
  company_email: string
  user_email: string
  user_password: string
  image: string
  checkin_method: string
  enable_tracking: boolean
  employee_consent: boolean
  tracking_interval: string
  interval_number: string
  base_salary: string
  default_shift: string
  // Optional employment contract (onboarding)
  contract_enabled: boolean
  contract_type: string
  contract_start_date: string
  contract_end_date: string
  contract_housing_allowance: string
  contract_transport_allowance: string
  contract_other_allowance: string
  contract_probation_months: string
  contract_notice_days: string
  contract_annual_leave_days: string
  contract_working_hours: string
  contract_status: string
  // Employment contract — expanded (Saudi-labor-law-aligned) sections
  contract_skill_level: string
  contract_auto_renew: boolean
  contract_renewal_term: string
  contract_work_location: string
  contract_work_days: string
  contract_weekly_rest_day: string
  contract_gosi_deduction: string
  contract_salary_payment_day: string
  contract_confidentiality: boolean
  contract_non_compete: boolean
  contract_non_compete_duration: string
  contract_non_compete_scope: string
  contract_ip: boolean
  contract_mobility: boolean
  contract_remote_work: boolean
  contract_training: boolean
  contract_training_details: string
  create_user_account: boolean
  set_password_directly: boolean
  custom_national_id: string
  custom_id_type: string
  custom_id_issue_date: string
  custom_id_expiry_date: string
  // Personal — extra
  custom_nationality: string
  custom_arrival_date: string
  custom_duty_start_date: string
  // Employment — reporting line / branch manager / vehicle
  reports_to: string
  custom_is_branch_manager: boolean
  custom_managed_branch: string
  custom_has_company_vehicle: boolean
  custom_vehicle_plate: string
  custom_vehicle_model: string
  custom_vehicle_ownership: string
  // Contact — addresses
  current_address: string
  permanent_address: string
  // Contact — home location
  custom_home_address: string
  custom_home_latitude: string
  custom_home_longitude: string
  // Contact — emergency contacts
  person_to_be_contacted: string
  relation: string
  emergency_phone_number: string
  custom_emergency_2_name: string
  custom_emergency_2_relation: string
  custom_emergency_2_phone: string
  custom_emergency_3_name: string
  custom_emergency_3_relation: string
  custom_emergency_3_phone: string
}

interface DropdownData {
  companies: string[]
  departments: Array<{ name: string; department_name: string; company: string }>
  designations: string[]
  branches: string[]
  shifts: string[]
  employees: Array<{ name: string; employee_name: string }>
}

// Maps each optional-clause key (from OPTIONAL_CLAUSES, the contract-document single
// source of truth) to its form flag — so the clause UI and the document stay in sync.
const CLAUSE_FLAG: Record<string, keyof FormData> = {
  confidentiality: 'contract_confidentiality',
  non_compete: 'contract_non_compete',
  ip: 'contract_ip',
  mobility: 'contract_mobility',
  remote_work: 'contract_remote_work',
  training: 'contract_training',
}

// ── NationalityCombobox ──────────────────────────────────────────────────────
// Searchable dropdown for nationality selection.
function NationalityCombobox({
  value,
  onChange,
  countries,
  isRTL,
  placeholder,
  hasError,
}: {
  value: string
  onChange: (v: string) => void
  countries: string[]
  isRTL: boolean
  placeholder: string
  hasError?: boolean
}) {
  const [open, setOpen] = React.useState(false)
  const [search, setSearch] = React.useState('')
  const containerRef = React.useRef<HTMLDivElement>(null)

  // Close on outside click
  React.useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const filtered = React.useMemo(() => {
    if (!search.trim()) return countries
    const q = search.trim().toLowerCase()
    return countries.filter(c => {
      const label = isRTL ? (COUNTRY_AR[c] || c) : c
      return label.toLowerCase().includes(q) || c.toLowerCase().includes(q)
    })
  }, [countries, search, isRTL])

  const displayLabel = value
    ? (isRTL ? (COUNTRY_AR[value] || value) : value)
    : ''

  return (
    <div ref={containerRef} className="relative" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Trigger button */}
      <button
        type="button"
        onClick={() => { setOpen(o => !o); setSearch('') }}
        className={[
          'flex h-10 w-full items-center justify-between rounded-md border bg-background px-3 py-2 text-sm ring-offset-background',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          hasError ? 'border-red-500 ring-1 ring-red-500' : 'border-input',
        ].join(' ')}
      >
        <span className={displayLabel ? 'text-foreground' : 'text-muted-foreground'}>
          {displayLabel || placeholder}
        </span>
        <svg className={`h-4 w-4 opacity-50 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown */}
      {open && (
        <div className={[
          'absolute z-50 mt-1 w-full rounded-md border border-border bg-popover shadow-lg',
          isRTL ? 'right-0' : 'left-0',
        ].join(' ')}>
          {/* Search input */}
          <div className="p-2 border-b border-border">
            <input
              autoFocus
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={isRTL ? 'ابحث عن جنسية...' : 'Search nationality...'}
              className="w-full rounded-sm border border-input bg-background px-2 py-1.5 text-sm outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
          {/* Options list */}
          <ul className="max-h-52 overflow-y-auto py-1">
            {/* Clear option */}
            <li
              className="cursor-pointer px-3 py-1.5 text-sm text-muted-foreground hover:bg-accent"
              onClick={() => { onChange(''); setOpen(false); setSearch('') }}
            >
              {placeholder}
            </li>
            {filtered.length === 0 ? (
              <li className="px-3 py-2 text-sm text-muted-foreground">{isRTL ? 'لا توجد نتائج' : 'No results'}</li>
            ) : (
              filtered.map(c => {
                const label = isRTL ? (COUNTRY_AR[c] || c) : c
                return (
                  <li
                    key={c}
                    className={`cursor-pointer px-3 py-1.5 text-sm hover:bg-accent ${value === c ? 'bg-accent font-medium' : ''}`}
                    onClick={() => { onChange(c); setOpen(false); setSearch('') }}
                  >
                    {label}
                  </li>
                )
              })
            )}
          </ul>
        </div>
      )}
    </div>
  )
}

export function EmployeeProfile({ onBack, employeeId }: EmployeeProfileProps) {
  const { user, refreshUser } = useAuthSafe()
  const { t, lang, isRTL } = useI18n()
  const enumLocale = lang === 'en' ? 'en' : 'ar'
  const locale: Locale = lang === 'ar' ? 'ar' : 'en'
  const tr = L[locale]
  const [isDirty, setIsDirty] = useState(false)
  // Whether the Employment Contract feature exists on this tenant (hide the section if not).
  const [contractFeatureAvailable, setContractFeatureAvailable] = useState(true)
  // Per-clause "preview the actual contract text" disclosure state.
  const [openClausePreview, setOpenClausePreview] = useState<Record<string, boolean>>({})
  // Sticky section-nav: which section is currently in view (scroll-spy).
  const [activeSection, setActiveSection] = useState('section-personal')
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        await frappeClient.getList('Employment Contract', { limit_page_length: 1 })
        // Feature present — already the default; no state change (avoids a needless re-render).
      } catch (err) {
        // BUG FIX (contract toggle "activates then resets"): the old code hid the whole
        // section on ANY error, so a transient probe failure (CSRF race on first paint,
        // a permission hiccup) AFTER the user ticked the box would unmount it and discard
        // the toggle. Only hide on a DEFINITIVE "doctype absent" signal — never on
        // transient/permission errors — so the section stays mounted.
        const msg = String((err as { message?: string } | undefined)?.message || err || '')
        const featureAbsent = /DoesNotExist|Invalid DocType|not found|404|does not exist/i.test(msg)
        if (!cancelled && featureAbsent) setContractFeatureAvailable(false)
      }
    })()
    return () => { cancelled = true }
  }, [])
  const { guardOpen, confirmNavigation, cancelNavigation, guardedNavigate } = useNavigationGuard({
    isDirty,
    onBack,
  })
  const [form, setForm] = useState<FormData>({
    first_name: '',
    middle_name: '',
    last_name: '',
    gender: '',
    date_of_birth: '',
    date_of_joining: new Date().toISOString().split('T')[0],
    company: '',
    department: '',
    designation: '',
    employment_mode: '',
    branch: '',
    status: 'Active',
    cell_number: '',
    personal_email: '',
    company_email: '',
    user_email: '',
    user_password: '',
    image: '',
    checkin_method: 'Manual',
    enable_tracking: true,
    employee_consent: true,
    tracking_interval: 'Minutes',
    interval_number: '5',
    base_salary: '',
    default_shift: '',
    contract_enabled: false,
    contract_type: '',
    contract_start_date: '',
    contract_end_date: '',
    contract_housing_allowance: '',
    contract_transport_allowance: '',
    contract_other_allowance: '',
    contract_probation_months: '',
    contract_notice_days: '30',
    contract_annual_leave_days: '21',
    contract_working_hours: '8',
    contract_status: 'Draft',
    contract_skill_level: '',
    contract_auto_renew: false,
    contract_renewal_term: '',
    contract_work_location: '',
    contract_work_days: '',
    contract_weekly_rest_day: '',
    contract_gosi_deduction: '',
    contract_salary_payment_day: '',
    contract_confidentiality: false,
    contract_non_compete: false,
    contract_non_compete_duration: '',
    contract_non_compete_scope: '',
    contract_ip: false,
    contract_mobility: false,
    contract_remote_work: false,
    contract_training: false,
    contract_training_details: '',
    create_user_account: true,
    set_password_directly: false,
    custom_national_id: '',
    custom_id_type: '',
    custom_id_issue_date: '',
    custom_id_expiry_date: '',
    custom_nationality: '',
    custom_arrival_date: '',
    custom_duty_start_date: '',
    reports_to: '',
    custom_is_branch_manager: false,
    custom_managed_branch: '',
    custom_has_company_vehicle: false,
    custom_vehicle_plate: '',
    custom_vehicle_model: '',
    custom_vehicle_ownership: '',
    current_address: '',
    permanent_address: '',
    custom_home_address: '',
    custom_home_latitude: '',
    custom_home_longitude: '',
    person_to_be_contacted: '',
    relation: '',
    emergency_phone_number: '',
    custom_emergency_2_name: '',
    custom_emergency_2_relation: '',
    custom_emergency_2_phone: '',
    custom_emergency_3_name: '',
    custom_emergency_3_relation: '',
    custom_emergency_3_phone: '',
  })

  const [dropdowns, setDropdowns] = useState<DropdownData>({
    companies: [],
    departments: [],
    designations: [],
    branches: [],
    shifts: [],
    employees: [],
  })

  // Country options for nationality select
  const [countries, setCountries] = useState<string[]>([])
  // Geolocation capture state (home location)
  const [capturingLocation, setCapturingLocation] = useState(false)
  // Effective employee id — becomes set after a successful CREATE so the form
  // switches into edit mode and the Documents / Custody steps become reachable.
  const [createdEmployeeId, setCreatedEmployeeId] = useState<string | null>(null)
  const effectiveEmployeeId = employeeId || createdEmployeeId
  // Leave balances (edit mode, Custody & Leaves step)
  const [leaveBalances, setLeaveBalances] = useState<Array<{ leave_type: string; balance: number }>>([])
  const [loadingLeaveBalances, setLoadingLeaveBalances] = useState(false)
  const [custodyRefreshKey, setCustodyRefreshKey] = useState(0)
  const [showCustodyDialog, setShowCustodyDialog] = useState(false)
  const [savingCustody, setSavingCustody] = useState(false)
  const [custodyForm, setCustodyForm] = useState({ item_category: '', item_name: '', serial_no: '', status: 'Active' })
  const [showLeaveDialog, setShowLeaveDialog] = useState(false)
  const CUSTODY_CATEGORIES = ['Phone', 'SIM Card', 'Laptop', 'Tablet', 'Uniform', 'Keys', 'Vehicle', 'Tools', 'Other']

  const handleAddCustody = async () => {
    if (!effectiveEmployeeId || !custodyForm.item_category || !custodyForm.item_name) return
    setSavingCustody(true)
    try {
      await frappeClient.post('Employee Custody', {
        employee: effectiveEmployeeId,
        item_category: custodyForm.item_category,
        item_name: custodyForm.item_name,
        serial_no: custodyForm.serial_no || undefined,
        status: custodyForm.status || 'Active',
      } as any)
      setShowCustodyDialog(false)
      setCustodyRefreshKey(k => k + 1)
    } catch (e: any) {
      alert((isRTL ? 'فشل إضافة العهدة: ' : 'Failed to add custody: ') + (e?.message || e))
    } finally {
      setSavingCustody(false)
    }
  }

  const [saving, setSaving] = useState(false)
  const [saveResult, setSaveResult] = useState<{ success: boolean; message: string } | null>(null)
  const saveTimerRef = useRef<NodeJS.Timeout | null>(null)
  const [loadingDropdowns, setLoadingDropdowns] = useState(true)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [uploadingImage, setUploadingImage] = useState(false)
  const [imagePreview, setImagePreview] = useState<string>('')
  const [currentSalaryAssignmentName, setCurrentSalaryAssignmentName] = useState<string>('')
  const [currentSalaryStructureName, setCurrentSalaryStructureName] = useState<string>('')

  // Single-page form: all sections render at once (the old 4-step wizard was removed).

  // Cleanup save timer on unmount
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    }
  }, [])

  // Load dropdown data from Frappe 
  useEffect(() => {
    loadDropdowns()
    if (employeeId) {
      loadEmployeeData()
    }
  }, [employeeId])

  // Debug: Log check-in method whenever it changes
  useEffect(() => {
    console.log('🔍 Current check-in method in form state:', form.checkin_method)
  }, [form.checkin_method])

  const loadDropdowns = async () => {
    try {
      const [companies, departments, designations, branches, shifts, countriesRes, employeesRes] = await Promise.all([
        frappeClient.get('Company', undefined, { fields: ['name'], limit_page_length: 50 }),
        frappeClient.get('Department', undefined, { fields: ['name', 'department_name' as any, 'company'], limit_page_length: 200 }),
        frappeClient.get('Designation', undefined, { fields: ['name'], limit_page_length: 50 }),
        frappeClient.get('Branch', undefined, { fields: ['name'], limit_page_length: 50 }),
        frappeClient.get('Shift Type', undefined, { fields: ['name'], limit_page_length: 50 }),
        frappeClient.get('Country', undefined, { fields: ['name'], limit_page_length: 300 }),
        // Manager candidates for the "Reports To" picker (Active employees, name + display name).
        // Isolated with .catch so a failure here never breaks the core dropdowns above.
        frappeClient.get('Employee', undefined, { fields: ['name', 'employee_name' as any], filters: [['status', '=', 'Active']] as any, limit_page_length: 0 as any }).catch(() => ({ data: [] } as any)),
      ])

      setCountries((countriesRes.data || []).map((c: any) => c.name))

      const companyList = (companies.data || []).map((c: any) => c.name)
      const deptList = (departments.data || []).map((d: any) => ({
        name: d.name,
        department_name: d.department_name || d.name,
        company: d.company || ''
      }))
      const desigList = (designations.data || []).map((d: any) => d.name)
      const branchList = (branches.data || []).map((b: any) => b.name)
      const shiftList = (shifts.data || []).map((s: any) => s.name)
      const empList = (employeesRes.data || []).map((e: any) => ({ name: e.name, employee_name: e.employee_name || e.name }))

      // Remove duplicate departments by unique doctype name
      const uniqueDeptList = deptList.reduce((acc: Array<{ name: string; department_name: string; company: string }>, current: { name: string; department_name: string; company: string }) => {
        const exists = acc.find(item => item.name === current.name)
        if (!exists) {
          acc.push(current)
        }
        return acc
      }, [])

      setDropdowns({
        companies: companyList,
        departments: uniqueDeptList,
        designations: desigList,
        branches: branchList,
        shifts: shiftList,
        employees: empList,
      })

      // Auto-select company if only one
      if (companyList.length === 1) {
        setForm(prev => ({ ...prev, company: companyList[0] }))
      }
    } catch (error) {
      console.error('Failed to load dropdown data:', error)
    } finally {
      setLoadingDropdowns(false)
    }
  }

  const loadEmployeeData = async () => {
    if (!employeeId) return

    try {
      setLoadingDropdowns(true)
      const employee = await frappeClient.getEmployee(employeeId)

      console.log('📥 Loading employee data:', employee)

      // Load check-in method + location settings
      let checkinMethod = 'Manual'
      let locationSettings: any = null

      try {
        const locationSettingsResponse = await frappeClient.get('Employee Location Settings', employee!.name)
        locationSettings = locationSettingsResponse.data
        if (locationSettings?.checkin_method) {
          checkinMethod = locationSettings.checkin_method
        }
      } catch (err) {
        // Ignore if location settings do not exist; fallback to API below
      }

      try {
        if (!locationSettings?.checkin_method) {
          const methodSettings = await frappeClient.getCheckinMethod(employee!.name)
          console.log('📋 Check-in Method Settings:', methodSettings)
          checkinMethod = methodSettings.checkin_method || 'Manual'
        }
        console.log('✅ Check-in method:', checkinMethod)
      } catch (err: any) {
        console.error('⚠️ Error loading check-in method, using default:', err)
        checkinMethod = 'Manual'
      }

      if (employee) {
        console.log('✅ Loaded check-in method:', checkinMethod)

        // Check if employee has user account
        const hasUserAccount = employee.user_id ? true : false
        console.log('👤 Employee user_id:', employee.user_id, '| Has account:', hasUserAccount)

        // Load current salary assignment for edit mode
        let loadedBaseSalary = ''
        let loadedAssignmentName = ''
        let loadedStructureName = ''
        try {
          const salaryAssignments = await frappeClient.getSalaryStructureAssignments({
            fields: ['name', 'base', 'salary_structure'],
            filters: [
              ['Salary Structure Assignment', 'employee', '=', employee.name],
              // Without this, the newest row wins even when it is a cancelled
              // amendment — on qarawi that showed a base of 100 for an employee
              // whose live salary is 1,000. It also fed the cancelled docname to
              // the save path via setCurrentSalaryAssignmentName.
              ['Salary Structure Assignment', 'docstatus', '=', 1],
            ],
            order_by: 'from_date desc',
            limit_page_length: 1,
          })
          if (salaryAssignments.length > 0 && salaryAssignments[0].base) {
            loadedBaseSalary = String(salaryAssignments[0].base)
            loadedAssignmentName = salaryAssignments[0].name
            loadedStructureName = salaryAssignments[0].salary_structure || ''
          } else if (salaryAssignments.length > 0) {
            loadedAssignmentName = salaryAssignments[0].name
            loadedStructureName = salaryAssignments[0].salary_structure || ''
          }
        } catch (salaryErr) {
          console.warn('⚠️ Could not load salary assignment:', salaryErr)
        }
        setCurrentSalaryAssignmentName(loadedAssignmentName)
        setCurrentSalaryStructureName(loadedStructureName)

        setForm(prev => ({
          ...prev,
          first_name: employee.first_name || '',
          middle_name: employee.middle_name || '',
          last_name: employee.last_name || '',
          gender: employee.gender || '',
          date_of_birth: employee.date_of_birth || '',
          date_of_joining: employee.date_of_joining || '',
          company: employee.company || '',
          department: employee.department || '',
          designation: employee.designation || '',
          employment_mode: employee.custom_employment_mode || '',
          branch: employee.branch || '',
          status: employee.status || 'Active',
          cell_number: employee.cell_number || '',
          personal_email: employee.personal_email || '',
          company_email: employee.company_email || '',
          image: employee.image || '',
          checkin_method: checkinMethod,
          enable_tracking: !!locationSettings?.enable_tracking,
          employee_consent: !!locationSettings?.employee_consent,
          tracking_interval: locationSettings?.tracking_interval || 'Minutes',
          interval_number: String(locationSettings?.interval_number || 5),
          base_salary: loadedBaseSalary,
          default_shift: employee.default_shift || '',
          create_user_account: false, // Don't auto-check in edit mode
          set_password_directly: false,
          user_email: employee.user_id || '', // Load existing user email if exists
          user_password: '',
          custom_national_id: employee.custom_national_id || '',
          custom_id_type: employee.custom_id_type || '',
          custom_id_issue_date: employee.custom_id_issue_date || '',
          custom_id_expiry_date: employee.custom_id_expiry_date || '',
          custom_nationality: employee.custom_nationality || '',
          custom_arrival_date: employee.custom_arrival_date || '',
          custom_duty_start_date: employee.custom_duty_start_date || '',
          reports_to: employee.reports_to || '',
          custom_is_branch_manager: !!employee.custom_is_branch_manager,
          custom_managed_branch: employee.custom_managed_branch || '',
          // "has vehicle" toggle is on if any vehicle data exists (personal or company-owned)
          custom_has_company_vehicle: !!(employee.custom_has_company_vehicle || employee.custom_vehicle_model || employee.custom_vehicle_plate || employee.custom_vehicle_ownership),
          custom_vehicle_plate: employee.custom_vehicle_plate || '',
          custom_vehicle_model: employee.custom_vehicle_model || '',
          custom_vehicle_ownership: employee.custom_vehicle_ownership || (employee.custom_has_company_vehicle ? 'Company-Owned' : ''),
          current_address: employee.current_address || '',
          permanent_address: employee.permanent_address || '',
          custom_home_address: employee.custom_home_address || '',
          custom_home_latitude: employee.custom_home_latitude != null ? String(employee.custom_home_latitude) : '',
          custom_home_longitude: employee.custom_home_longitude != null ? String(employee.custom_home_longitude) : '',
          person_to_be_contacted: employee.person_to_be_contacted || '',
          relation: employee.relation || '',
          emergency_phone_number: employee.emergency_phone_number || '',
          custom_emergency_2_name: employee.custom_emergency_2_name || '',
          custom_emergency_2_relation: employee.custom_emergency_2_relation || '',
          custom_emergency_2_phone: employee.custom_emergency_2_phone || '',
          custom_emergency_3_name: employee.custom_emergency_3_name || '',
          custom_emergency_3_relation: employee.custom_emergency_3_relation || '',
          custom_emergency_3_phone: employee.custom_emergency_3_phone || '',
        }))

        // Don't set imagePreview here — form.image is set above
        // and frappeImageUrl() will resolve it for display.
        // imagePreview is only for fresh uploads (data URI from FileReader).
      }
    } catch (error) {
      console.error('Failed to load employee data:', error)
      setSaveResult({ success: false, message: tr.loadFailed })
    } finally {
      setLoadingDropdowns(false)
    }
  }

  const updateField = (field: keyof FormData, value: string | boolean | string[]) => {
    setForm(prev => ({ ...prev, [field]: value }))
    setIsDirty(true)
    setSaveResult(null)
    clearFieldError(field)
  }

  // Map the current form state into the bilingual contract document and print it.
  // Display-only: builds from entered values (employer CR is filled on the saved
  // record's detail card; here it shows a calm placeholder if absent — never blank).
  const numOrUndef = (v: string) => { const n = Number(v); return (v !== '' && Number.isFinite(n)) ? n : undefined }
  const handlePreviewContract = () => {
    const nationality = form.custom_nationality ? (COUNTRY_AR[form.custom_nationality] || form.custom_nationality) : ''
    const data: ContractDocData = {
      companyName: form.company || undefined,
      employeeName: [form.first_name, form.middle_name, form.last_name].filter(Boolean).join(' ').trim() || undefined,
      nationality: nationality || undefined,
      idType: form.custom_id_type || undefined,
      idNumber: form.custom_national_id || undefined,
      idIssue: form.custom_id_issue_date || undefined,
      idExpiry: form.custom_id_expiry_date || undefined,
      employeeAddress: form.current_address || form.custom_home_address || undefined,
      gender: form.gender || undefined,
      contractType: form.contract_type || undefined,
      startDate: form.contract_start_date || form.date_of_joining || undefined,
      endDate: (form.contract_type && form.contract_type !== 'Permanent') ? (form.contract_end_date || undefined) : undefined,
      autoRenew: form.contract_auto_renew,
      renewalTermMonths: form.contract_renewal_term || undefined,
      designation: form.designation || undefined,
      skillLevel: form.contract_skill_level || undefined,
      probationMonths: form.contract_probation_months || undefined,
      workLocation: form.contract_work_location || undefined,
      workDays: form.contract_work_days || undefined,
      weeklyRestDay: form.contract_weekly_rest_day || undefined,
      workingHours: form.contract_working_hours || undefined,
      basicSalary: numOrUndef(form.base_salary),
      housing: numOrUndef(form.contract_housing_allowance),
      transport: numOrUndef(form.contract_transport_allowance),
      other: numOrUndef(form.contract_other_allowance),
      gosi: numOrUndef(form.contract_gosi_deduction),
      salaryPaymentDay: form.contract_salary_payment_day || undefined,
      annualLeaveDays: form.contract_annual_leave_days || undefined,
      noticeDays: form.contract_notice_days || undefined,
      confidentiality: form.contract_confidentiality,
      nonCompete: form.contract_non_compete,
      nonCompeteDuration: form.contract_non_compete_duration || undefined,
      nonCompeteScope: form.contract_non_compete_scope || undefined,
      ip: form.contract_ip,
      mobility: form.contract_mobility,
      remoteWork: form.contract_remote_work,
      training: form.contract_training,
      trainingDetails: form.contract_training_details || undefined,
    }
    void printContract(data)
  }

  // Sticky section-nav: smooth-jump to a section (scroll-mt on each header offsets the bar).
  const scrollToSection = (id: string) => {
    setActiveSection(id)
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  // Scroll-spy: highlight the section nearest the top as the user scrolls.
  useEffect(() => {
    if (loadingDropdowns) return
    const ids = ['section-personal', 'section-company', 'section-contact', 'section-family', 'section-work', 'section-contract']
    const els = ids.map((id) => document.getElementById(id)).filter(Boolean) as HTMLElement[]
    if (!els.length) return
    const obs = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)
        if (visible[0]) setActiveSection(visible[0].target.id)
      },
      { rootMargin: '-120px 0px -55% 0px', threshold: [0, 0.25, 0.5, 1] }
    )
    els.forEach((el) => obs.observe(el))
    return () => obs.disconnect()
  }, [loadingDropdowns, employeeId, contractFeatureAvailable, form.contract_enabled])

  // Capture current geolocation into the home latitude/longitude fields.
  // Pattern mirrors employee-checkin-dialog.tsx (getCurrentPosition).
  const captureHomeLocation = () => {
    if (!navigator.geolocation) {
      setSaveResult({ success: false, message: tr.geolocationUnsupported })
      return
    }
    setCapturingLocation(true)
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setForm(prev => ({
          ...prev,
          custom_home_latitude: String(position.coords.latitude),
          custom_home_longitude: String(position.coords.longitude),
        }))
        setIsDirty(true)
        setCapturingLocation(false)
      },
      (error) => {
        console.error('Error getting location:', error)
        setSaveResult({ success: false, message: tr.locationError })
        setCapturingLocation(false)
      }
    )
  }

  // Load leave balances for the Custody & Leaves step (edit mode only).
  const loadLeaveBalances = async () => {
    if (!effectiveEmployeeId) return
    setLoadingLeaveBalances(true)
    try {
      const typesRes = await frappeClient.get('Leave Type', undefined, { fields: ['name'], limit_page_length: 50 })
      const leaveTypes: string[] = (typesRes.data || []).map((lt: any) => lt.name)
      const results = await Promise.all(
        leaveTypes.map(async (lt) => {
          try {
            const res = await frappeClient.call<{ balance: number; leave_type: string }>(
              'base_meena.hr_management.leave_api.get_leave_balance',
              { employee: effectiveEmployeeId, leave_type: lt }
            )
            return { leave_type: lt, balance: Number(res?.message?.balance ?? 0) }
          } catch {
            return { leave_type: lt, balance: 0 }
          }
        })
      )
      setLeaveBalances(results)
    } catch (err) {
      console.error('Failed to load leave balances:', err)
      setLeaveBalances([])
    } finally {
      setLoadingLeaveBalances(false)
    }
  }

  // Load leave balances once the Custody & Leaves section is available (edit mode).
  useEffect(() => {
    if (effectiveEmployeeId && leaveBalances.length === 0 && !loadingLeaveBalances) {
      loadLeaveBalances()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveEmployeeId])

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setSaveResult({ success: false, message: tr.imageTypeError })
      return
    }

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      setSaveResult({ success: false, message: tr.imageSizeError })
      return
    }

    setUploadingImage(true)
    setSaveResult(null)

    try {
      // Create preview
      const reader = new FileReader()
      reader.onloadend = () => {
        setImagePreview(reader.result as string)
      }
      reader.readAsDataURL(file)

      // Upload to Frappe
      const formData = new FormData()
      formData.append('file', file)
      formData.append('is_private', '0')
      // Link the file to the Employee doctype if editing an existing employee
      if (employeeId) {
        formData.append('doctype', 'Employee')
        formData.append('docname', employeeId)
        formData.append('fieldname', 'image')
      }

      // Frappe rejects cookie-authenticated POSTs without the CSRF token; the proxy
      // only forwards whatever X-Frappe-CSRF-Token the client sends.
      const csrfCookie = document.cookie.split(';').map(c => c.trim())
        .find(c => c.startsWith('csrftoken=') || c.startsWith('csrf_token='))
      const csrfToken = csrfCookie ? decodeURIComponent(csrfCookie.split('=')[1]) : ''

      const response = await fetch(frappeApiUrl('/api/method/upload_file'), {
        method: 'POST',
        credentials: 'include',
        headers: csrfToken ? { 'X-Frappe-CSRF-Token': csrfToken } : {},
        body: formData,
      })

      if (!response.ok) {
        const errText = await response.text().catch(() => '')
        throw new Error(`Failed to upload image (HTTP ${response.status})${errText ? ': ' + errText.slice(0, 200) : ''}`)
      }

      const data = await response.json()
      if (data.message?.file_url) {
        updateField('image', data.message.file_url)
        setSaveResult({ success: true, message: tr.imageUploaded })
      }
    } catch (error) {
      console.error('Image upload failed:', error)
      setSaveResult({ success: false, message: tr.imageFailed })
      setImagePreview('')
      // Also clear form.image to keep state consistent
      updateField('image', '')
    } finally {
      setUploadingImage(false)
    }
  }

  const validateForm = (): Record<string, string> => {
    const errors: Record<string, string> = {}

    if (!form.first_name.trim()) errors.first_name = tr.firstNameRequired
    if (!form.gender) errors.gender = tr.genderRequired
    if (!form.date_of_birth) errors.date_of_birth = tr.dobRequired
    if (!form.date_of_joining) errors.date_of_joining = tr.dojRequired
    if (form.date_of_birth && form.date_of_joining && form.date_of_joining <= form.date_of_birth) {
      errors.date_of_joining = tr.dojAfterDob
    }
    if (!form.company) errors.company = tr.companyRequired
    if (!form.custom_nationality) errors.custom_nationality = tr.nationalityRequired

    const intervalNumber = Number(form.interval_number)
    if (!Number.isFinite(intervalNumber) || intervalNumber <= 0) {
      errors.interval_number = tr.intervalRequired
    }

    if (form.enable_tracking && !form.employee_consent) {
      errors.employee_consent = tr.consentRequired
    }

    // Validate user account fields if creating user
    if (form.create_user_account) {
      // Email is optional — only validate format if provided
      if (form.user_email && form.user_email.trim()) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        if (!emailRegex.test(form.user_email)) {
          errors.user_email = tr.emailInvalid
        }
      }
      // Without an address there is no welcome mail to send, so a password is
      // the only way in — a typed one is held to the same rules. Leaving it
      // empty is not an error though: it just means no login, and the save
      // says so instead of failing.
      if (form.set_password_directly || (!form.user_email.trim() && form.user_password)) {
        const password = form.user_password?.trim()
        if (!password || password.length < 8) {
          errors.user_password = tr.passwordMin
        } else if (!/[A-Z]/.test(password)) {
          errors.user_password = tr.passwordNeedUpper
        } else if (!/[a-z]/.test(password)) {
          errors.user_password = tr.passwordNeedLower
        } else if (!/[0-9]/.test(password)) {
          errors.user_password = tr.passwordNeedNumber
        } else if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
          errors.user_password = tr.passwordNeedSpecial
        }
      }
    }

    return errors
  }

  // Helper: error border class for inputs/selects
  const errorBorder = (field: string) =>
    fieldErrors[field] ? 'border-red-500 ring-1 ring-red-500' : ''

  // Clear field error when user edits that field
  const clearFieldError = (field: string) => {
    if (fieldErrors[field]) {
      setFieldErrors(prev => {
        const next = { ...prev }
        delete next[field]
        return next
      })
    }
  }

  const handleSave = async () => {
    const errors = validateForm()
    setFieldErrors(errors)
    if (Object.keys(errors).length > 0) {
      const fieldNames: Record<string, string> = {
        first_name: tr.firstName, gender: tr.gender, date_of_birth: tr.dateOfBirth,
        date_of_joining: tr.dateOfJoining, company: tr.company, interval_number: tr.intervalNumber,
        employee_consent: tr.employeeConsent, user_email: tr.userEmail, user_password: tr.password
      }
      const missingFields = Object.keys(errors).map(k => fieldNames[k] || k).join(', ')
      setSaveResult({ success: false, message: `${tr.pleaseFixFields} ${missingFields}` })
      // Scroll to first error field
      const firstErrorField = Object.keys(errors)[0]
      const el = document.querySelector(`[data-field="${firstErrorField}"]`)
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      return
    }

    // Optional employment contract: end date must be on/after the start (defaults to joining)
    if (!employeeId && form.contract_enabled && form.contract_type !== 'Permanent' && form.contract_end_date) {
      const cStart = form.contract_start_date || form.date_of_joining
      if (cStart && form.contract_end_date < cStart) {
        setSaveResult({ success: false, message: tr.contractEndBeforeStart })
        return
      }
    }

    // Non-Compete clause: when enabled, duration (1–24 months) AND scope/activity are required.
    if (!employeeId && form.contract_enabled && form.contract_non_compete) {
      const ncDur = Number(form.contract_non_compete_duration)
      const ncInvalid = form.contract_non_compete_duration === '' || !(ncDur >= 1 && ncDur <= 24) || !form.contract_non_compete_scope.trim()
      if (ncInvalid) {
        setSaveResult({ success: false, message: tr.nonCompeteIncomplete })
        document.getElementById('section-contract')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
        return
      }
    }

    setSaving(true)
    setSaveResult(null)

    try {
      const payload: any = {
        first_name: form.first_name,
        last_name: form.last_name || undefined,
        middle_name: form.middle_name || undefined,
        gender: form.gender,
        date_of_birth: form.date_of_birth,
        date_of_joining: form.date_of_joining,
        company: form.company,
        status: form.status,
      }

      // Optional fields
      if (form.department) payload.department = form.department
      if (form.designation) payload.designation = form.designation
      if (form.employment_mode) payload.custom_employment_mode = form.employment_mode
      if (form.branch) payload.branch = form.branch
      if (form.cell_number) payload.cell_number = form.cell_number
      if (form.personal_email) payload.personal_email = form.personal_email
      if (form.company_email) payload.company_email = form.company_email
      if (form.image) payload.image = form.image
      if (form.default_shift) payload.default_shift = form.default_shift
      if (form.custom_national_id) payload.custom_national_id = form.custom_national_id
      if (form.custom_id_type) payload.custom_id_type = form.custom_id_type
      if (form.custom_id_issue_date) payload.custom_id_issue_date = form.custom_id_issue_date
      if (form.custom_id_expiry_date) payload.custom_id_expiry_date = form.custom_id_expiry_date
      // Personal — extra
      if (form.custom_nationality) payload.custom_nationality = form.custom_nationality
      if (form.custom_arrival_date) payload.custom_arrival_date = form.custom_arrival_date
      if (form.custom_duty_start_date) payload.custom_duty_start_date = form.custom_duty_start_date
      // Employment — reporting line (drives the org chart) / branch manager / vehicle
      payload.reports_to = form.reports_to || ''
      payload.custom_is_branch_manager = form.custom_is_branch_manager ? 1 : 0
      if (form.custom_is_branch_manager && form.custom_managed_branch) payload.custom_managed_branch = form.custom_managed_branch
      // Vehicle: the DB flag custom_has_company_vehicle stays true only for company-owned cars
      const hasVehicle = form.custom_has_company_vehicle
      payload.custom_has_company_vehicle = hasVehicle && form.custom_vehicle_ownership === 'Company-Owned' ? 1 : 0
      payload.custom_vehicle_plate = hasVehicle ? (form.custom_vehicle_plate || '') : ''
      payload.custom_vehicle_model = hasVehicle ? (form.custom_vehicle_model || '') : ''
      payload.custom_vehicle_ownership = hasVehicle ? (form.custom_vehicle_ownership || '') : ''
      // Contact — addresses
      if (form.current_address) payload.current_address = form.current_address
      if (form.permanent_address) payload.permanent_address = form.permanent_address
      // Contact — home location
      if (form.custom_home_address) payload.custom_home_address = form.custom_home_address
      if (form.custom_home_latitude) payload.custom_home_latitude = Number(form.custom_home_latitude)
      if (form.custom_home_longitude) payload.custom_home_longitude = Number(form.custom_home_longitude)
      // Contact — emergency contacts
      if (form.person_to_be_contacted) payload.person_to_be_contacted = form.person_to_be_contacted
      if (form.relation) payload.relation = form.relation
      if (form.emergency_phone_number) payload.emergency_phone_number = form.emergency_phone_number
      if (form.custom_emergency_2_name) payload.custom_emergency_2_name = form.custom_emergency_2_name
      if (form.custom_emergency_2_relation) payload.custom_emergency_2_relation = form.custom_emergency_2_relation
      if (form.custom_emergency_2_phone) payload.custom_emergency_2_phone = form.custom_emergency_2_phone
      if (form.custom_emergency_3_name) payload.custom_emergency_3_name = form.custom_emergency_3_name
      if (form.custom_emergency_3_relation) payload.custom_emergency_3_relation = form.custom_emergency_3_relation
      if (form.custom_emergency_3_phone) payload.custom_emergency_3_phone = form.custom_emergency_3_phone

      console.log('📤 Payload being sent to backend:', payload)

      let result
      let successMessage = ''
      const locationSettingsPayload = {
        checkin_method: form.checkin_method,
        enable_tracking: form.enable_tracking ? 1 : 0,
        employee_consent: form.employee_consent ? 1 : 0,
        tracking_interval: form.tracking_interval || 'Minutes',
        interval_number: Number(form.interval_number) > 0 ? Number(form.interval_number) : 5,
      }

      // Use the effective id (prop OR a just-created employee) so re-saving after a
      // post-create switch performs an UPDATE instead of creating a duplicate.
      const existingId = effectiveEmployeeId
      if (existingId) {
        // Update existing employee
        result = await frappeClient.updateEmployee(existingId, payload)
        if (!result) throw new Error('Failed to update employee — server returned empty response')
        successMessage = `"${result.employee_name}" ${tr.updated}`

        // Update check-in method in Employee Location Settings
        if (form.checkin_method) {
          try {
            console.log('💾 Updating location settings:', locationSettingsPayload)
            const locationSettingsExists = await frappeClient.get('Employee Location Settings', existingId)

            if (locationSettingsExists.data) {
              // Update existing
              await frappeClient.put('Employee Location Settings', existingId, {
                ...locationSettingsPayload
              })
              console.log('✅ Updated existing location settings')
            }
          } catch (err: any) {
            // Create new if doesn't exist (404 or DoesNotExistError)
            const errorMsg = err.message?.toLowerCase() || ''
            const isNotFound = errorMsg.includes('404') ||
              errorMsg.includes('not found') ||
              errorMsg.includes('doesnotexist')

            if (isNotFound) {
              console.log('📝 Creating new location settings')
              try {
                await frappeClient.post('Employee Location Settings', {
                  employee: existingId,
                  ...locationSettingsPayload
                })
                console.log('✅ Created new location settings')
              } catch (createErr) {
                console.error('❌ Failed to create location settings:', createErr)
                successMessage += '\n\n⚠️ Note: Check-in method not saved. Please set it in Employee Location Settings manually.'
              }
            } else {
              console.error('❌ Error updating location settings:', err)
              successMessage += '\n\n⚠️ Note: Check-in method may not be saved.'
            }
          }
        }

        // Update salary assignment for existing employee
        const editBaseSalary = Number(form.base_salary)
        if (Number.isFinite(editBaseSalary) && editBaseSalary > 0) {
          try {
            if (currentSalaryAssignmentName) {
              let editCurrency = 'SAR'
              try {
                const ssRes = await frappeClient.get('Salary Structure', currentSalaryStructureName, { fields: ['currency'] })
                editCurrency = ssRes.data?.currency || 'SAR'
              } catch {}
              try {
                await frappeClient.call('frappe.client.cancel', {
                  doctype: 'Salary Structure Assignment', name: currentSalaryAssignmentName,
                })
              } catch {}
              const newAssignment = await frappeClient.createSalaryStructureAssignment({
                employee: existingId,
                salary_structure: currentSalaryStructureName,
                from_date: form.date_of_joining,
                company: form.company,
                currency: editCurrency,
                base: editBaseSalary,
              })
              if (newAssignment?.name) {
                try {
                  const aRes = await frappeClient.get('Salary Structure Assignment', newAssignment.name)
                  if (aRes.data) {
                    await frappeClient.call('frappe.client.submit', {
                      doc: { ...aRes.data, doctype: 'Salary Structure Assignment' },
                    })
                  }
                } catch (submitErr) {
                  console.warn('Failed to submit salary structure assignment:', submitErr)
                }
              }
              successMessage += `\n\n✅ ${tr.salaryAssignmentUpdated || 'Salary updated successfully.'}`
            } else {
              const isCompatibilityError = (error: unknown, fieldName: string) => {
                const message = error instanceof Error ? error.message : String(error)
                return new RegExp(`unknown column|unknown field|invalid field|cannot resolve field|${fieldName}`, 'i').test(message)
              }

              const getStructures = async (filters?: any[]) => {
                try {
                  return await frappeClient.getSalaryStructures({ fields: ['name', 'company', 'is_active'], filters })
                } catch (error) {
                  if (filters?.length && isCompatibilityError(error, 'company')) {
                    return getStructures()
                  }
                  if (!isCompatibilityError(error, 'is_active')) {
                    throw error
                  }
                  try {
                    const fallback = await frappeClient.getSalaryStructures({ fields: ['name', 'company'], filters })
                    return fallback.map((s: any) => ({ ...s, is_active: 1 }))
                  } catch (fallbackError) {
                    if (filters?.length && isCompatibilityError(fallbackError, 'company')) {
                      const fallback = await frappeClient.getSalaryStructures({ fields: ['name', 'company'] })
                      return fallback.map((s: any) => ({ ...s, is_active: 1 }))
                    }
                    throw fallbackError
                  }
                }
              }

              let allStructures = await getStructures(
                form.company ? [['Salary Structure', 'company', '=', form.company]] : undefined
              )
              if (!allStructures.length) allStructures = await getStructures()

              let structure = allStructures.find((s: any) => form.company && s.company === form.company && s.is_active)
                || allStructures.find((s: any) => form.company && s.company === form.company)
                || allStructures.find((s: any) => s.is_active)
                || allStructures[0]

              if (!structure) {
                try {
                  try { await frappeClient.getSalaryComponent('Basic Salary') } catch {
                    await frappeClient.createSalaryComponent({
                      salary_component: 'Basic Salary', type: 'Earning', salary_component_abbr: 'BS',
                    })
                  }
                  let editCurrency = 'SAR'
                  try {
                    const cRes = await frappeClient.get('Company', form.company, { fields: ['default_currency'] })
                    editCurrency = cRes.data?.default_currency || 'SAR'
                  } catch {}
                  const sData: Record<string, any> = {
                    __newname: `Default Structure - ${form.company}`,
                    company: form.company,
                    currency: editCurrency,
                    payroll_frequency: 'Monthly', is_active: 'Yes',
                    earnings: [{ salary_component: 'Basic Salary', amount_based_on_formula: 1, formula: 'base' }],
                  }
                  const created = await frappeClient.createSalaryStructure(sData)
                  if (created?.name) {
                    try {
                      const docRes = await frappeClient.get('Salary Structure', created.name)
                      if (docRes.data) {
                        await frappeClient.call('frappe.client.submit', {
                          doc: { ...docRes.data, doctype: 'Salary Structure' },
                        })
                      }
                    } catch (submitErr) {
                      console.warn('Failed to submit salary structure:', submitErr)
                    }
                  }
                  structure = created
                } catch (createErr) {
                  console.error('Failed to auto-create salary structure:', createErr)
                }
              }

              if (structure?.name) {
                let assignmentCurrency = 'SAR'
                try {
                  const ssRes = await frappeClient.get('Salary Structure', structure.name, { fields: ['currency'] })
                  assignmentCurrency = ssRes.data?.currency || 'SAR'
                } catch {}
                const newAssignment = await frappeClient.createSalaryStructureAssignment({
                  employee: existingId,
                  salary_structure: structure.name,
                  from_date: form.date_of_joining,
                  company: form.company,
                  currency: assignmentCurrency,
                  base: editBaseSalary,
                })
                if (newAssignment?.name) {
                  try {
                    const aRes = await frappeClient.get('Salary Structure Assignment', newAssignment.name)
                    if (aRes.data) {
                      await frappeClient.call('frappe.client.submit', {
                        doc: { ...aRes.data, doctype: 'Salary Structure Assignment' },
                      })
                    }
                  } catch (submitErr) {
                    console.warn('Failed to submit salary structure assignment:', submitErr)
                  }
                }
                successMessage += `\n\n✅ ${tr.salaryAssignmentCreated}`
              } else {
                successMessage += `\n\n⚠️ ${tr.salaryAssignmentNoStructure}`
              }
            }
          } catch (salaryError) {
            console.error('Failed to update salary assignment:', salaryError)
            const details = salaryError instanceof Error ? salaryError.message : String(salaryError)
            successMessage += `\n\n⚠️ ${tr.salaryAssignmentFailed} ${details}`
          }
        }
      } else {
        // Create new employee
        result = await frappeClient.createEmployee(payload)
        if (!result) throw new Error('Failed to create employee — server returned empty response. Check backend logs for details.')
        successMessage = `"${result.employee_name}" ${tr.created} (ID: ${result.name})`

        // Create base salary assignment automatically if provided on employee creation.
        const baseSalary = Number(form.base_salary)
        if (Number.isFinite(baseSalary) && baseSalary > 0) {
          try {
            const isCompatibilityError = (error: unknown, fieldName: string) => {
              const message = error instanceof Error ? error.message : String(error)
              return new RegExp(`unknown column|unknown field|invalid field|cannot resolve field|${fieldName}`, 'i').test(message)
            }

            const getStructures = async (filters?: any[]) => {
              try {
                return await frappeClient.getSalaryStructures({ fields: ['name', 'company', 'is_active'], filters })
              } catch (error) {
                if (filters?.length && isCompatibilityError(error, 'company')) {
                  return getStructures()
                }

                if (!isCompatibilityError(error, 'is_active')) {
                  throw error
                }

                try {
                  const fallback = await frappeClient.getSalaryStructures({ fields: ['name', 'company'], filters })
                  return fallback.map((structure: any) => ({ ...structure, is_active: 1 }))
                } catch (fallbackError) {
                  if (filters?.length && isCompatibilityError(fallbackError, 'company')) {
                    const fallback = await frappeClient.getSalaryStructures({ fields: ['name', 'company'] })
                    return fallback.map((structure: any) => ({ ...structure, is_active: 1 }))
                  }
                  throw fallbackError
                }
              }
            }

            const companyFilters = form.company ? [['Salary Structure', 'company', '=', form.company]] : undefined
            const companyStructures = await getStructures(companyFilters)
            const allStructures = companyStructures.length ? companyStructures : await getStructures()

            let selectedStructure =
              allStructures.find((structure: any) => form.company && structure.company === form.company && structure.is_active)
              || allStructures.find((structure: any) => form.company && structure.company === form.company)
              || allStructures.find((structure: any) => !structure.company && structure.is_active)
              || allStructures.find((structure: any) => structure.is_active)
              || allStructures[0]

            if (!selectedStructure) {
              try {
                try { await frappeClient.getSalaryComponent('Basic Salary') } catch {
                  await frappeClient.createSalaryComponent({
                    salary_component: 'Basic Salary', type: 'Earning', salary_component_abbr: 'BS',
                  })
                }
                let newCurrency = 'SAR'
                try {
                  const cRes = await frappeClient.get('Company', form.company, { fields: ['default_currency'] })
                  newCurrency = cRes.data?.default_currency || 'SAR'
                } catch {}
                const sData: Record<string, any> = {
                  __newname: `Default Structure - ${form.company}`,
                  company: form.company,
                  currency: newCurrency,
                  payroll_frequency: 'Monthly', is_active: 'Yes',
                  earnings: [{ salary_component: 'Basic Salary' }],
                }
                const created = await frappeClient.createSalaryStructure(sData)
                if (created?.name) {
                  try {
                    const docRes = await frappeClient.get('Salary Structure', created.name)
                    if (docRes.data) {
                      await frappeClient.call('frappe.client.submit', {
                        doc: { ...docRes.data, doctype: 'Salary Structure' },
                      })
                    }
                  } catch (submitErr) {
                    console.warn('Failed to submit salary structure:', submitErr)
                  }
                }
                selectedStructure = created
              } catch (createErr) {
                console.error('Failed to auto-create salary structure:', createErr)
              }
            }

            if (selectedStructure?.name) {
              let assignmentCurrency = 'SAR'
              try {
                const ssRes = await frappeClient.get('Salary Structure', selectedStructure.name, { fields: ['currency'] })
                assignmentCurrency = ssRes.data?.currency || 'SAR'
              } catch {}
              const newAssignment = await frappeClient.createSalaryStructureAssignment({
                employee: result.name,
                salary_structure: selectedStructure.name,
                from_date: form.date_of_joining,
                company: form.company,
                currency: assignmentCurrency,
                base: baseSalary,
              })
              if (newAssignment?.name) {
                try {
                  const aRes = await frappeClient.get('Salary Structure Assignment', newAssignment.name)
                  if (aRes.data) {
                    await frappeClient.call('frappe.client.submit', {
                      doc: { ...aRes.data, doctype: 'Salary Structure Assignment' },
                    })
                  }
                } catch (submitErr) {
                  console.warn('Failed to submit salary structure assignment:', submitErr)
                }
              }
              successMessage += `\n\n✅ ${tr.salaryAssignmentCreated}`
            } else {
              successMessage += `\n\n⚠️ ${tr.salaryAssignmentNoStructure}`
            }
          } catch (salaryError) {
            console.error('Failed to create salary assignment:', salaryError)
            const details = salaryError instanceof Error ? salaryError.message : String(salaryError)
            successMessage += `\n\n⚠️ ${tr.salaryAssignmentFailed} ${details}`
          }
        }

        // Persist check-in method / tracking settings for the new employee.
        // (Nothing on the backend auto-creates this — the old comment claiming so was wrong.)
        try {
          await frappeClient.post('Employee Location Settings', {
            employee: result.name,
            ...locationSettingsPayload,
          })
        } catch (locErr) {
          console.error('❌ Failed to create location settings for new employee:', locErr)
          successMessage += '\n\n⚠️ Note: Check-in method not saved. Please set it in Employee Location Settings manually.'
        }
      }

      // Create / replace the employee's login account, if requested.
      //
      // Every mutating request here MUST go through frappeClient: it attaches the
      // X-Frappe-CSRF-Token header (and re-fetches the token on a 400 CSRFTokenError).
      // These calls used a bare fetch() before, so Frappe rejected each one with
      // 400 "Invalid Request" *before* the endpoint ran — the account was never
      // created, the employee silently kept its old user_id, and the save still
      // reported success.
      let userAccountError = ''
      // An address is no longer what makes a login possible: with none typed the
      // backend keys the account to an internal placeholder and the employee
      // signs in with their national/iqama number. A password is then the only
      // way in, so without one there is simply no account — said out loud
      // instead of the silence this used to produce.
      const typedEmail = form.user_email.trim()
      if (form.create_user_account && !typedEmail && !form.user_password) {
        successMessage += `\n\nℹ️ ${tr.loginSkippedNoPassword}`
      }
      if (form.create_user_account && (typedEmail || form.user_password)) {
        const targetEmail = typedEmail

        const isDuplicateUserError = (err: unknown) => {
          const msg = err instanceof Error ? err.message : String(err)
          return /DuplicateEntryError|Duplicate entry|PRIMARY/i.test(msg)
        }

        // Clear a leftover User that belongs to no employee so its address can be
        // reused. Returns true only when the address is free to take.
        const freeUpOrphanUser = async (email: string): Promise<boolean> => {
          // Generated placeholders are unique per employee — nothing to free up.
          if (!email) return false
          try {
            const existing = await frappeClient.getList<{ name: string }>('User', {
              fields: ['name'],
              filters: [['User', 'name', '=', email]],
              limit_page_length: 1,
            })
            if (!existing.length) return true // nothing occupying the address

            const linked = await frappeClient.getList<{ name: string; employee_name: string }>('Employee', {
              fields: ['name', 'employee_name'],
              filters: [['Employee', 'user_id', '=', email], ['Employee', 'name', '!=', result.name]],
              limit_page_length: 1,
            })
            if (linked.length) {
              userAccountError = `"${email}" ${tr.userAccountLinkedElsewhere}: ${linked[0].employee_name} (${linked[0].name}). ${tr.userAccountUseAnotherEmail}`
              return false
            }

            await frappeClient.delete('User', email)
            return true
          } catch (err) {
            console.error('Failed to free up orphan user:', err)
            return false
          }
        }

        // Run the creation, and retry once after clearing an orphan User that only
        // exists because an earlier attempt half-finished.
        const createAccount = async <T,>(run: () => Promise<T>): Promise<T> => {
          try {
            return await run()
          } catch (err) {
            if (!isDuplicateUserError(err)) throw err
            if (!(await freeUpOrphanUser(targetEmail))) throw err
            return await run()
          }
        }

        try {
          if (form.user_password) {
            // Set the password ourselves — the employee can sign in immediately.
            const created = await createAccount(() => frappeClient.call<{ email?: string; login_id?: string }>(
              'hrms.hr.doctype.employee.employee_user_api.create_user_for_employee',
              // Omitting the address is what triggers the placeholder + id login.
              { employee: result.name, email: targetEmail || undefined, password: form.user_password },
            ))
            const createdSignInName = created?.login_id || created?.email || targetEmail
            successMessage += `\n\n✅ ${tr.userAccountReady}\n${tr.loginIdIs}: ${createdSignInName}\n${tr.password}: ${form.user_password}\n\n⚠️ ${tr.userAccountSavePassword}`
          } else {
            // Frappe mails a welcome message carrying a password-reset link.
            await createAccount(() => frappeClient.call(
              'erpnext.setup.doctype.employee.employee.create_user',
              { employee: result.name, email: targetEmail },
            ))
            successMessage += `\n\n✅ ${tr.userAccountReady}\n${tr.userAccountUsername}: ${targetEmail}\n📧 ${tr.userAccountWelcomeSent}`
          }

          // Account is saved — drop the plaintext password from state and collapse
          // the section so a second save doesn't resubmit it.
          setForm(prev => ({ ...prev, create_user_account: false, set_password_directly: false, user_password: '', user_email: targetEmail }))
        } catch (userError: any) {
          console.error('❌ User account error:', userError)
          if (!userAccountError) userAccountError = userError?.message || String(userError)
        }
      }

      // Create shift assignment if default shift selected (only for new employees)
      if (!employeeId && form.default_shift) {
        try {
          await frappeClient.call('frappe.client.insert', {
            doctype: 'Shift Assignment',
            employee: result.name,
            shift_type: form.default_shift,
            start_date: form.date_of_joining,
            status: 'Active',
            company: form.company
          })
        } catch (shiftError) {
          console.error('Failed to create shift assignment:', shiftError)
          // Notify user that shift assignment failed (employee was still created)
          setSaveResult(prev => ({
            success: prev?.success ?? true,
            message: (prev?.message || '') + '. ' + (tr.shiftAssignmentFailed || 'Warning: Shift assignment could not be created.'),
          }))
        }
      }

      // Create an OPTIONAL employment contract if the section was filled (new employees
      // only). NON-BLOCKING: a contract failure must never break the employee save —
      // we only append a warning to the success message.
      if (!employeeId && contractFeatureAvailable && form.contract_enabled) {
        try {
          const num = (v: string) => { const n = Number(v); return (v !== '' && Number.isFinite(n)) ? n : undefined }
          await frappeClient.call('base_meena.employment_contract_api.create_contract', {
            employee: result.name,
            company: form.company || undefined,
            designation: form.designation || undefined,
            contract_type: form.contract_type || undefined,
            contract_start_date: form.contract_start_date || form.date_of_joining || undefined,
            // Permanent contracts have no end date.
            contract_end_date: (form.contract_type !== 'Permanent' && form.contract_end_date) ? form.contract_end_date : undefined,
            basic_salary: num(form.base_salary),            // pre-filled from "الراتب الأساسي"
            housing_allowance: num(form.contract_housing_allowance),
            transport_allowance: num(form.contract_transport_allowance),
            other_allowance: num(form.contract_other_allowance),
            probation_period_months: num(form.contract_probation_months),
            notice_period_days: num(form.contract_notice_days),
            annual_leave_days: num(form.contract_annual_leave_days),
            working_hours_per_day: num(form.contract_working_hours),
            status: form.contract_status || 'Draft',
            // Expanded (Saudi-labor-law-aligned) fields — accepted by the kwargs API as-is
            skill_level: form.contract_skill_level || undefined,
            auto_renew: form.contract_auto_renew ? 1 : 0,
            renewal_term_months: form.contract_auto_renew ? num(form.contract_renewal_term) : undefined,
            work_location: form.contract_work_location || undefined,
            work_days: form.contract_work_days || undefined,
            weekly_rest_day: form.contract_weekly_rest_day || undefined,
            gosi_deduction: num(form.contract_gosi_deduction),
            salary_payment_day: num(form.contract_salary_payment_day),
            clause_confidentiality: form.contract_confidentiality ? 1 : 0,
            clause_non_compete: form.contract_non_compete ? 1 : 0,
            non_compete_duration: form.contract_non_compete ? num(form.contract_non_compete_duration) : undefined,
            non_compete_scope: form.contract_non_compete ? (form.contract_non_compete_scope || undefined) : undefined,
            clause_ip: form.contract_ip ? 1 : 0,
            clause_mobility: form.contract_mobility ? 1 : 0,
            clause_remote_work: form.contract_remote_work ? 1 : 0,
            clause_training: form.contract_training ? 1 : 0,
            training_commitment: form.contract_training ? (form.contract_training_details || undefined) : undefined,
          })
          successMessage += '\n\n' + tr.contractCreated
        } catch (contractError) {
          console.error('Failed to create employment contract:', contractError)
          successMessage += '\n\n' + tr.contractFailed
        }
      }

      // Sync employee image to User doctype so header avatar updates system-wide
      if (form.image && result?.name) {
        try {
          await frappeClient.call('base_meena.employee_documents_api.update_employee_image', {
            employee: result.name,
            image_url: form.image,
          })
          console.log('✅ User avatar synced system-wide via update_employee_image')
          // Refresh auth context so the header shows the new image immediately
          await refreshUser()
        } catch (syncErr) {
          console.error('⚠️ Failed to sync user avatar, trying fallback:', syncErr)
          // Fallback: try direct User update
          const linkedUser = result?.user_id || form.user_email
          if (linkedUser) {
            try {
              await updateDoc('User', linkedUser, { user_image: form.image })
              await refreshUser()
            } catch (e) { console.error('⚠️ Fallback sync also failed:', e) }
          }
        }
      }

      // The employee row itself saved, but a failed login-account change is the whole
      // point of the edit for HR — report it as a failure instead of a green banner.
      setSaveResult(
        userAccountError
          ? { success: false, message: `${successMessage}\n\n❌ ${tr.userAccountFailed}\n${userAccountError}` }
          : { success: true, message: successMessage }
      )
      setIsDirty(false)

      if (!effectiveEmployeeId && result?.name) {
        // CREATE flow (genuine first create): switch the form into edit mode for the
        // new employee — the Documents & Custody sections appear below so HR can
        // immediately upload contract / ID / Iqama / passport. No auto-navigate back.
        setCreatedEmployeeId(result.name)
        window.scrollTo({ top: 0, behavior: 'smooth' })
      } else if (!userAccountError) {
        // EDIT flow: navigate back after delay — use ref-tracked timer for cleanup on unmount
        saveTimerRef.current = setTimeout(() => {
          onBack()
        }, 3000)
      }
    } catch (error: any) {
      console.error('❌ Save error:', error)
      // Try to extract meaningful error from Frappe response
      let msg = error?.message || 'Unknown error occurred'
      if (error?.exc_type) msg = `${error.exc_type}: ${msg}`
      if (msg.includes('Cannot read properties of null')) {
        msg = 'Server returned empty response. The employee may not have been created — check backend logs.'
      }
      setSaveResult({ success: false, message: `Error: ${msg}` })
    } finally {
      setSaving(false)
    }
  }

  // Sticky section-nav items (Contract only appears for a new employee with the feature).
  const formSections = [
    { id: 'section-personal', label: tr.personalDetails },
    { id: 'section-company', label: tr.companyDetails },
    { id: 'section-contact', label: tr.contactInfo },
    { id: 'section-family', label: tr.familySection },
    { id: 'section-work', label: tr.workSettings },
    ...((!employeeId && (contractFeatureAvailable || form.contract_enabled)) ? [{ id: 'section-contract', label: tr.contractSection }] : []),
  ]
  // Live-summary values
  // User email blocks Save whenever a login account is being created, yet it was
  // absent from this checklist — so the tracker could read "complete" while Save
  // Nationality is required now, email is completely optional.
  // What the employee types to sign in when they have no address: their
  // national/iqama number, falling back to the employee id once the record
  // exists. Mirrors `login_id_for` on the server, four characters minimum, so a
  // row number like "22" is never mistaken for an identity.
  const signInName = [form.custom_national_id, employeeId]
    .map((v) => String(v || '').replace(/[^A-Za-z0-9]/g, ''))
    .find((v) => v.length >= 4) || ''

  const requiredItems = [
    { ok: !!form.first_name, label: tr.firstName, field: 'first_name' },
    { ok: !!form.gender, label: tr.gender, field: 'gender' },
    { ok: !!form.date_of_birth, label: tr.dateOfBirth, field: 'date_of_birth' },
    { ok: !!form.date_of_joining, label: tr.dateOfJoining, field: 'date_of_joining' },
    { ok: !!form.company, label: tr.company, field: 'company' },
    { ok: !!form.custom_nationality, label: tr.nationality, field: 'custom_nationality' },
  ]
  const requiredDone = requiredItems.filter((r) => r.ok).length
  const requiredPct = requiredItems.length ? Math.round((requiredDone / requiredItems.length) * 100) : 0
  // Click a tracker item → scroll its field into view and focus it. Reuses the
  // same [data-field] anchors the submit-validation scroll-to-error uses.
  const jumpToField = (field: string) => {
    if (typeof document === 'undefined') return
    const el = document.querySelector(`[data-field="${field}"]`)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      const input = el.querySelector('input, select, textarea') as HTMLElement | null
      if (input) window.setTimeout(() => { try { input.focus({ preventScroll: true }) } catch { /* ignore */ } }, 300)
    }
  }
  const contractTypeSummary = !form.contract_enabled
    ? tr.sumNotSet
    : (({ Permanent: tr.ctPermanent, 'Fixed Term': tr.ctFixedTerm, Probation: tr.ctProbation, 'Part-time': tr.ctPartTime } as Record<string, string>)[form.contract_type] || tr.sumNotSet)

  return (
    <>
      <div className="p-6 max-w-6xl mx-auto" dir={isRTL ? 'rtl' : 'ltr'}>
        {/* Sticky action bar — Save / Cancel always reachable */}
        <div className="sticky top-0 z-30 -mx-6 -mt-6 mb-6 px-6 py-4 bg-background/95 backdrop-blur-sm border-b border-border flex items-center justify-between gap-3">
          <div className="flex items-center gap-4 min-w-0">
            <Button aria-label="رجوع" title="رجوع" variant="ghost" size="icon" onClick={() => guardedNavigate(onBack)} className="hover:bg-muted flex-shrink-0">
              <ArrowLeft className={`h-5 w-5 ${isRTL ? 'rotate-180' : ''}`} />
            </Button>
            <div className="min-w-0">
              <h1 className="text-xl font-bold text-foreground truncate">{employeeId ? tr.editEmployee : tr.newEmployee}</h1>
              <p className="text-muted-foreground text-xs mt-0.5 truncate">{employeeId ? tr.editSubtitle : tr.newSubtitle}</p>
            </div>
          </div>
          <div className="flex gap-2 flex-shrink-0">
            <Button variant="outline" onClick={() => guardedNavigate(onBack)}>{tr.cancel}</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <><Loader2 className={`h-4 w-4 ${isRTL ? 'ms-2' : 'me-2'} animate-spin`} /> {tr.saving}</> : <><Save className={`h-4 w-4 ${isRTL ? 'ms-2' : 'me-2'}`} /> {tr.saveEmployee}</>}
            </Button>
          </div>
        </div>

        {/* Save Result Message */}
        {saveResult && (
          <div className={`mb-6 p-4 rounded-lg flex items-center gap-3 ${saveResult.success
            ? 'bg-green-50 border border-green-200 text-green-800'
            : 'bg-red-50 border border-red-200 text-red-800'
            }`}>
            {saveResult.success
              ? <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0" />
              : <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0" />
            }
            <p className="text-sm">{saveResult.message}</p>
          </div>
        )}

        <div className="flex flex-col lg:flex-row gap-8 items-start">
          {/* Inline-END sticky panel: section nav + live summary + required + photo
              (order-2 places it on the logical-end side; logical props keep RTL correct). */}
          <aside className="w-full lg:w-72 lg:flex-shrink-0 lg:order-2 lg:sticky lg:top-24 lg:self-start space-y-4 lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto pb-1">
            {/* Section navigation — jump to section */}
            <nav className="bg-card rounded-xl border border-border p-3" aria-label={tr.sectionsHeading}>
              <p className="text-[11px] font-semibold text-muted-foreground px-2 mb-1">{tr.sectionsHeading}</p>
              <ul className="space-y-0.5">
                {formSections.map((s) => (
                  <li key={s.id}>
                    <button
                      type="button"
                      onClick={() => scrollToSection(s.id)}
                      aria-current={activeSection === s.id ? 'true' : undefined}
                      className={`w-full text-start text-sm rounded-md px-3 py-1.5 transition-colors ${activeSection === s.id ? 'bg-primary/10 text-primary font-semibold' : 'text-foreground/70 hover:bg-muted'}`}
                    >
                      {s.label}
                    </button>
                  </li>
                ))}
              </ul>
            </nav>

            {/* Live summary + required-fields checklist */}
            <div className="bg-card rounded-xl border border-border p-4 space-y-3">
              <p className="text-xs font-semibold text-foreground">{tr.summaryHeading}</p>
              <dl className="space-y-1.5 text-xs">
                <div className="flex items-center justify-between gap-2"><dt className="text-muted-foreground">{tr.company}</dt><dd className="font-medium text-foreground truncate max-w-[60%] text-end">{form.company || tr.sumNotSet}</dd></div>
                <div className="flex items-center justify-between gap-2"><dt className="text-muted-foreground">{tr.sumJob}</dt><dd className="font-medium text-foreground truncate max-w-[60%] text-end">{form.designation || tr.sumNotSet}</dd></div>
                <div className="flex items-center justify-between gap-2"><dt className="text-muted-foreground">{tr.sumContract}</dt><dd className="font-medium text-foreground truncate max-w-[60%] text-end">{contractTypeSummary}</dd></div>
              </dl>
              <div className="pt-2 border-t border-border">
                <div className="flex items-center justify-between mb-1.5">
                  <p className="text-[11px] font-semibold text-muted-foreground">{tr.requiredFields}</p>
                  <span className={`text-[11px] font-bold ${requiredDone === requiredItems.length ? 'text-emerald-600' : 'text-amber-600'}`}>{requiredDone}/{requiredItems.length}</span>
                </div>
                {/* Progress bar above the counter */}
                <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden mb-2">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${requiredDone === requiredItems.length ? 'bg-emerald-500' : 'bg-amber-400'}`}
                    style={{ width: `${requiredPct}%` }}
                  />
                </div>
                <ul className="space-y-1">
                  {requiredItems.map((r, i) => (
                    <li key={i}>
                      <button
                        type="button"
                        onClick={() => jumpToField(r.field)}
                        className="flex w-full items-center gap-2 rounded-md px-1 py-0.5 text-start text-xs transition-colors hover:bg-accent/60"
                        title={isRTL ? `الانتقال إلى: ${r.label}` : `Go to: ${r.label}`}
                      >
                        {r.ok
                          ? <CheckCircle className="h-3.5 w-3.5 text-emerald-500 flex-shrink-0" />
                          : <span className="h-3.5 w-3.5 rounded-full border-2 border-amber-400 flex-shrink-0" />}
                        <span className={r.ok ? 'text-muted-foreground' : 'text-foreground'}>{r.label}</span>
                      </button>
                    </li>
                  ))}
                </ul>
                {requiredDone === requiredItems.length && <p className="mt-2 text-[11px] text-emerald-600 font-medium">{tr.allRequiredComplete}</p>}
              </div>
            </div>

            {/* Profile photo */}
            <div className="bg-card p-6 rounded-xl border border-border text-center">
              <div className="w-28 h-28 bg-muted rounded-full mx-auto mb-4 flex items-center justify-center border-2 border-dashed border-border overflow-hidden relative group">
                {imagePreview || form.image ? (
                  <>
                    <img
                      src={imagePreview || frappeImageUrl(form.image)}
                      alt="Profile"
                      className="w-full h-full object-cover"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                    />
                    <div className="absolute inset-0 bg-black bg-opacity-50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <Upload className="h-6 w-6 text-white" />
                    </div>
                  </>
                ) : form.first_name ? (
                  <span className="text-3xl font-bold text-muted-foreground">
                    {form.first_name[0]}{form.last_name ? form.last_name[0] : ''}
                  </span>
                ) : (
                  <User className="h-10 w-10 text-muted-foreground" />
                )}
                <input
                  type="file"
                  aria-label={tr.clickToUpload}
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  disabled={uploadingImage}
                />
              </div>
              <p className="text-sm font-medium text-foreground">
                {uploadingImage ? tr.uploading : tr.profilePhoto}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {uploadingImage ? (
                  <Loader2 className="h-3 w-3 animate-spin inline" />
                ) : (
                  tr.clickToUpload
                )}
              </p>
            </div>
          </aside>

          {/* Form (inline-START / main) */}
          <div className="w-full lg:flex-1 lg:order-1 min-w-0 space-y-6">
            {/* Step 1 — Personal Details */}
            {/* Section — Personal Details */}
            <div className="bg-card rounded-xl border border-border shadow-sm p-6">
              <h2 id="section-personal" className="scroll-mt-28 text-lg font-bold text-foreground mb-5 flex items-center gap-2">
                <User className="h-5 w-5 text-primary" />
                {tr.personalDetails}
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <div className="space-y-2" data-field="first_name">
                  <Label className="text-sm font-medium">{tr.firstName} <span className="text-red-500">*</span></Label>
                  <Input
                    className={errorBorder('first_name')}
                    placeholder={tr.enterFirstName}
                    value={form.first_name}
                    onChange={(e) => updateField('first_name', e.target.value)}
                  />
                  {fieldErrors.first_name && <p className="text-xs text-red-500">{fieldErrors.first_name}</p>}
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">{tr.middleName}</Label>
                  <Input
                    placeholder={tr.enterMiddleName}
                    value={form.middle_name}
                    onChange={(e) => updateField('middle_name', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">{tr.lastName}</Label>
                  <Input
                    placeholder={tr.enterLastName}
                    value={form.last_name}
                    onChange={(e) => updateField('last_name', e.target.value)}
                  />
                </div>
                <div className="space-y-2" data-field="gender">
                  <Label className="text-sm font-medium">{tr.gender} <span className="text-red-500">*</span></Label>
                  <select aria-label={tr.gender}
                    className={`flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${errorBorder('gender')}`}
                    value={form.gender}
                    onChange={(e) => updateField('gender', e.target.value)}
                  >
                    <option value="">{tr.selectGender}</option>
                    <option value="Male">{tr.male}</option>
                    <option value="Female">{tr.female}</option>
                  </select>
                  {fieldErrors.gender && <p className="text-xs text-red-500">{fieldErrors.gender}</p>}
                </div>
                <div className="space-y-2" data-field="date_of_birth">
                  <Label className="text-sm font-medium">{tr.dateOfBirth} <span className="text-red-500">*</span></Label>
                  <LocalizedDateInput
                    locale={enumLocale}
                    className={errorBorder('date_of_birth')}
                    value={form.date_of_birth}
                    onChange={(v) => updateField('date_of_birth', v)}
                  />
                  {fieldErrors.date_of_birth && <p className="text-xs text-red-500">{fieldErrors.date_of_birth}</p>}
                </div>
                <div className="space-y-2" data-field="date_of_joining">
                  <Label className="text-sm font-medium">{tr.dateOfJoining} <span className="text-red-500">*</span></Label>
                  <LocalizedDateInput
                    locale={enumLocale}
                    className={errorBorder('date_of_joining')}
                    value={form.date_of_joining}
                    onChange={(v) => updateField('date_of_joining', v)}
                  />
                  {fieldErrors.date_of_joining && <p className="text-xs text-red-500">{fieldErrors.date_of_joining}</p>}
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">{tr.idType}</Label>
                  <select aria-label={tr.idType}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    value={form.custom_id_type}
                    onChange={(e) => updateField('custom_id_type', e.target.value)}
                  >
                    <option value="">{tr.selectIdType}</option>
                    <option value="National ID">{tr.nationalId}</option>
                    <option value="Iqama">{tr.iqama}</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">{tr.idNumber}</Label>
                  <Input
                    placeholder={form.custom_id_type === 'Iqama' ? tr.enterIqama : tr.enterNationalId}
                    value={form.custom_national_id}
                    onChange={(e) => updateField('custom_national_id', e.target.value)}
                  />
                  {form.custom_national_id && !/^\d{10}$/.test(form.custom_national_id) && (
                    <p className="text-xs text-amber-600">⚠️ {tr.idDigitsWarning}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">{tr.idIssue}</Label>
                  <LocalizedDateInput
                    locale={enumLocale}
                    value={form.custom_id_issue_date}
                    onChange={(v) => updateField('custom_id_issue_date', v)}
                  />
                  {form.custom_id_issue_date && (
                    <p className="text-[11px] text-muted-foreground truncate">{dualDate(form.custom_id_issue_date)}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">{tr.idExpiry}</Label>
                  <LocalizedDateInput
                    locale={enumLocale}
                    value={form.custom_id_expiry_date}
                    onChange={(v) => updateField('custom_id_expiry_date', v)}
                  />
                  {form.custom_id_expiry_date && (
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <p className="text-[11px] text-muted-foreground truncate">{dualDate(form.custom_id_expiry_date)}</p>
                      <IdExpiryBadge date={form.custom_id_expiry_date} showValid />
                    </div>
                  )}
                </div>
                <div className="space-y-2" data-field="custom_nationality">
                  <Label className="text-sm font-medium">
                    {tr.nationality} <span className="text-red-500">*</span>
                  </Label>
                  <NationalityCombobox
                    value={form.custom_nationality}
                    onChange={(v) => updateField('custom_nationality', v)}
                    countries={countries}
                    isRTL={isRTL}
                    placeholder={tr.selectNationality}
                    hasError={!!fieldErrors.custom_nationality}
                  />
                  {fieldErrors.custom_nationality && (
                    <p className="text-xs text-red-500">{fieldErrors.custom_nationality}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">{tr.arrivalDate}</Label>
                  <LocalizedDateInput
                    locale={enumLocale}
                    value={form.custom_arrival_date}
                    onChange={(v) => updateField('custom_arrival_date', v)}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">{tr.dutyStartDate}</Label>
                  <LocalizedDateInput
                    locale={enumLocale}
                    value={form.custom_duty_start_date}
                    onChange={(v) => updateField('custom_duty_start_date', v)}
                  />
                </div>
              </div>
            </div>

            {/* Section — Employment */}
            <div className="bg-card rounded-xl border border-border shadow-sm p-6">
              <h2 id="section-company" className="scroll-mt-28 text-lg font-bold text-foreground mb-5">{tr.companyDetails}</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-2" data-field="company">
                  <Label className="text-sm font-medium">{tr.company} <span className="text-red-500">*</span></Label>
                  <select aria-label={tr.company}
                    className={`flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${errorBorder('company')}`}
                    value={form.company}
                    onChange={(e) => {
                      updateField('company', e.target.value)
                      if (form.department) {
                        updateField('department', '')
                      }
                    }}
                  >
                    <option value="">{tr.selectCompany}</option>
                    {dropdowns.companies.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                  {fieldErrors.company && <p className="text-xs text-red-500">{fieldErrors.company}</p>}
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">{tr.department}</Label>
                  <select aria-label={tr.department}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                    value={form.department}
                    onChange={(e) => updateField('department', e.target.value)}
                    disabled={!form.company}
                  >
                    <option value="">{!form.company ? tr.selectCompanyFirst : tr.selectDepartment}</option>
                    {dropdowns.departments
                      .filter(d => d.department_name !== 'All Departments' && (!form.company || d.company === form.company))
                      .map(d => (
                        <option key={d.name} value={d.name}>{translateEnum('department', d.department_name, enumLocale)}</option>
                      ))
                    }
                  </select>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">{tr.designation}</Label>
                  <select aria-label={tr.designation}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    value={form.designation}
                    onChange={(e) => updateField('designation', e.target.value)}
                  >
                    <option value="">{tr.selectDesignation}</option>
                    {dropdowns.designations.map(d => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">{tr.employmentMode}</Label>
                  <select aria-label={tr.employmentMode}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    value={form.employment_mode}
                    onChange={(e) => updateField('employment_mode', e.target.value)}
                  >
                    <option value="">{tr.selectMode}</option>
                    <option value="Full-time">{tr.fullTime}</option>
                    <option value="Part-time">{tr.partTime}</option>
                    <option value="On-site">{tr.onSite}</option>
                    <option value="Remote">{tr.remote}</option>
                    <option value="Hybrid">{tr.hybrid}</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">{tr.branch} {form.employment_mode !== 'Remote' && <span className="text-red-500">*</span>}</Label>
                  <select aria-label={tr.branch}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    value={form.branch}
                    onChange={(e) => updateField('branch', e.target.value)}
                    disabled={form.employment_mode === 'Remote'}
                  >
                    <option value="">{form.employment_mode === 'Remote' ? tr.workFromHome : tr.selectBranch}</option>
                    {dropdowns.branches.map(b => (
                      <option key={b} value={b}>{b}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">{tr.status}</Label>
                  <select aria-label={tr.status}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    value={form.status}
                    onChange={(e) => updateField('status', e.target.value)}
                  >
                    <option value="Active">{tr.active}</option>
                    <option value="Inactive">{tr.inactive}</option>
                    <option value="Suspended">{tr.suspended}</option>
                    <option value="Left">{tr.left}</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">{tr.baseSalary}</Label>
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    placeholder={tr.enterBaseSalary}
                    value={form.base_salary}
                    onChange={(e) => updateField('base_salary', e.target.value)}
                  />
                </div>

                {/* Reports To — the direct manager; this is what builds the org chart */}
                <div className="space-y-2 md:col-span-2">
                  <Label className="text-sm font-medium">{tr.reportsTo}</Label>
                  <select aria-label={tr.reportsTo}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    value={form.reports_to}
                    onChange={(e) => updateField('reports_to', e.target.value)}
                  >
                    <option value="">{tr.selectManager}</option>
                    {dropdowns.employees
                      .filter((e) => e.name !== employeeId)
                      .map((e) => (
                        <option key={e.name} value={e.name}>{e.employee_name}</option>
                      ))}
                  </select>
                  <p className="text-xs text-muted-foreground">{tr.reportsToHint}</p>
                </div>

                {/* Branch Manager */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium">{tr.isBranchManager}</Label>
                  <div className="h-10 px-3 border rounded-md flex items-center">
                    <input
                      type="checkbox"
                      id="custom_is_branch_manager"
                      checked={form.custom_is_branch_manager}
                      onChange={(e) => updateField('custom_is_branch_manager', e.target.checked)}
                      className="h-4 w-4 rounded border-input"
                    />
                    <Label htmlFor="custom_is_branch_manager" className={`text-sm font-normal ${isRTL ? 'mr-2' : 'ml-2'} cursor-pointer`}>
                      {tr.isBranchManagerLabel}
                    </Label>
                  </div>
                </div>
                {form.custom_is_branch_manager && (
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">{tr.managedBranch}</Label>
                    <select aria-label={tr.managedBranch}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      value={form.custom_managed_branch}
                      onChange={(e) => updateField('custom_managed_branch', e.target.value)}
                    >
                      <option value="">{tr.selectManagedBranch}</option>
                      {dropdowns.branches.map(b => (
                        <option key={b} value={b}>{b}</option>
                      ))}
                    </select>
                  </div>
                )}

              </div>
            </div>

            {/* Section — Employee Vehicle */}
            <div className="bg-card rounded-xl border border-border shadow-sm p-6">
              <h2 className="text-lg font-bold text-foreground mb-1 flex items-center gap-2">
                <Car className="h-5 w-5 text-primary" />
                {tr.vehicleSection}
              </h2>
              <p className="text-sm text-muted-foreground mb-5">{tr.vehicleSectionSub}</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-2">
                  <Label className="text-sm font-medium">{tr.hasCompanyVehicle}</Label>
                  <div className="h-10 px-3 border rounded-md flex items-center">
                    <input
                      type="checkbox"
                      id="custom_has_company_vehicle"
                      checked={form.custom_has_company_vehicle}
                      onChange={(e) => updateField('custom_has_company_vehicle', e.target.checked)}
                      className="h-4 w-4 rounded border-input"
                    />
                    <Label htmlFor="custom_has_company_vehicle" className={`text-sm font-normal ${isRTL ? 'mr-2' : 'ml-2'} cursor-pointer`}>
                      {tr.hasCompanyVehicleLabel}
                    </Label>
                  </div>
                </div>
                {form.custom_has_company_vehicle && (
                  <>
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">{tr.vehicleOwnership}</Label>
                      <select aria-label={tr.vehicleOwnership}
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        value={form.custom_vehicle_ownership}
                        onChange={(e) => updateField('custom_vehicle_ownership', e.target.value)}
                      >
                        <option value="">{tr.selectOwnership}</option>
                        <option value="Personal">{tr.ownershipPersonal}</option>
                        <option value="Company-Owned">{tr.ownershipCompany}</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">{tr.vehicleModel}</Label>
                      <Input
                        placeholder={tr.enterVehicleModel}
                        value={form.custom_vehicle_model}
                        onChange={(e) => updateField('custom_vehicle_model', e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">{tr.vehiclePlate}</Label>
                      <Input
                        placeholder={tr.enterVehiclePlate}
                        value={form.custom_vehicle_plate}
                        onChange={(e) => updateField('custom_vehicle_plate', e.target.value)}
                      />
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Section — Contact Information */}
            <div className="bg-card rounded-xl border border-border shadow-sm p-6">
              <h2 id="section-contact" className="scroll-mt-28 text-lg font-bold text-foreground mb-5">{tr.contactInfo}</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <div className="space-y-2">
                  <Label className="text-sm font-medium">{tr.mobileNumber}</Label>
                  <Input
                    type="tel"
                    placeholder="+966 5xx xxxx xxx"
                    value={form.cell_number}
                    onChange={(e) => updateField('cell_number', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">{tr.personalEmail}</Label>
                  <Input
                    type="email"
                    placeholder="name@email.com"
                    value={form.personal_email}
                    onChange={(e) => updateField('personal_email', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">{tr.companyEmail}</Label>
                  <Input
                    type="email"
                    placeholder="name@company.com"
                    value={form.company_email}
                    onChange={(e) => updateField('company_email', e.target.value)}
                  />
                </div>
              </div>

              {/* Addresses */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-6">
                <div className="space-y-2">
                  <Label className="text-sm font-medium">{tr.currentAddress}</Label>
                  <textarea
                    className="flex min-h-[72px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    placeholder={tr.enterCurrentAddress}
                    value={form.current_address}
                    onChange={(e) => updateField('current_address', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">{tr.permanentAddress}</Label>
                  <textarea
                    className="flex min-h-[72px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    placeholder={tr.enterPermanentAddress}
                    value={form.permanent_address}
                    onChange={(e) => updateField('permanent_address', e.target.value)}
                  />
                </div>
              </div>

            </div>

            {/* Section — Family & Emergency Contacts */}
            <div className="bg-card rounded-xl border border-border shadow-sm p-6">
              <h2 id="section-family" className="scroll-mt-28 text-lg font-bold text-foreground mb-1 flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                {tr.familySection}
              </h2>
              <p className="text-sm text-muted-foreground mb-5">{tr.familySectionSub}</p>

              {/* Family / Home Location */}
              <div>
                <h3 className="text-base font-semibold text-foreground mb-4 flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-primary" />
                  {tr.homeLocation}
                </h3>
                <div className="space-y-2 mb-4">
                  <Label className="text-sm font-medium">{tr.homeAddress}</Label>
                  <textarea
                    className="flex min-h-[72px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    placeholder={tr.enterHomeAddress}
                    value={form.custom_home_address}
                    onChange={(e) => updateField('custom_home_address', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">
                    {isRTL ? 'انقر على الخريطة أو اسحب الدبوس لتحديد موقع السكن، أو ابحث بالاسم' : 'Click the map or drag the pin to set the home location, or search by name'}
                  </p>
                  <LocationPickerMap
                    lat={form.custom_home_latitude}
                    lng={form.custom_home_longitude}
                    onChange={(lat, lng) => {
                      updateField('custom_home_latitude', lat)
                      updateField('custom_home_longitude', lng)
                    }}
                    height="300px"
                  />
                </div>
                <div className="flex flex-wrap items-center gap-3 mt-3">
                  <Button type="button" variant="outline" size="sm" onClick={captureHomeLocation} disabled={capturingLocation}>
                    {capturingLocation ? (
                      <><Loader2 className={`h-4 w-4 ${isRTL ? 'ml-2' : 'mr-2'} animate-spin`} /> {tr.capturingLocation}</>
                    ) : (
                      <><MapPin className={`h-4 w-4 ${isRTL ? 'ml-2' : 'mr-2'}`} /> {tr.useCurrentLocation}</>
                    )}
                  </Button>
                  {form.custom_home_latitude && form.custom_home_longitude && (
                    <a
                      href={`https://www.google.com/maps?q=${form.custom_home_latitude},${form.custom_home_longitude}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-primary hover:underline flex items-center gap-1"
                    >
                      <MapPin className="h-3.5 w-3.5" /> {tr.viewOnMap}
                    </a>
                  )}
                </div>
              </div>

              {/* Emergency Contacts */}
              <div className="mt-6 border-t pt-5">
                <h3 className="text-base font-semibold text-foreground mb-4">{tr.emergencyContacts}</h3>

                {/* Primary (existing fields) */}
                <p className="text-xs font-medium text-muted-foreground mb-2">{tr.emergencyContact1}</p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-5">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">{tr.contactName}</Label>
                    <Input
                      placeholder={tr.enterContactName}
                      value={form.person_to_be_contacted}
                      onChange={(e) => updateField('person_to_be_contacted', e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">{tr.relationLabel}</Label>
                    <Input
                      placeholder={tr.enterRelation}
                      value={form.relation}
                      onChange={(e) => updateField('relation', e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">{tr.emergencyPhone}</Label>
                    <Input
                      type="tel"
                      placeholder={tr.enterEmergencyPhone}
                      value={form.emergency_phone_number}
                      onChange={(e) => updateField('emergency_phone_number', e.target.value)}
                    />
                  </div>
                </div>

                {/* Secondary */}
                <p className="text-xs font-medium text-muted-foreground mb-2">{tr.emergencyContact2}</p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-5">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">{tr.contactName}</Label>
                    <Input
                      placeholder={tr.enterContactName}
                      value={form.custom_emergency_2_name}
                      onChange={(e) => updateField('custom_emergency_2_name', e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">{tr.relationLabel}</Label>
                    <Input
                      placeholder={tr.enterRelation}
                      value={form.custom_emergency_2_relation}
                      onChange={(e) => updateField('custom_emergency_2_relation', e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">{tr.emergencyPhone}</Label>
                    <Input
                      type="tel"
                      placeholder={tr.enterEmergencyPhone}
                      value={form.custom_emergency_2_phone}
                      onChange={(e) => updateField('custom_emergency_2_phone', e.target.value)}
                    />
                  </div>
                </div>

                {/* Third */}
                <p className="text-xs font-medium text-muted-foreground mb-2">{tr.emergencyContact3}</p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">{tr.contactName}</Label>
                    <Input
                      placeholder={tr.enterContactName}
                      value={form.custom_emergency_3_name}
                      onChange={(e) => updateField('custom_emergency_3_name', e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">{tr.relationLabel}</Label>
                    <Input
                      placeholder={tr.enterRelation}
                      value={form.custom_emergency_3_relation}
                      onChange={(e) => updateField('custom_emergency_3_relation', e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">{tr.emergencyPhone}</Label>
                    <Input
                      type="tel"
                      placeholder={tr.enterEmergencyPhone}
                      value={form.custom_emergency_3_phone}
                      onChange={(e) => updateField('custom_emergency_3_phone', e.target.value)}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Section — Work Settings & System Access */}
            <div className="bg-card rounded-xl border border-border shadow-sm p-6">
              <h2 id="section-work" className="scroll-mt-28 text-lg font-bold text-foreground mb-5">{tr.workSettings}</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-2">
                  <Label className="text-sm font-medium">{tr.checkinMethod}</Label>
                  <select aria-label={tr.checkinMethod}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    value={form.checkin_method}
                    onChange={(e) => updateField('checkin_method', e.target.value)}
                  >
                    <option value="Manual">{tr.manual}</option>
                    <option value="Photo">{tr.photo}</option>
                    <option value="Biometric" disabled>{tr.biometric}</option>
                    <option value="Photo + Biometric" disabled>{tr.photoBiometric}</option>
                  </select>
                  <p className="text-xs text-muted-foreground mt-1">
                    {form.checkin_method === 'Manual' && tr.manualDesc}
                    {form.checkin_method === 'Photo' && tr.photoDesc}
                    {form.checkin_method === 'Biometric' && tr.biometricDesc}
                    {form.checkin_method === 'Photo + Biometric' && tr.photoBiometricDesc}
                  </p>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">{tr.defaultShift}</Label>
                  <select aria-label={tr.defaultShift}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    value={form.default_shift}
                    onChange={(e) => updateField('default_shift', e.target.value)}
                  >
                    <option value="">{tr.noDefaultShift}</option>
                    {dropdowns.shifts.map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">{tr.enableTracking}</Label>
                  <div className="h-10 px-3 border rounded-md flex items-center">
                    <input
                      type="checkbox"
                      id="enable_tracking"
                      checked={form.enable_tracking}
                      onChange={(e) => updateField('enable_tracking', e.target.checked)}
                      className="h-4 w-4 rounded border-input"
                    />
                    <Label htmlFor="enable_tracking" className={`text-sm font-normal ${isRTL ? 'mr-2' : 'ml-2'} cursor-pointer`}>
                      {tr.enableTrackingLabel}
                    </Label>
                  </div>
                </div>
                <div className="space-y-2" data-field="employee_consent">
                  <Label className="text-sm font-medium">{tr.employeeConsent}</Label>
                  <div className={`h-10 px-3 border rounded-md flex items-center ${errorBorder('employee_consent')}`}>
                    <input
                      type="checkbox"
                      id="employee_consent"
                      checked={form.employee_consent}
                      onChange={(e) => updateField('employee_consent', e.target.checked)}
                      className="h-4 w-4 rounded border-input"
                    />
                    <Label htmlFor="employee_consent" className={`text-sm font-normal ${isRTL ? 'mr-2' : 'ml-2'} cursor-pointer`}>
                      {tr.employeeConsentLabel}
                    </Label>
                  </div>
                  {fieldErrors.employee_consent && <p className="text-xs text-red-500">{fieldErrors.employee_consent}</p>}
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">{tr.trackingInterval}</Label>
                  <select aria-label={tr.trackingInterval}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    value={form.tracking_interval}
                    onChange={(e) => updateField('tracking_interval', e.target.value)}
                  >
                    <option value="Minutes">{tr.minutes}</option>
                    <option value="Hours">{tr.hours}</option>
                    <option value="Seconds">{tr.seconds}</option>
                  </select>
                </div>
                <div className="space-y-2" data-field="interval_number">
                  <Label className="text-sm font-medium">{tr.intervalNumber}</Label>
                  <Input
                    type="number"
                    className={errorBorder('interval_number')}
                    min={1}
                    value={form.interval_number}
                    onChange={(e) => updateField('interval_number', e.target.value)}
                    placeholder="5"
                  />
                  {fieldErrors.interval_number && <p className="text-xs text-red-500">{fieldErrors.interval_number}</p>}
                </div>
                <div className="md:col-span-2 space-y-2">
                  {/* Show existing user info if available */}
                  {employeeId && form.user_email && !form.create_user_account && (
                    <div className="bg-green-50 border border-green-200 rounded-md p-3 mb-3">
                      <p className="text-sm text-green-800">
                        ✅ {tr.userAccountExists} <strong>{form.user_email}</strong>
                      </p>
                    </div>
                  )}

                  {/* Show warning if no user account */}
                  {employeeId && !form.user_email && !form.create_user_account && (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3 mb-3">
                      <p className="text-sm text-yellow-800">
                        ⚠️ {tr.noUserAccount}
                      </p>
                    </div>
                  )}

                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="create_user"
                      checked={form.create_user_account}
                      onChange={(e) => updateField('create_user_account', e.target.checked)}
                      className="h-4 w-4 rounded border-input"
                    />
                    <Label htmlFor="create_user" className="text-sm font-medium cursor-pointer">
                      {employeeId && form.user_email
                        ? tr.updateUserAccount
                        : tr.createUserAccount}
                    </Label>
                  </div>
                  {form.create_user_account && (
                    <div className={`${isRTL ? 'mr-6' : 'ml-6'} mt-3 space-y-4`}>
                      <div className="space-y-2" data-field="user_email">
                        <Label className="text-sm font-medium">{tr.userEmail}</Label>
                        <Input
                          type="email"
                          className={errorBorder('user_email')}
                          placeholder="user@example.com"
                          value={form.user_email}
                          onChange={(e) => updateField('user_email', e.target.value)}
                        />
                        {fieldErrors.user_email && <p className="text-xs text-red-500">{fieldErrors.user_email}</p>}
                        {!form.user_email.trim() && (
                          <p className="text-xs text-muted-foreground">{tr.loginByIdHint}</p>
                        )}
                      </div>

                      {/* No address means no welcome mail — the employee's ID is the
                          sign-in name, so show it instead of an empty promise. */}
                      {!form.user_email.trim() && (
                        <div className={`rounded-md p-3 text-sm border ${signInName
                          ? 'bg-blue-50 border-blue-200 text-blue-800'
                          : 'bg-yellow-50 border-yellow-200 text-yellow-800'}`}>
                          {signInName
                            ? <>👤 {tr.loginIdIs}: <strong dir="ltr">{signInName}</strong></>
                            : <>⚠️ {tr.loginIdMissing}</>}
                        </div>
                      )}

                      {/* Password option toggle — pointless without an address to
                          mail, so it only appears when one was typed. */}
                      {form.user_email.trim() && (
                        <div className="flex items-center space-x-2 bg-accent p-3 rounded-md">
                          <input
                            type="checkbox"
                            id="set_password"
                            checked={form.set_password_directly}
                            onChange={(e) => updateField('set_password_directly', e.target.checked)}
                            className="h-4 w-4 rounded border-input"
                          />
                          <Label htmlFor="set_password" className="text-sm cursor-pointer">
                            {tr.setPasswordDirectly}
                          </Label>
                        </div>
                      )}

                      {(form.set_password_directly || !form.user_email.trim()) ? (
                        <div className="space-y-2 bg-green-50 p-3 rounded-md" data-field="user_password">
                          <Label className="text-sm font-medium">{tr.password} <span className="text-red-500">*</span></Label>
                          <Input
                            type="password"
                            className={errorBorder('user_password')}
                            placeholder={locale === 'ar' ? 'كلمة مرور قوية...' : 'Min. 8 characters with uppercase, number & special char'}
                            value={form.user_password}
                            onChange={(e) => updateField('user_password', e.target.value)}
                            minLength={8}
                          />
                          {fieldErrors.user_password && <p className="text-xs text-red-500">{fieldErrors.user_password}</p>}

                          {/* Password Requirements Checklist */}
                          {form.user_password && (
                            <div className="mt-2 space-y-1 text-xs">
                              <div className={`flex items-center gap-2 ${form.user_password.length >= 8 ? 'text-green-600' : 'text-muted-foreground'}`}>
                                {form.user_password.length >= 8 ? '✓' : '○'} {tr.passwordMin8}
                              </div>
                              <div className={`flex items-center gap-2 ${/[A-Z]/.test(form.user_password) ? 'text-green-600' : 'text-muted-foreground'}`}>
                                {/[A-Z]/.test(form.user_password) ? '✓' : '○'} {tr.passwordUpper}
                              </div>
                              <div className={`flex items-center gap-2 ${/[a-z]/.test(form.user_password) ? 'text-green-600' : 'text-muted-foreground'}`}>
                                {/[a-z]/.test(form.user_password) ? '✓' : '○'} {tr.passwordLower}
                              </div>
                              <div className={`flex items-center gap-2 ${/[0-9]/.test(form.user_password) ? 'text-green-600' : 'text-muted-foreground'}`}>
                                {/[0-9]/.test(form.user_password) ? '✓' : '○'} {tr.passwordNumber}
                              </div>
                              <div className={`flex items-center gap-2 ${/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(form.user_password) ? 'text-green-600' : 'text-muted-foreground'}`}>
                                {/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(form.user_password) ? '✓' : '○'} {tr.passwordSpecial}
                              </div>
                            </div>
                          )}

                          <p className="text-xs text-green-700 mt-2">
                            ✅ {tr.passwordLoginNow}
                          </p>
                        </div>
                      ) : (
                        <p className="text-xs text-primary bg-accent p-2 rounded">
                          📧 {tr.welcomeEmail}
                        </p>
                      )}
                    </div>
                  )}
                  <p className={`text-xs text-muted-foreground ${isRTL ? 'mr-6' : 'ml-6'}`}>
                    {form.create_user_account && form.user_email
                      ? `${tr.userAccountFor} ${form.user_email}`
                      : tr.userAccountInfo}
                  </p>
                </div>
              </div>
            </div>

            {/* Section — Employment Contract (optional; new employees; only if the
                Employment Contract feature exists on this tenant). Once the user has
                enabled the contract, keep it mounted even if the async feature-probe
                resolves late — prevents the "activates then resets" toggle bug. */}
            {!employeeId && (contractFeatureAvailable || form.contract_enabled) && (
              <div id="section-contract" className="scroll-mt-28 bg-card rounded-xl border border-border shadow-sm p-6">
                <h2 className="text-lg font-bold text-foreground mb-1 flex items-center gap-2">
                  <FileText className="h-5 w-5 text-indigo-600" />
                  {tr.contractSection}
                </h2>
                <label className={`flex items-center gap-2 mt-3 cursor-pointer ${isRTL ? 'flex-row' : ''}`}>
                  <input
                    type="checkbox"
                    checked={form.contract_enabled}
                    onChange={(e) => updateField('contract_enabled', e.target.checked)}
                    className="h-4 w-4 rounded border-input text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="text-sm text-foreground/90">{tr.contractEnable}</span>
                </label>

                {form.contract_enabled && (
                  <div className="mt-5 space-y-6">
                    {/* Qiwa internal-record disclaimer */}
                    <div className="rounded-lg bg-primary/5 border border-primary/20 px-4 py-3 text-xs text-foreground/90 flex items-start gap-2">
                      <AlertCircle className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
                      <span>{tr.qiwaNote}</span>
                    </div>

                    {/* Identity details — READ-ONLY mirror of Personal Information (single
                        source of truth). Always shown for both National ID and Iqama; all three
                        (number / issue / expiry) print in the generated contract's Parties clause.
                        No double entry / no divergence. */}
                    <div className="rounded-lg border border-border bg-muted/30 px-4 py-3 space-y-2">
                      <div className="flex items-center gap-2">
                        <CreditCard className="h-4 w-4 text-primary flex-shrink-0" />
                        <span className="text-sm font-medium text-foreground">{tr.identityDetails}</span>
                        <span className="text-[11px] text-muted-foreground">({tr.fromPersonalInfo})</span>
                      </div>
                      <dl className="text-xs space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <dt className="text-muted-foreground">{tr.idNumber}</dt>
                          <dd className="font-medium text-foreground" dir="ltr">{form.custom_national_id || '—'}</dd>
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <dt className="text-muted-foreground">{tr.idIssue}</dt>
                          <dd className="font-medium text-foreground">{form.custom_id_issue_date ? dualDate(form.custom_id_issue_date) : '—'}</dd>
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <dt className="text-muted-foreground">{tr.idExpiry}</dt>
                          <dd className="font-medium text-foreground flex items-center gap-2 flex-wrap justify-end">
                            <span>{form.custom_id_expiry_date ? dualDate(form.custom_id_expiry_date) : '—'}</span>
                            <IdExpiryBadge date={form.custom_id_expiry_date} />
                          </dd>
                        </div>
                      </dl>
                      {!form.custom_national_id && !form.custom_id_issue_date && !form.custom_id_expiry_date && (
                        <button type="button" onClick={() => scrollToSection('section-personal')} className="text-xs text-primary hover:underline whitespace-nowrap">
                          {tr.enterInPersonal}
                        </button>
                      )}
                    </div>

                    {/* — Type & Term — */}
                    <div className="flex items-center gap-3"><span className="text-sm font-bold text-primary whitespace-nowrap">{tr.secType}</span><div className="h-px flex-1 bg-border" /></div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">{tr.contractType}</Label>
                        <select aria-label={tr.contractType}
                          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          value={form.contract_type}
                          onChange={(e) => updateField('contract_type', e.target.value)}
                        >
                          <option value="">{tr.contractSelectType}</option>
                          <option value="Permanent">{tr.ctPermanent}</option>
                          <option value="Fixed Term">{tr.ctFixedTerm}</option>
                          <option value="Probation">{tr.ctProbation}</option>
                          <option value="Part-time">{tr.ctPartTime}</option>
                        </select>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">{tr.contractStatus}</Label>
                        <select aria-label={tr.contractStatus}
                          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          value={form.contract_status}
                          onChange={(e) => updateField('contract_status', e.target.value)}
                        >
                          <option value="Draft">{tr.ctDraft}</option>
                          <option value="Active">{tr.ctActive}</option>
                        </select>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">{tr.contractStart}</Label>
                        <LocalizedDateInput locale={enumLocale} value={form.contract_start_date} onChange={(v) => updateField('contract_start_date', v)} />
                      </div>
                      {/* End date — only for non-permanent contracts (Permanent has none) */}
                      {form.contract_type && form.contract_type !== 'Permanent' && (
                        <div className="space-y-2">
                          <Label className="text-sm font-medium">{tr.contractEnd}</Label>
                          <LocalizedDateInput locale={enumLocale} value={form.contract_end_date} onChange={(v) => updateField('contract_end_date', v)} />
                        </div>
                      )}
                      <div className="space-y-2 md:col-span-2">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input type="checkbox" checked={form.contract_auto_renew} onChange={(e) => updateField('contract_auto_renew', e.target.checked)} className="h-4 w-4 rounded border-input text-primary focus:ring-primary" />
                          <span className="text-sm font-medium">{tr.autoRenew}</span>
                        </label>
                        {form.contract_auto_renew && (
                          <Input type="number" min={0} step="1" placeholder={tr.renewalTerm} value={form.contract_renewal_term} onChange={(e) => updateField('contract_renewal_term', e.target.value)} className="max-w-xs" />
                        )}
                      </div>
                    </div>
                    <p className="text-[11px] text-amber-700 bg-amber-50 rounded-md px-3 py-2 flex items-start gap-1.5"><AlertCircle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />{tr.termTypeHint}</p>

                    {/* — Job & Skill — */}
                    <div className="flex items-center gap-3"><span className="text-sm font-bold text-primary whitespace-nowrap">{tr.secJob}</span><div className="h-px flex-1 bg-border" /></div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">{tr.skillLevel}</Label>
                        <select aria-label={tr.skillLevel}
                          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          value={form.contract_skill_level}
                          onChange={(e) => updateField('contract_skill_level', e.target.value)}
                        >
                          <option value="">{tr.skillSelect}</option>
                          <option value="High-skilled">{tr.skillHigh}</option>
                          <option value="Skilled">{tr.skillSkilled}</option>
                          <option value="Basic-labor">{tr.skillBasic}</option>
                        </select>
                        <p className="text-[11px] text-muted-foreground/70">{tr.skillHint}</p>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">{tr.probationMonths}</Label>
                        <Input type="number" min={0} step="1" value={form.contract_probation_months} onChange={(e) => updateField('contract_probation_months', e.target.value)} />
                        {Number(form.contract_probation_months) > 6
                          ? <p className="text-[11px] text-amber-600 flex items-center gap-1"><AlertCircle className="h-3 w-3 flex-shrink-0" />{tr.probationWarn}</p>
                          : <p className="text-[11px] text-muted-foreground/70">{tr.probationHint}</p>}
                      </div>
                    </div>

                    {/* — Place, Hours & Days — */}
                    <div className="flex items-center gap-3"><span className="text-sm font-bold text-primary whitespace-nowrap">{tr.secWork}</span><div className="h-px flex-1 bg-border" /></div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      <div className="space-y-2 md:col-span-2">
                        <Label className="text-sm font-medium">{tr.workLocation}</Label>
                        <Input value={form.contract_work_location} onChange={(e) => updateField('contract_work_location', e.target.value)} />
                        <p className="text-[11px] text-muted-foreground/70">{tr.workLocationHint}</p>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">{tr.workDays}</Label>
                        <Input placeholder={tr.workDaysPh} value={form.contract_work_days} onChange={(e) => updateField('contract_work_days', e.target.value)} />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">{tr.weeklyRest}</Label>
                        <select aria-label={tr.weeklyRest}
                          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          value={form.contract_weekly_rest_day}
                          onChange={(e) => updateField('contract_weekly_rest_day', e.target.value)}
                        >
                          <option value="">{tr.restSelect}</option>
                          <option value="Friday">{tr.restFriday}</option>
                          <option value="Saturday">{tr.restSaturday}</option>
                          <option value="Sunday">{tr.restSunday}</option>
                          <option value="Friday-Saturday">{tr.restFriSat}</option>
                        </select>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">{tr.workingHoursPerDay}</Label>
                        <Input type="number" min={0} step="0.5" value={form.contract_working_hours} onChange={(e) => updateField('contract_working_hours', e.target.value)} />
                        {Number(form.contract_working_hours) > 8
                          ? <p className="text-[11px] text-amber-600 flex items-center gap-1"><AlertCircle className="h-3 w-3 flex-shrink-0" />{tr.workingHoursWarn}</p>
                          : <p className="text-[11px] text-muted-foreground/70">{tr.workingHoursHint}</p>}
                      </div>
                    </div>

                    {/* — Wage & Allowances — */}
                    <div className="flex items-center gap-3"><span className="text-sm font-bold text-primary whitespace-nowrap">{tr.secWage}</span><div className="h-px flex-1 bg-border" /></div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">{tr.housingAllowance} <span className="text-muted-foreground/70 font-normal">{tr.sar}</span></Label>
                        <Input type="number" min={0} step="0.01" value={form.contract_housing_allowance} onChange={(e) => updateField('contract_housing_allowance', e.target.value)} />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">{tr.transportAllowance} <span className="text-muted-foreground/70 font-normal">{tr.sar}</span></Label>
                        <Input type="number" min={0} step="0.01" value={form.contract_transport_allowance} onChange={(e) => updateField('contract_transport_allowance', e.target.value)} />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">{tr.otherAllowance} <span className="text-muted-foreground/70 font-normal">{tr.sar}</span></Label>
                        <Input type="number" min={0} step="0.01" value={form.contract_other_allowance} onChange={(e) => updateField('contract_other_allowance', e.target.value)} />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">{tr.gosiDeduction} <span className="text-muted-foreground/70 font-normal">{tr.sar}</span></Label>
                        <Input type="number" min={0} step="0.01" value={form.contract_gosi_deduction} onChange={(e) => updateField('contract_gosi_deduction', e.target.value)} />
                        <p className="text-[11px] text-muted-foreground/70">{tr.gosiHint}</p>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">{tr.salaryPaymentDay}</Label>
                        <Input type="number" min={1} max={31} step="1" value={form.contract_salary_payment_day} onChange={(e) => updateField('contract_salary_payment_day', e.target.value)} />
                        <p className="text-[11px] text-muted-foreground/70">{tr.salaryPaymentDayHint}</p>
                      </div>
                    </div>
                    {/* Live total monthly package + net-after-GOSI (read-only) */}
                    <div className="rounded-lg bg-primary/5 border border-primary/20 divide-y divide-primary/10">
                      <div className="flex items-center justify-between px-4 py-2.5">
                        <span className="text-sm font-medium text-foreground/90">{tr.monthlyPackage}</span>
                        <span className="text-sm font-bold text-primary">
                          {formatSAR((Number(form.base_salary) || 0) + (Number(form.contract_housing_allowance) || 0) + (Number(form.contract_transport_allowance) || 0) + (Number(form.contract_other_allowance) || 0))}
                        </span>
                      </div>
                      <div className="flex items-center justify-between px-4 py-2.5">
                        <span className="text-sm font-medium text-foreground/90">{tr.netSalary}</span>
                        <span className="text-sm font-bold text-primary">
                          {formatSAR(Math.max(0, (Number(form.base_salary) || 0) + (Number(form.contract_housing_allowance) || 0) + (Number(form.contract_transport_allowance) || 0) + (Number(form.contract_other_allowance) || 0) - (Number(form.contract_gosi_deduction) || 0)))}
                        </span>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">{tr.contractBasicNote}</p>

                    {/* — Leave & Notice — */}
                    <div className="flex items-center gap-3"><span className="text-sm font-bold text-primary whitespace-nowrap">{tr.secLeaveNotice}</span><div className="h-px flex-1 bg-border" /></div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">{tr.annualLeaveDays}</Label>
                        <Input type="number" min={0} step="1" value={form.contract_annual_leave_days} onChange={(e) => updateField('contract_annual_leave_days', e.target.value)} />
                        {form.contract_annual_leave_days !== '' && Number(form.contract_annual_leave_days) < 21
                          ? <p className="text-[11px] text-amber-600 flex items-center gap-1"><AlertCircle className="h-3 w-3 flex-shrink-0" />{tr.annualLeaveWarn}</p>
                          : <p className="text-[11px] text-muted-foreground/70">{tr.annualLeaveHint}</p>}
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">{tr.noticeDays}</Label>
                        <Input type="number" min={0} step="1" value={form.contract_notice_days} onChange={(e) => updateField('contract_notice_days', e.target.value)} />
                        <p className="text-[11px] text-muted-foreground/70">{tr.noticeHint}</p>
                      </div>
                    </div>

                    {/* — Optional Clauses — (each with an (i) preview of the ACTUAL
                        contract text, from the document generator's single source of truth) */}
                    <div className="flex items-center gap-3"><span className="text-sm font-bold text-primary whitespace-nowrap">{tr.secClauses}</span><div className="h-px flex-1 bg-border" /></div>
                    <p className="text-[11px] text-muted-foreground -mt-2">{tr.clausesHint}</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {OPTIONAL_CLAUSES.map((c) => {
                        const flag = CLAUSE_FLAG[c.key]
                        const enabled = form[flag] as boolean
                        const wide = c.key === 'non_compete' || c.key === 'training'
                        const open = !!openClausePreview[c.key]
                        const preview = optionalClauseText(c.key, {
                          nonCompeteDuration: form.contract_non_compete_duration,
                          nonCompeteScope: form.contract_non_compete_scope,
                          trainingDetails: form.contract_training_details,
                        })
                        const ncDurNum = Number(form.contract_non_compete_duration)
                        const ncDurInvalid = c.key === 'non_compete' && enabled && (form.contract_non_compete_duration === '' || !(ncDurNum >= 1 && ncDurNum <= 24))
                        const ncScopeInvalid = c.key === 'non_compete' && enabled && !form.contract_non_compete_scope.trim()
                        return (
                          <div key={c.key} className={`rounded-md border px-3 py-2 space-y-2 ${wide ? 'md:col-span-2' : ''} ${enabled ? 'bg-primary/[0.03] border-primary/30' : 'border-border'}`}>
                            <div className="flex items-center justify-between gap-2">
                              <label className="flex items-center gap-2 cursor-pointer flex-1 min-w-0">
                                <input type="checkbox" checked={enabled} onChange={(e) => updateField(flag, e.target.checked)} className="h-4 w-4 rounded border-input text-primary focus:ring-primary flex-shrink-0" />
                                <span className="text-sm truncate">{isRTL ? c.labelAr : c.labelEn}</span>
                              </label>
                              <button
                                type="button"
                                onClick={() => setOpenClausePreview((p) => ({ ...p, [c.key]: !p[c.key] }))}
                                aria-expanded={open}
                                aria-label={tr.clausePreviewLabel}
                                title={tr.clausePreviewLabel}
                                className={`flex-shrink-0 p-1 rounded transition-colors ${open ? 'text-primary' : 'text-muted-foreground hover:text-primary'}`}
                              >
                                <Info className="h-4 w-4" />
                              </button>
                            </div>
                            {open && (
                              <div className="rounded-md bg-muted/50 border border-border px-3 py-2 text-xs leading-6 text-foreground/80" dir="rtl">
                                <p className="text-[11px] font-medium text-primary mb-0.5">{tr.clausePreviewTitle}</p>
                                {preview.ar}
                              </div>
                            )}
                            {/* Non-Compete — required, validated sub-fields (duration ≤2yr + scope/activity) */}
                            {c.key === 'non_compete' && enabled && (
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                                <div className="space-y-1">
                                  <Label className="text-xs font-medium">{tr.nonCompeteDuration} <span className="text-red-500">*</span></Label>
                                  <Input type="number" min={1} max={24} step="1" placeholder={tr.nonCompeteDuration} value={form.contract_non_compete_duration} onChange={(e) => updateField('contract_non_compete_duration', e.target.value)} aria-invalid={ncDurInvalid} className={ncDurInvalid ? 'border-red-400 focus-visible:ring-red-400' : ''} />
                                  <p className={`text-[11px] ${ncDurInvalid ? 'text-red-600' : 'text-muted-foreground'}`}>{tr.ncDurationRange}</p>
                                </div>
                                <div className="space-y-1">
                                  <Label className="text-xs font-medium">{tr.nonCompeteScope} <span className="text-red-500">*</span></Label>
                                  <Input placeholder={tr.ncScopePh} value={form.contract_non_compete_scope} onChange={(e) => updateField('contract_non_compete_scope', e.target.value)} aria-invalid={ncScopeInvalid} className={ncScopeInvalid ? 'border-red-400 focus-visible:ring-red-400' : ''} />
                                  {ncScopeInvalid && <p className="text-[11px] text-red-600">{tr.ncRequired}</p>}
                                </div>
                                <p className="md:col-span-2 text-[11px] text-amber-700 bg-amber-50 rounded px-2 py-1 flex items-start gap-1"><AlertCircle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />{tr.nonCompeteHint}</p>
                              </div>
                            )}
                            {/* Training — commitment details */}
                            {c.key === 'training' && enabled && (
                              <Input placeholder={tr.trainingDetails} value={form.contract_training_details} onChange={(e) => updateField('contract_training_details', e.target.value)} />
                            )}
                          </div>
                        )
                      })}
                    </div>

                    {/* Women's provisions — shown when the employee is female */}
                    {['Female', 'أنثى', 'انثى'].includes(form.gender) && (
                      <div className="rounded-lg bg-rose-50 border border-rose-200 px-4 py-3 text-xs text-rose-900">
                        <p className="font-bold mb-1">{tr.womenTitle}</p>
                        <p>{tr.womenNote}</p>
                      </div>
                    )}

                    {/* Preview / Print the generated bilingual contract document */}
                    <div className="pt-1 space-y-2 border-t border-border/60">
                      <Button aria-label="طباعة" title="طباعة" type="button" variant="outline" onClick={handlePreviewContract} className="gap-2 mt-3">
                        <Printer className="h-4 w-4" />
                        {tr.previewContract}
                      </Button>
                      <p className="text-[11px] text-muted-foreground/70">{tr.arabicPrevails}</p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Section — Employee Documents (edit mode, incl. just-created employee) */}
            {effectiveEmployeeId && (
              <div className="bg-card rounded-xl border border-border shadow-sm p-6">
                {/* Hint shown right after a fresh create */}
                {createdEmployeeId && !employeeId && (
                  <div className="mb-4 p-3 rounded-lg bg-green-50 border border-green-200 text-green-800 text-sm flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 flex-shrink-0" />
                    {tr.documentsReady}
                  </div>
                )}
                {/* Residency / Saudi ID hint driven by custom_id_type */}
                <div className="mb-4 p-3 rounded-lg bg-accent border border-primary/20 text-accent-foreground text-sm">
                  {tr.documentsHint}
                  {form.custom_id_type === 'Iqama' && (
                    <p className="mt-1 font-medium">→ {tr.documentsHintResident}</p>
                  )}
                  {form.custom_id_type === 'National ID' && (
                    <p className="mt-1 font-medium">→ {tr.documentsHintSaudi}</p>
                  )}
                </div>
                <EmployeeDocuments
                  employeeId={effectiveEmployeeId}
                  employeeName={form.first_name ? `${form.first_name} ${form.last_name || ''}`.trim() : undefined}
                  canDelete={true}
                  canUpload={true}
                  compact={false}
                  isRTL={isRTL}
                />
              </div>
            )}

            {/* Section — Custody & Leaves (read-only summary, edit mode only) */}
            {effectiveEmployeeId && (
              <div className="space-y-6">
                {/* Custody items */}
                <div className="bg-card rounded-xl border border-border shadow-sm p-6">
                  <h2 className="text-lg font-bold text-foreground mb-1 flex items-center gap-2">
                    <Package className="h-5 w-5 text-primary" />
                    {tr.custodyTitle}
                  </h2>
                  <p className="text-sm text-muted-foreground mb-4">{tr.custodySub}</p>
                  <div className="flex justify-end mb-3">
                    <Button type="button" size="sm" variant="outline" onClick={() => { setCustodyForm({ item_category: '', item_name: '', serial_no: '', status: 'Active' }); setShowCustodyDialog(true) }}>
                      <Package className={`h-4 w-4 ${isRTL ? 'ml-2' : 'mr-2'}`} /> {isRTL ? 'إضافة عهدة' : 'Add Custody Item'}
                    </Button>
                  </div>
                  <CustodyItems key={custodyRefreshKey} employeeId={effectiveEmployeeId} isRTL={isRTL} />
                </div>

                {/* Leave balances */}
                <div className="bg-card rounded-xl border border-border shadow-sm p-6">
                  <h2 className="text-lg font-bold text-foreground mb-1 flex items-center gap-2">
                    <CalendarDays className="h-5 w-5 text-primary" />
                    {tr.leaveBalanceTitle}
                  </h2>
                  <p className="text-sm text-muted-foreground mb-4">{tr.leaveBalanceSub}</p>
                  <div className="flex justify-end mb-3">
                    <Button type="button" size="sm" variant="outline" onClick={() => setShowLeaveDialog(true)}>
                      <CalendarDays className={`h-4 w-4 ${isRTL ? 'ml-2' : 'mr-2'}`} /> {isRTL ? 'طلب / تخصيص إجازة' : 'Request / Allocate Leave'}
                    </Button>
                  </div>
                  {loadingLeaveBalances ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
                      <Loader2 className="h-4 w-4 animate-spin" /> {tr.loadingBalances}
                    </div>
                  ) : leaveBalances.length === 0 ? (
                    <p className="text-sm text-muted-foreground/70 py-4">{tr.noLeaveTypes}</p>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {leaveBalances.map(lb => (
                        <div key={lb.leave_type} className="rounded-lg border border-border p-4">
                          <p className="text-sm text-muted-foreground">{translateEnum('leaveType', lb.leave_type, enumLocale)}</p>
                          <p className="text-2xl font-bold text-foreground mt-1">
                            {lb.balance} <span className="text-sm font-normal text-muted-foreground">{tr.days}</span>
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {showCustodyDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" dir={isRTL ? 'rtl' : 'ltr'}>
          <div className="w-full max-w-md rounded-xl bg-card p-6 shadow-xl space-y-4">
            <h3 className="text-lg font-bold text-foreground">{isRTL ? 'إضافة عهدة للموظف' : 'Add Custody Item'}</h3>
            <div className="space-y-2">
              <Label className="text-sm font-medium">{isRTL ? 'نوع العهدة' : 'Item Category'}</Label>
              <select aria-label={isRTL ? 'نوع العهدة' : 'Item Category'}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={custodyForm.item_category}
                onChange={(e) => setCustodyForm(f => ({ ...f, item_category: e.target.value }))}
              >
                <option value="">{isRTL ? 'اختر النوع' : 'Select category'}</option>
                {CUSTODY_CATEGORIES.map(c => <option key={c} value={c}>{isRTL ? (CUSTODY_CATEGORY_AR[c] || c) : c}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">{isRTL ? 'اسم الصنف' : 'Item Name'}</Label>
              <Input value={custodyForm.item_name} onChange={(e) => setCustodyForm(f => ({ ...f, item_name: e.target.value }))} placeholder={isRTL ? 'مثال: لابتوب Dell' : 'e.g. Dell Laptop'} />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">{isRTL ? 'الرقم التسلسلي (اختياري)' : 'Serial No (optional)'}</Label>
              <Input value={custodyForm.serial_no} onChange={(e) => setCustodyForm(f => ({ ...f, serial_no: e.target.value }))} />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setShowCustodyDialog(false)} disabled={savingCustody}>{isRTL ? 'إلغاء' : 'Cancel'}</Button>
              <Button type="button" onClick={handleAddCustody} disabled={savingCustody || !custodyForm.item_category || !custodyForm.item_name}>
                {savingCustody ? <Loader2 className="h-4 w-4 animate-spin" /> : (isRTL ? 'حفظ' : 'Save')}
              </Button>
            </div>
          </div>
        </div>
      )}

      <LeaveApplicationDialog
        open={showLeaveDialog}
        onOpenChange={setShowLeaveDialog}
        onSuccess={() => { if (effectiveEmployeeId) loadLeaveBalances() }}
      />

      <ConfirmDialog
        open={guardOpen}
        onOpenChange={(open) => !open && cancelNavigation()}
        title={t('nav.unsaved_title')}
        description={t('nav.unsaved_desc')}
        confirmLabel={t('nav.discard')}
        cancelLabel={t('nav.stay')}
        variant="destructive"
        onConfirm={confirmNavigation}
      />
    </>
  )
}