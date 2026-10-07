const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export function fmtDate(d) {
  if (!d) return '—'
  const [y, m, day] = String(d).slice(0, 10).split('-')
  if (!m) return d
  return `${Number(day)} ${MONTHS[Number(m) - 1]} ${y}`
}

export function fmtDateTime(d) {
  if (!d) return '—'
  const time = String(d).slice(11, 16)
  return `${fmtDate(d)}${time ? ', ' + time : ''}`
}

export function todayISO(offsetDays = 0) {
  const d = new Date()
  d.setDate(d.getDate() + offsetDays)
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function fmtQty(q, unit) {
  const n = Number(q) || 0
  const whole = unit === 'Pcs' || unit === 'Nos'
  return `${whole ? Math.round(n) : Number(n.toFixed(2))} ${unit || ''}`.trim()
}

// Gate photos are private files; same-origin, cookie-authenticated URLs.
export function fileUrl(u) {
  if (!u) return ''
  return encodeURI(u)
}
