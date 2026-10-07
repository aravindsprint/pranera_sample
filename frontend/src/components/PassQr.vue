<template>
  <div class="pq">
    <img v-if="src" :src="src" :alt="value" class="pq__img" />
    <div class="pq__no">{{ value }}</div>
    <div class="pq__hint">Show this at the gate</div>
  </div>
</template>

<script setup>
// QR the gate scans. Encodes the bare gate pass number — the same value the
// printed Gate Pass print format encodes — so either can be scanned.
import { ref, watch } from 'vue'
import QRCode from 'qrcode'

const props = defineProps({ value: { type: String, required: true } })
const src = ref('')
watch(() => props.value, async (v) => {
  src.value = v ? await QRCode.toDataURL(v, { margin: 1, width: 360, errorCorrectionLevel: 'M' }) : ''
}, { immediate: true })
</script>

<style scoped>
.pq { display:flex; flex-direction:column; align-items:center; gap:6px; padding:8px 0; }
.pq__img { width:220px; height:220px; image-rendering:pixelated; }
.pq__no { font-size:22px; font-weight:900; letter-spacing:.02em; color:#0f172a; }
.pq__hint { font-size:12px; color:#64748b; }
</style>
