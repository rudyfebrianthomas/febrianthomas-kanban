<script setup lang="ts">
import { useRoute } from 'vue-router'

const route = useRoute()
</script>

<template>
  <main class="home-page">
    <section v-if="route.path === '/'" class="home-content" aria-labelledby="page-title">
      <div class="home-heading">
        <p class="eyebrow">FEBRIANTHOMAS / COMMISSIONS</p>
        <h1 id="page-title">A little progress<span class="heading-dot">.</span><br />A lot of heart<span class="heading-dot">.</span></h1>
        <p class="home-intro">Follow your illustration from the first idea to the final artwork.</p>
      </div>
      <div class="progress-preview">
        <div class="preview-heading"><span>THE COMMISSION BOARD</span><span class="preview-note">Coming soon</span></div>
        <div class="progress-stages" aria-label="Commission stages">
          <div class="progress-stage"><span class="stage-number">01</span><span>To do</span></div>
          <div class="progress-stage"><span class="stage-number">02</span><span>In progress</span></div>
          <div class="progress-stage"><span class="stage-number">03</span><span>Done</span></div>
        </div>
        <p class="preview-message">The board is being prepared. Check back soon for updates.</p>
      </div>
    </section>
    <section v-else class="home-content secondary-page" aria-labelledby="page-title">
      <p class="eyebrow">ABOUT</p>
      <h1 id="page-title">Coming soon<span class="heading-dot">.</span></h1>
      <p class="home-intro">This page is on its way.</p>
    </section>
  </main>
</template>
