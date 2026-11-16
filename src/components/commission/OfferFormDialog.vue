<script setup lang="ts">
import { DialogClose } from 'reka-ui'
import { computed, ref, watch } from 'vue'
import { useLanguage } from '../../composables/useLanguage'
import { OFFER_SELECT_COLUMNS } from '../../constants/commission'
import {
  type CommissionOffer,
  type CommissionOfferRow,
  toCommissionOffer,
} from '../../lib/commissionOffers'
import { COMMISSION_TYPES, type CommissionType } from '../../lib/commissionStatus'
import { formatCopyTitle } from '../../lib/kanbanCard'
import {
  removeKanbanImages,
  resolveOfflineImageUrl,
  uploadKanbanImage,
} from '../../lib/kanbanImage'
import { supabase } from '../../lib/supabase'
import BaseDialog from '../ui/BaseDialog.vue'
import ImageUploadField from '../ui/ImageUploadField.vue'
import LoadingIndicator from '../ui/LoadingIndicator.vue'
import MotionButton from '../ui/MotionButton.vue'
import SelectField from '../ui/SelectField.vue'

const props = defineProps<{
  boardId: string
  offer: CommissionOffer | null
  templateOffer: CommissionOffer | null
  nextSortOrder: number
}>()

const open = defineModel<boolean>('open', { required: true })

const emit = defineEmits<{
  saved: [offer: CommissionOffer, isEdit: boolean]
}>()

const { text } = useLanguage()

const typeInput = ref<CommissionType>('Illustration')
const titleInput = ref('')
const priceUsdInput = ref<number | string>('')
const priceIdrInput = ref<number | string>('')
const maxRequestsInput = ref<number | string>('')
const descriptionInput = ref('')
const openInput = ref(true)
const imageFile = ref<File | null>(null)
const removeExistingImage = ref(false)
const imageError = ref('')
const saving = ref(false)
const formError = ref('')

const commissionTypeOptions = computed(() =>
  COMMISSION_TYPES.map((typeOption) => ({
    value: typeOption,
    label: text.value.home.commissionTypes[typeOption],
  })),
)

const dialogTitle = computed(() => {
  if (props.offer) return text.value.setting.offers.editTitle
  if (props.templateOffer) return text.value.setting.offers.copyTitle
  return text.value.setting.offers.createTitle
})

const dialogDescription = computed(() => {
  if (props.offer) return text.value.setting.offers.editDescription
  if (props.templateOffer) return text.value.setting.offers.copyDescription
  return text.value.setting.offers.createDescription
})

function resetImageState() {
  imageFile.value = null
  removeExistingImage.value = false
  imageError.value = ''
}

function resetForm() {
  const source = props.offer ?? props.templateOffer
  const isCopy = !props.offer && Boolean(props.templateOffer)
  typeInput.value = source?.commissionType ?? 'Illustration'
  titleInput.value = source
    ? isCopy
      ? formatCopyTitle(source.title, text.value.setting.offers.copySuffix)
      : source.title
    : ''
  priceUsdInput.value = source?.priceUsd ?? ''
  priceIdrInput.value = source?.priceIdr ?? ''
  maxRequestsInput.value = source?.maxRequests ?? ''
  descriptionInput.value = source?.description ?? ''
  openInput.value = source?.isOpen ?? true
  resetImageState()
  formError.value = ''
}

watch(open, (isOpen) => {
  if (isOpen) {
    resetForm()
  } else {
    resetImageState()
    formError.value = ''
  }
})

function onOpenChange(nextOpen: boolean) {
  if (saving.value) return
  open.value = nextOpen
}

function parseNonNegativePrice(rawInput: number | string): number | null {
  const raw = String(rawInput ?? '').trim()
  if (!/^\d+(\.\d+)?$/.test(raw)) return null
  const value = Number(raw)
  return Number.isFinite(value) && value >= 0 ? value : null
}

function parseOptionalPositiveInt(rawInput: number | string): number | null | 'invalid' {
  const raw = String(rawInput ?? '').trim()
  if (!raw) return null
  if (!/^\d+$/.test(raw)) return 'invalid'
  const value = Number(raw)
  return Number.isInteger(value) && value >= 1 ? value : 'invalid'
}

async function saveOffer() {
  if (saving.value || imageError.value) return
  const title = titleInput.value.trim()
  const rawUsd = String(priceUsdInput.value ?? '').trim()
  const rawIdr = String(priceIdrInput.value ?? '').trim()
  const description = descriptionInput.value.trim()
  if (!title || !rawUsd || !rawIdr || !description) {
    formError.value = text.value.setting.offers.requiredFields
    return
  }

  const priceUsd = parseNonNegativePrice(rawUsd)
  const priceIdr = parseNonNegativePrice(rawIdr)
  if (priceUsd === null || priceIdr === null) {
    formError.value = text.value.setting.offers.invalidPrice
    return
  }

  const maxRequests = parseOptionalPositiveInt(maxRequestsInput.value)
  if (maxRequests === 'invalid') {
    formError.value = text.value.setting.offers.invalidMaxRequests
    return
  }
  const roundedIdr = Math.round(priceIdr)

  saving.value = true
  formError.value = ''
  try {
    const editing = props.offer
    const boardId = editing?.boardId ?? props.boardId
    if (!boardId) throw new Error('Missing board')

    if (!supabase) {
      if (editing) {
        emit(
          'saved',
          {
            ...editing,
            commissionType: typeInput.value,
            title,
            priceUsd,
            priceIdr: roundedIdr,
            description,
            imageUrl: resolveOfflineImageUrl(
              editing.imageUrl,
              imageFile.value,
              removeExistingImage.value,
              true,
            ),
            isOpen: openInput.value,
            maxRequests,
          },
          true,
        )
      } else {
        const inheritedTemplate = removeExistingImage.value ? null : props.templateOffer
        emit(
          'saved',
          {
            id: crypto.randomUUID(),
            boardId,
            commissionType: typeInput.value,
            title,
            priceUsd,
            priceIdr: roundedIdr,
            description,
            imagePath: inheritedTemplate?.imagePath ?? null,
            imageUrl: resolveOfflineImageUrl(
              inheritedTemplate?.imageUrl,
              imageFile.value,
              removeExistingImage.value,
            ),
            isOpen: openInput.value,
            sortOrder: props.nextSortOrder,
            maxRequests,
            requestCount: 0,
          },
          false,
        )
      }
      open.value = false
      return
    }

    let uploadedPath: string | null = null
    if (imageFile.value) {
      uploadedPath = await uploadKanbanImage(imageFile.value)
    }

    if (editing) {
      const oldImagePath = editing.imagePath
      const nextImagePath = uploadedPath ?? (removeExistingImage.value ? null : oldImagePath)
      const { data, error } = await supabase
        .from('commission_offers')
        .update({
          commission_type: typeInput.value,
          title,
          price: String(priceUsd),
          price_usd: priceUsd,
          price_idr: roundedIdr,
          description,
          image_path: nextImagePath,
          is_open: openInput.value,
          max_requests: maxRequests,
        })
        .eq('id', editing.id)
        .select(OFFER_SELECT_COLUMNS)
        .single()
      if (error || !data) throw error
      if (uploadedPath || removeExistingImage.value) {
        await removeKanbanImages([oldImagePath])
      }
      emit('saved', toCommissionOffer(data as CommissionOfferRow), true)
    } else {
      const copiedImagePath =
        uploadedPath ?? (removeExistingImage.value ? null : (props.templateOffer?.imagePath ?? null))
      const { data, error } = await supabase
        .from('commission_offers')
        .insert({
          board_id: boardId,
          commission_type: typeInput.value,
          title,
          price: String(priceUsd),
          price_usd: priceUsd,
          price_idr: roundedIdr,
          description,
          image_path: copiedImagePath,
          is_open: openInput.value,
          sort_order: props.nextSortOrder,
          max_requests: maxRequests,
        })
        .select(OFFER_SELECT_COLUMNS)
        .single()
      if (error || !data) throw error
      emit('saved', toCommissionOffer(data as CommissionOfferRow), false)
    }
    open.value = false
  } catch {
    formError.value = text.value.setting.offers.saveError
  } finally {
    saving.value = false
  }
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
    <form class="mt-5 space-y-4" @submit.prevent="saveOffer">
      <div>
        <label for="offer-type" class="mb-1.5 block text-sm text-zinc-800 dark:text-zinc-200">
          {{ text.home.commissionTypeLabel }}
        </label>
        <SelectField
          id="offer-type"
          v-model="typeInput"
          :options="commissionTypeOptions"
        />
      </div>

      <div class="grid gap-4 sm:grid-cols-2">
        <div>
          <label for="offer-price-usd" class="mb-1.5 block text-sm text-zinc-800 dark:text-zinc-200">
            {{ text.setting.offers.priceUsdLabel }}
          </label>
          <input
            id="offer-price-usd"
            v-model="priceUsdInput"
            type="number"
            min="0"
            step="any"
            inputmode="decimal"
            required
            :placeholder="text.setting.offers.priceUsdPlaceholder"
            class="min-h-11 w-full rounded-xl border border-zinc-300 bg-white px-4 text-sm text-zinc-950 outline-hidden focus:ring-2 focus:ring-zinc-900 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-50 dark:focus:ring-zinc-300"
          />
        </div>
        <div>
          <label for="offer-price-idr" class="mb-1.5 block text-sm text-zinc-800 dark:text-zinc-200">
            {{ text.setting.offers.priceIdrLabel }}
          </label>
          <input
            id="offer-price-idr"
            v-model="priceIdrInput"
            type="number"
            min="0"
            step="1"
            inputmode="numeric"
            required
            :placeholder="text.setting.offers.priceIdrPlaceholder"
            class="min-h-11 w-full rounded-xl border border-zinc-300 bg-white px-4 text-sm text-zinc-950 outline-hidden focus:ring-2 focus:ring-zinc-900 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-50 dark:focus:ring-zinc-300"
          />
        </div>
      </div>

      <div>
        <label for="offer-max-requests" class="mb-1.5 block text-sm text-zinc-800 dark:text-zinc-200">
          {{ text.setting.offers.maxRequestsLabel }}
        </label>
        <input
          id="offer-max-requests"
          v-model="maxRequestsInput"
          type="number"
          min="1"
          step="1"
          inputmode="numeric"
          :placeholder="text.setting.offers.maxRequestsPlaceholder"
          class="min-h-11 w-full rounded-xl border border-zinc-300 bg-white px-4 text-sm text-zinc-950 outline-hidden focus:ring-2 focus:ring-zinc-900 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-50 dark:focus:ring-zinc-300"
        />
      </div>

      <div>
        <label for="offer-title" class="mb-1.5 block text-sm text-zinc-800 dark:text-zinc-200">
          {{ text.setting.titleLabel }}
        </label>
        <input
          id="offer-title"
          v-model="titleInput"
          type="text"
          maxlength="120"
          required
          class="min-h-11 w-full rounded-xl border border-zinc-300 bg-white px-4 text-sm text-zinc-950 outline-hidden focus:ring-2 focus:ring-zinc-900 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-50 dark:focus:ring-zinc-300"
        />
      </div>

      <div>
        <label for="offer-description" class="mb-1.5 block text-sm text-zinc-800 dark:text-zinc-200">
          {{ text.home.descriptionLabel }}
        </label>
        <textarea
          id="offer-description"
          v-model="descriptionInput"
          rows="3"
          maxlength="240"
          required
          class="w-full rounded-xl border border-zinc-300 bg-white px-4 py-2.5 text-sm text-zinc-950 outline-hidden focus:ring-2 focus:ring-zinc-900 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-50 dark:focus:ring-zinc-300"
        />
      </div>

      <ImageUploadField
        v-model:file="imageFile"
        v-model:removed="removeExistingImage"
        v-model:error="imageError"
        id-prefix="offer-example"
        :label="text.setting.offers.exampleImageLabel"
        :existing-url="offer?.imageUrl ?? templateOffer?.imageUrl"
      />

      <label class="inline-flex cursor-pointer items-center gap-2.5 text-sm text-zinc-800 dark:text-zinc-200">
        <input
          v-model="openInput"
          type="checkbox"
          class="size-4 cursor-pointer rounded border-zinc-300 accent-zinc-900 dark:border-zinc-600 dark:accent-zinc-100"
        />
        <span>{{ text.setting.offers.openToggle }}</span>
      </label>

      <p
        v-if="formError"
        role="alert"
        class="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300"
      >
        {{ formError }}
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
