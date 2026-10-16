#!/usr/bin/env bash
# Remove a client made by new-client.sh: drops the site (archived backup kept
# under archived/sites), its nginx vhost and certificate. Refuses any site that
# new-client.sh did not create (no `hr_client` key in its site_config).
#   ops/remove-client.sh --site acme --yes
set -euo pipefail
BENCH_DIR=/home/frappeuser/frappe-dev
BENCH=/home/frappeuser/miniconda3/envs/frap/bin/bench
SITE=${2:-}; [[ ${1:-} == --site && ${3:-} == --yes ]] || { echo "usage: $0 --site <site> --yes" >&2; exit 2; }
[[ $SITE =~ ^[a-z][a-z0-9-]{1,30}$ ]] || { echo "bad site" >&2; exit 2; }
CFG=$BENCH_DIR/sites/$SITE/site_config.json
DOMAIN=$(python3 -c "import json,sys;c=json.load(open('$CFG'));h=c.get('hr_client');sys.exit('not an ops-created HR client — refusing') if not h else print(h['domain'])")
export RP=$(python3 -c "import json;print(json.load(open('$BENCH_DIR/sites/common_site_config.json'))['db_root_password'])")
sudo -u frappeuser --preserve-env=RP bash -c "cd $BENCH_DIR && $BENCH drop-site $SITE --mariadb-root-password \"\$RP\" --archived-sites-path $BENCH_DIR/archived/sites --force >/dev/null"
rm -f /etc/nginx/conf.d/$SITE.conf && nginx -t -q 2>/dev/null && systemctl reload nginx
certbot delete --cert-name "$DOMAIN" --non-interactive -q || true
echo "$(date -Is) removed $SITE ($DOMAIN)" >> $BENCH_DIR/logs/hr-clients.log
echo "✓ removed $SITE ($DOMAIN)"
