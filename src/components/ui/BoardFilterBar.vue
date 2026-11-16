<script setup lang="ts" generic="T extends string">
import { Search } from '@lucide/vue'
import SelectField, { type SelectOption } from './SelectField.vue'

defineProps<{
  searchId: string
  filterId: string
  searchLabel: string
  searchPlaceholder: string
  filterLabel: string
  hint: string
  filterOptions: readonly SelectOption<T>[]
}>()

const query = defineModel<string>('query', { required: true })
const filter = defineModel<T>('filter', { required: true })
</script>

<template>
  <div>
    <form class="flex flex-wrap gap-3" role="search" @submit.prevent>
      <label :for="searchId" class="sr-only">{{ searchLabel }}</label>
      <div class="relative min-w-48 flex-1">
        <Search
          class="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-zinc-400"
          aria-hidden="true"
        />
        <input
          :id="searchId"
          v-model="query"
          type="search"
          :placeholder="searchPlaceholder"
          class="min-h-11 w-full rounded-xl border border-zinc-300 bg-white pl-11 pr-4 text-sm text-zinc-950 outline-hidden placeholder:text-zinc-400 focus:ring-2 focus:ring-zinc-900 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-50 dark:placeholder:text-zinc-500 dark:focus:ring-zinc-300"
        />
      </div>
      <div class="w-40">
        <label :for="filterId" class="sr-only">{{ filterLabel }}</label>
        <SelectField
          :id="filterId"
          v-model="filter"
          :options="filterOptions"
          :aria-label="filterLabel"
        />
      </div>
    </form>
    <p class="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
      {{ hint }}
    </p>
  </div>
</template>
