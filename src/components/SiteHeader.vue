<script setup lang="ts">
import { onUnmounted, ref } from 'vue'
import { LogOut, UserRound } from '@lucide/vue'
import { useLanguage } from '../composables/useLanguage'
import { supabase } from '../supabase'
import AnimatedLink from './AnimatedLink.vue'
import ConfirmDialog from './ConfirmDialog.vue'
import LanguageToggle from './LanguageToggle.vue'
import ThemeToggle from './ThemeToggle.vue'

const { text } = useLanguage()
const signedIn = ref(false)
const subscription = supabase?.auth.onAuthStateChange((_event, session) => {
  signedIn.value = !!session
})
onUnmounted(() => subscription?.data.subscription.unsubscribe())

async function signOut() {
  if (!supabase) return
  const { error } = await supabase.auth.signOut({ scope: 'local' })
  if (error) throw error
}

const controlClass = 'inline-flex size-11 items-center justify-center text-zinc-500 hover:text-zinc-950 focus-visible:outline-2 focus-visible:outline-offset-4 dark:text-zinc-400 dark:hover:text-zinc-50'
</script>

<template>
  <header class="sticky top-0 z-50 border-b border-zinc-200 bg-zinc-50 px-6 sm:px-10 dark:border-zinc-800 dark:bg-zinc-900">
    <div class="mx-auto flex max-w-6xl flex-col items-center gap-3 py-5 md:grid md:grid-cols-[1fr_auto_1fr] md:gap-4 md:py-4">
      <RouterLink to="/" class="inline-flex min-h-11 items-center gap-2 self-start font-sniglet text-lg text-zinc-950 focus-visible:outline-2 focus-visible:outline-offset-4 dark:text-zinc-50">
        <img src="/images/lick.gif" alt="" width="32" height="32" class="size-8 object-contain" />
        <span>{{ text.site.brand }}</span>
      </RouterLink>
      <nav :aria-label="text.navigation.label">
        <ul class="flex items-center justify-center gap-6 text-base sm:gap-8">
          <li><AnimatedLink to="/" :while-hover="{ y: -3, rotate: -4, scale: 1.08 }" class="inline-flex min-h-11 items-center hover:text-zinc-500 dark:hover:text-zinc-300 focus-visible:outline-2 focus-visible:outline-offset-4">{{ text.navigation.home }}</AnimatedLink></li>
          <li><AnimatedLink to="/commission" :while-hover="{ y: -3, rotate: 4, scale: 1.08 }" class="inline-flex min-h-11 items-center hover:text-zinc-500 dark:hover:text-zinc-300 focus-visible:outline-2 focus-visible:outline-offset-4">{{ text.navigation.commission }}</AnimatedLink></li>
          <li v-if="signedIn"><AnimatedLink to="/setting" :while-hover="{ y: -3, rotate: 4, scale: 1.08 }" class="inline-flex min-h-11 items-center hover:text-zinc-500 dark:hover:text-zinc-300 focus-visible:outline-2 focus-visible:outline-offset-4">{{ text.navigation.setting }}</AnimatedLink></li>
          <li><AnimatedLink to="/about" :while-hover="{ y: -3, rotate: -4, scale: 1.08 }" class="inline-flex min-h-11 items-center hover:text-zinc-500 dark:hover:text-zinc-300 focus-visible:outline-2 focus-visible:outline-offset-4">{{ text.navigation.about }}</AnimatedLink></li>
        </ul>
      </nav>
      <div class="absolute right-4 top-5 flex items-center gap-0 sm:gap-2 md:static md:justify-self-end">
        <LanguageToggle />
        <ThemeToggle />
        <ConfirmDialog
          v-if="signedIn"
          :title="text.login.confirmSignOut"
          :description="text.login.signOutDescription"
          :cancel-label="text.login.cancel"
          :confirm-label="text.navigation.signOut"
          :pending-label="text.navigation.signingOut"
          :error-message="text.navigation.signOutError"
          :on-confirm="signOut"
        >
          <button type="button" :aria-label="text.navigation.signOut" :title="text.navigation.signOut" :class="controlClass">
            <LogOut :size="18" :stroke-width="1.75" aria-hidden="true" />
          </button>
        </ConfirmDialog>
        <AnimatedLink v-else to="/login" :aria-label="text.navigation.signIn" :title="text.navigation.signIn" :class="controlClass">
          <UserRound :size="18" :stroke-width="1.75" aria-hidden="true" />
        </AnimatedLink>
      </div>
    </div>
  </header>
</template>
