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

interface CommissionStatusRow {
  status: CommissionStatusValue
  slots_open: number
  slots_total: number
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

export async function fetchCommissionStatus(): Promise<CommissionStatus | null> {
  if (!supabase) return { status: 'open', slotsOpen: 3, slotsTotal: 5 }
  const { data } = await supabase
    .from('commission_status')
    .select('status,slots_open,slots_total')
    .eq('id', 'default')
    .maybeSingle()

  if (!data) return null
  const row = data as CommissionStatusRow
  return {
    status: row.status,
    slotsOpen: row.slots_open,
    slotsTotal: row.slots_total,
  }
}
