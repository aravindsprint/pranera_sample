// src/api/frappe.js — Pranera Sample Pass
// Same transport layer as pranera_roll (CSRF handling, error extraction,
// connectivity signal). All domain calls go to pranera_sample.api.gate_pass,
// which wraps the Sample Movement Register doctype in textiles_and_garments.

const API = 'pranera_sample.api.gate_pass'

function signalServerReachable(res) {
  const s = res && res.status
  if (s && s !== 502 && s !== 503 && s !== 504) {
    try { window.dispatchEvent(new Event('sample:api-ok')) } catch { /* ignore */ }
  }
}

// ── CSRF ──────────────────────────────────────────────────────────────────
let _csrf = ''

function getCookieValue(name) {
  return document.cookie.split('; ').find(r => r.startsWith(name + '='))?.split('=')[1] || ''
}

export async function ensureCSRF() {
  if (_csrf) return _csrf
  if (window.csrf_token && window.csrf_token !== 'None') { _csrf = window.csrf_token; return _csrf }
  // Dev proxy / stale shell: ask the server (needs a logged-in session).
  try {
    const r = await fetch(`/api/method/${API}.get_csrf`, { credentials: 'include' })
    if (r.ok) {
      const d = await r.json()
      if (d?.message) { _csrf = d.message; window.csrf_token = d.message }
    }
  } catch (e) {
    console.warn('ensureCSRF failed', e)
  }
  return _csrf
}

export function resetCSRF() {
  _csrf = ''
  window.csrf_token = ''
}

export function currentUser() {
  return decodeURIComponent(getCookieValue('user_id') || '') || 'Guest'
}

export function isLoggedIn() {
  const u = currentUser()
  return !!u && u !== 'Guest'
}

// ── Core fetch helpers ────────────────────────────────────────────────────
function extractServerError(data, fallback = 'Request failed') {
  try {
    const msgs = JSON.parse(data._server_messages || '[]')
    if (msgs.length) {
      const last = JSON.parse(msgs[msgs.length - 1])
      const text = String(last.message || last).replace(/<[^>]+>/g, '').trim()
      if (text) return text
    }
  } catch { /* fall through */ }
  if (data.exception) {
    const parts = String(data.exception).split(':')
    return (parts.length > 1 ? parts.slice(1).join(':') : parts[0]).trim()
  }
  if (data.exc) {
    try {
      const tb = JSON.parse(data.exc)
      const lines = String(tb[0] || '').trim().split('\n')
      return lines[lines.length - 1].trim()
    } catch { /* fall through */ }
  }
  return fallback
}

async function handle(res) {
  signalServerReachable(res)
  let data = {}
  try { data = await res.json() } catch { /* non-JSON (proxy error page) */ }
  if (res.status === 401 || res.status === 403) {
    if (/Login|Session|Guest|not permitted/i.test(JSON.stringify(data)) && !isLoggedIn()) {
      window.location.href = '/sample-app/login'
    }
  }
  if (!res.ok || data.exc) throw new Error(extractServerError(data, res.statusText || 'Request failed'))
  return data.message
}

// POST — every mutation and every call that must not be cached.
export async function call(method, args = {}) {
  const token = await ensureCSRF()
  const body = new URLSearchParams()
  for (const [k, v] of Object.entries(args)) {
    if (v === undefined || v === null) continue
    body.append(k, typeof v === 'object' ? JSON.stringify(v) : v)
  }
  const res = await fetch(`/api/method/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'X-Frappe-CSRF-Token': token },
    body: body.toString(),
    credentials: 'include',
  })
  return handle(res)
}

// GET — read-only lookups.
export async function get(method, args = {}) {
  const params = new URLSearchParams()
  for (const [k, v] of Object.entries(args)) {
    if (v === undefined || v === null || v === '') continue
    params.append(k, typeof v === 'object' ? JSON.stringify(v) : v)
  }
  params.append('_', Date.now())
  const res = await fetch(`/api/method/${method}?${params}`, { credentials: 'include', cache: 'no-store' })
  return handle(res)
}

// ── Auth ──────────────────────────────────────────────────────────────────
export async function login(usr, pwd) {
  const res = await fetch('/api/method/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ usr, pwd }).toString(),
    credentials: 'include',
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok || data.message !== 'Logged In') {
    throw new Error(extractServerError(data, 'Incorrect email or password'))
  }
  return true
}

export async function logout() {
  try {
    const token = await ensureCSRF()
    await fetch('/api/method/frappe.auth.logout', {
      method: 'POST', headers: { 'X-Frappe-CSRF-Token': token }, credentials: 'include',
    })
  } catch { /* clear local state regardless */ }
  resetCSRF()
}

// ── Sample Pass API ───────────────────────────────────────────────────────
export const getSessionInfo = () => get(`${API}.get_session_info`)
export const getPasses = (scope, { status, txt, limit } = {}) => get(`${API}.get_passes`, { scope, status, txt, limit })
export const getPass = (name) => get(`${API}.get_pass`, { name })
export const savePass = (data, sendForApproval = false) =>
  call(`${API}.save_pass`, { data, send_for_approval: sendForApproval ? 1 : 0 })
export const applyAction = (name, action) => call(`${API}.apply_action`, { name, action })
export const deleteDraft = (name) => call(`${API}.delete_draft`, { name })
export const recordReturn = (name, items, { actualReturnDate, remarks, close = true } = {}) =>
  call(`${API}.record_return`, { name, items, actual_return_date: actualReturnDate, remarks, close: close ? 1 : 0 })

export const searchParties = (partyType, txt) => get(`${API}.search_parties`, { party_type: partyType, txt })
export const searchItems = (txt) => get(`${API}.search_items`, { txt })
export const searchEmployees = (txt) => get(`${API}.search_employees`, { txt })

export const gateLookup = (gatePassNo) => call(`${API}.gate_lookup`, { gate_pass_no: gatePassNo })
export const gateConfirmExit = (gatePassNo, imageData) => call(`${API}.gate_confirm_exit`, { gate_pass_no: gatePassNo, image_data: imageData })
export const gateReturnPhoto = (gatePassNo, imageData) => call(`${API}.gate_return_photo`, { gate_pass_no: gatePassNo, image_data: imageData })
export const gateToday = () => get(`${API}.gate_today`)
