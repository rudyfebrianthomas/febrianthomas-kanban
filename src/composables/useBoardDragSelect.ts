import { ref, type ComputedRef, type Ref } from 'vue'

interface IdentifiableBoard {
  id: string
}

interface UseBoardDragSelectOptions<TBoard extends IdentifiableBoard, TItem extends { id: string }> {
  boards: Ref<TBoard[]>
  itemsForBoard: (boardId: string) => TItem[]
  onMove: (ids: string[], targetBoard: TBoard) => Promise<void>
}

function parseDraggedIds(raw: string | undefined): string[] {
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

/**
 * Reusable multi-select and HTML5 board drag-and-drop state for board item managers.
 */
export function useBoardDragSelect<TBoard extends IdentifiableBoard, TItem extends { id: string }>(
  options: UseBoardDragSelectOptions<TBoard, TItem>,
) {
  const selectedIds = ref<string[]>([])
  const bulkTargetBoardId = ref('')
  const bulkMoving = ref(false)
  const draggingIds = ref<string[]>([])
  const dragOverBoardId = ref('')

  function isSelected(id: string): boolean {
    return selectedIds.value.includes(id)
  }

  function toggleSelected(id: string) {
    if (isSelected(id)) {
      selectedIds.value = selectedIds.value.filter((item) => item !== id)
    } else {
      selectedIds.value = [...selectedIds.value, id]
    }
  }

  function clearRemovedSelection(removedIds: Set<string>) {
    selectedIds.value = selectedIds.value.filter((id) => !removedIds.has(id))
  }

  function isAllInBoardSelected(boardId: string): boolean {
    const boardItems = options.itemsForBoard(boardId)
    return boardItems.length > 0 && boardItems.every((item) => isSelected(item.id))
  }

  function isSomeInBoardSelected(boardId: string): boolean {
    const boardItems = options.itemsForBoard(boardId)
    if (boardItems.length === 0) return false
    const count = boardItems.filter((item) => isSelected(item.id)).length
    return count > 0 && count < boardItems.length
  }

  function toggleAllInBoard(boardId: string) {
    const boardItemIds = options.itemsForBoard(boardId).map((item) => item.id)
    if (boardItemIds.length === 0) return
    if (isAllInBoardSelected(boardId)) {
      clearRemovedSelection(new Set(boardItemIds))
    } else {
      const next = new Set(selectedIds.value)
      for (const id of boardItemIds) next.add(id)
      selectedIds.value = [...next]
    }
  }

  function onItemDragStart(id: string, event: DragEvent) {
    const ids = isSelected(id) ? [...selectedIds.value] : [id]
    draggingIds.value = ids
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move'
      event.dataTransfer.setData('text/plain', JSON.stringify(ids))
    }
  }

  function onItemDragEnd() {
    draggingIds.value = []
    dragOverBoardId.value = ''
  }

  function onBoardDragOver(boardId: string, event: DragEvent) {
    if (draggingIds.value.length === 0) return
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'move'
    dragOverBoardId.value = boardId
  }

  function onBoardDragLeave(boardId: string, event: DragEvent) {
    if (dragOverBoardId.value !== boardId) return
    const currentTarget = event.currentTarget as HTMLElement | null
    const related = event.relatedTarget as Node | null
    if (!related || !currentTarget?.contains(related)) dragOverBoardId.value = ''
  }

  async function onBoardDrop(targetBoard: TBoard, event: DragEvent) {
    const ids =
      draggingIds.value.length > 0
        ? [...draggingIds.value]
        : parseDraggedIds(event.dataTransfer?.getData('text/plain'))
    onItemDragEnd()
    await options.onMove(ids, targetBoard)
  }

  async function moveSelected() {
    if (bulkMoving.value || selectedIds.value.length === 0) return
    const targetBoard =
      options.boards.value.find((board) => board.id === bulkTargetBoardId.value) ??
      options.boards.value[0]
    if (!targetBoard) return
    bulkMoving.value = true
    try {
      await options.onMove([...selectedIds.value], targetBoard)
    } finally {
      bulkMoving.value = false
    }
  }

  function syncBulkTargetBoard(boardMoveOptions: ComputedRef<Array<{ value: string }>>) {
    if (
      bulkTargetBoardId.value &&
      boardMoveOptions.value.some((option) => option.value === bulkTargetBoardId.value)
    ) {
      return
    }
    bulkTargetBoardId.value = boardMoveOptions.value[0]?.value ?? ''
  }

  return {
    selectedIds,
    bulkTargetBoardId,
    bulkMoving,
    draggingIds,
    dragOverBoardId,
    isSelected,
    toggleSelected,
    clearRemovedSelection,
    isAllInBoardSelected,
    isSomeInBoardSelected,
    toggleAllInBoard,
    onItemDragStart,
    onItemDragEnd,
    onBoardDragOver,
    onBoardDragLeave,
    onBoardDrop,
    moveSelected,
    syncBulkTargetBoard,
  }
}
