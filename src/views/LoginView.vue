<script setup lang="ts">
import { onUnmounted, ref } from 'vue'
import { createClient, type Session } from '@supabase/supabase-js'
import { ArrowRight, Eye, EyeOff, Pencil } from '@lucide/vue'

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
      <div class="brand"><span class="brand-icon"><Pencil :size="18" aria-hidden="true" /></span><span>the commission desk<span class="brand-dot">.</span></span></div>

      <div class="form-wrap">
        <div class="mobile-mark" aria-hidden="true">✳</div>
        <template v-if="checkingSession">
          <p class="eyebrow">ARTIST'S CORNER</p>
          <h1 id="page-title">One little moment<span class="heading-dot">.</span></h1>
          <p class="intro" role="status">Checking your session…</p>
        </template>
        <template v-else-if="session">
          <p class="eyebrow">ARTIST'S CORNER</p>
          <h1 id="page-title">You’re signed in<span class="heading-dot">.</span></h1>
          <p class="intro">Welcome back, <strong>{{ session.user.email }}</strong>.</p>
          <p v-if="errorMessage" class="error" role="alert">{{ errorMessage }}</p>
          <button class="submit" type="button" :disabled="loading" @click="signOut">{{ loading ? 'Signing out…' : 'Sign out' }} <ArrowRight :size="18" aria-hidden="true" /></button>
        </template>
        <template v-else>
          <p class="eyebrow">ARTIST'S CORNER</p>
          <h1 id="page-title">Hello again<span class="heading-dot">!</span></h1>
          <p class="intro">Sign in to manage your commission progress.</p>
          <p v-if="!supabase" class="error" role="alert">Supabase isn’t configured yet. Add your project URL and publishable key to <code>.env.local</code>.</p>
          <form @submit.prevent="signIn">
            <div class="field"><label for="email">Email address</label><input id="email" v-model="email" type="email" autocomplete="email" placeholder="you@example.com" required /></div>
            <div class="field"><label for="password">Password</label><div class="password-field"><input id="password" v-model="password" :type="showPassword ? 'text' : 'password'" autocomplete="current-password" placeholder="Your password" required /><button class="show-password" type="button" :aria-label="showPassword ? 'Hide password' : 'Show password'" :aria-pressed="showPassword" @click="showPassword = !showPassword"><EyeOff v-if="showPassword" :size="19" aria-hidden="true" /><Eye v-else :size="19" aria-hidden="true" /></button></div></div>
            <p v-if="errorMessage" class="error" role="alert">{{ errorMessage }}</p>
            <button class="submit" type="submit" :disabled="loading || !supabase">{{ loading ? 'Signing in…' : 'Sign in' }} <ArrowRight :size="18" aria-hidden="true" /></button>
          </form>
          <p class="account-note">A little space for your works in progress.</p>
        </template>
      </div>
      <p class="footer">Made for the messy middle <span aria-hidden="true">✳</span></p>
    </section>

  </main>
</template>
