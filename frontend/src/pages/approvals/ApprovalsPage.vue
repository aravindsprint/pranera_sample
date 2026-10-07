<template>
  <div class="page">
    <AppHeader title="Approvals" :subtitle="rows.length ? `${rows.length} waiting` : ''" active="approvals" :show-back="true" />
    <div class="page-content">
      <div v-if="loading" class="loading-center"><div class="spinner"></div></div>
      <div v-else-if="error" class="alert alert-error"><i class="pi pi-exclamation-triangle"></i> {{ error }}</div>
      <div v-else-if="!rows.length" class="empty-state">
        <div class="empty-state__icon">✅</div>
        <div class="empty-state__title">Nothing to approve</div>
        <div class="empty-state__sub">Passes raised by your team will appear here.</div>
      </div>

      <div v-else class="list">
        <div v-for="p in rows" :key="p.name" class="ap card">
          <PassCard :p="p" :show-carrier="true" @open="open" />
          <template v-if="p.request === 'write_off'">
            <div class="ap__wo"><i class="pi pi-exclamation-circle"></i> Returned what came back — asks to <b>write off</b> the rest left with the party.</div>
            <div class="ap__actions ap__actions--one">
              <button class="btn btn-ghost" :disabled="busy === p.name" @click="open(p)">Review</button>
              <button class="btn btn-warning" :disabled="busy === p.name" @click="act(p, 'Write Off')"><i class="pi pi-check"></i> Approve write-off</button>
            </div>
          </template>
          <template v-else>
            <div class="ap__actions">
              <button class="btn btn-ghost" :disabled="busy === p.name" @click="act(p, 'Reject')"><i class="pi pi-times"></i> Reject</button>
              <button class="btn btn-primary" :disabled="busy === p.name" @click="act(p, 'Approve')"><i class="pi pi-check"></i> Approve</button>
            </div>
            <div v-if="!p.approver_user" class="ap__note">No reporting manager on file — routed to you as Merchandising Manager.</div>
          </template>
        </div>
      </div>

      <p class="hint">Open a pass to see the full sample list before approving.</p>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { getPasses, applyAction } from '@/api/frappe'
import { showToast } from '@/composables/useToast'
import AppHeader from '@/components/AppHeader.vue'
import PassCard from '@/components/PassCard.vue'

const router = useRouter()
const auth = useAuthStore()
const rows = ref([])
const loading = ref(false)
const error = ref('')
const busy = ref('')

async function load() {
  loading.value = true
  error.value = ''
  try { rows.value = await getPasses('approvals') } catch (e) { error.value = e.message } finally { loading.value = false }
}
async function act(p, action) {
  if (action === 'Reject' && !confirm(`Send ${p.name} back to ${p.carried_by_name}?`)) return
  if (action === 'Write Off' && !confirm(`Close ${p.name} and write off what stayed with ${p.party}?`)) return
  busy.value = p.name
  try {
    await applyAction(p.name, action)
    showToast({ Approve: `${p.name} approved — gate pass issued`, Reject: `${p.name} sent back`, 'Write Off': `${p.name} closed with write-off` }[action], 'success')
    rows.value = rows.value.filter(r => r.name !== p.name)
    auth.load(true)
  } catch (e) {
    showToast(e.message, 'error', 6000)
  } finally { busy.value = '' }
}
function open(p) { router.push(`/sample-app/pass/${encodeURIComponent(p.name)}`) }
onMounted(load)
</script>

<style scoped>
.list { display:flex; flex-direction:column; gap:12px; }
.ap { padding:10px; }
.ap :deep(.pc) { border:none; box-shadow:none; padding:6px; }
.ap__actions { display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-top:6px; }
.ap__wo { font-size:13px; color:#92400e; background:#fef3c7; border-radius:10px; padding:8px 10px; margin:4px 0 6px; }
.ap__note { font-size:12px; color:var(--amber-600); margin-top:8px; }
.hint { font-size:12px; color:var(--slate-400); text-align:center; margin-top:16px; }
</style>
