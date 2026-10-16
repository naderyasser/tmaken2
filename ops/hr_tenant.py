"""
Per-client setup of an HR-product Frappe site, run by ops/new-client.sh with
the bench's own python:  python hr_tenant.py <site> <command> [json-args]

  clean-template   strip everything client/demo-specific from the template
                   site (one-off, when the template is rebuilt)
  setup-client     rename the template company to the client's, write its
                   brand into site_config (via new-client.sh), set the
                   Administrator password and product defaults

Only ever run against a freshly restored copy of the template — never a live
client site (setup-client refuses to run once the site has employees).
"""
import json
import sys
import time

import frappe

SITES = "/home/frappeuser/frappe-dev/sites"


def _docs_like(pattern):
	"""Every (doctype, name) whose docname matches the SQL LIKE pattern."""
	out = []
	for dt in frappe.get_all("DocType", filters={"istable": 0, "issingle": 0, "is_virtual": 0}, pluck="name"):
		try:
			names = frappe.db.sql(f"select name from `tab{dt}` where name like %s", pattern, pluck=True)
		except Exception:
			continue
		out += [(dt, n) for n in names if dt != "Company"]
	return out


def rename_company(new_name, new_abbr):
	old = frappe.get_all("Company", pluck="name")
	assert len(old) == 1, f"template must hold exactly one company, found {old}"
	old = old[0]
	old_abbr = frappe.db.get_value("Company", old, "abbr")
	if new_name != old:
		frappe.rename_doc("Company", old, new_name, force=True)
	# abbr first: Cost Center/Account before_rename re-append the company's CURRENT abbr
	frappe.db.set_value("Company", new_name, {"company_name": new_name, "abbr": new_abbr})
	if frappe.get_meta("Company").has_field("custom__company_name_in_arabic__"):
		frappe.db.set_value("Company", new_name, "custom__company_name_in_arabic__", new_name)
	if new_abbr != old_abbr:
		suffix = f" - {old_abbr}"
		for dt, name in _docs_like(f"%{suffix}"):
			frappe.rename_doc(dt, name, name[: -len(suffix)] + f" - {new_abbr}", force=True)
	if new_name != old:
		# docs named after the company (root cost center, EWA policy, approval rules)
		for dt, name in _docs_like(f"%{old}%"):
			frappe.rename_doc(dt, name, name.replace(old, new_name), force=True)
	for cc in frappe.get_all("Cost Center", fields=["name", "cost_center_name"]):
		frappe.db.set_value("Cost Center", cc.name, "cost_center_name", cc.name.rsplit(f" - {new_abbr}", 1)[0])
	frappe.db.set_default("company", new_name)
	frappe.db.set_single_value("Global Defaults", "default_company", new_name)
	return old, old_abbr


def _forget_history():
	"""Renames leave «renamed from …» comments/versions naming the template or the
	previous client; the search index is rebuilt by Frappe on demand."""
	frappe.db.sql("delete from tabComment")
	frappe.db.sql("delete from tabVersion")
	frappe.db.sql("delete from `__global_search`")


def clean_template(args):
	# orphans of users deleted earlier, stale search index (held former client names)
	frappe.db.sql("delete from `tabNotification Settings` where name not in (select name from tabUser)")
	frappe.db.sql("delete from `tabDefaultValue` where parent not in ('__default','__global') and parent not in (select name from tabUser)")
	frappe.db.sql("delete from `tabUser Social Login` where parent not in (select name from tabUser)")
	frappe.db.sql("delete from `__global_search`")
	frappe.db.set_single_value("Marketplace Settings", "default_meta_title", "")
	# the demo had auto attendance ON (it invents punches) — a client starts with it off
	frappe.db.set_single_value("Auto Attendance Settings", {"enabled": 0, "scope": "All"})
	frappe.db.sql("delete from `tabAuto Attendance Employee` where parenttype='Auto Attendance Settings'")
	frappe.db.set_single_value("Website Settings", "app_name", "")
	old = rename_company(args.get("company", "شركة العميل"), args.get("abbr", "CL"))
	_forget_history()
	frappe.db.commit()
	print("template clean; company was", old)


def setup_client(args):
	if frappe.db.count("Employee"):
		sys.exit("refusing: this site already has employees — setup-client only runs on a fresh template copy")
	t = time.time()
	rename_company(args["company"], args["abbr"])
	brand = args["brand_name"]
	frappe.db.set_single_value("Website Settings", "app_name", brand)
	prompt = frappe.db.get_single_value("Copilot Settings", "system_prompt") or ""
	if prompt:
		frappe.db.set_single_value("Copilot Settings", "system_prompt", prompt.replace("تمكين", brand))
	from frappe.utils.password import update_password
	update_password("Administrator", args["admin_password"])
	_forget_history()
	frappe.db.commit()
	print(f"client ready: {args['company']} ({args['abbr']}) in {time.time() - t:.0f}s")


if __name__ == "__main__":
	site, cmd = sys.argv[1], sys.argv[2]
	args = json.loads(sys.argv[3]) if len(sys.argv) > 3 else {}
	frappe.init(site=site, sites_path=SITES)
	frappe.connect()
	frappe.set_user("Administrator")
	{"clean-template": clean_template, "setup-client": setup_client}[cmd](args)
