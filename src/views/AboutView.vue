<script setup lang="ts">
import { computed } from 'vue'
import { motion, useReducedMotion } from 'motion-v'
import { useLanguage } from '../composables/useLanguage'
import { socials } from '../data/socials'

const { text } = useLanguage()
const reducedMotion = useReducedMotion()

interface AboutItem {
  name: string
  image: string
  details?: string[]
}

interface AboutSection {
  title: string
  items: AboutItem[]
}

const sections = computed<AboutSection[]>(() => [text.value.about.software, text.value.about.tools])
</script>

<template>
  <main class="flex-1 px-6 sm:px-10">
    <div class="mx-auto grid min-h-[calc(100svh-140px)] max-w-5xl content-center items-center gap-10 py-12 md:min-h-[calc(100svh-76px)] md:grid-cols-2 md:gap-16 md:py-16">
      <img src="/images/follow.gif" :alt="text.about.imageAlt" width="500" height="500" class="mx-auto aspect-square w-full max-w-md object-contain" />
      <div>
        <p class="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">{{ text.about.eyebrow }}</p>
        <h1 class="mt-5 font-bagel-fat-one text-6xl leading-none sm:text-8xl">{{ text.about.title }}</h1>
        <p class="mt-6 text-xl leading-8 text-zinc-800 dark:text-zinc-200">{{ text.about.description }}</p>
        <p class="mt-4 text-lg leading-8 text-zinc-600 dark:text-zinc-300">{{ text.about.details }}</p>
        <nav :aria-label="text.about.socialLabel" class="mt-8 flex flex-wrap gap-3">
          <motion.a
            v-for="(social, index) in socials"
            :key="social.name"
            :href="social.url"
            target="_blank"
            rel="noopener noreferrer"
            :aria-label="social.name"
            :title="social.name"
            :while-hover="reducedMotion ? undefined : { y: -4, rotate: index % 2 ? 8 : -8, scale: 1.12 }"
            :transition="{ type: 'spring', duration: 0.3, bounce: 0.2 }"
            :class="`inline-flex size-12 items-center justify-center rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 ${social.colorClass}`"
          >
            <svg aria-hidden="true" viewBox="0 0 24 24" class="size-6 fill-current"><path :d="social.icon.path" /></svg>
          </motion.a>
        </nav>
      </div>
    </div>

    <div class="mx-auto max-w-5xl pb-32 pt-8 sm:pb-40 sm:pt-12">
      <div class="flex flex-col gap-16 sm:gap-20">
        <section v-for="section in sections" :key="section.title">
          <h2 class="text-center font-bagel-fat-one text-4xl sm:text-5xl">{{ section.title }}</h2>
          <ul class="mt-8 flex flex-wrap justify-center gap-4">
            <li v-for="item in section.items" :key="item.name" class="flex min-h-44 w-44 max-w-full flex-col items-center justify-center gap-5 p-6 text-center text-lg text-zinc-900 sm:w-52 dark:text-zinc-100">
              <img :src="item.image" alt="" width="88" height="88" class="about-item-image size-22 object-contain" />
              <span class="wrap-break-words font-medium">{{ item.name }}</span>
              <ul v-if="item.details" class="-mt-2 space-y-1 text-sm leading-5 text-zinc-600 dark:text-zinc-300">
                <li v-for="detail in item.details" :key="detail">{{ detail }}</li>
              </ul>
            </li>
          </ul>
        </section>
      </div>

      <section id="support" class="mx-auto mt-24 max-w-3xl scroll-mt-24 text-center sm:mt-32">
        <h2 class="font-bagel-fat-one text-4xl sm:text-5xl">{{ text.about.donations.title }}</h2>
        <p class="mx-auto mt-5 max-w-md text-lg leading-8 text-zinc-600 dark:text-zinc-300">{{ text.about.donations.description }}</p>
        <div class="mt-8 flex flex-wrap justify-center gap-4">
          <motion.a
            v-for="donation in text.about.donations.items"
            :key="donation.name"
            :href="donation.url"
            target="_blank"
            rel="noopener noreferrer"
            :while-hover="reducedMotion ? undefined : { y: -3, scale: 1.04 }"
            :transition="{ type: 'spring', duration: 0.3, bounce: 0.2 }"
            class="inline-flex min-h-40 w-40 max-w-full flex-col items-center justify-center gap-3 rounded-2xl px-6 py-6 text-lg text-zinc-900 focus-visible:outline-2 focus-visible:outline-offset-4 dark:text-zinc-100"
          >
            <img :src="donation.image" alt="" width="80" height="80" class="size-20 object-contain" />
            <span>{{ donation.name }}</span>
          </motion.a>
        </div>
      </section>
    </div>
  </main>
</template>
