app_name        = "pranera_sample"
app_title       = "Pranera Sample Pass"
app_publisher   = "Pranera Services & Solutions"
app_description = "Mobile app for sample gate passes — raise, approve, gate check, return"
app_email       = "admin@pranera.in"
app_license     = "MIT"
app_version     = "1.0.0"

# Sample Movement Register, its workflow, reminders and the gate-photo
# controller all live in textiles_and_garments. This app is only the mobile
# front-end plus a thin API over that doctype — same split as pranera_roll.
required_apps = ["erpnext", "textiles_and_garments"]

add_to_apps_screen = [
    {
        "name": "pranera_sample",
        "logo": "/assets/pranera_sample/images/logo.svg",
        "title": "Sample Pass",
        "route": "/sample-app",
    }
]

website_route_rules = [
    {"from_route": "/sample-app/<path:app_path>", "to_route": "sample-app"},
]
