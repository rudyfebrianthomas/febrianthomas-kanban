<script setup lang="ts">
import { stageStyle } from '../../lib/kanbanStage'

withDefaults(
  defineProps<{
    stageNumber: string
    stageLabel: string
    progress: number
    progressLabel?: string
    barHeightClass?: string
  }>(),
  {
    progressLabel: '',
    barHeightClass: 'h-1.5',
  },
)
</script>

<template>
  <div>
    <div class="flex items-center justify-between gap-2 text-xs text-zinc-600 dark:text-zinc-300">
      <span>{{ stageLabel }}</span>
      <span>{{ progress }}%</span>
    </div>
    <div
      :role="progressLabel ? 'progressbar' : undefined"
      :aria-label="progressLabel || undefined"
      :aria-valuenow="progressLabel ? progress : undefined"
      :aria-valuemin="progressLabel ? 0 : undefined"
      :aria-valuemax="progressLabel ? 100 : undefined"
      :class="['mt-1.5 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800', barHeightClass]"
    >
      <div
        :class="['h-full rounded-full transition-all duration-300', stageStyle(stageNumber).progressBar]"
        :style="{ width: `${progress}%` }"
      />
    </div>
  </div>
</template>
