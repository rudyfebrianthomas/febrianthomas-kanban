<script setup lang="ts">
import { X } from '@lucide/vue'
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
import { computed, ref, watch } from 'vue'
import { useLanguage } from '../../composables/useLanguage'
import {
  type CommissionOfferBoard,
  OFFER_BOARD_STATUSES,
  OFFER_BOARD_STATUS_DOTS,
  type OfferBoardStatus,
} from '../../lib/commissionOffers'
import SelectField from '../ui/SelectField.vue'

const props = defineProps<{
  open: boolean
  mode: 'create' | 'edit' | 'copy'
  board: CommissionOfferBoard | null
  canSetActive: boolean
  saving: boolean
  error: string
}>()

const emit = defineEmits<{
  'update:open': [open: boolean]
  save: [payload: { title: string; description: string | null; status: OfferBoardStatus }]
}>()

const { text } = useLanguage()
const reducedMotion = useReducedMotion()

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

watch(
  () => [props.open, props.mode, props.board] as const,
  ([isOpen]) => {
    if (!isOpen) return
    validationError.value = ''
    if (props.mode === 'create' || !props.board) {
      titleInput.value = ''
      descriptionInput.value = ''
      statusInput.value = props.canSetActive ? 'active' : 'inactive'
      return
    }
    const isCopy = props.mode === 'copy'
    titleInput.value = isCopy
      ? `${props.board.title} (${text.value.setting.offers.copySuffix})`.slice(0, 120)
      : props.board.title
    descriptionInput.value = props.board.description ?? ''
    statusInput.value =
      isCopy && props.board.status === 'active' && !props.canSetActive
        ? 'inactive'
        : props.board.status
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
  if (statusInput.value === 'active' && !props.canSetActive) {
    validationError.value = text.value.setting.offers.maxActiveError
    return
  }
  validationError.value = ''
  const description = descriptionInput.value.trim() || null
  emit('save', { title, description, status: statusInput.value })
}
</script>

<template>
  <DialogRoot :open="open" @update:open="onOpenChange">
    <DialogPortal>
      <DialogOverlay class="fixed inset-0 z-50 bg-black/45 backdrop-blur-[2px]" />
      <DialogContent
        class="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 outline-none"
      >
        <motion.div
          data-lenis-prevent
          :initial="reducedMotion ? false : { opacity: 0, scale: 0.96 }"
          :animate="{ opacity: 1, scale: 1 }"
          :transition="reducedMotion ? { duration: 0 } : { duration: 0.16, ease: 'easeOut' }"
          class="surface-shadow max-h-[85dvh] overflow-y-auto rounded-2xl border border-zinc-200 bg-white p-6 text-zinc-950 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
        >
          <div class="flex items-start justify-between gap-4">
            <div>
              <DialogTitle class="text-lg font-bold">{{ dialogTitle }}</DialogTitle>
              <DialogDescription class="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                {{ dialogDescription }}
              </DialogDescription>
            </div>
            <DialogClose as-child>
              <button
                type="button"
                :disabled="saving"
                :aria-label="text.setting.close"
                class="inline-flex size-9 items-center justify-center rounded-lg text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 disabled:opacity-50 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
              >
                <X class="size-4" aria-hidden="true" />
              </button>
            </DialogClose>
          </div>

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
                class="min-h-11 w-full rounded-xl border border-zinc-300 bg-white px-4 text-sm text-zinc-950 outline-none focus:ring-2 focus:ring-zinc-900 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-50 dark:focus:ring-zinc-300"
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
                class="w-full rounded-xl border border-zinc-300 bg-white px-4 py-2.5 text-sm text-zinc-950 outline-none focus:ring-2 focus:ring-zinc-900 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-50 dark:focus:ring-zinc-300"
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
              <button
                type="submit"
                :disabled="saving"
                class="inline-flex min-h-11 items-center justify-center rounded-xl bg-zinc-900 px-4 py-2 text-sm text-white transition-colors hover:bg-zinc-700 disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
              >
                {{ saving ? text.setting.savingChanges : text.setting.saveChanges }}
              </button>
            </div>
          </form>
        </motion.div>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>
