import { type CommissionType } from './commissionStatus'
import { supabase } from './supabase'

export interface KanbanCard {
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

export interface KanbanCardRow {
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

export function kanbanImageUrl(path: string | null): string | undefined {
  if (!path || !supabase) return undefined
  return supabase.storage.from('kanban-images').getPublicUrl(path).data.publicUrl
}

export function toKanbanCard(row: KanbanCardRow): KanbanCard {
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

export function parseRequestorTags(raw: string): string[] {
  return [...new Set(raw.split(',').map((item) => item.trim()).filter(Boolean))]
}

export function latestTimestamp(updatedAt?: string | null, createdAt?: string): number {
  return Date.parse(updatedAt ?? createdAt ?? '') || 0
}

export async function deleteKanbanCard(card: KanbanCard): Promise<void> {
  if (supabase) {
    const { error } = await supabase.from('kanban_cards').delete().eq('id', card.id)
    if (error) throw error
    if (card.imagePath) {
      await supabase.storage.from('kanban-images').remove([card.imagePath]).catch(() => {})
    }
    return
  }
  if (card.imageUrl?.startsWith('blob:')) {
    URL.revokeObjectURL(card.imageUrl)
  }
}
