<script setup lang="ts">
import {
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogOverlay,
  DialogPortal,
  DialogRoot,
  DialogTitle,
  DialogTrigger,
} from 'reka-ui'
import { Plus, UploadCloud, X } from '@lucide/vue'
import { motion, useReducedMotion } from 'motion-v'
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useLanguage } from '../composables/useLanguage'
import { supabase } from '../supabase'

interface KanbanBoard {
  id: string
  title: string
  description: string | null
}

interface KanbanCard {
  id: string
  boardId: string
  stageNumber: string
  title: string
  description: string
  requestors: string[]
  imageUrl?: string
}

interface KanbanCardRow {
  id: string
  board_id: string
  stage_number: string
  title: string
  description: string
  requestors: string[]
  image_path: string | null
}

const DEFAULT_BOARD_ID = '00000000-0000-0000-0000-000000000001'

const IMAGE_EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
}
const MAX_IMAGE_BYTES = 5 * 1024 * 1024
const fieldClass =
  'mt-2 w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 text-base text-zinc-950 outline-none focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-50 dark:focus:border-zinc-300 dark:focus:ring-zinc-300'

const { text } = useLanguage()
const reducedMotion = useReducedMotion()

const open = ref(false)
const pending = ref(false)
const boards = ref<KanbanBoard[]>([{ id: DEFAULT_BOARD_ID, title: 'Commission Board', description: null }])
const selectedBoardId = ref(DEFAULT_BOARD_ID)
const cards = ref<KanbanCard[]>([])
const title = ref('')
const description = ref('')
const requestorInput = ref('')
const imageFile = ref<File | null>(null)
const previewUrl = ref('')
const dragging = ref(false)
const error = ref('')
const imageError = ref('')
const fileInput = ref<HTMLInputElement | null>(null)

function parseTags(raw: string): string[] {
  return [...new Set(raw.split(',').map((item) => item.trim()).filter(Boolean))]
}

const previewTags = computed(() => parseTags(requestorInput.value))

function isValidImage(file: File): boolean {
  return Object.hasOwn(IMAGE_EXTENSIONS, file.type) && file.size > 0 && file.size <= MAX_IMAGE_BYTES
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
    title: row.title,
    description: row.description,
    requestors: row.requestors,
    imageUrl: kanbanImageUrl(row.image_path),
  }
}

onMounted(async () => {
  if (!supabase) return
  const [boardsResult, cardsResult] = await Promise.all([
    supabase.from('kanban_boards').select('id,title,description').order('created_at', { ascending: true }),
    supabase
      .from('kanban_cards')
      .select('id,board_id,stage_number,title,description,requestors,image_path')
      .order('created_at', { ascending: true }),
  ])
  if (boardsResult.data?.length) {
    boards.value = boardsResult.data as KanbanBoard[]
    selectedBoardId.value = boards.value[0]?.id ?? DEFAULT_BOARD_ID
  }
  if (cardsResult.data) cards.value = (cardsResult.data as KanbanCardRow[]).map(toKanbanCard)
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
  if (file) previewUrl.value = URL.createObjectURL(file)
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
}

function resetForm() {
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

function onOpenChange(nextOpen: boolean) {
  if (pending.value) return
  open.value = nextOpen
  if (!nextOpen) resetForm()
}

async function submitCard() {
  if (pending.value || imageError.value) return
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

  const stageNumber = text.value.home.stages[0]?.number ?? '01'
  const boardId = selectedBoardId.value

  if (!supabase) {
    const cardImageUrl = imageFile.value ? URL.createObjectURL(imageFile.value) : undefined
    cards.value.push({
      id: crypto.randomUUID(),
      boardId,
      stageNumber,
      title: trimmedTitle,
      description: trimmedDescription,
      requestors,
      imageUrl: cardImageUrl,
    })
    open.value = false
    resetForm()
    return
  }

  pending.value = true
  error.value = ''
  let uploadedPath: string | null = null
  try {
    if (imageFile.value) {
      const ext = IMAGE_EXTENSIONS[imageFile.value.type]
      if (!ext) throw new Error('Invalid image')
      uploadedPath = `${crypto.randomUUID()}.${ext}`
      const { error: uploadError } = await supabase.storage
        .from('kanban-images')
        .upload(uploadedPath, imageFile.value, { contentType: imageFile.value.type, upsert: false })
      if (uploadError) {
        uploadedPath = null
        throw uploadError
      }
    }

    const { data, error: insertError } = await supabase
      .from('kanban_cards')
      .insert({
        board_id: boardId,
        stage_number: stageNumber,
        title: trimmedTitle,
        description: trimmedDescription,
        requestors,
        image_path: uploadedPath,
      })
      .select('id,board_id,stage_number,title,description,requestors,image_path')
      .single()

    if (insertError) throw insertError
    cards.value.push(toKanbanCard(data as KanbanCardRow))
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

const draggingCardId = ref('')
const dragOverStage = ref('')

function cardsForStage(stageNumber: string): KanbanCard[] {
  return cards.value.filter((card) => card.boardId === selectedBoardId.value && card.stageNumber === stageNumber)
}

function stageLabel(stageNumber: string): string {
  return text.value.home.stages.find((stage) => stage.number === stageNumber)?.label ?? ''
}

function stageProgress(stageNumber: string): number {
  const stages = text.value.home.stages
  const index = stages.findIndex((stage) => stage.number === stageNumber)
  if (index <= 0) return 0
  return Math.round((index / Math.max(stages.length - 1, 1)) * 100)
}

function onCardDragStart(cardId: string, event: DragEvent) {
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
  if (!cardId) return
  const index = cards.value.findIndex((card) => card.id === cardId)
  if (index === -1) return
  const [card] = cards.value.splice(index, 1)
  if (!card) return
  const previousStage = card.stageNumber
  card.stageNumber = stageNumber
  cards.value.push(card)

  if (supabase && previousStage !== stageNumber) {
    const { error: updateError } = await supabase
      .from('kanban_cards')
      .update({ stage_number: stageNumber })
      .eq('id', card.id)
    if (updateError) card.stageNumber = previousStage
  }
}

onUnmounted(() => {
  revokePreview()
  for (const card of cards.value) {
    if (card.imageUrl?.startsWith('blob:')) URL.revokeObjectURL(card.imageUrl)
  }
})
</script>

<template>
  <main class="flex flex-1 flex-col px-6 sm:px-10">
    <section class="mx-auto flex w-full max-w-6xl flex-1 flex-col justify-center py-12 sm:py-16" aria-labelledby="page-title">
      <div class="max-w-3xl">
        <p class="mb-4 text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">{{ text.home.eyebrow }}</p>
        <h1 id="page-title" class="font-bagel-fat-one text-5xl leading-[1.05] tracking-tight text-zinc-950 sm:text-7xl dark:text-zinc-50">
          {{ text.home.titleLine1 }}<br />{{ text.home.titleLine2 }}
        </h1>
        <p class="mt-6 text-base leading-7 text-zinc-600 sm:text-lg dark:text-zinc-300">{{ text.home.intro }}</p>
      </div>

      <div class="surface-shadow mt-12 rounded-2xl border border-zinc-200 bg-white p-6 sm:mt-16 sm:p-7 dark:border-zinc-800 dark:bg-zinc-900">
        <div class="flex flex-wrap items-center justify-between gap-4">
          <div class="flex flex-wrap items-center gap-3">
            <span class="text-xs font-medium tracking-[0.12em] text-zinc-500 dark:text-zinc-400">{{ text.home.boardHeading }}</span>
            <label v-if="boards.length" class="inline-flex items-center">
              <span class="sr-only">{{ text.home.selectBoard }}</span>
              <select
                v-model="selectedBoardId"
                class="min-h-11 rounded-xl border border-zinc-300 bg-white px-3 text-sm font-normal text-zinc-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-50 dark:focus-visible:outline-zinc-100"
              >
                <option v-for="board in boards" :key="board.id" :value="board.id">{{ board.title }}</option>
              </select>
            </label>
          </div>

          <DialogRoot :open="open" @update:open="onOpenChange">
            <DialogTrigger as-child>
              <motion.button
                type="button"
                :while-tap="reducedMotion ? undefined : { scale: 0.98 }"
                :transition="{ duration: 0.14 }"
                class="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300 dark:focus-visible:outline-zinc-100"
              >
                <Plus :size="18" aria-hidden="true" />
                {{ text.home.addCard }}
              </motion.button>
            </DialogTrigger>

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
                      <DialogTitle class="text-3xl font-semibold tracking-tight sm:text-4xl">{{ text.home.createCardTitle }}</DialogTitle>
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
                      {{ text.home.createCardDescription }}
                    </DialogDescription>

                    <form class="mt-7 space-y-5" @submit.prevent="submitCard">
                      <div>
                        <label for="card-title" class="block text-sm font-medium">{{ text.home.titleLabel }}</label>
                        <input id="card-title" v-model="title" type="text" required maxlength="120" :class="fieldClass" />
                      </div>

                      <div>
                        <label for="card-description" class="block text-sm font-medium">{{ text.home.descriptionLabel }}</label>
                        <textarea id="card-description" v-model="description" required maxlength="240" rows="3" :class="fieldClass" />
                      </div>

                      <div>
                        <label for="card-requestor" class="block text-sm font-medium">{{ text.home.requestorLabel }}</label>
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
                        <p id="card-image-label" class="block text-sm font-medium">{{ text.home.imageLabel }}</p>
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
                              class="cursor-pointer rounded-xl bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-900 hover:bg-zinc-200 dark:bg-zinc-700 dark:text-zinc-50 dark:hover:bg-zinc-600"
                            >
                              {{ text.home.chooseImage }}
                            </label>
                            <span class="text-sm text-zinc-600 dark:text-zinc-300">{{ text.home.dropImage }}</span>
                          </div>

                          <img
                            v-if="imageFile && previewUrl"
                            :src="previewUrl"
                            :alt="text.home.imagePreview"
                            class="mt-4 max-h-64 w-full rounded-xl bg-zinc-100 object-contain dark:bg-zinc-800"
                          />

                          <div v-if="imageFile || imageError" class="mt-4 flex items-center justify-between gap-3">
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
                        class="inline-flex min-h-11 items-center justify-center rounded-xl bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300 dark:focus-visible:outline-zinc-100"
                      >
                        {{ pending ? text.home.savingCard : text.home.submitCard }}
                      </motion.button>
                    </form>
                  </motion.div>
                </DialogContent>
              </div>
            </DialogPortal>
          </DialogRoot>
        </div>

        <div class="mt-6 flex gap-3 overflow-x-auto" :aria-label="text.home.stagesLabel">
          <div
            v-for="stage in text.home.stages"
            :key="stage.number"
            :class="[
              'flex min-w-60 flex-1 flex-col gap-3 rounded-xl p-4 text-base text-zinc-900 transition-colors dark:text-zinc-100',
              dragOverStage === stage.number ? 'bg-orange-50/60 ring-2 ring-orange-500 dark:bg-zinc-800/80 dark:ring-orange-400' : 'bg-zinc-100 dark:bg-zinc-800',
            ]"
            @dragover.prevent="onColumnDragOver(stage.number, $event)"
            @dragenter.prevent="onColumnDragOver(stage.number, $event)"
            @dragleave="onColumnDragLeave(stage.number, $event)"
            @drop.prevent="onColumnDrop(stage.number, $event)"
          >
            <div class="flex items-center gap-3">
              <span class="grid size-8 flex-none place-items-center rounded-full bg-zinc-200 text-xs font-medium text-zinc-700 dark:bg-zinc-700 dark:text-zinc-200">
                {{ stage.number }}
              </span>
              <span>{{ stage.label }}</span>
            </div>

            <div v-if="cardsForStage(stage.number).length" class="space-y-3">
              <article
                v-for="card in cardsForStage(stage.number)"
                :key="card.id"
                draggable="true"
                :class="[
                  'cursor-grab rounded-2xl bg-white p-4 text-zinc-950 shadow-xs transition-opacity active:cursor-grabbing dark:bg-zinc-900 dark:text-zinc-50',
                  draggingCardId === card.id ? 'opacity-50' : '',
                ]"
                @dragstart="onCardDragStart(card.id, $event)"
                @dragend="onCardDragEnd"
              >
                <img
                  v-if="card.imageUrl"
                  :src="card.imageUrl"
                  :alt="card.title"
                  draggable="false"
                  class="mb-3 aspect-4/3 w-full rounded-xl bg-zinc-100 object-cover dark:bg-zinc-800"
                />
                <h2 class="text-base font-medium">{{ card.title }}</h2>
                <p class="mt-1 text-sm leading-6 text-zinc-600 dark:text-zinc-300">{{ card.description }}</p>
                <div class="mt-3">
                  <div class="flex items-center justify-between gap-2 text-xs font-medium text-zinc-600 dark:text-zinc-300">
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
                      class="h-full rounded-full bg-orange-500 transition-all duration-300 dark:bg-orange-400"
                      :style="{ width: `${stageProgress(card.stageNumber)}%` }"
                    />
                  </div>
                </div>
                <div class="mt-3 flex flex-wrap gap-1.5">
                  <span
                    v-for="requestor in card.requestors"
                    :key="requestor"
                    class="rounded-full bg-orange-100 px-3 py-1 text-xs text-orange-800 dark:bg-zinc-800 dark:text-orange-200"
                  >
                    {{ requestor }}
                  </span>
                </div>
              </article>
            </div>
          </div>
        </div>

        <p class="mt-5 text-sm text-zinc-500 dark:text-zinc-400">{{ text.home.boardMessage }}</p>
      </div>
    </section>
  </main>
</template>
