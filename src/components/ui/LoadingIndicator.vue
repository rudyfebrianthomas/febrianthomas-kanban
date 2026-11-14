<script setup lang="ts">
defineProps<{
  label: string
}>()
</script>

<template>
  <span role="status" class="inline-flex items-center gap-3">
    <span aria-hidden="true" class="inline-flex items-center gap-1">
      <span class="loading-dot bg-orange-500" />
      <span class="loading-dot bg-pink-500" />
      <span class="loading-dot bg-sky-500" />
    </span>
    <span>{{ label }}</span>
  </span>
</template>
