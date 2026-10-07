# Deploying pranera_sample

Requires `textiles_and_garments` with the Sample Movement Register changes
(patch `setup_sample_movement_register`) already migrated on the site.

## 1. Push to GitHub
```bash
cd pranera_sample
git init && git add . && git commit -m "pranera_sample: sample gate pass mobile app"
git branch -M main
git remote add origin git@github.com:aravindsprint/pranera_sample.git
git push -u origin main
```

## 2. Install on the bench
```bash
cd ~/frappe-bench
bench get-app https://github.com/aravindsprint/pranera_sample.git
bench --site erp.pranera.in install-app pranera_sample
bench build --app pranera_sample
bench restart
```
Open `https://erp.pranera.in/sample-app` (also on the Frappe apps screen as **Sample Pass**).
On a phone: browser menu → *Add to Home screen*.

## 3. Rebuilding the frontend after changes
```bash
cd apps/pranera_sample/frontend
npm install
npm run build          # writes ../pranera_sample/public/sample_app
cd ~/frappe-bench && bench build --app pranera_sample && bench restart
```

## Local dev
`npm run dev` → http://localhost:3000/sample-app (proxied to erp.pranera.in;
set `VITE_BACKEND=http://localhost:8000` to use a local bench).

## Before go-live
* Every employee who raises passes needs **User ID** set on their Employee
  and a **Reports To** manager who also has a login.
* Gate guards need a user with the **Gate Security** role.
* Camera access needs **HTTPS** (erp.pranera.in already is).
