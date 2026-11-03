# Copyright (c) 2026, Frappe Technologies Pvt. Ltd. and contributors
# For license information, please see license.txt

"""
Radius Alert Admin APIs
-----------------------
HR Manager APIs for managing employee radius alert settings and viewing alert logs.

These APIs are used by the frontend to:
1. Get all employees with their radius alert settings
2. Update radius alert settings for an employee
3. Get alert logs (all or filtered by employee/date)
4. Get dashboard statistics
5. Get individual employee radius settings
"""

import frappe
from frappe import _
from datetime import datetime, timedelta


def _verify_hr_manager():
	"""Verify current user has HR Manager role"""
	if frappe.session.user == "Administrator":
		return
	
	roles = frappe.get_roles(frappe.session.user)
	if "HR Manager" not in roles:
		frappe.throw(_("Only HR Managers can access this resource"), frappe.PermissionError)


@frappe.whitelist()
def get_employees_radius_settings():
	"""
	Get all employees with their radius alert settings.
	Returns employees WITH and WITHOUT settings configured.

	Response:
	{
		"employees": [
			{
				"employee": "HR-EMP-00001",
				"employee_name": "Ahmed Mohamed",
				"department": "Sales",
				"designation": "Sales Rep",
				"status": "Active",
				"has_settings": true,
				"enable_tracking": 1,
				"enable_radius_alert": 1,
				"alert_radius": 500,
				"center_latitude": 24.7136,
				"center_longitude": 46.6753,
				"notify_hr_manager": 1,
				"notification_message": "",
				"total_alerts": 3,
				"last_alert": "2026-02-14 13:34:49"
			}
		]
	}
	"""
	_verify_hr_manager()
	
	# Get all active employees
	employees = frappe.get_all(
		"Employee",
		filters={"status": "Active"},
		fields=["name as employee", "employee_name", "department", "designation", "status", "company"],
		order_by="employee_name asc"
	)
	
	# Get all location settings
	all_settings = frappe.get_all(
		"Employee Location Settings",
		fields=[
			"employee", "enable_tracking", "enable_radius_alert",
			"alert_radius", "center_latitude", "center_longitude",
			"notify_hr_manager", "notification_message",
			"checkin_method", "tracking_interval", "interval_number"
		]
	)
	settings_map = {s.employee: s for s in all_settings}
	
	# Get alert counts per employee
	alert_counts = frappe.db.sql("""
		SELECT employee, COUNT(*) as total_alerts, MAX(alert_datetime) as last_alert
		FROM `tabEmployee Radius Alert Log`
		WHERE docstatus < 2
		GROUP BY employee
	""", as_dict=True)
	alert_map = {a.employee: a for a in alert_counts}
	
	# Merge data
	result = []
	for emp in employees:
		settings = settings_map.get(emp.employee, {})
		alerts = alert_map.get(emp.employee, {})
		
		result.append({
			"employee": emp.employee,
			"employee_name": emp.employee_name,
			"department": emp.department,
			"designation": emp.designation,
			"status": emp.status,
			"company": emp.company,
			"has_settings": bool(settings),
			"enable_tracking": settings.get("enable_tracking", 0) if settings else 0,
			"enable_radius_alert": settings.get("enable_radius_alert", 0) if settings else 0,
			"alert_radius": settings.get("alert_radius", 0) if settings else 0,
			"center_latitude": settings.get("center_latitude", 0) if settings else 0,
			"center_longitude": settings.get("center_longitude", 0) if settings else 0,
			"notify_hr_manager": settings.get("notify_hr_manager", 0) if settings else 0,
			"notification_message": settings.get("notification_message", "") if settings else "",
			"checkin_method": settings.get("checkin_method", "Manual") if settings else "Manual",
			"tracking_interval": settings.get("tracking_interval", "Minutes") if settings else "Minutes",
			"interval_number": settings.get("interval_number", 1) if settings else 1,
			"total_alerts": alerts.get("total_alerts", 0) if alerts else 0,
			"last_alert": str(alerts.get("last_alert", "")) if alerts and alerts.get("last_alert") else None,
		})
	
	return {"employees": result}


@frappe.whitelist()
def get_employee_radius_settings(employee):
	"""
	Get radius alert settings for a specific employee.
	
	Args:
		employee: Employee ID (e.g., "HR-EMP-00001")
	
	Response:
	{
		"employee": "HR-EMP-00001",
		"employee_name": "Ahmed Mohamed",
		"has_settings": true,
		"settings": {
			"enable_tracking": 1,
			"employee_consent": 1,
			"enable_radius_alert": 1,
			"alert_radius": 500,
			"center_latitude": 24.7136,
			"center_longitude": 46.6753,
			"notify_hr_manager": 1,
			"notification_message": "",
			"checkin_method": "Manual",
			"tracking_interval": "Minutes",
			"interval_number": 1
		}
	}
	"""
	_verify_hr_manager()
	
	if not employee:
		frappe.throw(_("Employee ID is required"))
	
	emp = frappe.db.get_value("Employee", employee, ["name", "employee_name"], as_dict=True)
	if not emp:
		frappe.throw(_("Employee not found"))
	
	settings = None
	if frappe.db.exists("Employee Location Settings", employee):
		doc = frappe.get_doc("Employee Location Settings", employee)
		settings = {
			"enable_tracking": doc.enable_tracking,
			"employee_consent": doc.employee_consent,
			"enable_radius_alert": doc.enable_radius_alert,
			"alert_radius": doc.alert_radius,
			"center_latitude": doc.center_latitude,
			"center_longitude": doc.center_longitude,
			"notify_hr_manager": doc.notify_hr_manager,
			"notification_message": doc.notification_message,
			"checkin_method": doc.checkin_method,
			"tracking_interval": doc.tracking_interval,
			"interval_number": doc.interval_number,
			"interval_in_milliseconds": doc.interval_in_milliseconds,
		}
	
	return {
		"employee": employee,
		"employee_name": emp.employee_name,
		"has_settings": settings is not None,
		"settings": settings or {
			"enable_tracking": 0,
			"employee_consent": 0,
			"enable_radius_alert": 0,
			"alert_radius": 0,
			"center_latitude": 0,
			"center_longitude": 0,
			"notify_hr_manager": 1,
			"notification_message": "",
			"checkin_method": "Manual",
			"tracking_interval": "Minutes",
			"interval_number": 1,
			"interval_in_milliseconds": 60000,
		}
	}


@frappe.whitelist()
def update_radius_settings(employee, enable_radius_alert, alert_radius=0, center_latitude=0, center_longitude=0, notify_hr_manager=1, notification_message=""):
	"""
	Update radius alert settings for an employee.
	Creates Employee Location Settings if it doesn't exist.
	
	Args:
		employee: Employee ID
		enable_radius_alert: 1 to enable, 0 to disable
		alert_radius: Radius in meters (required if enabling)
		center_latitude: Center point latitude (required if enabling)
		center_longitude: Center point longitude (required if enabling)
		notify_hr_manager: 1 to notify, 0 to not (default: 1)
		notification_message: Custom notification message (optional)
	
	Response:
	{
		"success": true,
		"message": "Radius alert settings updated successfully",
		"employee": "HR-EMP-00001"
	}
	"""
	_verify_hr_manager()
	
	if not employee:
		frappe.throw(_("Employee ID is required"))
	
	if not frappe.db.exists("Employee", employee):
		frappe.throw(_("Employee not found"))
	
	enable_radius_alert = int(enable_radius_alert)
	alert_radius = int(alert_radius or 0)
	center_latitude = float(center_latitude or 0)
	center_longitude = float(center_longitude or 0)
	notify_hr_manager = int(notify_hr_manager if notify_hr_manager is not None else 1)
	
	# Validate if enabling
	if enable_radius_alert:
		if alert_radius <= 0:
			frappe.throw(_("Alert radius must be greater than 0"))
		if center_latitude == 0 and center_longitude == 0:
			frappe.throw(_("Center coordinates are required"))
	
	# Create or update settings
	if frappe.db.exists("Employee Location Settings", employee):
		doc = frappe.get_doc("Employee Location Settings", employee)
		doc.enable_radius_alert = enable_radius_alert
		doc.alert_radius = alert_radius
		doc.center_latitude = center_latitude
		doc.center_longitude = center_longitude
		doc.notify_hr_manager = notify_hr_manager
		doc.notification_message = notification_message or ""
		doc.save(ignore_permissions=True)
	else:
		doc = frappe.get_doc({
			"doctype": "Employee Location Settings",
			"employee": employee,
			"enable_tracking": 1,
			"employee_consent": 1,
			"enable_radius_alert": enable_radius_alert,
			"alert_radius": alert_radius,
			"center_latitude": center_latitude,
			"center_longitude": center_longitude,
			"notify_hr_manager": notify_hr_manager,
			"notification_message": notification_message or "",
			"checkin_method": "Manual",
			"tracking_interval": "Minutes",
			"interval_number": 1,
		})
		doc.insert(ignore_permissions=True)
	
	frappe.db.commit()
	
	return {
		"success": True,
		"message": _("Radius alert settings updated successfully"),
		"employee": employee
	}


@frappe.whitelist()
def get_alert_logs(employee=None, from_date=None, to_date=None, page=1, page_size=20):
	"""
	Get radius alert logs with pagination and filters.
	
	Args:
		employee: Optional employee filter
		from_date: Optional start date (YYYY-MM-DD)
		to_date: Optional end date (YYYY-MM-DD)
		page: Page number (default: 1)
		page_size: Items per page (default: 20)
	
	Response:
	{
		"alerts": [
			{
				"name": "ALERT-HR-EMP-00001-001",
				"employee": "HR-EMP-00001",
				"employee_name": "Ahmed Mohamed",
				"alert_datetime": "2026-02-14 13:34:49",
				"distance_from_center": 650.5,
				"alert_radius": 500,
				"latitude": 24.7200,
				"longitude": 46.6800,
				"google_maps_url": "https://www.google.com/maps?q=24.72,46.68"
			}
		],
		"total": 15,
		"page": 1,
		"page_size": 20,
		"total_pages": 1
	}
	"""
	_verify_hr_manager()
	
	filters = {"docstatus": ["<", 2]}
	
	if employee:
		filters["employee"] = employee
	
	if from_date and to_date:
		filters["alert_datetime"] = ["between", [f"{from_date} 00:00:00", f"{to_date} 23:59:59"]]
	elif from_date:
		filters["alert_datetime"] = [">=", f"{from_date} 00:00:00"]
	elif to_date:
		filters["alert_datetime"] = ["<=", f"{to_date} 23:59:59"]
	
	page = int(page or 1)
	page_size = int(page_size or 20)
	start = (page - 1) * page_size
	
	# Get total count
	total = frappe.db.count("Employee Radius Alert Log", filters=filters)
	
	# Get alerts
	alerts = frappe.get_all(
		"Employee Radius Alert Log",
		filters=filters,
		fields=[
			"name", "employee", "employee_name",
			"alert_datetime", "distance_from_center",
			"alert_radius", "latitude", "longitude"
		],
		order_by="alert_datetime desc",
		start=start,
		limit_page_length=page_size
	)
	
	# Add Google Maps URL
	for alert in alerts:
		alert["google_maps_url"] = f"https://www.google.com/maps?q={alert.latitude},{alert.longitude}"
		alert["alert_datetime"] = str(alert.alert_datetime) if alert.alert_datetime else None
		alert["distance_from_center"] = round(alert.distance_from_center, 2) if alert.distance_from_center else 0
	
	import math
	total_pages = math.ceil(total / page_size) if total > 0 else 1
	
	return {
		"alerts": alerts,
		"total": total,
		"page": page,
		"page_size": page_size,
		"total_pages": total_pages
	}


@frappe.whitelist()
def get_dashboard_stats():
	"""
	Get radius alert dashboard statistics for HR Manager.
	
	Response:
	{
		"total_employees": 25,
		"tracking_enabled": 5,
		"radius_alert_enabled": 3,
		"total_alerts_today": 2,
		"total_alerts_this_week": 8,
		"total_alerts_this_month": 25,
		"employees_outside_radius_today": ["HR-EMP-00001", "HR-EMP-00005"],
		"recent_alerts": [...]
	}
	"""
	_verify_hr_manager()
	
	today = datetime.now().date()
	week_start = today - timedelta(days=today.weekday())
	month_start = today.replace(day=1)
	
	# Total employees
	total_employees = frappe.db.count("Employee", {"status": "Active"})
	
	# Tracking enabled
	tracking_enabled = frappe.db.count("Employee Location Settings", {"enable_tracking": 1})
	
	# Radius alert enabled
	radius_alert_enabled = frappe.db.count("Employee Location Settings", {"enable_radius_alert": 1})
	
	# Alerts today
	total_alerts_today = frappe.db.count(
		"Employee Radius Alert Log",
		{"alert_datetime": [">=", f"{today} 00:00:00"], "docstatus": ["<", 2]}
	)
	
	# Alerts this week
	total_alerts_this_week = frappe.db.count(
		"Employee Radius Alert Log",
		{"alert_datetime": [">=", f"{week_start} 00:00:00"], "docstatus": ["<", 2]}
	)
	
	# Alerts this month
	total_alerts_this_month = frappe.db.count(
		"Employee Radius Alert Log",
		{"alert_datetime": [">=", f"{month_start} 00:00:00"], "docstatus": ["<", 2]}
	)
	
	# Employees outside radius today
	employees_outside = frappe.db.sql("""
		SELECT DISTINCT employee, employee_name
		FROM `tabEmployee Radius Alert Log`
		WHERE alert_datetime >= %s AND docstatus < 2
	""", (f"{today} 00:00:00",), as_dict=True)
	
	# Recent alerts (last 10)
	recent_alerts = frappe.get_all(
		"Employee Radius Alert Log",
		filters={"docstatus": ["<", 2]},
		fields=[
			"name", "employee", "employee_name",
			"alert_datetime", "distance_from_center",
			"alert_radius", "latitude", "longitude"
		],
		order_by="alert_datetime desc",
		limit=10
	)
	
	for alert in recent_alerts:
		alert["google_maps_url"] = f"https://www.google.com/maps?q={alert.latitude},{alert.longitude}"
		alert["alert_datetime"] = str(alert.alert_datetime) if alert.alert_datetime else None
	
	return {
		"total_employees": total_employees,
		"tracking_enabled": tracking_enabled,
		"radius_alert_enabled": radius_alert_enabled,
		"total_alerts_today": total_alerts_today,
		"total_alerts_this_week": total_alerts_this_week,
		"total_alerts_this_month": total_alerts_this_month,
		"employees_outside_radius_today": [
			{"employee": e.employee, "employee_name": e.employee_name}
			for e in employees_outside
		],
		"recent_alerts": recent_alerts
	}


@frappe.whitelist()
def disable_radius_alert(employee):
	"""
	Quick disable radius alert for an employee.
	
	Args:
		employee: Employee ID
	
	Response:
	{
		"success": true,
		"message": "Radius alert disabled for HR-EMP-00001"
	}
	"""
	_verify_hr_manager()
	
	if not employee:
		frappe.throw(_("Employee ID is required"))
	
	if frappe.db.exists("Employee Location Settings", employee):
		frappe.db.set_value("Employee Location Settings", employee, "enable_radius_alert", 0)
		frappe.db.commit()
	
	return {
		"success": True,
		"message": _("Radius alert disabled for {0}").format(employee)
	}


@frappe.whitelist()
def get_employee_location_history(employee, date=None):
	"""
	Get employee's location history for a specific date (for map view).
	
	Args:
		employee: Employee ID
		date: Date in YYYY-MM-DD format (default: today)
	
	Response:
	{
		"employee": "HR-EMP-00001",
		"employee_name": "Ahmed Mohamed",
		"date": "2026-02-14",
		"locations": [
			{
				"name": "LOC-2026-00001",
				"log_datetime": "2026-02-14 09:00:00",
				"latitude": 24.7136,
				"longitude": 46.6753,
				"accuracy": 15.5,
				"address": "King Fahd Road, Riyadh"
			}
		],
		"center": {
			"latitude": 24.7136,
			"longitude": 46.6753,
			"alert_radius": 500
		},
		"alerts_today": [...]
	}
	"""
	_verify_hr_manager()
	
	if not employee:
		frappe.throw(_("Employee ID is required"))
	
	target_date = date or str(datetime.now().date())
	
	emp = frappe.db.get_value("Employee", employee, ["name", "employee_name"], as_dict=True)
	if not emp:
		frappe.throw(_("Employee not found"))
	
	# Get locations
	locations = frappe.get_all(
		"Employee Location Log",
		filters={
			"employee": employee,
			"log_datetime": ["between", [f"{target_date} 00:00:00", f"{target_date} 23:59:59"]]
		},
		fields=["name", "log_datetime", "latitude", "longitude", "accuracy", "address"],
		order_by="log_datetime asc"
	)
	
	for loc in locations:
		loc["log_datetime"] = str(loc.log_datetime) if loc.log_datetime else None
	
	# Get center point settings
	center = None
	if frappe.db.exists("Employee Location Settings", employee):
		settings = frappe.db.get_value(
			"Employee Location Settings", employee,
			["enable_radius_alert", "center_latitude", "center_longitude", "alert_radius"],
			as_dict=True
		)
		if settings and settings.enable_radius_alert:
			center = {
				"latitude": settings.center_latitude,
				"longitude": settings.center_longitude,
				"alert_radius": settings.alert_radius
			}
	
	# Get alerts for this date
	alerts_today = frappe.get_all(
		"Employee Radius Alert Log",
		filters={
			"employee": employee,
			"alert_datetime": ["between", [f"{target_date} 00:00:00", f"{target_date} 23:59:59"]],
			"docstatus": ["<", 2]
		},
		fields=["name", "alert_datetime", "distance_from_center", "alert_radius", "latitude", "longitude"],
		order_by="alert_datetime asc"
	)
	
	for alert in alerts_today:
		alert["alert_datetime"] = str(alert.alert_datetime) if alert.alert_datetime else None
		alert["google_maps_url"] = f"https://www.google.com/maps?q={alert.latitude},{alert.longitude}"
	
	return {
		"employee": employee,
		"employee_name": emp.employee_name,
		"date": target_date,
		"locations": locations,
		"center": center,
		"alerts_today": alerts_today
	}
