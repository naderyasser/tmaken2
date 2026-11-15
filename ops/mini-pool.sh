#!/usr/bin/env bash
# Keep READY Masar Mini sites waiting so a sign-up takes seconds instead of ~4 min (owner 2026-11-15).
# A pool site = hr-template restored + migrated, scheduler off, no company, no hr_client marker (so it is not
# reachable from the shared entry), named sites/pool-<hex>. new-client.sh claims one by renaming its folder.
#   ops/mini-pool.sh            top up to POOL_SIZE (default 2) and rebuild pool sites older than 7 days
# Run as root (the timer does), one at a time (flock), niced.
set -euo pipefail
BENCH_DIR=/home/frappeuser/frappe-dev
BENCH=/home/frappeuser/miniconda3/envs/frap/bin/bench
TEMPLATE=hr-template
POOL_SIZE=${POOL_SIZE:-2}
MAX_AGE_DAYS=7
exec 9>/run/mini-pool.lock
flock -n 9 || { echo "already running"; exit 0; }
[[ $EUID -eq 0 ]] || { echo "run as root" >&2; exit 1; }
export RP=$(python3 -c "import json;print(json.load(open('$BENCH_DIR/sites/common_site_config.json'))['db_root_password'])")
# secrets go through stdin, never the environment: sudo logs --preserve-env values in the journal
as_fu() { printf '%s\n%s\n' "${RP:-}" "${AP:-}" | sudo -u frappeuser bash -c "IFS= read -r RP; IFS= read -r AP; export RP AP; cd $BENCH_DIR && nice -n 15 $1 </dev/null"; }

drop() {  # remove a pool site and its database
  local P=$1
  as_fu "$BENCH drop-site $P --mariadb-root-password \"\$RP\" --force --no-backup >/dev/null 2>&1" || true
  rm -rf "${BENCH_DIR:?}/sites/$P" "$BENCH_DIR/archived/sites/$P" 2>/dev/null || true
}

# 1) half-built leftovers (no pool.json, older than 1 h) and stale ones go
for d in $(find "$BENCH_DIR/sites" -maxdepth 1 -name 'pool-*' -type d -printf '%f\n' 2>/dev/null); do
  m=$BENCH_DIR/sites/$d/pool.json
  if [[ ! -f $m ]]; then
    [[ -n $(find "$BENCH_DIR/sites/$d" -maxdepth 0 -mmin +60) ]] && { echo "drop unfinished $d"; drop "$d"; }
  elif [[ -n $(find "$m" -mtime +$MAX_AGE_DAYS) ]]; then
    echo "drop stale $d"; drop "$d"
  fi
done

# 2) top up
have=$(find "$BENCH_DIR/sites" -maxdepth 1 -name 'pool-*' -type d | wc -l)
while (( have < POOL_SIZE )); do
  P=pool-$(openssl rand -hex 4)
  echo "build $P   [$(date +%T)]"
  export AP=$(openssl rand -base64 18 | tr -d '/+=' | cut -c1-20)
  as_fu "$BENCH --site $TEMPLATE backup >/dev/null"
  DUMP=$(find $BENCH_DIR/sites/$TEMPLATE/private/backups -name '*-database.sql.gz' -printf '%T@ %p\n' | sort -n | tail -1 | cut -d' ' -f2)
  if as_fu "$BENCH new-site $P --mariadb-root-password \"\$RP\" --admin-password \"\$AP\" >/dev/null" \
     && as_fu "$BENCH --site $P restore $DUMP --mariadb-root-password \"\$RP\" >/dev/null" \
     && as_fu "$BENCH --site $P migrate >/dev/null"; then
    # encryption_key must match the restored template DB (same rule as new-client.sh step 3)
    sudo -u frappeuser python3 - "$BENCH_DIR/sites" "$TEMPLATE" "$P" <<'PY'
import json, sys, datetime
sites, tpl, p = sys.argv[1:]
src = json.load(open(f"{sites}/{tpl}/site_config.json"))
conf = json.load(open(f"{sites}/{p}/site_config.json"))
if src.get("encryption_key"):
    conf["encryption_key"] = src["encryption_key"]
json.dump(conf, open(f"{sites}/{p}/site_config.json", "w"), indent=1)
json.dump({"built": datetime.datetime.now().isoformat(timespec="seconds"), "from": tpl},
          open(f"{sites}/{p}/pool.json", "w"))
PY
    echo "ready $P   [$(date +%T)]"
    have=$((have + 1))
  else
    echo "failed $P" >&2; drop "$P"; exit 1
  fi
done
echo "pool: $have ready"
