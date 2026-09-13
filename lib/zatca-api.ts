/**
 * ZATCA E-Invoicing API Client
 * Integration with ZATCA (Zakat, Tax and Customs Authority) Saudi Arabia
 * 
 * This module provides frontend API calls for:
 * - ZATCA settings management
 * - Invoice ZATCA status tracking
 * - CSR/CSID management
 * - ZATCA dashboard analytics
 * - Customer ZATCA info management
 */

import { frappeClient } from './api-client'

// ==================== Types ====================

export interface ZatcaSettings {
  enabled: boolean
  company: string
  company_abbr: string
  company_name_arabic: string
  environment: 'Sandbox' | 'Simulation' | 'Production'
  phase: 'Phase-1' | 'Phase-2'
  send_background: boolean
  setup_steps: {
    csr_created: boolean
    compliance_csid: boolean
    compliance_check: boolean
    production_csid: boolean
    certificate_ready: boolean
  }
  setup_complete: boolean
  has_pih: boolean
  attach_xml: boolean
  attach_qr: boolean
  send_on_submit: string
  registration_type: string
  tax_id: string
  message?: string
}

export interface ZatcaSettingsUpdate {
  enabled?: boolean
  environment?: string
  phase?: string
  send_background?: boolean
  company_name_arabic?: string
  registration_type?: string
  company_registration?: string
  location?: string
  business_category?: string
  attach_xml?: boolean
  attach_qr?: boolean
  send_on_submit?: string
  submit_line_item_discount?: boolean
}

export interface InvoiceZatcaStatus {
  name: string
  zatca_status: string
  uuid: string
  qr_code: string
  xml_file: string
  zatca_response: string
  is_b2c: boolean
  is_return: boolean
}

export interface InvoiceZatcaListItem {
  name: string
  customer: string
  customer_name: string
  posting_date: string
  grand_total: number
  status: string
  custom_zatca_status: string
  custom_uuid: string
  ksa_einv_qr: string
  is_return: number
  custom_b2c: number
}

export interface ZatcaDashboard {
  total_invoices: number
  total_cleared: number
  total_reported: number
  total_failed: number
  total_pending: number
  status_counts: Record<string, number>
  recent_logs: ZatcaLog[]
}

export interface ZatcaLog {
  name: string
  creation: string
  invoice_number?: string
  status?: string
  response_message?: string
  [key: string]: any
}

export interface CustomerZatcaInfo {
  name: string
  customer_name: string
  customer_name_arabic: string
  is_b2c: boolean
  buyer_id_type: string
  buyer_id: string
  tax_id: string
}

// ==================== ZATCA API Functions ====================

export const zatcaApi = {

  // ---- Settings & Configuration ----

  /**
   * Get ZATCA configuration status for a company
   */
  async getSettings(company?: string): Promise<ZatcaSettings> {
    const res = await frappeClient.call('base_meena.zatca_api.get_zatca_settings', {
      company: company || undefined,
    })
    return res?.message || res
  },

  /**
   * Update ZATCA settings for a company
   */
  async updateSettings(company: string, settings: ZatcaSettingsUpdate): Promise<{ success: boolean; message: string }> {
    const res = await frappeClient.call('base_meena.zatca_api.update_zatca_settings', {
      company,
      settings: JSON.stringify(settings),
    })
    return res?.message || res
  },

  // ---- CSR & CSID Management ----

  /**
   * Generate CSR configuration for a company
   */
  async generateCsrConfig(company: string): Promise<{ success: boolean; config?: any; error?: string }> {
    const res = await frappeClient.call('base_meena.zatca_api.generate_csr_config', { company })
    return res?.message || res
  },

  /**
   * Create CSR (Certificate Signing Request) for a company
   */
  async createCsr(company: string): Promise<{ success: boolean; message?: string; error?: string }> {
    const res = await frappeClient.call('base_meena.zatca_api.create_csr', { company })
    return res?.message || res
  },

  /**
   * Generate Compliance CSID
   */
  async generateComplianceCsid(company: string, otp: string = '123456'): Promise<{ success: boolean; message?: string; error?: string }> {
    const res = await frappeClient.call('base_meena.zatca_api.generate_compliance_csid', { company, otp })
    return res?.message || res
  },

  /**
   * Run compliance check against ZATCA
   */
  async runComplianceCheck(company: string, invoiceName?: string): Promise<{ success: boolean; message?: string; error?: string }> {
    const res = await frappeClient.call('base_meena.zatca_api.run_compliance_check', {
      company,
      invoice_name: invoiceName || undefined,
    })
    return res?.message || res
  },

  /**
   * Generate Production CSID
   */
  async generateProductionCsid(company: string): Promise<{ success: boolean; message?: string; error?: string }> {
    const res = await frappeClient.call('base_meena.zatca_api.generate_production_csid', { company })
    return res?.message || res
  },

  // ---- Invoice ZATCA Status ----

  /**
   * Get ZATCA status for a specific invoice
   */
  async getInvoiceStatus(invoiceName: string): Promise<InvoiceZatcaStatus> {
    const res = await frappeClient.call('base_meena.zatca_api.get_invoice_zatca_status', {
      invoice_name: invoiceName,
    })
    return res?.message || res
  },

  /**
   * Get ZATCA status for multiple invoices
   */
  async getInvoicesStatus(
    limit: number = 50,
    statusFilter?: string,
    company?: string
  ): Promise<InvoiceZatcaListItem[]> {
    const res = await frappeClient.call('base_meena.zatca_api.get_invoices_zatca_status', {
      limit,
      status_filter: statusFilter || undefined,
      company: company || undefined,
    })
    return res?.message || res || []
  },

  /**
   * Resubmit a failed invoice to ZATCA
   */
  async resubmitInvoice(invoiceName: string): Promise<{ success: boolean; zatca_status?: string; error?: string }> {
    const res = await frappeClient.call('base_meena.zatca_api.resubmit_invoice_to_zatca', {
      invoice_name: invoiceName,
    })
    return res?.message || res
  },

  /**
   * Bulk submit multiple invoices to ZATCA
   */
  async bulkSubmitToZatca(invoiceNames: string[]): Promise<{
    success: boolean
    total: number
    success_count: number
    fail_count: number
    results: Array<{ invoice: string; success: boolean; zatca_status?: string; error?: string }>
  }> {
    const res = await frappeClient.call('base_meena.zatca_api.bulk_submit_to_zatca', {
      invoice_names: JSON.stringify(invoiceNames),
    })
    return res?.message || res
  },

  // ---- Dashboard & Analytics ----

  /**
   * Get ZATCA dashboard analytics
   */
  async getDashboard(company?: string): Promise<ZatcaDashboard> {
    const res = await frappeClient.call('base_meena.zatca_api.get_zatca_dashboard', {
      company: company || undefined,
    })
    return res?.message || res
  },

  // ---- Event Logs ----

  /**
   * Get ZATCA integration event logs
   */
  async getLogs(limit: number = 50, invoiceName?: string): Promise<ZatcaLog[]> {
    const res = await frappeClient.call('base_meena.zatca_api.get_zatca_logs', {
      limit,
      invoice_name: invoiceName || undefined,
    })
    return res?.message || res || []
  },

  // ---- Customer ZATCA Info ----

  /**
   * Get ZATCA-related info for a customer
   */
  async getCustomerZatcaInfo(customer: string): Promise<CustomerZatcaInfo> {
    const res = await frappeClient.call('base_meena.zatca_api.get_customer_zatca_info', { customer })
    return res?.message || res
  },

  /**
   * Update ZATCA-related fields for a customer
   */
  async updateCustomerZatcaInfo(
    customer: string,
    data: Partial<Pick<CustomerZatcaInfo, 'customer_name_arabic' | 'is_b2c' | 'buyer_id_type' | 'buyer_id'>>
  ): Promise<{ success: boolean }> {
    const res = await frappeClient.call('base_meena.zatca_api.update_customer_zatca_info', {
      customer,
      data: JSON.stringify(data),
    })
    return res?.message || res
  },
}
