# Pranera Sample Pass

Mobile app (Vue 3 PWA) for **sample gate passes** — the phone front-end for
the *Sample Movement Register* doctype in `textiles_and_garments`. Built the
same way as `pranera_roll`: Frappe app + `frontend/` Vite source + committed
build in `public/sample_app`, served at **`/sample-app`**.

| Who | Screen | Route | What they do |
|---|---|---|---|
| Any employee | Home | `/sample-app/home` | Counts, "New Gate Pass" |
| | New / Edit Gate Pass | `/sample-app/new`, `/sample-app/edit/<name>` | Party, purpose, return date, samples → **Send for approval** |
| | My Gate Passes | `/sample-app/my-passes` | Open / Overdue / Closed, search |
| | Pass detail | `/sample-app/pass/<name>` | Status, **QR to show at the gate**, photos, **Record return** (per-line qty, condition, leave-with-party) |
| Reporting manager | Approvals | `/sample-app/approvals` | Approve / Reject new passes, **approve write-offs** |
| Gate Security | Gate Check | `/sample-app/gate`, `/sample-app/gate/<name>` | Scan QR → green APPROVED / red NOT APPROVED → tick each sample → **take photo** → Confirm Exit. Return photo when samples come back. Queue of passes waiting to go out. |

The menu adapts to the user: the Approvals section appears for anyone with
something to approve (or Merchandising Managers), Gate Check only for Gate
Security / System Manager.

## Layout

```
pranera_sample/
├── frontend/                     Vue 3 + Vite PWA source (npm run build → pranera_sample/public/sample_app)
│   └── src/
│       ├── api/frappe.js         CSRF + fetch helpers (same as pranera_roll) and the Sample Pass API calls
│       ├── stores/auth.js        session info: employee, roles, counts
│       ├── pages/                home, my-passes, pass-form, pass-detail, approvals, gate-check, login
│       └── components/           AppHeader (drawer), PassCard, StatusBadge, PassQr, QrScannerModal, PhotoCapture, RemoteSelect
└── pranera_sample/
    ├── hooks.py                  /sample-app route, apps-screen tile, requires textiles_and_garments
    ├── api/gate_pass.py          whitelisted API (lists, detail, save, workflow actions, returns, gate)
    ├── www/sample-app.{html,py}  SPA shell (injects csrf_token + the hashed entry files)
    └── public/sample_app/        built PWA (committed)
```

## Where the rules live

Nothing is duplicated here. Approval routing (carrier's *Reports To*),
photo-before-exit, return progress, who may write off, row-level visibility
and the reminder/escalation emails are all in `textiles_and_garments`
(Sample Movement Register controller, workflow, `reminders.py`). This app
calls the same workflow (`frappe.model.workflow.apply_workflow`) and the same
gate endpoints as the desk *Sample Gate Check* page, so desk and phone always
agree.

## Notes

* **Online-only.** Every screen reads live status and writes immediately
  (approvals and gate exits must not be queued offline). The service worker
  only precaches JS/CSS/icons so the app opens fast and installs to the home
  screen; there is no navigate fallback and no API caching.
* **Hashed entry bundle.** The entry is `index-<hash>.js` and
  `www/sample-app.py` reads the real filenames from the built `index.html`.
  Lazy page chunks import that exact URL, so the app boots once. (A fixed
  `index.js` loaded with `?v=<mtime>` — the pranera_roll pattern — makes the
  chunks' `import "../index.js"` a *different* module, so the app, router and
  Pinia store boot twice.)
* **Photos** are compressed on the phone to ~1600px JPEG (~200–400 KB) and
  stored as private files attached to the register.
* Login needs an **active Employee with User ID** set, except Gate Security
  users, who can work without an Employee record.
