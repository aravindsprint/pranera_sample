<template>
  <transition name="fade">
    <div v-if="open" class="qs-overlay" @click.self="close">
      <div class="qs-box">
        <h3 class="qs-title">{{ title }}</h3>
        <div id="qs-camera-region" class="qs-camera"></div>
        <div v-if="error" class="alert alert-error" style="margin-top:12px">
          <i class="pi pi-exclamation-triangle"></i> {{ error }}
        </div>
        <button class="btn btn-ghost btn-full" style="margin-top:14px" @click="close">Cancel</button>
      </div>
    </div>
  </transition>
</template>

<script setup>
// Camera QR scanner (html5-qrcode), same pattern as pranera_roll's Verify Rolls.
import { ref, watch, nextTick, onBeforeUnmount } from 'vue'
import { Html5Qrcode } from 'html5-qrcode'

const props = defineProps({ open: Boolean, title: { type: String, default: 'Scan Gate Pass QR' } })
const emit = defineEmits(['update:open', 'scan'])
const error = ref('')
let scanner = null

watch(() => props.open, async (v) => {
  if (v) {
    error.value = ''
    await nextTick()
    try {
      scanner = new Html5Qrcode('qs-camera-region')
      await scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 240, height: 240 }, aspectRatio: 1.0 },
        async (text) => { await stop(); emit('scan', text); emit('update:open', false) },
        () => {}
      )
    } catch (e) {
      error.value = 'Could not open the camera: ' + (e?.message || e) + '. Type the pass number instead.'
    }
  } else {
    await stop()
  }
})

async function stop() {
  if (!scanner) return
  try {
    if (scanner.isScanning) await scanner.stop()
    scanner.clear()
  } catch { /* already stopped */ }
  scanner = null
}
async function close() { await stop(); emit('update:open', false) }
onBeforeUnmount(stop)
</script>

<style scoped>
.qs-overlay { position:fixed; inset:0; background:rgba(15,23,42,.7); z-index:500; display:flex; align-items:center; justify-content:center; padding:16px; }
.qs-box { background:#fff; border-radius:18px; padding:18px; width:100%; max-width:420px; }
.qs-title { font-size:16px; font-weight:800; margin-bottom:12px; text-align:center; }
.qs-camera { width:100%; min-height:260px; border-radius:12px; overflow:hidden; background:#0f172a; }
.fade-enter-active, .fade-leave-active { transition: opacity .2s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>
