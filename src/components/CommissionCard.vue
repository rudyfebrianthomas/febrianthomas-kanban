<script setup lang="ts">
import { ChevronLeft, ChevronRight, Pencil, Trash2 } from '@lucide/vue'
import { type CommissionType } from '../commissionStatus'
import { useLanguage } from '../composables/useLanguage'
import { stageStyle } from '../kanbanStage'
import ConfirmDialog from './ConfirmDialog.vue'

export interface DisplayCard {
  id: string
  stageNumber: string
  commissionType: CommissionType
  title: string
  description: string
  requestors: string[]
  imageUrl?: string
  createdAt?: string
  updatedAt?: string | null
}

const props = defineProps<{
  card: DisplayCard
  editable?: boolean
  dragging?: boolean
  canMovePrev?: boolean
  canMoveNext?: boolean
  stageLabel: string
  progress: number
  formattedDate: string
  onDelete?: () => Promise<void>
}>()

const emit = defineEmits<{
  detail: []
  edit: []
  movePrev: []
  moveNext: []
  dragstart: [event: DragEvent]
  dragend: []
}>()

const { text } = useLanguage()
</script>

<template>
  <article
    :draggable="editable"
    :class="[
      'relative rounded-2xl border-2 bg-white p-3.5 text-zinc-950 shadow-xs transition-opacity dark:bg-zinc-900 dark:text-zinc-50',
      stageStyle(props.card.stageNumber).cardBorder,
      editable ? 'cursor-grab active:cursor-grabbing' : '',
      dragging ? 'opacity-50' : '',
    ]"
    @dragstart="emit('dragstart', $event)"
    @dragend="emit('dragend')"
  >
    <button
      type="button"
      :aria-label="`${text.home.viewCardDetails}: ${card.title}`"
      class="absolute inset-0 z-0 cursor-pointer rounded-2xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900 dark:focus-visible:outline-zinc-100"
      @click="emit('detail')"
    />

    <div v-if="editable" class="relative z-10 mb-2 flex items-center justify-end gap-1">
      <button
        type="button"
        :disabled="!canMovePrev"
        :aria-label="`${text.home.moveStagePrev}: ${card.title}`"
        :title="text.home.moveStagePrev"
        class="flex size-7 items-center justify-center rounded-lg bg-zinc-100 text-zinc-700 hover:bg-zinc-200 disabled:opacity-35 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
        @click.stop="emit('movePrev')"
      >
        <ChevronLeft :size="14" aria-hidden="true" />
      </button>
      <button
        type="button"
        :disabled="!canMoveNext"
        :aria-label="`${text.home.moveStageNext}: ${card.title}`"
        :title="text.home.moveStageNext"
        class="flex size-7 items-center justify-center rounded-lg bg-zinc-100 text-zinc-700 hover:bg-zinc-200 disabled:opacity-35 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
        @click.stop="emit('moveNext')"
      >
        <ChevronRight :size="14" aria-hidden="true" />
      </button>
      <button
        type="button"
        :aria-label="`${text.home.editCard}: ${card.title}`"
        :title="text.home.editCard"
        class="flex size-7 items-center justify-center rounded-lg bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
        @click.stop="emit('edit')"
      >
        <Pencil :size="13" aria-hidden="true" />
      </button>
      <ConfirmDialog
        v-if="onDelete"
        :title="text.home.deleteCardTitle"
        :description="text.home.deleteCardDescription"
        :cancel-label="text.login.cancel"
        :confirm-label="text.home.deleteCard"
        :pending-label="text.home.deletingCard"
        :error-message="text.home.deleteCardError"
        :on-confirm="onDelete"
      >
        <button
          type="button"
          :aria-label="`${text.home.deleteCard}: ${card.title}`"
          :title="text.home.deleteCard"
          class="flex size-7 items-center justify-center rounded-lg bg-zinc-100 text-red-700 hover:bg-red-50 dark:bg-zinc-800 dark:text-red-300 dark:hover:bg-red-950"
          @click.stop
        >
          <Trash2 :size="13" aria-hidden="true" />
        </button>
      </ConfirmDialog>
    </div>

    <div class="pointer-events-none relative z-1">
      <img
        v-if="card.imageUrl"
        :src="card.imageUrl"
        :alt="card.title"
        draggable="false"
        class="mb-2.5 aspect-4/3 w-full rounded-xl bg-zinc-100 object-cover dark:bg-zinc-800"
      />
      <h2 class="text-sm">{{ card.title }}</h2>
      <p class="mt-1.5 inline-flex rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
        {{ text.home.commissionTypes[card.commissionType] }}
      </p>
      <p class="mt-1.5 line-clamp-3 text-xs leading-5 text-zinc-600 sm:text-sm dark:text-zinc-300">{{ card.description }}</p>
      <div class="mt-2.5">
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
          class="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800"
        >
          <div
            :class="['h-full rounded-full transition-all duration-300', stageStyle(props.card.stageNumber).progressBar]"
            :style="{ width: `${progress}%` }"
          />
        </div>
      </div>
      <div class="mt-2.5 flex flex-wrap gap-1.5">
        <span
          v-for="requestor in card.requestors"
          :key="requestor"
          class="rounded-full bg-orange-100 px-2.5 py-0.5 text-xs text-orange-800 dark:bg-zinc-800 dark:text-orange-200"
        >
          {{ requestor }}
        </span>
      </div>
      <p
        v-if="formattedDate"
        class="mt-2.5 border-t border-zinc-100 pt-2 text-[11px] text-zinc-500 dark:border-zinc-800 dark:text-zinc-400"
      >
        {{ card.updatedAt ? text.home.updatedAtLabel : text.home.createdAtLabel }}: {{ formattedDate }}
      </p>
    </div>
  </article>
</template>
