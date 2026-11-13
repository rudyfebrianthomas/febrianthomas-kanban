<script setup lang="ts">
import { useLanguage } from '../composables/useLanguage'

const { text } = useLanguage()
</script>

<template>
  <main class="flex flex-1 flex-col px-6 sm:px-10">
    <section class="mx-auto flex w-full max-w-6xl flex-1 flex-col justify-center py-12 sm:py-16" aria-labelledby="page-title">
      <div class="max-w-3xl">
        <p class="mb-4 text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">{{ text.home.eyebrow }}</p>
        <h1 id="page-title" class="font-bagel-fat-one text-5xl leading-[1.05] tracking-tight text-zinc-950 sm:text-7xl dark:text-zinc-50">
          {{ text.home.titleLine1 }}<br />{{ text.home.titleLine2 }}
        </h1>
        <p class="mt-6 text-base leading-7 text-zinc-600 sm:text-lg dark:text-zinc-300">{{ text.home.intro }}</p>
      </div>
      <div class="surface-shadow mt-12 rounded-2xl border border-zinc-200 bg-white p-6 sm:mt-16 sm:p-7 dark:border-zinc-800 dark:bg-zinc-900">
        <div class="flex items-center justify-between gap-4 text-xs font-medium tracking-[0.12em] text-zinc-500 dark:text-zinc-400">
          <span>{{ text.home.boardHeading }}</span>
          <span class="tracking-normal text-sm text-zinc-500 dark:text-zinc-400">{{ text.home.comingSoon }}</span>
        </div>
        <div class="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3" :aria-label="text.home.stagesLabel">
          <div v-for="stage in text.home.stages" :key="stage.number" class="flex min-h-16 items-center gap-3 rounded-xl bg-zinc-100 px-4 py-3 text-base text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100">
            <span class="grid size-8 flex-none place-items-center rounded-full bg-zinc-200 text-xs font-medium text-zinc-700 dark:bg-zinc-700 dark:text-zinc-200">{{ stage.number }}</span>
            <span>{{ stage.label }}</span>
          </div>
        </div>
        <p class="mt-5 text-sm text-zinc-500 dark:text-zinc-400">{{ text.home.boardMessage }}</p>
      </div>
    </section>
  </main>
</template>
