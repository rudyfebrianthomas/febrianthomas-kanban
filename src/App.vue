<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'

const shapes = ref<HTMLElement | null>(null)
let frame = 0
let motionPreference: MediaQueryList | undefined

function resetPosition() {
  cancelAnimationFrame(frame)
  if (shapes.value) shapes.value.style.transform = ''
}

function moveShapes(event: PointerEvent) {
  if (!motionPreference?.matches || event.pointerType !== 'mouse') return
  cancelAnimationFrame(frame)
  const x = (event.clientX / window.innerWidth - 0.5) * 24
  const y = (event.clientY / window.innerHeight - 0.5) * 24
  frame = requestAnimationFrame(() => {
    if (shapes.value) shapes.value.style.transform = `translate3d(${x}px, ${y}px, 0)`
  })
}

function preferenceChanged() {
  if (!motionPreference?.matches) {
    resetPosition()
  }
}

onMounted(() => {
  motionPreference = window.matchMedia('(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)')
  motionPreference.addEventListener('change', preferenceChanged)
  window.addEventListener('pointermove', moveShapes, { passive: true })
  document.documentElement.addEventListener('pointerleave', resetPosition)
})
onUnmounted(() => {
  cancelAnimationFrame(frame)
  motionPreference?.removeEventListener('change', preferenceChanged)
  window.removeEventListener('pointermove', moveShapes)
  document.documentElement.removeEventListener('pointerleave', resetPosition)
})
</script>

<template>
  <div ref="shapes" class="floating-shapes" aria-hidden="true">
    <span class="floating-shape shape-circle"></span>
    <span class="floating-shape shape-rectangle"></span>
    <span class="floating-shape shape-triangle"></span>
    <span class="floating-shape shape-diamond"></span>
    <span class="floating-shape shape-circle-two"></span>
    <span class="floating-shape shape-rectangle-two"></span>
    <span class="floating-shape shape-triangle-two"></span>
    <span class="floating-shape shape-diamond-two"></span>
  </div>
  <RouterView />
</template>
