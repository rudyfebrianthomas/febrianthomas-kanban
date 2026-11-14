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

const props = withDefaults(
  defineProps<{
    open?: boolean
    title: string
    description: string
    cancelLabel: string
    confirmLabel: string
    pendingLabel: string
    errorMessage: string
    onConfirm: () => Promise<void>
  }>(),
  { open: undefined },
)

const emit = defineEmits<{
  'update:open': [open: boolean]
}>()

const internalOpen = ref(false)
const pending = ref(false)
const error = ref('')
const reducedMotion = useReducedMotion()

function isControlled(): boolean {
  return props.open !== undefined
}

function setOpen(nextOpen: boolean) {
  if (isControlled()) {
    emit('update:open', nextOpen)
  } else {
    internalOpen.value = nextOpen
  }
}

function onOpenChange(nextOpen: boolean) {
  if (pending.value) return
  setOpen(nextOpen)
  if (!nextOpen) error.value = ''
}

async function confirm() {
  pending.value = true
  error.value = ''
  try {
    await props.onConfirm()
    setOpen(false)
  } catch {
    error.value = props.errorMessage
  } finally {
    pending.value = false
  }
}
</script>

<template>
  <AlertDialogRoot :open="isControlled() ? open : internalOpen" @update:open="onOpenChange">
    <AlertDialogTrigger v-if="$slots.default" as-child>
      <slot />
    </AlertDialogTrigger>
    <AlertDialogPortal>
      <AlertDialogOverlay class="fixed inset-0 z-70 bg-black/45 backdrop-blur-[2px]" />
      <div class="pointer-events-none fixed inset-0 z-80 flex items-center justify-center p-6">
        <AlertDialogContent as-child>
          <motion.div
            :initial="reducedMotion ? false : { opacity: 0, scale: 0.96, y: 8 }"
            :animate="{ opacity: 1, scale: 1, y: 0 }"
            :transition="{ duration: 0.16, ease: 'easeOut' }"
            class="surface-shadow pointer-events-auto w-full max-w-sm rounded-2xl border border-zinc-200 bg-white p-6 text-zinc-950 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
          >
            <AlertDialogTitle class="text-xl font-bold">{{ title }}</AlertDialogTitle>
            <AlertDialogDescription class="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-300">
              {{ description }}
            </AlertDialogDescription>
            <p v-if="error" role="alert" class="mt-4 text-sm text-red-700 dark:text-red-400">
              {{ error }}
            </p>
            <div class="mt-6 flex flex-wrap justify-end gap-2">
              <AlertDialogCancel
                :disabled="pending"
                class="inline-flex min-h-11 items-center justify-center rounded-xl border border-zinc-300 px-4 py-2 text-sm text-zinc-700 transition-colors hover:bg-zinc-100 focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                {{ cancelLabel }}
              </AlertDialogCancel>
              <button
                type="button"
                :disabled="pending"
                class="inline-flex min-h-11 items-center justify-center rounded-xl bg-zinc-900 px-4 py-2 text-sm text-white transition-colors hover:bg-zinc-700 focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
                @click="confirm"
              >
                {{ pending ? pendingLabel : confirmLabel }}
              </button>
            </div>
          </motion.div>
        </AlertDialogContent>
      </div>
    </AlertDialogPortal>
  </AlertDialogRoot>
</template>
