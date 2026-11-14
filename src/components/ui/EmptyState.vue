<script setup lang="ts">
import { FileText } from '@lucide/vue'

withDefaults(
  defineProps<{
    title?: string
    description?: string
    variant?: 'page' | 'card'
    heading?: 'h2' | 'h3'
    as?: 'div' | 'li'
    compact?: boolean
    iconSize?: number
  }>(),
  {
    title: '',
    description: '',
    variant: 'page',
    heading: 'h2',
    as: 'div',
    compact: false,
    iconSize: undefined,
  },
)
</script>

<template>
  <component
    :is="as"
    :class="
      variant === 'page'
        ? 'flex min-h-72 flex-col items-center justify-center px-6 py-16 text-center'
        : compact
          ? 'flex flex-col items-center rounded-2xl border border-dashed border-zinc-300 px-4 py-8 text-center dark:border-zinc-700'
          : title
          ? 'flex min-h-64 flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-300 px-6 py-12 text-center dark:border-zinc-700'
          : 'flex flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-300 px-6 py-10 text-center dark:border-zinc-700'
    "
  >
    <span
      v-if="variant === 'page' || title || compact"
      aria-hidden="true"
      :class="[
        'flex items-center justify-center bg-orange-100 text-orange-700 dark:bg-zinc-800 dark:text-orange-300',
        compact ? 'size-10 rounded-xl' : variant === 'card' ? 'size-14 rounded-2xl' : 'size-16 rounded-2xl',
      ]"
    >
      <FileText :size="iconSize ?? (compact ? 18 : variant === 'card' ? 26 : 30)" />
    </span>

    <component
      :is="heading"
      v-if="title"
      :class="
        variant === 'card'
          ? 'mt-5 font-sniglet text-2xl font-bold text-zinc-950 dark:text-zinc-50'
          : 'mt-6 font-sniglet text-3xl font-bold text-zinc-950 dark:text-zinc-50'
      "
    >
      {{ title }}
    </component>

    <p
      v-if="description"
      :class="
        title
          ? variant === 'card'
            ? 'mt-2 max-w-sm text-sm leading-6 text-zinc-600 dark:text-zinc-300'
            : 'mt-3 max-w-sm leading-7 text-zinc-600 dark:text-zinc-300'
          : compact
            ? 'mt-2.5 text-sm text-zinc-500 dark:text-zinc-400'
            : 'text-sm text-zinc-500 dark:text-zinc-400'
      "
    >
      {{ description }}
    </p>

    <slot />
  </component>
</template>
