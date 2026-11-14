<script setup lang="ts">
import { ArrowLeft, ArrowRight, CheckCircle2, Lock } from '@lucide/vue'
import { computed, onMounted, onUnmounted, ref } from 'vue'
import CommissionStatusBadge from '../components/commission/CommissionStatusBadge.vue'
import TosDialog from '../components/tos/TosDialog.vue'
import ImageUploadField from '../components/ui/ImageUploadField.vue'
import SelectField from '../components/ui/SelectField.vue'
import { useLanguage } from '../composables/useLanguage'
import {
  type CommissionOffer,
  DEFAULT_COMMISSION_OFFERS,
  fetchCommissionOffers,
  formatOfferPrices,
} from '../lib/commissionOffers'
import { type CommissionStatus, fetchCommissionStatus } from '../lib/commissionStatus'
import { uploadKanbanImage } from '../lib/kanbanImage'
import { supabase } from '../lib/supabase'

const CONTACT_CHANNELS = ['email', 'discord', 'twitter', 'instagram'] as const
type ContactChannel = (typeof CONTACT_CHANNELS)[number]

const { language, text } = useLanguage()

const signedIn = ref(false)
const authSubscription = supabase?.auth.onAuthStateChange((_event, session) => {
  signedIn.value = !!session
})

const loading = ref(!!supabase)
const commissionStatus = ref<CommissionStatus | null>(
  supabase ? null : { status: 'open', slotsOpen: 3, slotsTotal: 5 },
)
const offers = ref<CommissionOffer[]>(supabase ? [] : DEFAULT_COMMISSION_OFFERS)
const selectedOffer = ref<CommissionOffer | null>(null)

const description = ref('')
const contactChannel = ref<ContactChannel>('discord')
const contactValue = ref('')
const imageFile = ref<File | null>(null)
const imageError = ref('')
const tosAccepted = ref(false)
const tosDialogOpen = ref(false)
const submitting = ref(false)
const submitted = ref(false)
const formError = ref('')

let active = true

const canAccess = computed(
  () =>
    signedIn.value ||
    (commissionStatus.value !== null && commissionStatus.value.status !== 'closed'),
)

const visibleOffers = computed(() =>
  signedIn.value ? offers.value : offers.value.filter((offer) => offer.isOpen),
)

const contactChannelOptions = computed(() =>
  CONTACT_CHANNELS.map((channel) => ({
    value: channel,
    label: text.value.request.contactChannels[channel],
  })),
)

const fieldClass =
  'mt-2 w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 text-base text-zinc-950 outline-none placeholder:text-zinc-400 focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-50 dark:placeholder:text-zinc-500 dark:focus:border-zinc-300 dark:focus:ring-zinc-300'

onMounted(async () => {
  if (!supabase) return
  try {
    const [{ data: sessionData }, statusData] = await Promise.all([
      supabase.auth.getSession(),
      fetchCommissionStatus(),
    ])
    if (!active) return
    const isOwner = Boolean(sessionData.session)
    signedIn.value = isOwner
    commissionStatus.value = statusData

    const loadedOffers = await fetchCommissionOffers(isOwner)
    if (!active) return
    offers.value = loadedOffers
  } finally {
    if (active) loading.value = false
  }
})

onUnmounted(() => {
  active = false
  authSubscription?.data.subscription.unsubscribe()
})

function selectOffer(offer: CommissionOffer) {
  selectedOffer.value = offer
  formError.value = ''
  submitted.value = false
}

function changeOffer() {
  selectedOffer.value = null
  formError.value = ''
}

function resetFlow() {
  selectedOffer.value = null
  description.value = ''
  contactChannel.value = 'discord'
  contactValue.value = ''
  imageFile.value = null
  imageError.value = ''
  tosAccepted.value = false
  formError.value = ''
  submitted.value = false
}

async function submitRequest() {
  if (submitting.value || !canAccess.value || !selectedOffer.value || imageError.value) return
  formError.value = ''

  const trimmedDescription = description.value.trim()
  const trimmedContact = contactValue.value.trim()
  if (!trimmedDescription || !trimmedContact) {
    formError.value = text.value.request.requiredFields
    return
  }

  if (contactChannel.value === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedContact)) {
    formError.value = text.value.request.invalidEmail
    return
  }

  if (!tosAccepted.value) {
    formError.value = text.value.request.tosRequired
    return
  }

  submitting.value = true
  try {
    if (supabase) {
      const uploadedPath = imageFile.value ? await uploadKanbanImage(imageFile.value) : null
      const { error } = await supabase.rpc('submit_commission_request', {
        p_offer_id: selectedOffer.value.id,
        p_description: trimmedDescription,
        p_contact_channel: contactChannel.value,
        p_contact_value: trimmedContact,
        p_image_path: uploadedPath,
        p_tos_accepted: true,
      })
      if (error) throw error
    }
    submitted.value = true
  } catch {
    formError.value = text.value.request.submitError
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <main class="flex-1 px-6 sm:px-10">
    <section class="mx-auto w-full max-w-4xl py-12 sm:py-16" aria-labelledby="page-title">
      <div class="mb-4 flex flex-wrap items-center gap-3">
        <p class="text-xs uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
          {{ text.request.eyebrow }}
        </p>
        <CommissionStatusBadge v-if="commissionStatus" :value="commissionStatus" />
      </div>
      <h1
        id="page-title"
        class="font-bagel-fat-one text-5xl leading-[1.05] tracking-tight text-zinc-950 sm:text-7xl dark:text-zinc-50"
      >
        {{ text.request.title }}
      </h1>
      <p class="mt-4 max-w-2xl text-base leading-7 text-zinc-600 sm:text-lg dark:text-zinc-300">
        {{ text.request.description }}
      </p>

      <div
        v-if="loading"
        class="mt-8 grid gap-4 sm:grid-cols-2"
        aria-hidden="true"
      >
        <div
          v-for="n in 4"
          :key="n"
          class="h-44 animate-pulse rounded-2xl border border-zinc-200 bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900"
        />
      </div>

      <div
        v-else-if="!canAccess"
        class="surface-shadow mt-8 rounded-2xl border border-zinc-200 bg-white p-8 text-center dark:border-zinc-800 dark:bg-zinc-900"
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
            to="/commission"
            class="inline-flex min-h-11 items-center gap-2 rounded-xl bg-zinc-900 px-5 py-2.5 text-sm text-white transition-colors hover:bg-zinc-700 focus-visible:outline-2 focus-visible:outline-offset-2 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
          >
            <ArrowLeft :size="16" aria-hidden="true" />
            <span>{{ text.request.backToBoard }}</span>
          </RouterLink>
        </div>
      </div>

      <div
        v-else-if="submitted"
        class="surface-shadow mt-8 rounded-2xl border border-zinc-200 bg-white p-8 text-center dark:border-zinc-800 dark:bg-zinc-900"
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
            to="/commission"
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

      <div v-else class="mt-8">
        <p
          v-if="signedIn && commissionStatus?.status === 'closed'"
          class="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200"
        >
          {{ text.request.adminClosedNotice }}
        </p>

        <template v-if="!selectedOffer">
          <div>
            <h2 class="text-2xl font-bold text-zinc-950 dark:text-zinc-50">
              {{ text.request.listTitle }}
            </h2>
            <p class="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              {{ text.request.listDescription }}
            </p>
          </div>

          <div
            v-if="visibleOffers.length === 0"
            class="mt-6 rounded-2xl border border-dashed border-zinc-300 px-6 py-10 text-center dark:border-zinc-700"
          >
            <p class="text-lg font-bold text-zinc-950 dark:text-zinc-50">
              {{ text.request.emptyOffersTitle }}
            </p>
            <p class="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
              {{ text.request.emptyOffersDescription }}
            </p>
            <RouterLink
              to="/commission"
              class="mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl border border-zinc-300 px-4 py-2 text-sm text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              <ArrowLeft :size="16" aria-hidden="true" />
              <span>{{ text.request.backToBoard }}</span>
            </RouterLink>
          </div>

          <div v-else class="mt-6 grid gap-4 sm:grid-cols-2">
            <button
              v-for="offer in visibleOffers"
              :key="offer.id"
              type="button"
              class="surface-shadow group flex cursor-pointer flex-col rounded-2xl border border-zinc-200 bg-white p-6 text-left transition-all hover:-translate-y-0.5 hover:border-zinc-400 focus-visible:outline-2 focus-visible:outline-offset-2 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-600"
              @click="selectOffer(offer)"
            >
              <img
                v-if="offer.imageUrl"
                :src="offer.imageUrl"
                :alt="offer.title"
                class="mb-4 aspect-4/3 w-full rounded-xl bg-zinc-100 object-cover dark:bg-zinc-800"
              />
              <div class="flex w-full items-start justify-between gap-3">
                <div class="flex flex-wrap items-center gap-2">
                  <span class="rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
                    {{ text.home.commissionTypes[offer.commissionType] }}
                  </span>
                  <span
                    v-if="!offer.isOpen"
                    class="rounded-full bg-rose-100 px-2.5 py-0.5 text-xs text-rose-700 dark:bg-rose-950/60 dark:text-rose-200"
                  >
                    {{ text.request.closedOfferBadge }}
                  </span>
                </div>
                <span class="shrink-0 rounded-full bg-orange-100 px-3 py-1 text-sm font-bold text-orange-800 dark:bg-orange-950/60 dark:text-orange-200">
                  {{ formatOfferPrices(offer, language) }}
                </span>
              </div>
              <h3 class="mt-4 text-xl font-bold text-zinc-950 dark:text-zinc-50">
                {{ offer.title }}
              </h3>
              <p class="mt-2 flex-1 text-sm leading-6 text-zinc-600 dark:text-zinc-300">
                {{ offer.description }}
              </p>
              <span class="mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-zinc-950 dark:text-zinc-50">
                <span>{{ text.request.selectOffer }}</span>
                <ArrowRight :size="15" aria-hidden="true" class="transition-transform group-hover:translate-x-1" />
              </span>
            </button>
          </div>
        </template>

        <form
          v-else
          class="surface-shadow space-y-5 rounded-2xl border border-zinc-200 bg-white p-6 sm:p-8 dark:border-zinc-800 dark:bg-zinc-900"
          @submit.prevent="submitRequest"
        >
          <div class="flex flex-wrap items-start justify-between gap-4 rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-800/60">
            <div class="flex min-w-0 flex-1 items-start gap-3">
              <img
                v-if="selectedOffer.imageUrl"
                :src="selectedOffer.imageUrl"
                :alt="selectedOffer.title"
                class="size-16 shrink-0 rounded-xl bg-white object-cover dark:bg-zinc-900"
              />
              <div class="min-w-0 flex-1">
                <p class="text-xs uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400">
                  {{ text.request.selectedLabel }}
                </p>
                <div class="mt-1.5 flex flex-wrap items-center gap-2">
                  <h2 class="text-lg font-bold text-zinc-950 dark:text-zinc-50">
                    {{ selectedOffer.title }}
                  </h2>
                  <span class="rounded-full bg-white px-2.5 py-0.5 text-xs text-zinc-700 dark:bg-zinc-900 dark:text-zinc-200">
                    {{ text.home.commissionTypes[selectedOffer.commissionType] }}
                  </span>
                  <span class="rounded-full bg-orange-100 px-2.5 py-0.5 text-xs font-bold text-orange-800 dark:bg-orange-950/60 dark:text-orange-200">
                    {{ formatOfferPrices(selectedOffer, language) }}
                  </span>
                </div>
                <p class="mt-1.5 text-sm leading-6 text-zinc-600 dark:text-zinc-300">
                  {{ selectedOffer.description }}
                </p>
              </div>
            </div>
            <button
              type="button"
              class="inline-flex min-h-9 shrink-0 items-center rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
              @click="changeOffer"
            >
              {{ text.request.changeOffer }}
            </button>
          </div>

          <div>
            <div class="flex items-center justify-between gap-2">
              <label for="request-description" class="block text-sm text-zinc-800 dark:text-zinc-200">
                {{ text.request.descriptionLabel }}
              </label>
              <span class="text-xs text-zinc-500 dark:text-zinc-400">
                {{ description.length }}/240
              </span>
            </div>
            <textarea
              id="request-description"
              v-model="description"
              rows="4"
              maxlength="240"
              required
              :placeholder="text.request.descriptionPlaceholder"
              :class="fieldClass"
            />
          </div>

          <div class="grid gap-4 sm:grid-cols-[12rem_1fr]">
            <div>
              <label for="request-contact-channel" class="block text-sm text-zinc-800 dark:text-zinc-200">
                {{ text.request.contactChannelLabel }}
              </label>
              <SelectField
                id="request-contact-channel"
                v-model="contactChannel"
                :options="contactChannelOptions"
                size="lg"
              />
            </div>

            <div>
              <label for="request-contact-value" class="block text-sm text-zinc-800 dark:text-zinc-200">
                {{ text.request.contactValueLabel }}
              </label>
              <input
                id="request-contact-value"
                v-model="contactValue"
                :type="contactChannel === 'email' ? 'email' : 'text'"
                maxlength="120"
                required
                :placeholder="text.request.contactPlaceholders[contactChannel]"
                :class="fieldClass"
              />
            </div>
          </div>

          <ImageUploadField
            v-model:file="imageFile"
            v-model:error="imageError"
            id-prefix="request-reference"
            :label="text.request.referenceImageLabel"
          />

          <div class="flex items-start gap-3 rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-800/60">
            <input
              id="request-tos-agree"
              v-model="tosAccepted"
              type="checkbox"
              class="mt-0.5 size-4 shrink-0 cursor-pointer rounded border-zinc-300 accent-zinc-900 dark:border-zinc-600 dark:accent-zinc-100"
            />
            <div class="text-sm leading-6 text-zinc-700 dark:text-zinc-300">
              <label for="request-tos-agree" class="cursor-pointer">
                {{ text.request.tosPrefix }}
              </label>
              {{ ' ' }}
              <button
                type="button"
                class="cursor-pointer font-medium text-zinc-950 underline underline-offset-4 hover:text-zinc-700 focus-visible:outline-2 focus-visible:outline-offset-2 dark:text-zinc-50 dark:hover:text-zinc-300"
                @click="tosDialogOpen = true"
              >
                {{ text.request.tosLink }}
              </button>
            </div>
          </div>

          <p
            v-if="formError"
            role="alert"
            class="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300"
          >
            {{ formError }}
          </p>

          <div class="flex flex-wrap items-center justify-between gap-3 pt-2">
            <button
              type="button"
              class="inline-flex min-h-11 items-center gap-2 rounded-xl border border-zinc-300 px-4 py-2 text-sm text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
              @click="changeOffer"
            >
              <ArrowLeft :size="16" aria-hidden="true" />
              <span>{{ text.request.changeOffer }}</span>
            </button>
            <button
              type="submit"
              :disabled="submitting"
              class="inline-flex min-h-11 items-center justify-center rounded-xl bg-zinc-900 px-6 py-2.5 text-sm text-white transition-colors hover:bg-zinc-700 disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
            >
              {{ submitting ? text.request.submitting : text.request.submit }}
            </button>
          </div>
        </form>
      </div>

      <TosDialog v-model:open="tosDialogOpen" @agree="tosAccepted = true" />
    </section>
  </main>
</template>
