<script setup lang="ts">
import { motion, useMotionValue, useReducedMotion, useSpring } from 'motion-v'
import { onMounted, onUnmounted } from 'vue'

const paths = [
  ['translate3d(-55px, -60px, 0)', 'translate3d(130px, 65px, 0)', 'translate3d(-60px, 160px, 0)'],
  ['translate3d(75px, -60px, 0)', 'translate3d(-120px, 30px, 0)', 'translate3d(35px, 140px, 0)'],
  ['translate3d(-80px, 75px, 0)', 'translate3d(50px, -90px, 0)', 'translate3d(140px, 65px, 0)'],
]

const reducedMotion = useReducedMotion()
const pointerX = useMotionValue(0)
const pointerY = useMotionValue(0)
const x = useSpring(pointerX, { stiffness: 100, damping: 25 })
const y = useSpring(pointerY, { stiffness: 100, damping: 25 })

let preference: MediaQueryList | undefined

function reset() {
  pointerX.set(0)
  pointerY.set(0)
}

function move(event: PointerEvent) {
  if (!preference?.matches || event.pointerType !== 'mouse') return
  pointerX.set((event.clientX / window.innerWidth - 0.5) * 70)
  pointerY.set((event.clientY / window.innerHeight - 0.5) * 70)
}

onMounted(() => {
  preference = window.matchMedia('(prefers-reduced-motion: no-preference) and (hover: hover) and (pointer: fine)')
  window.addEventListener('pointermove', move, { passive: true })
  window.addEventListener('blur', reset)
  preference.addEventListener('change', reset)
})

onUnmounted(() => {
  window.removeEventListener('pointermove', move)
  window.removeEventListener('blur', reset)
  preference?.removeEventListener('change', reset)
})
</script>

<template>
  <div class="background-shapes" aria-hidden="true">
    <motion.div class="background-shapes-layer" :style="{ x, y }">
      <motion.span
        v-for="(_, index) in 24"
        :key="index"
        :initial="{ transform: paths[index % 3]![0] }"
        :animate="reducedMotion ? { transform: 'none' } : { transform: paths[index % 3]! }"
        :transition="reducedMotion ? { duration: 0 } : { duration: 12 + (index % 9), delay: -(index % 10), ease: 'easeInOut', repeat: Infinity, repeatType: 'reverse' }"
      />
    </motion.div>
  </div>
</template>
