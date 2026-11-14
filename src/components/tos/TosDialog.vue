<script setup lang="ts">
import { X } from '@lucide/vue'
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
import { useLanguage } from '../../composables/useLanguage'
import TosSections from './TosSections.vue'

const open = defineModel<boolean>('open', { required: true })

const emit = defineEmits<{
  agree: []
}>()

const { text } = useLanguage()
const reducedMotion = useReducedMotion()

function acceptAndClose() {
  emit('agree')
  open.value = false
}
</script>

<template>
  <DialogRoot v-model:open="open">
    <DialogPortal>
      <DialogOverlay class="fixed inset-0 z-50 bg-black/45 backdrop-blur-[2px]" />
      <DialogContent
        class="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-2xl -translate-x-1/2 -translate-y-1/2 outline-none"
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
              <DialogTitle class="text-xl font-bold text-zinc-950 dark:text-zinc-50">
                {{ text.tos.title }}
              </DialogTitle>
              <DialogDescription class="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                {{ text.tos.updated }}
              </DialogDescription>
            </div>
            <DialogClose as-child>
              <button
                type="button"
                :aria-label="text.home.close"
                class="inline-flex size-9 items-center justify-center rounded-lg text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
              >
                <X class="size-4" aria-hidden="true" />
              </button>
            </DialogClose>
          </div>

          <p class="mt-3 text-sm leading-6 text-zinc-600 dark:text-zinc-300">
            {{ text.tos.intro }}
          </p>

          <TosSections compact class="mt-4" />

          <div class="mt-6 flex flex-wrap justify-end gap-2">
            <DialogClose as-child>
              <button
                type="button"
                class="inline-flex min-h-11 items-center justify-center rounded-xl border border-zinc-300 px-4 py-2 text-sm text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                {{ text.home.close }}
              </button>
            </DialogClose>
            <button
              type="button"
              class="inline-flex min-h-11 items-center justify-center rounded-xl bg-zinc-900 px-5 py-2 text-sm text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
              @click="acceptAndClose"
            >
              {{ text.request.tosAgreeAndClose }}
            </button>
          </div>
        </motion.div>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>
