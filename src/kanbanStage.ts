export interface StageStyle {
  cardBorder: string
  progressBar: string
  dot: string
}

const DEFAULT_STAGE_STYLE: StageStyle = {
  cardBorder: 'border-zinc-300 dark:border-zinc-600',
  progressBar: 'bg-zinc-400 dark:bg-zinc-500',
  dot: 'bg-zinc-400 dark:bg-zinc-500',
}

const STAGE_STYLES: Record<string, StageStyle> = {
  '01': DEFAULT_STAGE_STYLE,
  '02': {
    cardBorder: 'border-sky-400 dark:border-sky-500',
    progressBar: 'bg-sky-500 dark:bg-sky-400',
    dot: 'bg-sky-500 dark:bg-sky-400',
  },
  '03': {
    cardBorder: 'border-amber-400 dark:border-amber-500',
    progressBar: 'bg-amber-500 dark:bg-amber-400',
    dot: 'bg-amber-500 dark:bg-amber-400',
  },
  '04': {
    cardBorder: 'border-orange-400 dark:border-orange-500',
    progressBar: 'bg-orange-500 dark:bg-orange-400',
    dot: 'bg-orange-500 dark:bg-orange-400',
  },
  '05': {
    cardBorder: 'border-rose-400 dark:border-rose-500',
    progressBar: 'bg-rose-500 dark:bg-rose-400',
    dot: 'bg-rose-500 dark:bg-rose-400',
  },
  '06': {
    cardBorder: 'border-emerald-500 dark:border-emerald-500',
    progressBar: 'bg-emerald-500 dark:bg-emerald-400',
    dot: 'bg-emerald-500 dark:bg-emerald-400',
  },
}

export function stageStyle(stageNumber: string): StageStyle {
  return STAGE_STYLES[stageNumber] ?? DEFAULT_STAGE_STYLE
}

export function stageProgress(stageNumber: string, stages: ReadonlyArray<{ number: string }>): number {
  const index = stages.findIndex((stage) => stage.number === stageNumber)
  if (index <= 0) return 0
  return Math.round((index / Math.max(stages.length - 1, 1)) * 100)
}
