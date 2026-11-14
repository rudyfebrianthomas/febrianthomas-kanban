<script setup lang="ts">
import { ArrowLeft, CheckCircle2, Lock } from '@lucide/vue'
import { computed, onMounted, onUnmounted, ref } from 'vue'
import CommissionStatusBadge from '../components/commission/CommissionStatusBadge.vue'
import TosDialog from '../components/tos/TosDialog.vue'
import SelectField from '../components/ui/SelectField.vue'
import { useLanguage } from '../composables/useLanguage'
import {
  COMMISSION_TYPES,
  type CommissionStatus,
  type CommissionType,
  fetchCommissionStatus,
} from '../lib/commissionStatus'
import { supabase } from '../lib/supabase'

const CONTACT_CHANNELS = ['email', 'discord', 'twitter', 'instagram'] as const
type ContactChannel = (typeof CONTACT_CHANNELS)[number]

const { text } = useLanguage()

const signedIn = ref(false)
const authSubscription = supabase?.auth.onAuthStateChange((_event, session) => {
  signedIn.value = !!session
})

const loading = ref(!!supabase)
const commissionStatus = ref<CommissionStatus | null>(
  supabase ? null : { status: 'open', slotsOpen: 3, slotsTotal: 5 },
)

const commissionType = ref<CommissionType>('Illustration')
const title = ref('')
const description = ref('')
const contactChannel = ref<ContactChannel>('discord')
const contactValue = ref('')
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

const commissionTypeOptions = computed(() =>
  COMMISSION_TYPES.map((typeOption) => ({
    value: typeOption,
    label: text.value.home.commissionTypes[typeOption],
  })),
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
    signedIn.value = Boolean(sessionData.session)
    commissionStatus.value = statusData
  } finally {
    if (active) loading.value = false
  }
})

onUnmounted(() => {
  active = false
  authSubscription?.data.subscription.unsubscribe()
})

function resetForm() {
  commissionType.value = 'Illustration'
  title.value = ''
  description.value = ''
  contactChannel.value = 'discord'
  contactValue.value = ''
  tosAccepted.value = false
  formError.value = ''
  submitted.value = false
}

async function submitRequest() {
  if (submitting.value || !canAccess.value) return
  formError.value = ''

  const trimmedTitle = title.value.trim()
  const trimmedDescription = description.value.trim()
  const trimmedContact = contactValue.value.trim()

  if (!trimmedTitle || !trimmedDescription || !trimmedContact) {
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
      const { error } = await supabase.rpc('submit_commission_request', {
        p_commission_type: commissionType.value,
        p_title: trimmedTitle,
        p_description: trimmedDescription,
        p_contact_channel: contactChannel.value,
        p_contact_value: trimmedContact,
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
    <section class="mx-auto w-full max-w-3xl py-12 sm:py-16" aria-labelledby="page-title">
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
      <p class="mt-4 text-base leading-7 text-zinc-600 sm:text-lg dark:text-zinc-300">
        {{ text.request.description }}
      </p>

      <div
        v-if="loading"
        class="mt-8 h-96 w-full animate-pulse rounded-2xl border border-zinc-200 bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900"
        aria-hidden="true"
      />

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
            @click="resetForm"
          >
            {{ text.request.submitAnother }}
          </button>
        </div>
      </div>

      <form
        v-else
        class="surface-shadow mt-8 space-y-5 rounded-2xl border border-zinc-200 bg-white p-6 sm:p-8 dark:border-zinc-800 dark:bg-zinc-900"
        @submit.prevent="submitRequest"
      >
        <p
          v-if="signedIn && commissionStatus?.status === 'closed'"
          class="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200"
        >
          {{ text.request.adminClosedNotice }}
        </p>

        <div>
          <label for="request-type" class="block text-sm text-zinc-800 dark:text-zinc-200">
            {{ text.request.typeLabel }}
          </label>
          <SelectField
            id="request-type"
            v-model="commissionType"
            :options="commissionTypeOptions"
            size="lg"
          />
        </div>

        <div>
          <label for="request-title" class="block text-sm text-zinc-800 dark:text-zinc-200">
            {{ text.request.titleLabel }}
          </label>
          <input
            id="request-title"
            v-model="title"
            type="text"
            maxlength="120"
            required
            :placeholder="text.request.titlePlaceholder"
            :class="fieldClass"
          />
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
          <RouterLink
            to="/commission"
            class="inline-flex min-h-11 items-center gap-2 rounded-xl border border-zinc-300 px-4 py-2 text-sm text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            <ArrowLeft :size="16" aria-hidden="true" />
            <span>{{ text.request.backToBoard }}</span>
          </RouterLink>
          <button
            type="submit"
            :disabled="submitting"
            class="inline-flex min-h-11 items-center justify-center rounded-xl bg-zinc-900 px-6 py-2.5 text-sm text-white transition-colors hover:bg-zinc-700 disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
          >
            {{ submitting ? text.request.submitting : text.request.submit }}
          </button>
        </div>
      </form>

      <TosDialog v-model:open="tosDialogOpen" @agree="tosAccepted = true" />
    </section>
  </main>
</template>
