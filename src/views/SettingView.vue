<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { Check, FileText, Pencil, Plus, Search, Trash2, X } from '@lucide/vue'
import { motion, useReducedMotion } from 'motion-v'
import {
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogOverlay,
  AlertDialogPortal,
  AlertDialogRoot,
  AlertDialogTitle,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogOverlay,
  DialogPortal,
  DialogRoot,
  DialogTitle,
} from 'reka-ui'
import ConfirmDialog from '../components/ui/ConfirmDialog.vue'
import KanbanCardFormDialog from '../components/commission/KanbanCardFormDialog.vue'
import SelectField from '../components/ui/SelectField.vue'
import { useLanguage } from '../composables/useLanguage'
import {
  deleteKanbanCard,
  formatCardDate,
  type KanbanCard,
  type KanbanCardRow,
  toKanbanCard,
} from '../lib/kanbanCard'
import { stageLabel, stageProgress } from '../lib/kanbanStage'
import { supabase } from '../lib/supabase'

interface KanbanBoard {
  id: string
  title: string
  description: string | null
  is_active: boolean
  is_backlog: boolean
  created_at?: string
}

const BACKLOG_BOARD_ID = '00000000-0000-0000-0000-000000000000'

const { language, text } = useLanguage()
const router = useRouter()
const prefersReducedMotion = useReducedMotion()

const boards = ref<KanbanBoard[]>(
  supabase
    ? []
    : [
        {
          id: BACKLOG_BOARD_ID,
          title: 'Backlog',
          description: 'Cards waiting to be assigned to a board.',
          is_active: false,
          is_backlog: true,
        },
      ],
)
type BoardFilter = 'all' | 'active' | 'inactive' | 'completed'
type BacklogSortOrder = 'newest' | 'oldest'

const cards = ref<KanbanCard[]>([])
const loading = ref(!!supabase)
const loadError = ref('')
const query = ref('')
const statusFilter = ref<BoardFilter>('active')
const backlogSortOrder = ref<BacklogSortOrder>('newest')

const dialogOpen = ref(false)
const editingBoard = ref<KanbanBoard | null>(null)
const titleInput = ref('')
const descriptionInput = ref('')
const saving = ref(false)
const formError = ref('')

const activeBusyId = ref('')
const switchTargetBoard = ref<KanbanBoard | null>(null)
const switchDialogOpen = ref(false)
const switchPending = ref(false)
const switchError = ref('')

const cardDialogOpen = ref(false)
const targetCardBoard = ref<KanbanBoard | null>(null)
const editingCard = ref<KanbanCard | null>(null)

const selectedCardIds = ref<string[]>([])
const draggingCardIds = ref<string[]>([])
const dragOverBoardId = ref('')

function isBoardCompleted(board: KanbanBoard): boolean {
  if (board.is_backlog) return false
  const boardCards = cardsForBoard(board.id)
  return boardCards.length > 0 && boardCards.every((card) => card.stageNumber === '06')
}

const filteredBoards = computed(() => {
  const q = query.value.trim().toLowerCase()
  return boards.value.filter((board) => {
    const matchesStatus =
      statusFilter.value === 'all'
        ? true
        : statusFilter.value === 'active'
          ? board.is_backlog || board.is_active
          : statusFilter.value === 'inactive'
            ? board.is_backlog || !board.is_active
            : !board.is_backlog && isBoardCompleted(board)

    if (!matchesStatus) return false
    if (!q) return true
    return (
      board.title.toLowerCase().includes(q) ||
      (board.description?.toLowerCase().includes(q) ?? false)
    )
  })
})

const boardFilterOptions = computed<{ value: BoardFilter; label: string }[]>(() => [
  { value: 'all', label: text.value.setting.filterAll },
  { value: 'active', label: text.value.setting.filterActive },
  { value: 'inactive', label: text.value.setting.filterInactive },
  { value: 'completed', label: text.value.setting.filterCompleted },
])
const backlogSortOptions = computed<{ value: BacklogSortOrder; label: string }[]>(() => [
  { value: 'newest', label: text.value.setting.backlogSortNewest },
  { value: 'oldest', label: text.value.setting.backlogSortOldest },
])

function cardsForBoard(boardId: string): KanbanCard[] {
  const boardCards = cards.value.filter((card) => card.boardId === boardId)
  const board = boards.value.find((item) => item.id === boardId)
  if (!board?.is_backlog) return boardCards
  return [...boardCards].sort((a, b) => {
    const timeA = Date.parse(a.createdAt ?? '') || 0
    const timeB = Date.parse(b.createdAt ?? '') || 0
    return backlogSortOrder.value === 'newest' ? timeB - timeA : timeA - timeB
  })
}

function isCardSelected(cardId: string): boolean {
  return selectedCardIds.value.includes(cardId)
}

function toggleCardSelected(cardId: string) {
  if (isCardSelected(cardId)) {
    selectedCardIds.value = selectedCardIds.value.filter((id) => id !== cardId)
  } else {
    selectedCardIds.value = [...selectedCardIds.value, cardId]
  }
}

function isAllBoardCardsSelected(boardId: string): boolean {
  const boardCards = cardsForBoard(boardId)
  return boardCards.length > 0 && boardCards.every((card) => isCardSelected(card.id))
}

function isSomeBoardCardsSelected(boardId: string): boolean {
  const boardCards = cardsForBoard(boardId)
  if (boardCards.length === 0) return false
  const selectedCount = boardCards.filter((card) => isCardSelected(card.id)).length
  return selectedCount > 0 && selectedCount < boardCards.length
}

function toggleAllBoardCards(boardId: string) {
  const boardCardIds = cardsForBoard(boardId).map((card) => card.id)
  if (boardCardIds.length === 0) return
  if (isAllBoardCardsSelected(boardId)) {
    const idSet = new Set(boardCardIds)
    selectedCardIds.value = selectedCardIds.value.filter((id) => !idSet.has(id))
  } else {
    const next = new Set(selectedCardIds.value)
    for (const id of boardCardIds) next.add(id)
    selectedCardIds.value = [...next]
  }
}

function cardStatusLabel(board: KanbanBoard, card: KanbanCard): string {
  if (board.is_backlog) return text.value.setting.backlogStatus
  return stageLabel(card.stageNumber, text.value.home.stages)
}

function cardProgress(board: KanbanBoard, card: KanbanCard): number {
  if (board.is_backlog) return 0
  return stageProgress(card.stageNumber, text.value.home.stages)
}

const subscription = supabase?.auth.onAuthStateChange((_event, session) => {
  if (!session) void router.replace('/')
})

onMounted(() => {
  void loadBoardsAndCards()
})

onUnmounted(() => {
  subscription?.data.subscription.unsubscribe()
  for (const card of cards.value) {
    if (card.imageUrl?.startsWith('blob:')) URL.revokeObjectURL(card.imageUrl)
  }
})

async function loadBoardsAndCards() {
  loading.value = true
  loadError.value = ''

  if (!supabase) {
    loading.value = false
    return
  }

  const [boardsResult, cardsResult] = await Promise.all([
    supabase
      .from('kanban_boards')
      .select('id,title,description,is_active,is_backlog,created_at')
      .order('is_backlog', { ascending: true })
      .order('created_at', { ascending: false }),
    supabase
      .from('kanban_cards')
      .select('id,board_id,stage_number,commission_type,title,description,requestors,image_path,created_at,updated_at')
      .order('created_at', { ascending: true }),
  ])

  if (boardsResult.error) {
    loadError.value = boardsResult.error.message
  } else {
    boards.value = (boardsResult.data ?? []) as KanbanBoard[]
  }

  if (cardsResult.error && !loadError.value) {
    loadError.value = cardsResult.error.message
  } else if (cardsResult.data) {
    cards.value = (cardsResult.data as KanbanCardRow[]).map(toKanbanCard)
  }

  loading.value = false
}

function resetBoardDialog() {
  editingBoard.value = null
  titleInput.value = ''
  descriptionInput.value = ''
  formError.value = ''
}

function onDialogOpenChange(open: boolean) {
  if (saving.value) return
  dialogOpen.value = open
  if (!open) resetBoardDialog()
}

function openCreateBoard() {
  resetBoardDialog()
  dialogOpen.value = true
}

function openEditBoard(board: KanbanBoard) {
  resetBoardDialog()
  editingBoard.value = board
  titleInput.value = board.title
  descriptionInput.value = board.description ?? ''
  dialogOpen.value = true
}

function boardSaveErrorMessage(error: { code?: string; message?: string } | null) {
  if (error?.code === '23505') return text.value.setting.duplicateTitle
  return error?.message || text.value.setting.saveBoardError
}

async function handleSaveBoard() {
  const trimmedTitle = titleInput.value.trim()
  if (!trimmedTitle) {
    formError.value = text.value.setting.requiredTitle
    return
  }

  const trimmedDescription = descriptionInput.value.trim()
  const nextDescription = trimmedDescription || null
  const editing = editingBoard.value
  const normalizedTitle = trimmedTitle.toLowerCase()
  if (
    boards.value.some(
      (item) => item.id !== editing?.id && item.title.trim().toLowerCase() === normalizedTitle,
    )
  ) {
    formError.value = text.value.setting.duplicateTitle
    return
  }

  saving.value = true
  formError.value = ''

  if (!supabase) {
    if (editing) {
      boards.value = boards.value.map((item) =>
        item.id === editing.id
          ? { ...item, title: trimmedTitle, description: nextDescription }
          : item,
      )
    } else {
      const backlog = boards.value.filter((item) => item.is_backlog)
      const regular = boards.value.filter((item) => !item.is_backlog)
      boards.value = [
        {
          id: crypto.randomUUID(),
          title: trimmedTitle,
          description: nextDescription,
          is_active: false,
          is_backlog: false,
        },
        ...regular,
        ...backlog,
      ]
    }
    saving.value = false
    onDialogOpenChange(false)
    return
  }

  if (editing) {
    const { data, error } = await supabase
      .from('kanban_boards')
      .update({
        title: trimmedTitle,
        description: nextDescription,
      })
      .eq('id', editing.id)
      .select('id,title,description,is_active,is_backlog,created_at')
      .single()

    saving.value = false

    if (error || !data) {
      formError.value = boardSaveErrorMessage(error)
      return
    }

    const updated = data as KanbanBoard
    boards.value = boards.value.map((item) => (item.id === updated.id ? updated : item))
    onDialogOpenChange(false)
    return
  }

  const { data, error } = await supabase
    .from('kanban_boards')
    .insert({
      title: trimmedTitle,
      description: nextDescription,
      is_active: false,
    })
    .select('id,title,description,is_active,is_backlog,created_at')
    .single()

  saving.value = false

  if (error || !data) {
    formError.value = boardSaveErrorMessage(error)
    return
  }

  const created = data as KanbanBoard
  const backlog = boards.value.filter((item) => item.is_backlog)
  const regular = boards.value.filter((item) => !item.is_backlog)
  boards.value = [created, ...regular, ...backlog]
  onDialogOpenChange(false)
}

async function deleteBoard(board: KanbanBoard) {
  if (board.is_backlog) return

  if (supabase) {
    const { data: cardRows } = await supabase
      .from('kanban_cards')
      .select('image_path')
      .eq('board_id', board.id)

    const { error } = await supabase.from('kanban_boards').delete().eq('id', board.id)
    if (error) throw error

    const imagePaths = ((cardRows ?? []) as Array<{ image_path: string | null }>)
      .map((row) => row.image_path)
      .filter((path): path is string => Boolean(path))

    if (imagePaths.length > 0) {
      await supabase.storage.from('kanban-images').remove(imagePaths).catch(() => {})
    }
  }

  for (const card of cards.value) {
    if (card.boardId === board.id && card.imageUrl?.startsWith('blob:')) {
      URL.revokeObjectURL(card.imageUrl)
    }
  }
  const deletedBoardCardIds = new Set(
    cards.value.filter((item) => item.boardId === board.id).map((item) => item.id),
  )
  selectedCardIds.value = selectedCardIds.value.filter((id) => !deletedBoardCardIds.has(id))
  cards.value = cards.value.filter((item) => item.boardId !== board.id)
  boards.value = boards.value.filter((item) => item.id !== board.id)
}

async function activateBoard(board: KanbanBoard) {
  if (supabase) {
    const { error: clearError } = await supabase
      .from('kanban_boards')
      .update({ is_active: false })
      .eq('is_active', true)

    if (clearError) throw clearError

    const { error: activateError } = await supabase
      .from('kanban_boards')
      .update({ is_active: true })
      .eq('id', board.id)

    if (activateError) throw activateError
  }

  boards.value = boards.value.map((item) => ({
    ...item,
    is_active: item.id === board.id,
  }))
}

async function deactivateBoard(board: KanbanBoard) {
  activeBusyId.value = board.id
  loadError.value = ''
  try {
    if (supabase) {
      const { error } = await supabase
        .from('kanban_boards')
        .update({ is_active: false })
        .eq('id', board.id)

      if (error) throw error
    }
    boards.value = boards.value.map((item) =>
      item.id === board.id ? { ...item, is_active: false } : item,
    )
  } catch (err) {
    loadError.value = err instanceof Error ? err.message : text.value.setting.switchActiveError
  } finally {
    activeBusyId.value = ''
  }
}

async function handleActiveClick(board: KanbanBoard) {
  if (board.is_backlog || activeBusyId.value) return
  if (board.is_active) {
    await deactivateBoard(board)
    return
  }

  const hasOtherActive = boards.value.some((item) => item.is_active && item.id !== board.id)
  if (hasOtherActive) {
    switchTargetBoard.value = board
    switchError.value = ''
    switchDialogOpen.value = true
    return
  }

  activeBusyId.value = board.id
  loadError.value = ''
  try {
    await activateBoard(board)
  } catch (err) {
    loadError.value = err instanceof Error ? err.message : text.value.setting.switchActiveError
  } finally {
    activeBusyId.value = ''
  }
}

function onSwitchDialogOpenChange(open: boolean) {
  if (switchPending.value) return
  switchDialogOpen.value = open
  if (!open) {
    switchTargetBoard.value = null
    switchError.value = ''
  }
}

async function confirmSwitchActive() {
  const target = switchTargetBoard.value
  if (!target || switchPending.value) return

  switchPending.value = true
  switchError.value = ''
  try {
    await activateBoard(target)
    switchDialogOpen.value = false
    switchTargetBoard.value = null
  } catch {
    switchError.value = text.value.setting.switchActiveError
  } finally {
    switchPending.value = false
  }
}

function openAddCard(board: KanbanBoard) {
  targetCardBoard.value = board
  editingCard.value = null
  cardDialogOpen.value = true
}

function openEditCard(card: KanbanCard, board: KanbanBoard) {
  targetCardBoard.value = board
  editingCard.value = card
  cardDialogOpen.value = true
}

function onCardSaved(savedCard: KanbanCard, isEdit: boolean) {
  if (isEdit) {
    const index = cards.value.findIndex((item) => item.id === savedCard.id)
    if (index !== -1) cards.value[index] = savedCard
  } else {
    cards.value.push(savedCard)
  }
}

async function deleteCard(card: KanbanCard) {
  await deleteKanbanCard(card)
  selectedCardIds.value = selectedCardIds.value.filter((id) => id !== card.id)
  cards.value = cards.value.filter((item) => item.id !== card.id)
}

function parseDraggedCardIds(raw: string | undefined): string[] {
  if (!raw) return []
  try {
    const parsed: unknown = JSON.parse(raw)
    if (Array.isArray(parsed)) {
      return parsed.filter((item): item is string => typeof item === 'string' && item.length > 0)
    }
  } catch {
    return [raw]
  }
  return [raw]
}

function onCardDragStart(cardId: string, event: DragEvent) {
  const ids = isCardSelected(cardId) ? [...selectedCardIds.value] : [cardId]
  draggingCardIds.value = ids
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', JSON.stringify(ids))
  }
}

function onCardDragEnd() {
  draggingCardIds.value = []
  dragOverBoardId.value = ''
}

function onBoardDragOver(boardId: string, event: DragEvent) {
  if (draggingCardIds.value.length === 0) return
  if (event.dataTransfer) event.dataTransfer.dropEffect = 'move'
  dragOverBoardId.value = boardId
}

function onBoardDragLeave(boardId: string, event: DragEvent) {
  if (dragOverBoardId.value !== boardId) return
  const currentTarget = event.currentTarget as HTMLElement | null
  const related = event.relatedTarget as Node | null
  if (!related || !currentTarget?.contains(related)) dragOverBoardId.value = ''
}

async function onBoardDrop(targetBoard: KanbanBoard, event: DragEvent) {
  const ids =
    draggingCardIds.value.length > 0
      ? [...draggingCardIds.value]
      : parseDraggedCardIds(event.dataTransfer?.getData('text/plain'))
  onCardDragEnd()
  if (ids.length === 0) return

  const draggedIdSet = new Set(ids)
  const targetCards = cards.value.filter(
    (item) => draggedIdSet.has(item.id) && item.boardId !== targetBoard.id,
  )
  if (targetCards.length === 0) return

  const nextStage = text.value.home.stages[0]?.number ?? '01'
  const previousStates = targetCards.map((item) => ({
    card: item,
    boardId: item.boardId,
    stageNumber: item.stageNumber,
  }))
  const movedIds = targetCards.map((item) => item.id)
  const movedIdSet = new Set(movedIds)

  for (const item of targetCards) {
    item.boardId = targetBoard.id
    item.stageNumber = nextStage
  }
  selectedCardIds.value = selectedCardIds.value.filter((id) => !movedIdSet.has(id))

  if (supabase) {
    const { error } = await supabase
      .from('kanban_cards')
      .update({
        board_id: targetBoard.id,
        stage_number: nextStage,
      })
      .in('id', movedIds)

    if (error) {
      for (const prev of previousStates) {
        prev.card.boardId = prev.boardId
        prev.card.stageNumber = prev.stageNumber
      }
      loadError.value = error.message
    }
  }
}
</script>

<template>
  <main class="flex flex-1 flex-col px-6 sm:px-10">
    <section
      class="mx-auto flex w-full max-w-6xl flex-1 flex-col py-12 sm:py-16"
      aria-labelledby="page-title"
    >
      <div class="flex flex-wrap items-end justify-between gap-4">
        <div class="max-w-3xl">
          <p class="mb-4 text-xs uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
            {{ text.setting.eyebrow }}
          </p>
          <h1
            id="page-title"
            class="font-bagel-fat-one text-5xl leading-[1.05] tracking-tight text-zinc-950 sm:text-7xl dark:text-zinc-50"
          >
            {{ text.setting.title }}
          </h1>
          <p class="mt-4 text-base leading-7 text-zinc-600 sm:text-lg dark:text-zinc-300">
            {{ text.setting.description }}
          </p>
        </div>

        <button
          type="button"
          class="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-zinc-900 px-4 py-2 text-sm text-white transition-colors hover:bg-zinc-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300 dark:focus-visible:ring-zinc-300"
          @click="openCreateBoard"
        >
          <Plus class="size-4" aria-hidden="true" />
          {{ text.setting.addBoard }}
        </button>
      </div>

      <DialogRoot :open="dialogOpen" @update:open="onDialogOpenChange">
        <DialogPortal>
          <DialogOverlay class="fixed inset-0 z-50 bg-black/45 backdrop-blur-[2px]" />
          <DialogContent
            class="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 outline-none"
          >
            <motion.div
              data-lenis-prevent
              :initial="prefersReducedMotion ? false : { opacity: 0, scale: 0.96 }"
              :animate="{ opacity: 1, scale: 1 }"
              :transition="prefersReducedMotion ? { duration: 0 } : { duration: 0.16, ease: 'easeOut' }"
              class="surface-shadow max-h-[85dvh] overflow-y-auto rounded-2xl border border-zinc-200 bg-white p-6 text-zinc-950 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
            >
              <div class="flex items-start justify-between gap-4">
                <div>
                  <DialogTitle class="text-lg font-bold">
                    {{ editingBoard ? text.setting.editBoardTitle : text.setting.createBoardTitle }}
                  </DialogTitle>
                  <DialogDescription class="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                    {{ editingBoard ? text.setting.editBoardDescription : text.setting.createBoardDescription }}
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

              <form class="mt-5 space-y-4" @submit.prevent="handleSaveBoard">
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
                    class="min-h-11 w-full rounded-xl border border-zinc-300 bg-white px-4 text-sm text-zinc-950 outline-none focus:ring-2 focus:ring-zinc-900 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-50 dark:focus:ring-zinc-300"
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
                    class="w-full rounded-xl border border-zinc-300 bg-white px-4 py-2.5 text-sm text-zinc-950 outline-none focus:ring-2 focus:ring-zinc-900 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-50 dark:focus:ring-zinc-300"
                  />
                </div>

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
                  <button
                    type="submit"
                    :disabled="saving"
                    class="inline-flex min-h-11 items-center justify-center rounded-xl bg-zinc-900 px-4 py-2 text-sm text-white transition-colors hover:bg-zinc-700 disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
                  >
                    {{
                      editingBoard
                        ? saving
                          ? text.setting.savingChanges
                          : text.setting.saveChanges
                        : saving
                          ? text.setting.savingBoard
                          : text.setting.submitBoard
                    }}
                  </button>
                </div>
              </form>
            </motion.div>
          </DialogContent>
        </DialogPortal>
      </DialogRoot>

      <KanbanCardFormDialog
        v-model:open="cardDialogOpen"
        :board-id="targetCardBoard?.id ?? ''"
        :card="editingCard"
        :show-stage="!(targetCardBoard?.is_backlog ?? false)"
        id-prefix="setting-card"
        @saved="onCardSaved"
      />

      <AlertDialogRoot :open="switchDialogOpen" @update:open="onSwitchDialogOpenChange">
        <AlertDialogPortal>
          <AlertDialogOverlay class="fixed inset-0 z-60 bg-zinc-950/50" />
          <div class="pointer-events-none fixed inset-0 z-70 flex items-center justify-center p-6">
            <AlertDialogContent as-child>
              <motion.div
                :initial="prefersReducedMotion ? false : { opacity: 0, scale: 0.96, y: 8 }"
                :animate="{ opacity: 1, scale: 1, y: 0 }"
                :transition="{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }"
                class="surface-shadow pointer-events-auto w-full max-w-sm rounded-3xl bg-white p-7 text-zinc-950 focus:outline-none dark:bg-zinc-900 dark:text-zinc-50"
              >
                <AlertDialogTitle class="text-3xl font-bold">
                  {{ text.setting.switchActiveTitle }}
                </AlertDialogTitle>
                <AlertDialogDescription class="mt-3 leading-6 text-zinc-600 dark:text-zinc-300">
                  {{ text.setting.switchActiveDescription }}
                </AlertDialogDescription>
                <p v-if="switchError" role="alert" class="mt-4 text-sm text-red-700 dark:text-red-400">
                  {{ switchError }}
                </p>
                <div class="mt-7 flex flex-wrap justify-end gap-3">
                  <AlertDialogCancel
                    :disabled="switchPending"
                    class="min-h-11 rounded-full px-5 text-sm hover:bg-zinc-100 focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50 dark:hover:bg-zinc-800"
                  >
                    {{ text.setting.switchActiveCancel }}
                  </AlertDialogCancel>
                  <button
                    type="button"
                    :disabled="switchPending"
                    class="min-h-11 rounded-full bg-zinc-900 px-5 text-sm text-white hover:bg-zinc-700 focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
                    @click="confirmSwitchActive"
                  >
                    {{ switchPending ? text.setting.switchingActive : text.setting.switchActiveConfirm }}
                  </button>
                </div>
              </motion.div>
            </AlertDialogContent>
          </div>
        </AlertDialogPortal>
      </AlertDialogRoot>

      <form class="mt-8 flex flex-wrap gap-3" role="search" @submit.prevent>
        <label for="board-search" class="sr-only">{{ text.setting.searchBoards }}</label>
        <div class="relative min-w-48 flex-1">
          <Search
            class="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-zinc-400"
            aria-hidden="true"
          />
          <input
            id="board-search"
            v-model="query"
            type="search"
            :placeholder="text.setting.searchBoardsPlaceholder"
            class="min-h-11 w-full rounded-xl border border-zinc-300 bg-white pl-11 pr-4 text-sm text-zinc-950 outline-none placeholder:text-zinc-400 focus:ring-2 focus:ring-zinc-900 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-50 dark:placeholder:text-zinc-500 dark:focus:ring-zinc-300"
          />
        </div>
        <div class="w-40">
          <label for="board-filter" class="sr-only">{{ text.setting.filterBoards }}</label>
          <SelectField
            id="board-filter"
            v-model="statusFilter"
            :options="boardFilterOptions"
            :aria-label="text.setting.filterBoards"
          />
        </div>
      </form>

      <div class="mt-6">
        <p
          v-if="loadError"
          role="alert"
          class="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300"
        >
          {{ loadError }}
        </p>

        <div v-if="loading" class="flex flex-col gap-4">
          <div
            v-for="n in 3"
            :key="n"
            class="h-40 w-full animate-pulse rounded-2xl border border-zinc-200 bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900"
          />
        </div>

        <div
          v-else-if="boards.length === 0"
          class="mx-auto flex min-h-72 flex-col items-center justify-center px-6 py-12 text-center"
        >
          <span
            aria-hidden="true"
            class="flex size-16 items-center justify-center rounded-2xl bg-orange-100 text-orange-700 dark:bg-zinc-800 dark:text-orange-300"
          >
            <FileText :size="30" />
          </span>
          <h2 class="mt-6 font-sniglet text-3xl font-bold text-zinc-950 dark:text-zinc-50">
            {{ text.setting.emptyTitle }}
          </h2>
          <p class="mt-3 max-w-sm leading-7 text-zinc-600 dark:text-zinc-300">
            {{ text.setting.emptyDescription }}
          </p>
        </div>

        <p
          v-else-if="filteredBoards.length === 0"
          class="rounded-2xl border border-dashed border-zinc-300 px-6 py-10 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400"
        >
          {{ text.setting.noSearchResults }}
        </p>

        <ul v-else class="flex flex-col gap-4">
          <li
            v-for="board in filteredBoards"
            :key="board.id"
            :class="[
              'surface-shadow flex w-full flex-col gap-4 rounded-2xl border bg-white p-5 transition-colors sm:p-6 dark:bg-zinc-900',
              dragOverBoardId === board.id
                ? 'border-orange-500 bg-orange-50/40 ring-2 ring-orange-500 dark:border-orange-400 dark:bg-zinc-800/80 dark:ring-orange-400'
                : 'border-zinc-200 dark:border-zinc-800',
            ]"
            @dragover.prevent="onBoardDragOver(board.id, $event)"
            @dragenter.prevent="onBoardDragOver(board.id, $event)"
            @dragleave="onBoardDragLeave(board.id, $event)"
            @drop.prevent="onBoardDrop(board, $event)"
          >
            <div class="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div class="flex flex-wrap items-center gap-2.5">
                  <h2 class="text-2xl font-bold text-zinc-950 sm:text-3xl dark:text-zinc-50">
                    {{ board.title }}
                  </h2>
                  <span class="rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                    {{ cardsForBoard(board.id).length }}
                  </span>
                </div>
                <p
                  v-if="board.description"
                  class="mt-1 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400"
                >
                  {{ board.description }}
                </p>
              </div>

              <div class="flex flex-wrap items-center gap-2">
                <div v-if="board.is_backlog" class="w-44">
                  <label for="backlog-sort" class="sr-only">{{ text.setting.backlogSortLabel }}</label>
                  <SelectField
                    id="backlog-sort"
                    v-model="backlogSortOrder"
                    :options="backlogSortOptions"
                    :aria-label="text.setting.backlogSortLabel"
                  />
                </div>
                <button
                  type="button"
                  class="inline-flex min-h-9 items-center gap-1.5 rounded-full bg-zinc-900 px-3.5 py-1.5 text-xs text-white transition-colors hover:bg-zinc-700 focus-visible:outline-2 focus-visible:outline-offset-2 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
                  @click="openAddCard(board)"
                >
                  <Plus :size="14" aria-hidden="true" />
                  {{ text.home.addCard }}
                </button>

                <template v-if="!board.is_backlog">
                  <button
                    type="button"
                    :disabled="activeBusyId === board.id"
                    :aria-pressed="board.is_active"
                    :class="[
                      'inline-flex min-h-9 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50',
                      board.is_active
                        ? 'bg-orange-500/15 text-orange-700 hover:bg-orange-500/25 dark:bg-orange-400/15 dark:text-orange-300 dark:hover:bg-orange-400/25'
                        : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700',
                    ]"
                    @click="handleActiveClick(board)"
                  >
                    <Check v-if="board.is_active" :size="14" aria-hidden="true" />
                    {{ board.is_active ? text.setting.activeBadge : text.setting.makeActive }}
                  </button>

                  <button
                    type="button"
                    :aria-label="`${text.setting.editBoard}: ${board.title}`"
                    :title="text.setting.editBoard"
                    class="flex size-9 items-center justify-center rounded-xl text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-950 focus-visible:outline-2 focus-visible:outline-offset-2 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-zinc-50"
                    @click="openEditBoard(board)"
                  >
                    <Pencil :size="16" aria-hidden="true" />
                  </button>

                  <ConfirmDialog
                    :title="text.setting.deleteBoardTitle"
                    :description="text.setting.deleteBoardDescription"
                    :cancel-label="text.login.cancel"
                    :confirm-label="text.setting.deleteBoard"
                    :pending-label="text.setting.deletingBoard"
                    :error-message="text.setting.deleteBoardError"
                    :on-confirm="() => deleteBoard(board)"
                  >
                    <button
                      type="button"
                      :aria-label="`${text.setting.deleteBoard}: ${board.title}`"
                      :title="text.setting.deleteBoard"
                      class="flex size-9 items-center justify-center rounded-xl text-red-700 transition-colors hover:bg-red-50 focus-visible:outline-2 focus-visible:outline-offset-2 dark:text-red-300 dark:hover:bg-red-950"
                    >
                      <Trash2 :size="16" aria-hidden="true" />
                    </button>
                  </ConfirmDialog>
                </template>
              </div>
            </div>

            <div class="rounded-xl bg-zinc-100 p-2.5 dark:bg-zinc-800/70">
              <div v-if="cardsForBoard(board.id).length" class="flex flex-col gap-2">
                <div class="flex items-center px-3 py-1">
                  <label class="inline-flex cursor-pointer select-none items-center gap-2.5 text-xs text-zinc-600 dark:text-zinc-300">
                    <input
                      type="checkbox"
                      :checked="isAllBoardCardsSelected(board.id)"
                      :indeterminate.prop="isSomeBoardCardsSelected(board.id)"
                      class="size-4 cursor-pointer rounded border-zinc-300 accent-zinc-900 dark:border-zinc-600 dark:accent-zinc-100"
                      @change="toggleAllBoardCards(board.id)"
                    />
                    <span>{{ text.setting.selectAllCards }}</span>
                  </label>
                </div>
                <article
                  v-for="card in cardsForBoard(board.id)"
                  :key="card.id"
                  draggable="true"
                  :class="[
                    'flex w-full cursor-grab items-center gap-3 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-zinc-950 shadow-xs transition-opacity active:cursor-grabbing dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50',
                    draggingCardIds.includes(card.id) ? 'opacity-50' : '',
                  ]"
                  @dragstart="onCardDragStart(card.id, $event)"
                  @dragend="onCardDragEnd"
                >
                  <input
                    type="checkbox"
                    :checked="isCardSelected(card.id)"
                    :aria-label="`${text.setting.selectCard}: ${card.title}`"
                    class="size-4 shrink-0 cursor-pointer rounded border-zinc-300 accent-zinc-900 dark:border-zinc-600 dark:accent-zinc-100"
                    @click.stop
                    @change="toggleCardSelected(card.id)"
                  />
                  <img
                    v-if="card.imageUrl"
                    :src="card.imageUrl"
                    :alt="card.title"
                    draggable="false"
                    class="size-10 shrink-0 rounded-lg bg-zinc-100 object-cover dark:bg-zinc-800"
                  />

                  <div class="min-w-0 flex-1">
                    <div class="flex flex-wrap items-center gap-1.5">
                      <h3 class="truncate text-sm">{{ card.title }}</h3>
                      <span class="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
                        {{ text.home.commissionTypes[card.commissionType] }}
                      </span>
                      <span
                        v-for="requestor in card.requestors"
                        :key="requestor"
                        class="rounded-full bg-orange-100 px-2 py-0.5 text-[11px] text-orange-800 dark:bg-zinc-800 dark:text-orange-200"
                      >
                        {{ requestor }}
                      </span>
                    </div>
                    <p class="mt-0.5 truncate text-xs text-zinc-500 dark:text-zinc-400">{{ card.description }}</p>
                  </div>

                  <div class="flex shrink-0 items-center gap-2">
                    <span
                      v-if="board.is_backlog && card.createdAt"
                      class="hidden text-[11px] text-zinc-500 sm:inline dark:text-zinc-400"
                    >
                      {{ formatCardDate(card.createdAt, language) }}
                    </span>
                    <span class="rounded-full bg-zinc-100 px-2.5 py-0.5 text-[11px] text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                      {{ cardStatusLabel(board, card) }} · {{ cardProgress(board, card) }}%
                    </span>

                    <div class="flex items-center gap-1">
                      <button
                        type="button"
                        :aria-label="`${text.home.editCard}: ${card.title}`"
                        :title="text.home.editCard"
                        class="flex size-8 items-center justify-center rounded-lg text-zinc-600 hover:bg-zinc-100 hover:text-zinc-950 focus-visible:outline-2 focus-visible:outline-offset-2 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-zinc-50"
                        @click="openEditCard(card, board)"
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
                          class="flex size-8 items-center justify-center rounded-lg text-red-700 hover:bg-red-50 focus-visible:outline-2 focus-visible:outline-offset-2 dark:text-red-300 dark:hover:bg-red-950"
                        >
                          <Trash2 :size="14" aria-hidden="true" />
                        </button>
                      </ConfirmDialog>
                    </div>
                  </div>
                </article>
              </div>
              <p v-else class="px-2 py-3 text-center text-xs text-zinc-500 dark:text-zinc-400">
                {{ text.setting.emptyBoardCards }}
              </p>
            </div>
          </li>
        </ul>
      </div>
    </section>
  </main>
</template>
