<script setup lang="ts">
import { onUnmounted, ref } from 'vue'
import { LogIn, LogOut } from '@lucide/vue'
import { supabase } from '../supabase'
import AnimatedLink from './AnimatedLink.vue'

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
    <div class="site-header-inner">
      <RouterLink class="site-name" to="/">febrianthomas kanban</RouterLink>
      <nav class="site-nav" aria-label="Main navigation">
        <AnimatedLink to="/">Home</AnimatedLink>
        <AnimatedLink to="/project">Project</AnimatedLink>
        <AnimatedLink to="/about">About</AnimatedLink>
      </nav>
      <div class="auth-control">
        <button v-if="signedIn" class="auth-icon" type="button" :disabled="loading" :aria-label="loading ? 'Signing out' : 'Sign out'" :title="loading ? 'Signing out' : 'Sign out'" @click="signOut"><LogOut :size="20" aria-hidden="true" /></button>
        <RouterLink v-else-if="!checkingSession" class="auth-icon" to="/login" aria-label="Sign in" title="Sign in"><LogIn :size="20" aria-hidden="true" /></RouterLink>
      </div>
    </div>
  </header>
  <p v-if="errorMessage" class="header-error error" role="alert">{{ errorMessage }}</p>
</template>
