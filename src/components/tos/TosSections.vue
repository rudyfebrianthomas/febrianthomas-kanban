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
      v-for="section in text.tos.sections"
      :key="section.id"
      :class="[
        'rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900',
        compact ? 'p-4' : 'surface-shadow p-6',
      ]"
    >
      <h2 :class="[compact ? 'text-base' : 'text-xl', 'font-bold text-zinc-950 dark:text-zinc-50']">
        {{ section.title }}
      </h2>
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
