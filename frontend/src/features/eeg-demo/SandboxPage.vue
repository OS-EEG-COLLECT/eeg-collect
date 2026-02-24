<script setup lang="ts">
/**
 * EEG Sandbox Page
 *
 * Developer-facing page for DSP calibration and hardware verification.
 * Wraps the SandboxDashboard component with platform integration.
 */

import { computed } from 'vue';
import { useRoute } from 'vue-router';
import { SandboxDashboard } from './components';
import { useConfigureParticipantId, useWebsocketConnection } from '@/utils/hooks';

useConfigureParticipantId();
useWebsocketConnection();

const route = useRoute();

const channelIndex = computed(() => {
  const channel = route.query.channel;
  return channel ? parseInt(channel as string, 10) : 0;
});
</script>

<template>
  <SandboxDashboard :channel-index="channelIndex" />
</template>

