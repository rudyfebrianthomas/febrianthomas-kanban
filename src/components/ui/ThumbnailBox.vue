<script setup lang="ts">
import { FileText } from '@lucide/vue'

withDefaults(
  defineProps<{
    src?: string | null
    alt: string
    iconSize?: number
    imgClass?: string
    fallbackClass?: string
    draggable?: boolean
  }>(),
  {
    src: undefined,
    iconSize: 20,
    imgClass: '',
    fallbackClass: '',
    draggable: true,
  },
)
</script>

<template>
  <img
    v-if="src"
    :src="src"
    :alt="alt"
    :draggable="draggable"
    :class="imgClass"
  />
  <span
    v-else
    aria-hidden="true"
    :class="[
      'flex items-center justify-center bg-orange-100 text-orange-700 dark:bg-zinc-800 dark:text-orange-300',
      fallbackClass,
    ]"
  >
    <FileText :size="iconSize" />
  </span>
</template>
