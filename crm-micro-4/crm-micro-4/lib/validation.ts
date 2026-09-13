export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

export function validateUsername(username: string): boolean {
  // Username should be 3-20 characters, alphanumeric and underscores only
  const usernameRegex = /^[a-zA-Z0-9_]{3,20}$/
  return usernameRegex.test(username)
}

export function validatePassword(password: string): {
  isValid: boolean
  errors: string[]
} {
  const errors: string[] = []
  
  if (password.length < 8) {
    errors.push('يجب أن تكون كلمة المرور 8 أحرف على الأقل')
  }
  
  if (!/[A-Z]/.test(password)) {
    errors.push('يجب أن تحتوي على حرف كبير واحد على الأقل')
  }
  
  if (!/[a-z]/.test(password)) {
    errors.push('يجب أن تحتوي على حرف صغير واحد على الأقل')
  }
  
  if (!/[0-9]/.test(password)) {
    errors.push('يجب أن تحتوي على رقم واحد على الأقل')
  }
  
  return {
    isValid: errors.length === 0,
    errors
  }
}

export function validateSubdomain(subdomain: string): {
  isValid: boolean
  error?: string
} {
  // Subdomain should be 3-30 characters, lowercase alphanumeric and hyphens only
  const subdomainRegex = /^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$/
  
  if (!subdomainRegex.test(subdomain)) {
    return {
      isValid: false,
      error: 'يجب أن يكون النطاق الفرعي من 3-30 حرف، أحرف صغيرة وأرقام وشرطات فقط'
    }
  }
  
  // Check for reserved subdomains
  const reserved = ['www', 'api', 'admin', 'app', 'mail', 'ftp', 'localhost', 'test', 'staging', 'dev']
  if (reserved.includes(subdomain)) {
    return {
      isValid: false,
      error: 'هذا النطاق محجوز، الرجاء اختيار نطاق آخر'
    }
  }
  
  return { isValid: true }
}
