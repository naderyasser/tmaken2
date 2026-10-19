#!/usr/bin/env bash
# New HR-product client = its own Frappe site (copied from the clean `hr-template`
# site), served by the ONE shared frontend (tamken3-frontend :3003) under the
# client's own name, logo and domain.  Run as root on the box.
#
#   ops/new-client.sh --site acme --company "شركة أكمي للتجارة" --abbr AC --brand "Acme HR" \
#       [--tagline "أكمي - نظام الحضور"] [--logo /path/logo-white.png] [--color "#1d4d56"] \
#       [--domain hr.acme.com] [--admin-user name] [--admin-pass '...'] \
#   (the password can also come in the env as HR_ADMIN_PASS — the panel does that,
#    so it never shows in the process list)
#       [--plan "باقة ..." --employees 80 --months 12 --rate 41.4 --setup-fee 575]
#
# Every client is reachable on the shared entry https://masar.base.meena.sa with
# its site name as the «رمز الشركة» (company code). --domain additionally gives
# it its own host (vhost + certificate); that domain must point here first. The logo should be light/white
# with a transparent background: it sits on the dark sidebar. Without --logo a
# wordmark of --brand is drawn.
set -euo pipefail

BENCH_DIR=/home/frappeuser/frappe-dev
BENCH=/home/frappeuser/miniconda3/envs/frap/bin/bench
PY=$BENCH_DIR/env/bin/python
OPS=$(dirname "$(readlink -f "$0")")
TEMPLATE=hr-template
FRONT_PORT=3003
LOG=$BENCH_DIR/logs/hr-clients.log

SITE= COMPANY= ABBR= BRAND= TAGLINE= LOGO= COLOR="#1d4d56" DOMAIN= ADMIN_USER= ADMIN_PASS=${HR_ADMIN_PASS:-} PLAN= EMPLOYEES= MONTHS= RATE= SETUP_FEE=
while [[ $# -gt 0 ]]; do
  case $1 in
    --site) SITE=$2;; --company) COMPANY=$2;; --abbr) ABBR=$2;; --brand) BRAND=$2;;
    --tagline) TAGLINE=$2;; --logo) LOGO=$2;; --color) COLOR=$2;; --domain) DOMAIN=$2;;
    --admin-user) ADMIN_USER=$2;; --admin-pass) ADMIN_PASS=$2;; --plan) PLAN=$2;; --employees) EMPLOYEES=$2;; --months) MONTHS=$2;;
    --rate) RATE=$2;; --setup-fee) SETUP_FEE=$2;;
    *) echo "unknown option $1" >&2; exit 2;;
  esac
  shift 2
done

die() { echo "✗ $*" >&2; exit 1; }
[[ $EUID -eq 0 ]] || die "run as root"
[[ $SITE =~ ^[a-z][a-z0-9-]{1,30}$ ]] || die "--site: lowercase letters/digits/dashes (it becomes the subdomain)"
[[ -n $COMPANY && -n $BRAND ]] || die "--company and --brand are required"
[[ $ABBR =~ ^[A-Za-z0-9]{1,6}$ ]] || die "--abbr: 1-6 latin letters/digits"
[[ $COLOR =~ ^#[0-9a-fA-F]{6}$ ]] || die "--color: #rrggbb"
[[ -z $LOGO || -f $LOGO ]] || die "--logo file not found"
ENTRY=masar.base.meena.sa
CONF=/etc/nginx/conf.d/$SITE.conf
test -e "$BENCH_DIR/sites/$SITE" && die "site $SITE already exists"
test -e "$CONF" && die "$CONF already exists"
[[ -z $DOMAIN ]] || ! grep -rqs "server_name .*\b$DOMAIN;" /etc/nginx/conf.d/ || die "$DOMAIN is already served by another vhost"
[[ -z $ADMIN_USER || $ADMIN_USER =~ ^[A-Za-z0-9._@-]{3,60}$ ]] || die "--admin-user: 3-60 latin letters/digits/._@-"
[[ -z $ADMIN_PASS || $ADMIN_PASS =~ ^[^[:space:]]{8,64}$ ]] || die "--admin-pass: 8-64 characters, no spaces"
ADMIN_PASS=${ADMIN_PASS:-$(openssl rand -base64 12 | tr -d '/+=' | cut -c1-12)}

as_fu() { sudo -u frappeuser --preserve-env=RP,AP bash -c "cd $BENCH_DIR && $1"; }
step() { echo "── $*   [$(date +%T)]"; }

step "1/7 template backup"
as_fu "$BENCH --site $TEMPLATE backup >/dev/null"
# (not `ls -t`: this box's ls is wrapped and exits 255)
DUMP=$(find $BENCH_DIR/sites/$TEMPLATE/private/backups -name '*-database.sql.gz' -printf '%T@ %p\n' | sort -n | tail -1 | cut -d' ' -f2)

step "2/7 site $SITE (from $(basename "$DUMP"))"
export RP=$(python3 -c "import json;print(json.load(open('$BENCH_DIR/sites/common_site_config.json'))['db_root_password'])")
export AP=$ADMIN_PASS AU=$ADMIN_USER
as_fu "$BENCH new-site $SITE --mariadb-root-password \"\$RP\" --admin-password \"\$AP\" >/dev/null"
as_fu "$BENCH --site $SITE restore $DUMP --mariadb-root-password \"\$RP\" >/dev/null"

step "3/7 brand files + site_config"
BRAND_JSON=$(sudo -u frappeuser $PY "$OPS/brand_assets.py" "$SITE" "$BRAND" "$COLOR" "$LOGO")
sudo -u frappeuser python3 - "$BENCH_DIR/sites" "$TEMPLATE" "$SITE" "$DOMAIN" "$BRAND_JSON" "$TAGLINE" "$PLAN" "$EMPLOYEES" "$MONTHS" "$COMPANY" "$RATE" "$SETUP_FEE" <<'PY'
import json, sys, datetime
sites, tpl, site, domain, brand, tagline, plan, emps, months, company, rate, setup = sys.argv[1:]
src = json.load(open(f"{sites}/{tpl}/site_config.json"))
p = f"{sites}/{site}/site_config.json"
conf = json.load(open(p))
for k, v in src.items():
    # db_* stay this site's own; encryption_key must match the restored DB
    if k in ("db_name", "db_password", "db_type") or k.startswith("cars_") or k in ("test_purge_token", "allow_tests", "walkthrough_autologin_user", "maintenance_mode"):
        continue
    conf[k] = v
brand = json.loads(brand)
brand["tagline"] = tagline or brand["name"]
conf.update({"tenant_brand": brand, "tamken_mobile_app": 1, "host_name": f"https://{domain or 'masar.base.meena.sa'}",
             "hr_client": {"created_on": str(datetime.date.today()), "domain": domain, "company": company}})
if plan:
    import calendar
    today = datetime.date.today()
    m = int(months or 12)
    y, mo = divmod(today.month - 1 + m, 12)
    end = datetime.date(today.year + y, mo + 1, min(today.day, calendar.monthrange(today.year + y, mo + 1)[1]))
    period = {1: "شهر", 6: "6 شهور", 12: "سنة", 24: "سنتين"}.get(m) or (f"{m // 12} سنين" if m % 12 == 0 else f"{m} شهر")
    conf.update({"subscription_plan": plan, "subscription_period": period, "subscription_started_on": str(today),
                 "subscription_expires_on": str(end)})
    if emps:
        conf["subscription_employee_cap"] = int(emps)
    if rate and emps:
        # price list (SAR): per employee per year + one-time setup
        annual = round(float(rate) * int(emps), 2)
        conf.update({"subscription_price_per_employee": float(rate), "subscription_setup_fee": float(setup or 0),
                     "subscription_annual_fee": annual, "subscription_total": round(annual * max(1, m // 12) + float(setup or 0), 2)})
json.dump(conf, open(p, "w"), indent=1, ensure_ascii=False)
PY

step "4/7 migrate + company/admin"
as_fu "$BENCH --site $SITE migrate >/dev/null"
sudo -u frappeuser --preserve-env=AP,AU bash -c "cd $BENCH_DIR/sites && $PY $OPS/hr_tenant.py $SITE setup-client \"\$(python3 -c 'import json,os,sys;print(json.dumps({\"company\":sys.argv[1],\"abbr\":sys.argv[2],\"brand_name\":sys.argv[3],\"admin_password\":os.environ[\"AP\"],\"admin_user\":os.environ.get(\"AU\",\"\")},ensure_ascii=False))' \"$COMPANY\" \"$ABBR\" \"$BRAND\")\""
as_fu "$BENCH --site $SITE enable-scheduler >/dev/null"

step "5/7 company code «$SITE» on $ENTRY"
bash "$OPS/sync-company-map.sh"

if [[ -n $DOMAIN ]]; then
  step "6/7 own domain $DOMAIN (vhost + certificate)"
  sed -e "s/__HOST__/$DOMAIN/g" -e "s/__SITE__/$SITE/g" -e "s/__PORT__/$FRONT_PORT/g" "$OPS/nginx-client-http.conf.tpl" > "$CONF"
  nginx -t -q 2>/dev/null && systemctl reload nginx || { rm -f "$CONF"; die "nginx rejected the :80 vhost"; }
  certbot certonly --webroot -w /var/www/html -d "$DOMAIN" --non-interactive --agree-tos --register-unsafely-without-email -q \
    || { rm -f "$CONF"; systemctl reload nginx; die "certificate failed — does $DOMAIN point to this server?"; }
  sed -e "s/__HOST__/$DOMAIN/g" -e "s/__SITE__/$SITE/g" -e "s/__PORT__/$FRONT_PORT/g" "$OPS/nginx-client.conf.tpl" > "$CONF"
  nginx -t -q 2>/dev/null && systemctl reload nginx || die "nginx rejected the https vhost ($CONF)"
else
  step "6/7 no own domain (shared entry only)"
fi

step "7/7 check"
# the entry must now answer with THIS company's sign-in page when given its code
code=$(python3 -c 'import sys,urllib.request as u
r=u.Request("https://"+sys.argv[1]+"/login",headers={"Cookie":"mt_company="+sys.argv[2]})
try:
  b=u.urlopen(r,timeout=30).read().decode()
  print("200" if ("content=\""+sys.argv[2]+"\"") in b else "wrong-company")
except Exception as e: print(getattr(e,"code","no answer"))' "$ENTRY" "$SITE")
echo "$(date -Is) created $SITE (code on $ENTRY${DOMAIN:+, own domain $DOMAIN}) company=«$COMPANY» brand=«$BRAND»" >> "$LOG"
cat <<OUT

✓ $BRAND is live            (login page answered HTTP $code)
  HR system   https://${DOMAIN:-$ENTRY}
  company     $SITE
  mobile app  https://${DOMAIN:-$ENTRY}/m
  login       ${ADMIN_USER:-Administrator} / $ADMIN_PASS
OUT
