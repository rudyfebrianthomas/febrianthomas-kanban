<script setup lang="ts">
import { ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { motion, useReducedMotion } from 'motion-v'
import { Eye, EyeOff } from '@lucide/vue'
import { useAuth } from '../composables/useAuth'
import { useLanguage } from '../composables/useLanguage'
import { supabase } from '../lib/supabase'
import LoadingIndicator from '../components/ui/LoadingIndicator.vue'

const { text } = useLanguage()
const { signedIn } = useAuth()
const router = useRouter()
const reducedMotion = useReducedMotion()
const email = ref('')
const password = ref('')
const showPassword = ref(false)
const loading = ref(false)
const checkingSession = ref(!!supabase)
const errorMessage = ref('')

watch(
  signedIn,
  (authenticated) => {
    if (authenticated === true) {
      void router.replace('/')
    } else if (authenticated === false) {
      checkingSession.value = false
    }
  },
  { immediate: true },
)

async function signIn() {
  if (!supabase || loading.value) return
  loading.value = true
  errorMessage.value = ''
  try {
    const { error } = await supabase.auth.signInWithPassword({
      email: email.value.trim(),
      password: password.value,
    })
    if (error) errorMessage.value = text.value.login.invalidCredentials
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
    <div class="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-12 sm:py-16">
      <div class="surface-shadow rounded-3xl border border-zinc-200 bg-white p-6 sm:p-8 dark:border-zinc-800 dark:bg-zinc-900">
        <template v-if="checkingSession">
          <p class="mb-3 text-xs uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">{{ text.login.eyebrow }}</p>
          <h1 id="page-title" class="font-bagel-fat-one text-3xl tracking-tight text-zinc-950 sm:text-4xl dark:text-zinc-50">{{ text.login.checkingTitle }}</h1>
          <p class="mt-3 text-base leading-7 text-zinc-600 dark:text-zinc-300"><LoadingIndicator :label="text.login.checkingStatus" /></p>
        </template>
        <template v-else>
          <p class="mb-3 text-xs uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">{{ text.login.eyebrow }}</p>
          <h1 id="page-title" class="font-bagel-fat-one text-3xl leading-[1.1] tracking-tight text-zinc-950 sm:text-4xl dark:text-zinc-50">{{ text.login.title }}</h1>
          <p class="mt-3 text-sm leading-6 text-zinc-600 sm:text-base dark:text-zinc-300">{{ text.login.description }}</p>
          <p v-if="!supabase" class="mt-4 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm leading-6 text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300" role="alert">{{ text.login.missingConfig }} <code>.env.local</code>.</p>
          <form class="mt-7 space-y-4" @submit.prevent="signIn">
            <div>
              <label for="email" class="mb-1.5 block text-sm text-zinc-900 dark:text-zinc-100">{{ text.login.email }}</label>
              <input id="email" v-model="email" type="email" autocomplete="email" :placeholder="text.login.emailPlaceholder" required class="h-11 w-full rounded-xl border border-zinc-300 bg-white px-3.5 text-sm outline-hidden focus:ring-2 focus:ring-zinc-900 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-50 dark:focus:ring-zinc-300" />
            </div>
            <div>
              <label for="password" class="mb-1.5 block text-sm text-zinc-900 dark:text-zinc-100">{{ text.login.password }}</label>
              <div class="relative">
                <input id="password" v-model="password" :type="showPassword ? 'text' : 'password'" autocomplete="current-password" :placeholder="text.login.passwordPlaceholder" required class="h-11 w-full rounded-xl border border-zinc-300 bg-white px-3.5 pr-12 text-sm outline-hidden focus:ring-2 focus:ring-zinc-900 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-50 dark:focus:ring-zinc-300" />
                <button type="button" class="absolute right-0 top-0 flex size-11 items-center justify-center rounded-xl text-zinc-500 hover:text-zinc-900 focus-visible:outline-2 focus-visible:outline-offset-2 dark:text-zinc-400 dark:hover:text-zinc-100" :aria-label="showPassword ? text.login.hidePassword : text.login.showPassword" :aria-pressed="showPassword" aria-controls="password" @click="showPassword = !showPassword">
                  <EyeOff v-if="showPassword" :size="18" aria-hidden="true" />
                  <Eye v-else :size="18" aria-hidden="true" />
                </button>
              </div>
            </div>
            <p v-if="errorMessage" class="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm leading-6 text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300" role="alert">{{ errorMessage }}</p>
            <motion.button
              type="submit"
              :disabled="loading || !supabase"
              :while-tap="reducedMotion ? undefined : { scale: 0.98 }"
              :transition="{ duration: 0.14 }"
              class="inline-flex h-11 w-full items-center justify-center rounded-xl bg-zinc-900 px-4 py-2 text-sm text-white transition-colors hover:bg-zinc-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300 dark:focus-visible:outline-zinc-100"
            >
              <LoadingIndicator v-if="loading" :label="text.login.signingIn" />
              <template v-else>{{ text.login.signIn }}</template>
            </motion.button>
          </form>
        </template>
      </div>
    </div>
  </main>
</template>
