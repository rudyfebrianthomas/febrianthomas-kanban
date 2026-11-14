<script setup lang="ts">
import { Check, Copy, FileText, Pencil, Plus, Search, Trash2, X } from '@lucide/vue'
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
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useLanguage } from '../../composables/useLanguage'
import {
  activeOfferBoardCount,
  canActivateOfferBoard,
  type CommissionOffer,
  type CommissionOfferBoard,
  type CommissionOfferBoardRow,
  type CommissionOfferRow,
  DEFAULT_COMMISSION_OFFERS,
  DEFAULT_COMMISSION_OFFER_BOARDS,
  fetchCommissionOfferBoards,
  fetchCommissionOffers,
  formatOfferPrices,
  isOfferLimitReached,
  MAX_ACTIVE_OFFER_BOARDS,
  OFFER_BOARD_STATUSES,
  OFFER_BOARD_STATUS_DOTS,
  type OfferBoardStatus,
  toCommissionOffer,
  toCommissionOfferBoard,
} from '../../lib/commissionOffers'
import { COMMISSION_TYPES, type CommissionType } from '../../lib/commissionStatus'
import { uploadKanbanImage } from '../../lib/kanbanImage'
import { supabase } from '../../lib/supabase'
import ConfirmDialog from '../ui/ConfirmDialog.vue'
import ImageUploadField from '../ui/ImageUploadField.vue'
import SelectField from '../ui/SelectField.vue'
import OfferBoardFormDialog from './OfferBoardFormDialog.vue'

type BoardFilter = 'all' | OfferBoardStatus

const OFFER_SELECT_COLUMNS =
  'id,board_id,commission_type,title,description,price_usd,price_idr,image_path,is_open,sort_order,max_requests,request_count'

const emit = defineEmits<{
  offersChange: [offers: CommissionOffer[], boards: CommissionOfferBoard[]]
}>()

const { language, text } = useLanguage()
const reducedMotion = useReducedMotion()

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
const boardSaving = ref(false)
const boardFormError = ref('')

const dialogOpen = ref(false)
const editingOffer = ref<CommissionOffer | null>(null)
const templateOffer = ref<CommissionOffer | null>(null)
const targetBoardId = ref('')
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
])

const activeBoardsUsed = computed(() => activeOfferBoardCount(boards.value))

const canDialogBoardSetActive = computed(() =>
  canActivateOfferBoard(
    boards.value,
    boardDialogMode.value === 'edit' ? activeDialogBoard.value?.id : undefined,
  ),
)

const filteredBoards = computed(() => {
  const needle = query.value.trim().toLowerCase()
  return boards.value.filter((board) => {
    if (statusFilter.value !== 'all' && board.status !== statusFilter.value) return false
    if (!needle) return true
    const boardMatches =
      board.title.toLowerCase().includes(needle) ||
      (board.description ?? '').toLowerCase().includes(needle)
    if (boardMatches) return true
    return offersForBoard(board.id, needle).length > 0
  })
})

const dialogTitle = computed(() => {
  if (editingOffer.value) return text.value.setting.offers.editTitle
  if (templateOffer.value) return text.value.setting.offers.copyTitle
  return text.value.setting.offers.createTitle
})

const dialogDescription = computed(() => {
  if (editingOffer.value) return text.value.setting.offers.editDescription
  if (templateOffer.value) return text.value.setting.offers.copyDescription
  return text.value.setting.offers.createDescription
})

watch(
  [offers, boards],
  ([nextOffers, nextBoards]) => {
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
  } catch {
    loadError.value = text.value.setting.offers.saveError
  } finally {
    loading.value = false
  }
})

onUnmounted(() => {
  for (const offer of offers.value) {
    if (offer.imageUrl?.startsWith('blob:')) URL.revokeObjectURL(offer.imageUrl)
  }
})

function offerMatchesNeedle(offer: CommissionOffer, needle: string): boolean {
  if (!needle) return true
  const typeLabel = text.value.home.commissionTypes[offer.commissionType].toLowerCase()
  return (
    offer.title.toLowerCase().includes(needle) ||
    offer.description.toLowerCase().includes(needle) ||
    offer.commissionType.toLowerCase().includes(needle) ||
    typeLabel.includes(needle)
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

function boardStatusBadgeClass(status: OfferBoardStatus): string {
  if (status === 'active') {
    return 'bg-orange-500/15 text-orange-700 dark:bg-orange-400/15 dark:text-orange-300'
  }
  if (status === 'waitlist') {
    return 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-200'
  }
  return 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300'
}

function openCreateBoard() {
  boardDialogMode.value = 'create'
  activeDialogBoard.value = null
  boardFormError.value = ''
  boardDialogOpen.value = true
}

function openEditBoard(board: CommissionOfferBoard) {
  boardDialogMode.value = 'edit'
  activeDialogBoard.value = board
  boardFormError.value = ''
  boardDialogOpen.value = true
}

function openCopyBoard(board: CommissionOfferBoard) {
  boardDialogMode.value = 'copy'
  activeDialogBoard.value = board
  boardFormError.value = ''
  boardDialogOpen.value = true
}

async function saveBoard(payload: {
  title: string
  description: string | null
  status: OfferBoardStatus
}) {
  if (boardSaving.value) return
  if (
    payload.status === 'active' &&
    !canActivateOfferBoard(
      boards.value,
      boardDialogMode.value === 'edit' ? activeDialogBoard.value?.id : undefined,
    )
  ) {
    boardFormError.value = text.value.setting.offers.maxActiveError
    return
  }

  boardSaving.value = true
  boardFormError.value = ''
  loadError.value = ''
  try {
    const editing = boardDialogMode.value === 'edit' ? activeDialogBoard.value : null
    const copySource = boardDialogMode.value === 'copy' ? activeDialogBoard.value : null

    if (!supabase) {
      if (editing) {
        boards.value = boards.value.map((item) =>
          item.id === editing.id ? { ...item, ...payload } : item,
        )
      } else {
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
      }
      boardDialogOpen.value = false
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
    } else {
      const nextBoardSort = boards.value.reduce((max, item) => Math.max(max, item.sortOrder), 0) + 1
      const { data: boardData, error: boardError } = await supabase
        .from('commission_offer_boards')
        .insert({ ...payload, sort_order: nextBoardSort })
        .select('id,title,description,status,sort_order')
        .single()
      if (boardError || !boardData) throw boardError
      const createdBoard = toCommissionOfferBoard(boardData as CommissionOfferBoardRow)
      boards.value.push(createdBoard)

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
    boardDialogOpen.value = false
  } catch (err) {
    const message = err instanceof Error ? err.message : ''
    boardFormError.value = message.includes('active')
      ? text.value.setting.offers.maxActiveError
      : text.value.setting.offers.saveError
  } finally {
    boardSaving.value = false
  }
}

async function setBoardStatus(board: CommissionOfferBoard, nextStatus: OfferBoardStatus) {
  if (statusBusyBoardId.value || board.status === nextStatus) return
  if (nextStatus === 'active' && !canActivateOfferBoard(boards.value, board.id)) {
    loadError.value = text.value.setting.offers.maxActiveError
    return
  }

  statusBusyBoardId.value = board.id
  loadError.value = ''
  try {
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
  } catch (err) {
    const message = err instanceof Error ? err.message : ''
    loadError.value = message.includes('active')
      ? text.value.setting.offers.maxActiveError
      : text.value.setting.offers.saveError
  } finally {
    statusBusyBoardId.value = ''
  }
}

async function deleteBoard(board: CommissionOfferBoard) {
  const boardOffers = offers.value.filter((item) => item.boardId === board.id)
  if (supabase) {
    const { error } = await supabase.from('commission_offer_boards').delete().eq('id', board.id)
    if (error) throw error
    const paths = boardOffers
      .map((item) => item.imagePath)
      .filter((path): path is string => Boolean(path))
    if (paths.length > 0) {
      await supabase.storage.from('kanban-images').remove(paths).catch(() => {})
    }
  } else {
    for (const item of boardOffers) {
      if (item.imageUrl?.startsWith('blob:')) URL.revokeObjectURL(item.imageUrl)
    }
  }
  boards.value = boards.value.filter((item) => item.id !== board.id)
  offers.value = offers.value.filter((item) => item.boardId !== board.id)
}

function resetImageState() {
  imageFile.value = null
  removeExistingImage.value = false
  imageError.value = ''
}

function openCreate(boardId: string) {
  editingOffer.value = null
  templateOffer.value = null
  targetBoardId.value = boardId
  typeInput.value = 'Illustration'
  titleInput.value = ''
  priceUsdInput.value = ''
  priceIdrInput.value = ''
  maxRequestsInput.value = ''
  descriptionInput.value = ''
  openInput.value = true
  resetImageState()
  formError.value = ''
  dialogOpen.value = true
}

function prefillOfferForm(offer: CommissionOffer, asCopy: boolean) {
  editingOffer.value = asCopy ? null : offer
  templateOffer.value = asCopy ? offer : null
  targetBoardId.value = offer.boardId
  typeInput.value = offer.commissionType
  titleInput.value = asCopy
    ? `${offer.title} (${text.value.setting.offers.copySuffix})`.slice(0, 120)
    : offer.title
  priceUsdInput.value = offer.priceUsd
  priceIdrInput.value = offer.priceIdr
  maxRequestsInput.value = offer.maxRequests ?? ''
  descriptionInput.value = offer.description
  openInput.value = offer.isOpen
  resetImageState()
  formError.value = ''
  dialogOpen.value = true
}

function openEdit(offer: CommissionOffer) {
  prefillOfferForm(offer, false)
}

function openCopy(offer: CommissionOffer) {
  prefillOfferForm(offer, true)
}

function onOpenChange(nextOpen: boolean) {
  if (saving.value) return
  dialogOpen.value = nextOpen
  if (!nextOpen) {
    templateOffer.value = null
    resetImageState()
  }
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
    const editing = editingOffer.value
    const boardId = editing?.boardId ?? targetBoardId.value
    if (!boardId) throw new Error('Missing board')

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
        offers.value = offers.value.map((item) =>
          item.id === editing.id
            ? {
                ...item,
                commissionType: typeInput.value,
                title,
                priceUsd,
                priceIdr: roundedIdr,
                description,
                imageUrl: nextUrl,
                isOpen: openInput.value,
                maxRequests,
              }
            : item,
        )
      } else {
        const inheritedTemplate = removeExistingImage.value ? null : templateOffer.value
        offers.value.push({
          id: crypto.randomUUID(),
          boardId,
          commissionType: typeInput.value,
          title,
          priceUsd,
          priceIdr: roundedIdr,
          description,
          imagePath: inheritedTemplate?.imagePath ?? null,
          imageUrl: imageFile.value
            ? URL.createObjectURL(imageFile.value)
            : inheritedTemplate?.imageUrl,
          isOpen: openInput.value,
          sortOrder: offers.value.length + 1,
          maxRequests,
          requestCount: 0,
        })
      }
      dialogOpen.value = false
      templateOffer.value = null
      resetImageState()
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
      if (oldImagePath && (uploadedPath || removeExistingImage.value)) {
        await supabase.storage.from('kanban-images').remove([oldImagePath]).catch(() => {})
      }
      const updated = toCommissionOffer(data as CommissionOfferRow)
      offers.value = offers.value.map((item) => (item.id === updated.id ? updated : item))
    } else {
      const nextSort = offers.value.reduce((max, item) => Math.max(max, item.sortOrder), 0) + 1
      const copiedImagePath =
        uploadedPath ?? (removeExistingImage.value ? null : (templateOffer.value?.imagePath ?? null))
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
          sort_order: nextSort,
          max_requests: maxRequests,
        })
        .select(OFFER_SELECT_COLUMNS)
        .single()
      if (error || !data) throw error
      offers.value.push(toCommissionOffer(data as CommissionOfferRow))
    }
    dialogOpen.value = false
    templateOffer.value = null
    resetImageState()
  } catch {
    formError.value = text.value.setting.offers.saveError
  } finally {
    saving.value = false
  }
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
  } catch {
    loadError.value = text.value.setting.offers.saveError
  } finally {
    resettingId.value = ''
  }
}

async function deleteOffer(offer: CommissionOffer) {
  if (supabase) {
    const { error } = await supabase.from('commission_offers').delete().eq('id', offer.id)
    if (error) throw error
    if (offer.imagePath) {
      await supabase.storage.from('kanban-images').remove([offer.imagePath]).catch(() => {})
    }
  } else if (offer.imageUrl?.startsWith('blob:')) {
    URL.revokeObjectURL(offer.imageUrl)
  }
  offers.value = offers.value.filter((item) => item.id !== offer.id)
}
</script>

<template>
  <section class="mt-8">
    <div class="flex flex-wrap items-start justify-between gap-4">
      <div>
        <div class="flex flex-wrap items-center gap-2.5">
          <h2 class="text-2xl font-bold text-zinc-950 sm:text-3xl dark:text-zinc-50">
            {{ text.setting.offers.title }}
          </h2>
          <span
            class="rounded-full bg-orange-500/15 px-3 py-1 text-xs font-medium tabular-nums text-orange-700 dark:bg-orange-400/15 dark:text-orange-300"
          >
            {{ activeBoardsUsed }}/{{ MAX_ACTIVE_OFFER_BOARDS }} {{ text.setting.offers.activeLimitCount }}
          </span>
        </div>
        <p class="mt-1.5 text-sm text-zinc-600 dark:text-zinc-400">
          {{ text.setting.offers.description }}
        </p>
      </div>
      <button
        type="button"
        class="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-zinc-900 px-4 py-2 text-sm text-white transition-colors hover:bg-zinc-700 focus-visible:outline-2 focus-visible:outline-offset-2 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        @click="openCreateBoard"
      >
        <Plus :size="16" aria-hidden="true" />
        <span>{{ text.setting.offers.addBoard }}</span>
      </button>
    </div>

    <form v-if="!loading && boards.length > 0" class="mt-6 flex flex-wrap gap-3" role="search" @submit.prevent>
      <label for="offer-search" class="sr-only">{{ text.setting.offers.searchOffers }}</label>
      <div class="relative min-w-48 flex-1">
        <Search
          class="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-zinc-400"
          aria-hidden="true"
        />
        <input
          id="offer-search"
          v-model="query"
          type="search"
          :placeholder="text.setting.offers.searchOffersPlaceholder"
          class="min-h-11 w-full rounded-xl border border-zinc-300 bg-white pl-11 pr-4 text-sm text-zinc-950 outline-none placeholder:text-zinc-400 focus:ring-2 focus:ring-zinc-900 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-50 dark:placeholder:text-zinc-500 dark:focus:ring-zinc-300"
        />
      </div>
      <div class="w-40">
        <label for="offer-filter" class="sr-only">{{ text.setting.offers.filterOffers }}</label>
        <SelectField
          id="offer-filter"
          v-model="statusFilter"
          :options="boardFilterOptions"
          :aria-label="text.setting.offers.filterOffers"
        />
      </div>
    </form>

    <p
      v-if="loadError"
      role="alert"
      class="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300"
    >
      {{ loadError }}
    </p>

    <div v-if="loading" class="mt-6 flex flex-col gap-4">
      <div
        v-for="n in 3"
        :key="n"
        class="h-36 w-full animate-pulse rounded-2xl border border-zinc-200 bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900"
      />
    </div>

    <div
      v-else-if="boards.length === 0"
      class="mx-auto mt-6 flex min-h-60 flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-300 px-6 py-10 text-center dark:border-zinc-700"
    >
      <span
        aria-hidden="true"
        class="flex size-14 items-center justify-center rounded-2xl bg-orange-100 text-orange-700 dark:bg-zinc-800 dark:text-orange-300"
      >
        <FileText :size="26" />
      </span>
      <p class="mt-4 max-w-md text-sm leading-6 text-zinc-600 dark:text-zinc-300">
        {{ text.setting.offers.empty }}
      </p>
    </div>

    <p
      v-else-if="filteredBoards.length === 0"
      class="mt-6 rounded-2xl border border-dashed border-zinc-300 px-6 py-10 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400"
    >
      {{ text.setting.noSearchResults }}
    </p>

    <ul v-else class="mt-6 flex flex-col gap-4">
      <li
        v-for="board in filteredBoards"
        :key="board.id"
        :class="[
          'surface-shadow flex w-full flex-col gap-4 rounded-2xl border bg-white p-5 transition-opacity sm:p-6 dark:bg-zinc-900',
          board.status === 'inactive'
            ? 'border-zinc-200 opacity-85 dark:border-zinc-800'
            : 'border-zinc-200 dark:border-zinc-800',
        ]"
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
                  boardStatusBadgeClass(board.status),
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

        <p
          v-if="offersForBoard(board.id).length === 0"
          class="rounded-xl border border-dashed border-zinc-300 px-4 py-5 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400"
        >
          {{ text.setting.offers.emptyBoardOffers }}
        </p>

        <ul
          v-else
          class="divide-y divide-zinc-200 rounded-xl border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800"
        >
          <li
            v-for="offer in offersForBoard(board.id)"
            :key="offer.id"
            :class="[
              'flex flex-wrap items-center justify-between gap-3 px-4 py-3 transition-opacity',
              offer.isOpen ? '' : 'bg-zinc-50/70 opacity-75 dark:bg-zinc-800/30',
            ]"
          >
            <div class="flex min-w-0 flex-1 items-center gap-3">
              <img
                v-if="offer.imageUrl"
                :src="offer.imageUrl"
                :alt="offer.title"
                class="size-12 shrink-0 rounded-lg bg-zinc-100 object-cover dark:bg-zinc-800"
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
                  <button
                    v-if="offer.requestCount > 0"
                    type="button"
                    :disabled="resettingId === offer.id"
                    :aria-label="`${text.setting.offers.resetRequestsLabel}: ${offer.title}`"
                    class="rounded-full border border-zinc-300 px-2 py-0.5 text-[11px] text-zinc-700 transition-colors hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                    @click="resetRequestCount(offer)"
                  >
                    {{ text.setting.offers.resetRequests }}
                  </button>
                </div>
                <p class="mt-0.5 truncate text-xs text-zinc-500 dark:text-zinc-400">{{ offer.description }}</p>
              </div>
            </div>

            <div class="flex shrink-0 items-center gap-2">
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
      </li>
    </ul>

    <OfferBoardFormDialog
      v-model:open="boardDialogOpen"
      :mode="boardDialogMode"
      :board="activeDialogBoard"
      :can-set-active="canDialogBoardSetActive"
      :saving="boardSaving"
      :error="boardFormError"
      @save="saveBoard"
    />

    <DialogRoot :open="dialogOpen" @update:open="onOpenChange">
      <DialogPortal>
        <DialogOverlay class="fixed inset-0 z-50 bg-black/45 backdrop-blur-[2px]" />
        <DialogContent
          class="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 outline-none"
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
                <DialogTitle class="text-lg font-bold">
                  {{ dialogTitle }}
                </DialogTitle>
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
                    class="min-h-11 w-full rounded-xl border border-zinc-300 bg-white px-4 text-sm text-zinc-950 outline-none focus:ring-2 focus:ring-zinc-900 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-50 dark:focus:ring-zinc-300"
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
                    class="min-h-11 w-full rounded-xl border border-zinc-300 bg-white px-4 text-sm text-zinc-950 outline-none focus:ring-2 focus:ring-zinc-900 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-50 dark:focus:ring-zinc-300"
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
                  class="min-h-11 w-full rounded-xl border border-zinc-300 bg-white px-4 text-sm text-zinc-950 outline-none focus:ring-2 focus:ring-zinc-900 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-50 dark:focus:ring-zinc-300"
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
                  class="min-h-11 w-full rounded-xl border border-zinc-300 bg-white px-4 text-sm text-zinc-950 outline-none focus:ring-2 focus:ring-zinc-900 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-50 dark:focus:ring-zinc-300"
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
                  class="w-full rounded-xl border border-zinc-300 bg-white px-4 py-2.5 text-sm text-zinc-950 outline-none focus:ring-2 focus:ring-zinc-900 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-50 dark:focus:ring-zinc-300"
                />
              </div>

              <ImageUploadField
                v-model:file="imageFile"
                v-model:removed="removeExistingImage"
                v-model:error="imageError"
                id-prefix="offer-example"
                :label="text.setting.offers.exampleImageLabel"
                :existing-url="editingOffer?.imageUrl ?? templateOffer?.imageUrl"
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
  </section>
</template>
