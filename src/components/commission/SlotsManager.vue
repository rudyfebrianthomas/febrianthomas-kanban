<script setup lang="ts">
import { Check, Copy, Pencil, Plus, RotateCcw, Trash2 } from '@lucide/vue'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useBoardDragSelect } from '../../composables/useBoardDragSelect'
import { useLanguage } from '../../composables/useLanguage'
import { OFFER_SELECT_COLUMNS } from '../../constants/commission'
import BoardFilterBar from '../ui/BoardFilterBar.vue'
import BulkSelectionBar from '../ui/BulkSelectionBar.vue'
import EmptyState from '../ui/EmptyState.vue'
import LoadingIndicator from '../ui/LoadingIndicator.vue'
import ThumbnailBox from '../ui/ThumbnailBox.vue'
import {
  canSetOfferBoardStatus,
  type CommissionOffer,
  type CommissionOfferBoard,
  type CommissionOfferBoardRow,
  type CommissionOfferRow,
  DEFAULT_COMMISSION_OFFERS,
  DEFAULT_COMMISSION_OFFER_BOARDS,
  fetchCommissionOfferBoards,
  fetchCommissionOffers,
  findOfferBoardByStatus,
  formatOfferPrices,
  isOfferLimitReached,
  OFFER_BOARD_STATUS_BADGES,
  OFFER_BOARD_STATUSES,
  OFFER_BOARD_STATUS_DOTS,
  type OfferBoardStatus,
  toCommissionOffer,
  toCommissionOfferBoard,
} from '../../lib/commissionOffers'
import { syncCommissionStatusRow } from '../../lib/commissionStatus'
import { removeKanbanImages, revokeBlobUrls } from '../../lib/kanbanImage'
import { supabase } from '../../lib/supabase'
import ConfirmDialog from '../ui/ConfirmDialog.vue'
import SelectField from '../ui/SelectField.vue'
import OfferBoardFormDialog from './OfferBoardFormDialog.vue'
import OfferFormDialog from './OfferFormDialog.vue'

type BoardFilter = 'all' | OfferBoardStatus | 'completed'

const emit = defineEmits<{
  offersChange: [offers: CommissionOffer[], boards: CommissionOfferBoard[]]
}>()

const { language, text } = useLanguage()

const boards = ref<CommissionOfferBoard[]>(supabase ? [] : DEFAULT_COMMISSION_OFFER_BOARDS)
const offers = ref<CommissionOffer[]>(supabase ? [] : DEFAULT_COMMISSION_OFFERS)
const loading = ref(!!supabase)
const loadError = ref('')
const statusBusyBoardId = ref('')
const togglingId = ref('')
const resettingId = ref('')
const query = ref('')
const statusFilter = ref<BoardFilter>('all')

const boardDialogOpen = ref(false)
const boardDialogMode = ref<'create' | 'edit' | 'copy'>('create')
const activeDialogBoard = ref<CommissionOfferBoard | null>(null)
const boardDialogDraft = ref<{ title: string; description: string; status: OfferBoardStatus } | null>(null)
const boardSaving = ref(false)
const boardFormError = ref('')

type PendingBoardStatusSwitch =
  | {
      kind: 'status'
      board: CommissionOfferBoard
      targetStatus: OfferBoardStatus
      conflictingBoard: CommissionOfferBoard
    }
  | {
      kind: 'form'
      editingBoard: CommissionOfferBoard | null
      copySourceBoard: CommissionOfferBoard | null
      payload: { title: string; description: string | null; status: OfferBoardStatus }
      targetStatus: OfferBoardStatus
      conflictingBoard: CommissionOfferBoard
    }

const switchDialogOpen = ref(false)
const pendingSwitch = ref<PendingBoardStatusSwitch | null>(null)
const statusUiKey = ref(0)

const dialogOpen = ref(false)
const editingOffer = ref<CommissionOffer | null>(null)
const templateOffer = ref<CommissionOffer | null>(null)
const targetBoardId = ref('')

const boardMoveOptions = computed(() =>
  boards.value.map((board) => ({ value: board.id, label: board.title })),
)

const nextOfferSortOrder = computed(
  () => offers.value.reduce((max, item) => Math.max(max, item.sortOrder), 0) + 1,
)

const boardStatusOptions = computed(() =>
  OFFER_BOARD_STATUSES.map((statusOption) => ({
    value: statusOption,
    label: text.value.setting.offers.boardStatuses[statusOption],
    dotClass: OFFER_BOARD_STATUS_DOTS[statusOption],
  })),
)

const boardFilterOptions = computed<{ value: BoardFilter; label: string }[]>(() => [
  { value: 'all', label: text.value.setting.filterAll },
  ...OFFER_BOARD_STATUSES.map((statusOption) => ({
    value: statusOption,
    label: text.value.setting.offers.boardStatuses[statusOption],
  })),
  { value: 'completed', label: text.value.setting.filterCompleted },
])

function isOfferBoardCompleted(boardId: string): boolean {
  const boardOffers = offers.value.filter((offer) => offer.boardId === boardId)
  return boardOffers.length > 0 && boardOffers.every((offer) => isOfferLimitReached(offer))
}

const canDialogBoardSetActive = computed(() =>
  canSetOfferBoardStatus(
    boards.value,
    'active',
    boardDialogMode.value === 'edit' ? activeDialogBoard.value?.id : undefined,
  ),
)

const canDialogBoardSetWaitlist = computed(() =>
  canSetOfferBoardStatus(
    boards.value,
    'waitlist',
    boardDialogMode.value === 'edit' ? activeDialogBoard.value?.id : undefined,
  ),
)

function findConflictingBoard(
  status: OfferBoardStatus,
  targetBoardId?: string,
): CommissionOfferBoard | undefined {
  if (status !== 'active' && status !== 'waitlist') return undefined
  return findOfferBoardByStatus(boards.value, status, targetBoardId)
}

function boardMutationErrorMessage(err: unknown): string {
  const message = err instanceof Error ? err.message.toLowerCase() : ''
  if (message.includes('waitlist')) return text.value.setting.offers.maxWaitlistError
  if (message.includes('active')) return text.value.setting.offers.maxActiveError
  return text.value.setting.offers.saveError
}

const switchDialogTitle = computed(() =>
  pendingSwitch.value?.targetStatus === 'waitlist'
    ? text.value.setting.offers.switchWaitlistTitle
    : text.value.setting.offers.switchActiveTitle,
)

const switchDialogDescription = computed(() => {
  const pending = pendingSwitch.value
  if (!pending) return ''
  const template =
    pending.targetStatus === 'waitlist'
      ? text.value.setting.offers.switchWaitlistDescription
      : text.value.setting.offers.switchActiveDescription
  return template.replace('{title}', pending.conflictingBoard.title)
})

const filteredBoards = computed(() => {
  const needle = query.value.trim().toLowerCase()
  return boards.value.filter((board) => {
    const matchesStatus =
      statusFilter.value === 'all'
        ? true
        : statusFilter.value === 'completed'
          ? isOfferBoardCompleted(board.id)
          : board.status === statusFilter.value
    if (!matchesStatus) return false
    if (!needle) return true
    const boardMatches =
      board.title.toLowerCase().includes(needle) ||
      (board.description ?? '').toLowerCase().includes(needle)
    if (boardMatches) return true
    return offersForBoard(board.id, needle).length > 0
  })
})

watch(
  [offers, boards, loading],
  ([nextOffers, nextBoards, isLoading]) => {
    if (isLoading) return
    emit('offersChange', nextOffers, nextBoards)
  },
  { deep: true, immediate: true },
)

onMounted(async () => {
  if (!supabase) return
  try {
    const [loadedBoards, loadedOffers] = await Promise.all([
      fetchCommissionOfferBoards(true),
      fetchCommissionOffers(true),
    ])
    boards.value = loadedBoards
    offers.value = loadedOffers
    void syncCommissionStatusRow(loadedBoards).catch(() => {})
  } catch {
    loadError.value = text.value.setting.offers.saveError
  } finally {
    loading.value = false
  }
})

onUnmounted(() => {
  revokeBlobUrls(offers.value.map((offer) => offer.imageUrl))
})

function offerMatchesNeedle(offer: CommissionOffer, needle: string): boolean {
  if (!needle) return true
  const typeLabel = text.value.home.commissionTypes[offer.commissionType].toLowerCase()
  const priceLabel = formatOfferPrices(offer, language.value).toLowerCase()
  return (
    offer.title.toLowerCase().includes(needle) ||
    offer.description.toLowerCase().includes(needle) ||
    offer.commissionType.toLowerCase().includes(needle) ||
    typeLabel.includes(needle) ||
    priceLabel.includes(needle) ||
    String(offer.priceUsd).includes(needle) ||
    String(offer.priceIdr).includes(needle)
  )
}

function offersForBoard(boardId: string, needle = query.value.trim().toLowerCase()): CommissionOffer[] {
  const boardOffers = offers.value.filter((offer) => offer.boardId === boardId)
  if (!needle) return boardOffers
  const board = boards.value.find((item) => item.id === boardId)
  const boardMatches =
    board &&
    (board.title.toLowerCase().includes(needle) ||
      (board.description ?? '').toLowerCase().includes(needle))
  if (boardMatches) return boardOffers
  return boardOffers.filter((offer) => offerMatchesNeedle(offer, needle))
}

function openCreateBoard() {
  boardDialogMode.value = 'create'
  activeDialogBoard.value = null
  boardDialogDraft.value = null
  boardFormError.value = ''
  boardDialogOpen.value = true
}

function openEditBoard(board: CommissionOfferBoard) {
  boardDialogMode.value = 'edit'
  activeDialogBoard.value = board
  boardDialogDraft.value = null
  boardFormError.value = ''
  boardDialogOpen.value = true
}

function openCopyBoard(board: CommissionOfferBoard) {
  boardDialogMode.value = 'copy'
  activeDialogBoard.value = board
  boardDialogDraft.value = null
  boardFormError.value = ''
  boardDialogOpen.value = true
}

async function demoteConflictingBoard(conflictingBoard: CommissionOfferBoard) {
  if (supabase) {
    const { error } = await supabase
      .from('commission_offer_boards')
      .update({ status: 'inactive' })
      .eq('id', conflictingBoard.id)
    if (error) throw error
  }
  boards.value = boards.value.map((item) =>
    item.id === conflictingBoard.id ? { ...item, status: 'inactive' } : item,
  )
}

async function persistBoardForm(
  payload: { title: string; description: string | null; status: OfferBoardStatus },
  editing: CommissionOfferBoard | null,
  copySource: CommissionOfferBoard | null,
  conflictingBoard?: CommissionOfferBoard,
) {
  if (conflictingBoard) {
    await demoteConflictingBoard(conflictingBoard)
  }

  if (!supabase) {
    if (editing) {
      boards.value = boards.value.map((item) =>
        item.id === editing.id ? { ...item, ...payload } : item,
      )
      return
    }
    const createdBoard: CommissionOfferBoard = {
      id: crypto.randomUUID(),
      ...payload,
      sortOrder: boards.value.reduce((max, item) => Math.max(max, item.sortOrder), 0) + 1,
    }
    boards.value.push(createdBoard)
    if (copySource) {
      const sourceOffers = offers.value.filter((item) => item.boardId === copySource.id)
      for (const sourceOffer of sourceOffers) {
        offers.value.push({
          ...sourceOffer,
          id: crypto.randomUUID(),
          boardId: createdBoard.id,
          requestCount: 0,
        })
      }
    }
    return
  }

  if (editing) {
    const { data, error } = await supabase
      .from('commission_offer_boards')
      .update(payload)
      .eq('id', editing.id)
      .select('id,title,description,status,sort_order')
      .single()
    if (error || !data) throw error
    const updated = toCommissionOfferBoard(data as CommissionOfferBoardRow)
    boards.value = boards.value.map((item) => (item.id === updated.id ? updated : item))
    await syncCommissionStatusRow(boards.value).catch(() => {})
    return
  }

  const nextBoardSort = boards.value.reduce((max, item) => Math.max(max, item.sortOrder), 0) + 1
  const { data: boardData, error: boardError } = await supabase
    .from('commission_offer_boards')
    .insert({ ...payload, sort_order: nextBoardSort })
    .select('id,title,description,status,sort_order')
    .single()
  if (boardError || !boardData) throw boardError
  const createdBoard = toCommissionOfferBoard(boardData as CommissionOfferBoardRow)
  boards.value.push(createdBoard)
  await syncCommissionStatusRow(boards.value).catch(() => {})

  if (copySource) {
    const sourceOffers = offers.value.filter((item) => item.boardId === copySource.id)
    if (sourceOffers.length > 0) {
      let nextOfferSort = offers.value.reduce((max, item) => Math.max(max, item.sortOrder), 0)
      const insertRows = sourceOffers.map((item) => {
        nextOfferSort += 1
        return {
          board_id: createdBoard.id,
          commission_type: item.commissionType,
          title: item.title,
          description: item.description,
          price: String(item.priceUsd),
          price_usd: item.priceUsd,
          price_idr: item.priceIdr,
          image_path: item.imagePath,
          is_open: item.isOpen,
          sort_order: nextOfferSort,
          max_requests: item.maxRequests,
        }
      })
      const { data: copiedOffersData, error: copyOffersError } = await supabase
        .from('commission_offers')
        .insert(insertRows)
        .select(OFFER_SELECT_COLUMNS)
      if (copyOffersError) throw copyOffersError
      for (const row of (copiedOffersData ?? []) as CommissionOfferRow[]) {
        offers.value.push(toCommissionOffer(row))
      }
    }
  }
}

async function saveBoard(payload: {
  title: string
  description: string | null
  status: OfferBoardStatus
}) {
  if (boardSaving.value) return
  const editing = boardDialogMode.value === 'edit' ? activeDialogBoard.value : null
  const copySource = boardDialogMode.value === 'copy' ? activeDialogBoard.value : null
  const conflictingBoard = findConflictingBoard(payload.status, editing?.id)

  if (conflictingBoard) {
    pendingSwitch.value = {
      kind: 'form',
      editingBoard: editing,
      copySourceBoard: copySource,
      payload,
      targetStatus: payload.status,
      conflictingBoard,
    }
    boardDialogDraft.value = {
      title: payload.title,
      description: payload.description ?? '',
      status: payload.status,
    }
    boardDialogOpen.value = false
    switchDialogOpen.value = true
    return
  }

  boardSaving.value = true
  boardFormError.value = ''
  loadError.value = ''
  try {
    await persistBoardForm(payload, editing, copySource)
    boardDialogDraft.value = null
    boardDialogOpen.value = false
  } catch (err) {
    boardFormError.value = boardMutationErrorMessage(err)
  } finally {
    boardSaving.value = false
  }
}

async function applyBoardStatus(
  board: CommissionOfferBoard,
  nextStatus: OfferBoardStatus,
  conflictingBoard?: CommissionOfferBoard,
) {
  statusBusyBoardId.value = board.id
  loadError.value = ''
  try {
    if (conflictingBoard) {
      await demoteConflictingBoard(conflictingBoard)
    }
    if (supabase) {
      const { error } = await supabase
        .from('commission_offer_boards')
        .update({ status: nextStatus })
        .eq('id', board.id)
      if (error) throw error
    }
    boards.value = boards.value.map((item) =>
      item.id === board.id ? { ...item, status: nextStatus } : item,
    )
    await syncCommissionStatusRow(boards.value).catch(() => {})
  } finally {
    statusBusyBoardId.value = ''
  }
}

async function setBoardStatus(board: CommissionOfferBoard, nextStatus: OfferBoardStatus) {
  if (statusBusyBoardId.value || board.status === nextStatus) return
  const conflictingBoard = findConflictingBoard(nextStatus, board.id)
  if (conflictingBoard) {
    pendingSwitch.value = {
      kind: 'status',
      board,
      targetStatus: nextStatus,
      conflictingBoard,
    }
    statusUiKey.value += 1
    switchDialogOpen.value = true
    return
  }

  try {
    await applyBoardStatus(board, nextStatus)
  } catch (err) {
    statusUiKey.value += 1
    loadError.value = boardMutationErrorMessage(err)
  }
}

function onSwitchDialogOpenChange(nextOpen: boolean) {
  switchDialogOpen.value = nextOpen
  if (nextOpen) return
  const cancelledPending = pendingSwitch.value
  pendingSwitch.value = null
  if (cancelledPending?.kind === 'form') {
    boardDialogOpen.value = true
  } else {
    boardDialogDraft.value = null
  }
}

async function confirmSwitchBoardStatus() {
  const pending = pendingSwitch.value
  if (!pending) return
  if (pending.kind === 'status') {
    await applyBoardStatus(pending.board, pending.targetStatus, pending.conflictingBoard)
  } else {
    await persistBoardForm(
      pending.payload,
      pending.editingBoard,
      pending.copySourceBoard,
      pending.conflictingBoard,
    )
    boardDialogDraft.value = null
  }
  pendingSwitch.value = null
}

async function deleteBoard(board: CommissionOfferBoard) {
  const boardOffers = offers.value.filter((item) => item.boardId === board.id)
  if (supabase) {
    const { error } = await supabase.from('commission_offer_boards').delete().eq('id', board.id)
    if (error) throw error
    await removeKanbanImages(boardOffers.map((item) => item.imagePath))
  } else {
    revokeBlobUrls(boardOffers.map((item) => item.imageUrl))
  }
  const removedOfferIds = new Set(boardOffers.map((item) => item.id))
  clearRemovedSelection(removedOfferIds)
  boards.value = boards.value.filter((item) => item.id !== board.id)
  offers.value = offers.value.filter((item) => item.boardId !== board.id)
  await syncCommissionStatusRow(boards.value).catch(() => {})
}

function openCreate(boardId: string) {
  editingOffer.value = null
  templateOffer.value = null
  targetBoardId.value = boardId
  dialogOpen.value = true
}

function openEdit(offer: CommissionOffer) {
  editingOffer.value = offer
  templateOffer.value = null
  targetBoardId.value = offer.boardId
  dialogOpen.value = true
}

function openCopy(offer: CommissionOffer) {
  editingOffer.value = null
  templateOffer.value = offer
  targetBoardId.value = offer.boardId
  dialogOpen.value = true
}

function onOfferSaved(savedOffer: CommissionOffer, isEdit: boolean) {
  if (isEdit) {
    offers.value = offers.value.map((item) => (item.id === savedOffer.id ? savedOffer : item))
  } else {
    offers.value.push(savedOffer)
  }
  editingOffer.value = null
  templateOffer.value = null
}

async function toggleOpen(offer: CommissionOffer) {
  if (togglingId.value) return
  const nextOpen = !offer.isOpen
  togglingId.value = offer.id
  loadError.value = ''
  try {
    if (supabase) {
      const { error } = await supabase
        .from('commission_offers')
        .update({ is_open: nextOpen })
        .eq('id', offer.id)
      if (error) throw error
    }
    offer.isOpen = nextOpen
  } catch {
    loadError.value = text.value.setting.offers.saveError
  } finally {
    togglingId.value = ''
  }
}

async function resetRequestCount(offer: CommissionOffer) {
  if (resettingId.value || offer.requestCount === 0) return
  resettingId.value = offer.id
  loadError.value = ''
  try {
    if (supabase) {
      const { error } = await supabase
        .from('commission_offers')
        .update({ request_count: 0 })
        .eq('id', offer.id)
      if (error) throw error
    }
    offer.requestCount = 0
  } finally {
    resettingId.value = ''
  }
}

async function deleteOffer(offer: CommissionOffer) {
  if (supabase) {
    const { error } = await supabase.from('commission_offers').delete().eq('id', offer.id)
    if (error) throw error
    await removeKanbanImages([offer.imagePath])
  } else {
    revokeBlobUrls([offer.imageUrl])
  }
  clearRemovedSelection(new Set([offer.id]))
  offers.value = offers.value.filter((item) => item.id !== offer.id)
}

async function moveOffersToBoard(ids: string[], targetBoard: CommissionOfferBoard) {
  if (ids.length === 0) return
  const targetIdSet = new Set(ids)
  const targetOffers = offers.value.filter(
    (item) => targetIdSet.has(item.id) && item.boardId !== targetBoard.id,
  )
  if (targetOffers.length === 0) return

  const previousStates = targetOffers.map((item) => ({
    offer: item,
    boardId: item.boardId,
  }))
  const movedIds = targetOffers.map((item) => item.id)

  for (const item of targetOffers) {
    item.boardId = targetBoard.id
  }
  clearRemovedSelection(new Set(movedIds))
  loadError.value = ''

  if (supabase) {
    const { error } = await supabase
      .from('commission_offers')
      .update({ board_id: targetBoard.id })
      .in('id', movedIds)

    if (error) {
      for (const prev of previousStates) {
        prev.offer.boardId = prev.boardId
      }
      loadError.value = text.value.setting.offers.saveError
    }
  }
}

const {
  selectedIds: selectedOfferIds,
  bulkTargetBoardId,
  bulkMoving,
  draggingIds: draggingOfferIds,
  dragOverBoardId,
  isSelected: isOfferSelected,
  toggleSelected: toggleOfferSelected,
  clearRemovedSelection,
  isAllInBoardSelected: isAllBoardOffersSelected,
  isSomeInBoardSelected: isSomeBoardOffersSelected,
  toggleAllInBoard: toggleAllBoardOffers,
  onItemDragStart: onOfferDragStart,
  onItemDragEnd: onOfferDragEnd,
  onBoardDragOver,
  onBoardDragLeave,
  onBoardDrop,
  moveSelected: moveSelectedOffers,
} = useBoardDragSelect<CommissionOfferBoard, CommissionOffer>({
  boards,
  itemsForBoard: (boardId) => offersForBoard(boardId),
  onMove: moveOffersToBoard,
})

function resetFilters() {
  query.value = ''
  statusFilter.value = 'all'
}

defineExpose({
  openCreateBoard,
})
</script>

<template>
  <section class="mt-12">
    <BoardFilterBar
      v-if="!loading && boards.length > 0"
      v-model:query="query"
      v-model:filter="statusFilter"
      search-id="offer-search"
      filter-id="offer-filter"
      :search-label="text.setting.offers.searchOffers"
      :search-placeholder="text.setting.offers.searchOffersPlaceholder"
      :filter-label="text.setting.offers.filterOffers"
      :hint="text.setting.offers.searchHint"
      :filter-options="boardFilterOptions"
    />

    <BulkSelectionBar
      v-if="selectedOfferIds.length > 0 && boardMoveOptions.length > 1"
      v-model:target-board-id="bulkTargetBoardId"
      select-id="bulk-move-offer-board"
      :selected-text="text.setting.selectedCount.replace('{count}', String(selectedOfferIds.length))"
      :move-to-label="text.setting.offers.moveSelectedTo"
      :move-button-label="text.setting.moveSelectedButton"
      :clear-button-label="text.setting.clearSelection"
      :options="boardMoveOptions"
      :busy="bulkMoving"
      @move="moveSelectedOffers"
      @clear="selectedOfferIds = []"
    />

    <p
      v-if="loadError"
      role="alert"
      class="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300"
    >
      {{ loadError }}
    </p>

    <div v-if="loading" class="flex min-h-48 items-center justify-center text-zinc-600 dark:text-zinc-300">
      <LoadingIndicator :label="text.site.loading" />
    </div>

    <EmptyState
      v-else-if="boards.length === 0"
      :title="text.setting.offers.emptyTitle"
      :description="text.setting.offers.emptyDescription"
      class="mx-auto py-12"
    />

    <EmptyState
      v-else-if="filteredBoards.length === 0"
      variant="card"
      :description="text.setting.noSearchResults"
      class="mt-6"
    >
      <button
        type="button"
        class="mt-3 inline-flex min-h-9 items-center rounded-full border border-zinc-300 px-3.5 py-1 text-xs text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
        @click="resetFilters"
      >
        {{ text.setting.resetFilters }}
      </button>
    </EmptyState>

    <ul v-else class="mt-6 flex flex-col gap-4">
      <li
        v-for="board in filteredBoards"
        :key="board.id"
        :class="[
          'surface-shadow flex w-full flex-col gap-4 rounded-2xl border bg-white p-5 transition-colors sm:p-6 dark:bg-zinc-900',
          dragOverBoardId === board.id
            ? 'border-orange-500 bg-orange-50/40 ring-2 ring-orange-500 dark:border-orange-400 dark:bg-zinc-800/80 dark:ring-orange-400'
            : board.status === 'active'
              ? 'border-orange-300 dark:border-orange-500/40'
              : board.status === 'waitlist'
                ? 'border-amber-300 dark:border-amber-500/40'
                : 'border-zinc-200 opacity-90 dark:border-zinc-800',
        ]"
        @dragover.prevent="onBoardDragOver(board.id, $event)"
        @dragenter.prevent="onBoardDragOver(board.id, $event)"
        @dragleave="onBoardDragLeave(board.id, $event)"
        @drop.prevent="onBoardDrop(board, $event)"
      >
        <div class="flex flex-wrap items-start justify-between gap-4">
          <div class="min-w-0 flex-1">
            <div class="flex flex-wrap items-center gap-2.5">
              <h3 class="text-xl font-bold text-zinc-950 sm:text-2xl dark:text-zinc-50">
                {{ board.title }}
              </h3>
              <span class="rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                {{ offersForBoard(board.id, '').length }}
              </span>
              <span
                :class="[
                  'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium',
                  OFFER_BOARD_STATUS_BADGES[board.status],
                ]"
              >
                <span :class="['size-1.5 rounded-full', OFFER_BOARD_STATUS_DOTS[board.status]]" aria-hidden="true" />
                {{ text.setting.offers.boardStatuses[board.status] }}
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
            <button
              type="button"
              class="inline-flex min-h-9 items-center gap-1.5 rounded-full bg-zinc-900 px-3.5 py-1.5 text-xs text-white transition-colors hover:bg-zinc-700 focus-visible:outline-2 focus-visible:outline-offset-2 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
              @click="openCreate(board.id)"
            >
              <Plus :size="14" aria-hidden="true" />
              {{ text.setting.offers.addOffer }}
            </button>

            <div class="w-36">
              <SelectField
                :key="`${board.id}-${board.status}-${statusUiKey}`"
                :model-value="board.status"
                :options="boardStatusOptions"
                :disabled="statusBusyBoardId === board.id"
                :aria-label="`${text.setting.offers.boardStatusLabel}: ${board.title}`"
                @update:model-value="(value) => setBoardStatus(board, value as OfferBoardStatus)"
              />
            </div>

            <button
              type="button"
              :aria-label="`${text.setting.offers.copyBoard}: ${board.title}`"
              :title="text.setting.offers.copyBoard"
              class="flex size-9 items-center justify-center rounded-xl text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-950 focus-visible:outline-2 focus-visible:outline-offset-2 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-zinc-50"
              @click="openCopyBoard(board)"
            >
              <Copy :size="16" aria-hidden="true" />
            </button>

            <button
              type="button"
              :aria-label="`${text.setting.offers.editBoard}: ${board.title}`"
              :title="text.setting.offers.editBoard"
              class="flex size-9 items-center justify-center rounded-xl text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-950 focus-visible:outline-2 focus-visible:outline-offset-2 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-zinc-50"
              @click="openEditBoard(board)"
            >
              <Pencil :size="16" aria-hidden="true" />
            </button>

            <ConfirmDialog
              :title="text.setting.offers.deleteBoardTitle"
              :description="text.setting.offers.deleteBoardDescription"
              :cancel-label="text.login.cancel"
              :confirm-label="text.setting.offers.deleteBoard"
              :pending-label="text.setting.offers.deletingBoard"
              :error-message="text.setting.offers.deleteBoardError"
              :on-confirm="() => deleteBoard(board)"
            >
              <button
                type="button"
                :aria-label="`${text.setting.offers.deleteBoard}: ${board.title}`"
                :title="text.setting.offers.deleteBoard"
                class="flex size-9 items-center justify-center rounded-xl text-red-700 transition-colors hover:bg-red-50 focus-visible:outline-2 focus-visible:outline-offset-2 dark:text-red-300 dark:hover:bg-red-950"
              >
                <Trash2 :size="16" aria-hidden="true" />
              </button>
            </ConfirmDialog>
          </div>
        </div>

        <EmptyState
          v-if="offersForBoard(board.id).length === 0"
          variant="card"
          compact
          :description="text.setting.offers.emptyBoardOffers"
        />

        <div v-else class="rounded-xl bg-zinc-100 p-2.5 dark:bg-zinc-800/70">
          <div class="flex items-center px-3 py-1">
            <label class="inline-flex cursor-pointer select-none items-center gap-2.5 text-xs text-zinc-600 dark:text-zinc-300">
              <input
                type="checkbox"
                :checked="isAllBoardOffersSelected(board.id)"
                :indeterminate.prop="isSomeBoardOffersSelected(board.id)"
                class="size-4 cursor-pointer rounded border-zinc-300 accent-zinc-900 dark:border-zinc-600 dark:accent-zinc-100"
                @change="toggleAllBoardOffers(board.id)"
              />
              <span>{{ text.setting.offers.selectAllOffers }}</span>
            </label>
          </div>
          <ul class="mt-1 flex flex-col gap-2">
            <li
              v-for="offer in offersForBoard(board.id)"
              :key="offer.id"
              draggable="true"
              :class="[
                'flex cursor-grab flex-col items-start justify-between gap-3 rounded-xl border border-zinc-200 bg-white px-4 py-3 shadow-xs transition-opacity active:cursor-grabbing sm:flex-row sm:items-center dark:border-zinc-700 dark:bg-zinc-900',
                offer.isOpen ? '' : 'opacity-75',
                draggingOfferIds.includes(offer.id) ? 'opacity-50' : '',
              ]"
              @dragstart="onOfferDragStart(offer.id, $event)"
              @dragend="onOfferDragEnd"
            >
              <div class="flex w-full min-w-0 flex-1 items-center gap-3">
                <input
                  type="checkbox"
                  :checked="isOfferSelected(offer.id)"
                  :aria-label="`${text.setting.offers.selectOffer}: ${offer.title}`"
                  class="size-4 shrink-0 cursor-pointer rounded border-zinc-300 accent-zinc-900 dark:border-zinc-600 dark:accent-zinc-100"
                  @click.stop
                  @change="toggleOfferSelected(offer.id)"
                />
                <ThumbnailBox
                  :src="offer.imageUrl"
                  :alt="offer.title"
                  :icon-size="20"
                  :draggable="false"
                  img-class="size-12 shrink-0 rounded-lg bg-zinc-100 object-cover dark:bg-zinc-800"
                  fallback-class="size-12 shrink-0 rounded-lg"
                />
              <div class="min-w-0 flex-1">
                <div class="flex flex-wrap items-center gap-2">
                  <span class="text-sm font-medium text-zinc-950 dark:text-zinc-50">{{ offer.title }}</span>
                  <span class="rounded-full bg-orange-100 px-2.5 py-0.5 text-xs font-medium text-orange-800 dark:bg-orange-950/60 dark:text-orange-200">
                    {{ formatOfferPrices(offer, language) }}
                  </span>
                  <span class="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                    {{ text.home.commissionTypes[offer.commissionType] }}
                  </span>
                  <span
                    v-if="offer.maxRequests !== null"
                    :class="[
                      'rounded-full px-2 py-0.5 text-[11px] font-medium tabular-nums',
                      isOfferLimitReached(offer)
                        ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-200'
                        : 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300',
                    ]"
                  >
                    {{ offer.requestCount }}/{{ offer.maxRequests }}
                  </span>
                </div>
                <p class="mt-0.5 truncate text-xs text-zinc-500 dark:text-zinc-400">{{ offer.description }}</p>
              </div>
            </div>

            <div class="flex w-full shrink-0 flex-wrap items-center justify-end gap-2 sm:w-auto">
              <ConfirmDialog
                v-if="offer.requestCount > 0"
                :title="text.setting.offers.resetConfirmTitle"
                :description="text.setting.offers.resetConfirmDescription.replace('{title}', offer.title)"
                :cancel-label="text.login.cancel"
                :confirm-label="text.setting.offers.resetRequests"
                :pending-label="text.setting.offers.resetting"
                :error-message="text.setting.offers.resetError"
                :on-confirm="() => resetRequestCount(offer)"
              >
                <button
                  type="button"
                  :disabled="resettingId === offer.id"
                  :aria-label="`${text.setting.offers.resetRequestsLabel}: ${offer.title}`"
                  :title="text.setting.offers.resetRequestsLabel"
                  class="inline-flex min-h-8 items-center gap-1 rounded-full border border-zinc-300 px-3 py-1 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-100 focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                >
                  <RotateCcw :size="12" aria-hidden="true" />
                  <span>{{ text.setting.offers.resetRequests }}</span>
                </button>
              </ConfirmDialog>

              <button
                type="button"
                role="switch"
                :aria-checked="offer.isOpen"
                :disabled="togglingId === offer.id"
                :class="[
                  'inline-flex min-h-8 items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50',
                  offer.isOpen
                    ? 'bg-orange-500/15 text-orange-700 hover:bg-orange-500/25 dark:bg-orange-400/15 dark:text-orange-300 dark:hover:bg-orange-400/25'
                    : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700',
                ]"
                @click="toggleOpen(offer)"
              >
                <Check v-if="offer.isOpen" :size="13" aria-hidden="true" />
                {{ offer.isOpen ? text.setting.activeBadge : text.setting.makeActive }}
              </button>

              <button
                type="button"
                :aria-label="`${text.setting.offers.copyOffer}: ${offer.title}`"
                :title="text.setting.offers.copyOffer"
                class="flex size-8 items-center justify-center rounded-lg text-zinc-600 hover:bg-zinc-100 hover:text-zinc-950 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-zinc-50"
                @click="openCopy(offer)"
              >
                <Copy :size="14" aria-hidden="true" />
              </button>

              <button
                type="button"
                :aria-label="`${text.setting.offers.editOffer}: ${offer.title}`"
                :title="text.setting.offers.editOffer"
                class="flex size-8 items-center justify-center rounded-lg text-zinc-600 hover:bg-zinc-100 hover:text-zinc-950 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-zinc-50"
                @click="openEdit(offer)"
              >
                <Pencil :size="14" aria-hidden="true" />
              </button>

              <ConfirmDialog
                :title="text.setting.offers.deleteTitle"
                :description="text.setting.offers.deleteDescription"
                :cancel-label="text.login.cancel"
                :confirm-label="text.setting.offers.deleteOffer"
                :pending-label="text.setting.offers.deleting"
                :error-message="text.setting.offers.deleteError"
                :on-confirm="() => deleteOffer(offer)"
              >
                <button
                  type="button"
                  :aria-label="`${text.setting.offers.deleteOffer}: ${offer.title}`"
                  :title="text.setting.offers.deleteOffer"
                  class="flex size-8 items-center justify-center rounded-lg text-red-700 hover:bg-red-50 dark:text-red-300 dark:hover:bg-red-950"
                >
                  <Trash2 :size="14" aria-hidden="true" />
                </button>
              </ConfirmDialog>
            </div>
            </li>
          </ul>
        </div>
      </li>
    </ul>

    <OfferBoardFormDialog
      v-model:open="boardDialogOpen"
      :mode="boardDialogMode"
      :board="activeDialogBoard"
      :draft="boardDialogDraft"
      :can-set-active="canDialogBoardSetActive"
      :can-set-waitlist="canDialogBoardSetWaitlist"
      :saving="boardSaving"
      :error="boardFormError"
      @save="saveBoard"
    />

    <ConfirmDialog
      :open="switchDialogOpen"
      :title="switchDialogTitle"
      :description="switchDialogDescription"
      :cancel-label="text.setting.offers.switchCancel"
      :confirm-label="text.setting.offers.switchConfirm"
      :pending-label="text.setting.offers.switching"
      :error-message="text.setting.offers.switchError"
      :on-confirm="confirmSwitchBoardStatus"
      @update:open="onSwitchDialogOpenChange"
    />

    <OfferFormDialog
      v-model:open="dialogOpen"
      :board-id="targetBoardId"
      :offer="editingOffer"
      :template-offer="templateOffer"
      :next-sort-order="nextOfferSortOrder"
      @saved="onOfferSaved"
    />
  </section>
</template>
