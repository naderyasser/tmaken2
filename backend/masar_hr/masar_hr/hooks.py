app_name = "masar_hr"
app_title = "Masar HR"
app_publisher = "Masar"
app_description = "Masar HR edition backend layer (install after base_meena)"
app_email = "mhmd5100@alqrawi.com"
app_license = "mit"
# needs base_meena installed first (no required_apps: install-app would try to fetch it from GitHub)

doc_events = {
	# base_meena: an announcement anyone has read could not be deleted (LinkExistsError on its read receipts)
	"Announcement": {"on_trash": "masar_hr.events.drop_announcement_receipts"},
}
