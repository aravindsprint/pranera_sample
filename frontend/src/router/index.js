import { createRouter, createWebHistory } from 'vue-router'
import { isLoggedIn } from '@/api/frappe'
import LoginPage from '@/pages/login/LoginPage.vue'
import HomePage from '@/pages/home/HomePage.vue'

const HOME = '/sample-app/home'

const routes = [
  { path: '/', redirect: HOME },
  { path: '/sample-app', redirect: HOME },
  { path: '/sample-app/login', component: LoginPage },
  { path: '/sample-app/home', component: HomePage },

  { path: '/sample-app/my-passes', component: () => import('@/pages/my-passes/MyPassesPage.vue') },
  { path: '/sample-app/new', component: () => import('@/pages/pass-form/PassFormPage.vue') },
  { path: '/sample-app/edit/:name', component: () => import('@/pages/pass-form/PassFormPage.vue'), props: true },
  { path: '/sample-app/pass/:name', component: () => import('@/pages/pass-detail/PassDetailPage.vue'), props: true },
  { path: '/sample-app/approvals', component: () => import('@/pages/approvals/ApprovalsPage.vue') },
  { path: '/sample-app/gate', component: () => import('@/pages/gate-check/GateCheckPage.vue'), meta: { gate: true } },
  { path: '/sample-app/gate/:gatePassNo', component: () => import('@/pages/gate-check/GateCheckPage.vue'), props: true, meta: { gate: true } },

  { path: '/sample-app/:pathMatch(.*)*', redirect: HOME },
]

const router = createRouter({ history: createWebHistory(), routes })

router.beforeEach((to) => {
  const loggedIn = isLoggedIn()
  if (to.path !== '/sample-app/login' && !loggedIn) {
    return { path: '/sample-app/login', query: { redirect: to.fullPath } }
  }
  if (to.path === '/sample-app/login' && loggedIn) return { path: HOME }
  return true
})

export default router
