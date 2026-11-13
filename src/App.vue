<script setup lang="ts">
import FloatingShapes from './components/FloatingShapes.vue'
import SiteFooter from './components/SiteFooter.vue'
import SiteHeader from './components/SiteHeader.vue'
</script>

<template>
  <FloatingShapes />
  <SiteHeader />
  <RouterView />
  <SiteFooter />
</template>
