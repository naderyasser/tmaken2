'use client'

import React, { useState, useEffect } from "react"
import { ArrowLeft, Save, Upload, Loader2, CheckCircle, AlertCircle, User, ChevronRight } from "lucide-react"
import { csrfFetch } from "@/lib/csrf"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { frappeClient, frappeApiUrl } from "@/lib/api-client"
import { frappeImageUrl } from "@/lib/utils"
import { updateDoc } from "@/lib/api"
import { useAuthSafe } from "@/lib/auth-context"
import { EmployeeDocuments } from "@/components/employee/employee-documents"
import { useNavigationGuard } from "@/lib/use-navigation-guard"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { useI18n } from "@/lib/i18n"

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
  default_shift: string
  create_user_account: boolean
  set_password_directly: boolean
  custom_national_id: string
  custom_id_type: string
}

interface DropdownData {
  companies: string[]
  departments: Array<{ name: string; department_name: string; company: string }>
  designations: string[]
  branches: string[]
  shifts: string[]
}

export function EmployeeProfile({ onBack, employeeId }: EmployeeProfileProps) {
  const { user, refreshUser } = useAuthSafe()
  const { t } = useI18n()
  const [isDirty, setIsDirty] = useState(false)
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
    default_shift: '',
    create_user_account: true,
    set_password_directly: false,
    custom_national_id: '',
    custom_id_type: '',
  })

  const [dropdowns, setDropdowns] = useState<DropdownData>({
    companies: [],
    departments: [],
    designations: [],
    branches: [],
    shifts: [],
  })

  const [saving, setSaving] = useState(false)
  const [saveResult, setSaveResult] = useState<{ success: boolean; message: string } | null>(null)
  const [loadingDropdowns, setLoadingDropdowns] = useState(true)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [uploadingImage, setUploadingImage] = useState(false)
  const [imagePreview, setImagePreview] = useState<string>('')

  // ── Stepper ──
  const STEPS = [
    { title: 'Personal Details', subtitle: 'Name, gender & ID' },
    { title: 'Employment', subtitle: 'Company, role & branch' },
    { title: 'Contact', subtitle: 'Phone & email' },
    { title: 'Work & Access', subtitle: 'Schedule, tracking & login' },
    ...(employeeId ? [{ title: 'Documents', subtitle: 'Attachments & files' }] : []),
  ]
  const totalSteps = STEPS.length
  const [step, setStep] = useState(1)

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
      const [companies, departments, designations, branches, shifts] = await Promise.all([
        frappeClient.get('Company', undefined, { fields: ['name'], limit_page_length: 50 }),
        frappeClient.get('Department', undefined, { fields: ['name', 'department_name' as any, 'company'], limit_page_length: 200 }),
        frappeClient.get('Designation', undefined, { fields: ['name'], limit_page_length: 50 }),
        frappeClient.get('Branch', undefined, { fields: ['name'], limit_page_length: 50 }),
        frappeClient.get('Shift Type', undefined, { fields: ['name'], limit_page_length: 50 }),
      ])

      const companyList = (companies.data || []).map((c: any) => c.name)
      const deptList = (departments.data || []).map((d: any) => ({
        name: d.name,
        department_name: d.department_name || d.name,
        company: d.company || ''
      }))
      const desigList = (designations.data || []).map((d: any) => d.name)
      const branchList = (branches.data || []).map((b: any) => b.name)
      const shiftList = (shifts.data || []).map((s: any) => s.name)

      // Remove duplicate departments by name and department_name
      const uniqueDeptList = deptList.reduce((acc: Array<{ name: string; department_name: string; company: string }>, current: { name: string; department_name: string; company: string }) => {
        const exists = acc.find(item => item.name === current.name || item.department_name === current.department_name)
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
          default_shift: employee.default_shift || '',
          create_user_account: false, // Don't auto-check in edit mode
          set_password_directly: false,
          user_email: employee.user_id || '', // Load existing user email if exists
          user_password: '',
          custom_national_id: employee.custom_national_id || '',
          custom_id_type: employee.custom_id_type || ''
        }))

        // Don't set imagePreview here — form.image is set above
        // and frappeImageUrl() will resolve it for display.
        // imagePreview is only for fresh uploads (data URI from FileReader).
      }
    } catch (error) {
      console.error('Failed to load employee data:', error)
      setSaveResult({ success: false, message: 'Failed to load employee data' })
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

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setSaveResult({ success: false, message: 'Please select an image file' })
      return
    }

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      setSaveResult({ success: false, message: 'Image size must be less than 2MB' })
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

      const response = await csrfFetch(frappeApiUrl('/api/method/upload_file'), {
        method: 'POST',
        credentials: 'include',
        body: formData,
      })

      if (!response.ok) {
        throw new Error('Failed to upload image')
      }

      const data = await response.json()
      if (data.message?.file_url) {
        updateField('image', data.message.file_url)
        setSaveResult({ success: true, message: 'Image uploaded successfully' })
      }
    } catch (error) {
      console.error('Image upload failed:', error)
      setSaveResult({ success: false, message: 'Failed to upload image' })
      setImagePreview('')
    } finally {
      setUploadingImage(false)
    }
  }

  const validateForm = (): Record<string, string> => {
    const errors: Record<string, string> = {}

    if (!form.first_name.trim()) errors.first_name = 'First Name is required'
    if (!form.gender) errors.gender = 'Gender is required'
    if (!form.date_of_birth) errors.date_of_birth = 'Date of Birth is required'
    if (!form.date_of_joining) errors.date_of_joining = 'Date of Joining is required'
    if (!form.company) errors.company = 'Company is required'

    const intervalNumber = Number(form.interval_number)
    if (!Number.isFinite(intervalNumber) || intervalNumber <= 0) {
      errors.interval_number = 'Tracking interval number must be greater than 0'
    }

    if (form.enable_tracking && !form.employee_consent) {
      errors.employee_consent = 'Employee consent is required when tracking is enabled'
    }

    // Validate user account fields if creating user
    if (form.create_user_account) {
      // Email is optional — only validate format if provided
      if (form.user_email && form.user_email.trim()) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        if (!emailRegex.test(form.user_email)) {
          errors.user_email = 'Please enter a valid email address'
        }
      }
      if (form.set_password_directly) {
        const password = form.user_password?.trim()
        if (!password || password.length < 8) {
          errors.user_password = 'Password must be at least 8 characters long'
        } else if (!/[A-Z]/.test(password)) {
          errors.user_password = 'Password must contain at least one uppercase letter'
        } else if (!/[a-z]/.test(password)) {
          errors.user_password = 'Password must contain at least one lowercase letter'
        } else if (!/[0-9]/.test(password)) {
          errors.user_password = 'Password must contain at least one number'
        } else if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
          errors.user_password = 'Password must contain at least one special character (!@#$%^&* etc.)'
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
        first_name: 'First Name', gender: 'Gender', date_of_birth: 'Date of Birth',
        date_of_joining: 'Date of Joining', company: 'Company', interval_number: 'Interval Number',
        employee_consent: 'Employee Consent', user_email: 'User Email', user_password: 'Password'
      }
      const missingFields = Object.keys(errors).map(k => fieldNames[k] || k).join(', ')
      setSaveResult({ success: false, message: `Please fix these fields: ${missingFields}` })
      // Scroll to first error field
      const firstErrorField = Object.keys(errors)[0]
      const el = document.querySelector(`[data-field="${firstErrorField}"]`)
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      return
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

      if (employeeId) {
        // Update existing employee
        result = await frappeClient.updateEmployee(employeeId, payload)
        if (!result) throw new Error('Failed to update employee — server returned empty response')
        successMessage = `Employee "${result.employee_name}" updated successfully!`

        // Update check-in method in Employee Location Settings
        if (form.checkin_method) {
          try {
            console.log('💾 Updating location settings:', locationSettingsPayload)
            const locationSettingsExists = await frappeClient.get('Employee Location Settings', employeeId)

            if (locationSettingsExists.data) {
              // Update existing
              await frappeClient.put('Employee Location Settings', employeeId, {
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
                  employee: employeeId,
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
      } else {
        // Create new employee
        result = await frappeClient.createEmployee(payload)
        if (!result) throw new Error('Failed to create employee — server returned empty response. Check backend logs for details.')
        successMessage = `Employee "${result.employee_name}" created successfully! (ID: ${result.name})`

        // Location settings are created automatically by the backend based on the employee's branch
        console.log('📍 Location settings will be auto-created by backend based on branch:', form.branch)
      }

      // Create user account if requested
      if (form.create_user_account && form.user_email) {
          // Helper: Check if a user exists and is NOT linked to another employee
          const checkAndDeleteOrphanUser = async (email: string): Promise<boolean> => {
            try {
              // Check if user exists
              const userCheckRes = await csrfFetch(frappeApiUrl(`/api/resource/User/${email}`), {
                credentials: 'include',
              })
              if (!userCheckRes.ok) return false // User doesn't exist

              // Check if any OTHER employee is linked to this user
              const empCheckRes = await csrfFetch(frappeApiUrl(`/api/resource/Employee?filters=[["user_id","=","${email}"],["name","!=","${result.name}"]]&fields=["name","employee_name"]&limit_page_length=1`), {
                credentials: 'include',
              })
              if (!empCheckRes.ok) return false

              const empData = await empCheckRes.json()
              const linkedEmployees = empData.data || []

              if (linkedEmployees.length > 0) {
                // User is linked to another employee — cannot delete
                console.log(`⚠️ User ${email} is linked to employee: ${linkedEmployees[0].name} (${linkedEmployees[0].employee_name})`)
                successMessage += `\n\n⚠️ User account "${email}" already exists and is linked to another employee: ${linkedEmployees[0].employee_name} (${linkedEmployees[0].name}).\nPlease use a different email.`
                return false
              }

              // User exists but NOT linked to any other employee — safe to delete
              console.log(`🗑️ Deleting orphan user: ${email}`)
              const deleteRes = await csrfFetch(frappeApiUrl(`/api/resource/User/${email}`), {
                method: 'DELETE',
                credentials: 'include',
              })
              if (deleteRes.ok) {
                console.log(`✅ Orphan user ${email} deleted successfully`)
                return true // Deleted, can retry
              } else {
                console.error(`❌ Failed to delete orphan user ${email}`)
                return false
              }
            } catch (err) {
              console.error('Error checking/deleting orphan user:', err)
              return false
            }
          }

          // Helper: Create user with direct password
          const createUserWithPassword = async (): Promise<Response> => {
            return csrfFetch(frappeApiUrl('/api/method/hrms.hr.doctype.employee.employee_user_api.create_user_for_employee'), {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify({
                employee: result.name,
                email: form.user_email,
                password: form.user_password
              })
            })
          }

          // Helper: Create user with welcome email
          const createUserWithEmail = async (): Promise<Response> => {
            return csrfFetch(frappeApiUrl('/api/method/erpnext.setup.doctype.employee.employee.create_user'), {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify({
                employee: result.name,
                email: form.user_email
              })
            })
          }

          try {
            if (form.set_password_directly && form.user_password) {
              // Option 1: Use custom API to set password directly (user can login immediately)
              console.log('🔐 Creating user with direct password...')
              let userResponse = await createUserWithPassword()

              if (userResponse.ok) {
                const userResult = await userResponse.json()
                console.log('✅ User created with password:', userResult)
successMessage += `\n\n✅ User Account Created!\nUsername: ${form.user_email}\n\nThe user can login at https://${window.location.host}. A password reset link has been sent to their email.`
               } else {
                 const errorText = await userResponse.text()
                 console.error('❌ Failed to create user account:', errorText)

                 // Check if error is due to duplicate user
                 if (errorText.includes('DuplicateEntryError') || errorText.includes('Duplicate entry') || errorText.includes('PRIMARY')) {
                   console.log('🔍 User exists, checking if linked to another employee...')
                   const deleted = await checkAndDeleteOrphanUser(form.user_email)
                   if (deleted) {
                     // Retry creating the user
                     console.log('🔄 Retrying user creation after deleting orphan user...')
                     userResponse = await createUserWithPassword()
                     if (userResponse.ok) {
                       console.log('✅ User created successfully on retry')
                       successMessage += `\n\n✅ User Account Created!\nUsername: ${form.user_email}\n\nThe user can login at https://${window.location.host}. A password reset link has been sent to their email.`
                    } else {
                      const retryError = await userResponse.text()
                      successMessage += `\n\n⚠️ User creation failed on retry: ${retryError}`
                    }
                  }
                  // If not deleted, the message was already set by checkAndDeleteOrphanUser
                } else {
                  successMessage += `\n\n⚠️ User creation failed: ${errorText}`
                }
              }
            } else {
              // Option 2: Use built-in ERPNext API (sends welcome email with password reset)
              console.log('📧 Creating user with welcome email...')
              let userResponse = await createUserWithEmail()

              if (userResponse.ok) {
                const userResult = await userResponse.json()
                console.log('✅ User created, welcome email sent:', userResult)
                successMessage += `\n\n✅ User Account Created!\nUsername: ${form.user_email}\n📧 A welcome email has been sent with password reset instructions.`
              } else {
                const errorText = await userResponse.text()
                console.error('❌ Failed to create user account:', errorText)

                // Check if error is due to duplicate user
                if (errorText.includes('DuplicateEntryError') || errorText.includes('Duplicate entry') || errorText.includes('PRIMARY')) {
                  console.log('🔍 User exists, checking if linked to another employee...')
                  const deleted = await checkAndDeleteOrphanUser(form.user_email)
                  if (deleted) {
                    // Retry creating the user
                    console.log('🔄 Retrying user creation after deleting orphan user...')
                    userResponse = await createUserWithEmail()
                    if (userResponse.ok) {
                      console.log('✅ User created successfully on retry')
                      successMessage += `\n\n✅ User Account Created!\nUsername: ${form.user_email}\n📧 A welcome email has been sent with password reset instructions.`
                    } else {
                      const retryError = await userResponse.text()
                      successMessage += `\n\n⚠️ User creation failed on retry: ${retryError}`
                    }
                  }
                  // If not deleted, the message was already set by checkAndDeleteOrphanUser
                } else {
                  successMessage += '\n\n⚠️ Note: Employee created but user account creation failed. Please create manually.'
                }
              }
            }
          } catch (userError: any) {
            console.error('❌ User creation error:', userError)
            const errorMsg = userError?.message || userError?.toString() || ''

            if (errorMsg.includes('DuplicateEntryError') || errorMsg.includes('Duplicate entry') || errorMsg.includes('PRIMARY')) {
              const deleted = await checkAndDeleteOrphanUser(form.user_email)
              if (deleted) {
                successMessage += '\n\n🔄 Orphan user was removed. Please try saving again to create the user account.'
              }
            } else {
              successMessage += '\n\n⚠️ Note: Employee created but user account creation failed.'
            }
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

        setSaveResult({ success: true, message: successMessage })
        setIsDirty(false)
        // Reset form after success
        setTimeout(() => {
          onBack()
        }, 3000)
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

  const validateStep = (s: number): Record<string, string> => {
    const errors: Record<string, string> = {}
    if (s === 1) {
      if (!form.first_name.trim()) errors.first_name = 'First Name is required'
      if (!form.gender) errors.gender = 'Gender is required'
      if (!form.date_of_birth) errors.date_of_birth = 'Date of Birth is required'
      if (!form.date_of_joining) errors.date_of_joining = 'Date of Joining is required'
    }
    if (s === 2) {
      if (!form.company) errors.company = 'Company is required'
    }
    return errors
  }

  const handleNextStep = () => {
    const errors = validateStep(step)
    setFieldErrors(errors)
    if (Object.keys(errors).length > 0) {
      const fieldNames: Record<string, string> = {
        first_name: 'First Name', gender: 'Gender',
        date_of_birth: 'Date of Birth', date_of_joining: 'Date of Joining', company: 'Company',
      }
      const missing = Object.keys(errors).map(k => fieldNames[k] || k).join(', ')
      setSaveResult({ success: false, message: `Please complete: ${missing}` })
      const el = document.querySelector(`[data-field="${Object.keys(errors)[0]}"]`)
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      return
    }
    setSaveResult(null)
    setStep(s => s + 1)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <>
      <div className="p-6 max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => guardedNavigate(onBack)} className="hover:bg-accent">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-foreground">{employeeId ? 'Edit Employee' : 'New Employee'}</h1>
              <p className="text-muted-foreground text-sm mt-0.5">{employeeId ? 'Update employee information' : 'Create a new employee record'}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => guardedNavigate(onBack)}>Cancel</Button>
            {step > 1 && (
              <Button variant="outline" onClick={() => { setSaveResult(null); setStep(s => s - 1); window.scrollTo({ top: 0, behavior: 'smooth' }) }}>
                ← Previous
              </Button>
            )}
            {step < totalSteps ? (
              <Button className="bg-primary hover:bg-primary/90" onClick={handleNextStep}>
                Next <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            ) : (
              <Button className="bg-primary hover:bg-primary/90" onClick={handleSave} disabled={saving}>
                {saving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Saving...</> : <><Save className="h-4 w-4 mr-2" /> Save Employee</>}
              </Button>
            )}
          </div>
        </div>

        {/* ── Step Progress Bar ── */}
        <div className="mb-6">
          <div className="flex items-center">
            {STEPS.map((s, i) => {
              const n = i + 1
              const isCompleted = step > n
              const isCurrent = step === n
              return (
                <React.Fragment key={n}>
                  <div className="flex flex-col items-center shrink-0">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors
                      ${isCompleted ? 'bg-green-500 text-white' : isCurrent ? 'bg-primary text-white' : 'bg-muted text-muted-foreground'}`}>
                      {isCompleted ? <CheckCircle className="h-4 w-4" /> : n}
                    </div>
                    <div className="mt-1 text-center hidden sm:block">
                      <p className={`text-xs font-medium leading-tight ${isCurrent ? 'text-primary' : isCompleted ? 'text-green-600' : 'text-muted-foreground/70'}`}>{s.title}</p>
                      <p className="text-[10px] text-muted-foreground/70 leading-tight">{s.subtitle}</p>
                    </div>
                  </div>
                  {i < STEPS.length - 1 && (
                    <div className={`flex-1 h-0.5 mx-2 mb-5 transition-colors ${step > n ? 'bg-green-400' : 'bg-muted'}`} />
                  )}
                </React.Fragment>
              )
            })}
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

        <div className="grid grid-cols-12 gap-8">
          {/* Left: Photo */}
          <div className="col-span-12 md:col-span-3 space-y-6">
            <div className="bg-card p-6 rounded-xl border border-border text-center">
              <div className="w-28 h-28 bg-muted rounded-full mx-auto mb-4 flex items-center justify-center border-2 border-dashed border-input overflow-hidden relative group">
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
                  <span className="text-3xl font-bold text-muted-foreground/70">
                    {form.first_name[0]}{form.last_name ? form.last_name[0] : ''}
                  </span>
                ) : (
                  <User className="h-10 w-10 text-muted-foreground/70" />
                )}
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  disabled={uploadingImage}
                />
              </div>
              <p className="text-sm font-medium text-foreground/90">
                {uploadingImage ? 'Uploading...' : 'Profile Photo'}
              </p>
              <p className="text-xs text-muted-foreground/70 mt-1">
                {uploadingImage ? (
                  <Loader2 className="h-3 w-3 animate-spin inline" />
                ) : (
                  'Click to upload (max 2MB)'
                )}
              </p>
            </div>

            {/* Required Fields Indicator — step-aware */}
            {step === 1 && (
              <div className="bg-accent p-4 rounded-xl border border-primary/15">
                <p className="text-xs font-semibold text-accent-foreground mb-2">Required this step</p>
                <ul className="text-xs text-primary space-y-1">
                  <li className={form.first_name ? 'line-through opacity-50' : ''}>- First Name</li>
                  <li className={form.gender ? 'line-through opacity-50' : ''}>- Gender</li>
                  <li className={form.date_of_birth ? 'line-through opacity-50' : ''}>- Date of Birth</li>
                  <li className={form.date_of_joining ? 'line-through opacity-50' : ''}>- Date of Joining</li>
                </ul>
              </div>
            )}
            {step === 2 && (
              <div className="bg-accent p-4 rounded-xl border border-primary/15">
                <p className="text-xs font-semibold text-accent-foreground mb-2">Required this step</p>
                <ul className="text-xs text-primary space-y-1">
                  <li className={form.company ? 'line-through opacity-50' : ''}>- Company</li>
                </ul>
              </div>
            )}
            {step > 2 && (
              <div className="bg-green-50 p-4 rounded-xl border border-green-100">
                <p className="text-xs font-semibold text-green-700">All required fields complete</p>
                <p className="text-xs text-green-600 mt-1">Step {step} of {totalSteps}</p>
              </div>
            )}
          </div>

          {/* Right: Form */}
          <div className="col-span-12 md:col-span-9 space-y-6">
            {/* Step 1 — Personal Details */}
            {step === 1 && <div className="bg-card rounded-xl border border-border shadow-sm p-6">
              <h2 className="text-lg font-bold text-foreground mb-5 flex items-center gap-2">
                <User className="h-5 w-5 text-primary" />
                Personal Details
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <div className="space-y-2" data-field="first_name">
                  <Label className="text-sm font-medium">First Name <span className="text-red-500">*</span></Label>
                  <Input
                    className={errorBorder('first_name')}
                    placeholder="Enter first name"
                    value={form.first_name}
                    onChange={(e) => updateField('first_name', e.target.value)}
                  />
                  {fieldErrors.first_name && <p className="text-xs text-red-500">{fieldErrors.first_name}</p>}
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Middle Name</Label>
                  <Input
                    placeholder="Enter middle name"
                    value={form.middle_name}
                    onChange={(e) => updateField('middle_name', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Last Name</Label>
                  <Input
                    placeholder="Enter last name"
                    value={form.last_name}
                    onChange={(e) => updateField('last_name', e.target.value)}
                  />
                </div>
                <div className="space-y-2" data-field="gender">
                  <Label className="text-sm font-medium">Gender <span className="text-red-500">*</span></Label>
                  <select
                    className={`flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${errorBorder('gender')}`}
                    value={form.gender}
                    onChange={(e) => updateField('gender', e.target.value)}
                  >
                    <option value="">Select Gender</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                  </select>
                  {fieldErrors.gender && <p className="text-xs text-red-500">{fieldErrors.gender}</p>}
                </div>
                <div className="space-y-2" data-field="date_of_birth">
                  <Label className="text-sm font-medium">Date of Birth <span className="text-red-500">*</span></Label>
                  <Input
                    type="date"
                    className={errorBorder('date_of_birth')}
                    value={form.date_of_birth}
                    onChange={(e) => updateField('date_of_birth', e.target.value)}
                  />
                  {fieldErrors.date_of_birth && <p className="text-xs text-red-500">{fieldErrors.date_of_birth}</p>}
                </div>
                <div className="space-y-2" data-field="date_of_joining">
                  <Label className="text-sm font-medium">Date of Joining <span className="text-red-500">*</span></Label>
                  <Input
                    type="date"
                    className={errorBorder('date_of_joining')}
                    value={form.date_of_joining}
                    onChange={(e) => updateField('date_of_joining', e.target.value)}
                  />
                  {fieldErrors.date_of_joining && <p className="text-xs text-red-500">{fieldErrors.date_of_joining}</p>}
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">ID Type</Label>
                  <select
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    value={form.custom_id_type}
                    onChange={(e) => updateField('custom_id_type', e.target.value)}
                  >
                    <option value="">Select ID Type</option>
                    <option value="National ID">National ID - هوية وطنية</option>
                    <option value="Iqama">Iqama - إقامة</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">National ID / Iqama Number</Label>
                  <Input
                    placeholder={form.custom_id_type === 'Iqama' ? 'Enter Iqama number' : 'Enter National ID number'}
                    value={form.custom_national_id}
                    onChange={(e) => updateField('custom_national_id', e.target.value)}
                  />
                  {form.custom_national_id && !/^\d{10}$/.test(form.custom_national_id) && (
                    <p className="text-xs text-amber-600">⚠️ ID number should be 10 digits</p>
                  )}
                </div>
              </div>
            </div>}

            {/* Step 2 — Company Details */}
            {step === 2 && <div className="bg-card rounded-xl border border-border shadow-sm p-6">
              <h2 className="text-lg font-bold text-foreground mb-5">Company Details</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-2" data-field="company">
                  <Label className="text-sm font-medium">Company <span className="text-red-500">*</span></Label>
                  <select
                    className={`flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${errorBorder('company')}`}
                    value={form.company}
                    onChange={(e) => {
                      updateField('company', e.target.value)
                      // Reset department when company changes
                      if (form.department) {
                        updateField('department', '')
                      }
                    }}
                  >
                    <option value="">Select Company</option>
                    {dropdowns.companies.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                  {fieldErrors.company && <p className="text-xs text-red-500">{fieldErrors.company}</p>}
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Department</Label>
                  <select
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                    value={form.department}
                    onChange={(e) => updateField('department', e.target.value)}
                    disabled={!form.company}
                  >
                    <option value="">{!form.company ? 'Select Company First' : 'Select Department'}</option>
                    {dropdowns.departments
                      .filter(d => d.department_name !== 'All Departments' && (!form.company || d.company === form.company))
                      .map(d => (
                        <option key={d.name} value={d.name}>{d.department_name}</option>
                      ))
                    }
                  </select>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Designation</Label>
                  <select
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    value={form.designation}
                    onChange={(e) => updateField('designation', e.target.value)}
                  >
                    <option value="">Select Designation</option>
                    {dropdowns.designations.map(d => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Employment Mode</Label>
                  <select
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    value={form.employment_mode}
                    onChange={(e) => updateField('employment_mode', e.target.value)}
                  >
                    <option value="">Select Mode</option>
                    <option value="Full-time">Full-time</option>
                    <option value="Part-time">Part-time</option>
                    <option value="On-site">On-site</option>
                    <option value="Remote">Remote</option>
                    <option value="Hybrid">Hybrid</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Branch {form.employment_mode !== 'Remote' && <span className="text-red-500">*</span>}</Label>
                  <select
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    value={form.branch}
                    onChange={(e) => updateField('branch', e.target.value)}
                    disabled={form.employment_mode === 'Remote'}
                  >
                    <option value="">{form.employment_mode === 'Remote' ? 'Work From Home' : 'Select Branch'}</option>
                    {dropdowns.branches.map(b => (
                      <option key={b} value={b}>{b}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Status</Label>
                  <select
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    value={form.status}
                    onChange={(e) => updateField('status', e.target.value)}
                  >
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                    <option value="Suspended">Suspended</option>
                    <option value="Left">Left</option>
                  </select>
                </div>
              </div>
            </div>}

            {/* Step 3 — Contact Information */}
            {step === 3 && <div className="bg-card rounded-xl border border-border shadow-sm p-6">
              <h2 className="text-lg font-bold text-foreground mb-5">Contact Information</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Mobile Number</Label>
                  <Input
                    type="tel"
                    placeholder="+20 1xx xxxx xxx"
                    value={form.cell_number}
                    onChange={(e) => updateField('cell_number', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Personal Email</Label>
                  <Input
                    type="email"
                    placeholder="name@email.com"
                    value={form.personal_email}
                    onChange={(e) => updateField('personal_email', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Company Email</Label>
                  <Input
                    type="email"
                    placeholder="name@company.com"
                    value={form.company_email}
                    onChange={(e) => updateField('company_email', e.target.value)}
                  />
                </div>
              </div>
            </div>}

            {/* Step 4 — Work Settings & System Access */}
            {step === 4 && <div className="bg-card rounded-xl border border-border shadow-sm p-6">
              <h2 className="text-lg font-bold text-foreground mb-5">Work Settings</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Check-in Method</Label>
                  <select
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    value={form.checkin_method}
                    onChange={(e) => updateField('checkin_method', e.target.value)}
                  >
                    <option value="Manual">Manual (Simple Click)</option>
                    <option value="Photo">Photo (Selfie Required)</option>
                    <option value="Biometric" disabled>Biometric (Coming Soon - Hardware Device)</option>
                    <option value="Photo + Biometric" disabled>Photo + Biometric (Coming Soon)</option>
                  </select>
                  <p className="text-xs text-muted-foreground mt-1">
                    {form.checkin_method === 'Manual' && '✓ Simple button click for check-in/out'}
                    {form.checkin_method === 'Photo' && '📸 Employee must take selfie for verification'}
                    {form.checkin_method === 'Biometric' && '⚠️ Requires biometric hardware device (coming soon)'}
                    {form.checkin_method === 'Photo + Biometric' && '⚠️ Requires both photo and biometric (coming soon)'}
                  </p>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Default Shift</Label>
                  <select
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    value={form.default_shift}
                    onChange={(e) => updateField('default_shift', e.target.value)}
                  >
                    <option value="">No Default Shift</option>
                    {dropdowns.shifts.map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Enable Tracking</Label>
                  <div className="h-10 px-3 border rounded-md flex items-center">
                    <input
                      type="checkbox"
                      id="enable_tracking"
                      checked={form.enable_tracking}
                      onChange={(e) => updateField('enable_tracking', e.target.checked)}
                      className="h-4 w-4 rounded border-input"
                    />
                    <Label htmlFor="enable_tracking" className="text-sm font-normal ml-2 cursor-pointer">
                      Enable location tracking for this employee
                    </Label>
                  </div>
                </div>
                <div className="space-y-2" data-field="employee_consent">
                  <Label className="text-sm font-medium">Employee Consent</Label>
                  <div className={`h-10 px-3 border rounded-md flex items-center ${errorBorder('employee_consent')}`}>
                    <input
                      type="checkbox"
                      id="employee_consent"
                      checked={form.employee_consent}
                      onChange={(e) => updateField('employee_consent', e.target.checked)}
                      className="h-4 w-4 rounded border-input"
                    />
                    <Label htmlFor="employee_consent" className="text-sm font-normal ml-2 cursor-pointer">
                      Employee approved location tracking
                    </Label>
                  </div>
                  {fieldErrors.employee_consent && <p className="text-xs text-red-500">{fieldErrors.employee_consent}</p>}
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Tracking Interval</Label>
                  <select
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    value={form.tracking_interval}
                    onChange={(e) => updateField('tracking_interval', e.target.value)}
                  >
                    <option value="Minutes">Minutes</option>
                    <option value="Hours">Hours</option>
                    <option value="Seconds">Seconds</option>
                  </select>
                </div>
                <div className="space-y-2" data-field="interval_number">
                  <Label className="text-sm font-medium">Interval Number</Label>
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
                        ✅ User account exists for: <strong>{form.user_email}</strong>
                      </p>
                    </div>
                  )}

                  {/* Show warning if no user account */}
                  {employeeId && !form.user_email && !form.create_user_account && (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3 mb-3">
                      <p className="text-sm text-yellow-800">
                        ⚠️ This employee doesn't have a user account yet. Check the box below to create one.
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
                        ? 'Update/Replace user account'
                        : 'Create user account for this employee (allows app login)'}
                    </Label>
                  </div>
                  {form.create_user_account && (
                    <div className="ml-6 mt-3 space-y-4">
                      <div className="space-y-2" data-field="user_email">
                        <Label className="text-sm font-medium">User Email</Label>
                        <Input
                          type="email"
                          className={errorBorder('user_email')}
                          placeholder="user@example.com"
                          value={form.user_email}
                          onChange={(e) => updateField('user_email', e.target.value)}
                        />
                        {fieldErrors.user_email && <p className="text-xs text-red-500">{fieldErrors.user_email}</p>}
                      </div>

                      {/* Password option toggle */}
                      <div className="flex items-center space-x-2 bg-accent p-3 rounded-md">
                        <input
                          type="checkbox"
                          id="set_password"
                          checked={form.set_password_directly}
                          onChange={(e) => updateField('set_password_directly', e.target.checked)}
                          className="h-4 w-4 rounded border-input"
                        />
                        <Label htmlFor="set_password" className="text-sm cursor-pointer">
                          Set password directly (user can login immediately)
                        </Label>
                      </div>

                      {form.set_password_directly ? (
                        <div className="space-y-2 bg-green-50 p-3 rounded-md" data-field="user_password">
                          <Label className="text-sm font-medium">Password <span className="text-red-500">*</span></Label>
                          <Input
                            type="password"
                            className={errorBorder('user_password')}
                            placeholder="Min. 8 characters with uppercase, number & special char"
                            value={form.user_password}
                            onChange={(e) => updateField('user_password', e.target.value)}
                            minLength={8}
                          />
                          {fieldErrors.user_password && <p className="text-xs text-red-500">{fieldErrors.user_password}</p>}

                          {/* Password Requirements Checklist */}
                          {form.user_password && (
                            <div className="mt-2 space-y-1 text-xs">
                              <div className={`flex items-center gap-2 ${form.user_password.length >= 8 ? 'text-green-600' : 'text-muted-foreground'}`}>
                                {form.user_password.length >= 8 ? '✓' : '○'} At least 8 characters
                              </div>
                              <div className={`flex items-center gap-2 ${/[A-Z]/.test(form.user_password) ? 'text-green-600' : 'text-muted-foreground'}`}>
                                {/[A-Z]/.test(form.user_password) ? '✓' : '○'} One uppercase letter (A-Z)
                              </div>
                              <div className={`flex items-center gap-2 ${/[a-z]/.test(form.user_password) ? 'text-green-600' : 'text-muted-foreground'}`}>
                                {/[a-z]/.test(form.user_password) ? '✓' : '○'} One lowercase letter (a-z)
                              </div>
                              <div className={`flex items-center gap-2 ${/[0-9]/.test(form.user_password) ? 'text-green-600' : 'text-muted-foreground'}`}>
                                {/[0-9]/.test(form.user_password) ? '✓' : '○'} One number (0-9)
                              </div>
                              <div className={`flex items-center gap-2 ${/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(form.user_password) ? 'text-green-600' : 'text-muted-foreground'}`}>
                                {/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(form.user_password) ? '✓' : '○'} One special character (!@#$%^&*)
                              </div>
                            </div>
                          )}

                          <p className="text-xs text-green-700 mt-2">
                            ✅ User can login immediately with this password. Make sure to save it!
                          </p>
                        </div>
                      ) : (
                        <p className="text-xs text-primary bg-accent p-2 rounded">
                          📧 User will receive a welcome email with password reset link
                        </p>
                      )}
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground ml-6">
                    {form.create_user_account && form.user_email
                      ? `User account will be created for: ${form.user_email}`
                      : 'If enabled, a user account will be created automatically with Employee Self-Service role.'}
                  </p>
                </div>
              </div>
            </div>}

            {/* Step 5 — Employee Documents (edit mode only) */}
            {step === 5 && employeeId && (
              <div className="bg-card rounded-xl border border-border shadow-sm p-6">
                <EmployeeDocuments
                  employeeId={employeeId}
                  employeeName={form.first_name ? `${form.first_name} ${form.last_name || ''}`.trim() : undefined}
                  canDelete={true}
                  canUpload={true}
                  compact={false}
                  isRTL={false}
                />
              </div>
            )}
          </div>
        </div>
      </div>

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