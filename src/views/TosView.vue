<script setup lang="ts">
import { ArrowLeft } from '@lucide/vue'
import TosSections from '../components/tos/TosSections.vue'
import { useLanguage } from '../composables/useLanguage'

const { text } = useLanguage()
</script>

<template>
  <main class="flex-1 px-6 sm:px-10">
    <section class="mx-auto w-full max-w-4xl py-12 sm:py-16" aria-labelledby="page-title">
      <p class="text-xs uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
        {{ text.tos.eyebrow }}
      </p>
      <h1
        id="page-title"
        class="mt-4 font-bagel-fat-one text-5xl leading-[1.05] tracking-tight text-zinc-950 sm:text-7xl dark:text-zinc-50"
      >
        {{ text.tos.title }}
      </h1>
      <p class="mt-5 max-w-2xl text-base leading-7 text-zinc-600 sm:text-lg dark:text-zinc-300">
        {{ text.tos.intro }}
      </p>
      <p class="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
        {{ text.tos.updated }}
      </p>

      <TosSections class="mt-10" />

      <div class="mt-10">
        <RouterLink
          to="/commission"
          class="inline-flex min-h-11 items-center gap-2 rounded-xl border border-zinc-300 px-5 py-2.5 text-sm text-zinc-700 transition-colors hover:bg-zinc-100 hover:text-zinc-950 focus-visible:outline-2 focus-visible:outline-offset-2 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-zinc-50"
        >
          <ArrowLeft :size="16" aria-hidden="true" />
          <span>{{ text.tos.backToBoard }}</span>
        </RouterLink>
      </div>
    </section>
  </main>
</template>
