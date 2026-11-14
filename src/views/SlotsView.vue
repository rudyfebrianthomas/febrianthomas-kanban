<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ArrowUpRight, Plus } from '@lucide/vue'
import CommissionStatusBadge from '../components/commission/CommissionStatusBadge.vue'
import SlotsManager from '../components/commission/SlotsManager.vue'
import MotionButton from '../components/ui/MotionButton.vue'
import { useAuth } from '../composables/useAuth'
import { useLanguage } from '../composables/useLanguage'
import {
  type CommissionOffer,
  type CommissionOfferBoard,
  MAX_ACTIVE_OFFER_BOARDS,
  MAX_WAITLIST_OFFER_BOARDS,
  offerBoardStatusCount,
  summarizeOffersWithBoards,
} from '../lib/commissionOffers'
import {
  type CommissionStatus,
  type CommissionStatusValue,
  deriveCommissionStatusValue,
  fetchCommissionStatus,
  summarizeOfferSlots,
} from '../lib/commissionStatus'
import { supabase } from '../lib/supabase'

const { text } = useLanguage()
const { signedIn } = useAuth()
const router = useRouter()

const slotsManagerRef = ref<InstanceType<typeof SlotsManager> | null>(null)
const activeBoardsUsed = ref(0)
const waitlistBoardsUsed = ref(0)
const commissionStatusValue = ref<CommissionStatusValue | null>(supabase ? null : 'open')
const offerSlotSummary = ref(summarizeOfferSlots([]))
const liveStatusBadge = computed<CommissionStatus | null>(() => {
  if (!commissionStatusValue.value) return null
  return {
    status: commissionStatusValue.value,
    ...offerSlotSummary.value,
  }
})

function onOffersChange(nextOffers: CommissionOffer[], nextBoards: CommissionOfferBoard[]) {
  activeBoardsUsed.value = offerBoardStatusCount(nextBoards, 'active')
  waitlistBoardsUsed.value = offerBoardStatusCount(nextBoards, 'waitlist')
  commissionStatusValue.value = deriveCommissionStatusValue(nextBoards)
  offerSlotSummary.value = summarizeOffersWithBoards(nextOffers, nextBoards)
}

watch(
  signedIn,
  (authenticated) => {
    if (authenticated === false) void router.replace('/')
  },
  { immediate: true },
)

onMounted(async () => {
  const statusResult = await fetchCommissionStatus()
  if (statusResult && commissionStatusValue.value === null) {
    commissionStatusValue.value = statusResult.status
    offerSlotSummary.value = {
      slotsOpen: statusResult.slotsOpen,
      slotsTotal: statusResult.slotsTotal,
    }
  }
})
</script>

<template>
  <main class="flex flex-1 flex-col px-6 sm:px-10">
    <section
      class="mx-auto flex w-full max-w-6xl flex-1 flex-col py-20 sm:py-28"
      aria-labelledby="page-title"
    >
      <div class="flex flex-wrap items-end justify-between gap-6">
        <div class="max-w-3xl">
          <div class="mb-5 flex flex-wrap items-center gap-2.5">
            <p class="text-xs uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
              {{ text.commissionSettings.eyebrow }}
            </p>
            <CommissionStatusBadge v-if="liveStatusBadge" :value="liveStatusBadge" />
            <span
              class="rounded-full bg-orange-500/15 px-3 py-1 text-xs font-medium tabular-nums text-orange-700 dark:bg-orange-400/15 dark:text-orange-300"
            >
              {{ activeBoardsUsed }}/{{ MAX_ACTIVE_OFFER_BOARDS }} {{ text.setting.offers.activeLimitCount }}
            </span>
            <span
              class="rounded-full bg-amber-100 px-3 py-1 text-xs font-medium tabular-nums text-amber-800 dark:bg-amber-950/60 dark:text-amber-200"
            >
              {{ waitlistBoardsUsed }}/{{ MAX_WAITLIST_OFFER_BOARDS }} {{ text.setting.offers.waitlistLimitCount }}
            </span>
          </div>
          <h1
            id="page-title"
            class="font-bagel-fat-one text-6xl leading-none text-zinc-950 sm:text-8xl dark:text-zinc-50"
          >
            {{ text.commissionSettings.title }}
          </h1>
          <p class="mt-6 text-lg leading-7 text-zinc-600 dark:text-zinc-300">
            {{ text.commissionSettings.description }}
          </p>
          <p class="mt-1.5 text-sm text-zinc-500 dark:text-zinc-400">
            {{ text.commissionSettings.statusHint }}
          </p>
        </div>

        <div class="flex flex-wrap items-center gap-2.5">
          <RouterLink
            to="/commissions"
            class="inline-flex min-h-11 items-center gap-2 rounded-xl border border-zinc-300 bg-white px-4 py-2 text-sm text-zinc-700 transition-colors hover:bg-zinc-100 focus-visible:outline-2 focus-visible:outline-offset-2 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            <span>{{ text.commissionSettings.previewRequest }}</span>
            <ArrowUpRight :size="15" aria-hidden="true" />
          </RouterLink>
          <MotionButton
            type="button"
            class="min-h-11 gap-1.5"
            @click="slotsManagerRef?.openCreateBoard()"
          >
            <Plus :size="16" aria-hidden="true" />
            <span>{{ text.setting.offers.addBoard }}</span>
          </MotionButton>
        </div>
      </div>

      <SlotsManager ref="slotsManagerRef" @offers-change="onOffersChange" />
    </section>
  </main>
</template>
