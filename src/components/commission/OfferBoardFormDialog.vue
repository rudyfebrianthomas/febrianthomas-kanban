<script setup lang="ts">
import { DialogClose } from 'reka-ui'
import { computed, ref, watch } from 'vue'
import { useLanguage } from '../../composables/useLanguage'
import {
  type CommissionOfferBoard,
  OFFER_BOARD_STATUSES,
  OFFER_BOARD_STATUS_DOTS,
  type OfferBoardStatus,
} from '../../lib/commissionOffers'
import { formatCopyTitle } from '../../lib/kanbanCard'
import BaseDialog from '../ui/BaseDialog.vue'
import SelectField from '../ui/SelectField.vue'
import LoadingIndicator from '../ui/LoadingIndicator.vue'
import MotionButton from '../ui/MotionButton.vue'

const props = defineProps<{
  open: boolean
  mode: 'create' | 'edit' | 'copy'
  board: CommissionOfferBoard | null
  draft?: { title: string; description: string; status: OfferBoardStatus } | null
  canSetActive: boolean
  canSetWaitlist: boolean
  saving: boolean
  error: string
}>()

const emit = defineEmits<{
  'update:open': [open: boolean]
  save: [payload: { title: string; description: string | null; status: OfferBoardStatus }]
}>()

const { text } = useLanguage()

const titleInput = ref('')
const descriptionInput = ref('')
const statusInput = ref<OfferBoardStatus>('inactive')
const validationError = ref('')

const statusOptions = computed(() =>
  OFFER_BOARD_STATUSES.map((statusOption) => ({
    value: statusOption,
    label: text.value.setting.offers.boardStatuses[statusOption],
    dotClass: OFFER_BOARD_STATUS_DOTS[statusOption],
  })),
)

const dialogTitle = computed(() => {
  if (props.mode === 'edit') return text.value.setting.offers.editBoardTitle
  if (props.mode === 'copy') return text.value.setting.offers.copyBoardTitle
  return text.value.setting.offers.createBoardTitle
})

const dialogDescription = computed(() => {
  if (props.mode === 'edit') return text.value.setting.offers.editBoardDescription
  if (props.mode === 'copy') return text.value.setting.offers.copyBoardDescription
  return text.value.setting.offers.createBoardDescription
})

const displayError = computed(() => validationError.value || props.error)

function isStatusSlotFull(status: OfferBoardStatus): boolean {
  if (status === 'active') return !props.canSetActive
  if (status === 'waitlist') return !props.canSetWaitlist
  return false
}

watch(
  () => [props.open, props.mode, props.board] as const,
  ([isOpen]) => {
    if (!isOpen) return
    validationError.value = ''
    if (props.draft) {
      titleInput.value = props.draft.title
      descriptionInput.value = props.draft.description
      statusInput.value = props.draft.status
      return
    }
    if (props.mode === 'create' || !props.board) {
      titleInput.value = ''
      descriptionInput.value = ''
      statusInput.value = props.canSetActive ? 'active' : props.canSetWaitlist ? 'waitlist' : 'inactive'
      return
    }
    const isCopy = props.mode === 'copy'
    titleInput.value = isCopy
      ? formatCopyTitle(props.board.title, text.value.setting.offers.copySuffix)
      : props.board.title
    descriptionInput.value = props.board.description ?? ''
    statusInput.value = isCopy && isStatusSlotFull(props.board.status) ? 'inactive' : props.board.status
  },
)

function onOpenChange(nextOpen: boolean) {
  if (props.saving) return
  emit('update:open', nextOpen)
}

function submit() {
  if (props.saving) return
  const title = titleInput.value.trim()
  if (!title) {
    validationError.value = text.value.setting.requiredTitle
    return
  }
  validationError.value = ''
  const description = descriptionInput.value.trim() || null
  emit('save', { title, description, status: statusInput.value })
}
</script>

<template>
  <BaseDialog
    :open="open"
    :title="dialogTitle"
    :description="dialogDescription"
    :close-label="text.setting.close"
    :close-disabled="saving"
    max-width-class="max-w-md"
    @update:open="onOpenChange"
  >
    <form class="mt-5 space-y-4" @submit.prevent="submit">
            <div>
              <label for="offer-board-title" class="mb-1.5 block text-sm text-zinc-800 dark:text-zinc-200">
                {{ text.setting.titleLabel }}
              </label>
              <input
                id="offer-board-title"
                v-model="titleInput"
                type="text"
                maxlength="120"
                required
                class="min-h-11 w-full rounded-xl border border-zinc-300 bg-white px-4 text-sm text-zinc-950 outline-hidden focus:ring-2 focus:ring-zinc-900 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-50 dark:focus:ring-zinc-300"
              />
            </div>

            <div>
              <label for="offer-board-description" class="mb-1.5 block text-sm text-zinc-800 dark:text-zinc-200">
                {{ text.setting.descriptionLabel }}
              </label>
              <textarea
                id="offer-board-description"
                v-model="descriptionInput"
                rows="2"
                maxlength="240"
                class="w-full rounded-xl border border-zinc-300 bg-white px-4 py-2.5 text-sm text-zinc-950 outline-hidden focus:ring-2 focus:ring-zinc-900 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-50 dark:focus:ring-zinc-300"
              />
            </div>

            <div>
              <label for="offer-board-status" class="mb-1.5 block text-sm text-zinc-800 dark:text-zinc-200">
                {{ text.setting.offers.boardStatusLabel }}
              </label>
              <SelectField
                id="offer-board-status"
                v-model="statusInput"
                :options="statusOptions"
              />
            </div>

            <p
              v-if="displayError"
              role="alert"
              class="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300"
            >
              {{ displayError }}
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
                <LoadingIndicator v-if="saving" :label="text.setting.savingChanges" />
                <template v-else>{{ text.setting.saveChanges }}</template>
              </MotionButton>
            </div>
    </form>
  </BaseDialog>
</template>
