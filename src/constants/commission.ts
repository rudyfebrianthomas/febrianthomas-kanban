import { type OfferBoardStatus } from '../lib/commissionOffers'

export const CONTACT_CHANNELS = ['email', 'discord', 'twitter', 'instagram'] as const
export type ContactChannel = (typeof CONTACT_CHANNELS)[number]

export const CONTACT_CHANNEL_LABELS: Record<ContactChannel, string> = {
  email: 'Email',
  discord: 'Discord',
  twitter: 'Twitter',
  instagram: 'Instagram',
}

export const BACKLOG_BOARD_ID = '00000000-0000-0000-0000-000000000000'
export const DEFAULT_BOARD_ID = '00000000-0000-0000-0000-000000000001'

export const OFFER_BOARD_ORDER: Record<OfferBoardStatus, number> = {
  active: 0,
  waitlist: 1,
  inactive: 2,
}

export const CARD_SELECT_COLUMNS =
  'id,board_id,stage_number,commission_type,title,description,requestors,image_path,created_at,updated_at'

export const OFFER_SELECT_COLUMNS =
  'id,board_id,commission_type,title,description,price_usd,price_idr,image_path,is_open,sort_order,max_requests,request_count'
