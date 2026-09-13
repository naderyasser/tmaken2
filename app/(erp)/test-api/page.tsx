/**
 * API Connection Test Page
 * Test connection with Meena Base Backend
 */

'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { frappeClient } from '@/lib/api-client'
import { CheckCircle2, XCircle, Loader2, Server } from 'lucide-react'

export default function APITestPage() {
    const [testing, setTesting] = useState(false)
    const [results, setResults] = useState<any>({})

    const runTests = async () => {
        setTesting(true)
        const testResults: any = {}
        const baseUrl = window.location.origin

        // Test 1: Base URL connectivity
        try {
            const response = await fetch(`${baseUrl}/api/method/ping`, {
                method: 'GET',
            })
            testResults.connectivity = {
                success: response.ok,
                status: response.status,
                message: response.ok ? 'Server is reachable' : 'Server not responding',
            }
        } catch (error) {
            testResults.connectivity = {
                success: false,
                message: error instanceof Error ? error.message : 'Connection failed',
            }
        }

        // Test 2: Get Employees
        try {
            const employees = await frappeClient.getEmployees({ limit_page_length: 5 })
            testResults.getEmployees = {
                success: true,
                count: employees.length,
                message: `Successfully fetched ${employees.length} employees`,
                data: employees.slice(0, 2), // Show first 2
            }
        } catch (error) {
            testResults.getEmployees = {
                success: false,
                message: error instanceof Error ? error.message : 'Failed to fetch employees',
            }
        }

        // Test 3: Get Employee Stats
        try {
            const stats = await frappeClient.getEmployeeStats()
            testResults.getStats = {
                success: true,
                message: 'Successfully fetched stats',
                data: stats,
            }
        } catch (error) {
            testResults.getStats = {
                success: false,
                message: error instanceof Error ? error.message : 'Failed to fetch stats',
            }
        }

        // Test 4: Check DocType existence
        try {
            await frappeClient.getEmployees({ limit_page_length: 1 })
            testResults.docTypeExists = {
                success: true,
                message: 'Employee DocType exists and accessible',
            }
        } catch (error: any) {
            testResults.docTypeExists = {
                success: false,
                message: error?.message?.includes('404')
                    ? 'Employee DocType not found - HR module not installed?'
                    : 'Error accessing DocType',
            }
        }

        setResults(testResults)
        setTesting(false)
    }

    return (
        <div className="container mx-auto py-8 max-w-4xl">
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold">API Connection Test</h1>
                        <p className="text-muted-foreground mt-2">
                            Test connection with Meena Base Backend ({typeof window !== 'undefined' ? window.location.origin : ''})
                        </p>
                    </div>
                    <Button onClick={runTests} disabled={testing} size="lg">
                        {testing ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Testing...
                            </>
                        ) : (
                            <>
                                <Server className="mr-2 h-4 w-4" />
                                Run Tests
                            </>
                        )}
                    </Button>
                </div>

                {Object.keys(results).length > 0 && (
                    <div className="space-y-4">
                        {/* Connectivity Test */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    {results.connectivity?.success ? (
                                        <CheckCircle2 className="h-5 w-5 text-green-500" />
                                    ) : (
                                        <XCircle className="h-5 w-5 text-red-500" />
                                    )}
                                    1. Server Connectivity
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-2">
                                    <div className="flex items-center gap-2">
                                        <span className="text=sm font-medium">Status:</span>
                                        <Badge variant={results.connectivity?.success ? 'default' : 'destructive'}>
                                            {results.connectivity?.success ? 'Connected' : 'Failed'}
                                        </Badge>
                                    </div>
                                    <p className="text-sm text-muted-foreground">
                                        {results.connectivity?.message}
                                    </p>
                                    {results.connectivity?.status && (
                                        <p className="text-xs text-muted-foreground">
                                            HTTP Status: {results.connectivity.status}
                                        </p>
                                    )}
                                </div>
                            </CardContent>
                        </Card>

                        {/* Get Employees Test */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    {results.getEmployees?.success ? (
                                        <CheckCircle2 className="h-5 w-5 text-green-500" />
                                    ) : (
                                        <XCircle className="h-5 w-5 text-red-500" />
                                    )}
                                    2. Get Employees
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-2">
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm font-medium">Status:</span>
                                        <Badge variant={results.getEmployees?.success ? 'default' : 'destructive'}>
                                            {results.getEmployees?.success ? 'Success' : 'Failed'}
                                        </Badge>
                                    </div>
                                    <p className="text-sm text-muted-foreground">
                                        {results.getEmployees?.message}
                                    </p>
                                    {results.getEmployees?.data && (
                                        <div className="mt-4">
                                            <p className="text-sm font-medium mb-2">Sample Data:</p>
                                            <pre className="bg-muted p-3 rounded-md text-xs overflow-auto">
                                                {JSON.stringify(results.getEmployees.data, null, 2)}
                                            </pre>
                                        </div>
                                    )}
                                </div>
                            </CardContent>
                        </Card>

                        {/* Get Stats Test */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    {results.getStats?.success ? (
                                        <CheckCircle2 className="h-5 w-5 text-green-500" />
                                    ) : (
                                        <XCircle className="h-5 w-5 text-red-500" />
                                    )}
                                    3. Get Employee Stats
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-2">
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm font-medium">Status:</span>
                                        <Badge variant={results.getStats?.success ? 'default' : 'destructive'}>
                                            {results.getStats?.success ? 'Success' : 'Failed'}
                                        </Badge>
                                    </div>
                                    <p className="text-sm text-muted-foreground">
                                        {results.getStats?.message}
                                    </p>
                                    {results.getStats?.data && (
                                        <div className="mt-4 grid grid-cols-4 gap-4">
                                            <div className="bg-muted p-3 rounded-md">
                                                <p className="text-2xl font-bold">{results.getStats.data.total}</p>
                                                <p className="text-xs text-muted-foreground">Total</p>
                                            </div>
                                            <div className="bg-muted p-3 rounded-md">
                                                <p className="text-2xl font-bold">{results.getStats.data.active}</p>
                                                <p className="text-xs text-muted-foreground">Active</p>
                                            </div>
                                            <div className="bg-muted p-3 rounded-md">
                                                <p className="text-2xl font-bold">{results.getStats.data.inactive}</p>
                                                <p className="text-xs text-muted-foreground">Inactive</p>
                                            </div>
                                            <div className="bg-muted p-3 rounded-md">
                                                <p className="text-2xl font-bold">{results.getStats.data.onLeave}</p>
                                                <p className="text-xs text-muted-foreground">On Leave</p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </CardContent>
                        </Card>

                        {/* DocType Existence Test */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    {results.docTypeExists?.success ? (
                                        <CheckCircle2 className="h-5 w-5 text-green-500" />
                                    ) : (
                                        <XCircle className="h-5 w-5 text-red-500" />
                                    )}
                                    4. Employee DocType Check
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-2">
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm font-medium">Status:</span>
                                        <Badge variant={results.docTypeExists?.success ? 'default' : 'destructive'}>
                                            {results.docTypeExists?.success ? 'Exists' : 'Not Found'}
                                        </Badge>
                                    </div>
                                    <p className="text-sm text-muted-foreground">
                                        {results.docTypeExists?.message}
                                    </p>
                                    {!results.docTypeExists?.success && (
                                        <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                                            <p className="text-sm text-yellow-800">
                                                <strong>Possible Solutions:</strong>
                                            </p>
                                            <ul className="text-sm text-yellow-700 list-disc list-inside mt-1">
                                                <li>Install HR module: bench get-app hrms</li>
                                                <li>Install on site: bench --site [sitename] install-app hrms</li>
                                                <li>Check if server is running: bench start</li>
                                            </ul>
                                        </div>
                                    )}
                                </div>
                            </CardContent>
                        </Card>

                        {/* Summary */}
                        <Card className="border-2">
                            <CardHeader>
                                <CardTitle>Test Summary</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-2">
                                    {(() => {
                                        const passed = Object.values(results).filter((r: any) => r.success).length
                                        const total = Object.keys(results).length
                                        const allPassed = passed === total

                                        return (
                                            <>
                                                <div className="flex items-center gap-2">
                                                    {allPassed ? (
                                                        <CheckCircle2 className="h-6 w-6 text-green-500" />
                                                    ) : (
                                                        <XCircle className="h-6 w-6 text-yellow-500" />
                                                    )}
                                                    <span className="text-lg font-medium">
                                                        {passed} / {total} tests passed
                                                    </span>
                                                </div>
                                                {allPassed ? (
                                                    <p className="text-sm text-green-600">
                                                        ✅ All systems operational! Backend is connected and working.
                                                    </p>
                                                ) : (
                                                    <p className="text-sm text-yellow-600">
                                                        ⚠️ Some tests failed. Check details above.
                                                    </p>
                                                )}
                                            </>
                                        )
                                    })()}
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                )}

                {!Object.keys(results).length && (
                    <Card>
                        <CardContent className="py-12 text-center text-muted-foreground">
                            <Server className="h-12 w-12 mx-auto mb-4 opacity-50" />
                            <p>Click "Run Tests" to test the API connection</p>
                        </CardContent>
                    </Card>
                )}
            </div>
        </div>
    )
}
