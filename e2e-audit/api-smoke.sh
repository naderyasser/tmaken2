#!/usr/bin/env bash
# Auth'd smoke over the main HR endpoints the frontend calls (read-only).
# Usage: SID=<sid> HOST=qarawi.base.meena.sa bash e2e-audit/api-smoke.sh
set -u
HOST="${HOST:-qarawi.base.meena.sa}"
[ -z "${SID:-}" ] && { echo "SID env required"; exit 2; }
ck="Cookie: sid=$SID"
hit() { # method-call endpoints (GET works for whitelisted reads)
  local label="$1" url="$2"
  local code body
  body=$(curl -sS -m 20 -H "$ck" "https://$HOST$url" -o /tmp/api_smoke_body -w '%{http_code}')
  code="$body"
  local snippet
  snippet=$(head -c 120 /tmp/api_smoke_body | tr '\n' ' ')
  printf '%-34s %s  %s\n' "$label" "$code" "${snippet:0:90}"
}
echo "── HR API smoke @ $HOST ──"
hit auth.get_logged_user            "/api/method/frappe.auth.get_logged_user"
hit employee_segments               "/api/method/base_meena.api.employee_directory.get_employee_segments"
hit my_dashboard                    "/api/method/base_meena.api.my_dashboard.get_my_dashboard"
hit team_dashboard                  "/api/method/base_meena.api.my_dashboard.get_team_dashboard"
hit request_types                   "/api/method/base_meena.hr_requests.approvals_api.get_request_types"
hit my_scope                        "/api/method/base_meena.api.permission.get_my_scope"
hit employees_list                  "/api/resource/Employee?limit_page_length=1&fields=%5B%22name%22%5D"
hit leave_types                     "/api/resource/Leave%20Type?limit_page_length=1&fields=%5B%22name%22%5D"
hit departments                     "/api/resource/Department?limit_page_length=1&fields=%5B%22name%22%5D"
hit shift_types                     "/api/resource/Shift%20Type?limit_page_length=1&fields=%5B%22name%22%5D"
hit salary_assignments              "/api/resource/Salary%20Structure%20Assignment?limit_page_length=1&fields=%5B%22name%22%5D"
hit attendance                      "/api/resource/Attendance?limit_page_length=1&fields=%5B%22name%22%5D"
hit expense_claims                  "/api/resource/Expense%20Claim?limit_page_length=1&fields=%5B%22name%22%5D"
rm -f /tmp/api_smoke_body
