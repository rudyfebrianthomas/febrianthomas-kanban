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

const props = withDefaults(
  defineProps<{
    open: boolean
    title?: string
    description?: string
    closeLabel: string
    closeDisabled?: boolean
    maxWidthClass?: string
    overlayClass?: string
    contentClass?: string
    descriptionClass?: string
  }>(),
  {
    title: '',
    description: '',
    closeDisabled: false,
    maxWidthClass: 'max-w-lg',
    overlayClass: 'z-60',
    contentClass: 'z-70',
    descriptionClass: 'mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-400',
  },
)

const emit = defineEmits<{
  'update:open': [value: boolean]
}>()

const reducedMotion = useReducedMotion()

function handleOpenChange(nextOpen: boolean) {
  if (props.closeDisabled) return
  emit('update:open', nextOpen)
}
</script>

<template>
  <DialogRoot :open="open" @update:open="handleOpenChange">
    <DialogPortal>
      <DialogOverlay :class="['fixed inset-0 bg-zinc-950/50', overlayClass]" />
      <DialogContent
        :class="[
          'fixed left-1/2 top-1/2 w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 outline-hidden',
          maxWidthClass,
          contentClass,
        ]"
      >
        <motion.div
          data-lenis-prevent
          :initial="reducedMotion ? false : { opacity: 0, scale: 0.97, y: 8 }"
          :animate="{ opacity: 1, scale: 1, y: 0 }"
          :transition="{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }"
          class="surface-shadow max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-3xl bg-white p-6 text-zinc-950 focus:outline-hidden sm:p-8 dark:bg-zinc-900 dark:text-zinc-50"
        >
          <div class="flex items-start justify-between gap-4">
            <div class="min-w-0 flex-1">
              <slot name="header">
                <DialogTitle class="text-2xl font-bold tracking-tight sm:text-3xl">
                  {{ title }}
                </DialogTitle>
                <DialogDescription v-if="description" :class="descriptionClass">
                  {{ description }}
                </DialogDescription>
              </slot>
            </div>
            <DialogClose as-child>
              <button
                type="button"
                :disabled="closeDisabled"
                :aria-label="closeLabel"
                class="flex size-11 shrink-0 items-center justify-center rounded-xl hover:bg-zinc-100 focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50 dark:hover:bg-zinc-800"
              >
                <X :size="20" aria-hidden="true" />
              </button>
            </DialogClose>
          </div>

          <slot />
        </motion.div>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>
