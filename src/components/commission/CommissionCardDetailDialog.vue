<script setup lang="ts">
import { Check, Copy } from '@lucide/vue'
import { DialogDescription, DialogTitle } from 'reka-ui'
import { onUnmounted, ref, watch } from 'vue'
import { useLanguage } from '../../composables/useLanguage'
import { type KanbanCard } from '../../lib/kanbanCard'
import BaseDialog from '../ui/BaseDialog.vue'
import StageProgressBar from './StageProgressBar.vue'

const props = defineProps<{
  card: KanbanCard | null
  includeBoardInLink?: boolean
  stageLabel: string
  progress: number
  formattedDate: string
}>()

const emit = defineEmits<{
  close: []
}>()

const { text } = useLanguage()
const copiedLink = ref(false)
let copyTimer: ReturnType<typeof setTimeout> | null = null

watch(
  () => props.card?.id,
  () => {
    copiedLink.value = false
  },
)

onUnmounted(() => {
  if (copyTimer) clearTimeout(copyTimer)
})

function onOpenChange(nextOpen: boolean) {
  if (!nextOpen) emit('close')
}

async function copyLink() {
  if (!props.card) return
  const url = new URL('/queue', window.location.origin)
  url.searchParams.set('card', props.card.id)
  if (props.includeBoardInLink) url.searchParams.set('board', props.card.boardId)
  try {
    await navigator.clipboard.writeText(url.toString())
    copiedLink.value = true
    if (copyTimer) clearTimeout(copyTimer)
    copyTimer = setTimeout(() => {
      copiedLink.value = false
    }, 2000)
  } catch {
    copiedLink.value = false
  }
}
</script>

<template>
  <BaseDialog
    :open="Boolean(card)"
    :close-label="text.home.close"
    max-width-class="max-w-2xl"
    @update:open="onOpenChange"
  >
    <template #header>
      <template v-if="card">
        <span class="inline-flex rounded-full bg-zinc-100 px-3 py-1 text-xs text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
          {{ text.home.commissionTypes[card.commissionType] }}
        </span>
        <DialogTitle class="mt-2.5 text-2xl font-bold tracking-tight sm:text-3xl">
          {{ card.title }}
        </DialogTitle>
      </template>
    </template>

    <template v-if="card">
      <img
        v-if="card.imageUrl"
        :src="card.imageUrl"
        :alt="card.title"
        class="mt-5 max-h-[55dvh] w-full rounded-2xl bg-zinc-100 object-contain dark:bg-zinc-800"
      />

      <DialogDescription class="mt-5 whitespace-pre-wrap text-base leading-7 text-zinc-600 dark:text-zinc-300">
        {{ card.description }}
      </DialogDescription>

      <StageProgressBar
        :stage-number="card.stageNumber"
        :stage-label="stageLabel"
        :progress="progress"
        :progress-label="text.home.progressLabel"
        bar-height-class="h-2"
        class="mt-5"
      />

      <div class="mt-5 flex flex-wrap gap-2">
        <span
          v-for="requestor in card.requestors"
          :key="requestor"
          class="rounded-full bg-orange-100 px-3 py-1 text-xs text-orange-800 dark:bg-zinc-800 dark:text-orange-200"
        >
          {{ requestor }}
        </span>
      </div>

      <div class="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-zinc-200 pt-4 dark:border-zinc-800">
        <p v-if="formattedDate" class="text-xs text-zinc-500 dark:text-zinc-400">
          {{ card.updatedAt ? text.home.updatedAtLabel : text.home.createdAtLabel }}: {{ formattedDate }}
        </p>
        <button
          type="button"
          class="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-zinc-300 px-3.5 py-2 text-xs text-zinc-800 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
          @click="copyLink"
        >
          <Check v-if="copiedLink" :size="14" aria-hidden="true" />
          <Copy v-else :size="14" aria-hidden="true" />
          <span>{{ copiedLink ? text.home.copiedCardLink : text.home.copyCardLink }}</span>
        </button>
      </div>
    </template>
  </BaseDialog>
</template>
