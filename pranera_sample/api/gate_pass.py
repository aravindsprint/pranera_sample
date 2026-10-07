"""pranera_sample/api/gate_pass.py

Thin, mobile-shaped API over **Sample Movement Register** (owned by the
textiles_and_garments app). All business rules — approval routing to the
carrier's Reports To manager, the photo-before-exit rule, return progress,
who may write off — live in that doctype's controller and Workflow. This
module only:

  * shapes data for the phone screens (lists, detail, counts)
  * applies Workflow actions on the user's behalf (same permission checks
    as the desk form — frappe.model.workflow.apply_workflow)
  * proxies the gate-security photo endpoints

Every read goes through frappe.get_list / doc.check_permission, so the
row-level rules from textiles_and_garments (staff see only their own and
the passes they approve) apply here too.
"""

import frappe
from frappe import _
from frappe.model.workflow import apply_workflow, get_transitions
from frappe.utils import cint, date_diff, flt, getdate, today

DT = "Sample Movement Register"
ITEM_DT = "Sample Movement Item"
TG = "textiles_and_garments.textiles_and_garments.doctype.sample_movement_register.sample_movement_register"

OUT_STATES = ("Out", "Partially Returned", "Overdue", "Escalated")
GATE_ROLES = {"Gate Security", "System Manager"}
MANAGER_ROLES = {"Merchandising Manager", "System Manager"}

LIST_FIELDS = [
	"name", "status", "docstatus", "carried_by", "carried_by_name", "department", "purpose",
	"party_type", "party_name", "other_party_name", "date_out", "expected_return_date",
	"actual_return_date", "return_progress", "gate_photo", "approved_by_name", "approver_user",
	"owner", "modified",
]
HEADER_FIELDS = (
	"carried_by", "purpose", "party_type", "party_name", "other_party_name",
	"date_out", "expected_return_date", "remarks",
)
ITEM_FIELDS = (
	"item_code", "item_description", "fabric_type", "color", "quantity", "unit",
	"estimated_value", "condition_out",
)
# Actions the app performs itself through a dedicated flow, never as a bare button.
HIDDEN_ACTIONS = {"Confirm Exit"}


def _tg(fn):
	return frappe.get_attr(f"{TG}.{fn}")


def _roles():
	return set(frappe.get_roles())


def _my_employee():
	return frappe.db.get_value(
		"Employee",
		{"user_id": frappe.session.user, "status": "Active"},
		["name", "employee_name", "designation", "department", "reports_to", "image"],
		as_dict=True,
	)


def _require_login():
	if frappe.session.user == "Guest":
		frappe.throw(_("Please log in."), frappe.AuthenticationError)


# ─────────────────────────────────────────────────────────── session / home
@frappe.whitelist()
def get_csrf():
	"""Token for the dev proxy (production gets it injected by www/sample-app)."""
	_require_login()
	return frappe.sessions.get_csrf_token()


@frappe.whitelist()
def get_session_info():
	_require_login()
	roles = _roles()
	emp = _my_employee()
	is_gate = bool(GATE_ROLES & roles)
	if not emp and not is_gate:
		frappe.throw(_("Your login is not linked to an active Employee record. Ask HR to set the User ID on your Employee."))

	return {
		"user": frappe.session.user,
		"full_name": frappe.utils.get_fullname(frappe.session.user),
		"employee": emp,
		"is_gate": is_gate,
		"is_manager": bool(MANAGER_ROLES & roles),
		"can_raise": bool(emp) and bool(frappe.has_permission(DT, "create")),
		"has_reports_to": bool(emp and emp.reports_to),
		"counts": _counts(emp, roles),
	}


def _counts(emp, roles):
	counts = {"approvals": 0, "my_open": 0, "my_overdue": 0, "awaiting_exit": 0}
	counts["approvals"] = len(_approval_rows(roles, fields=["name", "status"]))
	if emp:
		mine = frappe.get_list(
			DT,
			filters={"carried_by": emp.name, "status": ["in", ("Draft", "Pending Approval", "Approved", *OUT_STATES)]},
			fields=["status"],
			limit_page_length=0,
		)
		counts["my_open"] = len(mine)
		counts["my_overdue"] = sum(1 for r in mine if r.status in ("Overdue", "Escalated"))
	if GATE_ROLES & roles:
		counts["awaiting_exit"] = frappe.db.count(DT, {"status": "Approved", "docstatus": 1})
	return counts


# ─────────────────────────────────────────────────────────────────── lists
def _decorate(rows):
	now = getdate(today())
	for r in rows:
		r["party"] = r.get("party_name") or r.get("other_party_name")
		r["days_overdue"] = 0
		if r.get("status") in OUT_STATES and r.get("expected_return_date"):
			r["days_overdue"] = max(date_diff(now, r["expected_return_date"]), 0)
	return rows


def _approval_rows(roles, fields):
	"""Things waiting on this user: new passes to approve, and returns where
	the carrier asked to write off what stayed with the party."""
	user = frappe.session.user
	is_manager = bool(MANAGER_ROLES & roles)

	def q(filters):
		return frappe.get_list(DT, filters=filters, fields=fields, order_by="modified asc", limit_page_length=0)

	rows = q({"status": "Pending Approval", "approver_user": user})
	if is_manager:
		# Fallback approvals: carrier has no reporting manager with a login.
		rows += q({"status": "Pending Approval", "approver_user": ["is", "not set"]})

	write_offs = {"status": ["in", OUT_STATES], "return_progress": "Resolved with Write-off"}
	rows += q({**write_offs, "approver_user": user})
	if is_manager:
		rows += q({**write_offs, "approver_user": ["!=", user]})
		rows += q({**write_offs, "approver_user": ["is", "not set"]})

	seen, out = set(), []
	for r in rows:
		if r.name not in seen:
			seen.add(r.name)
			r["request"] = "write_off" if r.status != "Pending Approval" else "approval"
			out.append(r)
	return out


@frappe.whitelist()
def get_passes(scope="mine", status=None, txt=None, limit=50):
	"""scope: mine | approvals | all (managers / gate) | gate (approved, awaiting exit)."""
	_require_login()
	roles = _roles()
	limit = min(cint(limit) or 50, 200)

	if scope == "approvals":
		return _decorate(_approval_rows(roles, LIST_FIELDS))

	filters = {}
	or_filters = None
	if scope == "mine":
		emp = _my_employee()
		or_filters = {"owner": frappe.session.user}
		if emp:
			or_filters["carried_by"] = emp.name
	elif scope == "gate":
		if not GATE_ROLES & roles:
			frappe.throw(_("Only Gate Security can open the gate queue."), frappe.PermissionError)
		filters["status"] = "Approved"
	elif scope != "all":
		frappe.throw(_("Unknown scope {0}").format(scope))

	if status == "open":
		filters["status"] = ["in", ("Draft", "Pending Approval", "Approved", *OUT_STATES)]
	elif status == "overdue":
		filters["status"] = ["in", ("Overdue", "Escalated")]
	elif status == "closed":
		filters["status"] = ["in", ("Returned", "Written Off", "Cancelled")]
	elif status:
		filters["status"] = status

	if txt:
		like = f"%{txt}%"
		or_filters = None if scope != "mine" else or_filters
		search = [
			[DT, "name", "like", like], [DT, "carried_by_name", "like", like],
			[DT, "party_name", "like", like], [DT, "other_party_name", "like", like],
		]
		rows = frappe.get_list(DT, filters=filters, or_filters=search, fields=LIST_FIELDS,
			order_by="modified desc", limit_page_length=limit * 3)
		if scope == "mine":
			emp = _my_employee()
			rows = [r for r in rows if r.owner == frappe.session.user or (emp and r.carried_by == emp.name)]
		return _decorate(rows[:limit])

	return _decorate(frappe.get_list(
		DT, filters=filters, or_filters=or_filters, fields=LIST_FIELDS,
		order_by="modified desc", limit_page_length=limit,
	))


# ────────────────────────────────────────────────────────────────── detail
@frappe.whitelist()
def get_pass(name):
	_require_login()
	doc = frappe.get_doc(DT, name)
	doc.check_permission("read")
	return _serialize(doc)


def _serialize(doc):
	user = frappe.session.user
	emp = _my_employee()
	is_carrier = bool(emp and doc.carried_by == emp.name)
	can_write = bool(doc.has_permission("write"))

	actions, seen = [], set()
	if doc.docstatus < 2:
		for t in get_transitions(doc):
			if t.action in HIDDEN_ACTIONS or t.action in seen:
				continue
			if not t.get("allow_self_approval") and doc.owner == user and user != "Administrator":
				continue  # same rule the desk applies (has_approval_access)
			seen.add(t.action)
			actions.append({"action": t.action, "next_state": t.next_state})

	data = {f: doc.get(f) for f in LIST_FIELDS}
	data.update({
		"gate_pass_no": doc.gate_pass_no,
		"approved_by": doc.approved_by,
		"remarks": doc.remarks,
		"exit_confirmed_by": doc.exit_confirmed_by,
		"exited_on": doc.exited_on,
		"return_photo": doc.return_photo,
		"items": [{"name": r.name, "idx": r.idx, **{f: r.get(f) for f in ITEM_FIELDS},
			"returned_qty": r.returned_qty, "condition_in": r.condition_in,
			"written_off": r.written_off, "return_remarks": r.return_remarks} for r in doc.items],
		"actions": actions,
		"is_carrier": is_carrier,
		"is_approver": doc.approver_user == user,
		"can_edit": doc.docstatus == 0 and doc.status == "Draft" and can_write,
		"can_record_return": doc.status in OUT_STATES and can_write,
		"is_gate": bool(GATE_ROLES & _roles()),
	})
	_decorate([data])
	return data


# ────────────────────────────────────────────────────────────────── writes
@frappe.whitelist(methods=["POST"])
def save_pass(data, send_for_approval=0):
	"""Create or update a Draft pass. Optionally send it for approval in the same call."""
	_require_login()
	data = frappe.parse_json(data) or {}
	name = data.get("name")
	if name:
		doc = frappe.get_doc(DT, name)
		if doc.docstatus != 0 or doc.status != "Draft":
			frappe.throw(_("Only Draft passes can be edited (this one is {0}).").format(doc.status))
	else:
		doc = frappe.new_doc(DT)

	for f in HEADER_FIELDS:
		if f in data:
			doc.set(f, data.get(f) or None)
	if doc.party_type == "Other":
		doc.party_name = None
	else:
		doc.other_party_name = None

	items = data.get("items") or []
	if not items:
		frappe.throw(_("Add at least one sample."))
	doc.set("items", [])
	for row in items:
		doc.append("items", {f: row.get(f) for f in ITEM_FIELDS if row.get(f) not in (None, "")})

	doc.save()
	if cint(send_for_approval):
		apply_workflow(doc, "Send For Approval")
	return get_pass(doc.name)


@frappe.whitelist(methods=["POST"])
def apply_action(name, action):
	_require_login()
	if action in HIDDEN_ACTIONS:
		frappe.throw(_("Exit is confirmed by Gate Security with a photo, from the Gate Check screen."))
	doc = frappe.get_doc(DT, name)
	apply_workflow(doc, action)
	return get_pass(name)


@frappe.whitelist(methods=["POST"])
def delete_draft(name):
	_require_login()
	doc = frappe.get_doc(DT, name)
	if doc.docstatus != 0 or doc.status != "Draft":
		frappe.throw(_("Only Draft passes can be deleted."))
	frappe.delete_doc(DT, name)  # normal delete permission applies
	return True


RETURN_TARGET = {
	"Fully Returned": ("Returned", "Mark Returned"),
	"Partially Returned": ("Partially Returned", "Mark Partially Returned"),
	"Resolved with Write-off": ("Written Off", "Write Off"),
}


@frappe.whitelist(methods=["POST"])
def record_return(name, items, actual_return_date=None, remarks=None, close=1):
	"""Save returned qty / condition / write-off per line, then (close=1) move the
	pass to the matching status — if this user is allowed to.

	items: [{name, returned_qty, condition_in, written_off, return_remarks}]
	"""
	_require_login()
	doc = frappe.get_doc(DT, name)
	if doc.status not in OUT_STATES:
		frappe.throw(_("Returns can only be recorded while samples are out (this pass is {0}).").format(doc.status))

	by_name = {r.name: r for r in doc.items}
	for upd in frappe.parse_json(items) or []:
		row = by_name.get(upd.get("name"))
		if not row:
			continue
		row.returned_qty = flt(upd.get("returned_qty"))
		row.condition_in = upd.get("condition_in") or None
		row.written_off = cint(upd.get("written_off"))
		row.return_remarks = upd.get("return_remarks") or None
	if actual_return_date:
		doc.actual_return_date = actual_return_date
	if remarks is not None:
		doc.remarks = remarks
	doc.save()

	message = None
	if cint(close):
		doc.reload()
		target = RETURN_TARGET.get(doc.return_progress)
		if target and doc.status != target[0]:
			allowed = {t.action for t in get_transitions(doc)}
			if target[1] in allowed:
				apply_workflow(doc, target[1])
			elif target[1] == "Write Off":
				message = _("Saved. A write-off has to be approved by your reporting manager — they can close it from Approvals.")
			else:
				message = _("Saved, but you are not allowed to change the status of this pass.")

	result = get_pass(name)
	result["message"] = message
	return result


# ────────────────────────────────────────────────────────── search helpers
def _like(txt):
	return f"%{(txt or '').strip()}%"


@frappe.whitelist()
def search_parties(party_type, txt=""):
	"""Customer / Supplier picker. Returns only id + display name, so staff
	without CRM read access can still pick a party."""
	_require_login()
	cfg = {"Customer": ("customer_name", "disabled"), "Supplier": ("supplier_name", "disabled")}
	if party_type not in cfg:
		return []
	label, disabled = cfg[party_type]
	return frappe.get_all(
		party_type,
		filters={disabled: 0},
		or_filters={"name": ["like", _like(txt)], label: ["like", _like(txt)]},
		fields=["name as value", f"{label} as label"],
		order_by=f"{label} asc",
		limit_page_length=20,
	)


@frappe.whitelist()
def search_items(txt=""):
	_require_login()
	return frappe.get_all(
		"Item",
		filters={"disabled": 0},
		or_filters={"name": ["like", _like(txt)], "item_name": ["like", _like(txt)]},
		fields=["name as value", "item_name as label", "item_group as sub"],
		order_by="modified desc",
		limit_page_length=20,
	)


@frappe.whitelist()
def search_employees(txt=""):
	"""For raising a pass on behalf of a colleague."""
	_require_login()
	return frappe.get_all(
		"Employee",
		filters={"status": "Active"},
		or_filters={"name": ["like", _like(txt)], "employee_name": ["like", _like(txt)]},
		fields=["name as value", "employee_name as label", "department as sub"],
		order_by="employee_name asc",
		limit_page_length=20,
	)


# ──────────────────────────────────────────────────────────── gate security
@frappe.whitelist()
def gate_lookup(gate_pass_no):
	data = _tg("get_gate_pass")(gate_pass_no)
	_decorate([data])
	return data


@frappe.whitelist(methods=["POST"])
def gate_confirm_exit(gate_pass_no, image_data):
	return _tg("confirm_exit")(gate_pass_no, image_data)


@frappe.whitelist(methods=["POST"])
def gate_return_photo(gate_pass_no, image_data):
	return _tg("save_return_photo")(gate_pass_no, image_data)


@frappe.whitelist()
def gate_today():
	"""Gate dashboard: passes waiting to go out + what went out / came back today."""
	if not GATE_ROLES & _roles():
		frappe.throw(_("Only Gate Security can open the gate queue."), frappe.PermissionError)
	fields = ["name", "status", "carried_by_name", "department", "party_name", "other_party_name",
		"expected_return_date", "exited_on", "gate_photo", "return_photo", "modified"]
	waiting = frappe.get_all(DT, filters={"status": "Approved", "docstatus": 1}, fields=fields,
		order_by="modified asc", limit_page_length=100)
	exited = frappe.get_all(DT, filters={"docstatus": 1, "exited_on": [">=", today()]}, fields=fields,
		order_by="exited_on desc", limit_page_length=100)
	return {"waiting": _decorate(waiting), "exited_today": _decorate(exited)}
