<template>
  <div class="page">
    <AppHeader title="Sample Pass" :subtitle="greeting" active="home" />
    <div class="page-content">

      <div v-if="auth.loading && !auth.info" class="loading-center"><div class="spinner"></div></div>

      <template v-else-if="auth.info">
        <!-- Staff -->
        <template v-if="auth.employee">
          <button v-if="auth.canRaise" class="hero" @click="go('/sample-app/new')">
            <span class="hero__icon">➕</span>
            <span class="hero__text">
              <span class="hero__title">New Gate Pass</span>
              <span class="hero__sub">Taking samples to a customer or supplier</span>
            </span>
            <i class="pi pi-chevron-right"></i>
          </button>

          <div v-if="!auth.info.has_reports_to" class="alert alert-warning">
            <i class="pi pi-info-circle"></i>
            No reporting manager is set on your Employee record — your passes go to the Merchandising Manager for approval.
          </div>

          <div class="tiles">
            <button class="tile" @click="go('/sample-app/my-passes')">
              <span class="tile__num">{{ auth.counts.my_open || 0 }}</span>
              <span class="tile__label">My open passes</span>
            </button>
            <button class="tile" :class="{ 'tile--danger': auth.counts.my_overdue }" @click="go('/sample-app/my-passes?status=overdue')">
              <span class="tile__num">{{ auth.counts.my_overdue || 0 }}</span>
              <span class="tile__label">Overdue</span>
            </button>
          </div>
        </template>

        <!-- Approver -->
        <button v-if="auth.counts.approvals || auth.isManager" class="row-link" @click="go('/sample-app/approvals')">
          <span class="row-link__icon">✅</span>
          <span class="row-link__text">Approvals waiting</span>
          <span class="row-link__count" :class="{ 'row-link__count--hot': auth.counts.approvals }">{{ auth.counts.approvals || 0 }}</span>
          <i class="pi pi-chevron-right"></i>
        </button>

        <!-- Gate -->
        <button v-if="auth.isGate" class="hero hero--gate" @click="go('/sample-app/gate')">
          <span class="hero__icon">🛂</span>
          <span class="hero__text">
            <span class="hero__title">Gate Check</span>
            <span class="hero__sub">{{ auth.counts.awaiting_exit || 0 }} approved pass(es) waiting to go out</span>
          </span>
          <i class="pi pi-chevron-right"></i>
        </button>

        <div class="how card">
          <div class="section-title">How it works</div>
          <ol>
            <li><b>Raise</b> a gate pass with the samples and expected return date.</li>
            <li>Your <b>reporting manager approves</b> it here or in ERPNext.</li>
            <li>At the gate, <b>security scans your QR</b>, checks the samples and takes a photo.</li>
            <li>When the samples come back, <b>record the return</b> on the pass.</li>
          </ol>
        </div>
      </template>

      <div v-else-if="auth.error" class="empty-state">
        <div class="empty-state__icon">⚠️</div>
        <div class="empty-state__title">Can't open Sample Pass</div>
        <div class="empty-state__sub">{{ auth.error }}</div>
        <button class="btn btn-primary" @click="auth.load(true)">Try again</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import AppHeader from '@/components/AppHeader.vue'

const auth = useAuthStore()
const router = useRouter()
const go = (p) => router.push(p)
onMounted(() => auth.load(true))  // refresh counts every time Home opens

const greeting = computed(() => auth.username ? `Hi, ${auth.username.split(' ')[0]}` : '')
</script>

<style scoped>
.hero { width:100%; display:flex; align-items:center; gap:14px; padding:18px 16px; margin-bottom:12px; border:none; border-radius:16px; background:var(--app-primary); color:#fff; text-align:left; font:inherit; cursor:pointer; box-shadow:var(--shadow-md); }
.hero--gate { background:#0f172a; }
.hero__icon { font-size:28px; }
.hero__text { flex:1; display:flex; flex-direction:column; gap:2px; }
.hero__title { font-size:18px; font-weight:800; }
.hero__sub { font-size:13px; opacity:.8; }
.tiles { display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:12px; }
.tile { background:#fff; border:1px solid var(--slate-200); border-radius:16px; padding:16px; display:flex; flex-direction:column; gap:4px; text-align:left; font:inherit; cursor:pointer; }
.tile__num { font-size:30px; font-weight:900; color:var(--slate-900); line-height:1; }
.tile__label { font-size:13px; color:var(--slate-500); font-weight:600; }
.tile--danger { border-color:#fecaca; background:#fff5f5; }
.tile--danger .tile__num { color:#dc2626; }
.row-link { width:100%; display:flex; align-items:center; gap:12px; background:#fff; border:1px solid var(--slate-200); border-radius:14px; padding:14px 16px; margin-bottom:12px; font:inherit; cursor:pointer; text-align:left; }
.row-link__icon { font-size:20px; }
.row-link__text { flex:1; font-weight:700; color:var(--slate-900); }
.row-link__count { min-width:28px; height:28px; border-radius:14px; background:var(--slate-100); color:var(--slate-700); font-weight:800; display:inline-flex; align-items:center; justify-content:center; padding:0 8px; }
.row-link__count--hot { background:#dc2626; color:#fff; }
.how ol { padding-left:20px; display:flex; flex-direction:column; gap:8px; font-size:14px; color:var(--slate-700); }
</style>
