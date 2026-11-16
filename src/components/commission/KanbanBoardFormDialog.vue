<script setup lang="ts">
import { DialogClose } from 'reka-ui'
import { computed, ref, watch } from 'vue'
import { useLanguage } from '../../composables/useLanguage'
import { type KanbanBoard } from '../../lib/kanbanBoard'
import { formatCopyTitle } from '../../lib/kanbanCard'
import BaseDialog from '../ui/BaseDialog.vue'
import LoadingIndicator from '../ui/LoadingIndicator.vue'
import MotionButton from '../ui/MotionButton.vue'

const props = defineProps<{
  open: boolean
  editingBoard: KanbanBoard | null
  copySourceBoard: KanbanBoard | null
  saving: boolean
  error: string
}>()

const emit = defineEmits<{
  'update:open': [open: boolean]
  save: [payload: { title: string; description: string | null }]
}>()

const { text } = useLanguage()

const titleInput = ref('')
const descriptionInput = ref('')

const dialogTitle = computed(() => {
  if (props.editingBoard) return text.value.setting.editBoardTitle
  if (props.copySourceBoard) return text.value.setting.copyBoardTitle
  return text.value.setting.createBoardTitle
})

const dialogDescription = computed(() => {
  if (props.editingBoard) return text.value.setting.editBoardDescription
  if (props.copySourceBoard) return text.value.setting.copyBoardDescription
  return text.value.setting.createBoardDescription
})

watch(
  () => [props.open, props.editingBoard, props.copySourceBoard] as const,
  ([isOpen]) => {
    if (!isOpen) {
      titleInput.value = ''
      descriptionInput.value = ''
      return
    }
    if (props.editingBoard) {
      titleInput.value = props.editingBoard.title
      descriptionInput.value = props.editingBoard.description ?? ''
    } else if (props.copySourceBoard) {
      titleInput.value = formatCopyTitle(
        props.copySourceBoard.title,
        text.value.setting.offers.copySuffix,
      )
      descriptionInput.value = props.copySourceBoard.description ?? ''
    } else {
      titleInput.value = ''
      descriptionInput.value = ''
    }
  },
)

function onOpenChange(nextOpen: boolean) {
  if (props.saving) return
  emit('update:open', nextOpen)
}

function submit() {
  if (props.saving) return
  emit('save', {
    title: titleInput.value.trim(),
    description: descriptionInput.value.trim() || null,
  })
}
</script>

<template>
  <BaseDialog
    :open="open"
    :title="dialogTitle"
    :description="dialogDescription"
    :close-label="text.setting.close"
    :close-disabled="saving"
    @update:open="onOpenChange"
  >
    <form class="mt-5 space-y-4" @submit.prevent="submit">
      <div>
        <label
          for="board-title"
          class="mb-1.5 block text-sm text-zinc-800 dark:text-zinc-200"
        >
          {{ text.setting.titleLabel }}
        </label>
        <input
          id="board-title"
          v-model="titleInput"
          type="text"
          maxlength="120"
          required
          class="min-h-11 w-full rounded-xl border border-zinc-300 bg-white px-4 text-sm text-zinc-950 outline-hidden focus:ring-2 focus:ring-zinc-900 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-50 dark:focus:ring-zinc-300"
        />
      </div>

      <div>
        <label
          for="board-description"
          class="mb-1.5 block text-sm text-zinc-800 dark:text-zinc-200"
        >
          {{ text.setting.descriptionLabel }}
        </label>
        <textarea
          id="board-description"
          v-model="descriptionInput"
          rows="3"
          maxlength="240"
          class="w-full rounded-xl border border-zinc-300 bg-white px-4 py-2.5 text-sm text-zinc-950 outline-hidden focus:ring-2 focus:ring-zinc-900 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-50 dark:focus:ring-zinc-300"
        />
      </div>

      <p
        v-if="error"
        role="alert"
        class="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300"
      >
        {{ error }}
      </p>

      <div class="flex justify-end gap-2 pt-1">
        <DialogClose as-child>
          <button
            type="button"
            :disabled="saving"
            class="inline-flex min-h-11 items-center justify-center rounded-xl border border-zinc-300 px-4 py-2 text-sm text-zinc-700 transition-colors hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            {{ text.setting.close }}
          </button>
        </DialogClose>
        <MotionButton
          type="submit"
          :disabled="saving"
          class="min-h-11"
        >
          <LoadingIndicator
            v-if="saving"
            :label="
              editingBoard
                ? text.setting.savingChanges
                : copySourceBoard
                  ? text.setting.savingCopyBoard
                  : text.setting.savingBoard
            "
          />
          <template v-else>
            {{
              editingBoard
                ? text.setting.saveChanges
                : copySourceBoard
                  ? text.setting.submitCopyBoard
                  : text.setting.submitBoard
            }}
          </template>
        </MotionButton>
      </div>
    </form>
  </BaseDialog>
</template>
