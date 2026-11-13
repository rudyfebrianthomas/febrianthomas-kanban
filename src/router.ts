import { createRouter, createWebHistory } from 'vue-router'
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
    { path: '/setting', component: SettingView },
    { path: '/login', component: LoginView },
  ],
})
