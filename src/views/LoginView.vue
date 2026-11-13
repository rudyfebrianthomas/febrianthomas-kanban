<script setup lang="ts">
import { onUnmounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { motion, useReducedMotion } from 'motion-v'
import { Eye, EyeOff } from '@lucide/vue'
import { useLanguage } from '../composables/useLanguage'
import { supabase } from '../lib/supabase'

const { text } = useLanguage()
const router = useRouter()
const reducedMotion = useReducedMotion()
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
    errorMessage.value = text.value.login.connectionError
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <main class="flex flex-1 flex-col px-6 sm:px-10">
    <div class="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center pb-24 pt-10">
      <template v-if="checkingSession">
        <p class="mb-5 text-xs uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">{{ text.login.eyebrow }}</p>
        <h1 id="page-title" class="text-4xl font-bold tracking-tight text-zinc-950 dark:text-zinc-50">{{ text.login.checkingTitle }}</h1>
        <p class="mt-3 text-base leading-7 text-zinc-600 dark:text-zinc-300" role="status">{{ text.login.checkingStatus }}</p>
      </template>
      <template v-else>
        <p class="mb-5 text-xs uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">{{ text.login.eyebrow }}</p>
        <h1 id="page-title" class="text-4xl font-bold tracking-tight text-zinc-950 dark:text-zinc-50">{{ text.login.title }}</h1>
        <p class="mt-3 text-base leading-7 text-zinc-600 dark:text-zinc-300">{{ text.login.description }}</p>
        <p v-if="!supabase" class="mt-4 text-sm leading-6 text-red-700 dark:text-red-400" role="alert">{{ text.login.missingConfig }} <code>.env.local</code>.</p>
        <form class="mt-10 space-y-5" @submit.prevent="signIn">
          <div>
            <label for="email" class="block text-sm text-zinc-900 dark:text-zinc-100">{{ text.login.email }}</label>
            <input id="email" v-model="email" type="email" autocomplete="email" :placeholder="text.login.emailPlaceholder" required class="mt-2 h-12 w-full rounded-md border border-zinc-300 bg-white px-3 text-base outline-none focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-50 dark:focus:border-zinc-300 dark:focus:ring-zinc-300" />
          </div>
          <div>
            <label for="password" class="block text-sm text-zinc-900 dark:text-zinc-100">{{ text.login.password }}</label>
            <div class="relative mt-2">
              <input id="password" v-model="password" :type="showPassword ? 'text' : 'password'" autocomplete="current-password" :placeholder="text.login.passwordPlaceholder" required class="h-12 w-full rounded-md border border-zinc-300 bg-white px-3 pr-12 text-base outline-none focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-50 dark:focus:border-zinc-300 dark:focus:ring-zinc-300" />
              <button type="button" class="absolute right-0 top-0 flex size-12 items-center justify-center rounded-md text-zinc-500 hover:text-zinc-900 focus-visible:outline-2 focus-visible:outline-offset-2 dark:text-zinc-400 dark:hover:text-zinc-100" :aria-label="showPassword ? text.login.hidePassword : text.login.showPassword" :aria-pressed="showPassword" aria-controls="password" @click="showPassword = !showPassword">
                <EyeOff v-if="showPassword" :size="20" aria-hidden="true" />
                <Eye v-else :size="20" aria-hidden="true" />
              </button>
            </div>
          </div>
          <p v-if="errorMessage" class="text-sm leading-6 text-red-700 dark:text-red-400" role="alert">{{ errorMessage }}</p>
          <motion.button
            type="submit"
            :disabled="loading || !supabase"
            :while-tap="reducedMotion ? undefined : { scale: 0.98 }"
            :transition="{ duration: 0.14 }"
            class="inline-flex h-12 w-full items-center justify-center rounded-md bg-zinc-900 px-4 py-2 text-sm text-white hover:bg-zinc-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300 dark:focus-visible:outline-zinc-100"
          >
            {{ loading ? text.login.signingIn : text.login.signIn }}
          </motion.button>
        </form>
      </template>
    </div>
  </main>
</template>
