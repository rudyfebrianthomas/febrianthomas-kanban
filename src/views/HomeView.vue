<script setup lang="ts">
import { Pencil } from '@lucide/vue'
</script>

<template>
  <main class="page">
    <section class="login-panel" aria-labelledby="page-title">
      <div class="brand"><span class="brand-icon"><Pencil :size="18" aria-hidden="true" /></span><span>the commission desk<span class="brand-dot">.</span></span></div>
      <p class="eyebrow">COMMISSION PROGRESS</p>
      <h1 id="page-title">Coming soon<span class="heading-dot">.</span></h1>
      <p class="intro">The commission progress board is on its way.</p>
      <RouterLink class="submit" to="/login">Artist sign in</RouterLink>
    </section>
  </main>
</template>
