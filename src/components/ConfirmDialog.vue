<script setup lang="ts">
import {
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogOverlay,
  AlertDialogPortal,
  AlertDialogRoot,
  AlertDialogTitle,
  AlertDialogTrigger,
} from 'reka-ui'
import { motion, useReducedMotion } from 'motion-v'
import { ref } from 'vue'

const props = defineProps<{
  title: string
  description: string
  cancelLabel: string
  confirmLabel: string
  pendingLabel: string
  errorMessage: string
  onConfirm: () => Promise<void>
}>()

const open = ref(false)
const pending = ref(false)
const error = ref('')
const reducedMotion = useReducedMotion()

function onOpenChange(nextOpen: boolean) {
  if (pending.value) return
  open.value = nextOpen
  error.value = ''
}

async function confirm() {
  pending.value = true
  error.value = ''
  try {
    await props.onConfirm()
    open.value = false
  } catch {
    error.value = props.errorMessage
  } finally {
    pending.value = false
  }
}
</script>

<template>
  <AlertDialogRoot :open="open" @update:open="onOpenChange">
    <AlertDialogTrigger as-child>
      <slot />
    </AlertDialogTrigger>
    <AlertDialogPortal>
      <AlertDialogOverlay class="fixed inset-0 z-60 bg-zinc-950/50" />
      <div class="pointer-events-none fixed inset-0 z-70 flex items-center justify-center p-6">
        <AlertDialogContent as-child>
          <motion.div
            :initial="reducedMotion ? false : { opacity: 0, scale: 0.96, y: 8 }"
            :animate="{ opacity: 1, scale: 1, y: 0 }"
            :transition="{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }"
            class="surface-shadow pointer-events-auto w-full max-w-sm rounded-3xl bg-white p-7 text-zinc-950 focus:outline-none dark:bg-zinc-900 dark:text-zinc-50"
          >
            <AlertDialogTitle class="text-3xl font-bold">{{ title }}</AlertDialogTitle>
            <AlertDialogDescription class="mt-3 leading-6 text-zinc-600 dark:text-zinc-300">{{ description }}</AlertDialogDescription>
            <p v-if="error" role="alert" class="mt-4 text-sm text-red-700 dark:text-red-400">{{ error }}</p>
            <div class="mt-7 flex flex-wrap justify-end gap-3">
              <AlertDialogCancel :disabled="pending" class="min-h-11 rounded-full px-5 text-sm hover:bg-zinc-100 focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50 dark:hover:bg-zinc-800">{{ cancelLabel }}</AlertDialogCancel>
              <button type="button" :disabled="pending" class="min-h-11 rounded-full bg-zinc-900 px-5 text-sm text-white hover:bg-zinc-700 focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300" @click="confirm">
                {{ pending ? pendingLabel : confirmLabel }}
              </button>
            </div>
          </motion.div>
        </AlertDialogContent>
      </div>
    </AlertDialogPortal>
  </AlertDialogRoot>
</template>
