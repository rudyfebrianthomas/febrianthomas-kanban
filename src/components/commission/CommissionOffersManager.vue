<script setup lang="ts">
import { Pencil, Plus, Trash2, X } from '@lucide/vue'
import { motion, useReducedMotion } from 'motion-v'
import {
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogOverlay,
  DialogPortal,
  DialogRoot,
  DialogTitle,
} from 'reka-ui'
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useLanguage } from '../../composables/useLanguage'
import {
  type CommissionOffer,
  type CommissionOfferRow,
  DEFAULT_COMMISSION_OFFERS,
  fetchCommissionOffers,
  formatOfferPrice,
  toCommissionOffer,
} from '../../lib/commissionOffers'
import { COMMISSION_TYPES, type CommissionType } from '../../lib/commissionStatus'
import { uploadKanbanImage } from '../../lib/kanbanImage'
import { supabase } from '../../lib/supabase'
import ConfirmDialog from '../ui/ConfirmDialog.vue'
import ImageUploadField from '../ui/ImageUploadField.vue'
import SelectField from '../ui/SelectField.vue'

const { language, text } = useLanguage()
const reducedMotion = useReducedMotion()

const offers = ref<CommissionOffer[]>(supabase ? [] : DEFAULT_COMMISSION_OFFERS)
const loading = ref(!!supabase)
const loadError = ref('')
const togglingId = ref('')

const dialogOpen = ref(false)
const editingOffer = ref<CommissionOffer | null>(null)
const typeInput = ref<CommissionType>('Illustration')
const titleInput = ref('')
const priceInput = ref('')
const descriptionInput = ref('')
const openInput = ref(true)
const imageFile = ref<File | null>(null)
const removeExistingImage = ref(false)
const imageError = ref('')
const saving = ref(false)
const formError = ref('')

const commissionTypeOptions = computed(() =>
  COMMISSION_TYPES.map((typeOption) => ({
    value: typeOption,
    label: text.value.home.commissionTypes[typeOption],
  })),
)

onMounted(async () => {
  if (!supabase) return
  try {
    offers.value = await fetchCommissionOffers(true)
  } catch {
    loadError.value = text.value.setting.offers.saveError
  } finally {
    loading.value = false
  }
})

onUnmounted(() => {
  for (const offer of offers.value) {
    if (offer.imageUrl?.startsWith('blob:')) URL.revokeObjectURL(offer.imageUrl)
  }
})

function resetImageState() {
  imageFile.value = null
  removeExistingImage.value = false
  imageError.value = ''
}

function openCreate() {
  editingOffer.value = null
  typeInput.value = 'Illustration'
  titleInput.value = ''
  priceInput.value = ''
  descriptionInput.value = ''
  openInput.value = true
  resetImageState()
  formError.value = ''
  dialogOpen.value = true
}

function openEdit(offer: CommissionOffer) {
  editingOffer.value = offer
  typeInput.value = offer.commissionType
  titleInput.value = offer.title
  priceInput.value = offer.price.replace(/[^0-9.]/g, '')
  descriptionInput.value = offer.description
  openInput.value = offer.isOpen
  resetImageState()
  formError.value = ''
  dialogOpen.value = true
}

function onOpenChange(nextOpen: boolean) {
  if (saving.value) return
  dialogOpen.value = nextOpen
  if (!nextOpen) resetImageState()
}

async function saveOffer() {
  if (saving.value || imageError.value) return
  const title = titleInput.value.trim()
  const rawPrice = String(priceInput.value ?? '').trim()
  const description = descriptionInput.value.trim()
  if (!title || !rawPrice || !description) {
    formError.value = text.value.setting.offers.requiredFields
    return
  }
  const numericPrice = Number(rawPrice)
  if (!/^\d+(\.\d+)?$/.test(rawPrice) || !Number.isFinite(numericPrice) || numericPrice < 0) {
    formError.value = text.value.setting.offers.invalidPrice
    return
  }
  const price = String(numericPrice)

  saving.value = true
  formError.value = ''
  try {
    const editing = editingOffer.value
    if (!supabase) {
      if (editing) {
        const nextUrl = imageFile.value
          ? URL.createObjectURL(imageFile.value)
          : removeExistingImage.value
            ? undefined
            : editing.imageUrl
        if ((imageFile.value || removeExistingImage.value) && editing.imageUrl?.startsWith('blob:')) {
          URL.revokeObjectURL(editing.imageUrl)
        }
        offers.value = offers.value.map((item) =>
          item.id === editing.id
            ? {
                ...item,
                commissionType: typeInput.value,
                title,
                price,
                description,
                imageUrl: nextUrl,
                isOpen: openInput.value,
              }
            : item,
        )
      } else {
        offers.value.push({
          id: crypto.randomUUID(),
          commissionType: typeInput.value,
          title,
          price,
          description,
          imagePath: null,
          imageUrl: imageFile.value ? URL.createObjectURL(imageFile.value) : undefined,
          isOpen: openInput.value,
          sortOrder: offers.value.length + 1,
        })
      }
      dialogOpen.value = false
      resetImageState()
      return
    }

    let uploadedPath: string | null = null
    if (imageFile.value) {
      uploadedPath = await uploadKanbanImage(imageFile.value)
    }

    const selectColumns = 'id,commission_type,title,description,price,image_path,is_open,sort_order'
    if (editing) {
      const oldImagePath = editing.imagePath
      const nextImagePath = uploadedPath ?? (removeExistingImage.value ? null : oldImagePath)
      const { data, error } = await supabase
        .from('commission_offers')
        .update({
          commission_type: typeInput.value,
          title,
          price,
          description,
          image_path: nextImagePath,
          is_open: openInput.value,
        })
        .eq('id', editing.id)
        .select(selectColumns)
        .single()
      if (error || !data) throw error
      if (oldImagePath && (uploadedPath || removeExistingImage.value)) {
        await supabase.storage.from('kanban-images').remove([oldImagePath]).catch(() => {})
      }
      const updated = toCommissionOffer(data as CommissionOfferRow)
      offers.value = offers.value.map((item) => (item.id === updated.id ? updated : item))
    } else {
      const nextSort = offers.value.reduce((max, item) => Math.max(max, item.sortOrder), 0) + 1
      const { data, error } = await supabase
        .from('commission_offers')
        .insert({
          commission_type: typeInput.value,
          title,
          price,
          description,
          image_path: uploadedPath,
          is_open: openInput.value,
          sort_order: nextSort,
        })
        .select(selectColumns)
        .single()
      if (error || !data) throw error
      offers.value.push(toCommissionOffer(data as CommissionOfferRow))
    }
    dialogOpen.value = false
    resetImageState()
  } catch {
    formError.value = text.value.setting.offers.saveError
  } finally {
    saving.value = false
  }
}

async function toggleOpen(offer: CommissionOffer) {
  if (togglingId.value) return
  const nextOpen = !offer.isOpen
  togglingId.value = offer.id
  loadError.value = ''
  try {
    if (supabase) {
      const { error } = await supabase
        .from('commission_offers')
        .update({ is_open: nextOpen })
        .eq('id', offer.id)
      if (error) throw error
    }
    offer.isOpen = nextOpen
  } catch {
    loadError.value = text.value.setting.offers.saveError
  } finally {
    togglingId.value = ''
  }
}

async function deleteOffer(offer: CommissionOffer) {
  if (supabase) {
    const { error } = await supabase.from('commission_offers').delete().eq('id', offer.id)
    if (error) throw error
    if (offer.imagePath) {
      await supabase.storage.from('kanban-images').remove([offer.imagePath]).catch(() => {})
    }
  } else if (offer.imageUrl?.startsWith('blob:')) {
    URL.revokeObjectURL(offer.imageUrl)
  }
  offers.value = offers.value.filter((item) => item.id !== offer.id)
}
</script>

<template>
  <section class="surface-shadow mt-6 rounded-2xl border border-zinc-200 bg-white p-5 sm:p-6 dark:border-zinc-800 dark:bg-zinc-900">
    <div class="flex flex-wrap items-start justify-between gap-4">
      <div>
        <h2 class="text-lg font-bold text-zinc-950 dark:text-zinc-50">
          {{ text.setting.offers.title }}
        </h2>
        <p class="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          {{ text.setting.offers.description }}
        </p>
      </div>
      <button
        type="button"
        class="inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-zinc-900 px-3.5 py-2 text-xs text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        @click="openCreate"
      >
        <Plus :size="14" aria-hidden="true" />
        <span>{{ text.setting.offers.addOffer }}</span>
      </button>
    </div>

    <p v-if="loadError" role="alert" class="mt-3 text-sm text-red-700 dark:text-red-400">
      {{ loadError }}
    </p>

    <div v-if="loading" class="mt-4 h-24 animate-pulse rounded-xl bg-zinc-100 dark:bg-zinc-800" />

    <p
      v-else-if="offers.length === 0"
      class="mt-4 rounded-xl border border-dashed border-zinc-300 px-4 py-6 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400"
    >
      {{ text.setting.offers.empty }}
    </p>

    <ul v-else class="mt-4 divide-y divide-zinc-200 rounded-xl border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
      <li
        v-for="offer in offers"
        :key="offer.id"
        class="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
      >
        <div class="flex min-w-0 flex-1 items-center gap-3">
          <img
            v-if="offer.imageUrl"
            :src="offer.imageUrl"
            :alt="offer.title"
            class="size-12 shrink-0 rounded-lg bg-zinc-100 object-cover dark:bg-zinc-800"
          />
          <div class="min-w-0 flex-1">
            <div class="flex flex-wrap items-center gap-2">
              <span class="text-sm font-medium text-zinc-950 dark:text-zinc-50">{{ offer.title }}</span>
              <span class="rounded-full bg-orange-100 px-2.5 py-0.5 text-xs font-medium text-orange-800 dark:bg-orange-950/60 dark:text-orange-200">
                {{ formatOfferPrice(offer.price, language) }}
              </span>
              <span class="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                {{ text.home.commissionTypes[offer.commissionType] }}
              </span>
            </div>
            <p class="mt-0.5 truncate text-xs text-zinc-500 dark:text-zinc-400">{{ offer.description }}</p>
          </div>
        </div>

        <div class="flex shrink-0 items-center gap-2">
          <button
            type="button"
            role="switch"
            :aria-checked="offer.isOpen"
            :disabled="togglingId === offer.id"
            :class="[
              'min-h-8 rounded-full px-3 py-1 text-xs font-medium transition-colors disabled:opacity-50',
              offer.isOpen
                ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-200'
                : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300',
            ]"
            @click="toggleOpen(offer)"
          >
            {{ offer.isOpen ? text.setting.offers.openBadge : text.setting.offers.closedBadge }}
          </button>

          <button
            type="button"
            :aria-label="`${text.setting.offers.editOffer}: ${offer.title}`"
            :title="text.setting.offers.editOffer"
            class="flex size-8 items-center justify-center rounded-lg text-zinc-600 hover:bg-zinc-100 hover:text-zinc-950 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-zinc-50"
            @click="openEdit(offer)"
          >
            <Pencil :size="14" aria-hidden="true" />
          </button>

          <ConfirmDialog
            :title="text.setting.offers.deleteTitle"
            :description="text.setting.offers.deleteDescription"
            :cancel-label="text.login.cancel"
            :confirm-label="text.setting.offers.deleteOffer"
            :pending-label="text.setting.offers.deleting"
            :error-message="text.setting.offers.deleteError"
            :on-confirm="() => deleteOffer(offer)"
          >
            <button
              type="button"
              :aria-label="`${text.setting.offers.deleteOffer}: ${offer.title}`"
              :title="text.setting.offers.deleteOffer"
              class="flex size-8 items-center justify-center rounded-lg text-red-700 hover:bg-red-50 dark:text-red-300 dark:hover:bg-red-950"
            >
              <Trash2 :size="14" aria-hidden="true" />
            </button>
          </ConfirmDialog>
        </div>
      </li>
    </ul>

    <DialogRoot :open="dialogOpen" @update:open="onOpenChange">
      <DialogPortal>
        <DialogOverlay class="fixed inset-0 z-50 bg-black/45 backdrop-blur-[2px]" />
        <DialogContent
          class="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 outline-none"
        >
          <motion.div
            data-lenis-prevent
            :initial="reducedMotion ? false : { opacity: 0, scale: 0.96 }"
            :animate="{ opacity: 1, scale: 1 }"
            :transition="reducedMotion ? { duration: 0 } : { duration: 0.16, ease: 'easeOut' }"
            class="surface-shadow max-h-[85dvh] overflow-y-auto rounded-2xl border border-zinc-200 bg-white p-6 text-zinc-950 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
          >
            <div class="flex items-start justify-between gap-4">
              <div>
                <DialogTitle class="text-lg font-bold">
                  {{ editingOffer ? text.setting.offers.editTitle : text.setting.offers.createTitle }}
                </DialogTitle>
                <DialogDescription class="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                  {{ editingOffer ? text.setting.offers.editDescription : text.setting.offers.createDescription }}
                </DialogDescription>
              </div>
              <DialogClose as-child>
                <button
                  type="button"
                  :disabled="saving"
                  :aria-label="text.setting.close"
                  class="inline-flex size-9 items-center justify-center rounded-lg text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 disabled:opacity-50 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
                >
                  <X class="size-4" aria-hidden="true" />
                </button>
              </DialogClose>
            </div>

            <form class="mt-5 space-y-4" @submit.prevent="saveOffer">
              <div class="grid gap-4 sm:grid-cols-2">
                <div>
                  <label for="offer-type" class="mb-1.5 block text-sm text-zinc-800 dark:text-zinc-200">
                    {{ text.home.commissionTypeLabel }}
                  </label>
                  <SelectField
                    id="offer-type"
                    v-model="typeInput"
                    :options="commissionTypeOptions"
                  />
                </div>
                <div>
                  <label for="offer-price" class="mb-1.5 block text-sm text-zinc-800 dark:text-zinc-200">
                    {{ text.setting.offers.priceLabel }}
                  </label>
                  <input
                    id="offer-price"
                    v-model="priceInput"
                    type="number"
                    min="0"
                    step="any"
                    inputmode="decimal"
                    required
                    :placeholder="text.setting.offers.pricePlaceholder"
                    class="min-h-11 w-full rounded-xl border border-zinc-300 bg-white px-4 text-sm text-zinc-950 outline-none focus:ring-2 focus:ring-zinc-900 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-50 dark:focus:ring-zinc-300"
                  />
                </div>
              </div>

              <div>
                <label for="offer-title" class="mb-1.5 block text-sm text-zinc-800 dark:text-zinc-200">
                  {{ text.setting.titleLabel }}
                </label>
                <input
                  id="offer-title"
                  v-model="titleInput"
                  type="text"
                  maxlength="120"
                  required
                  class="min-h-11 w-full rounded-xl border border-zinc-300 bg-white px-4 text-sm text-zinc-950 outline-none focus:ring-2 focus:ring-zinc-900 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-50 dark:focus:ring-zinc-300"
                />
              </div>

              <div>
                <label for="offer-description" class="mb-1.5 block text-sm text-zinc-800 dark:text-zinc-200">
                  {{ text.home.descriptionLabel }}
                </label>
                <textarea
                  id="offer-description"
                  v-model="descriptionInput"
                  rows="3"
                  maxlength="240"
                  required
                  class="w-full rounded-xl border border-zinc-300 bg-white px-4 py-2.5 text-sm text-zinc-950 outline-none focus:ring-2 focus:ring-zinc-900 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-50 dark:focus:ring-zinc-300"
                />
              </div>

              <ImageUploadField
                v-model:file="imageFile"
                v-model:removed="removeExistingImage"
                v-model:error="imageError"
                id-prefix="offer-example"
                :label="text.setting.offers.exampleImageLabel"
                :existing-url="editingOffer?.imageUrl"
              />

              <label class="inline-flex cursor-pointer items-center gap-2.5 text-sm text-zinc-800 dark:text-zinc-200">
                <input
                  v-model="openInput"
                  type="checkbox"
                  class="size-4 cursor-pointer rounded border-zinc-300 accent-zinc-900 dark:border-zinc-600 dark:accent-zinc-100"
                />
                <span>{{ text.setting.offers.openToggle }}</span>
              </label>

              <p
                v-if="formError"
                role="alert"
                class="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300"
              >
                {{ formError }}
              </p>

              <div class="flex justify-end gap-2 pt-1">
                <DialogClose as-child>
                  <button
                    type="button"
                    :disabled="saving"
                    class="inline-flex min-h-11 items-center justify-center rounded-xl border border-zinc-300 px-4 py-2 text-sm text-zinc-700 transition-colors hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                  >
                    {{ text.setting.close }}
                  </button>
                </DialogClose>
                <button
                  type="submit"
                  :disabled="saving"
                  class="inline-flex min-h-11 items-center justify-center rounded-xl bg-zinc-900 px-4 py-2 text-sm text-white transition-colors hover:bg-zinc-700 disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
                >
                  {{ saving ? text.setting.savingChanges : text.setting.saveChanges }}
                </button>
              </div>
            </form>
          </motion.div>
        </DialogContent>
      </DialogPortal>
    </DialogRoot>
  </section>
</template>
