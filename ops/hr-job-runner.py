#!/usr/bin/env python3
"""
Root side of the operator panel (site_creator/hr_clients.py on fc.local).
Started by hr-client-jobs.path whenever a job lands in the spool; runs every
pending job one after the other with the ROOT-OWNED copy of the ops scripts
(/usr/local/lib/hr-clients — install-runner.sh refreshes it), so nothing the
web user can edit is ever executed as root. The job file is data only and is
validated again here.
"""
import json
import os
import re
import subprocess
import time

SPOOL = "/home/frappeuser/frappe-dev/hr-client-jobs"
STATUS = "/var/lib/hr-clients/status"
LIB = "/usr/local/lib/hr-clients"
FRAPPEUSER_GID = 0

SITE_RE = re.compile(r"^[a-z][a-z0-9-]{1,30}$")
JOB_RE = re.compile(r"^[0-9]{10}-[a-z][a-z0-9-]{1,30}$")
ABBR_RE = re.compile(r"^[A-Za-z0-9]{1,6}$")
COLOR_RE = re.compile(r"^#[0-9a-fA-F]{6}$")
DOMAIN_RE = re.compile(r"^(?=.{4,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$")
NUM_RE = re.compile(r"^[0-9]{0,6}$")


def write_status(job_id, data):
	path = os.path.join(STATUS, job_id + ".json")
	tmp = path + ".tmp"
	with open(tmp, "w") as f:
		json.dump(data, f, ensure_ascii=False)
	os.chown(tmp, 0, FRAPPEUSER_GID)
	os.chmod(tmp, 0o640)
	os.rename(tmp, path)


def read_job(path):
	fd = os.open(path, os.O_RDONLY | os.O_NOFOLLOW)
	with os.fdopen(fd) as f:
		return json.load(f)


def text_ok(v, maxlen):
	return isinstance(v, str) and len(v) <= maxlen and not any(c in v for c in "\n\r\t\x00")


def build_argv(job):
	if job.get("action") == "remove":
		assert SITE_RE.match(job["site"])
		return ["bash", f"{LIB}/remove-client.sh", "--site", job["site"], "--yes"]
	assert SITE_RE.match(job["site"]) and ABBR_RE.match(job["abbr"]) and COLOR_RE.match(job["color"])
	assert text_ok(job["company"], 120) and job["company"].strip() and text_ok(job["brand"], 120) and job["brand"].strip()
	for k, n in (("tagline", 120), ("plan", 60)):
		assert text_ok(job.get(k, ""), n)
	assert not job.get("domain") or DOMAIN_RE.match(job["domain"])
	assert NUM_RE.match(job.get("employees", "")) and NUM_RE.match(job.get("months", ""))
	assert not job.get("admin_user") or re.fullmatch(r"[A-Za-z0-9._@-]{3,60}", job["admin_user"])
	argv = ["bash", f"{LIB}/new-client.sh", "--site", job["site"], "--company", job["company"], "--abbr", job["abbr"],
		"--brand", job["brand"], "--color", job["color"]]
	for k in ("rate", "setup_fee"):
		assert re.fullmatch(r"(\d{1,6}(\.\d{1,2})?)?", job.get(k, ""))
	for opt, key in (("--rate", "rate"), ("--setup-fee", "setup_fee"), ("--admin-user", "admin_user"), ("--tagline", "tagline"), ("--domain", "domain"), ("--plan", "plan"), ("--employees", "employees"), ("--months", "months")):
		if job.get(key):
			argv += [opt, job[key]]
	logo = job.get("logo")
	if logo:
		real = os.path.realpath(logo)
		assert real.startswith(SPOOL + "/pending/") and os.path.isfile(real) and not os.path.islink(logo)
		argv += ["--logo", real]
	return argv


def run(job_id, path):
	done = os.path.join(SPOOL, "done", job_id + ".json")
	try:
		job = read_job(path)
	except Exception as e:
		os.replace(path, done)
		write_status(job_id, {"state": "failed", "error": f"bad job file: {e}"})
		return
	admin_pass = job.pop("admin_password", "") or ""
	# the done copy never keeps a typed password; O_NOFOLLOW: the spool is writable by the web user
	fd = os.open(done, os.O_WRONLY | os.O_CREAT | os.O_TRUNC | os.O_NOFOLLOW, 0o640)
	with os.fdopen(fd, "w") as f:
		json.dump(job, f, ensure_ascii=False)
	os.remove(path)
	action = job.get("action", "create")
	write_status(job_id, {"state": "running", "action": action, "site": job.get("site"), "started": time.time()})
	try:
		argv = build_argv(job)
	except Exception:
		write_status(job_id, {"state": "failed", "action": action, "site": job.get("site"), "error": "invalid job fields"})
		return
	log = os.path.join(STATUS, job_id + ".log")
	with open(log, "w") as out:
		os.chown(log, 0, FRAPPEUSER_GID)
		os.chmod(log, 0o640)
		try:
			env = {**os.environ, "HR_ADMIN_PASS": admin_pass} if admin_pass else None
			rc = subprocess.run(argv, stdout=out, stderr=subprocess.STDOUT, timeout=1800, cwd="/", env=env).returncode
		except subprocess.TimeoutExpired:
			rc = -1
	text = open(log).read()
	status = {"state": "done" if rc == 0 else "failed", "action": action, "site": job["site"], "finished": time.time()}
	if action == "create" and rc == 0:
		m = re.search(r"^\s+login\s+(\S+) / (\S+)$", text, re.M)
		status["admin_user"] = m.group(1) if m else "Administrator"
		status["admin_password"] = m.group(2) if m else None
		m = re.search(r"^\s+HR system\s+(\S+)$", text, re.M)
		status["url"] = m.group(1) if m else None
		m = re.search(r"^\s+company\s+(\S+)$", text, re.M)
		status["code"] = m.group(1) if m else job["site"]
		# the password stays in the status file only; strip it from the log
		if status["admin_password"]:
			open(log, "w").write(text.replace(status["admin_password"], "••••••"))
	if rc != 0:
		m = re.findall(r"✗ (.+)", text)
		status["error"] = m[-1] if m else "failed (see log)"
	write_status(job_id, status)
	if job.get("logo"):
		try:
			os.remove(job["logo"])
		except OSError:
			pass


def main():
	global FRAPPEUSER_GID
	import grp
	FRAPPEUSER_GID = grp.getgrnam("frappeuser").gr_gid
	os.makedirs(os.path.join(SPOOL, "done"), exist_ok=True)
	pending = os.path.join(SPOOL, "pending")
	while True:
		jobs = sorted(f[:-5] for f in os.listdir(pending) if f.endswith(".json") and JOB_RE.match(f[:-5]))
		if not jobs:
			return
		for job_id in jobs:
			run(job_id, os.path.join(pending, job_id + ".json"))


if __name__ == "__main__":
	main()
