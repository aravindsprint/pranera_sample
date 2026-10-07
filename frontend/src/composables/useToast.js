import { reactive } from 'vue'

export const toast = reactive({ text: '', kind: 'info' })
let timer = null

export function showToast(text, kind = 'info', ms = 3500) {
  toast.text = text
  toast.kind = kind
  clearTimeout(timer)
  timer = setTimeout(() => { toast.text = '' }, ms)
}
