'use client'

import { CompanyUsersPanel } from '@/components/company/company-users'

// Tenant-local company self-service Users & Team panel. Renders inside the Jisr
// shell (HrShell) with the HR gate RELAXED (see SHELL_NON_HR_PREFIXES) — this
// surface is for Company Admins, who may not be HR users. The Company-Admin gate
// is enforced inside CompanyUsersPanel and, authoritatively, by the backend.
// `hideHeader` drops the panel's own <Header> since the shell provides the top bar.
export default function TeamPage() {
    return <CompanyUsersPanel hideHeader />
}
