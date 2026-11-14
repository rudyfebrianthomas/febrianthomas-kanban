<script setup lang="ts">
import { UploadCloud } from '@lucide/vue'
import { computed, onUnmounted, ref, watch } from 'vue'
import { useLanguage } from '../../composables/useLanguage'
import { kanbanImageExtension } from '../../lib/kanbanImage'

const props = withDefaults(
  defineProps<{
    idPrefix: string
    label: string
    existingUrl?: string
  }>(),
  {
    existingUrl: '',
  },
)

const file = defineModel<File | null>('file', { default: null })
const removed = defineModel<boolean>('removed', { default: false })
const error = defineModel<string>('error', { default: '' })

const { text } = useLanguage()
const previewUrl = ref('')
const dragging = ref(false)
const fileInput = ref<HTMLInputElement | null>(null)

const activePreviewUrl = computed(() => {
  if (file.value && previewUrl.value) return previewUrl.value
  if (props.existingUrl && !removed.value) return props.existingUrl
  return ''
})

function revokePreview() {
  if (previewUrl.value) {
    URL.revokeObjectURL(previewUrl.value)
    previewUrl.value = ''
  }
}

watch(file, (nextFile) => {
  if (!nextFile) {
    revokePreview()
    if (fileInput.value) fileInput.value.value = ''
  }
})

onUnmounted(revokePreview)

function selectFile(nextFile: File | null) {
  revokePreview()
  if (nextFile && !kanbanImageExtension(nextFile)) {
    file.value = null
    if (fileInput.value) fileInput.value.value = ''
    error.value = text.value.home.imageInvalid
    return
  }
  file.value = nextFile
  if (nextFile) {
    previewUrl.value = URL.createObjectURL(nextFile)
    removed.value = false
  }
  error.value = ''
}

function onFileChange(event: Event) {
  const input = event.target as HTMLInputElement
  selectFile(input.files?.[0] ?? null)
}

function onDragEnter(event: DragEvent) {
  if (event.dataTransfer?.types.includes('Files')) dragging.value = true
}

function onDragLeave(event: DragEvent) {
  const currentTarget = event.currentTarget as HTMLElement | null
  const related = event.relatedTarget as Node | null
  if (!related || !currentTarget?.contains(related)) dragging.value = false
}

function onDrop(event: DragEvent) {
  dragging.value = false
  const files = event.dataTransfer?.files
  if (!files || files.length !== 1) {
    selectFile(null)
    error.value = text.value.home.imageSingle
    return
  }
  if (fileInput.value) fileInput.value.value = ''
  selectFile(files[0] ?? null)
}

function clearImage() {
  if (fileInput.value) fileInput.value.value = ''
  selectFile(null)
  if (props.existingUrl) removed.value = true
}
</script>

<template>
  <div>
    <p :id="`${idPrefix}-image-label`" class="block text-sm text-zinc-800 dark:text-zinc-200">
      {{ label }}
    </p>
    <div
      :class="[
        'mt-2 rounded-xl border-2 border-dashed p-5 focus-within:ring-2 focus-within:ring-zinc-900 dark:focus-within:ring-zinc-300',
        dragging ? 'border-orange-500 bg-orange-50 dark:border-orange-400 dark:bg-zinc-800' : 'border-zinc-300 dark:border-zinc-600',
      ]"
      @dragenter.prevent="onDragEnter"
      @dragover.prevent
      @dragleave="onDragLeave"
      @drop.prevent="onDrop"
    >
      <input
        :id="`${idPrefix}-image`"
        ref="fileInput"
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        :aria-labelledby="`${idPrefix}-image-label`"
        :aria-describedby="error ? `${idPrefix}-image-help ${idPrefix}-image-error` : `${idPrefix}-image-help`"
        :aria-invalid="Boolean(error)"
        class="sr-only"
        @change="onFileChange"
      />
      <div class="flex flex-wrap items-center gap-3">
        <UploadCloud :size="22" aria-hidden="true" class="text-zinc-500 dark:text-zinc-400" />
        <label
          :for="`${idPrefix}-image`"
          class="cursor-pointer rounded-xl bg-zinc-100 px-4 py-2 text-sm text-zinc-900 hover:bg-zinc-200 dark:bg-zinc-700 dark:text-zinc-50 dark:hover:bg-zinc-600"
        >
          {{ text.home.chooseImage }}
        </label>
        <span class="text-sm text-zinc-600 dark:text-zinc-300">{{ text.home.dropImage }}</span>
      </div>

      <img
        v-if="activePreviewUrl"
        :src="activePreviewUrl"
        :alt="text.home.imagePreview"
        class="mt-4 max-h-64 w-full rounded-xl bg-zinc-100 object-contain dark:bg-zinc-800"
      />

      <div v-if="file || error || activePreviewUrl" class="mt-4 flex items-center justify-between gap-3">
        <span role="status" class="min-w-0 wrap-break-words text-sm">{{ file?.name }}</span>
        <button
          type="button"
          class="shrink-0 rounded-xl px-3 py-2 text-sm underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2"
          @click="clearImage"
        >
          {{ text.home.removeImage }}
        </button>
      </div>
    </div>
    <p :id="`${idPrefix}-image-help`" class="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
      {{ text.home.imageHelp }}
    </p>
    <p v-if="error" :id="`${idPrefix}-image-error`" role="alert" class="mt-2 text-sm text-red-700 dark:text-red-400">
      {{ error }}
    </p>
  </div>
</template>
