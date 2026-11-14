<script setup lang="ts">
import { useLanguage } from '../../composables/useLanguage'

withDefaults(
  defineProps<{
    compact?: boolean
  }>(),
  {
    compact: false,
  },
)

const { text } = useLanguage()
</script>

<template>
  <div :class="compact ? 'space-y-4' : 'space-y-6'">
    <section
      v-for="(section, index) in text.tos.sections"
      :id="compact ? undefined : section.id"
      :key="section.id"
      :class="[
        'scroll-mt-24 rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900',
        compact ? 'p-4' : 'surface-shadow p-6 sm:p-7',
      ]"
    >
      <div class="flex items-center gap-3">
        <span
          :class="[
            'inline-flex shrink-0 items-center justify-center rounded-lg bg-zinc-100 font-medium tabular-nums text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200',
            compact ? 'size-6 text-xs' : 'size-7 text-xs',
          ]"
        >
          {{ String(index + 1).padStart(2, '0') }}
        </span>
        <h2 :class="[compact ? 'text-base' : 'text-xl', 'font-bold text-zinc-950 dark:text-zinc-50']">
          {{ section.title }}
        </h2>
      </div>
      <ul
        :class="[
          'mt-2.5 list-disc space-y-1.5 pl-5 text-zinc-600 dark:text-zinc-300',
          compact ? 'text-sm leading-6' : 'mt-3 space-y-2 text-base leading-7',
        ]"
      >
        <li v-for="item in section.items" :key="item">
          {{ item }}
        </li>
      </ul>
    </section>
  </div>
</template>
