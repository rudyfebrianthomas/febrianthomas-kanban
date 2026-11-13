<script setup lang="ts">
import { socials } from '../data/socials'

const year = new Date().getFullYear()
const starters = ['bulba', 'ivy', 'venu']
</script>

<template>
  <footer class="border-t border-zinc-200 px-6 sm:px-10">
    <div class="mx-auto max-w-6xl py-6 text-center sm:text-left">
      <div class="flex w-full flex-col items-center gap-4 sm:flex-row sm:justify-between">
        <div class="flex flex-wrap items-center justify-center gap-3">
          <span class="text-sm text-zinc-500">© febrianthomas - {{ year }}</span>
          <div class="flex items-end gap-1" aria-hidden="true">
            <img v-for="name in starters" :key="name" :src="`/images/${name}.gif`" alt="" width="32" height="32" class="size-8 object-contain" />
          </div>
        </div>
        <nav aria-label="Social profiles" class="flex flex-wrap justify-center gap-2">
          <a
            v-for="social in socials"
            :key="social.name"
            :href="social.url"
            target="_blank"
            rel="noopener noreferrer"
            :aria-label="social.name"
            :title="social.name"
            class="flex size-10 items-center justify-center rounded-full text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-950 focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            <svg aria-hidden="true" viewBox="0 0 24 24" class="size-5 fill-current"><path :d="social.path" /></svg>
          </a>
        </nav>
      </div>
    </div>
  </footer>
</template>
