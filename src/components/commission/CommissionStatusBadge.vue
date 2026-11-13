<script setup lang="ts">
import { COMMISSION_STATUS_STYLES, type CommissionStatus } from '../../lib/commissionStatus'
import { useLanguage } from '../../composables/useLanguage'

defineProps<{
  value: CommissionStatus
}>()

const { text } = useLanguage()
</script>

<template>
  <span
    :aria-label="text.home.commissionStatusLabel"
    :class="[
      'inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-medium',
      COMMISSION_STATUS_STYLES[value.status].badge,
    ]"
  >
    <span :class="['size-2 rounded-full', COMMISSION_STATUS_STYLES[value.status].dot]" aria-hidden="true" />
    <span>{{ text.home.commissionStatuses[value.status] }}</span>
    <span v-if="value.status !== 'closed' && value.slotsTotal > 0" class="opacity-80">
      · {{ value.slotsOpen }}/{{ value.slotsTotal }} {{ text.home.slotsLabel }}
    </span>
  </span>
</template>
