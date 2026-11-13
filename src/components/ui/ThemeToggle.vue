<script setup lang="ts">
import { Moon, Sun } from '@lucide/vue'
import { onMounted, ref } from 'vue'
import { useLanguage } from '../../composables/useLanguage'

const { text } = useLanguage()
const dark = ref(false)

onMounted(() => {
  dark.value = document.documentElement.classList.contains('dark')
})

function toggleTheme() {
  const nextDark = !document.documentElement.classList.contains('dark')
  document.documentElement.classList.toggle('dark', nextDark)
  dark.value = nextDark
  try {
    localStorage.setItem('theme', nextDark ? 'dark' : 'light')
  } catch {
    // Storage may be unavailable.
  }
}
</script>

<template>
  <button
    type="button"
    role="switch"
    :aria-checked="dark"
    :aria-label="text.navigation.darkTheme"
    class="inline-flex h-11 items-center rounded-full focus-visible:outline-2 focus-visible:outline-offset-2"
    @click="toggleTheme"
  >
    <span aria-hidden="true" class="flex h-8 w-14 items-center rounded-full bg-zinc-200 p-1 dark:bg-zinc-700">
      <span :class="['flex size-6 items-center justify-center rounded-full bg-white text-zinc-700 shadow-sm transition-transform', dark ? 'translate-x-6' : '']">
        <Moon v-if="dark" :size="14" />
        <Sun v-else :size="14" />
      </span>
    </span>
  </button>
</template>
