<script setup lang="ts">
import { onUnmounted, ref } from 'vue'
import { LogIn, LogOut } from '@lucide/vue'
import { useRoute } from 'vue-router'
import { supabase } from '../supabase'

const route = useRoute()
const signedIn = ref(false)
const checkingSession = ref(!!supabase)
const loading = ref(false)
const errorMessage = ref('')
const subscription = supabase?.auth.onAuthStateChange((_event, session) => {
  signedIn.value = !!session
  checkingSession.value = false
})
onUnmounted(() => subscription?.data.subscription.unsubscribe())

async function signOut() {
  if (!supabase || loading.value) return
  loading.value = true
  errorMessage.value = ''
  try {
    const { error } = await supabase.auth.signOut()
    if (error) errorMessage.value = error.message
  } catch {
    errorMessage.value = 'Could not sign out. Check your connection and try again.'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <header class="site-header">
    <RouterLink class="site-name" to="/">febrianthomas kanban</RouterLink>
    <nav class="site-nav" aria-label="Main navigation">
      <RouterLink to="/">Home</RouterLink>
      <RouterLink to="/project">Project</RouterLink>
      <RouterLink to="/about">About</RouterLink>
    </nav>
    <div class="auth-control">
      <button v-if="signedIn" class="auth-icon" type="button" :disabled="loading" :aria-label="loading ? 'Signing out' : 'Sign out'" :title="loading ? 'Signing out' : 'Sign out'" @click="signOut"><LogOut :size="20" aria-hidden="true" /></button>
      <RouterLink v-else-if="!checkingSession" class="auth-icon" to="/login" aria-label="Sign in" title="Sign in"><LogIn :size="20" aria-hidden="true" /></RouterLink>
    </div>
  </header>
  <main class="home-page">
    <section v-if="route.path === '/'" class="home-content" aria-labelledby="page-title">
      <div class="home-heading">
        <p class="eyebrow">FEBRIANTHOMAS / COMMISSIONS</p>
        <h1 id="page-title">A little progress<span class="heading-dot">.</span><br />A lot of heart<span class="heading-dot">.</span></h1>
        <p class="home-intro">Follow your illustration from the first idea to the final artwork.</p>
      </div>
      <div class="progress-preview">
        <div class="preview-heading"><span>THE COMMISSION BOARD</span><span class="preview-note">Coming soon</span></div>
        <div class="progress-stages" aria-label="Commission stages">
          <div class="progress-stage"><span class="stage-number">01</span><span>To do</span></div>
          <div class="progress-stage"><span class="stage-number">02</span><span>In progress</span></div>
          <div class="progress-stage"><span class="stage-number">03</span><span>Done</span></div>
        </div>
        <p class="preview-message">The board is being prepared. Check back soon for updates.</p>
      </div>
      <p v-if="errorMessage" class="error" role="alert">{{ errorMessage }}</p>
    </section>
    <section v-else class="home-content secondary-page" aria-labelledby="page-title">
      <p class="eyebrow">{{ route.path === '/project' ? 'PROJECT' : 'ABOUT' }}</p>
      <h1 id="page-title">Coming soon<span class="heading-dot">.</span></h1>
      <p class="home-intro">This page is on its way.</p>
      <p v-if="errorMessage" class="error" role="alert">{{ errorMessage }}</p>
    </section>
  </main>
</template>
