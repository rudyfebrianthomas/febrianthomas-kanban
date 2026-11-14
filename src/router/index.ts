import { createRouter, createWebHistory } from 'vue-router'
import { supabase } from '../lib/supabase'
import AboutView from '../views/AboutView.vue'
import BoardsView from '../views/BoardsView.vue'
import CommissionsView from '../views/CommissionsView.vue'
import HomeView from '../views/HomeView.vue'
import LoginView from '../views/LoginView.vue'
import QueueView from '../views/QueueView.vue'
import SlotsView from '../views/SlotsView.vue'
import TermsView from '../views/TermsView.vue'

const BASE_TITLE = 'febrianthomas · Kanban'
const PROTECTED_PATHS = new Set([
  '/boards',
  '/slots',
  '/manage',
  '/offers',
  '/setting',
  '/settings',
  '/commission-settings',
])

export const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  scrollBehavior(to, from, savedPosition) {
    if (savedPosition) return savedPosition
    if (to.path !== from.path) return { top: 0 }
  },
  routes: [
    { path: '/', component: HomeView },
    { path: '/queue', component: QueueView, meta: { title: 'Queue' } },
    { path: '/board', redirect: (to) => ({ path: '/queue', query: to.query }) },
    { path: '/commissions', component: CommissionsView, meta: { title: 'Commissions' } },
    { path: '/commission', redirect: (to) => ({ path: '/commissions', query: to.query }) },
    { path: '/request', redirect: (to) => ({ path: '/commissions', query: to.query }) },
    { path: '/about', component: AboutView, meta: { title: 'About' } },
    { path: '/terms', component: TermsView, meta: { title: 'Terms' } },
    { path: '/tos', redirect: '/terms' },
    { path: '/boards', component: BoardsView, meta: { title: 'Boards' } },
    { path: '/manage', redirect: '/boards' },
    { path: '/setting', redirect: '/boards' },
    { path: '/settings', redirect: '/boards' },
    { path: '/slots', component: SlotsView, meta: { title: 'Slots' } },
    { path: '/offers', redirect: '/slots' },
    { path: '/commission-settings', redirect: '/slots' },
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
