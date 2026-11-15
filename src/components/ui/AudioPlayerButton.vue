<script setup lang="ts">
import { useSound } from '@vueuse/sound'
import { motion, useReducedMotion } from 'motion-v'
import { onMounted, onUnmounted, ref } from 'vue'
import { useLanguage } from '../../composables/useLanguage'

const { text } = useLanguage()
const reducedMotion = useReducedMotion()

// Default to playing when the web app opens.
const isBgPlaying = ref(true)

const { play: playBg, pause: pauseBg, stop: stopBg, sound: bgSound } = useSound('/mp3/bg.mp3', {
  loop: true,
  volume: 0.4,
  onload: () => {
    if (isBgPlaying.value && !bgSound.value?.playing()) {
      playBg()
    }
  },
  onplay: () => {
    // Pause immediately if the user toggled off while audio unlock was pending.
    if (!isBgPlaying.value) {
      pauseBg()
    }
  },
})

const { play: playClick } = useSound('/mp3/click.wav')

function toggleBackgroundMusic() {
  if (isBgPlaying.value) {
    isBgPlaying.value = false
    pauseBg()
    return
  }

  isBgPlaying.value = true
  if (!bgSound.value?.playing()) {
    playBg()
  }
}

function handleGlobalClick() {
  playClick()
}

onMounted(() => {
  document.addEventListener('click', handleGlobalClick, { capture: true })
})

onUnmounted(() => {
  document.removeEventListener('click', handleGlobalClick, { capture: true })
  stopBg()
})
</script>

<template>
  <motion.button
    type="button"
    :aria-label="isBgPlaying ? text.site.pauseMusic : text.site.playMusic"
    :title="isBgPlaying ? text.site.pauseMusic : text.site.playMusic"
    :aria-pressed="isBgPlaying"
    :while-hover="reducedMotion ? undefined : { scale: 1.08 }"
    :while-tap="reducedMotion ? undefined : { scale: 0.94 }"
    :transition="{ type: 'spring', duration: 0.25, bounce: 0.2 }"
    class="fixed right-4 bottom-4 z-40 size-16 cursor-pointer rounded-2xl p-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900 sm:right-6 sm:bottom-6 sm:size-20 dark:focus-visible:outline-zinc-100"
    @click="toggleBackgroundMusic"
  >
    <img
      v-show="isBgPlaying"
      src="/images/mp3-play.gif"
      alt=""
      class="about-item-image size-full object-contain"
    />
    <img
      v-show="!isBgPlaying"
      src="/images/mp3-pause.gif"
      alt=""
      class="about-item-image size-full object-contain"
    />
  </motion.button>
</template>
