<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { FileText, Plus, Search, X } from '@lucide/vue'
import { motion, useReducedMotion } from 'motion-v'
import {
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogOverlay,
  DialogPortal,
  DialogRoot,
  DialogTitle,
  DialogTrigger,
} from 'reka-ui'
import { useLanguage } from '../composables/useLanguage'
import { supabase } from '../supabase'

interface KanbanBoard {
  id: string
  title: string
  description: string | null
  is_active: boolean
  created_at?: string
}

const { text } = useLanguage()
const router = useRouter()
const prefersReducedMotion = useReducedMotion()

const boards = ref<KanbanBoard[]>([])
const loading = ref(true)
const loadError = ref('')
const query = ref('')

const dialogOpen = ref(false)
const titleInput = ref('')
const descriptionInput = ref('')
const saving = ref(false)
const formError = ref('')

const filteredBoards = computed(() => {
  const q = query.value.trim().toLowerCase()
  if (!q) return boards.value
  return boards.value.filter(
    (board) =>
      board.title.toLowerCase().includes(q) ||
      (board.description?.toLowerCase().includes(q) ?? false),
  )
})

const subscription = supabase?.auth.onAuthStateChange((_event, session) => {
  if (!session) void router.replace('/')
})

onMounted(() => {
  void loadBoards()
})

onUnmounted(() => subscription?.data.subscription.unsubscribe())

async function loadBoards() {
  loading.value = true
  loadError.value = ''

  if (!supabase) {
    loading.value = false
    return
  }

  const { data, error } = await supabase
    .from('kanban_boards')
    .select('id,title,description,is_active,created_at')
    .order('created_at', { ascending: false })

  if (error) {
    loadError.value = error.message
  } else {
    boards.value = (data ?? []) as KanbanBoard[]
  }
  loading.value = false
}

function onDialogOpenChange(open: boolean) {
  dialogOpen.value = open
  if (!open) {
    titleInput.value = ''
    descriptionInput.value = ''
    formError.value = ''
  }
}

async function handleCreateBoard() {
  const trimmedTitle = titleInput.value.trim()
  if (!trimmedTitle) {
    formError.value = text.value.setting.requiredTitle
    return
  }

  const trimmedDescription = descriptionInput.value.trim()
  saving.value = true
  formError.value = ''

  if (!supabase) {
    boards.value = [
      {
        id: crypto.randomUUID(),
        title: trimmedTitle,
        description: trimmedDescription || null,
        is_active: false,
      },
      ...boards.value,
    ]
    saving.value = false
    onDialogOpenChange(false)
    return
  }

  const { data, error } = await supabase
    .from('kanban_boards')
    .insert({
      title: trimmedTitle,
      description: trimmedDescription || null,
      is_active: false,
    })
    .select('id,title,description,is_active,created_at')
    .single()

  saving.value = false

  if (error || !data) {
    formError.value = error?.message || text.value.setting.saveBoardError
    return
  }

  boards.value = [data as KanbanBoard, ...boards.value]
  onDialogOpenChange(false)
}
</script>

<template>
  <main class="flex flex-1 flex-col px-6 sm:px-10">
    <section
      class="mx-auto flex w-full max-w-6xl flex-1 flex-col py-12 sm:py-16"
      aria-labelledby="page-title"
    >
      <div class="flex flex-wrap items-end justify-between gap-4">
        <div class="max-w-3xl">
          <p class="mb-4 text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
            {{ text.setting.eyebrow }}
          </p>
          <h1
            id="page-title"
            class="font-bagel-fat-one text-5xl leading-[1.05] tracking-tight text-zinc-950 sm:text-7xl dark:text-zinc-50"
          >
            {{ text.setting.title }}
          </h1>
          <p class="mt-4 text-base leading-7 text-zinc-600 sm:text-lg dark:text-zinc-300">
            {{ text.setting.description }}
          </p>
        </div>

        <DialogRoot :open="dialogOpen" @update:open="onDialogOpenChange">
          <DialogTrigger as-child>
            <button
              type="button"
              class="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300 dark:focus-visible:ring-zinc-300"
            >
              <Plus class="size-4" aria-hidden="true" />
              {{ text.setting.addBoard }}
            </button>
          </DialogTrigger>

          <DialogPortal>
            <DialogOverlay class="fixed inset-0 z-50 bg-black/45 backdrop-blur-[2px]" />
            <DialogContent
              class="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 outline-none"
            >
              <motion.div
                data-lenis-prevent
                :initial="prefersReducedMotion ? false : { opacity: 0, scale: 0.96 }"
                :animate="{ opacity: 1, scale: 1 }"
                :transition="prefersReducedMotion ? { duration: 0 } : { duration: 0.16, ease: 'easeOut' }"
                class="surface-shadow max-h-[85dvh] overflow-y-auto rounded-2xl border border-zinc-200 bg-white p-6 text-zinc-950 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
              >
                <div class="flex items-start justify-between gap-4">
                  <div>
                    <DialogTitle class="text-lg font-semibold">
                      {{ text.setting.createBoardTitle }}
                    </DialogTitle>
                    <DialogDescription class="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                      {{ text.setting.createBoardDescription }}
                    </DialogDescription>
                  </div>
                  <DialogClose as-child>
                    <button
                      type="button"
                      :aria-label="text.setting.close"
                      class="inline-flex size-9 items-center justify-center rounded-lg text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
                    >
                      <X class="size-4" aria-hidden="true" />
                    </button>
                  </DialogClose>
                </div>

                <form class="mt-5 space-y-4" @submit.prevent="handleCreateBoard">
                  <div>
                    <label
                      for="board-title"
                      class="mb-1.5 block text-sm font-medium text-zinc-800 dark:text-zinc-200"
                    >
                      {{ text.setting.titleLabel }}
                    </label>
                    <input
                      id="board-title"
                      v-model="titleInput"
                      type="text"
                      maxlength="120"
                      required
                      class="min-h-11 w-full rounded-xl border border-zinc-300 bg-white px-4 text-sm text-zinc-950 outline-none focus:ring-2 focus:ring-zinc-900 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-50 dark:focus:ring-zinc-300"
                    />
                  </div>

                  <div>
                    <label
                      for="board-description"
                      class="mb-1.5 block text-sm font-medium text-zinc-800 dark:text-zinc-200"
                    >
                      {{ text.setting.descriptionLabel }}
                    </label>
                    <textarea
                      id="board-description"
                      v-model="descriptionInput"
                      rows="3"
                      maxlength="240"
                      class="w-full rounded-xl border border-zinc-300 bg-white px-4 py-2.5 text-sm text-zinc-950 outline-none focus:ring-2 focus:ring-zinc-900 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-50 dark:focus:ring-zinc-300"
                    />
                  </div>

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
                        class="inline-flex min-h-11 items-center justify-center rounded-xl border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                      >
                        {{ text.setting.close }}
                      </button>
                    </DialogClose>
                    <button
                      type="submit"
                      :disabled="saving"
                      class="inline-flex min-h-11 items-center justify-center rounded-xl bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
                    >
                      {{ saving ? text.setting.savingBoard : text.setting.submitBoard }}
                    </button>
                  </div>
                </form>
              </motion.div>
            </DialogContent>
          </DialogPortal>
        </DialogRoot>
      </div>

      <form class="mt-8" role="search" @submit.prevent>
        <label for="board-search" class="sr-only">{{ text.setting.searchBoards }}</label>
        <div class="relative">
          <Search
            class="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-zinc-400"
            aria-hidden="true"
          />
          <input
            id="board-search"
            v-model="query"
            type="search"
            :placeholder="text.setting.searchBoardsPlaceholder"
            class="min-h-11 w-full rounded-xl border border-zinc-300 bg-white pl-11 pr-4 text-sm text-zinc-950 outline-none placeholder:text-zinc-400 focus:ring-2 focus:ring-zinc-900 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-50 dark:placeholder:text-zinc-500 dark:focus:ring-zinc-300"
          />
        </div>
      </form>

      <div class="mt-6">
        <p
          v-if="loadError"
          role="alert"
          class="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300"
        >
          {{ loadError }}
        </p>

        <div v-else-if="loading" class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div
            v-for="n in 3"
            :key="n"
            class="h-28 animate-pulse rounded-2xl border border-zinc-200 bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900"
          />
        </div>

        <div
          v-else-if="boards.length === 0"
          class="mx-auto flex min-h-72 flex-col items-center justify-center px-6 py-12 text-center"
        >
          <span
            aria-hidden="true"
            class="flex size-16 items-center justify-center rounded-2xl bg-orange-100 text-orange-700 dark:bg-zinc-800 dark:text-orange-300"
          >
            <FileText :size="30" />
          </span>
          <h2 class="mt-6 font-sniglet text-3xl text-zinc-950 dark:text-zinc-50">
            {{ text.setting.emptyTitle }}
          </h2>
          <p class="mt-3 max-w-sm leading-7 text-zinc-600 dark:text-zinc-300">
            {{ text.setting.emptyDescription }}
          </p>
        </div>

        <p
          v-else-if="filteredBoards.length === 0"
          class="rounded-2xl border border-dashed border-zinc-300 px-6 py-10 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400"
        >
          {{ text.setting.noSearchResults }}
        </p>

        <ul v-else class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <li
            v-for="board in filteredBoards"
            :key="board.id"
            class="surface-shadow rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900"
          >
            <div class="flex items-start justify-between gap-2">
              <h2 class="text-base font-semibold text-zinc-950 dark:text-zinc-50">
                {{ board.title }}
              </h2>
              <span
                v-if="board.is_active"
                class="shrink-0 rounded-full bg-orange-500/15 px-2.5 py-0.5 text-xs font-medium text-orange-600 dark:bg-orange-400/15 dark:text-orange-300"
              >
                {{ text.setting.activeBadge }}
              </span>
            </div>
            <p
              v-if="board.description"
              class="mt-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400"
            >
              {{ board.description }}
            </p>
          </li>
        </ul>
      </div>
    </section>
  </main>
</template>
