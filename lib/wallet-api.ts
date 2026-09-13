/**
 * Wallet API Client
 * Connects to base_meena.wallet.wallet_api endpoints
 */

import { frappeClient } from './api-client'

// ==================== Types ====================

export interface Wallet {
    name: string
    wallet_type: 'Company' | 'Sales Rep'
    wallet_name: string
    company: string
    linked_user?: string
    linked_sales_person?: string
    balance: number
    total_credits: number
    total_debits: number
    is_active: number
    creation?: string
    modified?: string
}

/**
 * Display title for a wallet. `wallet_name` is denormalized at creation time
 * and goes stale when the Sales Person is renamed (rename_doc updates the
 * link field only) — so for rep wallets the title is ALWAYS derived from the
 * live linked rep; the stored name is only a fallback (company wallets etc.).
 */
export function walletDisplayName(
  t: (key: string) => string,
  wallet: Pick<Wallet, 'wallet_name' | 'linked_sales_person'>,
): string {
  if (wallet.linked_sales_person) {
    const template = t('sr.admin.wallets.wallet_of')
    if (template !== 'sr.admin.wallets.wallet_of') {
      return template.replace('{rep}', wallet.linked_sales_person)
    }
    return `${wallet.linked_sales_person} — ${wallet.wallet_name || ''}`.trim()
  }
  return wallet.wallet_name || ''
}

export interface WalletTransaction {
    name: string
    transaction_type: string
    amount: number
    balance_after: number
    posting_date: string
    posting_time?: string
    remarks?: string
    reference_type?: string
    reference_name?: string
    party?: string
    party_name?: string
    created_by_user?: string
    creation?: string
}

export interface WalletSummary {
    company_wallets: Wallet[]
    sales_wallets: Wallet[]
    total_company_balance: number
    total_sales_balance: number
    total_sales_credits: number
    total_wallets: number
    // aliases for backwards compat
    company_balance?: number
    total_sales_rep_balance?: number
    total_sales_rep_credits?: number
}

// ==================== API ====================

const BASE = 'base_meena.wallet.wallet_api'

export const walletApi = {
    // ── Wallets ──

    async getWallets(options?: { wallet_type?: string; company?: string }): Promise<Wallet[]> {
        const resp = await frappeClient.call<Wallet[]>(`${BASE}.get_wallets`, options || {})
        return resp.message || resp.data || []
    },

    async getWallet(name: string): Promise<Wallet> {
        const resp = await frappeClient.call<Wallet>(`${BASE}.get_wallet`, { wallet_name: name })
        return resp.message || resp.data || ({} as Wallet)
    },

    async getCompanyWallet(company?: string): Promise<Wallet | null> {
        const resp = await frappeClient.call<Wallet>(`${BASE}.get_company_wallet`, { company })
        return resp.message || resp.data || null
    },

    async getMyWallet(): Promise<Wallet | null> {
        const resp = await frappeClient.call<Wallet>(`${BASE}.get_my_wallet`, {})
        return resp.message || resp.data || null
    },

    // ── Transactions ──

    async getTransactions(wallet: string, limit = 50, offset = 0): Promise<{ transactions: WalletTransaction[]; total: number }> {
        const resp = await frappeClient.call<{ transactions: WalletTransaction[]; total: number }>(
            `${BASE}.get_wallet_transactions`,
            { wallet, limit, offset }
        )
        return resp.message || resp.data || { transactions: [], total: 0 }
    },

    // ── Operations ──

    async topUp(wallet: string, amount: number, remarks?: string): Promise<{ transaction: string; new_balance: number }> {
        const resp = await frappeClient.call<{ transaction: string; new_balance: number }>(
            `${BASE}.top_up_wallet`,
            { wallet, amount, remarks }
        )
        return resp.message || resp.data || { transaction: '', new_balance: 0 }
    },

    async payFromWallet(data: {
        wallet: string
        amount: number
        invoice_name?: string
        supplier?: string
        supplier_name?: string
        remarks?: string
    }): Promise<{ transaction: string; new_balance: number }> {
        const resp = await frappeClient.call<{ transaction: string; new_balance: number }>(
            `${BASE}.pay_from_wallet`, data
        )
        return resp.message || resp.data || { transaction: '', new_balance: 0 }
    },

    async creditSales(data: {
        wallet: string
        amount: number
        invoice_name?: string
        customer?: string
        customer_name?: string
        remarks?: string
    }): Promise<{ transaction: string; new_balance: number }> {
        const resp = await frappeClient.call<{ transaction: string; new_balance: number }>(
            `${BASE}.credit_sales_wallet`, data
        )
        return resp.message || resp.data || { transaction: '', new_balance: 0 }
    },

    async withdraw(wallet: string, amount: number, remarks?: string): Promise<{ transaction: string; new_balance: number }> {
        const resp = await frappeClient.call<{ transaction: string; new_balance: number }>(
            `${BASE}.withdraw_from_wallet`,
            { wallet, amount, remarks }
        )
        return resp.message || resp.data || { transaction: '', new_balance: 0 }
    },

    async transferFromRepToCompany(wallet: string, amount: number, remarks?: string): Promise<{ rep_transaction: string; company_transaction: string | null; new_rep_balance: number }> {
        const resp = await frappeClient.call<{ rep_transaction: string; company_transaction: string | null; new_rep_balance: number }>(
            `${BASE}.transfer_from_rep_to_company`,
            { wallet, amount, remarks }
        )
        return resp.message || resp.data || { rep_transaction: '', company_transaction: null, new_rep_balance: 0 }
    },

    // ── Dashboard ──

    async getSummary(company?: string): Promise<WalletSummary> {
        const resp = await frappeClient.call<WalletSummary>(`${BASE}.get_wallet_summary`, { company })
        return resp.message || resp.data || {
            company_wallets: [], sales_wallets: [],
            total_company_balance: 0, total_sales_balance: 0, total_sales_credits: 0, total_wallets: 0,
        }
    },

    async setupWallets(company?: string): Promise<{ created: any[]; total_created: number }> {
        const resp = await frappeClient.call<{ created: any[]; total_created: number }>(
            `${BASE}.setup_wallets`, { company }
        )
        return resp.message || resp.data || { created: [], total_created: 0 }
    },
}
