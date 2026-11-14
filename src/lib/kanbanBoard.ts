import { type KanbanCard } from './kanbanCard'

export interface KanbanBoard {
  id: string
  title: string
  description: string | null
  is_active: boolean
  is_backlog: boolean
  created_at?: string
  updated_at?: string | null
}

export function isBoardCompleted(board: KanbanBoard, cards: readonly KanbanCard[]): boolean {
  if (board.is_backlog) return false
  const boardCards = cards.filter((card) => card.boardId === board.id)
  return boardCards.length > 0 && boardCards.every((card) => card.stageNumber === '06')
}
