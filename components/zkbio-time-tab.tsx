'use client'

import { useState, useEffect, useCallback } from 'react'
import { frappeClient } from '@/lib/api-client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import { useToast } from '@/hooks/use-toast'
import {
  EmployeeClassificationFilters,
  type ClassificationFilters,
} from '@/components/biometric/employee-classification-filters'

// ==================== Types ====================

interface ZKTecoConfig {
  enable_sync: boolean
  username: string
  server_ip: string
  server_port: string
  seconds: string
  token: string
  has_password: boolean
  last_sync: string | null
  total_synced_records: number
}

interface TransactionPreview {
  id: number
  employee_code: string
  employee_name: string
  erpnext_employee: string | null
  punch_time: string
  log_type: string
  punch_state_display: string
  device_id: string
  verify_method: string
  zkteco_name: string
}

interface SyncStatus {
  enabled: boolean
  sync_frequency: string
  last_sync: string | null
  recent_checkins_24h: number
  server_configured: boolean
  token_configured: boolean
}

import {
  Server,
  Key,
  RefreshCw,
  Loader2,
  Save,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Wifi,
  WifiOff,
  Clock,
  Zap,
  Eye,
  EyeOff,
} from 'lucide-react'

const SYNC_FREQUENCY_OPTIONS = [
  { value: '10', labelKey: 'zk.freq_10s' },
  { value: '30', labelKey: 'zk.freq_30s' },
  { value: '60', labelKey: 'zk.freq_1m' },
  { value: '120', labelKey: 'zk.freq_2m' },
  { value: '300', labelKey: 'zk.freq_5m' },
  { value: '600', labelKey: 'zk.freq_10m' },
  { value: '900', labelKey: 'zk.freq_15m' },
  { value: '1800', labelKey: 'zk.freq_30m' },
  { value: '3600', labelKey: 'zk.freq_1h' },
]

// ==================== Main Component ====================

export function ZKBioTimeTab({ t }: { t: (k: string) => string }) {
  const { toast } = useToast()

  // State
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [appInstalled, setAppInstalled] = useState<boolean | null>(null)
  const [config, setConfig] = useState<ZKTecoConfig | null>(null)
  const [showPassword, setShowPassword] = useState(false)

  // Form state
  const [enableSync, setEnableSync] = useState(false)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [serverIp, setServerIp] = useState('')
  const [serverPort, setServerPort] = useState('80')
  const [seconds, setSeconds] = useState('300')

  // Action state
  const [registeringToken, setRegisteringToken] = useState(false)
  const [testingConnection, setTestingConnection] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null)
  const [testResult, setTestResult] = useState<any>(null)
  const [classFilters, setClassFilters] = useState<ClassificationFilters>({})

  // Load config
  const loadConfig = useCallback(async () => {
    try {
      setLoading(true)
      // Check if app is installed
      const checkRes = await frappeClient.call(
        'base_meena.biometric_management.zkteco_sync.check_zkteco_app_installed'
      )
      const installed = checkRes?.message?.installed ?? false
      setAppInstalled(installed)

      if (!installed) {
        setLoading(false)
        return
      }

      // Load config
      const cfgRes = await frappeClient.call(
        'base_meena.biometric_management.zkteco_sync.get_zkteco_config'
      )
      const cfg: ZKTecoConfig = cfgRes?.message ?? cfgRes
      setConfig(cfg)
      setEnableSync(cfg.enable_sync)
      setUsername(cfg.username)
      setPassword('')
      setServerIp(cfg.server_ip)
      setServerPort(cfg.server_port)
      setSeconds(cfg.seconds)

      // Load sync status
      try {
        const statusRes = await frappeClient.call(
          'base_meena.biometric_management.zkteco_sync.get_zkteco_sync_status'
        )
        const status: SyncStatus = statusRes?.message ?? statusRes
        setSyncStatus(status)
      } catch {
        // Ignore status errors
      }
    } catch (err: any) {
      if (err.message?.includes('not installed')) {
        setAppInstalled(false)
      } else {
        toast({ title: '❌', description: err.message || 'Failed to load config', variant: 'destructive' })
      }
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    loadConfig()
  }, [loadConfig])

  // Save config
  const handleSave = async () => {
    try {
      setSaving(true)
      await frappeClient.call('base_meena.biometric_management.zkteco_sync.save_zkteco_config', {
        enable_sync: enableSync,
        username,
        password: password || undefined,
        server_ip: serverIp,
        server_port: serverPort,
        seconds,
      })
      toast({ title: '✅', description: t('zk.config_saved') })
      await loadConfig()
    } catch (err: any) {
      toast({ title: '❌', description: err.message || 'Save failed', variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  // Register token
  const handleRegisterToken = async () => {
    try {
      setRegisteringToken(true)
      const rawRes = await frappeClient.call(
        'base_meena.biometric_management.zkteco_sync.register_zkteco_token'
      )
      const res = rawRes?.message ?? rawRes
      if (res?.success) {
        toast({ title: '✅', description: t('zk.token_registered') })
        await loadConfig()
      } else {
        toast({ title: '❌', description: res?.message || t('zk.token_failed'), variant: 'destructive' })
      }
    } catch (err: any) {
      toast({ title: '❌', description: err.message || 'Token registration failed', variant: 'destructive' })
    } finally {
      setRegisteringToken(false)
    }
  }

  // Test connection
  const handleTestConnection = async () => {
    try {
      setTestingConnection(true)
      setTestResult(null)
      const rawRes = await frappeClient.call(
        'base_meena.biometric_management.zkteco_sync.test_zkteco_connection'
      )
      const res = rawRes?.message ?? rawRes
      setTestResult(res)
      if (res?.ok) {
        toast({ title: '✅', description: `${t('zk.connected')} — ${res.total_transactions || 0} ${t('zk.transactions_today')}` })
      } else {
        toast({ title: '❌', description: res?.error || t('zk.connection_failed'), variant: 'destructive' })
      }
    } catch (err: any) {
      toast({ title: '❌', description: err.message || 'Connection test failed', variant: 'destructive' })
    } finally {
      setTestingConnection(false)
    }
  }

  // Manual sync
  const handleManualSync = async () => {
    try {
      setSyncing(true)
      const rawRes = await frappeClient.call(
        'base_meena.biometric_management.zkteco_sync.trigger_zkteco_sync'
      )
      const res = rawRes?.message ?? rawRes
      if (res?.success) {
        toast({ title: '✅', description: t('zk.sync_completed') })
        await loadConfig()
      } else {
        toast({ title: '❌', description: res?.message || t('zk.sync_failed'), variant: 'destructive' })
      }
    } catch (err: any) {
      toast({ title: '❌', description: err.message || 'Sync failed', variant: 'destructive' })
    } finally {
      setSyncing(false)
    }
  }

  // Loading state
  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    )
  }

  // App not installed
  if (appInstalled === false) {
    return (
      <Card className="border-amber-200 bg-amber-50">
        <CardContent className="p-6 text-center space-y-3">
          <AlertCircle className="h-12 w-12 text-amber-500 mx-auto" />
          <h3 className="text-lg font-semibold text-amber-800">{t('zk.app_not_installed')}</h3>
          <p className="text-sm text-amber-600">{t('zk.app_not_installed_desc')}</p>
          <code className="text-xs bg-amber-100 px-3 py-1 rounded-md block">
            bench --site [site] install-app zkteco_checkins_sync
          </code>
        </CardContent>
      </Card>
    )
  }

  const hasToken = !!(config?.token)
  const hasServer = !!(serverIp && serverPort)

  return (
    <div className="space-y-6">

      {/* Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              {enableSync ? (
                <div className="p-2 bg-green-100 rounded-lg">
                  <Zap className="h-5 w-5 text-green-600" />
                </div>
              ) : (
                <div className="p-2 bg-muted rounded-lg">
                  <WifiOff className="h-5 w-5 text-muted-foreground/70" />
                </div>
              )}
              <div>
                <p className="text-xs text-muted-foreground">{t('zk.sync_status')}</p>
                <p className="text-sm font-semibold">
                  {enableSync ? t('zk.active') : t('zk.inactive')}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${hasToken ? 'bg-green-100' : 'bg-red-100'}`}>
                <Key className={`h-5 w-5 ${hasToken ? 'text-green-600' : 'text-red-500'}`} />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{t('zk.api_token')}</p>
                <p className="text-sm font-semibold">
                  {hasToken ? t('zk.configured') : t('zk.not_configured')}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-accent rounded-lg">
                <Clock className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{t('zk.last_sync')}</p>
                <p className="text-sm font-semibold">
                  {config?.last_sync ? formatShortDateTime(config.last_sync) : t('zk.never')}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <RefreshCw className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{t('zk.total_synced')}</p>
                <p className="text-sm font-semibold">
                  {config?.total_synced_records || 0}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Configuration Form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Server className="h-5 w-5 text-primary" />
            {t('zk.connection_settings')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Enable Sync Toggle */}
          <div className="flex items-center justify-between p-4 bg-muted/40 rounded-lg">
            <div>
              <Label className="text-sm font-semibold">{t('zk.enable_sync')}</Label>
              <p className="text-xs text-muted-foreground mt-0.5">{t('zk.enable_sync_desc')}</p>
            </div>
            <Switch checked={enableSync} onCheckedChange={setEnableSync} />
          </div>

          {/* ZKBio Time Credentials */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-sm font-semibold">{t('zk.server_ip')}</Label>
              <Input
                value={serverIp}
                onChange={(e) => setServerIp(e.target.value)}
                placeholder="192.168.1.100"
                dir="ltr"
              />
              <p className="text-xs text-muted-foreground/70">{t('zk.server_ip_hint')}</p>
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-semibold">{t('zk.server_port')}</Label>
              <Input
                value={serverPort}
                onChange={(e) => setServerPort(e.target.value)}
                placeholder="80"
                dir="ltr"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-sm font-semibold">{t('zk.username')}</Label>
              <Input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder={t('zk.username_placeholder')}
                dir="ltr"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-semibold">{t('zk.password')}</Label>
              <div className="relative">
                <Input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={config?.has_password ? '••••••••' : t('zk.password_placeholder')}
                  dir="ltr"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          </div>

          {/* Sync Frequency */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold">{t('zk.sync_frequency')}</Label>
            <Select value={seconds} onValueChange={setSeconds}>
              <SelectTrigger className="w-full md:w-64">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SYNC_FREQUENCY_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {t(opt.labelKey)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground/70">{t('zk.sync_frequency_hint')}</p>
          </div>

          {/* Save + Action Buttons */}
          <div className="flex flex-wrap gap-3 pt-2 border-t">
            <Button
              onClick={handleSave}
              disabled={saving}
              className="bg-primary hover:bg-primary/90"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
              {t('zk.save_config')}
            </Button>

            <Button
              variant="outline"
              onClick={handleRegisterToken}
              disabled={registeringToken || !hasServer || !username}
            >
              {registeringToken ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Key className="h-4 w-4 mr-2" />}
              {t('zk.register_token')}
            </Button>

            <Button
              variant="outline"
              onClick={handleTestConnection}
              disabled={testingConnection || !hasToken}
            >
              {testingConnection ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Wifi className="h-4 w-4 mr-2" />}
              {t('zk.test_connection')}
            </Button>

            <Button
              variant="outline"
              onClick={handleManualSync}
              disabled={syncing || !hasToken || !enableSync}
            >
              {syncing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
              {t('zk.manual_sync')}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Test Connection Results */}
      {testResult && (
        <Card className={testResult.ok ? 'border-green-200' : 'border-red-200'}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              {testResult.ok ? (
                <CheckCircle2 className="h-5 w-5 text-green-600" />
              ) : (
                <XCircle className="h-5 w-5 text-red-500" />
              )}
              {t('zk.test_results')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {testResult.ok ? (
              <div className="space-y-4">
                <div className="flex items-center gap-4 text-sm">
                  <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                    {testResult.total_transactions || 0} {t('zk.transactions_today')}
                  </Badge>
                </div>

                {testResult.transactions_preview?.length > 0 && (
                  <div className="overflow-x-auto">
                    {/* Classification filters for preview */}
                    <div className="mb-3">
                      <EmployeeClassificationFilters
                        branches={[]}
                        filters={classFilters}
                        onChange={setClassFilters}
                        hideBranch
                      />
                    </div>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs">ID</TableHead>
                          <TableHead className="text-xs">{t('zk.employee')}</TableHead>
                          <TableHead className="text-xs">{t('zk.time')}</TableHead>
                          <TableHead className="text-xs">{t('zk.type')}</TableHead>
                          <TableHead className="text-xs">{t('zk.device')}</TableHead>
                          <TableHead className="text-xs">{t('zk.erpnext_status')}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {testResult.transactions_preview.map((txn: TransactionPreview) => (
                          <TableRow key={txn.id}>
                            <TableCell className="text-xs font-mono">{txn.id}</TableCell>
                            <TableCell>
                              <div className="text-xs font-semibold">{txn.employee_code}</div>
                              <div className="text-[10px] text-muted-foreground/70">{txn.zkteco_name}</div>
                            </TableCell>
                            <TableCell className="text-xs">{txn.punch_time}</TableCell>
                            <TableCell>
                              <Badge
                                variant="outline"
                                className={txn.log_type === 'IN' ? 'bg-accent text-primary' : 'bg-red-50 text-red-700'}
                              >
                                {txn.log_type}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-xs">{txn.device_id || '-'}</TableCell>
                            <TableCell>
                              {txn.erpnext_employee ? (
                                <Badge variant="outline" className="bg-green-50 text-green-700 text-[10px]">
                                  ✅ {t('zk.mapped')}
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="bg-amber-50 text-amber-700 text-[10px]">
                                  ⚠ {t('zk.not_found')}
                                </Badge>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}

                <div className="p-3 bg-accent rounded-lg text-xs text-primary">
                  💡 {t('zk.mapping_tip')}
                </div>
              </div>
            ) : (
              <div className="p-4 bg-red-50 rounded-lg">
                <p className="text-sm text-red-700 font-medium">{testResult.error}</p>
                {testResult.status_code && (
                  <p className="text-xs text-red-500 mt-1">HTTP {testResult.status_code}</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* How it works */}
      <Card className="bg-muted/40">
        <CardHeader>
          <CardTitle className="text-base">{t('zk.how_it_works')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 flex-wrap text-sm">
            <Badge variant="outline" className="bg-card">🔧 {t('zk.step_device')}</Badge>
            <span className="text-muted-foreground/70">→</span>
            <Badge variant="outline" className="bg-card">💻 {t('zk.step_zkbio')}</Badge>
            <span className="text-muted-foreground/70">→</span>
            <Badge variant="outline" className="bg-card">🔄 {t('zk.step_sync')}</Badge>
            <span className="text-muted-foreground/70">→</span>
            <Badge variant="outline" className="bg-card">📋 {t('zk.step_checkin')}</Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-3">{t('zk.how_it_works_desc')}</p>
        </CardContent>
      </Card>
    </div>
  )
}

// ==================== Helpers ====================

function formatShortDateTime(dt: string): string {
  try {
    const d = new Date(dt)
    return d.toLocaleString('en-GB', {
      day: '2-digit', month: '2-digit',
      hour: '2-digit', minute: '2-digit',
    })
  } catch {
    return dt
  }
}
