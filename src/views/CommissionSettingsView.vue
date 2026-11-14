<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import CommissionOffersManager from '../components/commission/CommissionOffersManager.vue'
import SelectField from '../components/ui/SelectField.vue'
import { useLanguage } from '../composables/useLanguage'
import {
  COMMISSION_STATUSES,
  COMMISSION_STATUS_STYLES,
  type CommissionStatusValue,
  fetchCommissionStatus,
} from '../lib/commissionStatus'
import { supabase } from '../lib/supabase'

const { text } = useLanguage()
const router = useRouter()

const commissionStatusValue = ref<CommissionStatusValue>('open')
const slotsOpenInput = ref(3)
const slotsTotalInput = ref(5)
const statusSaving = ref(false)
const statusSaved = ref(false)
const statusError = ref('')
let statusSavedTimer: ReturnType<typeof setTimeout> | null = null

const commissionStatusOptions = computed(() =>
  COMMISSION_STATUSES.map((option) => ({
    value: option,
    label: text.value.home.commissionStatuses[option],
    dotClass: COMMISSION_STATUS_STYLES[option].dot,
  })),
)

const subscription = supabase?.auth.onAuthStateChange((_event, session) => {
  if (!session) void router.replace('/')
})

onMounted(async () => {
  const statusResult = await fetchCommissionStatus()
  if (statusResult) {
    commissionStatusValue.value = statusResult.status
    slotsOpenInput.value = statusResult.slotsOpen
    slotsTotalInput.value = statusResult.slotsTotal
  }
})

onUnmounted(() => {
  subscription?.data.subscription.unsubscribe()
  if (statusSavedTimer) clearTimeout(statusSavedTimer)
})

async function saveCommissionStatus() {
  if (statusSaving.value) return
  statusSaving.value = true
  statusSaved.value = false
  statusError.value = ''
  const slotsOpen = Math.max(0, Math.min(99, Math.trunc(Number(slotsOpenInput.value) || 0)))
  const slotsTotal = Math.max(0, Math.min(99, Math.trunc(Number(slotsTotalInput.value) || 0)))
  slotsOpenInput.value = slotsOpen
  slotsTotalInput.value = slotsTotal

  try {
    if (supabase) {
      const { error } = await supabase
        .from('commission_status')
        .update({
          status: commissionStatusValue.value,
          slots_open: slotsOpen,
          slots_total: slotsTotal,
        })
        .eq('id', 'default')
      if (error) throw error
    }
    statusSaved.value = true
    if (statusSavedTimer) clearTimeout(statusSavedTimer)
    statusSavedTimer = setTimeout(() => {
      statusSaved.value = false
    }, 2000)
  } catch {
    statusError.value = text.value.setting.saveStatusError
  } finally {
    statusSaving.value = false
  }
}
</script>

<template>
  <main class="flex flex-1 flex-col px-6 sm:px-10">
    <section
      class="mx-auto flex w-full max-w-6xl flex-1 flex-col py-12 sm:py-16"
      aria-labelledby="page-title"
    >
      <div class="max-w-3xl">
        <p class="mb-4 text-xs uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
          {{ text.commissionSettings.eyebrow }}
        </p>
        <h1
          id="page-title"
          class="font-bagel-fat-one text-5xl leading-[1.05] tracking-tight text-zinc-950 sm:text-7xl dark:text-zinc-50"
        >
          {{ text.commissionSettings.title }}
        </h1>
        <p class="mt-4 text-base leading-7 text-zinc-600 sm:text-lg dark:text-zinc-300">
          {{ text.commissionSettings.description }}
        </p>
      </div>

      <form
        class="surface-shadow mt-8 rounded-2xl border border-zinc-200 bg-white p-5 sm:p-6 dark:border-zinc-800 dark:bg-zinc-900"
        @submit.prevent="saveCommissionStatus"
      >
        <div class="flex flex-wrap items-end gap-4">
          <div class="min-w-44 flex-1">
            <label for="commission-status-select" class="mb-1.5 block text-sm text-zinc-800 dark:text-zinc-200">
              {{ text.setting.commissionStatusTitle }}
            </label>
            <SelectField
              id="commission-status-select"
              v-model="commissionStatusValue"
              :options="commissionStatusOptions"
            />
          </div>
          <div class="w-28">
            <label for="slots-open" class="mb-1.5 block text-sm text-zinc-800 dark:text-zinc-200">
              {{ text.setting.slotsOpenLabel }}
            </label>
            <input
              id="slots-open"
              v-model.number="slotsOpenInput"
              type="number"
              min="0"
              max="99"
              class="min-h-11 w-full rounded-xl border border-zinc-300 bg-white px-3 text-sm text-zinc-950 outline-none focus:ring-2 focus:ring-zinc-900 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-50 dark:focus:ring-zinc-300"
            />
          </div>
          <div class="w-28">
            <label for="slots-total" class="mb-1.5 block text-sm text-zinc-800 dark:text-zinc-200">
              {{ text.setting.slotsTotalLabel }}
            </label>
            <input
              id="slots-total"
              v-model.number="slotsTotalInput"
              type="number"
              min="0"
              max="99"
              class="min-h-11 w-full rounded-xl border border-zinc-300 bg-white px-3 text-sm text-zinc-950 outline-none focus:ring-2 focus:ring-zinc-900 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-50 dark:focus:ring-zinc-300"
            />
          </div>
          <button
            type="submit"
            :disabled="statusSaving"
            class="inline-flex min-h-11 items-center justify-center rounded-xl bg-zinc-900 px-4 py-2 text-sm text-white transition-colors hover:bg-zinc-700 disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
          >
            {{
              statusSaving
                ? text.setting.savingStatus
                : statusSaved
                  ? text.setting.savedStatus
                  : text.setting.saveStatus
            }}
          </button>
        </div>
        <p v-if="statusError" role="alert" class="mt-3 text-sm text-red-700 dark:text-red-400">
          {{ statusError }}
        </p>
      </form>

      <CommissionOffersManager />
    </section>
  </main>
</template>
