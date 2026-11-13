<script setup lang="ts">
import { useLanguage } from '../composables/useLanguage'

const { text } = useLanguage()
</script>

<template>
  <main class="flex flex-1 flex-col px-6 sm:px-10">
    <section class="mx-auto flex w-full max-w-6xl flex-1 flex-col justify-center py-12 sm:py-16" aria-labelledby="page-title">
      <div class="max-w-3xl">
        <p class="mb-4 text-xs uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">{{ text.home.eyebrow }}</p>
        <h1 id="page-title" class="font-bagel-fat-one text-5xl leading-[1.05] tracking-tight text-zinc-950 sm:text-7xl dark:text-zinc-50">
          {{ text.home.titleLine1 }}<br />{{ text.home.titleLine2 }}
        </h1>
        <p class="mt-6 text-base leading-7 text-zinc-600 sm:text-lg dark:text-zinc-300">{{ text.home.intro }}</p>
      </div>
    </section>
  </main>
</template>
