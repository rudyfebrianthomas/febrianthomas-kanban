<script setup lang="ts" generic="T extends string">
import { Check, ChevronDown } from '@lucide/vue'
import {
  SelectContent,
  SelectIcon,
  SelectItem,
  SelectItemIndicator,
  SelectItemText,
  SelectPortal,
  SelectRoot,
  SelectTrigger,
  SelectValue,
  SelectViewport,
} from 'reka-ui'
import { computed } from 'vue'

export interface SelectOption<V extends string = string> {
  value: V
  label: string
  dotClass?: string
}

const model = defineModel<T>({ required: true })

const props = withDefaults(
  defineProps<{
    options: readonly SelectOption<T>[]
    id?: string
    ariaLabel?: string
    placeholder?: string
    disabled?: boolean
    required?: boolean
    size?: 'md' | 'lg'
    triggerClass?: string
  }>(),
  {
    size: 'md',
    triggerClass: '',
  },
)

const selectedOption = computed(() => props.options.find((option) => option.value === model.value))
</script>

<template>
  <SelectRoot v-model="model" :disabled="disabled" :required="required">
    <SelectTrigger
      :id="id"
      :aria-label="ariaLabel"
      :class="[
        'group inline-flex w-full cursor-pointer items-center justify-between gap-2.5 rounded-xl border border-zinc-300 bg-white text-left text-zinc-950 outline-none transition-colors hover:border-zinc-400 focus-visible:border-zinc-900 focus-visible:ring-2 focus-visible:ring-zinc-900 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-50 dark:hover:border-zinc-500 dark:focus-visible:border-zinc-300 dark:focus-visible:ring-zinc-300',
        size === 'lg' ? 'mt-2 min-h-12 px-4 py-3 text-base' : 'min-h-11 px-3.5 py-2 text-sm',
        triggerClass,
      ]"
    >
      <span class="flex min-w-0 items-center gap-2 truncate">
        <span
          v-if="selectedOption?.dotClass"
          :class="['size-2 shrink-0 rounded-full', selectedOption.dotClass]"
          aria-hidden="true"
        />
        <SelectValue :placeholder="placeholder" class="truncate" />
      </span>
      <SelectIcon as-child>
        <ChevronDown
          :size="16"
          aria-hidden="true"
          class="shrink-0 text-zinc-500 transition-transform duration-150 group-data-[state=open]:rotate-180 dark:text-zinc-400"
        />
      </SelectIcon>
    </SelectTrigger>

    <SelectPortal>
      <SelectContent
        position="popper"
        :side-offset="6"
        data-lenis-prevent
        class="surface-shadow z-90 max-h-64 min-w-(--reka-select-trigger-width) overflow-y-auto rounded-2xl border border-zinc-200 bg-white p-1.5 text-zinc-950 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
      >
        <SelectViewport class="space-y-0.5">
          <SelectItem
            v-for="option in options"
            :key="option.value"
            :value="option.value"
            class="relative flex cursor-pointer select-none items-center justify-between gap-3 rounded-xl px-3 py-2 text-sm outline-none transition-colors data-highlighted:bg-zinc-100 data-[state=checked]:bg-zinc-100/70 data-[state=checked]:font-medium dark:data-highlighted:bg-zinc-800 dark:data-[state=checked]:bg-zinc-800/70"
          >
            <span class="flex min-w-0 items-center gap-2">
              <span
                v-if="option.dotClass"
                :class="['size-2 shrink-0 rounded-full', option.dotClass]"
                aria-hidden="true"
              />
              <SelectItemText class="truncate">{{ option.label }}</SelectItemText>
            </span>
            <SelectItemIndicator class="shrink-0 text-zinc-900 dark:text-zinc-100">
              <Check :size="14" aria-hidden="true" />
            </SelectItemIndicator>
          </SelectItem>
        </SelectViewport>
      </SelectContent>
    </SelectPortal>
  </SelectRoot>
</template>
