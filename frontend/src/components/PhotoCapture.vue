<template>
  <div class="ph">
    <input ref="fileEl" type="file" accept="image/*" capture="environment" hidden @change="onFile" />
    <button v-if="!modelValue" type="button" class="btn btn-outline btn-full btn-lg ph__btn" :disabled="busy" @click="fileEl.click()">
      <i class="pi pi-camera"></i> {{ busy ? 'Processing…' : label }}
    </button>
    <div v-else class="ph__preview">
      <img :src="modelValue" alt="Captured photo" />
      <button type="button" class="btn btn-ghost btn-full" @click="retake"><i class="pi pi-refresh"></i> Retake</button>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { compressImage } from '@/utils/image'

defineProps({ modelValue: { type: String, default: '' }, label: { type: String, default: 'Take Photo' } })
const emit = defineEmits(['update:modelValue'])
const fileEl = ref(null)
const busy = ref(false)

async function onFile(e) {
  const f = e.target.files?.[0]
  if (!f) return
  busy.value = true
  try { emit('update:modelValue', await compressImage(f)) } finally { busy.value = false; e.target.value = '' }
}
function retake() { emit('update:modelValue', ''); fileEl.value.click() }
</script>

<style scoped>
.ph__btn { height:64px; font-size:16px; border-style:dashed; }
.ph__preview { display:flex; flex-direction:column; gap:8px; }
.ph__preview img { width:100%; max-height:420px; object-fit:contain; border-radius:12px; background:#f1f5f9; }
</style>
