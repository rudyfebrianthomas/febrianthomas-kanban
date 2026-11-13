<script setup lang="ts">
import { UploadCloud, X } from '@lucide/vue'
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
import { computed, onUnmounted, ref, watch } from 'vue'
import { COMMISSION_TYPES, type CommissionType } from '../commissionStatus'
import { useLanguage } from '../composables/useLanguage'
import { type KanbanCard, type KanbanCardRow, parseRequestorTags, toKanbanCard } from '../kanbanCard'
import { kanbanImageExtension, optimizeKanbanImage } from '../kanbanImage'
import { stageStyle } from '../kanbanStage'
import { supabase } from '../supabase'
import SelectField from './SelectField.vue'

const props = withDefaults(
  defineProps<{
    boardId: string
    card?: KanbanCard | null
    showStage?: boolean
    idPrefix?: string
  }>(),
  {
    card: null,
    showStage: true,
    idPrefix: 'card',
  },
)

const open = defineModel<boolean>('open', { required: true })

const emit = defineEmits<{
  saved: [card: KanbanCard, isEdit: boolean]
}>()

const fieldClass =
  'mt-2 w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 text-base text-zinc-950 outline-none focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-50 dark:focus:border-zinc-300 dark:focus:ring-zinc-300'

const { text } = useLanguage()
const reducedMotion = useReducedMotion()

const pending = ref(false)
const removeExistingImage = ref(false)
const stageNumber = ref('01')
const commissionType = ref<CommissionType>('Illustration')
const title = ref('')
const description = ref('')
const requestorInput = ref('')
const imageFile = ref<File | null>(null)
const previewUrl = ref('')
const dragging = ref(false)
const error = ref('')
const imageError = ref('')
const fileInput = ref<HTMLInputElement | null>(null)

const previewTags = computed(() => parseRequestorTags(requestorInput.value))
const activeImagePreviewUrl = computed(() => {
  if (imageFile.value && previewUrl.value) return previewUrl.value
  if (props.card?.imageUrl && !removeExistingImage.value) return props.card.imageUrl
  return ''
})

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

function revokePreview() {
  if (previewUrl.value) {
    URL.revokeObjectURL(previewUrl.value)
    previewUrl.value = ''
  }
}

function resetForm(editing?: KanbanCard | null) {
  removeExistingImage.value = false
  stageNumber.value = editing?.stageNumber ?? text.value.home.stages[0]?.number ?? '01'
  commissionType.value = editing?.commissionType ?? 'Illustration'
  title.value = editing?.title ?? ''
  description.value = editing?.description ?? ''
  requestorInput.value = editing ? editing.requestors.join(', ') : ''
  dragging.value = false
  error.value = ''
  imageError.value = ''
  if (fileInput.value) fileInput.value.value = ''
  imageFile.value = null
  revokePreview()
}

watch(open, (isOpen) => {
  if (isOpen) {
    resetForm(props.card)
  } else {
    resetForm(null)
  }
})

onUnmounted(revokePreview)

function onOpenChange(nextOpen: boolean) {
  if (pending.value) return
  open.value = nextOpen
}

function selectImage(file: File | null) {
  revokePreview()
  if (file && !kanbanImageExtension(file)) {
    imageFile.value = null
    if (fileInput.value) fileInput.value.value = ''
    imageError.value = text.value.home.imageInvalid
    return
  }
  imageFile.value = file
  if (file) {
    previewUrl.value = URL.createObjectURL(file)
    removeExistingImage.value = false
  }
  imageError.value = ''
  error.value = ''
}

function onFileChange(event: Event) {
  const input = event.target as HTMLInputElement
  selectImage(input.files?.[0] ?? null)
}

function onDragEnter(event: DragEvent) {
  if (event.dataTransfer?.types.includes('Files')) dragging.value = true
}

function onDragLeave(event: DragEvent) {
  const currentTarget = event.currentTarget as HTMLElement | null
  const related = event.relatedTarget as Node | null
  if (!related || !currentTarget?.contains(related)) dragging.value = false
}

function onDrop(event: DragEvent) {
  dragging.value = false
  const files = event.dataTransfer?.files
  if (!files || files.length !== 1) {
    selectImage(null)
    imageError.value = text.value.home.imageSingle
    return
  }
  if (fileInput.value) fileInput.value.value = ''
  selectImage(files[0] ?? null)
}

function clearImage() {
  if (fileInput.value) fileInput.value.value = ''
  selectImage(null)
  if (props.card) removeExistingImage.value = true
}

async function submitCard() {
  if (pending.value || imageError.value || !props.boardId) return
  const trimmedTitle = title.value.trim()
  const trimmedDescription = description.value.trim()
  const requestors = parseRequestorTags(requestorInput.value)

  if (!trimmedTitle || !trimmedDescription || requestors.length === 0) {
    error.value = text.value.home.requiredFields
    return
  }
  if (requestors.length > 10 || requestors.join(',').length > 400) {
    error.value = text.value.home.tagsInvalid
    return
  }

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
      if ((imageFile.value || removeExistingImage.value) && editing.imageUrl?.startsWith('blob:')) {
        URL.revokeObjectURL(editing.imageUrl)
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
          imageUrl: imageFile.value ? URL.createObjectURL(imageFile.value) : undefined,
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
      const optimized = await optimizeKanbanImage(imageFile.value)
      const ext = kanbanImageExtension(optimized)
      if (!ext) throw new Error('Invalid image')
      uploadedPath = `${crypto.randomUUID()}.${ext}`
      const { error: uploadError } = await supabase.storage
        .from('kanban-images')
        .upload(uploadedPath, optimized, { contentType: optimized.type, upsert: false })
      if (uploadError) {
        uploadedPath = null
        throw uploadError
      }
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
      if (oldImagePath && (uploadedPath || removeExistingImage.value)) {
        await supabase.storage.from('kanban-images').remove([oldImagePath]).catch(() => {})
      }
      emit('saved', toKanbanCard(data as KanbanCardRow), true)
    } else {
      const { data, error: insertError } = await supabase
        .from('kanban_cards')
        .insert({
          board_id: props.boardId,
          stage_number: targetStage,
          commission_type: commissionType.value,
          title: trimmedTitle,
          description: trimmedDescription,
          requestors,
          image_path: uploadedPath,
        })
        .select(selectColumns)
        .single()

      if (insertError) throw insertError
      emit('saved', toKanbanCard(data as KanbanCardRow), false)
    }

    open.value = false
  } catch {
    if (uploadedPath) {
      await supabase.storage.from('kanban-images').remove([uploadedPath]).catch(() => {})
    }
    error.value = text.value.home.saveError
  } finally {
    pending.value = false
  }
}
</script>

<template>
  <DialogRoot :open="open" @update:open="onOpenChange">
    <DialogPortal>
      <DialogOverlay class="fixed inset-0 z-60 bg-zinc-950/50" />
      <div class="pointer-events-none fixed inset-0 z-70 flex items-center justify-center p-4 sm:p-6">
        <DialogContent as-child>
          <motion.div
            data-lenis-prevent
            :initial="reducedMotion ? false : { opacity: 0, scale: 0.97, y: 8 }"
            :animate="{ opacity: 1, scale: 1, y: 0 }"
            :transition="{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }"
            class="surface-shadow pointer-events-auto max-h-[calc(100dvh-2rem)] w-full max-w-2xl overflow-y-auto rounded-3xl bg-white p-6 text-zinc-950 focus:outline-none sm:p-8 dark:bg-zinc-900 dark:text-zinc-50"
          >
            <div class="flex items-start justify-between gap-4">
              <DialogTitle class="text-3xl font-bold tracking-tight sm:text-4xl">
                {{ card ? text.home.editCardTitle : text.home.createCardTitle }}
              </DialogTitle>
              <DialogClose as-child>
                <button
                  type="button"
                  :disabled="pending"
                  :aria-label="text.home.close"
                  class="flex size-11 shrink-0 items-center justify-center rounded-xl hover:bg-zinc-100 focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50 dark:hover:bg-zinc-800"
                >
                  <X :size="20" aria-hidden="true" />
                </button>
              </DialogClose>
            </div>
            <DialogDescription class="mt-3 text-base leading-7 text-zinc-600 sm:text-lg dark:text-zinc-300">
              {{ card ? text.home.editCardDescription : text.home.createCardDescription }}
            </DialogDescription>

            <form class="mt-7 space-y-5" @submit.prevent="submitCard">
              <div>
                <label :for="`${idPrefix}-title`" class="block text-sm">{{ text.home.titleLabel }}</label>
                <input
                  :id="`${idPrefix}-title`"
                  v-model="title"
                  type="text"
                  required
                  maxlength="120"
                  :class="fieldClass"
                />
              </div>

              <div>
                <label :for="`${idPrefix}-commission-type`" class="block text-sm">
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
                <label :for="`${idPrefix}-stage`" class="block text-sm">{{ text.home.stageLabel }}</label>
                <SelectField
                  :id="`${idPrefix}-stage`"
                  v-model="stageNumber"
                  :options="stageOptions"
                  size="lg"
                  required
                />
              </div>

              <div>
                <label :for="`${idPrefix}-description`" class="block text-sm">{{ text.home.descriptionLabel }}</label>
                <textarea
                  :id="`${idPrefix}-description`"
                  v-model="description"
                  required
                  maxlength="240"
                  rows="3"
                  :class="fieldClass"
                />
              </div>

              <div>
                <label :for="`${idPrefix}-requestor`" class="block text-sm">{{ text.home.requestorLabel }}</label>
                <input
                  :id="`${idPrefix}-requestor`"
                  v-model="requestorInput"
                  type="text"
                  required
                  :aria-describedby="`${idPrefix}-requestor-help`"
                  :class="fieldClass"
                />
                <p :id="`${idPrefix}-requestor-help`" class="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
                  {{ text.home.requestorHelp }}
                </p>
                <div v-if="previewTags.length" class="mt-2.5 flex flex-wrap gap-2">
                  <span
                    v-for="tag in previewTags"
                    :key="tag"
                    class="rounded-full bg-orange-100 px-3 py-1 text-xs text-orange-800 dark:bg-zinc-800 dark:text-orange-200"
                  >
                    {{ tag }}
                  </span>
                </div>
              </div>

              <div>
                <p :id="`${idPrefix}-image-label`" class="block text-sm">{{ text.home.imageLabel }}</p>
                <div
                  :class="[
                    'mt-2 rounded-xl border-2 border-dashed p-5 focus-within:ring-2 focus-within:ring-zinc-900 dark:focus-within:ring-zinc-300',
                    dragging ? 'border-orange-500 bg-orange-50 dark:border-orange-400 dark:bg-zinc-800' : 'border-zinc-300 dark:border-zinc-600',
                  ]"
                  @dragenter.prevent="onDragEnter"
                  @dragover.prevent
                  @dragleave="onDragLeave"
                  @drop.prevent="onDrop"
                >
                  <input
                    :id="`${idPrefix}-image`"
                    ref="fileInput"
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    :aria-labelledby="`${idPrefix}-image-label`"
                    :aria-describedby="imageError ? `${idPrefix}-image-help ${idPrefix}-image-error` : `${idPrefix}-image-help`"
                    :aria-invalid="Boolean(imageError)"
                    class="sr-only"
                    @change="onFileChange"
                  />
                  <div class="flex flex-wrap items-center gap-3">
                    <UploadCloud :size="22" aria-hidden="true" class="text-zinc-500 dark:text-zinc-400" />
                    <label
                      :for="`${idPrefix}-image`"
                      class="cursor-pointer rounded-xl bg-zinc-100 px-4 py-2 text-sm text-zinc-900 hover:bg-zinc-200 dark:bg-zinc-700 dark:text-zinc-50 dark:hover:bg-zinc-600"
                    >
                      {{ text.home.chooseImage }}
                    </label>
                    <span class="text-sm text-zinc-600 dark:text-zinc-300">{{ text.home.dropImage }}</span>
                  </div>

                  <img
                    v-if="activeImagePreviewUrl"
                    :src="activeImagePreviewUrl"
                    :alt="text.home.imagePreview"
                    class="mt-4 max-h-64 w-full rounded-xl bg-zinc-100 object-contain dark:bg-zinc-800"
                  />

                  <div v-if="imageFile || imageError || activeImagePreviewUrl" class="mt-4 flex items-center justify-between gap-3">
                    <span role="status" class="min-w-0 wrap-break-words text-sm">{{ imageFile?.name }}</span>
                    <button
                      type="button"
                      class="shrink-0 rounded-xl px-3 py-2 text-sm underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2"
                      @click="clearImage"
                    >
                      {{ text.home.removeImage }}
                    </button>
                  </div>
                </div>
                <p :id="`${idPrefix}-image-help`" class="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
                  {{ text.home.imageHelp }}
                </p>
                <p
                  v-if="imageError"
                  :id="`${idPrefix}-image-error`"
                  role="alert"
                  class="mt-2 text-sm text-red-700 dark:text-red-400"
                >
                  {{ imageError }}
                </p>
              </div>

              <p v-if="error" role="alert" class="text-sm text-red-700 dark:text-red-400">{{ error }}</p>

              <motion.button
                type="submit"
                :disabled="pending"
                :while-tap="reducedMotion ? undefined : { scale: 0.98 }"
                :transition="{ duration: 0.14 }"
                class="inline-flex min-h-11 items-center justify-center rounded-xl bg-zinc-900 px-4 py-2 text-sm text-white hover:bg-zinc-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300 dark:focus-visible:outline-zinc-100"
              >
                {{ pending ? text.home.savingCard : card ? text.home.saveChanges : text.home.submitCard }}
              </motion.button>
            </form>
          </motion.div>
        </DialogContent>
      </div>
    </DialogPortal>
  </DialogRoot>
</template>
