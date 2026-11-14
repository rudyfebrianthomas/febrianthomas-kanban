<script setup lang="ts">
import { motion, useReducedMotion } from 'motion-v'

withDefaults(
  defineProps<{
    type?: 'button' | 'submit' | 'reset'
    disabled?: boolean
  }>(),
  {
    type: 'button',
    disabled: false,
  },
)

const reducedMotion = useReducedMotion()
</script>

<template>
  <motion.button
    :type="type"
    :disabled="disabled"
    :while-tap="reducedMotion ? undefined : { scale: 0.98 }"
    :transition="{ duration: 0.14 }"
    class="inline-flex items-center justify-center rounded-xl bg-zinc-900 px-4 py-2 text-sm text-white transition-colors hover:bg-zinc-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300 dark:focus-visible:outline-zinc-100"
  >
    <slot />
  </motion.button>
</template>
