<script setup lang="ts">
import { LogOut, UserRound } from '@lucide/vue'
import { useAuth } from '../../composables/useAuth'
import { useLanguage } from '../../composables/useLanguage'
import { supabase } from '../../lib/supabase'
import AnimatedLink from '../ui/AnimatedLink.vue'
import ConfirmDialog from '../ui/ConfirmDialog.vue'
import LanguageToggle from '../ui/LanguageToggle.vue'
import ThemeToggle from '../ui/ThemeToggle.vue'

const { text } = useLanguage()
const { signedIn } = useAuth()

async function signOut() {
  if (!supabase) return
  const { error } = await supabase.auth.signOut({ scope: 'local' })
  if (error) throw error
}

const controlClass = 'inline-flex size-11 items-center justify-center text-zinc-500 transition-colors hover:text-zinc-950 focus-visible:outline-2 focus-visible:outline-offset-4 dark:text-zinc-400 dark:hover:text-zinc-50'
const navLinkClass = 'inline-flex min-h-11 items-center whitespace-nowrap text-zinc-500 transition-colors hover:text-zinc-950 focus-visible:outline-2 focus-visible:outline-offset-4 dark:text-zinc-400 dark:hover:text-zinc-50'
const navActiveClass = 'font-semibold text-zinc-950 underline decoration-2 underline-offset-8 dark:text-zinc-50'
</script>

<template>
  <header class="sticky top-0 z-50 border-b border-zinc-200 bg-zinc-50 px-6 sm:px-10 dark:border-zinc-800 dark:bg-zinc-900">
    <div class="mx-auto flex max-w-6xl flex-col items-center gap-3 py-5 md:grid md:grid-cols-[1fr_auto_1fr] md:gap-4 md:py-4">
      <RouterLink to="/" class="inline-flex min-h-11 max-w-full items-center gap-2 self-start pr-32 font-sniglet text-lg text-zinc-950 focus-visible:outline-2 focus-visible:outline-offset-4 md:pr-0 dark:text-zinc-50">
        <img src="/images/lick.gif" alt="" width="32" height="32" class="size-8 shrink-0 object-contain" />
        <span class="truncate">{{ text.site.brand }}</span>
      </RouterLink>
      <nav :aria-label="text.navigation.label">
        <ul class="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-base sm:gap-x-6 lg:gap-x-7">
          <li><AnimatedLink to="/" :while-hover="{ y: -3, rotate: -4, scale: 1.08 }" :class="navLinkClass" :active-class="navActiveClass">{{ text.navigation.home }}</AnimatedLink></li>
          <li><AnimatedLink to="/queue" :while-hover="{ y: -3, rotate: 4, scale: 1.08 }" :class="navLinkClass" :active-class="navActiveClass">{{ text.navigation.board }}</AnimatedLink></li>
          <li><AnimatedLink to="/commissions" :while-hover="{ y: -3, rotate: -4, scale: 1.08 }" :class="navLinkClass" :active-class="navActiveClass">{{ text.navigation.request }}</AnimatedLink></li>
          <li v-if="signedIn"><AnimatedLink to="/boards" :while-hover="{ y: -3, rotate: 4, scale: 1.08 }" :class="navLinkClass" :active-class="navActiveClass">{{ text.navigation.manage }}</AnimatedLink></li>
          <li v-if="signedIn"><AnimatedLink to="/slots" :while-hover="{ y: -3, rotate: -4, scale: 1.08 }" :class="navLinkClass" :active-class="navActiveClass">{{ text.navigation.offers }}</AnimatedLink></li>
          <li><AnimatedLink to="/terms" :while-hover="{ y: -3, rotate: 4, scale: 1.08 }" :class="navLinkClass" :active-class="navActiveClass">{{ text.navigation.tos }}</AnimatedLink></li>
          <li><AnimatedLink to="/about" :while-hover="{ y: -3, rotate: -4, scale: 1.08 }" :class="navLinkClass" :active-class="navActiveClass">{{ text.navigation.about }}</AnimatedLink></li>
        </ul>
      </nav>
      <div class="absolute right-4 top-5 flex items-center gap-0 sm:gap-2 md:static md:justify-self-end">
        <LanguageToggle />
        <ThemeToggle />
        <template v-if="signedIn !== null">
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
        </template>
      </div>
    </div>
  </header>
</template>
