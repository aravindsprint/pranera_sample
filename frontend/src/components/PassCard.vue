<template>
  <button class="pc" :class="{ 'pc--late': p.days_overdue > 0 }" @click="$emit('open', p)">
    <div class="pc__top">
      <span class="pc__name">{{ p.name }}</span>
      <StatusBadge :status="p.status" />
    </div>
    <div class="pc__party">
      <i class="pi pi-building"></i> {{ p.party || '—' }}
      <span class="pc__purpose">· {{ p.purpose }}</span>
    </div>
    <div v-if="showCarrier" class="pc__who"><i class="pi pi-user"></i> {{ p.carried_by_name }}<span v-if="p.department"> · {{ p.department }}</span></div>
    <div class="pc__meta">
      <span><i class="pi pi-arrow-up-right"></i> {{ fmtDate(p.date_out) }}</span>
      <span><i class="pi pi-arrow-down-left"></i> {{ fmtDate(p.expected_return_date) }}</span>
      <span v-if="p.days_overdue > 0" class="pc__late">{{ p.days_overdue }} day{{ p.days_overdue > 1 ? 's' : '' }} late</span>
    </div>
  </button>
</template>

<script setup>
import StatusBadge from './StatusBadge.vue'
import { fmtDate } from '@/utils/format'
defineProps({ p: { type: Object, required: true }, showCarrier: { type: Boolean, default: false } })
defineEmits(['open'])
</script>

<style scoped>
.pc { width:100%; background:#fff; border:1px solid #e2e8f0; border-radius:14px; padding:14px 16px; text-align:left; display:flex; flex-direction:column; gap:6px; font:inherit; cursor:pointer; box-shadow:0 1px 2px rgba(0,0,0,.04); }
.pc:active { background:#f8fafc; }
.pc--late { border-left:4px solid #dc2626; }
.pc__top { display:flex; justify-content:space-between; align-items:center; gap:8px; }
.pc__name { font-weight:800; color:#0f172a; font-size:15px; }
.pc__party { font-size:14px; color:#1e293b; font-weight:600; }
.pc__purpose { color:#64748b; font-weight:500; }
.pc__who { font-size:13px; color:#475569; }
.pc__meta { display:flex; flex-wrap:wrap; gap:14px; font-size:12px; color:#64748b; }
.pc__meta i, .pc__party i, .pc__who i { font-size:11px; margin-right:2px; }
.pc__late { color:#dc2626; font-weight:800; }
</style>
