import { createRouter, createWebHistory } from 'vue-router'
import { supabase } from './supabase'
import AboutView from './views/AboutView.vue'
import CommissionView from './views/CommissionView.vue'
import HomeView from './views/HomeView.vue'
import LoginView from './views/LoginView.vue'
import SettingView from './views/SettingView.vue'

const BASE_TITLE = 'febrianthomas · Kanban'

export const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/', component: HomeView },
    { path: '/commission', component: CommissionView, meta: { title: 'Commission' } },
    { path: '/about', component: AboutView, meta: { title: 'About' } },
    { path: '/setting', alias: '/settings', component: SettingView, meta: { title: 'Setting' } },
    { path: '/login', component: LoginView, meta: { title: 'Sign in' } },
  ],
})

router.beforeEach(async (to) => {
  if (to.path !== '/setting' && to.path !== '/settings') return true
  if (!supabase) return '/'
  const { data } = await supabase.auth.getSession()
  if (!data.session) return '/'
  return true
})

router.afterEach((to) => {
  const pageTitle = typeof to.meta.title === 'string' ? to.meta.title : ''
  document.title = pageTitle ? `${pageTitle} | ${BASE_TITLE}` : BASE_TITLE
})
