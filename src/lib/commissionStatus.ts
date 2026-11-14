import { supabase } from './supabase'

export const COMMISSION_TYPES = ['Emote', 'GIF', 'Animation', 'Illustration', 'Transition'] as const
export type CommissionType = (typeof COMMISSION_TYPES)[number]

export const COMMISSION_STATUSES = ['open', 'waitlist', 'closed'] as const
export type CommissionStatusValue = (typeof COMMISSION_STATUSES)[number]

export interface CommissionStatus {
  status: CommissionStatusValue
  slotsOpen: number
  slotsTotal: number
}

export interface OfferSlotSummaryInput {
  isOpen: boolean
  boardStatus?: 'active' | 'waitlist' | 'inactive'
  maxRequests: number | null
  requestCount: number
}

interface CommissionStatusRow {
  status: CommissionStatusValue
}

interface OfferQuotaRow {
  board_id: string
  max_requests: number | null
  request_count: number | null
}

interface VisibleBoardRow {
  id: string
  status: 'active' | 'waitlist'
}

export const DEFAULT_COMMISSION_STATUS: CommissionStatus = {
  status: 'open',
  slotsOpen: 0,
  slotsTotal: 0,
}

export const COMMISSION_STATUS_STYLES: Record<CommissionStatusValue, { badge: string; dot: string }> = {
  open: {
    badge: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-200',
    dot: 'bg-emerald-500',
  },
  waitlist: {
    badge: 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-200',
    dot: 'bg-amber-500',
  },
  closed: {
    badge: 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-200',
    dot: 'bg-rose-500',
  },
}

/** Sum open and total limited slots from open offers, ignoring unlimited offers. */
export function summarizeOfferSlots(
  offers: readonly OfferSlotSummaryInput[],
): Pick<CommissionStatus, 'slotsOpen' | 'slotsTotal'> {
  let slotsOpen = 0
  let slotsTotal = 0
  for (const offer of offers) {
    if (
      !offer.isOpen ||
      offer.boardStatus === 'inactive' ||
      offer.maxRequests === null ||
      offer.maxRequests <= 0
    ) {
      continue
    }
    slotsOpen += Math.max(offer.maxRequests - Math.max(0, offer.requestCount), 0)
    slotsTotal += offer.maxRequests
  }
  return { slotsOpen, slotsTotal }
}

export async function fetchCommissionStatus(): Promise<CommissionStatus | null> {
  if (!supabase) return { ...DEFAULT_COMMISSION_STATUS }
  const [statusResult, boardsResult, offersResult] = await Promise.all([
    supabase.from('commission_status').select('status').eq('id', 'default').maybeSingle(),
    supabase.from('commission_offer_boards').select('id,status').in('status', ['active', 'waitlist']),
    supabase
      .from('commission_offers')
      .select('board_id,max_requests,request_count')
      .eq('is_open', true)
      .not('max_requests', 'is', null),
  ])

  if (!statusResult.data) return null
  const row = statusResult.data as CommissionStatusRow
  const visibleBoardStatusById = new Map(
    ((boardsResult.data ?? []) as VisibleBoardRow[]).map((board) => [board.id, board.status]),
  )
  const offers = ((offersResult.data ?? []) as OfferQuotaRow[])
    .filter((offer) => visibleBoardStatusById.has(offer.board_id))
    .map((offer) => ({
      isOpen: true,
      boardStatus: visibleBoardStatusById.get(offer.board_id),
      maxRequests: offer.max_requests,
      requestCount: Number(offer.request_count) || 0,
    }))
  return {
    status: row.status,
    ...summarizeOfferSlots(offers),
  }
}

export function canAccessRequests(signedIn: boolean, status: CommissionStatus | null): boolean {
  return signedIn || (status !== null && status.status !== 'closed')
}
