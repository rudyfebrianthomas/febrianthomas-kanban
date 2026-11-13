<script setup lang="ts">
import { useLanguage } from '../composables/useLanguage'

const { language, setLanguage, text } = useLanguage()
</script>

<template>
  <button
    type="button"
    role="switch"
    :aria-checked="language === 'id'"
    :aria-label="text.navigation.changeLanguage"
    class="inline-flex min-h-11 items-center rounded-full text-sm font-normal focus-visible:outline-2 focus-visible:outline-offset-2"
    @click="setLanguage(language === 'en' ? 'id' : 'en')"
  >
    <span aria-hidden="true" class="flex rounded-full bg-zinc-200 p-1">
      <span :class="['rounded-full px-2 py-1', language === 'en' ? 'bg-white text-zinc-900' : 'text-zinc-700']">EN</span>
      <span :class="['rounded-full px-2 py-1', language === 'id' ? 'bg-white text-zinc-900' : 'text-zinc-700']">ID</span>
    </span>
  </button>
</template>
