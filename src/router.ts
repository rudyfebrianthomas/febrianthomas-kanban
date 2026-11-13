import { createRouter, createWebHistory } from 'vue-router'
import { supabase } from './supabase'
import AboutView from './views/AboutView.vue'
import CommissionView from './views/CommissionView.vue'
import HomeView from './views/HomeView.vue'
import LoginView from './views/LoginView.vue'
import SettingView from './views/SettingView.vue'

export const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/', component: HomeView },
    { path: '/commission', component: CommissionView },
    { path: '/about', component: AboutView },
    { path: '/setting', alias: '/settings', component: SettingView },
    { path: '/login', component: LoginView },
  ],
})

router.beforeEach(async (to) => {
  if (to.path !== '/setting' && to.path !== '/settings') return true
  if (!supabase) return '/'
  const { data } = await supabase.auth.getSession()
  if (!data.session) return '/'
  return true
})
