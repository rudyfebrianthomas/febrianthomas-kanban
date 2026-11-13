<script setup lang="ts">
import { Check, Copy, X } from '@lucide/vue'
import { motion, useReducedMotion } from 'motion-v'
import {
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogOverlay,
  DialogPortal,
  DialogRoot,
  DialogTitle,
} from 'reka-ui'
import { onUnmounted, ref, watch } from 'vue'
import { useLanguage } from '../composables/useLanguage'
import { type KanbanCard } from '../kanbanCard'
import { stageStyle } from '../kanbanStage'

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
const reducedMotion = useReducedMotion()
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
  const url = new URL('/commission', window.location.origin)
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
  <DialogRoot :open="Boolean(card)" @update:open="onOpenChange">
    <DialogPortal>
      <DialogOverlay class="fixed inset-0 z-60 bg-zinc-950/50" />
      <div class="pointer-events-none fixed inset-0 z-70 flex items-center justify-center p-4 sm:p-6">
        <DialogContent v-if="card" as-child>
          <motion.div
            data-lenis-prevent
            :initial="reducedMotion ? false : { opacity: 0, scale: 0.97, y: 8 }"
            :animate="{ opacity: 1, scale: 1, y: 0 }"
            :transition="{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }"
            class="surface-shadow pointer-events-auto max-h-[calc(100dvh-2rem)] w-full max-w-2xl overflow-y-auto rounded-3xl bg-white p-6 text-zinc-950 focus:outline-none sm:p-8 dark:bg-zinc-900 dark:text-zinc-50"
          >
            <div class="flex items-start justify-between gap-4">
              <div class="min-w-0">
                <span class="inline-flex rounded-full bg-zinc-100 px-3 py-1 text-xs text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
                  {{ text.home.commissionTypes[card.commissionType] }}
                </span>
                <DialogTitle class="mt-2.5 text-2xl font-bold tracking-tight sm:text-3xl">
                  {{ card.title }}
                </DialogTitle>
              </div>
              <DialogClose as-child>
                <button
                  type="button"
                  :aria-label="text.home.close"
                  class="flex size-11 shrink-0 items-center justify-center rounded-xl hover:bg-zinc-100 focus-visible:outline-2 focus-visible:outline-offset-2 dark:hover:bg-zinc-800"
                >
                  <X :size="20" aria-hidden="true" />
                </button>
              </DialogClose>
            </div>

            <img
              v-if="card.imageUrl"
              :src="card.imageUrl"
              :alt="card.title"
              class="mt-5 max-h-[55dvh] w-full rounded-2xl bg-zinc-100 object-contain dark:bg-zinc-800"
            />

            <DialogDescription class="mt-5 whitespace-pre-wrap text-base leading-7 text-zinc-600 dark:text-zinc-300">
              {{ card.description }}
            </DialogDescription>

            <div class="mt-5">
              <div class="flex items-center justify-between gap-2 text-xs text-zinc-600 dark:text-zinc-300">
                <span>{{ stageLabel }}</span>
                <span>{{ progress }}%</span>
              </div>
              <div
                role="progressbar"
                :aria-label="text.home.progressLabel"
                :aria-valuenow="progress"
                aria-valuemin="0"
                aria-valuemax="100"
                class="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800"
              >
                <div
                  :class="['h-full rounded-full transition-all duration-300', stageStyle(card.stageNumber).progressBar]"
                  :style="{ width: `${progress}%` }"
                />
              </div>
            </div>

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
          </motion.div>
        </DialogContent>
      </div>
    </DialogPortal>
  </DialogRoot>
</template>
