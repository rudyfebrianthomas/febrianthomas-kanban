<script setup lang="ts">
import { motion, useReducedMotion } from 'motion-v'
import type { RouteLocationRaw } from 'vue-router'

defineProps<{ to: RouteLocationRaw }>()
const reducedMotion = useReducedMotion()
</script>

<template>
  <RouterLink v-slot="{ href, navigate, isExactActive }" :to="to" custom>
    <motion.a
      :href="href"
      :class="{ 'router-link-exact-active': isExactActive }"
      :aria-current="isExactActive ? 'page' : undefined"
      :while-hover="reducedMotion ? undefined : { y: -2 }"
      :transition="{ type: 'spring', duration: 0.25, bounce: 0.1 }"
      @click="navigate"
    ><slot /></motion.a>
  </RouterLink>
</template>
