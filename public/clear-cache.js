// Clear localStorage and reload
if (typeof window !== 'undefined') {
    localStorage.removeItem('frappe_auto_login')
    console.log('Cleared auto-login data. Please refresh the page.')
}
