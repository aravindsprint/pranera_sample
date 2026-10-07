<template>
  <div class="page">
    <AppHeader :title="name ? `Edit ${name}` : 'New Gate Pass'" active="new" :show-back="true" />
    <div class="page-content">
      <div v-if="loading" class="loading-center"><div class="spinner"></div></div>
      <form v-else @submit.prevent>
        <!-- Who -->
        <div class="card">
          <div class="section-title">Who is carrying</div>
          <div v-if="!onBehalf" class="who">
            <div>
              <div class="who__name">{{ auth.employee?.employee_name }}</div>
              <div class="who__sub">{{ auth.employee?.department }}</div>
            </div>
            <button type="button" class="btn btn-ghost" @click="onBehalf = true">Someone else</button>
          </div>
          <div v-else class="form-group">
            <label class="form-label">Carried by</label>
            <RemoteSelect v-model="form.carried_by" :fetcher="fetchEmployees" placeholder="Search employee…" @change="o => carrierLabel = o?.label || ''" />
            <div v-if="carrierLabel" class="who__sub" style="margin-top:6px">{{ carrierLabel }}</div>
            <button type="button" class="link" @click="onBehalf = false; form.carried_by = auth.employee?.name">Use me instead</button>
          </div>
        </div>

        <!-- Where -->
        <div class="card">
          <div class="section-title">Where are the samples going</div>
          <div class="form-group">
            <label class="form-label">Purpose</label>
            <select v-model="form.purpose" class="form-input">
              <option v-for="p in PURPOSES" :key="p">{{ p }}</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Party type</label>
            <div class="seg">
              <button v-for="t in ['Customer', 'Supplier', 'Other']" :key="t" type="button" class="seg__btn" :class="{ 'seg__btn--on': form.party_type === t }" @click="setPartyType(t)">{{ t }}</button>
            </div>
          </div>
          <div class="form-group" v-if="form.party_type !== 'Other'">
            <label class="form-label">{{ form.party_type }}</label>
            <RemoteSelect :key="form.party_type" v-model="form.party_name" :fetcher="fetchParties" :placeholder="`Search ${form.party_type.toLowerCase()}…`" />
          </div>
          <div class="form-group" v-else>
            <label class="form-label">Party name</label>
            <input v-model="form.other_party_name" class="form-input" placeholder="e.g. Trade fair stall, agent name" />
          </div>
          <div class="grid-2">
            <div class="form-group">
              <label class="form-label">Date out</label>
              <input v-model="form.date_out" type="date" class="form-input" :min="todayISO(-7)" />
            </div>
            <div class="form-group">
              <label class="form-label">Return by</label>
              <input v-model="form.expected_return_date" type="date" class="form-input" :min="form.date_out" />
            </div>
          </div>
          <div class="quick">
            <span>Return in</span>
            <button v-for="d in [1, 3, 7, 14]" :key="d" type="button" class="quick__btn" @click="returnIn(d)">{{ d }}d</button>
          </div>
        </div>

        <!-- What -->
        <div class="card">
          <div class="section-title">Samples ({{ form.items.length }})</div>
          <div v-for="(it, i) in form.items" :key="i" class="item">
            <div class="item__head">
              <span class="item__no">#{{ i + 1 }}</span>
              <button v-if="form.items.length > 1" type="button" class="item__del" @click="form.items.splice(i, 1)" aria-label="Remove"><i class="pi pi-trash"></i></button>
            </div>
            <div class="form-group">
              <label class="form-label">Description *</label>
              <input v-model="it.item_description" class="form-input" placeholder="e.g. Poly-spandex twill, navy, swatch" />
            </div>
            <div class="grid-2">
              <div class="form-group">
                <label class="form-label">Fabric</label>
                <input v-model="it.fabric_type" class="form-input" placeholder="Polyester" />
              </div>
              <div class="form-group">
                <label class="form-label">Colour</label>
                <input v-model="it.color" class="form-input" placeholder="Navy" />
              </div>
            </div>
            <div class="grid-3">
              <div class="form-group">
                <label class="form-label">Qty *</label>
                <input v-model.number="it.quantity" type="number" inputmode="decimal" min="0" :step="it.unit === 'Pcs' || it.unit === 'Nos' ? 1 : 0.01" class="form-input" />
              </div>
              <div class="form-group">
                <label class="form-label">Unit</label>
                <select v-model="it.unit" class="form-input"><option v-for="u in UNITS" :key="u">{{ u }}</option></select>
              </div>
              <div class="form-group">
                <label class="form-label">Condition</label>
                <select v-model="it.condition_out" class="form-input"><option v-for="c in ['Good', 'Used', 'Damaged']" :key="c">{{ c }}</option></select>
              </div>
            </div>
            <details class="more">
              <summary>Item code / value (optional)</summary>
              <div class="form-group" style="margin-top:10px">
                <label class="form-label">Item code</label>
                <RemoteSelect v-model="it.item_code" :fetcher="fetchItems" placeholder="Leave blank if none" />
              </div>
              <div class="form-group">
                <label class="form-label">Estimated value (₹)</label>
                <input v-model.number="it.estimated_value" type="number" inputmode="decimal" min="0" class="form-input" />
              </div>
            </details>
          </div>
          <button type="button" class="btn btn-outline btn-full" @click="addItem"><i class="pi pi-plus"></i> Add another sample</button>
        </div>

        <div class="card">
          <div class="form-group" style="margin:0">
            <label class="form-label">Remarks</label>
            <textarea v-model="form.remarks" class="form-input" rows="2" placeholder="Anything security or your manager should know"></textarea>
          </div>
        </div>

        <div v-if="error" class="alert alert-error"><i class="pi pi-exclamation-triangle"></i> {{ error }}</div>

        <div class="actions">
          <button type="button" class="btn btn-ghost btn-lg" :disabled="saving" @click="submit(false)">Save draft</button>
          <button type="button" class="btn btn-primary btn-lg" :disabled="saving" @click="submit(true)">
            <i class="pi pi-send"></i> {{ saving ? 'Sending…' : 'Send for approval' }}
          </button>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { getPass, savePass, searchParties, searchItems, searchEmployees } from '@/api/frappe'
import { showToast } from '@/composables/useToast'
import { todayISO } from '@/utils/format'
import AppHeader from '@/components/AppHeader.vue'
import RemoteSelect from '@/components/RemoteSelect.vue'

const props = defineProps({ name: { type: String, default: '' } })
const auth = useAuthStore()
const router = useRouter()

const PURPOSES = ['Customer Presentation', 'Supplier Reference', 'Trade Show', 'Internal Approval', 'Other']
const UNITS = ['Pcs', 'Mtrs', 'Kgs', 'Nos']
const blankItem = () => ({ item_description: '', fabric_type: '', color: '', quantity: 1, unit: 'Pcs', condition_out: 'Good', item_code: '', estimated_value: null })

const form = reactive({
  carried_by: '', purpose: 'Customer Presentation', party_type: 'Customer', party_name: '', other_party_name: '',
  date_out: todayISO(), expected_return_date: todayISO(3), remarks: '', items: [blankItem()],
})
const onBehalf = ref(false)
const carrierLabel = ref('')
const loading = ref(false)
const saving = ref(false)
const error = ref('')

const toOpts = (rows) => (rows || []).map(r => ({ value: r.value, label: r.label && r.label !== r.value ? `${r.label}` : r.value, sub: r.label !== r.value ? [r.value, r.sub].filter(Boolean).join(' · ') : r.sub }))
const fetchParties = async (txt) => toOpts(await searchParties(form.party_type, txt))
const fetchItems = async (txt) => toOpts(await searchItems(txt))
const fetchEmployees = async (txt) => toOpts(await searchEmployees(txt))

function setPartyType(t) { form.party_type = t; form.party_name = ''; form.other_party_name = '' }
function addItem() { form.items.push(blankItem()) }
function returnIn(d) {
  const base = new Date(form.date_out || todayISO())
  base.setDate(base.getDate() + d)
  form.expected_return_date = base.toISOString().slice(0, 10)
}

function validate() {
  if (!form.carried_by) return 'Choose who is carrying the samples.'
  if (form.party_type !== 'Other' && !form.party_name) return `Choose the ${form.party_type.toLowerCase()}.`
  if (form.party_type === 'Other' && !form.other_party_name?.trim()) return 'Enter where the samples are going.'
  if (!form.expected_return_date) return 'Set the expected return date.'
  if (form.expected_return_date < form.date_out) return 'Return date cannot be before date out.'
  for (const [i, it] of form.items.entries()) {
    if (!it.item_description?.trim()) return `Sample #${i + 1}: add a description.`
    if (!(Number(it.quantity) > 0)) return `Sample #${i + 1}: quantity must be more than zero.`
    if ((it.unit === 'Pcs' || it.unit === 'Nos') && Number(it.quantity) % 1) return `Sample #${i + 1}: ${it.unit} must be a whole number.`
  }
  return ''
}

async function submit(send) {
  error.value = validate()
  if (error.value) return
  saving.value = true
  try {
    const doc = await savePass({ ...form, name: props.name || undefined }, send)
    showToast(send ? `${doc.name} sent to ${doc.approved_by_name || 'your manager'} for approval` : `${doc.name} saved as draft`, 'success')
    auth.load(true)
    router.replace(`/sample-app/pass/${encodeURIComponent(doc.name)}`)
  } catch (e) {
    error.value = e.message
  } finally { saving.value = false }
}

onMounted(async () => {
  await auth.load()
  form.carried_by = auth.employee?.name || ''
  if (!props.name) return
  loading.value = true
  try {
    const d = await getPass(props.name)
    if (!d.can_edit) { router.replace(`/sample-app/pass/${encodeURIComponent(props.name)}`); return }
    Object.assign(form, {
      carried_by: d.carried_by, purpose: d.purpose, party_type: d.party_type, party_name: d.party_name || '',
      other_party_name: d.other_party_name || '', date_out: d.date_out, expected_return_date: d.expected_return_date,
      remarks: d.remarks || '',
      items: d.items.map(r => ({ item_description: r.item_description, fabric_type: r.fabric_type || '', color: r.color || '', quantity: r.quantity, unit: r.unit || 'Pcs', condition_out: r.condition_out || 'Good', item_code: r.item_code || '', estimated_value: r.estimated_value })),
    })
    onBehalf.value = d.carried_by !== auth.employee?.name
  } catch (e) { error.value = e.message } finally { loading.value = false }
})
</script>

<style scoped>
.who { display:flex; align-items:center; justify-content:space-between; gap:12px; }
.who__name { font-weight:800; font-size:16px; }
.who__sub { font-size:13px; color:var(--slate-500); }
.link { background:none; border:none; color:var(--app-primary); font:inherit; font-size:13px; font-weight:700; margin-top:8px; cursor:pointer; padding:0; }
.seg { display:grid; grid-template-columns:repeat(3,1fr); border:1.5px solid var(--slate-200); border-radius:10px; overflow:hidden; }
.seg__btn { padding:11px 6px; border:none; background:#fff; font:inherit; font-size:14px; font-weight:700; color:var(--slate-700); }
.seg__btn + .seg__btn { border-left:1.5px solid var(--slate-200); }
.seg__btn--on { background:var(--app-primary); color:#fff; }
.quick { display:flex; align-items:center; gap:8px; font-size:12px; color:var(--slate-500); margin-top:-6px; }
.quick__btn { padding:5px 12px; border-radius:999px; border:1px solid var(--slate-200); background:#fff; font:inherit; font-size:12px; font-weight:700; color:var(--slate-700); }
.item { border:1px solid var(--slate-200); border-radius:12px; padding:12px; margin-bottom:12px; background:var(--slate-50); }
.item__head { display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; }
.item__no { font-weight:800; color:var(--slate-500); font-size:13px; }
.item__del { background:none; border:none; color:var(--red-600); font-size:16px; padding:4px; }
.item .form-group { margin-bottom:10px; }
.more summary { font-size:13px; color:var(--slate-500); font-weight:600; cursor:pointer; }
.actions { display:grid; grid-template-columns:1fr 2fr; gap:10px; position:sticky; bottom:0; padding:12px 0 16px; background:linear-gradient(transparent, var(--slate-50) 30%); }
</style>
