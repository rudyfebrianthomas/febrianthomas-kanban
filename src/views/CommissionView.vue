<script setup lang="ts">
import {
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogOverlay,
  DialogPortal,
  DialogRoot,
  DialogTitle,
} from 'reka-ui'
import { FileText, Pencil, Search, Trash2, UploadCloud, X } from '@lucide/vue'
import { motion, useReducedMotion } from 'motion-v'
import { computed, onMounted, onUnmounted, ref } from 'vue'
import ConfirmDialog from '../components/ConfirmDialog.vue'
import { useLanguage } from '../composables/useLanguage'
import { kanbanImageExtension, optimizeKanbanImage } from '../kanbanImage'
import { stageProgress as getStageProgress, stageStyle } from '../kanbanStage'
import { supabase } from '../supabase'

interface KanbanBoard {
  id: string
  title: string
  description: string | null
  is_active: boolean
}

const COMMISSION_TYPES = ['Emote', 'GIF', 'Animation', 'Illustration', 'Transition'] as const
type CommissionType = (typeof COMMISSION_TYPES)[number]

interface KanbanCard {
  id: string
  boardId: string
  stageNumber: string
  commissionType: CommissionType
  title: string
  description: string
  requestors: string[]
  imagePath: string | null
  imageUrl?: string
  createdAt?: string
  updatedAt?: string | null
}

interface KanbanCardRow {
  id: string
  board_id: string
  stage_number: string
  commission_type: CommissionType
  title: string
  description: string
  requestors: string[]
  image_path: string | null
  created_at?: string
  updated_at?: string | null
}

const DEFAULT_BOARD_ID = '00000000-0000-0000-0000-000000000001'
const fieldClass =
  'mt-2 w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 text-base text-zinc-950 outline-none focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-50 dark:focus:border-zinc-300 dark:focus:ring-zinc-300'

const { language, text } = useLanguage()
const reducedMotion = useReducedMotion()

const signedIn = ref(false)
const authSubscription = supabase?.auth.onAuthStateChange((_event, session) => {
  signedIn.value = !!session
})

const loading = ref(!!supabase)
const activeBoard = ref<KanbanBoard | null>(
  supabase ? null : { id: DEFAULT_BOARD_ID, title: 'Commission Board', description: null, is_active: true },
)
const open = ref(false)
const pending = ref(false)
const editingCard = ref<KanbanCard | null>(null)
const removeExistingImage = ref(false)
const cards = ref<KanbanCard[]>([])
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
const searchQuery = ref('')

function parseTags(raw: string): string[] {
  return [...new Set(raw.split(',').map((item) => item.trim()).filter(Boolean))]
}

const previewTags = computed(() => parseTags(requestorInput.value))
const activeImagePreviewUrl = computed(() => {
  if (imageFile.value && previewUrl.value) return previewUrl.value
  if (editingCard.value?.imageUrl && !removeExistingImage.value) return editingCard.value.imageUrl
  return ''
})

function isValidImage(file: File): boolean {
  return Boolean(kanbanImageExtension(file))
}

function kanbanImageUrl(path: string | null): string | undefined {
  if (!path || !supabase) return undefined
  return supabase.storage.from('kanban-images').getPublicUrl(path).data.publicUrl
}

function toKanbanCard(row: KanbanCardRow): KanbanCard {
  return {
    id: row.id,
    boardId: row.board_id,
    stageNumber: row.stage_number,
    commissionType: row.commission_type,
    title: row.title,
    description: row.description,
    requestors: row.requestors,
    imagePath: row.image_path,
    imageUrl: kanbanImageUrl(row.image_path),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function formatCardDate(iso?: string | null): string {
  if (!iso) return ''
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat(language.value === 'id' ? 'id-ID' : 'en-US', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

onMounted(async () => {
  if (!supabase) return
  try {
    const [{ data: sessionData }, { data: boardData }] = await Promise.all([
      supabase.auth.getSession(),
      supabase
        .from('kanban_boards')
        .select('id,title,description,is_active')
        .eq('is_active', true)
        .maybeSingle(),
    ])
    signedIn.value = Boolean(sessionData.session)

    activeBoard.value = (boardData as KanbanBoard | null) ?? null
    if (!activeBoard.value) return

    const { data: cardsData } = await supabase
      .from('kanban_cards')
      .select('id,board_id,stage_number,commission_type,title,description,requestors,image_path,created_at,updated_at')
      .eq('board_id', activeBoard.value.id)
      .order('created_at', { ascending: true })

    if (cardsData) cards.value = (cardsData as KanbanCardRow[]).map(toKanbanCard)
  } finally {
    loading.value = false
  }
})

function revokePreview() {
  if (previewUrl.value) {
    URL.revokeObjectURL(previewUrl.value)
    previewUrl.value = ''
  }
}

function selectImage(file: File | null) {
  revokePreview()
  if (file && !isValidImage(file)) {
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
  if (editingCard.value) removeExistingImage.value = true
}

function resetForm() {
  editingCard.value = null
  removeExistingImage.value = false
  commissionType.value = 'Illustration'
  title.value = ''
  description.value = ''
  requestorInput.value = ''
  dragging.value = false
  error.value = ''
  imageError.value = ''
  if (fileInput.value) fileInput.value.value = ''
  imageFile.value = null
  revokePreview()
}

function openAddCard() {
  if (!signedIn.value) return
  resetForm()
  open.value = true
}

function openEditCard(card: KanbanCard) {
  if (!signedIn.value) return
  resetForm()
  editingCard.value = card
  commissionType.value = card.commissionType
  title.value = card.title
  description.value = card.description
  requestorInput.value = card.requestors.join(', ')
  open.value = true
}

defineExpose({ openAddCard })

function onOpenChange(nextOpen: boolean) {
  if (pending.value) return
  open.value = nextOpen
  if (!nextOpen) resetForm()
}

async function submitCard() {
  if (!signedIn.value || pending.value || imageError.value || !activeBoard.value) return
  const trimmedTitle = title.value.trim()
  const trimmedDescription = description.value.trim()
  const requestors = parseTags(requestorInput.value)

  if (!trimmedTitle || !trimmedDescription || requestors.length === 0) {
    error.value = text.value.home.requiredFields
    return
  }
  if (requestors.length > 10 || requestors.join(',').length > 400) {
    error.value = text.value.home.tagsInvalid
    return
  }

  const editing = editingCard.value
  const stageNumber = editing?.stageNumber ?? text.value.home.stages[0]?.number ?? '01'
  const boardId = activeBoard.value.id

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
      editing.commissionType = commissionType.value
      editing.title = trimmedTitle
      editing.description = trimmedDescription
      editing.requestors = requestors
      editing.imageUrl = nextUrl
      editing.updatedAt = new Date().toISOString()
    } else {
      const cardImageUrl = imageFile.value ? URL.createObjectURL(imageFile.value) : undefined
      cards.value.push({
        id: crypto.randomUUID(),
        boardId,
        stageNumber,
        commissionType: commissionType.value,
        title: trimmedTitle,
        description: trimmedDescription,
        requestors,
        imagePath: null,
        imageUrl: cardImageUrl,
        createdAt: new Date().toISOString(),
        updatedAt: null,
      })
    }
    open.value = false
    resetForm()
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

    if (editing) {
      const oldImagePath = editing.imagePath
      const nextImagePath = uploadedPath ?? (removeExistingImage.value ? null : oldImagePath)
      const { data, error: updateError } = await supabase
        .from('kanban_cards')
        .update({
          commission_type: commissionType.value,
          title: trimmedTitle,
          description: trimmedDescription,
          requestors,
          image_path: nextImagePath,
        })
        .eq('id', editing.id)
        .select('id,board_id,stage_number,commission_type,title,description,requestors,image_path,created_at,updated_at')
        .single()

      if (updateError) throw updateError
      const updated = toKanbanCard(data as KanbanCardRow)
      const index = cards.value.findIndex((item) => item.id === updated.id)
      if (index !== -1) cards.value[index] = updated
      if (oldImagePath && (uploadedPath || removeExistingImage.value)) {
        await supabase.storage.from('kanban-images').remove([oldImagePath]).catch(() => {})
      }
    } else {
      const { data, error: insertError } = await supabase
        .from('kanban_cards')
        .insert({
          board_id: boardId,
          stage_number: stageNumber,
          commission_type: commissionType.value,
          title: trimmedTitle,
          description: trimmedDescription,
          requestors,
          image_path: uploadedPath,
        })
        .select('id,board_id,stage_number,commission_type,title,description,requestors,image_path,created_at,updated_at')
        .single()

      if (insertError) throw insertError
      cards.value.push(toKanbanCard(data as KanbanCardRow))
    }

    open.value = false
    resetForm()
  } catch {
    if (uploadedPath) {
      await supabase.storage.from('kanban-images').remove([uploadedPath]).catch(() => {})
    }
    error.value = text.value.home.saveError
  } finally {
    pending.value = false
  }
}

async function deleteCard(card: KanbanCard) {
  if (!signedIn.value) return
  if (supabase) {
    const { error: deleteError } = await supabase.from('kanban_cards').delete().eq('id', card.id)
    if (deleteError) throw deleteError
    if (card.imagePath) {
      await supabase.storage.from('kanban-images').remove([card.imagePath]).catch(() => {})
    }
  } else if (card.imageUrl?.startsWith('blob:')) {
    URL.revokeObjectURL(card.imageUrl)
  }
  cards.value = cards.value.filter((item) => item.id !== card.id)
}

const draggingCardId = ref('')
const dragOverStage = ref('')

function cardsForStage(stageNumber: string): KanbanCard[] {
  if (!activeBoard.value) return []
  const q = searchQuery.value.trim().toLowerCase()
  return cards.value.filter((card) => {
    if (card.boardId !== activeBoard.value!.id || card.stageNumber !== stageNumber) return false
    if (!q) return true
    return (
      card.title.toLowerCase().includes(q) ||
      card.description.toLowerCase().includes(q) ||
      card.requestors.some((tag) => tag.toLowerCase().includes(q))
    )
  })
}

function stageLabel(stageNumber: string): string {
  return text.value.home.stages.find((stage) => stage.number === stageNumber)?.label ?? ''
}

function stageProgress(stageNumber: string): number {
  return getStageProgress(stageNumber, text.value.home.stages)
}

function onCardDragStart(cardId: string, event: DragEvent) {
  if (!signedIn.value) return
  draggingCardId.value = cardId
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', cardId)
  }
}

function onCardDragEnd() {
  draggingCardId.value = ''
  dragOverStage.value = ''
}

function onColumnDragOver(stageNumber: string, event: DragEvent) {
  if (!draggingCardId.value) return
  if (event.dataTransfer) event.dataTransfer.dropEffect = 'move'
  dragOverStage.value = stageNumber
}

function onColumnDragLeave(stageNumber: string, event: DragEvent) {
  if (dragOverStage.value !== stageNumber) return
  const currentTarget = event.currentTarget as HTMLElement | null
  const related = event.relatedTarget as Node | null
  if (!related || !currentTarget?.contains(related)) dragOverStage.value = ''
}

async function onColumnDrop(stageNumber: string, event: DragEvent) {
  const cardId = draggingCardId.value || event.dataTransfer?.getData('text/plain') || ''
  onCardDragEnd()
  if (!cardId || !signedIn.value) return
  const index = cards.value.findIndex((card) => card.id === cardId)
  if (index === -1) return
  const [card] = cards.value.splice(index, 1)
  if (!card) return
  const previousStage = card.stageNumber
  const previousUpdatedAt = card.updatedAt
  card.stageNumber = stageNumber
  if (previousStage !== stageNumber) {
    card.updatedAt = new Date().toISOString()
  }
  cards.value.push(card)

  if (supabase && previousStage !== stageNumber) {
    const { error: updateError } = await supabase
      .from('kanban_cards')
      .update({ stage_number: stageNumber })
      .eq('id', card.id)
    if (updateError) {
      card.stageNumber = previousStage
      card.updatedAt = previousUpdatedAt
    }
  }
}

onUnmounted(() => {
  authSubscription?.data.subscription.unsubscribe()
  revokePreview()
  for (const card of cards.value) {
    if (card.imageUrl?.startsWith('blob:')) URL.revokeObjectURL(card.imageUrl)
  }
})
</script>

<template>
  <main class="flex flex-1 flex-col px-6 sm:px-10">
    <section class="flex w-full flex-1 flex-col py-12 sm:py-16" aria-labelledby="page-title">
      <div class="mx-auto w-full max-w-6xl">
        <div class="max-w-3xl">
          <p class="mb-4 text-xs uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
            {{ text.home.commissionEyebrow }}
          </p>
          <h1
            id="page-title"
            class="font-bagel-fat-one text-5xl leading-[1.05] tracking-tight text-zinc-950 sm:text-7xl dark:text-zinc-50"
          >
            {{ text.home.commissionTitle }}
          </h1>
          <p class="mt-4 text-base leading-7 text-zinc-600 sm:text-lg dark:text-zinc-300">
            {{ text.home.commissionDescription }}
          </p>
        </div>
      </div>

      <div v-if="!loading && !activeBoard" class="mx-auto mt-8 flex min-h-72 flex-col items-center justify-center px-6 py-12 text-center">
        <span aria-hidden="true" class="flex size-16 items-center justify-center rounded-2xl bg-orange-100 text-orange-700 dark:bg-zinc-800 dark:text-orange-300">
          <FileText :size="30" />
        </span>
        <h2 class="mt-6 font-sniglet text-3xl font-bold text-zinc-950 dark:text-zinc-50">
          {{ text.home.noActiveBoardTitle }}
        </h2>
        <p class="mt-3 max-w-sm leading-7 text-zinc-600 dark:text-zinc-300">{{ text.home.noActiveBoardDescription }}</p>
      </div>

      <div v-else-if="activeBoard" class="surface-shadow mx-auto mt-8 w-full max-w-384 rounded-2xl border border-zinc-200 bg-white p-5 sm:p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <div class="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 class="text-xl font-bold text-zinc-950 sm:text-2xl dark:text-zinc-50">
              {{ activeBoard.title }}
            </h2>
            <p
              v-if="activeBoard.description"
              class="mt-1 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400"
            >
              {{ activeBoard.description }}
            </p>
          </div>

          <form class="w-full sm:w-80" role="search" @submit.prevent>
            <label for="commission-card-search" class="sr-only">{{ text.home.searchCards }}</label>
            <div class="relative">
              <Search
                class="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-zinc-400"
                aria-hidden="true"
              />
              <input
                id="commission-card-search"
                v-model="searchQuery"
                type="search"
                :placeholder="text.home.searchCardsPlaceholder"
                class="min-h-11 w-full rounded-xl border border-zinc-300 bg-white pl-11 pr-4 text-sm text-zinc-950 outline-none placeholder:text-zinc-400 focus:ring-2 focus:ring-zinc-900 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-50 dark:placeholder:text-zinc-500 dark:focus:ring-zinc-300"
              />
            </div>
          </form>
        </div>

        <DialogRoot v-if="signedIn" :open="open" @update:open="onOpenChange">
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
                      {{ editingCard ? text.home.editCardTitle : text.home.createCardTitle }}
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
                    {{ editingCard ? text.home.editCardDescription : text.home.createCardDescription }}
                  </DialogDescription>

                  <form class="mt-7 space-y-5" @submit.prevent="submitCard">
                    <div>
                      <label for="card-title" class="block text-sm">{{ text.home.titleLabel }}</label>
                      <input id="card-title" v-model="title" type="text" required maxlength="120" :class="fieldClass" />
                    </div>

                    <div>
                      <label for="card-commission-type" class="block text-sm">{{ text.home.commissionTypeLabel }}</label>
                      <select id="card-commission-type" v-model="commissionType" required :class="fieldClass">
                        <option v-for="typeOption in COMMISSION_TYPES" :key="typeOption" :value="typeOption">
                          {{ text.home.commissionTypes[typeOption] }}
                        </option>
                      </select>
                    </div>

                    <div>
                      <label for="card-description" class="block text-sm">{{ text.home.descriptionLabel }}</label>
                      <textarea id="card-description" v-model="description" required maxlength="240" rows="3" :class="fieldClass" />
                    </div>

                    <div>
                      <label for="card-requestor" class="block text-sm">{{ text.home.requestorLabel }}</label>
                      <input
                        id="card-requestor"
                        v-model="requestorInput"
                        type="text"
                        required
                        aria-describedby="card-requestor-help"
                        :class="fieldClass"
                      />
                      <p id="card-requestor-help" class="mt-2 text-sm text-zinc-600 dark:text-zinc-300">{{ text.home.requestorHelp }}</p>
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
                      <p id="card-image-label" class="block text-sm">{{ text.home.imageLabel }}</p>
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
                          ref="fileInput"
                          id="card-image"
                          type="file"
                          accept="image/jpeg,image/png,image/webp,image/gif"
                          aria-labelledby="card-image-label"
                          :aria-describedby="imageError ? 'card-image-help card-image-error' : 'card-image-help'"
                          :aria-invalid="Boolean(imageError)"
                          class="sr-only"
                          @change="onFileChange"
                        />
                        <div class="flex flex-wrap items-center gap-3">
                          <UploadCloud :size="22" aria-hidden="true" class="text-zinc-500 dark:text-zinc-400" />
                          <label
                            for="card-image"
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
                      <p id="card-image-help" class="mt-2 text-sm text-zinc-600 dark:text-zinc-300">{{ text.home.imageHelp }}</p>
                      <p v-if="imageError" id="card-image-error" role="alert" class="mt-2 text-sm text-red-700 dark:text-red-400">
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
                      {{ pending ? text.home.savingCard : editingCard ? text.home.saveChanges : text.home.submitCard }}
                    </motion.button>
                  </form>
                </motion.div>
              </DialogContent>
            </div>
          </DialogPortal>
        </DialogRoot>

        <div class="mt-6 flex gap-3 overflow-x-auto" :aria-label="text.home.stagesLabel">
          <div
            v-for="stage in text.home.stages"
            :key="stage.number"
            :class="[
              'flex min-w-56 flex-1 flex-col gap-3 rounded-xl p-3.5 text-sm text-zinc-900 transition-colors dark:text-zinc-100',
              dragOverStage === stage.number ? 'bg-orange-50/60 ring-2 ring-orange-500 dark:bg-zinc-800/80 dark:ring-orange-400' : 'bg-zinc-100 dark:bg-zinc-800',
            ]"
            @dragover.prevent="onColumnDragOver(stage.number, $event)"
            @dragenter.prevent="onColumnDragOver(stage.number, $event)"
            @dragleave="onColumnDragLeave(stage.number, $event)"
            @drop.prevent="onColumnDrop(stage.number, $event)"
          >
            <div class="flex items-center">
              <span>{{ stage.label }}</span>
            </div>

            <div v-if="cardsForStage(stage.number).length" class="space-y-2.5">
              <article
                v-for="card in cardsForStage(stage.number)"
                :key="card.id"
                :draggable="signedIn"
                :class="[
                  'relative rounded-2xl border-2 bg-white p-3.5 text-zinc-950 shadow-xs transition-opacity dark:bg-zinc-900 dark:text-zinc-50',
                  stageStyle(card.stageNumber).cardBorder,
                  signedIn ? 'cursor-grab active:cursor-grabbing' : '',
                  draggingCardId === card.id ? 'opacity-50' : '',
                ]"
                @dragstart="onCardDragStart(card.id, $event)"
                @dragend="onCardDragEnd"
              >
                <div v-if="signedIn" class="absolute right-2.5 top-2.5 z-10 flex gap-1.5">
                  <button
                    type="button"
                    :aria-label="`${text.home.editCard}: ${card.title}`"
                    :title="text.home.editCard"
                    class="flex size-8 items-center justify-center rounded-xl bg-white text-zinc-700 shadow-sm hover:bg-zinc-100 focus-visible:outline-2 focus-visible:outline-offset-2 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
                    @click="openEditCard(card)"
                  >
                    <Pencil :size="14" aria-hidden="true" />
                  </button>
                  <ConfirmDialog
                    :title="text.home.deleteCardTitle"
                    :description="text.home.deleteCardDescription"
                    :cancel-label="text.login.cancel"
                    :confirm-label="text.home.deleteCard"
                    :pending-label="text.home.deletingCard"
                    :error-message="text.home.deleteCardError"
                    :on-confirm="() => deleteCard(card)"
                  >
                    <button
                      type="button"
                      :aria-label="`${text.home.deleteCard}: ${card.title}`"
                      :title="text.home.deleteCard"
                      class="flex size-8 items-center justify-center rounded-xl bg-white text-red-700 shadow-sm hover:bg-red-50 focus-visible:outline-2 focus-visible:outline-offset-2 dark:bg-zinc-900 dark:text-red-300 dark:hover:bg-red-950"
                    >
                      <Trash2 :size="14" aria-hidden="true" />
                    </button>
                  </ConfirmDialog>
                </div>

                <img
                  v-if="card.imageUrl"
                  :src="card.imageUrl"
                  :alt="card.title"
                  draggable="false"
                  class="mb-2.5 aspect-4/3 w-full rounded-xl bg-zinc-100 object-cover dark:bg-zinc-800"
                />
                <h2 :class="['text-sm', signedIn && !card.imageUrl ? 'pr-16' : '']">{{ card.title }}</h2>
                <p class="mt-1.5 inline-flex rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
                  {{ text.home.commissionTypes[card.commissionType] }}
                </p>
                <p class="mt-1.5 text-xs leading-5 text-zinc-600 sm:text-sm dark:text-zinc-300">{{ card.description }}</p>
                <div class="mt-2.5">
                  <div class="flex items-center justify-between gap-2 text-xs text-zinc-600 dark:text-zinc-300">
                    <span>{{ stageLabel(card.stageNumber) }}</span>
                    <span>{{ stageProgress(card.stageNumber) }}%</span>
                  </div>
                  <div
                    role="progressbar"
                    :aria-label="text.home.progressLabel"
                    :aria-valuenow="stageProgress(card.stageNumber)"
                    aria-valuemin="0"
                    aria-valuemax="100"
                    class="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800"
                  >
                    <div
                      :class="['h-full rounded-full transition-all duration-300', stageStyle(card.stageNumber).progressBar]"
                      :style="{ width: `${stageProgress(card.stageNumber)}%` }"
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
                  v-if="card.updatedAt || card.createdAt"
                  class="mt-2.5 border-t border-zinc-100 pt-2 text-[11px] text-zinc-500 dark:border-zinc-800 dark:text-zinc-400"
                >
                  {{ card.updatedAt ? text.home.updatedAtLabel : text.home.createdAtLabel }}:
                  {{ formatCardDate(card.updatedAt ?? card.createdAt) }}
                </p>
              </article>
            </div>
          </div>
        </div>
      </div>
    </section>
  </main>
</template>
