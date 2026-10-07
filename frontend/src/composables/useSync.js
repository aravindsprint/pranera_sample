// src/composables/useSync.js — Pranera Sample Pass
// Connectivity detection only (same probe as pranera_roll). This app is
// online-only: every screen reads live status and writes immediately, so
// there is no lookup cache or offline queue.
import { ref, onMounted, onUnmounted } from 'vue'

export const isOnline = ref(navigator.onLine)

const PROBE_URL              = '/api/method/ping'
const PROBE_TIMEOUT_MS       = 8000
const PROBE_EVERY_ONLINE_MS  = 15_000
const PROBE_EVERY_OFFLINE_MS = 4_000

let reachTimer = null
let probeInFlight = null

async function probeOnce() {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), PROBE_TIMEOUT_MS)
  try {
    const r = await fetch(`${PROBE_URL}?_=${Date.now()}`, {
      method: 'GET', credentials: 'include', cache: 'no-store', signal: ctrl.signal,
    })
    return !(r.status === 502 || r.status === 503 || r.status === 504)
  } catch {
    return false
  } finally {
    clearTimeout(t)
  }
}

export function checkReachable() {
  if (probeInFlight) return probeInFlight
  probeInFlight = probeOnce()
    .then(ok => { isOnline.value = ok; return ok })
    .finally(() => { probeInFlight = null })
  return probeInFlight
}

function scheduleProbe() {
  clearTimeout(reachTimer)
  reachTimer = setTimeout(async () => {
    await checkReachable()
    scheduleProbe()
  }, isOnline.value ? PROBE_EVERY_ONLINE_MS : PROBE_EVERY_OFFLINE_MS)
}

function onApiOk() { isOnline.value = true }

export function useSync() {
  const wake = () => { if (document.visibilityState === 'visible') checkReachable() }
  onMounted(() => {
    window.addEventListener('online', checkReachable)
    window.addEventListener('offline', checkReachable)
    window.addEventListener('focus', wake)
    document.addEventListener('visibilitychange', wake)
    window.addEventListener('sample:api-ok', onApiOk)
    checkReachable()
    scheduleProbe()
  })
  onUnmounted(() => {
    window.removeEventListener('online', checkReachable)
    window.removeEventListener('offline', checkReachable)
    window.removeEventListener('focus', wake)
    document.removeEventListener('visibilitychange', wake)
    window.removeEventListener('sample:api-ok', onApiOk)
    clearTimeout(reachTimer)
  })
  return { isOnline }
}
