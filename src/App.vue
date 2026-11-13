<script setup lang="ts">
import Lenis from 'lenis'
import { onMounted, onUnmounted } from 'vue'
import FloatingShapes from './components/FloatingShapes.vue'
import SiteFooter from './components/SiteFooter.vue'
import SiteHeader from './components/SiteHeader.vue'

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
  <RouterView />
  <SiteFooter />
</template>
