<script setup lang="ts">
import { onUnmounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { supabase } from '../supabase'
import { ArrowRight, Eye, EyeOff, Pencil } from '@lucide/vue'

const router = useRouter()
const email = ref('')
const password = ref('')
const showPassword = ref(false)
const loading = ref(false)
const checkingSession = ref(!!supabase)
const errorMessage = ref('')

const subscription = supabase?.auth.onAuthStateChange((_event, currentSession) => {
  if (currentSession) {
    void router.replace('/')
  } else {
    checkingSession.value = false
  }
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

</script>

<template>
  <main class="page">
    <section class="login-panel" aria-labelledby="page-title">
      <RouterLink class="brand login-brand" to="/"><span class="brand-icon"><Pencil :size="18" aria-hidden="true" /></span><span>febrianthomas commission progress<span class="brand-dot">.</span></span></RouterLink>

      <div class="form-wrap">
        <template v-if="checkingSession">
          <p class="eyebrow">ARTIST'S CORNER</p>
          <h1 id="page-title">One little moment<span class="heading-dot">.</span></h1>
          <p class="intro" role="status">Checking your session…</p>
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
        </template>
      </div>
    </section>

  </main>
</template>
