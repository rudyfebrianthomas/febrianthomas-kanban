<script setup lang="ts">
import { ArrowLeft, ArrowRight, CheckCircle2, Clock, Lock } from '@lucide/vue'
import { computed, onMounted, onUnmounted, ref } from 'vue'
import CommissionStatusBadge from '../components/commission/CommissionStatusBadge.vue'
import KanbanCardFormDialog from '../components/commission/KanbanCardFormDialog.vue'
import EmptyState from '../components/ui/EmptyState.vue'
import LoadingIndicator from '../components/ui/LoadingIndicator.vue'
import ThumbnailBox from '../components/ui/ThumbnailBox.vue'
import { useAuth } from '../composables/useAuth'
import { useLanguage } from '../composables/useLanguage'
import {
  type CommissionOffer,
  type CommissionOfferBoard,
  DEFAULT_COMMISSION_OFFERS,
  DEFAULT_COMMISSION_OFFER_BOARDS,
  fetchCommissionOfferBoards,
  fetchCommissionOffers,
  formatOfferPrices,
  isOfferLimitReached,
  isOfferBoardVisible,
  OFFER_BOARD_STATUS_DOTS,
  type OfferBoardStatus,
  summarizeOffersWithBoards,
} from '../lib/commissionOffers'
import {
  canAccessRequests,
  type CommissionStatus,
  COMMISSION_STATUS_STYLES,
  type CommissionStatusValue,
  DEFAULT_COMMISSION_STATUS,
  fetchCommissionStatus,
} from '../lib/commissionStatus'
import { supabase } from '../lib/supabase'

const BOARD_ORDER: Record<OfferBoardStatus, number> = {
  active: 0,
  waitlist: 1,
  inactive: 2,
}

const { language, text } = useLanguage()
const { signedIn } = useAuth()

const loading = ref(!!supabase)
const commissionStatus = ref<CommissionStatus | null>(
  supabase ? null : { ...DEFAULT_COMMISSION_STATUS },
)
const boards = ref<CommissionOfferBoard[]>(supabase ? [] : DEFAULT_COMMISSION_OFFER_BOARDS)
const offers = ref<CommissionOffer[]>(supabase ? [] : DEFAULT_COMMISSION_OFFERS)
const selectedOffer = ref<CommissionOffer | null>(null)
const requestDialogOpen = ref(false)
const submitted = ref(false)

let active = true

const canAccess = computed(() =>
  canAccessRequests(Boolean(signedIn.value), commissionStatus.value),
)

const visibleBoardsWithOffers = computed(() => {
  return [...boards.value]
    .filter((board) => signedIn.value || isOfferBoardVisible(board.status))
    .sort((a, b) => BOARD_ORDER[a.status] - BOARD_ORDER[b.status] || a.sortOrder - b.sortOrder)
    .map((board) => ({
      board,
      offers: offers.value.filter(
        (offer) => offer.boardId === board.id && (signedIn.value || offer.isOpen),
      ),
    }))
    .filter((section) => section.offers.length > 0)
})

function isOfferDisabled(offer: CommissionOffer): boolean {
  return isOfferLimitReached(offer) || (!signedIn.value && !offer.isOpen)
}

function offerCardStatus(
  offer: CommissionOffer,
  boardStatus: OfferBoardStatus,
): CommissionStatusValue {
  if (!offer.isOpen || isOfferLimitReached(offer) || boardStatus === 'inactive') return 'closed'
  if (boardStatus === 'waitlist') return 'waitlist'
  return 'open'
}

function boardStatusPillClass(status: OfferBoardStatus): string {
  if (status === 'active') {
    return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-200'
  }
  if (status === 'waitlist') {
    return 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-200'
  }
  return 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300'
}

onMounted(async () => {
  if (!supabase) return
  try {
    const [{ data: sessionData }, statusData] = await Promise.all([
      supabase.auth.getSession(),
      fetchCommissionStatus(),
    ])
    if (!active) return
    const isOwner = Boolean(sessionData.session)
    commissionStatus.value = statusData

    const [loadedBoards, loadedOffers] = await Promise.all([
      fetchCommissionOfferBoards(isOwner),
      fetchCommissionOffers(isOwner),
    ])
    if (!active) return
    boards.value = loadedBoards
    offers.value = loadedOffers
  } finally {
    if (active) loading.value = false
  }
})

onUnmounted(() => {
  active = false
})

function openOfferDialog(offer: CommissionOffer) {
  if (isOfferDisabled(offer)) return
  selectedOffer.value = offer
  requestDialogOpen.value = true
}

function onDialogOpenChange(nextOpen: boolean) {
  requestDialogOpen.value = nextOpen
  if (!nextOpen) selectedOffer.value = null
}

function onRequestSubmitted(offerId: string) {
  offers.value = offers.value.map((item) =>
    item.id === offerId ? { ...item, requestCount: item.requestCount + 1 } : item,
  )
  if (commissionStatus.value) {
    commissionStatus.value = {
      ...commissionStatus.value,
      ...summarizeOffersWithBoards(offers.value, boards.value),
    }
  }
  selectedOffer.value = null
  submitted.value = true
}

function resetFlow() {
  submitted.value = false
  selectedOffer.value = null
  if (supabase) {
    void Promise.all([
      fetchCommissionOfferBoards(Boolean(signedIn.value)),
      fetchCommissionOffers(Boolean(signedIn.value)),
      fetchCommissionStatus(),
    ]).then(([loadedBoards, loadedOffers, statusData]) => {
      if (!active) return
      boards.value = loadedBoards
      offers.value = loadedOffers
      if (statusData) commissionStatus.value = statusData
    })
  }
}
</script>

<template>
  <main class="flex-1 px-6 sm:px-10">
    <section class="mx-auto w-full max-w-6xl py-20 sm:py-28" aria-labelledby="page-title">
      <div class="max-w-2xl">
        <div class="mb-5 flex flex-wrap items-center gap-3">
          <p class="text-xs uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
            {{ text.request.eyebrow }}
          </p>
          <CommissionStatusBadge v-if="commissionStatus" :value="commissionStatus" />
        </div>
        <h1
          id="page-title"
          class="font-bagel-fat-one text-6xl leading-none text-zinc-950 sm:text-8xl dark:text-zinc-50"
        >
          {{ text.request.title }}
        </h1>
        <p class="mt-6 text-lg leading-7 text-zinc-600 dark:text-zinc-300">
          {{ text.request.description }}
        </p>
      </div>

      <div
        v-if="loading"
        class="mt-12 flex min-h-48 items-center justify-center text-zinc-600 dark:text-zinc-300"
      >
        <LoadingIndicator :label="text.site.loading" />
      </div>

      <div
        v-else-if="!canAccess"
        class="surface-shadow mx-auto mt-12 max-w-xl rounded-2xl border border-zinc-200 bg-white p-8 text-center dark:border-zinc-800 dark:bg-zinc-900"
      >
        <span
          aria-hidden="true"
          class="mx-auto flex size-14 items-center justify-center rounded-2xl bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-200"
        >
          <Lock :size="26" />
        </span>
        <h2 class="mt-5 font-sniglet text-3xl font-bold text-zinc-950 dark:text-zinc-50">
          {{ text.request.closedTitle }}
        </h2>
        <p class="mx-auto mt-3 max-w-md text-base leading-7 text-zinc-600 dark:text-zinc-300">
          {{ text.request.closedDescription }}
        </p>
        <div class="mt-6">
          <RouterLink
            to="/queue"
            class="inline-flex min-h-11 items-center gap-2 rounded-xl bg-zinc-900 px-5 py-2.5 text-sm text-white transition-colors hover:bg-zinc-700 focus-visible:outline-2 focus-visible:outline-offset-2 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
          >
            <ArrowLeft :size="16" aria-hidden="true" />
            <span>{{ text.request.backToBoard }}</span>
          </RouterLink>
        </div>
      </div>

      <div
        v-else-if="submitted"
        class="surface-shadow mx-auto mt-10 max-w-xl rounded-2xl border border-zinc-200 bg-white p-8 text-center dark:border-zinc-800 dark:bg-zinc-900"
      >
        <span
          aria-hidden="true"
          class="mx-auto flex size-14 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-200"
        >
          <CheckCircle2 :size="28" />
        </span>
        <h2 class="mt-5 font-sniglet text-3xl font-bold text-zinc-950 dark:text-zinc-50">
          {{ text.request.successTitle }}
        </h2>
        <p class="mx-auto mt-3 max-w-md text-base leading-7 text-zinc-600 dark:text-zinc-300">
          {{ text.request.successDescription }}
        </p>
        <div class="mt-6 flex flex-wrap justify-center gap-3">
          <RouterLink
            to="/queue"
            class="inline-flex min-h-11 items-center gap-2 rounded-xl bg-zinc-900 px-5 py-2.5 text-sm text-white transition-colors hover:bg-zinc-700 focus-visible:outline-2 focus-visible:outline-offset-2 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
          >
            <ArrowLeft :size="16" aria-hidden="true" />
            <span>{{ text.request.backToBoard }}</span>
          </RouterLink>
          <button
            type="button"
            class="inline-flex min-h-11 items-center rounded-xl border border-zinc-300 px-5 py-2.5 text-sm text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
            @click="resetFlow"
          >
            {{ text.request.submitAnother }}
          </button>
        </div>
      </div>

      <div v-else class="mt-12 space-y-8">
        <p
          v-if="signedIn && commissionStatus?.status === 'closed'"
          class="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200"
        >
          {{ text.request.adminClosedNotice }}
        </p>

        <EmptyState
          v-if="visibleBoardsWithOffers.length === 0"
          :title="text.request.emptyOffersTitle"
          :description="text.request.emptyOffersDescription"
          class="mx-auto py-12"
        />

        <template v-else>
          <p class="text-sm text-zinc-600 dark:text-zinc-400">
            {{ text.request.listDescription }}
          </p>

          <section
            v-for="section in visibleBoardsWithOffers"
            :key="section.board.id"
            class="rounded-3xl border border-zinc-200 bg-zinc-50/70 p-5 sm:p-7 dark:border-zinc-800 dark:bg-zinc-900/50"
          >
          <div class="flex flex-wrap items-start justify-between gap-4">
            <div class="max-w-2xl">
              <div class="flex flex-wrap items-center gap-2.5">
                <h2 class="text-xl font-bold text-zinc-950 sm:text-2xl dark:text-zinc-50">
                  {{ section.board.title }}
                </h2>
                <span
                  :class="[
                    'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium',
                    boardStatusPillClass(section.board.status),
                  ]"
                >
                  <span :class="['size-1.5 rounded-full', OFFER_BOARD_STATUS_DOTS[section.board.status]]" aria-hidden="true" />
                  {{ text.setting.offers.boardStatuses[section.board.status] }}
                </span>
                <span class="rounded-full bg-white px-2.5 py-0.5 text-xs tabular-nums text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                  {{ section.offers.length }}
                </span>
              </div>
              <p
                v-if="section.board.description"
                class="mt-1.5 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400"
              >
                {{ section.board.description }}
              </p>
            </div>
          </div>

          <div
            v-if="section.board.status === 'waitlist'"
            class="mt-4 flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200"
          >
            <Clock :size="16" aria-hidden="true" class="mt-0.5 shrink-0" />
            <p>{{ text.request.waitlistBoardNotice }}</p>
          </div>

          <div
            :class="[
              'mt-5 grid gap-4',
              section.offers.length >= 3 ? 'md:grid-cols-2 lg:grid-cols-3' : 'md:grid-cols-2',
            ]"
          >
            <button
              v-for="offer in section.offers"
              :key="offer.id"
              type="button"
              :disabled="isOfferDisabled(offer)"
              :class="[
                'surface-shadow group flex flex-col rounded-2xl border-2 bg-white p-5 text-left transition-all focus-visible:outline-2 focus-visible:outline-offset-2 sm:p-6 dark:bg-zinc-900',
                COMMISSION_STATUS_STYLES[offerCardStatus(offer, section.board.status)].cardBorder,
                isOfferDisabled(offer)
                  ? 'cursor-not-allowed opacity-65'
                  : [
                      'cursor-pointer hover:-translate-y-0.5',
                      COMMISSION_STATUS_STYLES[offerCardStatus(offer, section.board.status)].interactiveBorder,
                    ],
              ]"
              @click="openOfferDialog(offer)"
            >
              <div
                v-if="offer.imageUrl"
                class="mb-4 overflow-hidden rounded-xl bg-zinc-100 dark:bg-zinc-800"
              >
                <ThumbnailBox
                  :src="offer.imageUrl"
                  :alt="offer.title"
                  img-class="aspect-16/10 w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                />
              </div>
              <ThumbnailBox
                v-else
                :src="null"
                :alt="offer.title"
                :icon-size="36"
                fallback-class="mb-4 aspect-16/10 w-full rounded-xl"
              />

              <div class="flex w-full flex-wrap items-center justify-between gap-2">
                <div class="flex flex-wrap items-center gap-2">
                  <span class="rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
                    {{ text.home.commissionTypes[offer.commissionType] }}
                  </span>
                  <span
                    v-if="!offer.isOpen"
                    class="rounded-full bg-rose-100 px-2.5 py-0.5 text-xs font-medium text-rose-700 dark:bg-rose-950/60 dark:text-rose-200"
                  >
                    {{ text.request.closedOfferBadge }}
                  </span>
                </div>

                <span
                  v-if="offer.maxRequests !== null"
                  :class="[
                    'rounded-full px-2.5 py-0.5 text-xs font-medium tabular-nums',
                    isOfferLimitReached(offer)
                      ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-200'
                      : 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200',
                  ]"
                >
                  {{
                    text.request.slotsProgressLabel
                      .replace('{count}', String(offer.requestCount))
                      .replace('{max}', String(offer.maxRequests))
                  }}
                </span>
              </div>

              <h3 class="mt-3.5 text-xl font-bold text-zinc-950 dark:text-zinc-50">
                {{ offer.title }}
              </h3>
              <p class="mt-2 flex-1 text-sm leading-6 text-zinc-600 dark:text-zinc-300">
                {{ offer.description }}
              </p>

              <div class="mt-5 flex w-full items-center justify-between gap-3 border-t border-zinc-100 pt-4 dark:border-zinc-800">
                <span class="text-base font-bold tabular-nums text-orange-700 dark:text-orange-300">
                  {{ formatOfferPrices(offer, language) }}
                </span>

                <span
                  v-if="isOfferLimitReached(offer)"
                  class="rounded-full bg-rose-100 px-3 py-1.5 text-xs font-medium text-rose-700 dark:bg-rose-950/60 dark:text-rose-200"
                >
                  {{ text.request.disabledOfferBadge }}
                </span>
                <span
                  v-else-if="offer.isOpen || signedIn"
                  class="inline-flex items-center gap-1.5 rounded-full bg-zinc-900 px-3.5 py-1.5 text-xs font-medium text-white transition-colors group-hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:group-hover:bg-zinc-300"
                >
                  <span>{{ section.board.status === 'waitlist' ? text.request.selectWaitlistOffer : text.request.selectOffer }}</span>
                  <ArrowRight :size="14" aria-hidden="true" class="transition-transform group-hover:translate-x-0.5" />
                </span>
              </div>
            </button>
            </div>
          </section>
        </template>
      </div>

      <KanbanCardFormDialog
        mode="request"
        :open="requestDialogOpen"
        :offer="selectedOffer"
        id-prefix="request-modal"
        @update:open="onDialogOpenChange"
        @submitted="onRequestSubmitted"
      />
    </section>
  </main>
</template>
