<script setup lang="ts">
import TermsSections from '../components/terms/TermsSections.vue'
import { useLanguage } from '../composables/useLanguage'

const { text } = useLanguage()
</script>

<template>
  <main class="flex-1 px-6 sm:px-10">
    <section class="mx-auto w-full max-w-4xl py-20 sm:py-28" aria-labelledby="page-title">
      <div class="max-w-2xl">
        <p class="text-xs uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
          {{ text.tos.eyebrow }}
        </p>
        <h1
          id="page-title"
          class="mt-5 font-bagel-fat-one text-6xl leading-none text-zinc-950 sm:text-8xl dark:text-zinc-50"
        >
          {{ text.tos.title }}
        </h1>
        <p class="mt-6 text-lg leading-7 text-zinc-600 dark:text-zinc-300">
          {{ text.tos.intro }}
        </p>
        <p class="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
          {{ text.tos.updated }}
        </p>
      </div>

      <nav
        aria-label="Terms sections"
        class="mt-10 flex flex-wrap gap-2"
      >
        <a
          v-for="(section, index) in text.tos.sections"
          :key="section.id"
          :href="`#${section.id}`"
          class="inline-flex min-h-9 items-center gap-2 rounded-full border border-zinc-200 bg-white px-3.5 py-1 text-xs text-zinc-700 transition-colors hover:border-zinc-400 hover:text-zinc-950 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:border-zinc-600 dark:hover:text-zinc-50"
        >
          <span class="tabular-nums text-zinc-400 dark:text-zinc-500">{{ String(index + 1).padStart(2, '0') }}</span>
          <span>{{ section.title }}</span>
        </a>
      </nav>

      <TermsSections class="mt-8" />
    </section>
  </main>
</template>
