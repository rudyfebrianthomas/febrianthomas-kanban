<script setup lang="ts">
import { Plus, Search } from '@lucide/vue'
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  COMMISSION_TYPES,
  type CommissionStatus,
  type CommissionType,
  DEFAULT_COMMISSION_STATUS,
  fetchCommissionStatus,
} from '../lib/commissionStatus'
import CommissionCard from '../components/commission/CommissionCard.vue'
import CommissionCardDetailDialog from '../components/commission/CommissionCardDetailDialog.vue'
import CommissionStatusBadge from '../components/commission/CommissionStatusBadge.vue'
import KanbanCardFormDialog from '../components/commission/KanbanCardFormDialog.vue'
import EmptyState from '../components/ui/EmptyState.vue'
import LoadingIndicator from '../components/ui/LoadingIndicator.vue'
import MotionButton from '../components/ui/MotionButton.vue'
import SelectField from '../components/ui/SelectField.vue'
import { useAuth } from '../composables/useAuth'
import { useLanguage } from '../composables/useLanguage'
import { isBoardCompleted, type KanbanBoard } from '../lib/kanbanBoard'
import {
  deleteKanbanCard,
  formatCardDate as formatCardDateForLanguage,
  type KanbanCard,
  type KanbanCardRow,
  latestTimestamp,
  toKanbanCard,
} from '../lib/kanbanCard'
import { revokeBlobUrls } from '../lib/kanbanImage'
import { stageLabel as getStageLabel, stageProgress as getStageProgress, stageStyle } from '../lib/kanbanStage'
import { supabase } from '../lib/supabase'

const DEFAULT_BOARD_ID = '00000000-0000-0000-0000-000000000001'

const { language, text } = useLanguage()
const { signedIn } = useAuth()
const route = useRoute()
const router = useRouter()

const loading = ref(!!supabase)
const commissionStatus = ref<CommissionStatus | null>(
  supabase ? null : { ...DEFAULT_COMMISSION_STATUS },
)
const boards = ref<KanbanBoard[]>(
  supabase
    ? []
    : [{ id: DEFAULT_BOARD_ID, title: 'Commission Board', description: null, is_active: true, is_backlog: false }],
)
const cards = ref<KanbanCard[]>([])
const formOpen = ref(false)
const editingCard = ref<KanbanCard | null>(null)
const searchQuery = ref('')
const selectedType = ref<CommissionType | 'all'>('all')
const viewMode = ref<'active' | 'completed'>('active')
const selectedCompletedBoardId = ref('')
const detailCard = ref<KanbanCard | null>(null)
const draggingCardId = ref('')
const dragOverStage = ref('')
const stageColumnRefs = ref<Record<string, HTMLElement>>({})

function setStageColumnRef(stageNumber: string, el: unknown) {
  if (el instanceof HTMLElement) {
    stageColumnRefs.value[stageNumber] = el
  } else {
    delete stageColumnRefs.value[stageNumber]
  }
}

function scrollToStage(stageNumber: string) {
  stageColumnRefs.value[stageNumber]?.scrollIntoView({
    behavior: 'smooth',
    inline: 'start',
    block: 'nearest',
  })
}

function formatCardDate(iso?: string | null): string {
  return formatCardDateForLanguage(iso, language.value)
}

function boardSortTime(board: KanbanBoard): number {
  let latest = latestTimestamp(board.updated_at, board.created_at)
  for (const card of cards.value) {
    if (card.boardId === board.id) {
      latest = Math.max(latest, latestTimestamp(card.updatedAt, card.createdAt))
    }
  }
  return latest
}

const activeBoard = computed(() => boards.value.find((board) => board.is_active) ?? null)
const completedBoards = computed(() =>
  boards.value
    .filter((board) => !board.is_active && isBoardCompleted(board, cards.value))
    .sort((a, b) => boardSortTime(b) - boardSortTime(a)),
)
const completedBoardOptions = computed(() =>
  completedBoards.value.map((board) => ({ value: board.id, label: board.title })),
)
const displayedBoard = computed<KanbanBoard | null>(() => {
  if (viewMode.value === 'completed') {
    return (
      completedBoards.value.find((board) => board.id === selectedCompletedBoardId.value) ??
      completedBoards.value[0] ??
      null
    )
  }
  return activeBoard.value
})

const boardCardsCount = computed(() => {
  const board = displayedBoard.value
  if (!board) return 0
  return cards.value.filter((card) => card.boardId === board.id).length
})

const filteredBoardCards = computed<KanbanCard[]>(() => {
  const board = displayedBoard.value
  if (!board) return []
  const q = searchQuery.value.trim().toLowerCase()
  const filtered = cards.value.filter((card) => {
    if (card.boardId !== board.id) return false
    if (selectedType.value !== 'all' && card.commissionType !== selectedType.value) return false
    if (!q) return true
    return (
      card.title.toLowerCase().includes(q) ||
      card.description.toLowerCase().includes(q) ||
      card.requestors.some((tag) => tag.toLowerCase().includes(q))
    )
  })
  if (viewMode.value !== 'completed') return filtered
  return [...filtered].sort(
    (a, b) => latestTimestamp(b.updatedAt, b.createdAt) - latestTimestamp(a.updatedAt, a.createdAt),
  )
})

function applyInitialRouteSelection() {
  const queryBoard = typeof route.query.board === 'string' ? route.query.board : ''
  const queryCardId = typeof route.query.card === 'string' ? route.query.card : ''

  if (!activeBoard.value && completedBoards.value.length > 0) {
    viewMode.value = 'completed'
    selectedCompletedBoardId.value = completedBoards.value[0]!.id
  }

  if (queryBoard && completedBoards.value.some((board) => board.id === queryBoard)) {
    viewMode.value = 'completed'
    selectedCompletedBoardId.value = queryBoard
  }

  if (queryCardId) {
    const targetCard = cards.value.find((card) => card.id === queryCardId)
    if (targetCard) {
      if (completedBoards.value.some((board) => board.id === targetCard.boardId)) {
        viewMode.value = 'completed'
        selectedCompletedBoardId.value = targetCard.boardId
        detailCard.value = targetCard
      } else if (activeBoard.value?.id === targetCard.boardId) {
        viewMode.value = 'active'
        detailCard.value = targetCard
      }
    }
  }
}

onMounted(async () => {
  if (!supabase) {
    applyInitialRouteSelection()
    return
  }
  try {
    const [statusData, { data: boardsData }] = await Promise.all([
      fetchCommissionStatus(),
      supabase
        .from('kanban_boards')
        .select('id,title,description,is_active,is_backlog,created_at,updated_at')
        .eq('is_backlog', false)
        .order('created_at', { ascending: false }),
    ])
    commissionStatus.value = statusData

    const loadedBoards = (boardsData ?? []) as KanbanBoard[]
    boards.value = loadedBoards
    if (loadedBoards.length === 0) return

    const { data: cardsData } = await supabase
      .from('kanban_cards')
      .select('id,board_id,stage_number,commission_type,title,description,requestors,image_path,created_at,updated_at')
      .in(
        'board_id',
        loadedBoards.map((board) => board.id),
      )
      .order('created_at', { ascending: true })

    if (cardsData) cards.value = (cardsData as KanbanCardRow[]).map(toKanbanCard)
    applyInitialRouteSelection()
  } finally {
    loading.value = false
  }
})

onUnmounted(() => {
  revokeBlobUrls(cards.value.map((card) => card.imageUrl))
})

function openAddCard() {
  if (!signedIn.value || !activeBoard.value) return
  viewMode.value = 'active'
  editingCard.value = null
  formOpen.value = true
}

function openEditCard(card: KanbanCard) {
  if (!signedIn.value) return
  editingCard.value = card
  formOpen.value = true
}

function onCardSaved(savedCard: KanbanCard, isEdit: boolean) {
  if (isEdit) {
    const index = cards.value.findIndex((item) => item.id === savedCard.id)
    if (index !== -1) cards.value[index] = savedCard
  } else {
    cards.value.push(savedCard)
  }
  editingCard.value = null
}

async function deleteCard(card: KanbanCard) {
  if (!signedIn.value) return
  await deleteKanbanCard(card)
  cards.value = cards.value.filter((item) => item.id !== card.id)
}

function cardsForStage(stageNumber: string): KanbanCard[] {
  return filteredBoardCards.value.filter((card) => card.stageNumber === stageNumber)
}

function adjacentStage(currentStage: string, delta: -1 | 1): string | null {
  const stages = text.value.home.stages
  const idx = stages.findIndex((stage) => stage.number === currentStage)
  if (idx === -1) return null
  return stages[idx + delta]?.number ?? null
}

function stageLabel(stageNumber: string): string {
  return getStageLabel(stageNumber, text.value.home.stages)
}

function stageProgress(stageNumber: string): number {
  return getStageProgress(stageNumber, text.value.home.stages)
}

function openDetailCard(card: KanbanCard) {
  detailCard.value = card
  const nextQuery: Record<string, string> = { card: card.id }
  if (viewMode.value === 'completed') nextQuery.board = card.boardId
  void router.replace({ query: nextQuery })
}

function closeDetailCard() {
  detailCard.value = null
  const nextQuery = { ...route.query }
  delete nextQuery.card
  void router.replace({ query: nextQuery })
}

function setBoardView(mode: 'active' | 'completed') {
  viewMode.value = mode
  if (mode === 'completed' && !selectedCompletedBoardId.value && completedBoards.value[0]) {
    selectedCompletedBoardId.value = completedBoards.value[0].id
  }
}

function clearFilters() {
  searchQuery.value = ''
  selectedType.value = 'all'
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

async function moveCardStage(card: KanbanCard, nextStage: string) {
  if (!signedIn.value || card.stageNumber === nextStage) return
  const index = cards.value.findIndex((item) => item.id === card.id)
  if (index === -1) return
  const [moved] = cards.value.splice(index, 1)
  if (!moved) return
  const previousStage = moved.stageNumber
  const previousUpdatedAt = moved.updatedAt
  moved.stageNumber = nextStage
  moved.updatedAt = new Date().toISOString()
  cards.value.push(moved)

  if (detailCard.value?.id === moved.id) {
    detailCard.value = moved
  }

  if (supabase) {
    const { error: updateError } = await supabase
      .from('kanban_cards')
      .update({ stage_number: nextStage })
      .eq('id', moved.id)
    if (updateError) {
      moved.stageNumber = previousStage
      moved.updatedAt = previousUpdatedAt
    }
  }
}

async function onColumnDrop(targetStage: string, event: DragEvent) {
  const cardId = draggingCardId.value || event.dataTransfer?.getData('text/plain') || ''
  onCardDragEnd()
  if (!cardId || !signedIn.value) return
  const card = cards.value.find((item) => item.id === cardId)
  if (card) await moveCardStage(card, targetStage)
}
</script>

<template>
  <main class="flex flex-1 flex-col px-6 sm:px-10">
    <section class="flex w-full flex-1 flex-col py-20 sm:py-28" aria-labelledby="page-title">
      <div class="mx-auto w-full max-w-384">
        <div class="max-w-2xl">
          <div class="mb-5 flex flex-wrap items-center gap-3">
            <p class="text-xs uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
              {{ text.home.commissionEyebrow }}
            </p>
            <CommissionStatusBadge v-if="commissionStatus" :value="commissionStatus" />
          </div>
          <h1
            id="page-title"
            class="font-bagel-fat-one text-6xl leading-none text-zinc-950 sm:text-8xl dark:text-zinc-50"
          >
            {{ text.home.commissionTitle }}
          </h1>
          <p class="mt-6 text-lg leading-7 text-zinc-600 dark:text-zinc-300">
            {{ text.home.commissionDescription }}
          </p>
        </div>
      </div>

      <div
        v-if="loading"
        class="mx-auto mt-12 flex min-h-48 w-full max-w-384 items-center justify-center text-zinc-600 dark:text-zinc-300"
      >
        <LoadingIndicator :label="text.site.loading" />
      </div>

      <EmptyState
        v-else-if="!displayedBoard"
        :title="text.home.noActiveBoardTitle"
        :description="text.home.noActiveBoardDescription"
        class="mx-auto mt-12 py-12"
      />

      <div v-else-if="displayedBoard" class="surface-shadow mx-auto mt-12 w-full max-w-384 rounded-2xl border border-zinc-200 bg-white p-5 sm:p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <div class="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 class="text-2xl font-bold text-zinc-950 sm:text-3xl dark:text-zinc-50">
              {{ displayedBoard.title }}
            </h2>
            <p
              v-if="displayedBoard.description"
              class="mt-1 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400"
            >
              {{ displayedBoard.description }}
            </p>
          </div>

          <div class="flex w-full flex-wrap items-center gap-3 sm:w-auto sm:justify-end">
            <div
              v-if="completedBoards.length > 0"
              role="group"
              :aria-label="text.home.boardViewLabel"
              class="inline-flex rounded-xl border border-zinc-200 bg-zinc-100 p-1 dark:border-zinc-700 dark:bg-zinc-800"
            >
              <button
                v-if="activeBoard"
                type="button"
                :class="[
                  'min-h-9 rounded-lg px-3 text-xs font-medium transition-colors',
                  viewMode === 'active'
                    ? 'bg-white text-zinc-950 shadow-xs dark:bg-zinc-900 dark:text-zinc-50'
                    : 'text-zinc-600 hover:text-zinc-950 dark:text-zinc-300 dark:hover:text-zinc-50',
                ]"
                @click="setBoardView('active')"
              >
                {{ text.home.activeBoardTab }}
              </button>
              <button
                type="button"
                :class="[
                  'min-h-9 rounded-lg px-3 text-xs font-medium transition-colors',
                  viewMode === 'completed'
                    ? 'bg-white text-zinc-950 shadow-xs dark:bg-zinc-900 dark:text-zinc-50'
                    : 'text-zinc-600 hover:text-zinc-950 dark:text-zinc-300 dark:hover:text-zinc-50',
                ]"
                @click="setBoardView('completed')"
              >
                {{ text.home.completedBoardsTab }} ({{ completedBoards.length }})
              </button>
            </div>

            <div v-if="viewMode === 'completed' && completedBoards.length > 1" class="min-w-44">
              <label for="completed-board-select" class="sr-only">{{ text.home.selectCompletedBoard }}</label>
              <SelectField
                id="completed-board-select"
                v-model="selectedCompletedBoardId"
                :options="completedBoardOptions"
                :aria-label="text.home.selectCompletedBoard"
              />
            </div>

            <form class="w-full sm:w-72" role="search" @submit.prevent>
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

            <MotionButton
              v-if="signedIn && activeBoard && viewMode === 'active'"
              type="button"
              class="min-h-11 gap-1.5"
              @click="openAddCard"
            >
              <Plus :size="16" aria-hidden="true" />
              <span>{{ text.home.addCard }}</span>
            </MotionButton>
          </div>
        </div>

        <div
          class="mt-4 flex flex-wrap items-center justify-between gap-3"
        >
          <div
            class="flex flex-wrap items-center gap-2"
            role="group"
            :aria-label="text.home.filterTypeLabel"
          >
            <button
              type="button"
              :class="[
                'min-h-9 rounded-full px-3.5 py-1 text-xs font-medium transition-colors',
                selectedType === 'all'
                  ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900'
                  : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700',
              ]"
              @click="selectedType = 'all'"
            >
              {{ text.home.filterAllTypes }}
            </button>
            <button
              v-for="typeOption in COMMISSION_TYPES"
              :key="typeOption"
              type="button"
              :class="[
                'min-h-9 rounded-full px-3.5 py-1 text-xs font-medium transition-colors',
                selectedType === typeOption
                  ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900'
                  : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700',
              ]"
              @click="selectedType = typeOption"
            >
              {{ text.home.commissionTypes[typeOption] }}
            </button>
          </div>

          <div
            v-if="searchQuery.trim() || selectedType !== 'all'"
            class="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400"
          >
            <span class="tabular-nums">
              {{
                text.home.showingCount
                  .replace('{shown}', String(filteredBoardCards.length))
                  .replace('{total}', String(boardCardsCount))
              }}
            </span>
            <button
              type="button"
              class="rounded-full border border-zinc-300 px-2.5 py-1 text-xs text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
              @click="clearFilters"
            >
              {{ text.home.resetFilters }}
            </button>
          </div>
        </div>

        <KanbanCardFormDialog
          v-if="signedIn && activeBoard"
          v-model:open="formOpen"
          :board-id="activeBoard.id"
          :card="editingCard"
          @saved="onCardSaved"
        />

        <CommissionCardDetailDialog
          :card="detailCard"
          :include-board-in-link="viewMode === 'completed'"
          :stage-label="detailCard ? stageLabel(detailCard.stageNumber) : ''"
          :progress="detailCard ? stageProgress(detailCard.stageNumber) : 0"
          :formatted-date="detailCard ? formatCardDate(detailCard.updatedAt ?? detailCard.createdAt) : ''"
          @close="closeDetailCard"
        />

        <EmptyState
          v-if="boardCardsCount === 0"
          variant="card"
          heading="h3"
          :title="text.home.previewEmptyCards"
          :description="text.home.emptyBoardDescription"
          class="mt-6"
        >
          <MotionButton
            v-if="signedIn && viewMode === 'active'"
            type="button"
            class="mt-5 min-h-11 gap-1.5"
            @click="openAddCard"
          >
            <Plus :size="16" aria-hidden="true" />
            <span>{{ text.home.addCard }}</span>
          </MotionButton>
        </EmptyState>

        <EmptyState
          v-else-if="filteredBoardCards.length === 0"
          variant="card"
          :description="text.home.noFilteredCards"
          class="mt-6"
        >
          <button
            type="button"
            class="mt-3 inline-flex min-h-9 items-center rounded-full border border-zinc-300 px-3.5 py-1 text-xs text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
            @click="clearFilters"
          >
            {{ text.home.resetFilters }}
          </button>
        </EmptyState>

        <div v-else-if="viewMode === 'completed'" class="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <CommissionCard
            v-for="card in filteredBoardCards"
            :key="card.id"
            :card="card"
            :stage-label="stageLabel(card.stageNumber)"
            :progress="stageProgress(card.stageNumber)"
            :formatted-date="formatCardDate(card.updatedAt ?? card.createdAt)"
            @detail="openDetailCard(card)"
          />
        </div>

        <div v-else class="mt-6 space-y-3">
          <nav
            :aria-label="text.home.stagesLabel"
            class="flex gap-2 overflow-x-auto pb-1 xl:hidden"
          >
            <button
              v-for="stage in text.home.stages"
              :key="`jump-${stage.number}`"
              type="button"
              class="inline-flex min-h-9 shrink-0 items-center gap-2 rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-xs text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800/80 dark:text-zinc-200 dark:hover:bg-zinc-800"
              @click="scrollToStage(stage.number)"
            >
              <span :class="['size-2 rounded-full', stageStyle(stage.number).dot]" aria-hidden="true" />
              <span>{{ stage.label }}</span>
              <span class="tabular-nums text-zinc-500 dark:text-zinc-400">{{ cardsForStage(stage.number).length }}</span>
            </button>
          </nav>

          <div class="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-3 scroll-pl-1 xl:overflow-visible xl:pb-0" :aria-label="text.home.stagesLabel">
            <div
              v-for="stage in text.home.stages"
              :key="stage.number"
              :ref="(el) => setStageColumnRef(stage.number, el)"
              :class="[
                'flex w-[min(17.5rem,78vw)] shrink-0 snap-start flex-col gap-3 rounded-xl p-3.5 text-sm text-zinc-900 transition-colors xl:w-auto xl:min-w-0 xl:flex-1 dark:text-zinc-100',
                dragOverStage === stage.number ? 'bg-orange-50/60 ring-2 ring-orange-500 dark:bg-zinc-800/80 dark:ring-orange-400' : 'bg-zinc-100 dark:bg-zinc-800',
              ]"
            @dragover.prevent="onColumnDragOver(stage.number, $event)"
            @dragenter.prevent="onColumnDragOver(stage.number, $event)"
            @dragleave="onColumnDragLeave(stage.number, $event)"
            @drop.prevent="onColumnDrop(stage.number, $event)"
          >
            <div class="flex items-center justify-between gap-2">
              <span class="inline-flex items-center gap-2">
                <span :class="['size-2 rounded-full', stageStyle(stage.number).dot]" aria-hidden="true" />
                <span>{{ stage.label }}</span>
              </span>
              <span class="rounded-full bg-white px-2 py-0.5 text-xs text-zinc-600 dark:bg-zinc-900 dark:text-zinc-300">
                {{ cardsForStage(stage.number).length }}
              </span>
            </div>

            <div v-if="cardsForStage(stage.number).length" class="space-y-2.5">
              <CommissionCard
                v-for="card in cardsForStage(stage.number)"
                :key="card.id"
                :card="card"
                :editable="Boolean(signedIn)"
                :dragging="draggingCardId === card.id"
                :can-move-prev="Boolean(adjacentStage(card.stageNumber, -1))"
                :can-move-next="Boolean(adjacentStage(card.stageNumber, 1))"
                :stage-label="stageLabel(card.stageNumber)"
                :progress="stageProgress(card.stageNumber)"
                :formatted-date="formatCardDate(card.updatedAt ?? card.createdAt)"
                :on-delete="() => deleteCard(card)"
                @detail="openDetailCard(card)"
                @edit="openEditCard(card)"
                @move-prev="() => { const prev = adjacentStage(card.stageNumber, -1); if (prev) void moveCardStage(card, prev) }"
                @move-next="() => { const next = adjacentStage(card.stageNumber, 1); if (next) void moveCardStage(card, next) }"
                @dragstart="onCardDragStart(card.id, $event)"
                @dragend="onCardDragEnd"
              />
            </div>
            <div
              v-else
              class="flex min-h-24 items-center justify-center rounded-lg border border-dashed border-zinc-300/80 px-3 py-4 text-center text-xs text-zinc-400 dark:border-zinc-700/80 dark:text-zinc-500"
            >
              {{ text.home.emptyStage }}
            </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  </main>
</template>
