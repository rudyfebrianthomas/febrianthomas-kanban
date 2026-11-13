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

    <aside class="visual-panel" aria-label="Illustration commission workspace">
      <div class="visual-inner">
        <p class="visual-kicker">A LITTLE CREATIVE SPACE</p>
        <h2>Good things<br />take <em>making.</em></h2>
        <p class="visual-intro">From first sketch to finishing touches,<br />keep every commission in view.</p>
        <div class="artwork" aria-hidden="true">
          <span class="art-spark art-spark-one">✳</span><span class="art-spark art-spark-two">✦</span>
          <div class="paper paper-back"></div>
          <div class="paper paper-front">
            <div class="paper-label">A LITTLE WORK IN PROGRESS <span>↗</span></div>
            <svg class="drawing" viewBox="0 0 250 180" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M21 151C48 135 61 153 86 137C110 121 113 128 130 134C151 141 166 111 185 116C205 122 215 105 232 99" stroke="#43443A" stroke-width="3" stroke-linecap="round"/>
              <path d="M87 134C82 112 82 84 93 72C103 61 119 70 119 85C119 66 137 59 146 73C154 85 147 114 140 133" fill="#E7A886" stroke="#43443A" stroke-width="3" stroke-linejoin="round"/>
              <path d="M97 98C101 104 105 104 109 98M128 98C132 104 136 104 140 98M112 112C118 118 124 118 130 112" stroke="#43443A" stroke-width="3" stroke-linecap="round"/>
              <path d="M46 76L53 55L60 76L81 83L60 90L53 111L46 90L25 83L46 76Z" fill="#E9C85F" stroke="#43443A" stroke-width="3" stroke-linejoin="round"/>
              <path d="M177 56C184 42 199 43 202 55C209 45 222 51 219 62C216 75 199 85 190 89C180 80 170 68 177 56Z" fill="#D39081" stroke="#43443A" stroke-width="3" stroke-linejoin="round"/>
            </svg>
            <div class="paper-bottom"><span>SKETCHBOOK NO. 01</span><span>✳</span></div>
          </div>
          <div class="pencil-art"><span></span></div>
        </div>
        <p class="visual-foot">A place for ideas in progress <span>✳</span></p>
      </div>
    </aside>
  </main>
</template>
