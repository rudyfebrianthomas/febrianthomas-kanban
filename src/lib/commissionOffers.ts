import { type Language } from '../composables/useLanguage'
import { type CommissionType } from './commissionStatus'
import { kanbanImageUrl } from './kanbanCard'
import { supabase } from './supabase'

export interface CommissionOffer {
  id: string
  commissionType: CommissionType
  title: string
  description: string
  priceUsd: number
  priceIdr: number
  imagePath: string | null
  imageUrl?: string
  isOpen: boolean
  sortOrder: number
}

export interface CommissionOfferRow {
  id: string
  commission_type: CommissionType
  title: string
  description: string
  price_usd: number | string | null
  price_idr: number | string | null
  image_path: string | null
  is_open: boolean
  sort_order: number
}

export const DEFAULT_COMMISSION_OFFERS: CommissionOffer[] = [
  {
    id: '00000000-0000-0000-0000-000000000101',
    commissionType: 'Emote',
    title: 'Custom Emote',
    description: 'Expressive static emote for Twitch, Discord, or YouTube.',
    priceUsd: 20,
    priceIdr: 320000,
    imagePath: null,
    isOpen: true,
    sortOrder: 1,
  },
  {
    id: '00000000-0000-0000-0000-000000000102',
    commissionType: 'GIF',
    title: 'Animated GIF / Emote',
    description: 'Looping animated emote or reaction GIF with smooth motion.',
    priceUsd: 35,
    priceIdr: 560000,
    imagePath: null,
    isOpen: true,
    sortOrder: 2,
  },
  {
    id: '00000000-0000-0000-0000-000000000103',
    commissionType: 'Illustration',
    title: 'Character Illustration',
    description: 'Clean lined and rendered illustration of your character.',
    priceUsd: 60,
    priceIdr: 960000,
    imagePath: null,
    isOpen: true,
    sortOrder: 3,
  },
  {
    id: '00000000-0000-0000-0000-000000000104',
    commissionType: 'Animation',
    title: '2D Character Animation',
    description: 'Short 2D loop or character animation with shading.',
    priceUsd: 90,
    priceIdr: 1440000,
    imagePath: null,
    isOpen: true,
    sortOrder: 4,
  },
  {
    id: '00000000-0000-0000-0000-000000000105',
    commissionType: 'Transition',
    title: 'Stream Stinger Transition',
    description: 'Custom animated transition tailored to your stream branding.',
    priceUsd: 80,
    priceIdr: 1280000,
    imagePath: null,
    isOpen: true,
    sortOrder: 5,
  },
]

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
    commissionType: row.commission_type,
    title: row.title,
    description: row.description,
    priceUsd: Number(row.price_usd) || 0,
    priceIdr: Number(row.price_idr) || 0,
    imagePath: row.image_path,
    imageUrl: kanbanImageUrl(row.image_path),
    isOpen: row.is_open,
    sortOrder: row.sort_order,
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
    .select('id,commission_type,title,description,price_usd,price_idr,image_path,is_open,sort_order')
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })

  if (!includeClosed) query = query.eq('is_open', true)

  const { data, error } = await query
  if (error || !data) return []
  return (data as CommissionOfferRow[]).map(toCommissionOffer)
}
