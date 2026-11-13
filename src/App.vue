<script setup lang="ts">
import Lenis from 'lenis'
import { motion, useReducedMotion } from 'motion-v'
import { onMounted, onUnmounted } from 'vue'
import FloatingShapes from './components/FloatingShapes.vue'
import SiteFooter from './components/SiteFooter.vue'
import SiteHeader from './components/SiteHeader.vue'

const reducedMotion = useReducedMotion()
let lenis: Lenis | undefined
let frame = 0

onMounted(() => {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
  lenis = new Lenis()
  const raf = (time: number) => {
    lenis?.raf(time)
    frame = requestAnimationFrame(raf)
  }
  frame = requestAnimationFrame(raf)
})

onUnmounted(() => {
  cancelAnimationFrame(frame)
  lenis?.destroy()
})
</script>

<template>
  <FloatingShapes />
  <SiteHeader />
  <RouterView v-slot="{ Component, route }">
    <motion.div
      :key="route.path"
      class="flex flex-1 flex-col"
      :initial="reducedMotion ? false : { opacity: 0, y: 16 }"
      :animate="{ opacity: 1, y: 0 }"
      :transition="{ duration: 5, ease: [0.23, 1, 0.32, 1] }"
    >
      <component :is="Component" />
    </motion.div>
  </RouterView>
  <SiteFooter />
</template>
