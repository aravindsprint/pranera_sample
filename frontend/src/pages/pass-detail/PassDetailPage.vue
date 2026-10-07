<template>
  <div class="page">
    <AppHeader :title="name" :subtitle="d ? d.status : ''" :show-back="true">
      <template #actions>
        <button class="icon-btn" @click="load" aria-label="Refresh"><i class="pi pi-refresh" :class="{ 'pi-spin': loading }"></i></button>
      </template>
    </AppHeader>
    <div class="page-content">
      <div v-if="loading && !d" class="loading-center"><div class="spinner"></div></div>
      <div v-else-if="error && !d" class="alert alert-error"><i class="pi pi-exclamation-triangle"></i> {{ error }}</div>

      <template v-else-if="d">
        <!-- Status banner -->
        <div class="banner" :class="'banner--' + banner.tone">
          <StatusBadge :status="d.status" />
          <div class="banner__text">{{ banner.text }}</div>
        </div>

        <!-- QR for the gate -->
        <div v-if="d.status === 'Approved' && (d.is_carrier || d.is_approver)" class="card qr-card">
          <PassQr :value="d.gate_pass_no || d.name" />
        </div>

        <!-- Summary -->
        <div class="card">
          <div class="kv"><span>Carried by</span><b>{{ d.carried_by_name }}</b></div>
          <div class="kv"><span>Department</span><b>{{ d.department || '—' }}</b></div>
          <div class="kv"><span>{{ d.party_type }}</span><b>{{ d.party || '—' }}</b></div>
          <div class="kv"><span>Purpose</span><b>{{ d.purpose }}</b></div>
          <div class="kv"><span>Date out</span><b>{{ fmtDate(d.date_out) }}</b></div>
          <div class="kv"><span>Return by</span><b :class="{ late: d.days_overdue > 0 }">{{ fmtDate(d.expected_return_date) }}<template v-if="d.days_overdue > 0"> · {{ d.days_overdue }}d late</template></b></div>
          <div v-if="d.actual_return_date" class="kv"><span>Returned on</span><b>{{ fmtDate(d.actual_return_date) }}</b></div>
          <div class="kv"><span>Approver</span><b>{{ d.approved_by_name || 'Merchandising Manager' }}</b></div>
          <div v-if="d.exited_on" class="kv"><span>Left gate</span><b>{{ fmtDateTime(d.exited_on) }}</b></div>
          <div v-if="d.remarks" class="remarks">{{ d.remarks }}</div>
        </div>

        <!-- Photos -->
        <div v-if="d.gate_photo || d.return_photo" class="card">
          <div class="section-title">Gate photos</div>
          <div class="photos">
            <a v-if="d.gate_photo" :href="fileUrl(d.gate_photo)" target="_blank"><img :src="fileUrl(d.gate_photo)" alt="Outgoing" /><span>Outgoing</span></a>
            <a v-if="d.return_photo" :href="fileUrl(d.return_photo)" target="_blank"><img :src="fileUrl(d.return_photo)" alt="Return" /><span>Return</span></a>
          </div>
        </div>

        <!-- Items: read-only or return entry -->
        <div class="card">
          <div class="section-title">
            Samples ({{ d.items.length }})
            <button v-if="d.can_record_return && !returning" class="btn btn-outline btn-sm" @click="startReturn">Record return</button>
          </div>

          <template v-if="!returning">
            <div v-for="it in d.items" :key="it.name" class="it">
              <div class="it__main">
                <div class="it__desc">{{ it.item_description }}</div>
                <div class="it__sub">{{ [it.item_code, it.fabric_type, it.color, it.condition_out].filter(Boolean).join(' · ') }}</div>
              </div>
              <div class="it__qty">
                <div>{{ fmtQty(it.quantity, it.unit) }}</div>
                <div v-if="d.docstatus === 1 && (it.returned_qty || it.written_off)" class="it__ret" :class="{ 'it__ret--wo': it.written_off }">
                  {{ it.written_off ? 'written off' : '' }} {{ it.returned_qty ? `${fmtQty(it.returned_qty, it.unit)} back` : '' }}
                </div>
              </div>
            </div>
          </template>

          <!-- Return entry -->
          <template v-else>
            <p class="help">Enter what came back. Tick <b>Leave with party</b> for anything that will not return.</p>
            <div v-for="r in ret" :key="r.name" class="rt">
              <div class="it__desc">{{ r.item_description }}</div>
              <div class="it__sub">Sent: {{ fmtQty(r.quantity, r.unit) }}</div>
              <div class="rt__row">
                <div class="stepper">
                  <button type="button" @click="bump(r, -1)">−</button>
                  <input v-model.number="r.returned_qty" type="number" inputmode="decimal" min="0" :max="r.quantity" />
                  <button type="button" @click="bump(r, 1)">+</button>
                </div>
                <button type="button" class="btn btn-ghost btn-sm" @click="r.returned_qty = r.quantity; r.written_off = 0">All back</button>
              </div>
              <div class="rt__row">
                <select v-model="r.condition_in" class="form-input">
                  <option value="">Condition…</option>
                  <option v-for="c in ['Good', 'Used', 'Damaged', 'Not Returned']" :key="c">{{ c }}</option>
                </select>
              </div>
              <label class="rt__wo"><input type="checkbox" v-model="r.written_off" :true-value="1" :false-value="0" /> Leave with party (write off the rest)</label>
              <input v-if="r.written_off" v-model="r.return_remarks" class="form-input" placeholder="Why is it staying? (required)" />
            </div>

            <div class="progress" :class="'progress--' + progressTone">{{ progressText }}</div>
            <div v-if="error" class="alert alert-error"><i class="pi pi-exclamation-triangle"></i> {{ error }}</div>
            <div class="grid-2">
              <button class="btn btn-ghost btn-lg" :disabled="busy" @click="returning = false">Cancel</button>
              <button class="btn btn-primary btn-lg" :disabled="busy" @click="saveReturn">{{ busy ? 'Saving…' : 'Save return' }}</button>
            </div>
          </template>
        </div>

        <!-- Workflow actions -->
        <div v-if="!returning && (d.can_edit || d.actions.length)" class="actions">
          <button v-if="d.can_edit" class="btn btn-ghost btn-lg" @click="router.push(`/sample-app/edit/${encodeURIComponent(d.name)}`)"><i class="pi pi-pencil"></i> Edit</button>
          <button v-if="d.can_edit" class="btn btn-ghost btn-lg danger" :disabled="busy" @click="remove"><i class="pi pi-trash"></i></button>
          <button v-for="a in d.actions" :key="a.action" class="btn btn-lg" :class="actionClass(a.action)" :disabled="busy" @click="act(a.action)">
            {{ a.action }}
          </button>
        </div>

        <button v-if="d.is_gate && ['Approved', 'Out', 'Partially Returned', 'Overdue', 'Escalated'].includes(d.status)"
          class="btn btn-outline btn-full btn-lg" style="margin-top:12px"
          @click="router.push(`/sample-app/gate/${encodeURIComponent(d.gate_pass_no || d.name)}`)">
          <i class="pi pi-camera"></i> Open in Gate Check
        </button>
      </template>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { getPass, applyAction, recordReturn, deleteDraft } from '@/api/frappe'
import { showToast } from '@/composables/useToast'
import { fmtDate, fmtDateTime, fmtQty, fileUrl, todayISO } from '@/utils/format'
import AppHeader from '@/components/AppHeader.vue'
import StatusBadge from '@/components/StatusBadge.vue'
import PassQr from '@/components/PassQr.vue'

const props = defineProps({ name: { type: String, required: true } })
const router = useRouter()
const auth = useAuthStore()
const d = ref(null)
const loading = ref(false)
const busy = ref(false)
const error = ref('')
const returning = ref(false)
const ret = ref([])

async function load() {
  loading.value = true
  error.value = ''
  try { d.value = await getPass(props.name) } catch (e) { error.value = e.message } finally { loading.value = false }
}
onMounted(load)

const banner = computed(() => {
  const s = d.value?.status
  const who = d.value?.approved_by_name || 'the Merchandising Manager'
  return {
    Draft: { tone: 'grey', text: 'Not sent yet. Send it for approval when ready.' },
    'Pending Approval': { tone: 'amber', text: `Waiting for ${who} to approve.` },
    Approved: { tone: 'indigo', text: 'Approved. Show the QR below at the gate — security will photograph the samples.' },
    Out: { tone: 'blue', text: `Samples are out. Bring them back by ${fmtDate(d.value?.expected_return_date)}.` },
    'Partially Returned': { tone: 'purple', text: 'Some samples are back. Record the rest when they return.' },
    Overdue: { tone: 'red', text: `Overdue by ${d.value?.days_overdue} day(s). Return the samples or ask your manager to write them off.` },
    Escalated: { tone: 'red', text: `Escalated to management — ${d.value?.days_overdue} day(s) overdue.` },
    Returned: { tone: 'green', text: 'All samples returned. Closed.' },
    'Written Off': { tone: 'grey', text: 'Closed with write-off.' },
    Cancelled: { tone: 'red', text: 'Cancelled.' },
  }[s] || { tone: 'grey', text: '' }
})

function actionClass(a) {
  if (/Reject|Cancel/.test(a)) return 'btn-ghost danger'
  if (/Write Off/.test(a)) return 'btn-warning'
  return 'btn-primary'
}

async function act(action) {
  const confirmText = {
    Reject: 'Send this pass back to the employee?', Cancel: 'Cancel this gate pass?',
    'Write Off': 'Close this pass with the unreturned samples written off?',
  }[action]
  if (confirmText && !confirm(confirmText)) return
  busy.value = true
  try {
    d.value = await applyAction(d.value.name, action)
    showToast(`${action} — done`, 'success')
    auth.load(true)
  } catch (e) { showToast(e.message, 'error', 6000) } finally { busy.value = false }
}

async function remove() {
  if (!confirm('Delete this draft?')) return
  busy.value = true
  try { await deleteDraft(d.value.name); showToast('Draft deleted', 'success'); router.replace('/sample-app/my-passes') }
  catch (e) { showToast(e.message, 'error', 6000) } finally { busy.value = false }
}

// ── Return entry ──
function startReturn() {
  ret.value = d.value.items.map(r => ({ ...r, returned_qty: r.returned_qty || 0, condition_in: r.condition_in || '', written_off: r.written_off || 0, return_remarks: r.return_remarks || '' }))
  returning.value = true
  error.value = ''
}
function bump(r, step) {
  const whole = r.unit === 'Pcs' || r.unit === 'Nos'
  const next = (Number(r.returned_qty) || 0) + (whole ? step : step * 0.5)
  r.returned_qty = Math.max(0, Math.min(r.quantity, Number(next.toFixed(2))))
}
const progress = computed(() => {
  let resolved = 0, touched = 0, wo = false
  for (const r of ret.value) {
    const back = Number(r.returned_qty) >= Number(r.quantity)
    if (back || r.written_off) resolved++
    if (Number(r.returned_qty) > 0 || r.written_off) touched++
    if (r.written_off && !back) wo = true
  }
  if (ret.value.length && resolved === ret.value.length) return wo ? 'Resolved with Write-off' : 'Fully Returned'
  return touched ? 'Partially Returned' : 'Not Returned'
})
const progressText = computed(() => ({
  'Fully Returned': 'Everything is back → pass will close as Returned.',
  'Partially Returned': 'Some samples still out → pass stays open as Partially Returned.',
  'Resolved with Write-off': 'Rest stays with the party → needs your manager to approve the write-off.',
  'Not Returned': 'Nothing entered yet.',
}[progress.value]))
const progressTone = computed(() => ({ 'Fully Returned': 'green', 'Partially Returned': 'purple', 'Resolved with Write-off': 'amber' }[progress.value] || 'grey'))

async function saveReturn() {
  error.value = ''
  for (const r of ret.value) {
    if (Number(r.returned_qty) > Number(r.quantity)) { error.value = `${r.item_description}: more than was sent.`; return }
    if ((r.unit === 'Pcs' || r.unit === 'Nos') && Number(r.returned_qty) % 1) { error.value = `${r.item_description}: ${r.unit} must be whole.`; return }
    if (r.written_off && !r.return_remarks?.trim()) { error.value = `${r.item_description}: say why it is staying with the party.`; return }
  }
  if (progress.value === 'Not Returned') { error.value = 'Enter the returned quantity first.'; return }
  busy.value = true
  try {
    const items = ret.value.map(r => ({ name: r.name, returned_qty: r.returned_qty || 0, condition_in: r.condition_in, written_off: r.written_off, return_remarks: r.return_remarks }))
    const res = await recordReturn(d.value.name, items, { actualReturnDate: todayISO() })
    d.value = res
    returning.value = false
    showToast(res.message || `Return saved — ${res.status}`, res.message ? 'info' : 'success', res.message ? 7000 : 3500)
    auth.load(true)
  } catch (e) { error.value = e.message } finally { busy.value = false }
}
</script>

<style scoped>
.banner { display:flex; align-items:center; gap:10px; padding:12px 14px; border-radius:14px; margin-bottom:12px; font-size:14px; font-weight:600; }
.banner__text { flex:1; }
.banner--grey { background:#f1f5f9; color:#334155; }
.banner--amber { background:#fef3c7; color:#92400e; }
.banner--indigo { background:#e0e7ff; color:#3730a3; }
.banner--blue { background:#dbeafe; color:#1e40af; }
.banner--purple { background:#f3e8ff; color:#6b21a8; }
.banner--red { background:#fee2e2; color:#991b1b; }
.banner--green { background:#d1fae5; color:#065f46; }
.qr-card { display:flex; justify-content:center; }
.kv { display:flex; justify-content:space-between; gap:12px; padding:7px 0; border-bottom:1px solid var(--slate-100); font-size:14px; }
.kv:last-of-type { border-bottom:none; }
.kv span { color:var(--slate-500); }
.kv b { text-align:right; color:var(--slate-900); }
.kv b.late { color:#dc2626; }
.remarks { margin-top:10px; padding:10px; background:var(--slate-50); border-radius:10px; font-size:13px; color:var(--slate-700); white-space:pre-wrap; }
.photos { display:grid; grid-template-columns:1fr 1fr; gap:10px; }
.photos a { display:flex; flex-direction:column; gap:4px; text-decoration:none; color:var(--slate-500); font-size:12px; font-weight:700; }
.photos img { width:100%; aspect-ratio:4/3; object-fit:cover; border-radius:10px; background:var(--slate-100); }
.section-title { display:flex; align-items:center; justify-content:space-between; gap:8px; }
.btn-sm { padding:6px 12px; font-size:12px; }
.it { display:flex; justify-content:space-between; gap:12px; padding:10px 0; border-bottom:1px solid var(--slate-100); }
.it:last-child { border-bottom:none; }
.it__desc { font-weight:700; font-size:14px; color:var(--slate-900); }
.it__sub { font-size:12px; color:var(--slate-500); margin-top:2px; }
.it__qty { text-align:right; font-weight:800; font-size:14px; white-space:nowrap; }
.it__ret { font-size:12px; font-weight:700; color:#047857; }
.it__ret--wo { color:var(--amber-600); }
.help { font-size:13px; color:var(--slate-500); margin-bottom:12px; }
.rt { border:1px solid var(--slate-200); border-radius:12px; padding:12px; margin-bottom:10px; display:flex; flex-direction:column; gap:8px; }
.rt__row { display:flex; gap:10px; align-items:center; }
.stepper { display:flex; align-items:center; border:1.5px solid var(--slate-200); border-radius:10px; overflow:hidden; }
.stepper button { width:44px; height:44px; border:none; background:var(--slate-100); font-size:20px; font-weight:800; }
.stepper input { width:72px; height:44px; border:none; text-align:center; font-size:16px; font-weight:800; }
.rt__wo { display:flex; gap:8px; align-items:center; font-size:13px; color:var(--slate-700); }
.progress { padding:10px 12px; border-radius:10px; font-size:13px; font-weight:700; margin:6px 0 12px; }
.progress--green { background:#d1fae5; color:#065f46; }
.progress--purple { background:#f3e8ff; color:#6b21a8; }
.progress--amber { background:#fef3c7; color:#92400e; }
.progress--grey { background:#f1f5f9; color:#475569; }
.actions { display:flex; flex-wrap:wrap; gap:10px; }
.actions .btn { flex:1 1 140px; }
.actions .btn.danger { flex:0 0 auto; }
.danger { color:var(--red-600) !important; }
</style>
