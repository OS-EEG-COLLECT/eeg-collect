<script setup lang="ts">
/**
 * EEG Demo Page
 *
 * Main page component for the ASSR Demo feature.
 * Integrates with the existing platform's routing.
 */

import { computed, onMounted, onUnmounted } from 'vue';
import { useRoute } from 'vue-router';
import { DemoContainer } from './components';
import { useConfigureParticipantId, useWebsocketConnection } from '@/utils/hooks';
import { ROUTES } from "@/utils/routes";
import { navigateToRestricted } from '@/router';
import { useFullscreen } from './composables';

useConfigureParticipantId();
useWebsocketConnection();

const route = useRoute();
const { enterFullscreen, exitFullscreen } = useFullscreen();

const channelIndex = computed(() => {
  // TODO this wrong and needs to be fixed properly
  const channel = route.query.channel;
  return channel ? parseInt(channel as string, 10) : 0;
});

onMounted(() => {
  setTimeout(() => {
    enterFullscreen();
  }, 500);
});

onUnmounted(() => {
  exitFullscreen();
});

// Handle exit - exit fullscreen and go back to optimize signal page
const handleExit = async () => {
  await exitFullscreen();
  navigateToRestricted(ROUTES.OPTIMIZE_SIGNAL, route.query);
};
</script>

<template>
  <DemoContainer
    :channel-index="channelIndex"
    @exit="handleExit"
  />
</template>

<style>
/* Global (unscoped) styles for fullscreen mode */
/* Hide the global header when in fullscreen */
:fullscreen header {
  display: none !important;
}

:fullscreen .content {
  margin-top: 0 !important;
  height: 100vh !important;
}
</style>
