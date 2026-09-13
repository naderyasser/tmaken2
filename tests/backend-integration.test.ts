/**
 * Frappe Backend Integration Test
 * تأكد من أن جميع API endpoints تعمل بشكل صحيح
 */

import { frappeClient } from '@/lib/api-client'

// ==================== Test Configuration ====================

const BACKEND_URL = process.env.NEXT_PUBLIC_FRAPPE_URL || 'https://qarawi.base.meena.sa'

console.log('🔗 Testing Frappe Backend Integration')
console.log('📍 Backend URL:', BACKEND_URL)
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')

// ==================== Test Functions ====================

async function testEmployees() {
    console.log('👤 Testing Employee API...')
    try {
        const response = await frappeClient.get('Employee', undefined, {
            fields: ['name', 'employee_name', 'department', 'status'],
            filters: [['Employee', 'status', '=', 'Active']],
            limit_page_length: 5
        })
        console.log(`✅ Employees: ${response.data?.length || 0} records`)
        return true
    } catch (error) {
        console.error('❌ Employees API failed:', error)
        return false
    }
}

async function testAttendance() {
    console.log('📅 Testing Attendance API...')
    try {
        const response = await frappeClient.get('Attendance', undefined, {
            fields: ['name', 'employee', 'attendance_date', 'status'],
            limit_page_length: 5
        })
        console.log(`✅ Attendance: ${response.data?.length || 0} records`)
        return true
    } catch (error) {
        console.error('❌ Attendance API failed:', error)
        return false
    }
}

async function testLeaves() {
    console.log('🏖️  Testing Leave Application API...')
    try {
        const response = await frappeClient.get('Leave Application', undefined, {
            fields: ['name', 'employee', 'leave_type', 'status'],
            limit_page_length: 5
        })
        console.log(`✅ Leave Applications: ${response.data?.length || 0} records`)
        return true
    } catch (error) {
        console.error('❌ Leave Application API failed:', error)
        return false
    }
}

async function testSalarySlips() {
    console.log('💰 Testing Salary Slip API...')
    try {
        const response = await frappeClient.get('Salary Slip', undefined, {
            fields: ['name', 'employee', 'gross_pay', 'net_pay'],
            limit_page_length: 5
        })
        console.log(`✅ Salary Slips: ${response.data?.length || 0} records`)
        return true
    } catch (error) {
        console.error('❌ Salary Slip API failed:', error)
        return false
    }
}

async function testPayrollSettings() {
    console.log('⚙️  Testing Payroll Settings API...')
    try {
        const response = await frappeClient.call('frappe.client.get', {
            doctype: 'Payroll Settings',
            name: 'Payroll Settings'
        })
        console.log('✅ Payroll Settings: Retrieved successfully')
        return true
    } catch (error) {
        console.error('❌ Payroll Settings API failed:', error)
        return false
    }
}

async function testExpenseClaims() {
    console.log('💳 Testing Expense Claim API...')
    try {
        const response = await frappeClient.get('Expense Claim', undefined, {
            fields: ['name', 'employee', 'total_claimed_amount', 'status'],
            limit_page_length: 5
        })
        console.log(`✅ Expense Claims: ${response.data?.length || 0} records`)
        return true
    } catch (error) {
        console.error('❌ Expense Claim API failed:', error)
        return false
    }
}

async function testShiftTypes() {
    console.log('🕐 Testing Shift Type API...')
    try {
        const response = await frappeClient.get('Shift Type', undefined, {
            fields: ['name', 'start_time', 'end_time'],
            limit_page_length: 5
        })
        console.log(`✅ Shift Types: ${response.data?.length || 0} records`)
        return true
    } catch (error) {
        console.error('❌ Shift Type API failed:', error)
        return false
    }
}

async function testDepartments() {
    console.log('🏢 Testing Department API...')
    try {
        const response = await frappeClient.get('Department', undefined, {
            fields: ['name', 'parent_department', 'company'],
            limit_page_length: 5
        })
        console.log(`✅ Departments: ${response.data?.length || 0} records`)
        return true
    } catch (error) {
        console.error('❌ Department API failed:', error)
        return false
    }
}

async function testBranches() {
    console.log('🌍 Testing Branch API...')
    try {
        const response = await frappeClient.get('Branch', undefined, {
            fields: ['name', 'branch'],
            limit_page_length: 5
        })
        console.log(`✅ Branches: ${response.data?.length || 0} records`)
        return true
    } catch (error) {
        console.error('❌ Branch API failed:', error)
        return false
    }
}

async function testLeaveTypes() {
    console.log('📋 Testing Leave Type API...')
    try {
        const response = await frappeClient.get('Leave Type', undefined, {
            fields: ['name', 'max_leaves_allowed', 'is_lwp'],
            limit_page_length: 5
        })
        console.log(`✅ Leave Types: ${response.data?.length || 0} records`)
        return true
    } catch (error) {
        console.error('❌ Leave Type API failed:', error)
        return false
    }
}

async function testNotifications() {
    console.log('🔔 Testing Notification Log API...')
    try {
        const response = await frappeClient.get('Notification Log', undefined, {
            fields: ['name', 'subject', 'read'],
            limit_page_length: 5
        })
        console.log(`✅ Notifications: ${response.data?.length || 0} records`)
        return true
    } catch (error) {
        console.error('❌ Notification Log API failed:', error)
        return false
    }
}

async function testHRSettings() {
    console.log('⚙️  Testing HR Settings API...')
    try {
        const response = await frappeClient.call('frappe.client.get', {
            doctype: 'HR Settings',
            name: 'HR Settings'
        })
        console.log('✅ HR Settings: Retrieved successfully')
        return true
    } catch (error) {
        console.error('❌ HR Settings API failed:', error)
        return false
    }
}

// ==================== Run All Tests ====================

async function runAllTests() {
    console.log('\n🚀 Starting Comprehensive Backend Tests...\n')

    const tests = [
        { name: 'Employees', fn: testEmployees },
        { name: 'Attendance', fn: testAttendance },
        { name: 'Leaves', fn: testLeaves },
        { name: 'Salary Slips', fn: testSalarySlips },
        { name: 'Payroll Settings', fn: testPayrollSettings },
        { name: 'Expense Claims', fn: testExpenseClaims },
        { name: 'Shift Types', fn: testShiftTypes },
        { name: 'Departments', fn: testDepartments },
        { name: 'Branches', fn: testBranches },
        { name: 'Leave Types', fn: testLeaveTypes },
        { name: 'Notifications', fn: testNotifications },
        { name: 'HR Settings', fn: testHRSettings },
    ]

    let passed = 0
    let failed = 0

    for (const test of tests) {
        const result = await test.fn()
        if (result) {
            passed++
        } else {
            failed++
        }
        console.log('') // Empty line between tests
    }

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('📊 Test Results:')
    console.log(`✅ Passed: ${passed}/${tests.length}`)
    console.log(`❌ Failed: ${failed}/${tests.length}`)
    console.log(`📈 Success Rate: ${Math.round((passed / tests.length) * 100)}%`)
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')

    if (failed === 0) {
        console.log('🎉 All tests passed! Backend integration is working perfectly.')
    } else {
        console.log('⚠️  Some tests failed. Please check your Frappe backend connection.')
        console.log('💡 Tip: Make sure Frappe is running on', BACKEND_URL)
    }
}

// Export for use in other files
export { runAllTests }

// Run tests if this file is executed directly
if (typeof window !== 'undefined') {
    console.log('⚠️  This test should be run in Node.js environment, not browser')
} else {
    runAllTests().catch(console.error)
}
