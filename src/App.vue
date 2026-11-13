<script setup lang="ts">
import { onUnmounted, ref } from 'vue'
import { createClient, type Session } from '@supabase/supabase-js'
import { ArrowRight, Eye, EyeOff, LayoutDashboard } from '@lucide/vue'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
let supabase: ReturnType<typeof createClient> | null = null
try {
  if (url && key) supabase = createClient(url, key)
} catch {
  // Invalid configuration is shown in the form.
}

const email = ref('')
const password = ref('')
const showPassword = ref(false)
const session = ref<Session | null>(null)
const loading = ref(false)
const checkingSession = ref(!!supabase)
const errorMessage = ref('')

const subscription = supabase?.auth.onAuthStateChange((_event, currentSession) => {
  session.value = currentSession
  checkingSession.value = false
})
onUnmounted(() => subscription?.data.subscription.unsubscribe())

async function signIn() {
  if (!supabase || loading.value) return
  loading.value = true
  errorMessage.value = ''
  try {
    const { error } = await supabase.auth.signInWithPassword({
      email: email.value.trim(),
      password: password.value,
    })
    if (error) errorMessage.value = error.message
    else password.value = ''
  } catch {
    errorMessage.value = 'Could not connect. Check your connection and try again.'
  } finally {
    loading.value = false
  }
}

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
      <div class="brand"><span class="brand-icon"><LayoutDashboard :size="19" stroke-width="2.2" /></span><span>kanban<span class="brand-dot">.</span></span></div>
      <div class="form-wrap">
        <template v-if="checkingSession">
          <p class="eyebrow">YOUR WORKSPACE</p>
          <h1 id="page-title">Checking your session</h1>
          <p class="intro" role="status">Just a moment.</p>
        </template>
        <template v-else-if="session">
          <p class="eyebrow">YOUR WORKSPACE</p>
          <h1 id="page-title">You’re signed in.</h1>
          <p class="intro">Signed in as <strong>{{ session.user.email }}</strong>.</p>
          <p v-if="errorMessage" class="error" role="alert">{{ errorMessage }}</p>
          <button class="submit" type="button" :disabled="loading" @click="signOut">{{ loading ? 'Signing out…' : 'Sign out' }} <ArrowRight :size="18" /></button>
        </template>
        <template v-else>
          <p class="eyebrow">YOUR WORKSPACE</p>
          <h1 id="page-title">Welcome back<span class="heading-dot">.</span></h1>
          <p class="intro">Sign in to pick up where you left off.</p>
          <p v-if="!supabase" class="error" role="alert">Supabase isn’t configured yet. Add your project URL and publishable key to <code>.env.local</code>.</p>
          <form @submit.prevent="signIn">
            <div class="field"><label for="email">Email address</label><input id="email" v-model="email" type="email" autocomplete="email" placeholder="you@example.com" required /></div>
            <div class="field"><label for="password">Password</label><div class="password-field"><input id="password" v-model="password" :type="showPassword ? 'text' : 'password'" autocomplete="current-password" placeholder="Enter your password" required /><button class="show-password" type="button" :aria-label="showPassword ? 'Hide password' : 'Show password'" :aria-pressed="showPassword" @click="showPassword = !showPassword"><EyeOff v-if="showPassword" :size="19" /><Eye v-else :size="19" /></button></div></div>
            <p v-if="errorMessage" class="error" role="alert">{{ errorMessage }}</p>
            <button class="submit" type="submit" :disabled="loading || !supabase">{{ loading ? 'Signing in…' : 'Sign in' }} <ArrowRight :size="18" /></button>
          </form>
          <p class="account-note">Need access? Contact your workspace administrator.</p>
        </template>
      </div>
      <p class="footer">A little more clarity, every day.</p>
    </section>
    <aside class="visual-panel" aria-label="Kanban introduction">
      <div class="visual-copy"><p class="visual-kicker">A CLEARER WAY TO WORK</p><h2>Make room<br />for progress<span>.</span></h2><p>Keep your work in view, one step at a time.</p></div>
      <div class="board" aria-hidden="true"><div class="board-top"><span>YOUR BOARD</span><span>···</span></div><div class="columns"><div class="column"><div class="column-title">To do <span>2</span></div><div class="task"><i></i><b>Gather ideas</b><small>Make a little space to think</small></div><div class="task short"><i></i><b>Plan the week</b></div></div><div class="column"><div class="column-title">In progress <span>1</span></div><div class="task"><i class="orange"></i><b>Find your focus</b><small>One thing at a time</small></div></div><div class="column"><div class="column-title">Done <span>1</span></div><div class="task short"><i class="green"></i><b>Get started</b></div></div></div></div>
      <p class="visual-foot">A little structure goes a long way. <span>01 / 01</span></p>
    </aside>
  </main>
</template>
