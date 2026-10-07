<template>
  <div class="page">
    <AppHeader title="My Gate Passes" active="my-passes" :show-back="true">
      <template #actions>
        <button v-if="auth.canRaise" class="icon-btn" @click="router.push('/sample-app/new')" aria-label="New gate pass"><i class="pi pi-plus"></i></button>
      </template>
    </AppHeader>
    <div class="page-content">
      <div class="chips">
        <button v-for="c in chips" :key="c.id" class="chip" :class="{ 'chip--on': status === c.id }" @click="setStatus(c.id)">{{ c.label }}</button>
      </div>
      <input v-model="txt" class="form-input search" type="search" placeholder="Search pass no, party…" @input="debouncedLoad" />

      <div v-if="loading" class="loading-center"><div class="spinner"></div></div>
      <div v-else-if="error" class="alert alert-error"><i class="pi pi-exclamation-triangle"></i> {{ error }}</div>
      <div v-else-if="!rows.length" class="empty-state">
        <div class="empty-state__icon">🧾</div>
        <div class="empty-state__title">No gate passes here</div>
        <button v-if="auth.canRaise && status === 'open'" class="btn btn-primary" @click="router.push('/sample-app/new')">New Gate Pass</button>
      </div>
      <div v-else class="list">
        <PassCard v-for="p in rows" :key="p.name" :p="p" :show-carrier="p.carried_by !== auth.employee?.name" @open="open" />
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { getPasses } from '@/api/frappe'
import AppHeader from '@/components/AppHeader.vue'
import PassCard from '@/components/PassCard.vue'

const auth = useAuthStore()
const route = useRoute()
const router = useRouter()
const chips = [
  { id: 'open', label: 'Open' }, { id: 'overdue', label: 'Overdue' },
  { id: 'closed', label: 'Closed' }, { id: '', label: 'All' },
]
const status = ref(typeof route.query.status === 'string' ? route.query.status : 'open')
const txt = ref('')
const rows = ref([])
const loading = ref(false)
const error = ref('')
let timer = null

async function load() {
  loading.value = true
  error.value = ''
  try { rows.value = await getPasses('mine', { status: status.value, txt: txt.value }) }
  catch (e) { error.value = e.message }
  finally { loading.value = false }
}
function setStatus(s) { status.value = s; router.replace({ query: s ? { status: s } : {} }); load() }
function debouncedLoad() { clearTimeout(timer); timer = setTimeout(load, 300) }
function open(p) { router.push(`/sample-app/pass/${encodeURIComponent(p.name)}`) }
onMounted(load)
</script>

<style scoped>
.chips { display:flex; gap:8px; margin-bottom:10px; overflow-x:auto; }
.chip { padding:8px 16px; border-radius:999px; border:1.5px solid var(--slate-200); background:#fff; font:inherit; font-size:13px; font-weight:700; color:var(--slate-700); cursor:pointer; white-space:nowrap; }
.chip--on { background:var(--app-primary); border-color:var(--app-primary); color:#fff; }
.search { margin-bottom:12px; }
.list { display:flex; flex-direction:column; gap:10px; }
</style>
