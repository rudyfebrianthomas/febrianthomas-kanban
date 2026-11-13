<script setup lang="ts">
import { motion, useReducedMotion, type TargetAndTransition } from 'motion-v'
import type { RouteLocationRaw } from 'vue-router'

defineProps<{
  to: RouteLocationRaw
  whileHover?: TargetAndTransition
  class?: string
}>()
const reducedMotion = useReducedMotion()
</script>

<template>
  <RouterLink v-slot="{ href, navigate, isExactActive }" :to="to" custom>
    <motion.a
      :href="href"
      :class="[$props.class, isExactActive ? 'text-zinc-950' : '']"
      :aria-current="isExactActive ? 'page' : undefined"
      :while-hover="reducedMotion ? undefined : whileHover ?? { y: -2 }"
      :transition="{ type: 'spring', duration: 0.3, bounce: 0.2 }"
      @click="navigate"
    ><slot /></motion.a>
  </RouterLink>
</template>
