'use client'

import { useEffect } from 'react'
import { accountApi, ACCOUNT_EVENT } from '@/lib/account-api'
import { syncOnLogin, mirror, resetSyncState } from '@/lib/account-sync'

// Invisible island (mounted once in the store layout). When a phone-account session exists,
// it reconciles the localStorage favorites + saved searches with the server, then mirrors
// ongoing local changes. Fully inert while the accounts flag is off or the user is a guest —
// so it costs a single account_config() call and nothing else on qarawi today.

export default function AccountSync() {
  useEffect(() => {
    let alive = true
    let authed = false

    const ensureSynced = async () => {
      const { enabled } = await accountApi.getConfig()
      if (!enabled || !alive) return
      const me = await accountApi.getMe(true)
      if (!alive) return
      authed = !!me.authenticated
      if (authed) await syncOnLogin()
      else resetSyncState()
    }

    // initial reconcile
    ensureSynced()

    const onCollections = () => { if (authed) mirror('favorites') }
    const onSaved = () => { if (authed) mirror('saved') }
    const onAccount = () => { ensureSynced() }               // login/logout
    const onWake = () => { if (authed) mirror('all') }        // returning online / to the tab

    window.addEventListener('aqar:collections', onCollections)
    window.addEventListener('aqar:saved-searches', onSaved)
    window.addEventListener(ACCOUNT_EVENT, onAccount)
    window.addEventListener('online', onWake)
    window.addEventListener('focus', onWake)

    return () => {
      alive = false
      window.removeEventListener('aqar:collections', onCollections)
      window.removeEventListener('aqar:saved-searches', onSaved)
      window.removeEventListener(ACCOUNT_EVENT, onAccount)
      window.removeEventListener('online', onWake)
      window.removeEventListener('focus', onWake)
    }
  }, [])

  return null
}
