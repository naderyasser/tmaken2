#!/usr/bin/env node

/**
 * Simple API Test Script
 * Test Frappe Backend connection without Next.js
 */

const http = require('http');

const FRAPPE_URL = 'https://qarawi.base.meena.sa';
const USERNAME = 'administrator';
const PASSWORD = 'admin';

// Helper function to make HTTP requests
function makeRequest(options, postData = null) {
    return new Promise((resolve, reject) => {
        const req = http.request(options, (res) => {
            let data = '';

            res.on('data', (chunk) => {
                data += chunk;
            });

            res.on('end', () => {
                try {
                    const parsed = JSON.parse(data);
                    resolve({ status: res.statusCode, headers: res.headers, data: parsed });
                } catch (e) {
                    resolve({ status: res.statusCode, headers: res.headers, data: data });
                }
            });
        });

        req.on('error', (error) => {
            reject(error);
        });

        if (postData) {
            req.write(postData);
        }

        req.end();
    });
}

// Test 1: Ping
async function testPing() {
    console.log('\n🔍 Test 1: Server Connectivity...');
    try {
        const options = {
            hostname: 'localhost',
            port: 8000,
            path: '/api/method/ping',
            method: 'GET',
        };

        const response = await makeRequest(options);
        if (response.status === 200 && response.data.message === 'pong') {
            console.log('✅ Server is reachable!');
            console.log(`   Response: ${JSON.stringify(response.data)}`);
            return true;
        } else {
            console.log('❌ Unexpected response:', response);
            return false;
        }
    } catch (error) {
        console.log('❌ Connection failed:', error.message);
        return false;
    }
}

// Test 2: Login
async function testLogin() {
    console.log('\n🔐 Test 2: Authentication...');
    try {
        const postData = JSON.stringify({
            usr: USERNAME,
            pwd: PASSWORD
        });

        const options = {
            hostname: 'localhost',
            port: 8000,
            path: '/api/method/login',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': postData.length
            }
        };

        const response = await makeRequest(options, postData);

        if (response.status === 200) {
            console.log('✅ Login successful!');

            // Extract cookies
            const cookies = response.headers['set-cookie'];
            if (cookies) {
                const sidCookie = cookies.find(c => c.startsWith('sid='));
                if (sidCookie) {
                    const sid = sidCookie.split(';')[0];
                    console.log(`   Session: ${sid.substring(0, 20)}...`);
                    return sid;
                }
            }
            return null;
        } else {
            console.log('❌ Login failed!');
            console.log('   Response:', response.data);
            return null;
        }
    } catch (error) {
        console.log('❌ Login error:', error.message);
        return null;
    }
}

// Test 3: Get Employees
async function testGetEmployees(sessionCookie) {
    console.log('\n👥 Test 3: Get Employees...');
    try {
        const options = {
            hostname: 'localhost',
            port: 8000,
            path: '/api/resource/Employee?limit_page_length=5',
            method: 'GET',
            headers: {
                'Cookie': sessionCookie
            }
        };

        const response = await makeRequest(options);

        if (response.status === 200 && response.data.data) {
            console.log('✅ Successfully fetched employees!');
            console.log(`   Total: ${response.data.data.length} employees`);

            response.data.data.forEach((emp, i) => {
                console.log(`   ${i + 1}. ${emp.employee_name || emp.name}`);
            });
            return true;
        } else {
            console.log('❌ Failed to fetch employees');
            console.log('   Response:', JSON.stringify(response.data).substring(0, 200));
            return false;
        }
    } catch (error) {
        console.log('❌ Error:', error.message);
        return false;
    }
}

// Test 4: Get Attendance
async function testGetAttendance(sessionCookie) {
    console.log('\n📅 Test 4: Get Attendance...');
    try {
        const today = new Date().toISOString().split('T')[0];
        const options = {
            hostname: 'localhost',
            port: 8000,
            path: `/api/resource/Attendance?limit_page_length=5&filters=[["attendance_date","=","${today}"]]`,
            method: 'GET',
            headers: {
                'Cookie': sessionCookie
            }
        };

        const response = await makeRequest(options);

        if (response.status === 200 && response.data.data) {
            console.log('✅ Successfully fetched attendance!');
            console.log(`   Total: ${response.data.data.length} records for today`);

            response.data.data.forEach((att, i) => {
                console.log(`   ${i + 1}. ${att.employee_name || att.employee} - ${att.status}`);
            });
            return true;
        } else {
            console.log('⚠️  No attendance records found (or failed)');
            console.log('   Response:', JSON.stringify(response.data).substring(0, 200));
            return false;
        }
    } catch (error) {
        console.log('❌ Error:', error.message);
        return false;
    }
}

// Main test runner
async function runTests() {
    console.log('╔════════════════════════════════════════════════╗');
    console.log('║   Frappe Backend API Test                      ║');
    console.log('╚════════════════════════════════════════════════╝');
    console.log(`\n🌐 Frappe URL: ${FRAPPE_URL}`);
    console.log(`👤 Username: ${USERNAME}`);
    console.log(`🔑 Password: ${'*'.repeat(PASSWORD.length)}`);

    let passed = 0;
    let failed = 0;

    // Test 1: Ping
    if (await testPing()) {
        passed++;
    } else {
        failed++;
        console.log('\n❌ Cannot reach server. Please ensure:');
        console.log('   1. Frappe is running (bench start)');
        console.log('   2. Server is on https://qarawi.base.meena.sa');
        return;
    }

    // Test 2: Login
    const sessionCookie = await testLogin();
    if (sessionCookie) {
        passed++;
    } else {
        failed++;
        console.log('\n❌ Cannot login. Please check:');
        console.log('   1. Username and password are correct');
        console.log('   2. User has required permissions');
        return;
    }

    // Test 3: Get Employees
    if (await testGetEmployees(sessionCookie)) {
        passed++;
    } else {
        failed++;
    }

    // Test 4: Get Attendance
    if (await testGetAttendance(sessionCookie)) {
        passed++;
    } else {
        // Not critical if no attendance records exist
        console.log('   (This is OK if no attendance records exist)');
    }

    // Summary
    console.log('\n╔════════════════════════════════════════════════╗');
    console.log('║   Test Summary                                 ║');
    console.log('╚════════════════════════════════════════════════╝');
    console.log(`\n✅ Passed: ${passed} tests`);
    console.log(`❌ Failed: ${failed} tests`);

    if (failed === 0) {
        console.log('\n🎉 All tests passed! Backend is ready!');
        console.log('\n📝 Next Steps:');
        console.log('   1. Update Node.js to v20+ (for Next.js)');
        console.log('   2. Run: npm run dev');
        console.log('   3. Open: http://localhost:3000/employees');
    } else {
        console.log('\n⚠️  Some tests failed. Please fix the issues above.');
    }
}

// Run tests
runTests().catch(console.error);
