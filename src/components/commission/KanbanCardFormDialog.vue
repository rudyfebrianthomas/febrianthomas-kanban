<script setup lang="ts">
import { motion, useReducedMotion } from 'motion-v'
import { DialogClose } from 'reka-ui'
import { computed, ref, watch } from 'vue'
import { useLanguage } from '../../composables/useLanguage'
import {
  type CommissionOffer,
  formatOfferPrices,
  isOfferLimitReached,
} from '../../lib/commissionOffers'
import { COMMISSION_TYPES, type CommissionType } from '../../lib/commissionStatus'
import { type KanbanCard, type KanbanCardRow, toKanbanCard } from '../../lib/kanbanCard'
import { removeKanbanImages, revokeBlobUrls, uploadKanbanImage } from '../../lib/kanbanImage'
import { stageStyle } from '../../lib/kanbanStage'
import { supabase } from '../../lib/supabase'
import TermsDialog from '../terms/TermsDialog.vue'
import BaseDialog from '../ui/BaseDialog.vue'
import ImageUploadField from '../ui/ImageUploadField.vue'
import LoadingIndicator from '../ui/LoadingIndicator.vue'
import SelectField from '../ui/SelectField.vue'

const CONTACT_CHANNELS = ['email', 'discord', 'twitter', 'instagram'] as const
type ContactChannel = (typeof CONTACT_CHANNELS)[number]

const CHANNEL_LABELS: Record<ContactChannel, string> = {
  email: 'Email',
  discord: 'Discord',
  twitter: 'Twitter',
  instagram: 'Instagram',
}

const props = withDefaults(
  defineProps<{
    mode?: 'card' | 'request'
    boardId?: string
    card?: KanbanCard | null
    templateCard?: KanbanCard | null
    offer?: CommissionOffer | null
    showStage?: boolean
    idPrefix?: string
  }>(),
  {
    mode: 'card',
    boardId: '',
    card: null,
    templateCard: null,
    offer: null,
    showStage: true,
    idPrefix: 'card',
  },
)

const open = defineModel<boolean>('open', { required: true })

const emit = defineEmits<{
  saved: [card: KanbanCard, isEdit: boolean]
  submitted: [offerId: string]
}>()

const fieldClass =
  'mt-2 w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 text-base text-zinc-950 outline-none placeholder:text-zinc-400 focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-50 dark:placeholder:text-zinc-500 dark:focus:border-zinc-300 dark:focus:ring-zinc-300'

const { language, text } = useLanguage()
const reducedMotion = useReducedMotion()

const isRequestMode = computed(() => props.mode === 'request')

const pending = ref(false)
const stageNumber = ref('01')
const commissionType = ref<CommissionType>('Illustration')
const title = ref('')
const description = ref('')
const contactChannel = ref<ContactChannel>('discord')
const contactValue = ref('')
const imageFile = ref<File | null>(null)
const removeExistingImage = ref(false)
const imageError = ref('')
const tosAccepted = ref(false)
const tosDialogOpen = ref(false)
const error = ref('')

const commissionTypeOptions = computed(() =>
  COMMISSION_TYPES.map((typeOption) => ({
    value: typeOption,
    label: text.value.home.commissionTypes[typeOption],
  })),
)

const stageOptions = computed(() =>
  text.value.home.stages.map((stage) => ({
    value: stage.number,
    label: stage.label,
    dotClass: stageStyle(stage.number).dot,
  })),
)

const contactChannelOptions = computed(() =>
  CONTACT_CHANNELS.map((channel) => ({
    value: channel,
    label: text.value.request.contactChannels[channel],
  })),
)

const dialogTitle = computed(() => {
  if (isRequestMode.value) return text.value.request.dialogTitle
  if (props.card) return text.value.home.editCardTitle
  if (props.templateCard) return text.value.home.copyCardTitle
  return text.value.home.createCardTitle
})

const dialogDescription = computed(() => {
  if (isRequestMode.value) return text.value.request.dialogDescription
  if (props.card) return text.value.home.editCardDescription
  if (props.templateCard) return text.value.home.copyCardDescription
  return text.value.home.createCardDescription
})

function resetForm(editing?: KanbanCard | null, template?: KanbanCard | null) {
  const source = editing ?? template
  stageNumber.value = source?.stageNumber ?? text.value.home.stages[0]?.number ?? '01'
  commissionType.value = source?.commissionType ?? props.offer?.commissionType ?? 'Illustration'
  title.value = editing
    ? editing.title
    : template
      ? `${template.title} (${text.value.setting.offers.copySuffix})`.slice(0, 120)
      : props.offer?.title ?? ''
  description.value = source?.description ?? ''
  contactChannel.value = 'discord'
  contactValue.value = ''

  if (source && !isRequestMode.value) {
    const first = source.requestors[0]?.trim() ?? ''
    const match = first.match(/^(email|discord|twitter|instagram):\s*(.+)$/i)
    if (match?.[1] && match[2]) {
      contactChannel.value = match[1].toLowerCase() as ContactChannel
      contactValue.value = match[2].trim()
    } else if (source.requestors.length > 0) {
      const joined = source.requestors.join(', ').trim()
      contactChannel.value = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(joined) ? 'email' : 'discord'
      contactValue.value = joined
    }
  }

  imageFile.value = null
  removeExistingImage.value = false
  imageError.value = ''
  tosAccepted.value = false
  tosDialogOpen.value = false
  error.value = ''
}

watch(open, (isOpen) => {
  if (isOpen) {
    resetForm(props.card, props.templateCard)
  } else {
    resetForm(null, null)
  }
})

function onOpenChange(nextOpen: boolean) {
  if (pending.value) return
  open.value = nextOpen
}

async function submitRequestMode(trimmedDescription: string, trimmedContact: string) {
  if (!props.offer || isOfferLimitReached(props.offer)) return

  if (!trimmedDescription || !trimmedContact) {
    error.value = text.value.request.requiredFields
    return
  }
  if (contactChannel.value === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedContact)) {
    error.value = text.value.request.invalidEmail
    return
  }
  if (!tosAccepted.value) {
    error.value = text.value.request.tosRequired
    return
  }

  pending.value = true
  error.value = ''
  let uploadedPath: string | null = null
  try {
    if (supabase) {
      if (imageFile.value) {
        uploadedPath = await uploadKanbanImage(imageFile.value)
      }
      const { error: rpcError } = await supabase.rpc('submit_commission_request', {
        p_offer_id: props.offer.id,
        p_description: trimmedDescription,
        p_contact_channel: contactChannel.value,
        p_contact_value: trimmedContact,
        p_image_path: uploadedPath,
        p_tos_accepted: true,
      })
      if (rpcError) throw rpcError
    }
    emit('submitted', props.offer.id)
    open.value = false
  } catch {
    await removeKanbanImages([uploadedPath])
    error.value = text.value.request.submitError
  } finally {
    pending.value = false
  }
}

async function submitCardMode(trimmedDescription: string, trimmedContact: string) {
  if (!props.boardId) return

  const trimmedTitle = title.value.trim()
  if (!trimmedTitle || !trimmedDescription || !trimmedContact) {
    error.value = text.value.home.requiredFields
    return
  }
  if (contactChannel.value === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedContact)) {
    error.value = text.value.request.invalidEmail
    return
  }
  const requestors = [`${CHANNEL_LABELS[contactChannel.value]}: ${trimmedContact}`]

  const editing = props.card
  const targetStage = props.showStage
    ? stageNumber.value || text.value.home.stages[0]?.number || '01'
    : editing?.stageNumber ?? text.value.home.stages[0]?.number ?? '01'

  if (!supabase) {
    if (editing) {
      const nextUrl = imageFile.value
        ? URL.createObjectURL(imageFile.value)
        : removeExistingImage.value
          ? undefined
          : editing.imageUrl
      if (imageFile.value || removeExistingImage.value) {
        revokeBlobUrls([editing.imageUrl])
      }
      emit(
        'saved',
        {
          ...editing,
          stageNumber: targetStage,
          commissionType: commissionType.value,
          title: trimmedTitle,
          description: trimmedDescription,
          requestors,
          imageUrl: nextUrl,
          updatedAt: new Date().toISOString(),
        },
        true,
      )
    } else {
      const copiedImageUrl =
        imageFile.value
          ? URL.createObjectURL(imageFile.value)
          : removeExistingImage.value
            ? undefined
            : props.templateCard?.imageUrl
      emit(
        'saved',
        {
          id: crypto.randomUUID(),
          boardId: props.boardId,
          stageNumber: targetStage,
          commissionType: commissionType.value,
          title: trimmedTitle,
          description: trimmedDescription,
          requestors,
          imagePath: null,
          imageUrl: copiedImageUrl,
          createdAt: new Date().toISOString(),
          updatedAt: null,
        },
        false,
      )
    }
    open.value = false
    return
  }

  pending.value = true
  error.value = ''
  let uploadedPath: string | null = null
  try {
    if (imageFile.value) {
      uploadedPath = await uploadKanbanImage(imageFile.value)
    }

    const selectColumns =
      'id,board_id,stage_number,commission_type,title,description,requestors,image_path,created_at,updated_at'

    if (editing) {
      const oldImagePath = editing.imagePath
      const nextImagePath = uploadedPath ?? (removeExistingImage.value ? null : oldImagePath)
      const { data, error: updateError } = await supabase
        .from('kanban_cards')
        .update({
          stage_number: targetStage,
          commission_type: commissionType.value,
          title: trimmedTitle,
          description: trimmedDescription,
          requestors,
          image_path: nextImagePath,
        })
        .eq('id', editing.id)
        .select(selectColumns)
        .single()

      if (updateError) throw updateError
      if (uploadedPath || removeExistingImage.value) {
        await removeKanbanImages([oldImagePath])
      }
      emit('saved', toKanbanCard(data as KanbanCardRow), true)
    } else {
      const nextImagePath =
        uploadedPath ?? (removeExistingImage.value ? null : props.templateCard?.imagePath ?? null)
      const { data, error: insertError } = await supabase
        .from('kanban_cards')
        .insert({
          board_id: props.boardId,
          stage_number: targetStage,
          commission_type: commissionType.value,
          title: trimmedTitle,
          description: trimmedDescription,
          requestors,
          image_path: nextImagePath,
        })
        .select(selectColumns)
        .single()

      if (insertError) throw insertError
      emit('saved', toKanbanCard(data as KanbanCardRow), false)
    }

    open.value = false
  } catch {
    await removeKanbanImages([uploadedPath])
    error.value = text.value.home.saveError
  } finally {
    pending.value = false
  }
}

async function handleSubmit() {
  if (pending.value || imageError.value) return
  const trimmedDescription = description.value.trim()
  const trimmedContact = contactValue.value.trim()
  if (isRequestMode.value) {
    await submitRequestMode(trimmedDescription, trimmedContact)
  } else {
    await submitCardMode(trimmedDescription, trimmedContact)
  }
}
</script>

<template>
  <BaseDialog
    :open="open"
    :title="dialogTitle"
    :description="dialogDescription"
    :close-label="text.home.close"
    :close-disabled="pending"
    max-width-class="max-w-2xl"
    description-class="mt-2 text-base leading-6 text-zinc-600 dark:text-zinc-300"
    @update:open="onOpenChange"
  >
    <form class="mt-6 space-y-5" @submit.prevent="handleSubmit">
              <div
                v-if="isRequestMode && offer"
                class="flex flex-wrap items-start gap-3 rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-800/60"
              >
                <img
                  v-if="offer.imageUrl"
                  :src="offer.imageUrl"
                  :alt="offer.title"
                  class="size-16 shrink-0 rounded-xl bg-white object-cover dark:bg-zinc-900"
                />
                <div class="min-w-0 flex-1">
                  <p class="text-xs uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400">
                    {{ text.request.selectedLabel }}
                  </p>
                  <div class="mt-1.5 flex flex-wrap items-center gap-2">
                    <h3 class="text-lg font-bold text-zinc-950 dark:text-zinc-50">
                      {{ offer.title }}
                    </h3>
                    <span class="rounded-full bg-white px-2.5 py-0.5 text-xs text-zinc-700 dark:bg-zinc-900 dark:text-zinc-200">
                      {{ text.home.commissionTypes[offer.commissionType] }}
                    </span>
                    <span
                      v-if="offer.maxRequests !== null"
                      class="rounded-full bg-white px-2.5 py-0.5 text-xs font-medium tabular-nums text-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
                    >
                      {{ offer.requestCount }}/{{ offer.maxRequests }}
                    </span>
                    <span class="rounded-full bg-orange-100 px-2.5 py-0.5 text-xs font-bold text-orange-800 dark:bg-orange-950/60 dark:text-orange-200">
                      {{ formatOfferPrices(offer, language) }}
                    </span>
                  </div>
                  <p class="mt-1.5 text-sm leading-6 text-zinc-600 dark:text-zinc-300">
                    {{ offer.description }}
                  </p>
                </div>
              </div>

              <template v-else>
                <div>
                  <label :for="`${idPrefix}-title`" class="block text-sm text-zinc-800 dark:text-zinc-200">
                    {{ text.home.titleLabel }}
                  </label>
                  <input
                    :id="`${idPrefix}-title`"
                    v-model="title"
                    type="text"
                    required
                    maxlength="120"
                    :class="fieldClass"
                  />
                </div>

                <div :class="showStage ? 'grid gap-4 sm:grid-cols-2' : ''">
                  <div>
                    <label :for="`${idPrefix}-commission-type`" class="block text-sm text-zinc-800 dark:text-zinc-200">
                      {{ text.home.commissionTypeLabel }}
                    </label>
                    <SelectField
                      :id="`${idPrefix}-commission-type`"
                      v-model="commissionType"
                      :options="commissionTypeOptions"
                      size="lg"
                      required
                    />
                  </div>

                  <div v-if="showStage">
                    <label :for="`${idPrefix}-stage`" class="block text-sm text-zinc-800 dark:text-zinc-200">
                      {{ text.home.stageLabel }}
                    </label>
                    <SelectField
                      :id="`${idPrefix}-stage`"
                      v-model="stageNumber"
                      :options="stageOptions"
                      size="lg"
                      required
                    />
                  </div>
                </div>
              </template>

              <div>
                <div class="flex items-center justify-between gap-2">
                  <label :for="`${idPrefix}-description`" class="block text-sm text-zinc-800 dark:text-zinc-200">
                    {{ isRequestMode ? text.request.descriptionLabel : text.home.descriptionLabel }}
                  </label>
                  <span class="text-xs text-zinc-500 dark:text-zinc-400">
                    {{ description.length }}/500
                  </span>
                </div>
                <textarea
                  :id="`${idPrefix}-description`"
                  v-model="description"
                  rows="4"
                  maxlength="500"
                  required
                  :placeholder="text.request.descriptionPlaceholder"
                  :class="fieldClass"
                />
              </div>

              <div class="grid gap-4 sm:grid-cols-[12rem_1fr]">
                <div>
                  <label :for="`${idPrefix}-contact-channel`" class="block text-sm text-zinc-800 dark:text-zinc-200">
                    {{ text.request.contactChannelLabel }}
                  </label>
                  <SelectField
                    :id="`${idPrefix}-contact-channel`"
                    v-model="contactChannel"
                    :options="contactChannelOptions"
                    size="lg"
                  />
                </div>

                <div>
                  <label :for="`${idPrefix}-contact-value`" class="block text-sm text-zinc-800 dark:text-zinc-200">
                    {{ text.request.contactValueLabel }}
                  </label>
                  <input
                    :id="`${idPrefix}-contact-value`"
                    v-model="contactValue"
                    :type="contactChannel === 'email' ? 'email' : 'text'"
                    maxlength="120"
                    required
                    :placeholder="text.request.contactPlaceholders[contactChannel]"
                    :class="fieldClass"
                  />
                </div>
              </div>

              <ImageUploadField
                v-model:file="imageFile"
                v-model:removed="removeExistingImage"
                v-model:error="imageError"
                :id-prefix="`${idPrefix}-reference`"
                :label="isRequestMode ? text.request.referenceImageLabel : text.home.imageLabel"
                :existing-url="!isRequestMode ? (card?.imageUrl ?? templateCard?.imageUrl) : ''"
              />

              <div
                v-if="isRequestMode"
                class="flex items-start gap-3 rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-800/60"
              >
                <input
                  :id="`${idPrefix}-tos-agree`"
                  v-model="tosAccepted"
                  type="checkbox"
                  class="mt-0.5 size-4 shrink-0 cursor-pointer rounded border-zinc-300 accent-zinc-900 dark:border-zinc-600 dark:accent-zinc-100"
                />
                <div class="text-sm leading-6 text-zinc-700 dark:text-zinc-300">
                  <label :for="`${idPrefix}-tos-agree`" class="cursor-pointer">
                    {{ text.request.tosPrefix }}
                  </label>
                  {{ ' ' }}
                  <button
                    type="button"
                    class="cursor-pointer font-medium text-zinc-950 underline underline-offset-4 hover:text-zinc-700 focus-visible:outline-2 focus-visible:outline-offset-2 dark:text-zinc-50 dark:hover:text-zinc-300"
                    @click="tosDialogOpen = true"
                  >
                    {{ text.request.tosLink }}
                  </button>
                </div>
              </div>

              <p
                v-if="error"
                role="alert"
                class="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300"
              >
                {{ error }}
              </p>

              <div class="flex flex-wrap items-center justify-end gap-2 pt-1">
                <DialogClose as-child>
                  <button
                    type="button"
                    :disabled="pending"
                    class="inline-flex min-h-11 items-center justify-center rounded-xl border border-zinc-300 px-4 py-2 text-sm text-zinc-700 transition-colors hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                  >
                    {{ text.home.close }}
                  </button>
                </DialogClose>
                <motion.button
                  type="submit"
                  :disabled="pending"
                  :while-tap="reducedMotion ? undefined : { scale: 0.98 }"
                  :transition="{ duration: 0.14 }"
                  class="inline-flex min-h-11 items-center justify-center rounded-xl bg-zinc-900 px-5 py-2.5 text-sm text-white hover:bg-zinc-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300 dark:focus-visible:outline-zinc-100"
                >
                  <LoadingIndicator
                    v-if="pending"
                    :label="isRequestMode ? text.request.submitting : text.home.savingCard"
                  />
                  <template v-else>
                    {{
                      isRequestMode
                        ? text.request.submit
                        : card
                          ? text.home.saveChanges
                          : text.home.submitCard
                    }}
                  </template>
                </motion.button>
              </div>
    </form>
  </BaseDialog>

  <TermsDialog v-if="isRequestMode" v-model:open="tosDialogOpen" @agree="tosAccepted = true" />
</template>
