<script setup lang="ts">
const year = new Date().getFullYear()
</script>

<template>
  <footer class="border-t border-zinc-200 px-6 sm:px-10">
    <div class="mx-auto max-w-6xl py-6 text-center sm:text-left">
      <div class="flex w-full flex-col items-center gap-4 sm:flex-row sm:justify-between">
        <span class="text-sm text-zinc-500">© {{ year }} febrianthomas</span>
        <span class="text-sm text-zinc-500">Commission progress</span>
      </div>
    </div>
  </footer>
</template>
