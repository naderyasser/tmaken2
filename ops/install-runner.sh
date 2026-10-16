#!/usr/bin/env bash
# Install / refresh the root side of the operator panel (/request-site/hr):
# a ROOT-OWNED copy of these ops scripts in /usr/local/lib/hr-clients plus the
# systemd path unit that runs hr-job-runner.py when a job is queued.
# Re-run after every change to the ops/ scripts.   sudo bash ops/install-runner.sh
set -euo pipefail
SRC=$(dirname "$(readlink -f "$0")")
LIB=/usr/local/lib/hr-clients
SPOOL=/home/frappeuser/frappe-dev/hr-client-jobs
install -d -o root -g root -m 755 $LIB
for f in new-client.sh remove-client.sh sync-company-map.sh hr_tenant.py brand_assets.py hr-job-runner.py nginx-client.conf.tpl nginx-client-http.conf.tpl; do
  install -o root -g root -m 644 "$SRC/$f" "$LIB/$f"
done
install -d -o root -g frappeuser -m 750 /var/lib/hr-clients /var/lib/hr-clients/status
install -d -o frappeuser -g frappeuser -m 750 $SPOOL $SPOOL/pending $SPOOL/done
cat > /etc/systemd/system/hr-client-jobs.service <<UNIT
[Unit]
Description=HR product: run queued new-client / remove-client jobs (operator panel)
[Service]
Type=oneshot
ExecStart=/usr/bin/python3 $LIB/hr-job-runner.py
TimeoutStartSec=3h
UNIT
cat > /etc/systemd/system/hr-client-jobs.path <<UNIT
[Unit]
Description=Watch the HR client job spool
[Path]
PathExistsGlob=$SPOOL/pending/*.json
[Install]
WantedBy=multi-user.target
UNIT
systemctl daemon-reload
systemctl enable --now hr-client-jobs.path >/dev/null
echo "✓ runner installed ($LIB), path unit: $(systemctl is-active hr-client-jobs.path)"
