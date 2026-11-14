<script setup lang="ts">
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
import { motion, useReducedMotion } from 'motion-v'
import { ref } from 'vue'
import LoadingIndicator from './LoadingIndicator.vue'

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
  <DialogRoot :open="isControlled() ? open : internalOpen" @update:open="onOpenChange">
    <DialogTrigger v-if="$slots.default" as-child>
      <slot />
    </DialogTrigger>
    <DialogPortal>
      <DialogOverlay class="fixed inset-0 z-70 bg-zinc-950/50" />
      <DialogContent
        role="alertdialog"
        class="fixed left-1/2 top-1/2 z-80 w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 outline-none"
      >
        <motion.div
          :initial="reducedMotion ? false : { opacity: 0, scale: 0.96, y: 8 }"
          :animate="{ opacity: 1, scale: 1, y: 0 }"
          :transition="{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }"
          class="surface-shadow rounded-3xl bg-white p-7 text-zinc-950 focus:outline-none dark:bg-zinc-900 dark:text-zinc-50"
        >
          <DialogTitle class="text-3xl font-bold">{{ title }}</DialogTitle>
          <DialogDescription class="mt-3 leading-6 text-zinc-600 dark:text-zinc-300">
            {{ description }}
          </DialogDescription>
          <p v-if="error" role="alert" class="mt-4 text-sm text-red-700 dark:text-red-400">
            {{ error }}
          </p>
          <div class="mt-7 flex flex-wrap justify-end gap-3">
            <DialogClose as-child>
              <button
                type="button"
                :disabled="pending"
                class="inline-flex min-h-11 items-center justify-center rounded-full px-5 text-sm transition-colors hover:bg-zinc-100 focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50 dark:hover:bg-zinc-800"
              >
                {{ cancelLabel }}
              </button>
            </DialogClose>
            <motion.button
              type="button"
              :disabled="pending"
              :while-tap="reducedMotion ? undefined : { scale: 0.98 }"
              :transition="{ duration: 0.14 }"
              class="inline-flex min-h-11 items-center justify-center rounded-full bg-zinc-900 px-5 text-sm text-white transition-colors hover:bg-zinc-700 focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
              @click="confirm"
            >
              <LoadingIndicator v-if="pending" :label="pendingLabel" />
              <template v-else>{{ confirmLabel }}</template>
            </motion.button>
          </div>
        </motion.div>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>
