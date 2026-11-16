<script setup lang="ts">
import SelectField, { type SelectOption } from './SelectField.vue'

defineProps<{
  selectId: string
  selectedText: string
  moveToLabel: string
  moveButtonLabel: string
  clearButtonLabel: string
  options: readonly SelectOption<string>[]
  targetBoardId: string
  busy: boolean
}>()

const emit = defineEmits<{
  'update:targetBoardId': [value: string]
  move: []
  clear: []
}>()
</script>

<template>
  <div
    class="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-orange-300 bg-orange-50/80 px-4 py-3 dark:border-orange-500/40 dark:bg-orange-950/30"
  >
    <span class="text-sm font-medium text-zinc-900 dark:text-zinc-100">
      {{ selectedText }}
    </span>
    <div class="flex flex-wrap items-center gap-2">
      <div class="min-w-44">
        <label :for="selectId" class="sr-only">{{ moveToLabel }}</label>
        <SelectField
          :id="selectId"
          :model-value="targetBoardId || options[0]?.value || ''"
          :options="options"
          :aria-label="moveToLabel"
          @update:model-value="(val) => emit('update:targetBoardId', val)"
        />
      </div>
      <button
        type="button"
        :disabled="busy"
        class="inline-flex min-h-10 items-center rounded-xl bg-zinc-900 px-3.5 py-2 text-xs font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        @click="emit('move')"
      >
        {{ moveButtonLabel }}
      </button>
      <button
        type="button"
        class="inline-flex min-h-10 items-center rounded-xl border border-zinc-300 bg-white px-3 py-2 text-xs text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
        @click="emit('clear')"
      >
        {{ clearButtonLabel }}
      </button>
    </div>
  </div>
</template>
