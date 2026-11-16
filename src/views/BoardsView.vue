<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { Check, Copy, Pencil, Plus, Trash2 } from '@lucide/vue'
import CommissionStatusBadge from '../components/commission/CommissionStatusBadge.vue'
import KanbanBoardFormDialog from '../components/commission/KanbanBoardFormDialog.vue'
import KanbanCardFormDialog from '../components/commission/KanbanCardFormDialog.vue'
import BoardFilterBar from '../components/ui/BoardFilterBar.vue'
import BulkSelectionBar from '../components/ui/BulkSelectionBar.vue'
import ConfirmDialog from '../components/ui/ConfirmDialog.vue'
import EmptyState from '../components/ui/EmptyState.vue'
import LoadingIndicator from '../components/ui/LoadingIndicator.vue'
import MotionButton from '../components/ui/MotionButton.vue'
import SelectField from '../components/ui/SelectField.vue'
import ThumbnailBox from '../components/ui/ThumbnailBox.vue'
import { useAuth } from '../composables/useAuth'
import { useBoardDragSelect } from '../composables/useBoardDragSelect'
import { useLanguage } from '../composables/useLanguage'
import { BACKLOG_BOARD_ID, CARD_SELECT_COLUMNS } from '../constants/commission'
import {
  type CommissionStatus,
  DEFAULT_COMMISSION_STATUS,
  fetchCommissionStatus,
} from '../lib/commissionStatus'
import { isBoardCompleted, type KanbanBoard } from '../lib/kanbanBoard'
import {
  deleteKanbanCard,
  formatCardDate,
  type KanbanCard,
  type KanbanCardRow,
  latestTimestamp,
  matchesCardQuery,
  toKanbanCard,
  upsertKanbanCard,
} from '../lib/kanbanCard'
import { removeKanbanImages, revokeBlobUrls } from '../lib/kanbanImage'
import { stageLabel, stageProgress } from '../lib/kanbanStage'
import { supabase } from '../lib/supabase'

const { language, text } = useLanguage()
const { signedIn } = useAuth()
const router = useRouter()

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
const commissionStatus = ref<CommissionStatus | null>(
  supabase ? null : { ...DEFAULT_COMMISSION_STATUS },
)
const loading = ref(!!supabase)
const loadError = ref('')
const query = ref('')
const statusFilter = ref<BoardFilter>('active')
const backlogSortOrder = ref<BacklogSortOrder>('newest')

const dialogOpen = ref(false)
const editingBoard = ref<KanbanBoard | null>(null)
const copySourceBoard = ref<KanbanBoard | null>(null)
const saving = ref(false)
const formError = ref('')

const activeBusyId = ref('')
const switchTargetBoard = ref<KanbanBoard | null>(null)
const switchDialogOpen = ref(false)

const cardDialogOpen = ref(false)
const targetCardBoard = ref<KanbanBoard | null>(null)
const editingCard = ref<KanbanCard | null>(null)
const templateCard = ref<KanbanCard | null>(null)

const boardMoveOptions = computed(() =>
  boards.value.map((board) => ({ value: board.id, label: board.title })),
)

function boardMatchesQuery(board: KanbanBoard, needle: string): boolean {
  return (
    board.title.toLowerCase().includes(needle) ||
    (board.description?.toLowerCase().includes(needle) ?? false)
  )
}

function cardMatchesQuery(card: KanbanCard, needle: string): boolean {
  return matchesCardQuery(card, needle, text.value.home.commissionTypes[card.commissionType])
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
            : !board.is_backlog && isBoardCompleted(board, cards.value)

    if (!matchesStatus) return false
    if (!q) return true
    if (boardMatchesQuery(board, q)) return true
    return cards.value.some((card) => card.boardId === board.id && cardMatchesQuery(card, q))
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

function cardsForBoard(boardId: string, needle = query.value.trim().toLowerCase()): KanbanCard[] {
  const board = boards.value.find((item) => item.id === boardId)
  let boardCards = cards.value.filter((card) => card.boardId === boardId)
  if (needle && (!board || !boardMatchesQuery(board, needle))) {
    boardCards = boardCards.filter((card) => cardMatchesQuery(card, needle))
  }
  if (!board?.is_backlog) return boardCards
  return [...boardCards].sort((a, b) => {
    const timeA = latestTimestamp(undefined, a.createdAt)
    const timeB = latestTimestamp(undefined, b.createdAt)
    return backlogSortOrder.value === 'newest' ? timeB - timeA : timeA - timeB
  })
}

async function moveCardsToBoard(ids: string[], targetBoard: KanbanBoard) {
  if (ids.length === 0) return
  const targetIdSet = new Set(ids)
  const targetCards = cards.value.filter(
    (item) => targetIdSet.has(item.id) && item.boardId !== targetBoard.id,
  )
  if (targetCards.length === 0) return

  const nextStage = text.value.home.stages[0]?.number ?? '01'
  const previousStates = targetCards.map((item) => ({
    card: item,
    boardId: item.boardId,
    stageNumber: item.stageNumber,
  }))
  const movedIds = targetCards.map((item) => item.id)

  for (const item of targetCards) {
    item.boardId = targetBoard.id
    item.stageNumber = nextStage
  }
  clearRemovedSelection(new Set(movedIds))

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

const {
  selectedIds: selectedCardIds,
  bulkTargetBoardId,
  bulkMoving,
  draggingIds: draggingCardIds,
  dragOverBoardId,
  isSelected: isCardSelected,
  toggleSelected: toggleCardSelected,
  clearRemovedSelection,
  isAllInBoardSelected: isAllBoardCardsSelected,
  isSomeInBoardSelected: isSomeBoardCardsSelected,
  toggleAllInBoard: toggleAllBoardCards,
  onItemDragStart: onCardDragStart,
  onItemDragEnd: onCardDragEnd,
  onBoardDragOver,
  onBoardDragLeave,
  onBoardDrop,
  moveSelected: moveSelectedCards,
} = useBoardDragSelect<KanbanBoard, KanbanCard>({
  boards,
  itemsForBoard: (boardId) => cardsForBoard(boardId),
  onMove: moveCardsToBoard,
})

function cardStatusLabel(board: KanbanBoard, card: KanbanCard): string {
  if (board.is_backlog) return text.value.setting.backlogStatus
  return stageLabel(card.stageNumber, text.value.home.stages)
}

function cardProgress(board: KanbanBoard, card: KanbanCard): number {
  if (board.is_backlog) return 0
  return stageProgress(card.stageNumber, text.value.home.stages)
}

watch(
  signedIn,
  (authenticated) => {
    if (authenticated === false) void router.replace('/')
  },
  { immediate: true },
)

onMounted(() => {
  void loadBoardsAndCards()
})

onUnmounted(() => {
  revokeBlobUrls(cards.value.map((card) => card.imageUrl))
})

async function loadBoardsAndCards() {
  loading.value = true
  loadError.value = ''

  if (!supabase) {
    loading.value = false
    return
  }

  const [boardsResult, cardsResult, statusResult] = await Promise.all([
    supabase
      .from('kanban_boards')
      .select('id,title,description,is_active,is_backlog,created_at')
      .order('is_backlog', { ascending: true })
      .order('created_at', { ascending: false }),
    supabase
      .from('kanban_cards')
      .select(CARD_SELECT_COLUMNS)
      .order('created_at', { ascending: true }),
    fetchCommissionStatus(),
  ])

  if (statusResult) commissionStatus.value = statusResult

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
  copySourceBoard.value = null
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
  dialogOpen.value = true
}

function openCopyBoard(board: KanbanBoard) {
  resetBoardDialog()
  copySourceBoard.value = board
  dialogOpen.value = true
}

function boardSaveErrorMessage(error: { code?: string; message?: string } | null) {
  if (error?.code === '23505') return text.value.setting.duplicateTitle
  return error?.message || text.value.setting.saveBoardError
}

async function handleSaveBoard(payload: { title: string; description: string | null }) {
  const trimmedTitle = payload.title
  if (!trimmedTitle) {
    formError.value = text.value.setting.requiredTitle
    return
  }

  const nextDescription = payload.description
  const editing = editingBoard.value
  const copySource = copySourceBoard.value
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
      const createdId = crypto.randomUUID()
      const backlog = boards.value.filter((item) => item.is_backlog)
      const regular = boards.value.filter((item) => !item.is_backlog)
      boards.value = [
        {
          id: createdId,
          title: trimmedTitle,
          description: nextDescription,
          is_active: false,
          is_backlog: false,
        },
        ...regular,
        ...backlog,
      ]
      if (copySource) {
        const sourceCards = cards.value.filter((item) => item.boardId === copySource.id)
        for (const sourceCard of sourceCards) {
          cards.value.push({
            ...sourceCard,
            id: crypto.randomUUID(),
            boardId: createdId,
            requestors: [...sourceCard.requestors],
            createdAt: new Date().toISOString(),
            updatedAt: null,
          })
        }
      }
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

  if (error || !data) {
    saving.value = false
    formError.value = boardSaveErrorMessage(error)
    return
  }

  const created = data as KanbanBoard
  if (copySource) {
    const sourceCards = cards.value.filter((item) => item.boardId === copySource.id)
    if (sourceCards.length > 0) {
      const insertRows = sourceCards.map((item) => ({
        board_id: created.id,
        stage_number: item.stageNumber,
        commission_type: item.commissionType,
        title: item.title,
        description: item.description,
        requestors: item.requestors,
        image_path: item.imagePath,
      }))
      const { data: copiedCardsData, error: copyCardsError } = await supabase
        .from('kanban_cards')
        .insert(insertRows)
        .select(CARD_SELECT_COLUMNS)
      if (copyCardsError) {
        await supabase.from('kanban_boards').delete().eq('id', created.id)
        saving.value = false
        formError.value = boardSaveErrorMessage(copyCardsError)
        return
      }
      for (const row of (copiedCardsData ?? []) as KanbanCardRow[]) {
        cards.value.push(toKanbanCard(row))
      }
    }
  }

  saving.value = false
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

    const imagePaths = ((cardRows ?? []) as Array<{ image_path: string | null }>).map(
      (row) => row.image_path,
    )
    await removeKanbanImages(imagePaths)
  }

  revokeBlobUrls(cards.value.filter((item) => item.boardId === board.id).map((item) => item.imageUrl))
  const deletedBoardCardIds = new Set(
    cards.value.filter((item) => item.boardId === board.id).map((item) => item.id),
  )
  clearRemovedSelection(deletedBoardCardIds)
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
  switchDialogOpen.value = open
  if (!open) switchTargetBoard.value = null
}

async function confirmSwitchActive() {
  const target = switchTargetBoard.value
  if (!target) return
  await activateBoard(target)
  switchTargetBoard.value = null
}

function openAddCard(board: KanbanBoard) {
  targetCardBoard.value = board
  editingCard.value = null
  templateCard.value = null
  cardDialogOpen.value = true
}

function openEditCard(card: KanbanCard, board: KanbanBoard) {
  targetCardBoard.value = board
  editingCard.value = card
  templateCard.value = null
  cardDialogOpen.value = true
}

function openCopyCard(card: KanbanCard, board: KanbanBoard) {
  targetCardBoard.value = board
  editingCard.value = null
  templateCard.value = card
  cardDialogOpen.value = true
}

function onCardSaved(savedCard: KanbanCard, isEdit: boolean) {
  upsertKanbanCard(cards.value, savedCard, isEdit)
}

async function deleteCard(card: KanbanCard) {
  await deleteKanbanCard(card)
  clearRemovedSelection(new Set([card.id]))
  cards.value = cards.value.filter((item) => item.id !== card.id)
}

function clearBoardFilters() {
  query.value = ''
  statusFilter.value = 'all'
}
</script>

<template>
  <main class="flex flex-1 flex-col px-6 sm:px-10">
    <section
      class="mx-auto flex w-full max-w-6xl flex-1 flex-col py-20 sm:py-28"
      aria-labelledby="page-title"
    >
      <div class="flex flex-wrap items-end justify-between gap-6">
        <div class="max-w-3xl">
          <div class="mb-5 flex flex-wrap items-center gap-3">
            <p class="text-xs uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
              {{ text.setting.eyebrow }}
            </p>
            <CommissionStatusBadge v-if="commissionStatus" :value="commissionStatus" />
          </div>
          <h1
            id="page-title"
            class="font-bagel-fat-one text-6xl leading-none text-zinc-950 sm:text-8xl dark:text-zinc-50"
          >
            {{ text.setting.title }}
          </h1>
          <p class="mt-6 text-lg leading-7 text-zinc-600 dark:text-zinc-300">
            {{ text.setting.description }}
          </p>
        </div>

        <MotionButton
          type="button"
          class="min-h-11 gap-2"
          @click="openCreateBoard"
        >
          <Plus class="size-4" aria-hidden="true" />
          {{ text.setting.addBoard }}
        </MotionButton>
      </div>

      <KanbanBoardFormDialog
        :open="dialogOpen"
        :editing-board="editingBoard"
        :copy-source-board="copySourceBoard"
        :saving="saving"
        :error="formError"
        @update:open="onDialogOpenChange"
        @save="handleSaveBoard"
      />

      <KanbanCardFormDialog
        v-model:open="cardDialogOpen"
        :board-id="targetCardBoard?.id ?? ''"
        :card="editingCard"
        :template-card="templateCard"
        :show-stage="!(targetCardBoard?.is_backlog ?? false)"
        id-prefix="setting-card"
        @saved="onCardSaved"
      />

      <ConfirmDialog
        :open="switchDialogOpen"
        :title="text.setting.switchActiveTitle"
        :description="text.setting.switchActiveDescription"
        :cancel-label="text.setting.switchActiveCancel"
        :confirm-label="text.setting.switchActiveConfirm"
        :pending-label="text.setting.switchingActive"
        :error-message="text.setting.switchActiveError"
        :on-confirm="confirmSwitchActive"
        @update:open="onSwitchDialogOpenChange"
      />

      <BoardFilterBar
        v-if="!loading && boards.length > 0"
        v-model:query="query"
        v-model:filter="statusFilter"
        search-id="board-search"
        filter-id="board-filter"
        :search-label="text.setting.searchBoards"
        :search-placeholder="text.setting.searchBoardsPlaceholder"
        :filter-label="text.setting.filterBoards"
        :hint="text.setting.searchHint"
        :filter-options="boardFilterOptions"
        class="mt-12"
      />

      <BulkSelectionBar
        v-if="selectedCardIds.length > 0 && boardMoveOptions.length > 1"
        v-model:target-board-id="bulkTargetBoardId"
        select-id="bulk-move-board"
        :selected-text="text.setting.selectedCount.replace('{count}', String(selectedCardIds.length))"
        :move-to-label="text.setting.moveSelectedTo"
        :move-button-label="text.setting.moveSelectedButton"
        :clear-button-label="text.setting.clearSelection"
        :options="boardMoveOptions"
        :busy="bulkMoving"
        @move="moveSelectedCards"
        @clear="selectedCardIds = []"
      />

      <div :class="loading || boards.length === 0 ? 'mt-12' : 'mt-6'">
        <p
          v-if="loadError"
          role="alert"
          class="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300"
        >
          {{ loadError }}
        </p>

        <div v-if="loading" class="flex min-h-48 items-center justify-center text-zinc-600 dark:text-zinc-300">
          <LoadingIndicator :label="text.site.loading" />
        </div>

        <EmptyState
          v-else-if="boards.length === 0"
          :title="text.setting.emptyTitle"
          :description="text.setting.emptyDescription"
          class="mx-auto py-12"
        />

        <EmptyState
          v-else-if="filteredBoards.length === 0"
          variant="card"
          :description="text.setting.noSearchResults"
        >
          <button
            type="button"
            class="mt-3 inline-flex min-h-9 items-center rounded-full border border-zinc-300 px-3.5 py-1 text-xs text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
            @click="clearBoardFilters"
          >
            {{ text.setting.resetFilters }}
          </button>
        </EmptyState>

        <ul v-else class="flex flex-col gap-4">
          <li
            v-for="board in filteredBoards"
            :key="board.id"
            :class="[
              'surface-shadow flex w-full flex-col gap-4 rounded-2xl border bg-white p-5 transition-colors sm:p-6 dark:bg-zinc-900',
              dragOverBoardId === board.id
                ? 'border-orange-500 bg-orange-50/40 ring-2 ring-orange-500 dark:border-orange-400 dark:bg-zinc-800/80 dark:ring-orange-400'
                : board.is_active
                  ? 'border-orange-300 dark:border-orange-500/40'
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
                    {{ cardsForBoard(board.id, '').length }}
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
                    :aria-label="`${text.setting.copyBoard}: ${board.title}`"
                    :title="text.setting.copyBoard"
                    class="flex size-9 items-center justify-center rounded-xl text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-950 focus-visible:outline-2 focus-visible:outline-offset-2 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-zinc-50"
                    @click="openCopyBoard(board)"
                  >
                    <Copy :size="16" aria-hidden="true" />
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

            <div v-if="cardsForBoard(board.id).length" class="rounded-xl bg-zinc-100 p-2.5 dark:bg-zinc-800/70">
              <div class="flex flex-col gap-2">
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
                    'flex w-full cursor-grab flex-col gap-2.5 rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-zinc-950 shadow-xs transition-opacity active:cursor-grabbing sm:flex-row sm:items-center sm:gap-3 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50',
                    draggingCardIds.includes(card.id) ? 'opacity-50' : '',
                  ]"
                  @dragstart="onCardDragStart(card.id, $event)"
                  @dragend="onCardDragEnd"
                >
                  <div class="flex min-w-0 flex-1 items-center gap-3">
                    <input
                      type="checkbox"
                      :checked="isCardSelected(card.id)"
                      :aria-label="`${text.setting.selectCard}: ${card.title}`"
                      class="size-4 shrink-0 cursor-pointer rounded border-zinc-300 accent-zinc-900 dark:border-zinc-600 dark:accent-zinc-100"
                      @click.stop
                      @change="toggleCardSelected(card.id)"
                    />
                    <ThumbnailBox
                      :src="card.imageUrl"
                      :alt="card.title"
                      :icon-size="18"
                      :draggable="false"
                      img-class="size-10 shrink-0 rounded-lg bg-zinc-100 object-cover dark:bg-zinc-800"
                      fallback-class="size-10 shrink-0 rounded-lg"
                    />

                    <div class="min-w-0 flex-1">
                      <div class="flex flex-wrap items-center gap-1.5">
                        <h3 class="truncate text-sm font-medium">{{ card.title }}</h3>
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
                  </div>

                  <div class="flex w-full shrink-0 items-center justify-between gap-2 pl-7 sm:w-auto sm:justify-end sm:pl-0">
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
                        :aria-label="`${text.home.copyCard}: ${card.title}`"
                        :title="text.home.copyCard"
                        class="flex size-8 items-center justify-center rounded-lg text-zinc-600 hover:bg-zinc-100 hover:text-zinc-950 focus-visible:outline-2 focus-visible:outline-offset-2 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-zinc-50"
                        @click="openCopyCard(card, board)"
                      >
                        <Copy :size="14" aria-hidden="true" />
                      </button>
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
            </div>
            <EmptyState
              v-else
              variant="card"
              compact
              :description="text.setting.emptyBoardCards"
            />
          </li>
        </ul>
      </div>
    </section>
  </main>
</template>
