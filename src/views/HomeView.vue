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
    <RouterLink class="site-name" to="/">febrianthomas commission progress</RouterLink>
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
    <section class="login-panel" aria-labelledby="page-title">
      <p class="eyebrow">{{ route.path === '/project' ? 'PROJECT' : route.path === '/about' ? 'ABOUT' : 'COMMISSION PROGRESS' }}</p>
      <h1 id="page-title">Coming soon<span class="heading-dot">.</span></h1>
      <p class="intro">{{ route.path === '/' ? 'The commission progress board is on its way.' : 'This page is on its way.' }}</p>
      <p v-if="errorMessage" class="error" role="alert">{{ errorMessage }}</p>
    </section>
  </main>
</template>
