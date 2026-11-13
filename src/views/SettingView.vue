<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { Check, FileText, Pencil, Plus, Search, Trash2, UploadCloud, X } from '@lucide/vue'
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
import ConfirmDialog from '../components/ConfirmDialog.vue'
import { useLanguage } from '../composables/useLanguage'
import { kanbanImageExtension, optimizeKanbanImage } from '../kanbanImage'
import { supabase } from '../supabase'

interface KanbanBoard {
  id: string
  title: string
  description: string | null
  is_active: boolean
  is_backlog: boolean
  created_at?: string
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
}

const BACKLOG_BOARD_ID = '00000000-0000-0000-0000-000000000000'
const cardFieldClass =
  'mt-2 w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 text-base text-zinc-950 outline-none focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-50 dark:focus:border-zinc-300 dark:focus:ring-zinc-300'

const { text } = useLanguage()
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

const cards = ref<KanbanCard[]>([])
const loading = ref(!!supabase)
const loadError = ref('')
const query = ref('')
const statusFilter = ref<BoardFilter>('active')

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
const cardDialogPending = ref(false)
const targetCardBoard = ref<KanbanBoard | null>(null)
const editingCard = ref<KanbanCard | null>(null)
const removeExistingImage = ref(false)
const cardCommissionType = ref<CommissionType>('Illustration')
const cardTitle = ref('')
const cardDescription = ref('')
const requestorInput = ref('')
const imageFile = ref<File | null>(null)
const previewUrl = ref('')
const draggingFile = ref(false)
const cardError = ref('')
const imageError = ref('')
const fileInput = ref<HTMLInputElement | null>(null)

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

const previewTags = computed(() => parseTags(requestorInput.value))
const activeImagePreviewUrl = computed(() => {
  if (imageFile.value && previewUrl.value) return previewUrl.value
  if (editingCard.value?.imageUrl && !removeExistingImage.value) return editingCard.value.imageUrl
  return ''
})

function parseTags(raw: string): string[] {
  return [...new Set(raw.split(',').map((item) => item.trim()).filter(Boolean))]
}

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
  }
}

function cardsForBoard(boardId: string): KanbanCard[] {
  return cards.value.filter((card) => card.boardId === boardId)
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
  return (
    text.value.home.stages.find((stage) => stage.number === card.stageNumber)?.label ??
    text.value.home.stages[0]?.label ??
    'To do'
  )
}

function cardProgress(board: KanbanBoard, card: KanbanCard): number {
  if (board.is_backlog) return 0
  const stages = text.value.home.stages
  const index = stages.findIndex((stage) => stage.number === card.stageNumber)
  if (index <= 0) return 0
  return Math.round((index / Math.max(stages.length - 1, 1)) * 100)
}

const subscription = supabase?.auth.onAuthStateChange((_event, session) => {
  if (!session) void router.replace('/')
})

onMounted(() => {
  void loadBoardsAndCards()
})

onUnmounted(() => {
  subscription?.data.subscription.unsubscribe()
  revokePreview()
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
      .select('id,board_id,stage_number,commission_type,title,description,requestors,image_path')
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
  cardError.value = ''
}

function onFileChange(event: Event) {
  const input = event.target as HTMLInputElement
  selectImage(input.files?.[0] ?? null)
}

function onDragEnter(event: DragEvent) {
  if (event.dataTransfer?.types.includes('Files')) draggingFile.value = true
}

function onDragLeave(event: DragEvent) {
  const currentTarget = event.currentTarget as HTMLElement | null
  const related = event.relatedTarget as Node | null
  if (!related || !currentTarget?.contains(related)) draggingFile.value = false
}

function onFileDrop(event: DragEvent) {
  draggingFile.value = false
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

function resetCardForm() {
  targetCardBoard.value = null
  editingCard.value = null
  removeExistingImage.value = false
  cardCommissionType.value = 'Illustration'
  cardTitle.value = ''
  cardDescription.value = ''
  requestorInput.value = ''
  draggingFile.value = false
  cardError.value = ''
  imageError.value = ''
  if (fileInput.value) fileInput.value.value = ''
  imageFile.value = null
  revokePreview()
}

function openAddCard(board: KanbanBoard) {
  resetCardForm()
  targetCardBoard.value = board
  cardDialogOpen.value = true
}

function openEditCard(card: KanbanCard, board: KanbanBoard) {
  resetCardForm()
  targetCardBoard.value = board
  editingCard.value = card
  cardCommissionType.value = card.commissionType
  cardTitle.value = card.title
  cardDescription.value = card.description
  requestorInput.value = card.requestors.join(', ')
  cardDialogOpen.value = true
}

function onCardDialogOpenChange(open: boolean) {
  if (cardDialogPending.value) return
  cardDialogOpen.value = open
  if (!open) resetCardForm()
}

async function submitCard() {
  const board = targetCardBoard.value
  if (cardDialogPending.value || imageError.value || !board) return

  const trimmedTitle = cardTitle.value.trim()
  const trimmedDescription = cardDescription.value.trim()
  const requestors = parseTags(requestorInput.value)

  if (!trimmedTitle || !trimmedDescription || requestors.length === 0) {
    cardError.value = text.value.home.requiredFields
    return
  }
  if (requestors.length > 10 || requestors.join(',').length > 400) {
    cardError.value = text.value.home.tagsInvalid
    return
  }

  const editing = editingCard.value
  const stageNumber = text.value.home.stages[0]?.number ?? '01'

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
      editing.commissionType = cardCommissionType.value
      editing.title = trimmedTitle
      editing.description = trimmedDescription
      editing.requestors = requestors
      editing.imageUrl = nextUrl
    } else {
      const cardImageUrl = imageFile.value ? URL.createObjectURL(imageFile.value) : undefined
      cards.value.push({
        id: crypto.randomUUID(),
        boardId: board.id,
        stageNumber,
        commissionType: cardCommissionType.value,
        title: trimmedTitle,
        description: trimmedDescription,
        requestors,
        imagePath: null,
        imageUrl: cardImageUrl,
      })
    }
    cardDialogOpen.value = false
    resetCardForm()
    return
  }

  cardDialogPending.value = true
  cardError.value = ''
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
          commission_type: cardCommissionType.value,
          title: trimmedTitle,
          description: trimmedDescription,
          requestors,
          image_path: nextImagePath,
        })
        .eq('id', editing.id)
        .select('id,board_id,stage_number,commission_type,title,description,requestors,image_path')
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
          board_id: board.id,
          stage_number: stageNumber,
          commission_type: cardCommissionType.value,
          title: trimmedTitle,
          description: trimmedDescription,
          requestors,
          image_path: uploadedPath,
        })
        .select('id,board_id,stage_number,commission_type,title,description,requestors,image_path')
        .single()

      if (insertError) throw insertError
      cards.value.push(toKanbanCard(data as KanbanCardRow))
    }

    cardDialogOpen.value = false
    resetCardForm()
  } catch {
    if (uploadedPath) {
      await supabase.storage.from('kanban-images').remove([uploadedPath]).catch(() => {})
    }
    cardError.value = text.value.home.saveError
  } finally {
    cardDialogPending.value = false
  }
}

async function deleteCard(card: KanbanCard) {
  if (supabase) {
    const { error: deleteError } = await supabase.from('kanban_cards').delete().eq('id', card.id)
    if (deleteError) throw deleteError
    if (card.imagePath) {
      await supabase.storage.from('kanban-images').remove([card.imagePath]).catch(() => {})
    }
  } else if (card.imageUrl?.startsWith('blob:')) {
    URL.revokeObjectURL(card.imageUrl)
  }
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
          <p class="mb-4 text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
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
          class="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300 dark:focus-visible:ring-zinc-300"
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
                  <DialogTitle class="text-lg font-medium">
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
                    class="mb-1.5 block text-sm font-medium text-zinc-800 dark:text-zinc-200"
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
                    class="mb-1.5 block text-sm font-medium text-zinc-800 dark:text-zinc-200"
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
                      class="inline-flex min-h-11 items-center justify-center rounded-xl border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                    >
                      {{ text.setting.close }}
                    </button>
                  </DialogClose>
                  <button
                    type="submit"
                    :disabled="saving"
                    class="inline-flex min-h-11 items-center justify-center rounded-xl bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
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

      <DialogRoot :open="cardDialogOpen" @update:open="onCardDialogOpenChange">
        <DialogPortal>
          <DialogOverlay class="fixed inset-0 z-60 bg-zinc-950/50" />
          <div class="pointer-events-none fixed inset-0 z-70 flex items-center justify-center p-4 sm:p-6">
            <DialogContent as-child>
              <motion.div
                data-lenis-prevent
                :initial="prefersReducedMotion ? false : { opacity: 0, scale: 0.97, y: 8 }"
                :animate="{ opacity: 1, scale: 1, y: 0 }"
                :transition="{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }"
                class="surface-shadow pointer-events-auto max-h-[calc(100dvh-2rem)] w-full max-w-2xl overflow-y-auto rounded-3xl bg-white p-6 text-zinc-950 focus:outline-none sm:p-8 dark:bg-zinc-900 dark:text-zinc-50"
              >
                <div class="flex items-start justify-between gap-4">
                  <DialogTitle class="text-3xl font-semibold tracking-tight sm:text-4xl">
                    {{ editingCard ? text.home.editCardTitle : text.home.createCardTitle }}
                  </DialogTitle>
                  <DialogClose as-child>
                    <button
                      type="button"
                      :disabled="cardDialogPending"
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
                    <label for="setting-card-title" class="block text-sm font-medium">{{ text.home.titleLabel }}</label>
                    <input
                      id="setting-card-title"
                      v-model="cardTitle"
                      type="text"
                      required
                      maxlength="120"
                      :class="cardFieldClass"
                    />
                  </div>

                  <div>
                    <label for="setting-card-commission-type" class="block text-sm font-medium">
                      {{ text.home.commissionTypeLabel }}
                    </label>
                    <select
                      id="setting-card-commission-type"
                      v-model="cardCommissionType"
                      required
                      :class="cardFieldClass"
                    >
                      <option v-for="typeOption in COMMISSION_TYPES" :key="typeOption" :value="typeOption">
                        {{ text.home.commissionTypes[typeOption] }}
                      </option>
                    </select>
                  </div>

                  <div>
                    <label for="setting-card-description" class="block text-sm font-medium">
                      {{ text.home.descriptionLabel }}
                    </label>
                    <textarea
                      id="setting-card-description"
                      v-model="cardDescription"
                      rows="3"
                      required
                      maxlength="240"
                      :class="cardFieldClass"
                    />
                  </div>

                  <div>
                    <label for="setting-card-requestor" class="block text-sm font-medium">
                      {{ text.home.requestorLabel }}
                    </label>
                    <input
                      id="setting-card-requestor"
                      v-model="requestorInput"
                      type="text"
                      required
                      :class="cardFieldClass"
                    />
                    <p class="mt-2 text-xs text-zinc-500 dark:text-zinc-400">{{ text.home.requestorHelp }}</p>
                    <div v-if="previewTags.length" class="mt-2.5 flex flex-wrap gap-1.5">
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
                    <label for="setting-card-image" class="block text-sm font-medium">{{ text.home.imageLabel }}</label>
                    <input
                      id="setting-card-image"
                      ref="fileInput"
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/gif"
                      :aria-describedby="imageError ? 'setting-card-image-error' : 'setting-card-image-help'"
                      :aria-invalid="Boolean(imageError)"
                      class="sr-only"
                      @change="onFileChange"
                    />
                    <div
                      v-if="!activeImagePreviewUrl"
                      role="button"
                      tabindex="0"
                      :class="[
                        'mt-2 flex min-h-36 cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed px-6 py-8 text-center transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900 dark:focus-visible:outline-zinc-100',
                        imageError
                          ? 'border-red-500 bg-red-50/40 dark:border-red-400 dark:bg-red-950/20'
                          : draggingFile
                            ? 'border-zinc-900 bg-zinc-100 dark:border-zinc-100 dark:bg-zinc-800'
                            : 'border-zinc-300 bg-zinc-50 hover:border-zinc-500 hover:bg-zinc-100/70 dark:border-zinc-600 dark:bg-zinc-800/50 dark:hover:border-zinc-400 dark:hover:bg-zinc-800',
                      ]"
                      @click="fileInput?.click()"
                      @keydown.enter.prevent="fileInput?.click()"
                      @keydown.space.prevent="fileInput?.click()"
                      @dragenter="onDragEnter"
                      @dragover.prevent="onDragEnter"
                      @dragleave="onDragLeave"
                      @drop.prevent="onFileDrop"
                    >
                      <UploadCloud :size="26" class="text-zinc-500 dark:text-zinc-300" aria-hidden="true" />
                      <p class="mt-3 text-sm font-medium text-zinc-950 dark:text-zinc-50">
                        <span class="underline underline-offset-4">{{ text.home.chooseImage }}</span>
                        <span class="font-normal text-zinc-600 dark:text-zinc-300"> {{ text.home.dropImage }}</span>
                      </p>
                      <p id="setting-card-image-help" class="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                        {{ text.home.imageHelp }}
                      </p>
                    </div>
                    <div
                      v-else
                      class="mt-2 flex flex-wrap items-center gap-4 rounded-2xl border border-zinc-200 p-4 dark:border-zinc-700"
                    >
                      <img
                        :src="activeImagePreviewUrl"
                        :alt="text.home.imagePreview"
                        class="size-20 rounded-xl bg-zinc-100 object-cover dark:bg-zinc-800"
                      />
                      <div class="min-w-0 flex-1">
                        <p v-if="imageFile" class="truncate text-sm font-medium">{{ imageFile.name }}</p>
                        <button
                          type="button"
                          class="mt-1 text-sm text-zinc-600 underline hover:text-zinc-950 dark:text-zinc-300 dark:hover:text-zinc-50"
                          @click="clearImage"
                        >
                          {{ text.home.removeImage }}
                        </button>
                      </div>
                    </div>
                    <p
                      v-if="imageError"
                      id="setting-card-image-error"
                      role="alert"
                      class="mt-2 text-sm text-red-700 dark:text-red-400"
                    >
                      {{ imageError }}
                    </p>
                  </div>

                  <p v-if="cardError" role="alert" class="text-sm text-red-700 dark:text-red-400">{{ cardError }}</p>

                  <motion.button
                    type="submit"
                    :disabled="cardDialogPending"
                    :while-tap="prefersReducedMotion ? undefined : { scale: 0.98 }"
                    :transition="{ duration: 0.14 }"
                    class="inline-flex min-h-11 items-center justify-center rounded-xl bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300 dark:focus-visible:outline-zinc-100"
                  >
                    {{
                      cardDialogPending
                        ? text.home.savingCard
                        : editingCard
                          ? text.home.saveChanges
                          : text.home.submitCard
                    }}
                  </motion.button>
                </form>
              </motion.div>
            </DialogContent>
          </div>
        </DialogPortal>
      </DialogRoot>

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
                <AlertDialogTitle class="text-3xl">
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
                    class="min-h-11 rounded-full px-5 text-sm font-medium hover:bg-zinc-100 focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50 dark:hover:bg-zinc-800"
                  >
                    {{ text.setting.switchActiveCancel }}
                  </AlertDialogCancel>
                  <button
                    type="button"
                    :disabled="switchPending"
                    class="min-h-11 rounded-full bg-zinc-900 px-5 text-sm font-medium text-white hover:bg-zinc-700 focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
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
        <label for="board-filter" class="sr-only">{{ text.setting.filterBoards }}</label>
        <select
          id="board-filter"
          v-model="statusFilter"
          class="min-h-11 rounded-xl border border-zinc-300 bg-white px-3 text-sm text-zinc-950 outline-none focus:ring-2 focus:ring-zinc-900 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-50 dark:focus:ring-zinc-300"
        >
          <option value="all">{{ text.setting.filterAll }}</option>
          <option value="active">{{ text.setting.filterActive }}</option>
          <option value="inactive">{{ text.setting.filterInactive }}</option>
          <option value="completed">{{ text.setting.filterCompleted }}</option>
        </select>
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
          <h2 class="mt-6 font-sniglet text-3xl text-zinc-950 dark:text-zinc-50">
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
                  <h2 class="text-xl text-zinc-950 dark:text-zinc-50">
                    {{ board.title }}
                  </h2>
                  <span class="rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
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
                <button
                  type="button"
                  class="inline-flex min-h-9 items-center gap-1.5 rounded-full bg-zinc-900 px-3.5 py-1.5 text-xs font-medium text-white transition-colors hover:bg-zinc-700 focus-visible:outline-2 focus-visible:outline-offset-2 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
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
                      'inline-flex min-h-9 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50',
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
                  <label class="inline-flex cursor-pointer select-none items-center gap-2.5 text-xs font-medium text-zinc-600 dark:text-zinc-300">
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
                      <h3 class="truncate text-sm font-medium">{{ card.title }}</h3>
                      <span class="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
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
                    <span class="rounded-full bg-zinc-100 px-2.5 py-0.5 text-[11px] font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
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
