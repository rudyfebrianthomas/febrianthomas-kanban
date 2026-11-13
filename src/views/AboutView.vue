<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { Image as ImageIcon } from '@lucide/vue'
import { siInstagram, siThreads, siTiktok, siTwitch, siX, siYoutube } from 'simple-icons'
import { motion, useReducedMotion } from 'motion-v'
import { useLanguage } from '../composables/useLanguage'
import { supabase } from '../supabase'

interface AboutItem {
  name: string
  image: string
  details?: string[]
}

interface AboutSection {
  title: string
  empty: string
  items: AboutItem[]
}

const supportButtonIds = ['streamlabs', 'saweria', 'kofi', 'trakteer'] as const
type ButtonId = (typeof supportButtonIds)[number]
type SupportStatus = Partial<Record<ButtonId, boolean>>

const { text } = useLanguage()
const reducedMotion = useReducedMotion()

const socials = computed(() => [
  {
    ...text.value.about.socials.instagram,
    icon: siInstagram,
    color: 'bg-pink-100 text-pink-700 dark:bg-pink-200 dark:text-pink-800',
  },
  {
    ...text.value.about.socials.threads,
    icon: siThreads,
    color: 'bg-zinc-200 text-zinc-950 dark:bg-zinc-100 dark:text-zinc-950',
  },
  {
    ...text.value.about.socials.twitter,
    icon: siX,
    color: 'bg-zinc-200 text-zinc-950 dark:bg-zinc-100 dark:text-zinc-950',
  },
  {
    ...text.value.about.socials.tiktok,
    icon: siTiktok,
    color: 'bg-cyan-100 text-zinc-950 dark:bg-cyan-200 dark:text-zinc-950',
  },
  {
    ...text.value.about.socials.youtube,
    icon: siYoutube,
    color: 'bg-red-100 text-red-700 dark:bg-red-200 dark:text-red-800',
  },
  {
    ...text.value.about.socials.twitch,
    icon: siTwitch,
    color: 'bg-violet-100 text-violet-700 dark:bg-violet-200 dark:text-violet-800',
  },
])

const sections = computed<AboutSection[]>(() => [text.value.about.software, text.value.about.tools])

const signedIn = ref(false)
const authSubscription = supabase?.auth.onAuthStateChange((_event, session) => {
  signedIn.value = !!session
})

const supportStatus = ref<SupportStatus | null>(
  supabase ? null : { streamlabs: true, saweria: true, kofi: true, trakteer: true },
)
const supportPending = ref<ButtonId | null>(null)
const supportError = ref(false)

let active = true

onMounted(() => {
  if (!supabase) return
  void (async () => {
    try {
      const [{ data: sessionData }, { data, error }] = await Promise.all([
        supabase.auth.getSession(),
        supabase.from('support_buttons').select('id,enabled'),
      ])
      if (!active) return
      signedIn.value = Boolean(sessionData.session)
      if (error) throw error
      supportStatus.value = Object.fromEntries(
        ((data ?? []) as Array<{ id: ButtonId; enabled: boolean }>).map((row) => [row.id, row.enabled]),
      )
    } catch {
      if (active) supportError.value = true
    }
  })()
})

onUnmounted(() => {
  active = false
  authSubscription?.data.subscription.unsubscribe()
})

async function toggleSupportButton(id: ButtonId, enabled: boolean) {
  if (!supabase || !signedIn.value) return
  supportPending.value = id
  supportError.value = false
  try {
    const { data, error } = await supabase
      .from('support_buttons')
      .update({ enabled })
      .eq('id', id)
      .select('id,enabled')
      .single()
    if (error || !data) throw error ?? new Error('Support button not updated')
    supportStatus.value = {
      ...(supportStatus.value ?? {}),
      [id]: (data as { enabled: boolean }).enabled,
    }
  } catch {
    supportError.value = true
  } finally {
    supportPending.value = null
  }
}

function onSupportToggle(id: ButtonId, event: Event) {
  const input = event.target as HTMLInputElement
  void toggleSupportButton(id, input.checked)
}

function visibleSupportButtons(status: SupportStatus): ButtonId[] {
  return supportButtonIds.filter((id) => signedIn.value || status[id] === true)
}
</script>

<template>
  <main class="flex-1 px-6 sm:px-10">
    <div class="mx-auto grid min-h-[calc(100svh-140px)] max-w-5xl content-center items-center gap-10 py-12 md:min-h-[calc(100svh-76px)] md:grid-cols-2 md:gap-16 md:py-16">
      <img :src="text.about.image" :alt="text.about.imageAlt" width="500" height="500" class="mx-auto aspect-square w-full max-w-md object-contain" />
      <div>
        <p class="text-xs uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">{{ text.about.eyebrow }}</p>
        <h1 class="mt-5 font-bagel-fat-one text-6xl leading-none sm:text-8xl">{{ text.about.title }}</h1>
        <p class="mt-6 text-xl leading-8 text-zinc-800 dark:text-zinc-200">{{ text.about.description }}</p>
        <p class="mt-4 text-lg leading-8 text-zinc-600 dark:text-zinc-300">{{ text.about.details }}</p>
        <nav :aria-label="text.about.socialLabel" class="mt-8 flex flex-wrap gap-3">
          <template v-for="(social, index) in socials" :key="social.name">
            <motion.a
              v-if="social.url"
              :href="social.url"
              target="_blank"
              rel="noopener noreferrer"
              :aria-label="social.name"
              :title="social.name"
              :while-hover="reducedMotion ? undefined : { y: -4, rotate: index % 2 ? 8 : -8, scale: 1.12 }"
              :transition="{ type: 'spring', duration: 0.3, bounce: 0.2 }"
              :class="`inline-flex size-12 items-center justify-center rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 ${social.color}`"
            >
              <svg aria-hidden="true" viewBox="0 0 24 24" class="size-6 fill-current"><path :d="social.icon.path" /></svg>
            </motion.a>
            <motion.span
              v-else
              role="img"
              :aria-label="`${social.name} — ${text.about.socialUnavailable}`"
              :title="social.name"
              :while-hover="reducedMotion ? undefined : { y: -4, rotate: index % 2 ? 8 : -8, scale: 1.12 }"
              :transition="{ type: 'spring', duration: 0.3, bounce: 0.2 }"
              :class="`inline-flex size-12 items-center justify-center rounded-full ${social.color}`"
            >
              <svg aria-hidden="true" viewBox="0 0 24 24" class="size-6 fill-current"><path :d="social.icon.path" /></svg>
            </motion.span>
          </template>
        </nav>
      </div>
    </div>

    <div class="mx-auto max-w-5xl pb-32 pt-8 sm:pb-40 sm:pt-12">
      <div class="flex flex-col gap-16 sm:gap-20">
        <section v-for="section in sections" :key="section.title">
          <h2 class="text-center font-bagel-fat-one text-4xl sm:text-5xl">{{ section.title }}</h2>
          <ul v-if="section.items.length > 0" class="mt-8 flex flex-wrap justify-center gap-4">
            <li v-for="item in section.items" :key="item.name" class="flex min-h-44 w-44 max-w-full flex-col items-center justify-center gap-5 p-6 text-center text-lg text-zinc-900 sm:w-52 dark:text-zinc-100">
              <img v-if="item.image" :src="item.image" alt="" width="88" height="88" class="about-item-image size-22 object-contain" />
              <span v-else aria-hidden="true" class="flex size-22 items-center justify-center text-zinc-400 dark:text-zinc-500">
                <ImageIcon :size="32" />
              </span>
              <span class="wrap-break-words">{{ item.name }}</span>
              <ul v-if="item.details" class="-mt-2 space-y-1 text-sm leading-5 text-zinc-600 dark:text-zinc-300">
                <li v-for="detail in item.details" :key="detail">{{ detail }}</li>
              </ul>
            </li>
          </ul>
          <p v-else class="mt-5 text-center text-lg leading-8 text-zinc-600 dark:text-zinc-300">{{ section.empty }}</p>
        </section>
      </div>

      <section id="support" class="mx-auto mt-24 max-w-3xl scroll-mt-24 text-center sm:mt-32">
        <h2 class="font-bagel-fat-one text-4xl sm:text-5xl">{{ text.about.donations.title }}</h2>
        <p class="mx-auto mt-5 max-w-md text-lg leading-8 text-zinc-600 dark:text-zinc-300">{{ text.about.donations.description }}</p>
        <p v-if="supportError" role="alert" class="mt-5 text-sm text-red-700 dark:text-red-300">{{ text.about.donations.settingsError }}</p>
        <div v-if="supportStatus" class="mt-8 flex flex-wrap justify-center gap-4">
          <div v-for="id in visibleSupportButtons(supportStatus)" :key="id" class="flex flex-col items-center gap-3">
            <motion.a
              v-if="(supportStatus[id] === true || signedIn) && text.about.donations[id].url"
              :href="text.about.donations[id].url"
              target="_blank"
              rel="noopener noreferrer"
              :while-hover="reducedMotion ? undefined : { y: -3, scale: 1.04 }"
              :transition="{ type: 'spring', duration: 0.3, bounce: 0.2 }"
              :class="[
                'inline-flex min-h-40 w-40 max-w-full flex-col items-center justify-center gap-3 rounded-2xl px-6 py-6 text-lg text-zinc-900 focus-visible:outline-2 focus-visible:outline-offset-4 dark:text-zinc-100',
                supportStatus[id] === true ? '' : 'opacity-60',
              ]"
            >
              <img
                v-if="text.about.donations[id].image"
                :src="text.about.donations[id].image"
                alt=""
                width="80"
                height="80"
                class="size-20 object-contain"
              />
              <span>{{ text.about.donations[id].name }}</span>
            </motion.a>
            <label v-if="signedIn" class="flex min-h-11 cursor-pointer items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
              <input
                type="checkbox"
                role="switch"
                :checked="supportStatus[id] === true"
                :disabled="supportPending !== null || supportStatus[id] === undefined"
                class="peer sr-only"
                @change="onSupportToggle(id, $event)"
              />
              <span
                aria-hidden="true"
                class="relative h-6 w-11 rounded-full bg-zinc-300 transition-colors peer-checked:bg-zinc-800 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-disabled:opacity-50 after:absolute after:left-1 after:top-1 after:size-4 after:rounded-full after:bg-white after:transition-transform peer-checked:after:translate-x-5 dark:bg-zinc-700 dark:peer-checked:bg-zinc-300 dark:peer-checked:after:bg-zinc-900"
              />
              <span>{{ text.about.donations[id].name }}: {{ supportStatus[id] === true ? text.about.donations.enabled : text.about.donations.disabled }}</span>
            </label>
          </div>
        </div>
      </section>
    </div>
  </main>
</template>
