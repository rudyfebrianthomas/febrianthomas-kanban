import { createRouter, createWebHistory } from 'vue-router'
import { supabase } from '../lib/supabase'
import AboutView from '../views/AboutView.vue'
import CommissionSettingsView from '../views/CommissionSettingsView.vue'
import CommissionView from '../views/CommissionView.vue'
import HomeView from '../views/HomeView.vue'
import LoginView from '../views/LoginView.vue'
import RequestView from '../views/RequestView.vue'
import SettingView from '../views/SettingView.vue'
import TosView from '../views/TosView.vue'

const BASE_TITLE = 'febrianthomas · Kanban'
const PROTECTED_PATHS = new Set(['/setting', '/settings', '/manage', '/commission-settings', '/offers'])

export const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  scrollBehavior(to, from, savedPosition) {
    if (savedPosition) return savedPosition
    if (to.path !== from.path) return { top: 0 }
  },
  routes: [
    { path: '/', component: HomeView },
    { path: '/commission', component: CommissionView, meta: { title: 'Commission' } },
    { path: '/request', component: RequestView, meta: { title: 'Request Commission' } },
    { path: '/about', component: AboutView, meta: { title: 'About' } },
    { path: '/tos', alias: ['/terms'], component: TosView, meta: { title: 'Terms of Service' } },
    { path: '/setting', alias: ['/settings', '/manage'], component: SettingView, meta: { title: 'Manage' } },
    { path: '/commission-settings', alias: ['/offers'], component: CommissionSettingsView, meta: { title: 'Commission Settings' } },
    { path: '/login', component: LoginView, meta: { title: 'Sign in' } },
  ],
})

router.beforeEach(async (to) => {
  if (!PROTECTED_PATHS.has(to.path)) return true
  if (!supabase) return '/'
  const { data } = await supabase.auth.getSession()
  if (!data.session) return '/'
  return true
})

router.afterEach((to) => {
  const pageTitle = typeof to.meta.title === 'string' ? to.meta.title : ''
  document.title = pageTitle ? `${pageTitle} | ${BASE_TITLE}` : BASE_TITLE
})
