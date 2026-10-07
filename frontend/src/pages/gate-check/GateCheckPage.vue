<template>
  <div class="page">
    <AppHeader title="Gate Check" :subtitle="p ? p.name : 'Scan the employee\'s gate pass'" active="gate" :show-back="!!p" />
    <div class="page-content">

      <div v-if="auth.info && !auth.isGate" class="alert alert-error"><i class="pi pi-lock"></i> Only Gate Security can use this screen.</div>

      <template v-else>
        <!-- Lookup -->
        <div v-if="!p && !done" class="lookup">
          <button class="btn btn-primary btn-full scan-btn" @click="scanning = true"><i class="pi pi-qrcode"></i> Scan QR</button>
          <div class="or">or type the pass number</div>
          <form class="find" @submit.prevent="lookup(typed)">
            <input v-model="typed" class="form-input" placeholder="SMR-2026-00012" autocapitalize="characters" autocomplete="off" />
            <button class="btn btn-primary" :disabled="!typed.trim() || loading">Find</button>
          </form>
          <div v-if="error" class="alert alert-error" style="margin-top:12px"><i class="pi pi-exclamation-triangle"></i> {{ error }}</div>

          <div class="queue">
            <div class="queue__title">Waiting to go out <span>{{ queue.waiting.length }}</span></div>
            <button v-for="q in queue.waiting" :key="q.name" class="qrow" @click="lookup(q.name)">
              <b>{{ q.name }}</b><span>{{ q.carried_by_name }} → {{ q.party_name || q.other_party_name }}</span>
            </button>
            <div v-if="!queue.waiting.length" class="queue__empty">No approved passes waiting.</div>

            <div class="queue__title" style="margin-top:16px">Went out today <span>{{ queue.exited_today.length }}</span></div>
            <button v-for="q in queue.exited_today" :key="q.name" class="qrow" @click="lookup(q.name)">
              <b>{{ q.name }}</b><span>{{ q.carried_by_name }} · {{ fmtDateTime(q.exited_on).split(', ')[1] }}</span>
            </button>
          </div>
        </div>

        <!-- Done -->
        <div v-else-if="done" class="done" :class="'done--' + done.kind">
          <div class="done__icon">{{ done.kind === 'exit' ? '✅' : '📸' }}</div>
          <div class="done__title">{{ done.kind === 'exit' ? 'EXIT CONFIRMED' : 'RETURN PHOTO SAVED' }}</div>
          <div class="done__sub">{{ done.name }} · {{ done.who }}</div>
          <button class="btn btn-primary btn-full btn-lg" @click="reset">Next pass</button>
        </div>

        <!-- Pass -->
        <template v-else>
          <div class="verdict" :class="'verdict--' + verdict.tone">
            <div class="verdict__big">{{ verdict.big }}</div>
            <div class="verdict__small">{{ verdict.small }}</div>
          </div>

          <div class="card">
            <div class="kv"><span>Employee</span><b>{{ p.carried_by_name }}</b></div>
            <div class="kv"><span>Department</span><b>{{ p.department || '—' }}</b></div>
            <div class="kv"><span>Going to</span><b>{{ p.party || '—' }}</b></div>
            <div class="kv"><span>Purpose</span><b>{{ p.purpose }}</b></div>
            <div class="kv"><span>Return by</span><b>{{ fmtDate(p.expected_return_date) }}</b></div>
            <div class="kv"><span>Approved by</span><b>{{ p.approved_by_name || '—' }}</b></div>
          </div>

          <!-- Items to physically match -->
          <div class="card">
            <div class="section-title">
              {{ canExit ? 'Check each sample' : 'Samples on this pass' }}
              <span v-if="canExit" class="tick-count">{{ ticked.size }}/{{ p.items.length }}</span>
            </div>
            <button v-for="it in p.items" :key="it.idx" class="chk" :class="{ 'chk--on': ticked.has(it.idx), 'chk--static': !canExit }" @click="toggle(it.idx)">
              <span class="chk__box"><i v-if="ticked.has(it.idx)" class="pi pi-check"></i></span>
              <span class="chk__body">
                <span class="chk__desc">{{ it.description }}</span>
                <span class="chk__sub">{{ [it.item_code, it.fabric_type, it.color, it.condition_out].filter(Boolean).join(' · ') }}</span>
              </span>
              <span class="chk__qty">{{ fmtQty(it.quantity, it.unit) }}</span>
            </button>
          </div>

          <!-- Outgoing photo (comparison when samples come back) -->
          <div v-if="p.gate_photo" class="card">
            <div class="section-title">Photo when it left <small>{{ fmtDateTime(p.exited_on) }}</small></div>
            <img :src="fileUrl(p.gate_photo)" class="big-photo" alt="Outgoing samples" />
            <img v-if="p.return_photo" :src="fileUrl(p.return_photo)" class="big-photo" style="margin-top:8px" alt="Returned samples" />
          </div>

          <!-- Exit -->
          <div v-if="canExit" class="card">
            <div class="section-title">Photo of the samples leaving</div>
            <PhotoCapture v-model="photo" label="Take photo of samples" />
            <button class="btn btn-primary btn-full btn-xl" :disabled="!photo || ticked.size < p.items.length || busy" @click="confirmExit">
              {{ busy ? 'Uploading…' : (ticked.size < p.items.length ? `Tick all samples (${ticked.size}/${p.items.length})` : (!photo ? 'Take the photo first' : 'Confirm Exit')) }}
            </button>
          </div>

          <!-- Return photo -->
          <div v-else-if="canReturnPhoto" class="card">
            <div class="section-title">Samples coming back?</div>
            <PhotoCapture v-model="photo" label="Take return photo" />
            <button class="btn btn-primary btn-full btn-xl" :disabled="!photo || busy" @click="saveReturnPhoto">{{ busy ? 'Uploading…' : 'Save Return Photo' }}</button>
            <p class="help">The employee records the returned quantities in their app.</p>
          </div>

          <div v-if="error" class="alert alert-error"><i class="pi pi-exclamation-triangle"></i> {{ error }}</div>
          <button class="btn btn-ghost btn-full" @click="reset">Check another pass</button>
        </template>
      </template>

      <QrScannerModal v-model:open="scanning" @scan="onScan" />
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { gateLookup, gateConfirmExit, gateReturnPhoto, gateToday } from '@/api/frappe'
import { showToast } from '@/composables/useToast'
import { fmtDate, fmtDateTime, fmtQty, fileUrl } from '@/utils/format'
import AppHeader from '@/components/AppHeader.vue'
import QrScannerModal from '@/components/QrScannerModal.vue'
import PhotoCapture from '@/components/PhotoCapture.vue'

const props = defineProps({ gatePassNo: { type: String, default: '' } })
const auth = useAuthStore()
const router = useRouter()

const typed = ref('')
const scanning = ref(false)
const p = ref(null)
const photo = ref('')
const ticked = ref(new Set())
const loading = ref(false)
const busy = ref(false)
const error = ref('')
const done = ref(null)
const queue = reactive({ waiting: [], exited_today: [] })

const OUT = ['Out', 'Partially Returned', 'Overdue', 'Escalated', 'Returned', 'Written Off']
const canExit = computed(() => p.value?.status === 'Approved')
const canReturnPhoto = computed(() => p.value && OUT.includes(p.value.status) && p.value.status !== 'Written Off')

const verdict = computed(() => {
  const s = p.value?.status
  if (s === 'Approved') return { tone: 'go', big: 'APPROVED', small: 'Check every sample, take a photo, then confirm exit.' }
  if (s === 'Draft' || s === 'Pending Approval') return { tone: 'stop', big: 'NOT APPROVED', small: 'Do not allow these samples out.' }
  if (s === 'Cancelled') return { tone: 'stop', big: 'CANCELLED', small: 'This gate pass is not valid.' }
  if (s === 'Returned' || s === 'Written Off') return { tone: 'info', big: s.toUpperCase(), small: 'This pass is already closed.' }
  return { tone: 'info', big: 'ALREADY OUT', small: `Left the gate ${fmtDateTime(p.value?.exited_on)}.` }
})

// Accept a bare pass number, a desk URL (/app/sample-movement-register/SMR-…) or a print URL.
function parseScan(text) {
  const t = String(text || '').trim()
  const m = t.match(/SMR-\d{4}-\d+/i)
  return m ? m[0].toUpperCase() : t
}

async function lookup(value) {
  const v = parseScan(value)
  if (!v) return
  loading.value = true
  error.value = ''
  done.value = null
  try {
    p.value = await gateLookup(v)
    photo.value = ''
    ticked.value = new Set()
    if (props.gatePassNo !== p.value.name) router.replace(`/sample-app/gate/${encodeURIComponent(p.value.name)}`)
  } catch (e) {
    p.value = null
    error.value = e.message
    if (navigator.vibrate) navigator.vibrate([200, 100, 200])
  } finally { loading.value = false }
}
function onScan(text) { typed.value = parseScan(text); lookup(text) }

function toggle(idx) {
  if (!canExit.value) return
  const s = new Set(ticked.value)
  s.has(idx) ? s.delete(idx) : s.add(idx)
  ticked.value = s
}

async function confirmExit() {
  busy.value = true
  error.value = ''
  try {
    await gateConfirmExit(p.value.name, photo.value)
    done.value = { kind: 'exit', name: p.value.name, who: p.value.carried_by_name }
    if (navigator.vibrate) navigator.vibrate(120)
    auth.load(true)
  } catch (e) { error.value = e.message } finally { busy.value = false }
}

async function saveReturnPhoto() {
  busy.value = true
  error.value = ''
  try {
    await gateReturnPhoto(p.value.name, photo.value)
    done.value = { kind: 'return', name: p.value.name, who: p.value.carried_by_name }
  } catch (e) { error.value = e.message } finally { busy.value = false }
}

async function loadQueue() {
  try { Object.assign(queue, await gateToday()) } catch { /* not gate / offline — lookup still works */ }
}

function reset() {
  p.value = null
  done.value = null
  photo.value = ''
  typed.value = ''
  error.value = ''
  router.replace('/sample-app/gate')
  loadQueue()
}

watch(() => props.gatePassNo, (v) => { if (v && v !== p.value?.name) lookup(v) })
onMounted(async () => {
  await auth.load()
  if (!auth.isGate) return
  if (props.gatePassNo) lookup(props.gatePassNo)
  loadQueue()
})
</script>

<style scoped>
.scan-btn { height:72px; font-size:20px; border-radius:16px; }
.scan-btn i { font-size:24px; }
.or { text-align:center; font-size:12px; color:var(--slate-400); margin:14px 0 8px; text-transform:uppercase; letter-spacing:.06em; font-weight:700; }
.find { display:grid; grid-template-columns:1fr auto; gap:8px; }
.find .form-input { font-size:18px; font-weight:700; letter-spacing:.02em; }
.queue { margin-top:22px; }
.queue__title { font-size:12px; font-weight:800; color:var(--slate-500); text-transform:uppercase; letter-spacing:.06em; margin-bottom:8px; display:flex; justify-content:space-between; }
.queue__title span { background:var(--slate-200); color:var(--slate-700); border-radius:10px; padding:0 8px; }
.queue__empty { font-size:13px; color:var(--slate-400); padding:8px 0; }
.qrow { width:100%; display:flex; flex-direction:column; gap:2px; text-align:left; padding:12px 14px; background:#fff; border:1px solid var(--slate-200); border-radius:12px; margin-bottom:8px; font:inherit; cursor:pointer; }
.qrow b { font-size:15px; }
.qrow span { font-size:13px; color:var(--slate-500); }
.verdict { border-radius:16px; padding:18px 16px; margin-bottom:12px; text-align:center; color:#fff; }
.verdict--go { background:#047857; }
.verdict--stop { background:#dc2626; }
.verdict--info { background:#334155; }
.verdict__big { font-size:26px; font-weight:900; letter-spacing:.04em; }
.verdict__small { font-size:14px; opacity:.9; margin-top:4px; }
.kv { display:flex; justify-content:space-between; gap:12px; padding:7px 0; border-bottom:1px solid var(--slate-100); font-size:15px; }
.kv:last-child { border-bottom:none; }
.kv span { color:var(--slate-500); }
.kv b { text-align:right; }
.section-title { display:flex; justify-content:space-between; align-items:center; }
.section-title small { font-weight:500; color:var(--slate-400); font-size:12px; }
.tick-count { background:var(--slate-100); border-radius:10px; padding:1px 10px; font-size:13px; }
.chk { width:100%; display:flex; align-items:center; gap:12px; padding:12px 10px; margin-bottom:8px; border:2px solid var(--slate-200); border-radius:12px; background:#fff; font:inherit; text-align:left; cursor:pointer; }
.chk--on { border-color:#047857; background:#ecfdf5; }
.chk--static { cursor:default; }
.chk--static .chk__box { display:none; }
.chk__box { width:28px; height:28px; border-radius:8px; border:2px solid var(--slate-300, #cbd5e1); display:flex; align-items:center; justify-content:center; flex-shrink:0; color:#fff; }
.chk--on .chk__box { background:#047857; border-color:#047857; }
.chk__body { flex:1; display:flex; flex-direction:column; gap:2px; min-width:0; }
.chk__desc { font-weight:800; font-size:15px; color:var(--slate-900); }
.chk__sub { font-size:12px; color:var(--slate-500); }
.chk__qty { font-weight:900; font-size:17px; white-space:nowrap; }
.big-photo { width:100%; max-height:380px; object-fit:contain; border-radius:12px; background:var(--slate-100); }
.btn-xl { height:60px; font-size:18px; margin-top:12px; }
.help { font-size:12px; color:var(--slate-400); margin-top:8px; text-align:center; }
.done { text-align:center; padding:40px 16px; border-radius:20px; margin-top:12px; }
.done--exit { background:#ecfdf5; }
.done--return { background:#eff6ff; }
.done__icon { font-size:64px; }
.done__title { font-size:26px; font-weight:900; color:#065f46; margin:8px 0 4px; letter-spacing:.04em; }
.done--return .done__title { color:#1e40af; }
.done__sub { font-size:15px; color:var(--slate-500); margin-bottom:24px; }
</style>
