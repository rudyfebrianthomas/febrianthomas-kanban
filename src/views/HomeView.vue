<script setup lang="ts">
import { onUnmounted, ref } from 'vue'
import { Pencil } from '@lucide/vue'
import { supabase } from '../supabase'

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
  <main class="page">
    <section class="login-panel" aria-labelledby="page-title">
      <div class="brand"><span class="brand-icon"><Pencil :size="18" aria-hidden="true" /></span><span>the commission desk<span class="brand-dot">.</span></span></div>
      <p class="eyebrow">COMMISSION PROGRESS</p>
      <h1 id="page-title">Coming soon<span class="heading-dot">.</span></h1>
      <p class="intro">The commission progress board is on its way.</p>
      <p v-if="errorMessage" class="error" role="alert">{{ errorMessage }}</p>
      <button v-if="signedIn" class="submit" type="button" :disabled="loading" @click="signOut">{{ loading ? 'Signing out…' : 'Sign out' }}</button>
      <RouterLink v-else-if="!checkingSession" class="submit" to="/login">Artist sign in</RouterLink>
    </section>
  </main>
</template>
