<template>
  <span class="sb" :class="'sb--' + tone">{{ status }}</span>
</template>

<script setup>
import { computed } from 'vue'
const props = defineProps({ status: { type: String, default: '' } })
const TONES = {
  Draft: 'grey', 'Pending Approval': 'amber', Approved: 'indigo', Out: 'blue',
  'Partially Returned': 'purple', Overdue: 'red', Escalated: 'red',
  Returned: 'green', 'Written Off': 'grey', Cancelled: 'red',
}
const tone = computed(() => TONES[props.status] || 'grey')
</script>

<style scoped>
.sb { display:inline-flex; align-items:center; padding:3px 10px; border-radius:999px; font-size:11px; font-weight:800; letter-spacing:.03em; text-transform:uppercase; white-space:nowrap; }
.sb--grey   { background:#f1f5f9; color:#475569; }
.sb--amber  { background:#fef3c7; color:#92400e; }
.sb--indigo { background:#e0e7ff; color:#3730a3; }
.sb--blue   { background:#dbeafe; color:#1e40af; }
.sb--purple { background:#f3e8ff; color:#6b21a8; }
.sb--red    { background:#fee2e2; color:#b91c1c; }
.sb--green  { background:#d1fae5; color:#047857; }
</style>
