<script setup lang="ts">
import { onUnmounted, ref } from 'vue'
import { LogOut, UserRound } from '@lucide/vue'
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
    const { error } = await supabase.auth.signOut({ scope: 'local' })
    if (error) errorMessage.value = error.message
  } catch {
    errorMessage.value = 'Could not sign out. Check your connection and try again.'
  } finally {
    loading.value = false
  }
}

const controlClass = 'inline-flex size-11 items-center justify-center text-zinc-500 hover:text-zinc-950 focus-visible:outline-2 focus-visible:outline-offset-4 disabled:cursor-not-allowed disabled:opacity-50'
</script>

<template>
  <header class="sticky top-0 z-50 border-b border-zinc-200 bg-zinc-50 px-6 sm:px-10">
    <div class="mx-auto flex max-w-6xl flex-col items-center gap-3 py-5 md:grid md:grid-cols-[1fr_auto_1fr] md:gap-4 md:py-4">
      <RouterLink to="/" class="inline-flex min-h-11 items-center gap-2 self-start text-lg text-zinc-950 focus-visible:outline-2 focus-visible:outline-offset-4">
        <img src="/images/lick.gif" alt="" width="32" height="32" class="size-8 object-contain" />
        <span>febrianthomas · Kanban</span>
      </RouterLink>
      <nav aria-label="Main navigation">
        <ul class="flex items-center justify-center gap-6 text-base font-medium text-zinc-600 sm:gap-8">
          <li><AnimatedLink to="/" :while-hover="{ y: -3, rotate: -4, scale: 1.08 }" class="inline-flex min-h-11 items-center hover:text-zinc-950 focus-visible:outline-2 focus-visible:outline-offset-4">Home</AnimatedLink></li>
          <li><AnimatedLink to="/about" :while-hover="{ y: -3, rotate: 4, scale: 1.08 }" class="inline-flex min-h-11 items-center hover:text-zinc-950 focus-visible:outline-2 focus-visible:outline-offset-4">About</AnimatedLink></li>
        </ul>
      </nav>
      <div class="absolute right-4 top-5 flex items-center gap-2 md:static md:justify-self-end">
        <button v-if="signedIn" type="button" :disabled="loading" :aria-label="loading ? 'Signing out' : 'Sign out'" :title="loading ? 'Signing out' : 'Sign out'" :class="controlClass" @click="signOut">
          <LogOut :size="18" :stroke-width="1.75" aria-hidden="true" />
        </button>
        <AnimatedLink v-else-if="!checkingSession" to="/login" aria-label="Sign in" title="Sign in" :class="controlClass">
          <UserRound :size="18" :stroke-width="1.75" aria-hidden="true" />
        </AnimatedLink>
      </div>
    </div>
  </header>
  <p v-if="errorMessage" class="mx-auto mt-4 w-full max-w-6xl px-6 text-sm text-red-700 sm:px-10" role="alert">{{ errorMessage }}</p>
</template>
