<script setup lang="ts">
import { ArrowRight, FileText } from '@lucide/vue'
import { motion, useReducedMotion } from 'motion-v'
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { type CommissionStatus, type CommissionType, fetchCommissionStatus } from '../commissionStatus'
import CommissionStatusBadge from '../components/CommissionStatusBadge.vue'
import { useLanguage } from '../composables/useLanguage'
import { kanbanImageUrl, latestTimestamp } from '../kanbanCard'
import { stageLabel, stageProgress, stageStyle } from '../kanbanStage'
import { supabase } from '../supabase'

interface ActiveBoardSummary {
  id: string
  title: string
  description: string | null
}

interface PreviewCardRow {
  id: string
  stage_number: string
  commission_type: CommissionType
  title: string
  description: string
  requestors: string[]
  image_path: string | null
  created_at?: string
  updated_at?: string | null
}

interface PreviewCard {
  id: string
  stageNumber: string
  commissionType: CommissionType
  title: string
  description: string
  requestors: string[]
  imageUrl?: string
  sortTime: number
}

const { text } = useLanguage()
const reducedMotion = useReducedMotion()
const greeting = ref(false)
let timer: ReturnType<typeof setTimeout> | null = null
let active = true

const previewLoading = ref(!!supabase)
const commissionStatus = ref<CommissionStatus | null>(supabase ? null : { status: 'open', slotsOpen: 3, slotsTotal: 5 })
const activeBoard = ref<ActiveBoardSummary | null>(null)
const boardCards = ref<PreviewCard[]>([])

const recentCards = computed(() =>
  [...boardCards.value].sort((a, b) => b.sortTime - a.sortTime).slice(0, 3),
)

const stageCounts = computed(() => {
  const counts: Record<string, number> = {}
  for (const card of boardCards.value) {
    counts[card.stageNumber] = (counts[card.stageNumber] ?? 0) + 1
  }
  return counts
})

function sayHi() {
  if (timer) clearTimeout(timer)
  greeting.value = true
  timer = setTimeout(() => {
    greeting.value = false
  }, 2000)
}

function getStageLabel(stageNumber: string): string {
  return stageLabel(stageNumber, text.value.home.stages)
}

onMounted(async () => {
  if (!supabase) return
  try {
    const [statusData, { data: boardData }] = await Promise.all([
      fetchCommissionStatus(),
      supabase
        .from('kanban_boards')
        .select('id,title,description')
        .eq('is_active', true)
        .maybeSingle(),
    ])
    if (!active) return

    commissionStatus.value = statusData
    activeBoard.value = (boardData as ActiveBoardSummary | null) ?? null
    if (!activeBoard.value) return

    const { data: cardsData } = await supabase
      .from('kanban_cards')
      .select('id,stage_number,commission_type,title,description,requestors,image_path,created_at,updated_at')
      .eq('board_id', activeBoard.value.id)
    if (!active || !cardsData) return

    boardCards.value = (cardsData as PreviewCardRow[]).map((row) => ({
      id: row.id,
      stageNumber: row.stage_number,
      commissionType: row.commission_type,
      title: row.title,
      description: row.description,
      requestors: row.requestors,
      imageUrl: kanbanImageUrl(row.image_path),
      sortTime: latestTimestamp(row.updated_at, row.created_at),
    }))
  } finally {
    if (active) previewLoading.value = false
  }
})

onUnmounted(() => {
  active = false
  if (timer) clearTimeout(timer)
})
</script>

<template>
  <main class="flex flex-1 flex-col px-6 sm:px-10">
    <section
      class="mx-auto flex min-h-[calc(100svh-124px)] w-full max-w-6xl flex-col justify-center py-12 sm:min-h-[calc(100svh-76px)] sm:py-16"
      aria-labelledby="page-title"
    >
      <div class="grid w-full items-center gap-10 md:grid-cols-[minmax(0,1fr)_auto] md:gap-12">
        <div class="max-w-3xl">
          <div class="mb-4 flex flex-wrap items-center gap-3">
            <p class="text-xs uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
              {{ text.home.eyebrow }}
            </p>
            <CommissionStatusBadge v-if="commissionStatus" :value="commissionStatus" />
          </div>
          <h1
            id="page-title"
            class="font-bagel-fat-one text-5xl leading-[1.05] tracking-tight text-zinc-950 sm:text-7xl dark:text-zinc-50"
          >
            {{ text.home.titleLine1 }}<br />{{ text.home.titleLine2 }}
          </h1>
          <p class="mt-6 text-base leading-7 text-zinc-600 sm:text-lg dark:text-zinc-300">
            {{ text.home.intro }}
          </p>
          <div class="mt-8 flex flex-wrap items-center gap-3">
            <RouterLink
              to="/commission"
              class="inline-flex min-h-11 items-center gap-2 rounded-xl bg-zinc-900 px-5 py-2.5 text-sm text-white transition-colors hover:bg-zinc-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300 dark:focus-visible:outline-zinc-100"
            >
              <span>{{ text.home.viewBoardCta }}</span>
              <ArrowRight :size="16" aria-hidden="true" />
            </RouterLink>
            <RouterLink
              to="/about"
              class="inline-flex min-h-11 items-center rounded-xl border border-zinc-300 px-5 py-2.5 text-sm text-zinc-700 transition-colors hover:bg-zinc-100 hover:text-zinc-950 focus-visible:outline-2 focus-visible:outline-offset-2 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-zinc-50"
            >
              {{ text.home.aboutCta }}
            </RouterLink>
          </div>
        </div>

        <div class="relative mx-auto w-full max-w-64 sm:max-w-96 md:mx-0 md:justify-self-end">
          <motion.button
            type="button"
            :aria-label="text.home.greetingButton"
            :while-hover="reducedMotion ? undefined : { scale: 1.05 }"
            :transition="{ type: 'spring', duration: 0.3, bounce: 0.2 }"
            class="block w-full cursor-pointer rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4"
            @click="sayHi"
          >
            <img v-show="!greeting" src="/images/hero-1.png" alt="" class="h-auto w-full" />
            <img v-show="greeting" src="/images/hero-2.png" alt="" class="h-auto w-full" />
          </motion.button>
          <span role="status" class="pointer-events-none absolute left-3 top-32">
            <motion.span
              v-if="greeting"
              :initial="reducedMotion ? false : { opacity: 0, scale: 0.9, y: 5 }"
              :animate="{ opacity: 1, scale: 1, y: 0 }"
              :transition="{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }"
              class="relative block origin-bottom-right rounded-2xl border-2 border-zinc-900 bg-white px-8 py-4 text-2xl text-zinc-900 shadow-sm after:absolute after:-right-2 after:bottom-3 after:size-3 after:rotate-45 after:border-t-2 after:border-r-2 after:border-zinc-900 after:bg-white dark:border-zinc-100 dark:bg-zinc-800 dark:text-zinc-50 dark:after:border-zinc-100 dark:after:bg-zinc-800"
            >
              {{ text.home.greeting }}
            </motion.span>
          </span>
        </div>
      </div>
    </section>

    <section class="mx-auto w-full max-w-6xl py-16 sm:py-24" aria-labelledby="pipeline-title">
      <h2 id="pipeline-title" class="font-bagel-fat-one text-4xl sm:text-5xl">
        {{ text.home.pipelineTitle }}
      </h2>
      <p class="mt-4 max-w-2xl text-base leading-7 text-zinc-600 sm:text-lg dark:text-zinc-300">
        {{ text.home.pipelineDescription }}
      </p>

      <ol class="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
        <li
          v-for="stage in text.home.stages"
          :key="stage.number"
          :class="[
            'rounded-2xl border-2 bg-white p-4 shadow-xs dark:bg-zinc-900',
            stageStyle(stage.number).cardBorder,
          ]"
        >
          <div class="flex items-center justify-between gap-2 text-xs text-zinc-500 dark:text-zinc-400">
            <span class="inline-flex items-center gap-2">
              <span :class="['size-2.5 rounded-full', stageStyle(stage.number).dot]" aria-hidden="true" />
              {{ stage.number }}
            </span>
            <span>{{ stageProgress(stage.number, text.home.stages) }}%</span>
          </div>
          <p class="mt-2.5 text-base text-zinc-950 dark:text-zinc-50">{{ stage.label }}</p>
        </li>
      </ol>

      <div class="mt-8 flex flex-wrap items-center gap-2.5">
        <span class="mr-1 text-sm text-zinc-500 dark:text-zinc-400">{{ text.home.typesLabel }}:</span>
        <span
          v-for="label in Object.values(text.home.commissionTypes)"
          :key="label"
          class="rounded-full bg-zinc-100 px-3.5 py-1.5 text-sm text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200"
        >
          {{ label }}
        </span>
      </div>
    </section>

    <section class="mx-auto w-full max-w-6xl py-16 sm:py-24" aria-labelledby="preview-title">
      <RouterLink
        to="/commission"
        class="group inline-flex items-center gap-4 rounded-xl focus-visible:outline-2 focus-visible:outline-offset-4"
      >
        <h2 id="preview-title" class="font-bagel-fat-one text-4xl sm:text-5xl">
          {{ text.home.commissionTitle }}
        </h2>
        <ArrowRight aria-hidden="true" class="transition-transform group-hover:translate-x-1" />
      </RouterLink>
      <p class="mt-4 max-w-2xl text-base leading-7 text-zinc-600 sm:text-lg dark:text-zinc-300">
        {{ text.home.commissionDescription }}
      </p>

      <div
        v-if="previewLoading"
        class="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3"
        aria-hidden="true"
      >
        <div
          v-for="n in 3"
          :key="n"
          class="h-52 animate-pulse rounded-2xl border border-zinc-200 bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900"
        />
      </div>

      <div
        v-else-if="activeBoard"
        class="surface-shadow mt-8 rounded-2xl border border-zinc-200 bg-white p-5 sm:p-6 dark:border-zinc-800 dark:bg-zinc-900"
      >
        <div class="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h3 class="text-2xl font-bold text-zinc-950 sm:text-3xl dark:text-zinc-50">
              {{ activeBoard.title }}
            </h3>
            <p
              v-if="activeBoard.description"
              class="mt-1 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400"
            >
              {{ activeBoard.description }}
            </p>
          </div>
          <RouterLink
            to="/commission"
            class="inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-zinc-100 px-3.5 py-2 text-xs text-zinc-800 transition-colors hover:bg-zinc-200 focus-visible:outline-2 focus-visible:outline-offset-2 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
          >
            <span>{{ text.home.previewViewAll }}</span>
            <ArrowRight :size="14" aria-hidden="true" />
          </RouterLink>
        </div>

        <div class="mt-4 flex flex-wrap gap-2">
          <span
            v-for="stage in text.home.stages"
            :key="stage.number"
            class="inline-flex items-center gap-1.5 rounded-full bg-zinc-100 px-3 py-1 text-xs text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
          >
            <span :class="['size-2 rounded-full', stageStyle(stage.number).dot]" aria-hidden="true" />
            <span>{{ stage.label }}: {{ stageCounts[stage.number] ?? 0 }}</span>
          </span>
        </div>

        <div v-if="recentCards.length" class="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <RouterLink
            v-for="card in recentCards"
            :key="card.id"
            :to="{ path: '/commission', query: { card: card.id } }"
            :class="[
              'flex flex-col rounded-2xl border-2 bg-white p-4 text-zinc-950 shadow-xs transition-transform hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 dark:bg-zinc-900 dark:text-zinc-50',
              stageStyle(card.stageNumber).cardBorder,
            ]"
          >
            <img
              v-if="card.imageUrl"
              :src="card.imageUrl"
              :alt="card.title"
              class="mb-3 aspect-4/3 w-full rounded-xl bg-zinc-100 object-cover dark:bg-zinc-800"
            />
            <div
              v-else
              aria-hidden="true"
              class="mb-3 flex aspect-4/3 w-full items-center justify-center rounded-xl bg-orange-100 text-orange-700 dark:bg-zinc-800 dark:text-orange-300"
            >
              <FileText :size="36" />
            </div>
            <p class="text-base text-zinc-950 dark:text-zinc-50">{{ card.title }}</p>
            <p class="mt-1.5 inline-flex self-start rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
              {{ text.home.commissionTypes[card.commissionType] }}
            </p>
            <p class="mt-2 line-clamp-2 text-sm leading-6 text-zinc-600 dark:text-zinc-300">
              {{ card.description }}
            </p>
            <div class="mt-auto pt-3">
              <div class="flex items-center justify-between gap-2 text-xs text-zinc-600 dark:text-zinc-300">
                <span>{{ getStageLabel(card.stageNumber) }}</span>
                <span>{{ stageProgress(card.stageNumber, text.home.stages) }}%</span>
              </div>
              <div class="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
                <div
                  :class="['h-full rounded-full transition-all duration-300', stageStyle(card.stageNumber).progressBar]"
                  :style="{ width: `${stageProgress(card.stageNumber, text.home.stages)}%` }"
                />
              </div>
            </div>
          </RouterLink>
        </div>

        <p v-else class="mt-6 text-sm text-zinc-500 dark:text-zinc-400">
          {{ text.home.previewEmptyCards }}
        </p>
      </div>

      <div
        v-else
        class="mt-8 rounded-2xl border border-dashed border-zinc-300 px-6 py-10 text-center dark:border-zinc-700"
      >
        <p class="text-lg font-bold text-zinc-950 dark:text-zinc-50">{{ text.home.noActiveBoardTitle }}</p>
        <p class="mt-2 text-sm text-zinc-600 dark:text-zinc-300">{{ text.home.noActiveBoardDescription }}</p>
      </div>
    </section>

    <template v-for="section in text.home.workflowSections" :key="section.id">
      <div aria-hidden="true" class="flex items-center justify-center gap-4 py-6">
        <span class="size-2.5 rounded-full bg-sky-300" />
        <span class="size-3 rotate-45 rounded-sm bg-rose-300" />
        <span class="size-2.5 rounded-full bg-amber-300" />
      </div>
      <section class="mx-auto flex w-full max-w-5xl items-center py-16 sm:py-24">
        <div class="grid w-full items-center gap-10 md:grid-cols-2">
          <img
            :src="section.image"
            :alt="section.imageAlt"
            width="500"
            height="500"
            :class="[
              'aspect-square w-full object-contain',
              section.imagePosition === 'right' ? 'md:order-2' : '',
            ]"
          />
          <div :class="section.imagePosition === 'right' ? 'md:order-1 md:justify-self-end' : ''">
            <h2 class="font-bagel-fat-one text-4xl sm:text-5xl">{{ section.title }}</h2>
            <p class="mt-5 text-lg leading-8 text-zinc-600 sm:text-xl dark:text-zinc-300">
              {{ section.description }}
            </p>
          </div>
        </div>
      </section>
    </template>
  </main>
</template>
