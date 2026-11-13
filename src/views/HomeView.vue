<script setup lang="ts">
import { motion, useReducedMotion } from 'motion-v'
import { onUnmounted, ref } from 'vue'
import { useLanguage } from '../composables/useLanguage'

const { text } = useLanguage()
const reducedMotion = useReducedMotion()
const greeting = ref(false)
let timer: ReturnType<typeof setTimeout> | null = null

function sayHi() {
  if (timer) clearTimeout(timer)
  greeting.value = true
  timer = setTimeout(() => {
    greeting.value = false
  }, 2000)
}

onUnmounted(() => {
  if (timer) clearTimeout(timer)
})
</script>

<template>
  <main class="flex flex-1 flex-col px-6 sm:px-10">
    <section class="mx-auto flex w-full max-w-6xl flex-1 flex-col justify-center py-12 sm:py-16" aria-labelledby="page-title">
      <div class="grid w-full items-center gap-10 md:grid-cols-[minmax(0,1fr)_auto] md:gap-12">
        <div class="max-w-3xl">
          <p class="mb-4 text-xs uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">{{ text.home.eyebrow }}</p>
          <h1 id="page-title" class="font-bagel-fat-one text-5xl leading-[1.05] tracking-tight text-zinc-950 sm:text-7xl dark:text-zinc-50">
            {{ text.home.titleLine1 }}<br />{{ text.home.titleLine2 }}
          </h1>
          <p class="mt-6 text-base leading-7 text-zinc-600 sm:text-lg dark:text-zinc-300">{{ text.home.intro }}</p>
        </div>

        <div class="relative mx-auto w-full max-w-64 sm:max-w-96 md:mx-0 md:justify-self-end">
          <motion.button
            type="button"
            :aria-label="text.home.greetingButton"
            :while-hover="reducedMotion ? undefined : { scale: 1.05 }"
            :transition="{ type: 'spring', duration: 0.3, bounce: 0.2 }"
            class="block w-full cursor-pointer rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4"
            @click="sayHi"
          >
            <img v-show="!greeting" src="/images/hero-1.png" alt="" class="h-auto w-full" />
            <img v-show="greeting" src="/images/hero-2.png" alt="" class="h-auto w-full" />
          </motion.button>
          <span role="status" class="pointer-events-none absolute left-3 top-32">
            <motion.span
              v-if="greeting"
              :initial="reducedMotion ? false : { opacity: 0, scale: 0.9, y: 5 }"
              :animate="{ opacity: 1, scale: 1, y: 0 }"
              :transition="{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }"
              class="relative block origin-bottom-right rounded-2xl border-2 border-zinc-900 bg-white px-8 py-4 text-2xl text-zinc-900 shadow-sm after:absolute after:-right-2 after:bottom-3 after:size-3 after:rotate-45 after:border-t-2 after:border-r-2 after:border-zinc-900 after:bg-white dark:border-zinc-100 dark:bg-zinc-800 dark:text-zinc-50 dark:after:border-zinc-100 dark:after:bg-zinc-800"
            >
              {{ text.home.greeting }}
            </motion.span>
          </span>
        </div>
      </div>
    </section>
  </main>
</template>
