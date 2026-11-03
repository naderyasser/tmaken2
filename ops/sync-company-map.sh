#!/usr/bin/env bash
# Shared entry masar.base.meena.sa: nginx maps the `mt_company` cookie to a
# Frappe site through /etc/nginx/hr-companies.map. Only codes listed here can be
# reached that way (anything else falls back to the demo site), so the list is
# rebuilt from the sites that carry the `hr_client` marker. new-client.sh and
# remove-client.sh call this; safe to run any time (root).
set -euo pipefail
SITES=/home/frappeuser/frappe-dev/sites
MAP=/etc/nginx/hr-companies.map
tmp=$(mktemp)
python3 - "$SITES" > "$tmp" <<'PY'
import json, os, re, sys
root = sys.argv[1]
for site in sorted(os.listdir(root)):
    p = os.path.join(root, site, "site_config.json")
    if re.fullmatch(r"[a-z][a-z0-9-]{1,30}", site) and os.path.isfile(p):
        try:
            if json.load(open(p)).get("hr_client"):
                print(f"{site} {site};")
        except Exception:
            pass
PY
install -m 644 "$tmp" "$MAP"; rm -f "$tmp"
nginx -t -q 2>/dev/null && systemctl reload nginx
echo "company map: $(wc -l < $MAP) code(s)"
