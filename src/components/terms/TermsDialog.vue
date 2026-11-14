<script setup lang="ts">
import { DialogClose } from 'reka-ui'
import { useLanguage } from '../../composables/useLanguage'
import BaseDialog from '../ui/BaseDialog.vue'
import MotionButton from '../ui/MotionButton.vue'
import TermsSections from './TermsSections.vue'

const open = defineModel<boolean>('open', { required: true })

const emit = defineEmits<{
  agree: []
}>()

const { text } = useLanguage()

function acceptAndClose() {
  emit('agree')
  open.value = false
}
</script>

<template>
  <BaseDialog
    :open="open"
    :title="text.tos.title"
    :description="text.tos.updated"
    :close-label="text.home.close"
    max-width-class="max-w-2xl"
    overlay-class="z-80"
    content-class="z-90"
    description-class="mt-2 text-sm text-zinc-600 dark:text-zinc-400"
    @update:open="open = $event"
  >
    <p class="mt-3 text-sm leading-6 text-zinc-600 dark:text-zinc-300">
      {{ text.tos.intro }}
    </p>

    <TermsSections compact class="mt-4" />

    <div class="mt-6 flex flex-wrap justify-end gap-2">
      <DialogClose as-child>
        <button
          type="button"
          class="inline-flex min-h-11 items-center justify-center rounded-xl border border-zinc-300 px-4 py-2 text-sm text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          {{ text.home.close }}
        </button>
      </DialogClose>
      <MotionButton
        type="button"
        class="min-h-11 px-5 py-2"
        @click="acceptAndClose"
      >
        {{ text.request.tosAgreeAndClose }}
      </MotionButton>
    </div>
  </BaseDialog>
</template>
