'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import {
  Loader2, LogOut, Building2, Search, Heart, Bell, BellOff, ExternalLink, Trash2, User as UserIcon,
} from 'lucide-react'
import { accountApi, ACCOUNT_EVENT, type AccountMe } from '@/lib/account-api'
import { useFavorites } from '@/lib/listing-collections'
import { useSavedSearches, queryToQS, describeSearch } from '@/lib/saved-searches'
import { formatPrice } from '@/lib/aqar-format'
import LoginCard from '@/components/store/account/login-card'
import MyListings from '@/components/store/account/my-listings'
import MyRequests from '@/components/store/account/my-requests'

type Phase = 'loading' | 'disabled' | 'guest' | 'authed'
type Tab = 'listings' | 'requests' | 'favorites' | 'searches'

const TABS: { id: Tab; label: string; icon: any }[] = [
  { id: 'listings', label: 'إعلاناتي', icon: Building2 },
  { id: 'requests', label: 'طلباتي', icon: Search },
  { id: 'favorites', label: 'المفضلة', icon: Heart },
  { id: 'searches', label: 'بحوثي المحفوظة', icon: Bell },
]

export default function AccountPage() {
  const [phase, setPhase] = useState<Phase>('loading')
  const [me, setMe] = useState<AccountMe | null>(null)
  const [tab, setTab] = useState<Tab>('listings')

  const refresh = useCallback(async () => {
    const { enabled } = await accountApi.getConfig()
    if (!enabled) { setPhase('disabled'); return }
    const m = await accountApi.getMe(true)
    setMe(m)
    setPhase(m.authenticated ? 'authed' : 'guest')
  }, [])

  useEffect(() => {
    refresh()
    const onAccount = () => refresh()
    window.addEventListener(ACCOUNT_EVENT, onAccount)
    return () => window.removeEventListener(ACCOUNT_EVENT, onAccount)
  }, [refresh])

  const logout = async () => { await accountApi.logout(); setTab('listings') }

  if (phase === 'loading') {
    return <div className="flex justify-center py-24"><Loader2 className="h-7 w-7 animate-spin text-[var(--aqar-green)]" /></div>
  }

  if (phase === 'disabled') {
    return (
      <div className="mx-auto max-w-md px-4 py-20 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[var(--aqar-sand-2)] text-[var(--aqar-kohl)]/50"><UserIcon className="h-8 w-8" /></div>
        <h1 className="aqar-display text-2xl text-[var(--aqar-green-d)]">الحسابات قريباً</h1>
        <p className="mt-2 text-sm leading-7 text-[var(--aqar-kohl)]/60">ميزة الحسابات وتسجيل الدخول قيد الإطلاق. حتى ذلك الحين، مفضّلاتك وبحوثك محفوظة على هذا الجهاز.</p>
        <Link href="/" className="aqar-btn mt-5 inline-flex">العودة للرئيسية</Link>
      </div>
    )
  }

  if (phase === 'guest') {
    return <div className="px-4 py-12"><LoginCard onLoggedIn={refresh} /></div>
  }

  // authed
  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--aqar-green)]/10 text-[var(--aqar-green-d)]"><UserIcon className="h-5 w-5" /></span>
          <div>
            <p className="font-bold text-[var(--aqar-kohl)]">{me?.full_name || 'حسابي'}</p>
            <p className="text-xs text-[var(--aqar-kohl)]/55" dir="ltr">{me?.phone || ''}</p>
          </div>
        </div>
        <button onClick={logout} className="inline-flex items-center gap-1.5 rounded-full border border-[var(--aqar-sand-2)] px-3 py-2 text-sm text-[var(--aqar-kohl)]/70 hover:border-[var(--aqar-clay)] hover:text-[var(--aqar-clay)]">
          <LogOut className="h-4 w-4" />خروج
        </button>
      </div>

      {/* tabs */}
      <div className="mb-5 flex gap-1 overflow-x-auto rounded-2xl border border-[var(--aqar-sand-2)] bg-[var(--aqar-surface)]/70 p-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl px-3 py-2 text-sm font-medium transition-colors ${tab === t.id ? 'bg-[var(--aqar-green)] text-white' : 'text-[var(--aqar-kohl)]/70 hover:bg-[var(--aqar-sand-2)]'}`}
          >
            <t.icon className="h-4 w-4" />{t.label}
          </button>
        ))}
      </div>

      {tab === 'listings' && <MyListings />}
      {tab === 'requests' && <MyRequests />}
      {tab === 'favorites' && <FavoritesTab />}
      {tab === 'searches' && <SearchesTab />}
    </div>
  )
}

function FavoritesTab() {
  const { items } = useFavorites()
  if (!items.length) {
    return (
      <div className="rounded-2xl border border-dashed border-[var(--aqar-sand-2)] p-10 text-center">
        <p className="text-[var(--aqar-kohl)]/60">لا توجد عقارات مفضّلة بعد.</p>
        <Link href="/search" className="aqar-btn mt-4 inline-flex">تصفّح العروض</Link>
      </div>
    )
  }
  return (
    <div className="space-y-2">
      <p className="text-xs text-[var(--aqar-kohl)]/50">تتزامن مفضّلاتك مع حسابك على كل أجهزتك.</p>
      {items.map((l) => (
        <Link key={l.name} href={`/listing/${l.name}`} className="flex items-center justify-between gap-3 rounded-2xl border border-[var(--aqar-border)] bg-[var(--aqar-surface)] p-3 hover:border-[var(--aqar-green)]">
          <div className="min-w-0">
            <p className="line-clamp-1 text-sm font-medium text-[var(--aqar-kohl)]">{l.title}</p>
            <p className="text-sm font-bold tabular-nums text-[var(--aqar-green-d)]">{formatPrice(l.price || 0, 'ar', l.listing_type)}</p>
          </div>
          <Heart className="h-4 w-4 shrink-0 fill-[var(--aqar-clay)] text-[var(--aqar-clay)]" />
        </Link>
      ))}
      <Link href="/favorites" className="mt-1 inline-flex items-center gap-1 text-sm font-medium text-[var(--aqar-green)] hover:underline">إدارة المفضلة <ExternalLink className="h-3.5 w-3.5" /></Link>
    </div>
  )
}

function SearchesTab() {
  const { items, remove, toggleAlert } = useSavedSearches()
  if (!items.length) {
    return (
      <div className="rounded-2xl border border-dashed border-[var(--aqar-sand-2)] p-10 text-center">
        <p className="text-[var(--aqar-kohl)]/60">لا توجد عمليات بحث محفوظة.</p>
        <Link href="/search" className="aqar-btn mt-4 inline-flex">ابدأ البحث</Link>
      </div>
    )
  }
  return (
    <div className="space-y-2">
      <p className="text-xs text-[var(--aqar-kohl)]/50">فعّل التنبيه ليصلك إشعار عند نزول عقار مطابق.</p>
      {items.map((s) => (
        <div key={s.id} className="flex items-center justify-between gap-2 rounded-2xl border border-[var(--aqar-border)] bg-[var(--aqar-surface)] p-3">
          <Link href={`/search?${queryToQS(s.query)}`} className="min-w-0 flex-1">
            <p className="line-clamp-1 text-sm font-medium text-[var(--aqar-kohl)]">{s.label || describeSearch(s.query)}</p>
          </Link>
          <button onClick={() => toggleAlert(s.id)} aria-label={s.alert ? 'إيقاف التنبيه' : 'تفعيل التنبيه'} title={s.alert ? 'التنبيه مفعّل' : 'التنبيه متوقف'} className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${s.alert ? 'bg-[var(--aqar-green)]/12 text-[var(--aqar-green-d)]' : 'text-[var(--aqar-kohl)]/40 hover:bg-[var(--aqar-sand-2)]'}`}>
            {s.alert ? <Bell className="h-4 w-4" /> : <BellOff className="h-4 w-4" />}
          </button>
          <button onClick={() => remove(s.id)} aria-label="حذف" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[var(--aqar-kohl)]/40 hover:bg-[var(--aqar-clay)]/10 hover:text-[var(--aqar-clay)]">
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  )
}
