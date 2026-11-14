import { type Language } from '../composables/useLanguage'
import { type CommissionStatus, type CommissionType, summarizeOfferSlots } from './commissionStatus'
import { kanbanImageUrl } from './kanbanCard'
import { supabase } from './supabase'

export const OFFER_BOARD_STATUSES = ['active', 'waitlist', 'inactive'] as const
export type OfferBoardStatus = (typeof OFFER_BOARD_STATUSES)[number]
export const MAX_ACTIVE_OFFER_BOARDS = 1
export const MAX_WAITLIST_OFFER_BOARDS = 1

export const OFFER_BOARD_STATUS_DOTS: Record<OfferBoardStatus, string> = {
  active: 'bg-emerald-500',
  waitlist: 'bg-amber-500',
  inactive: 'bg-zinc-400',
}

export const OFFER_BOARD_STATUS_BADGES: Record<OfferBoardStatus, string> = {
  active: 'bg-orange-500/15 text-orange-700 dark:bg-orange-400/15 dark:text-orange-300',
  waitlist: 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-200',
  inactive: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300',
}

export interface CommissionOfferBoard {
  id: string
  title: string
  description: string | null
  status: OfferBoardStatus
  sortOrder: number
}

export interface CommissionOfferBoardRow {
  id: string
  title: string
  description: string | null
  status: OfferBoardStatus
  sort_order: number
}

export interface CommissionOffer {
  id: string
  boardId: string
  commissionType: CommissionType
  title: string
  description: string
  priceUsd: number
  priceIdr: number
  imagePath: string | null
  imageUrl?: string
  isOpen: boolean
  sortOrder: number
  maxRequests: number | null
  requestCount: number
}

export interface CommissionOfferRow {
  id: string
  board_id: string
  commission_type: CommissionType
  title: string
  description: string
  price_usd: number | string | null
  price_idr: number | string | null
  image_path: string | null
  is_open: boolean
  sort_order: number
  max_requests: number | null
  request_count: number | null
}

const DEFAULT_OFFER_BOARD_ID = '00000000-0000-0000-0000-000000000301'

export const DEFAULT_COMMISSION_OFFER_BOARDS: CommissionOfferBoard[] = [
  {
    id: DEFAULT_OFFER_BOARD_ID,
    title: 'Open Commission List',
    description: null,
    status: 'active',
    sortOrder: 1,
  },
]

export const DEFAULT_COMMISSION_OFFERS: CommissionOffer[] = [
  {
    id: '00000000-0000-0000-0000-000000000101',
    boardId: DEFAULT_OFFER_BOARD_ID,
    commissionType: 'Emote',
    title: 'Custom Emote',
    description: 'Expressive static emote for Twitch, Discord, or YouTube.',
    priceUsd: 20,
    priceIdr: 320000,
    imagePath: null,
    isOpen: true,
    sortOrder: 1,
    maxRequests: null,
    requestCount: 0,
  },
  {
    id: '00000000-0000-0000-0000-000000000102',
    boardId: DEFAULT_OFFER_BOARD_ID,
    commissionType: 'GIF',
    title: 'Animated GIF / Emote',
    description: 'Looping animated emote or reaction GIF with smooth motion.',
    priceUsd: 35,
    priceIdr: 560000,
    imagePath: null,
    isOpen: true,
    sortOrder: 2,
    maxRequests: null,
    requestCount: 0,
  },
  {
    id: '00000000-0000-0000-0000-000000000103',
    boardId: DEFAULT_OFFER_BOARD_ID,
    commissionType: 'Illustration',
    title: 'Character Illustration',
    description: 'Clean lined and rendered illustration of your character.',
    priceUsd: 60,
    priceIdr: 960000,
    imagePath: null,
    isOpen: true,
    sortOrder: 3,
    maxRequests: null,
    requestCount: 0,
  },
  {
    id: '00000000-0000-0000-0000-000000000104',
    boardId: DEFAULT_OFFER_BOARD_ID,
    commissionType: 'Animation',
    title: '2D Character Animation',
    description: 'Short 2D loop or character animation with shading.',
    priceUsd: 90,
    priceIdr: 1440000,
    imagePath: null,
    isOpen: true,
    sortOrder: 4,
    maxRequests: null,
    requestCount: 0,
  },
  {
    id: '00000000-0000-0000-0000-000000000105',
    boardId: DEFAULT_OFFER_BOARD_ID,
    commissionType: 'Transition',
    title: 'Stream Stinger Transition',
    description: 'Custom animated transition tailored to your stream branding.',
    priceUsd: 80,
    priceIdr: 1280000,
    imagePath: null,
    isOpen: true,
    sortOrder: 5,
    maxRequests: null,
    requestCount: 0,
  },
]

export function isOfferBoardVisible(status: OfferBoardStatus): boolean {
  return status === 'active' || status === 'waitlist'
}

export function findOfferBoardByStatus(
  boards: readonly CommissionOfferBoard[],
  status: OfferBoardStatus,
  excludeBoardId?: string,
): CommissionOfferBoard | undefined {
  return boards.find((board) => board.status === status && board.id !== excludeBoardId)
}

export function offerBoardStatusCount(
  boards: readonly Pick<CommissionOfferBoard, 'id' | 'status'>[],
  status: OfferBoardStatus,
  excludeBoardId?: string,
): number {
  return boards.filter((board) => board.status === status && board.id !== excludeBoardId).length
}

export function canSetOfferBoardStatus(
  boards: readonly Pick<CommissionOfferBoard, 'id' | 'status'>[],
  status: OfferBoardStatus,
  targetBoardId?: string,
): boolean {
  if (status === 'active') {
    return offerBoardStatusCount(boards, 'active', targetBoardId) < MAX_ACTIVE_OFFER_BOARDS
  }
  if (status === 'waitlist') {
    return offerBoardStatusCount(boards, 'waitlist', targetBoardId) < MAX_WAITLIST_OFFER_BOARDS
  }
  return true
}

export function summarizeOffersWithBoards(
  offers: readonly CommissionOffer[],
  boards: readonly CommissionOfferBoard[],
): Pick<CommissionStatus, 'slotsOpen' | 'slotsTotal'> {
  const statusByBoardId = new Map(boards.map((board) => [board.id, board.status]))
  return summarizeOfferSlots(
    offers.map((offer) => ({
      isOpen: offer.isOpen,
      boardStatus: statusByBoardId.get(offer.boardId) ?? 'inactive',
      maxRequests: offer.maxRequests,
      requestCount: offer.requestCount,
    })),
  )
}

export function toCommissionOfferBoard(row: CommissionOfferBoardRow): CommissionOfferBoard {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    status: row.status,
    sortOrder: row.sort_order,
  }
}

export async function fetchCommissionOfferBoards(
  includeInactive = false,
): Promise<CommissionOfferBoard[]> {
  if (!supabase) {
    return includeInactive
      ? DEFAULT_COMMISSION_OFFER_BOARDS
      : DEFAULT_COMMISSION_OFFER_BOARDS.filter((board) => isOfferBoardVisible(board.status))
  }

  let query = supabase
    .from('commission_offer_boards')
    .select('id,title,description,status,sort_order')
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })

  if (!includeInactive) query = query.in('status', ['active', 'waitlist'])

  const { data, error } = await query
  if (error || !data) return []
  return (data as CommissionOfferBoardRow[]).map(toCommissionOfferBoard)
}

export function isOfferLimitReached(
  offer: Pick<CommissionOffer, 'maxRequests' | 'requestCount'>,
): boolean {
  return offer.maxRequests !== null && offer.requestCount >= offer.maxRequests
}

export function formatOfferPrices(
  offer: Pick<CommissionOffer, 'priceUsd' | 'priceIdr'>,
  language: Language,
): string {
  const usd = Number.isFinite(offer.priceUsd) ? offer.priceUsd : 0
  const idr = Number.isFinite(offer.priceIdr) ? offer.priceIdr : 0
  const usdText =
    usd > 0
      ? `$${new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(usd)}`
      : ''
  const idrText =
    idr > 0
      ? `Rp ${new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(idr)}`
      : ''

  const ordered = language === 'id' ? [idrText, usdText] : [usdText, idrText]
  const visible = ordered.filter(Boolean)
  return visible.length > 0 ? visible.join(' · ') : '$0'
}

export function toCommissionOffer(row: CommissionOfferRow): CommissionOffer {
  return {
    id: row.id,
    boardId: row.board_id,
    commissionType: row.commission_type,
    title: row.title,
    description: row.description,
    priceUsd: Number(row.price_usd) || 0,
    priceIdr: Number(row.price_idr) || 0,
    imagePath: row.image_path,
    imageUrl: kanbanImageUrl(row.image_path),
    isOpen: row.is_open,
    sortOrder: row.sort_order,
    maxRequests: row.max_requests ?? null,
    requestCount: Math.max(0, Number(row.request_count) || 0),
  }
}

export async function fetchCommissionOffers(includeClosed = false): Promise<CommissionOffer[]> {
  if (!supabase) {
    return includeClosed
      ? DEFAULT_COMMISSION_OFFERS
      : DEFAULT_COMMISSION_OFFERS.filter((offer) => offer.isOpen)
  }

  let query = supabase
    .from('commission_offers')
    .select(
      'id,board_id,commission_type,title,description,price_usd,price_idr,image_path,is_open,sort_order,max_requests,request_count',
    )
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })

  if (!includeClosed) query = query.eq('is_open', true)

  const { data, error } = await query
  if (error || !data) return []
  return (data as CommissionOfferRow[]).map(toCommissionOffer)
}
