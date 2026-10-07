// src/stores/auth.js — who is using the app and what they may do.
// Loaded once per page load from get_session_info (roles, employee, counts).
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { getSessionInfo, login as apiLogin, logout as apiLogout, currentUser } from '@/api/frappe'

export const useAuthStore = defineStore('auth', () => {
  const info = ref(null)
  const loading = ref(false)
  const error = ref('')

  const user = computed(() => info.value?.user || currentUser())
  const employee = computed(() => info.value?.employee || null)
  const username = computed(() => employee.value?.employee_name || info.value?.full_name || user.value)
  const designation = computed(() => {
    if (info.value?.is_gate && !employee.value) return 'Gate Security'
    return employee.value?.designation || employee.value?.department || ''
  })
  const isGate = computed(() => !!info.value?.is_gate)
  const isManager = computed(() => !!info.value?.is_manager)
  const canRaise = computed(() => !!info.value?.can_raise)
  const counts = computed(() => info.value?.counts || {})

  async function load(force = false) {
    if (info.value && !force) return true
    loading.value = true
    error.value = ''
    try {
      info.value = await getSessionInfo()
      return true
    } catch (e) {
      error.value = e.message || 'Could not load your profile'
      return false
    } finally {
      loading.value = false
    }
  }

  async function login(email, password) {
    await apiLogin(email, password)
  }

  async function logout() {
    await apiLogout()
    info.value = null
  }

  return { info, loading, error, user, employee, username, designation, isGate, isManager, canRaise, counts, load, login, logout }
})
