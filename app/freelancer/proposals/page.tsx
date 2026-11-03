'use client'

import { ProposalList } from '@/components/proposal/proposal-list'

/**
 * Freelancer › Proposals. <ProposalList> already renders the page header (title,
 * subtitle and the Refresh / New-Proposal actions), so this route must NOT add a
 * second <h1> — doing so stacked two titles ("Proposals" + "Sales Proposals").
 * Mirrors the clients/invoices routes, which likewise just mount their list.
 */
export default function FreelancerProposalsPage() {
  return <ProposalList />
}
