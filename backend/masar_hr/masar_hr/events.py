import frappe


def drop_announcement_receipts(doc, method=None):
	"""Read receipts belong to the announcement — remove them with it so HR can delete it."""
	if frappe.db.exists("DocType", "Announcement Read Receipt"):
		frappe.db.delete("Announcement Read Receipt", {"announcement": doc.name})
