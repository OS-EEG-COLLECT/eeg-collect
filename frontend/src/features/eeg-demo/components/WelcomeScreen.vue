<script setup lang="ts">
/**
 * WelcomeScreen Component
 *
 * Introduction screen for the ASSR Demo.
 * Features animated splashscreen with dolphin mascot.
 */

import { defineEmits, onMounted, onUnmounted, ref } from 'vue';
import { PhArrowRight } from '@phosphor-icons/vue';
import dolphinControllerSvg from '../assets/support_dolphin_controller.svg';
import dolphinSvg from '../assets/support_dolphin.svg';

const emit = defineEmits(['continue', 'splash-end']);

const showSplash = ref(true);
const showContent = ref(false);
const dolphinSvgContainer = ref<HTMLDivElement | null>(null);
let splashTimer: ReturnType<typeof setTimeout> | null = null;
let contentTimer: ReturnType<typeof setTimeout> | null = null;

onMounted(async () => {
  // Load and inject SVG for animation control
  try {
    const response = await fetch(dolphinControllerSvg);
    const svgText = await response.text();

    if (dolphinSvgContainer.value) {
      dolphinSvgContainer.value.innerHTML = svgText;

      // Add classes to SVG groups for targeted animations
      const svgElement = dolphinSvgContainer.value.querySelector('svg');
      if (svgElement) {
        const headphones = svgElement.querySelector('#Headphones');
        const dolphin = svgElement.querySelector('#Dolphin');
        const controller = svgElement.querySelector('#Controller');

        if (headphones) headphones.classList.add('headphones-group');
        if (dolphin) dolphin.classList.add('dolphin-group');
        if (controller) controller.classList.add('controller-group');
      }
    }
  } catch (error) {
    console.error('Failed to load SVG:', error);
  }

  // Auto-transition from splash to content after 2.5 seconds
  splashTimer = setTimeout(() => {
    showSplash.value = false;
    emit('splash-end');
    contentTimer = setTimeout(() => {
      showContent.value = true;
    }, 300); // Wait for fade-out
  }, 2500);
});

onUnmounted(() => {
  if (splashTimer) clearTimeout(splashTimer);
  if (contentTimer) clearTimeout(contentTimer);
});
</script>

<template>
  <VCol class="welcome-screen d-flex flex-column align-center justify-center pa-8">
    <Transition name="splash-fade" mode="out-in">
      <!-- Splash Screen -->
      <div v-if="showSplash" key="splash" class="splash-container">
        <div ref="dolphinSvgContainer" class="dolphin-container"></div>
        <h1 class="splash-title">Brain-Controlled Demo</h1>
        <p class="splash-subtitle">Gaming with Auditory Steady-State Responses</p>
      </div>

      <!-- Welcome Content -->
      <div v-else-if="showContent" key="content" class="welcome-content">
        <div class="welcome-header text-center mb-8">
          <div class="header-dolphin-container mb-4">
            <img :src="dolphinControllerSvg" alt="Dolphin Mascot" class="header-dolphin" />
          </div>
          <h1 class="text-h3 font-weight-bold mb-2">
            Brain-Controlled Demo
          </h1>
          <p class="text-h6 text-grey mt-2">
            Auditory Steady-State Response (ASSR)
          </p>
        </div>

        <VCard class="welcome-card mb-8 px-4 py-6" max-width="600" variant="outlined">
          <VCardText class="pa-0">
            <h3 class="text-h6 mb-3">
              What you'll experience:
            </h3>

            <VList density="compact" class="bg-transparent">
              <VListItem>
                <template #prepend>
                  <VAvatar color="#00876c" size="32" class="mr-3">
                    <span class="text-white font-weight-bold">1</span>
                  </VAvatar>
                </template>
                <VListItemTitle class="text-body-1">
                  <strong>Signal Check</strong> - Verify your EEG headset connection
                </VListItemTitle>
              </VListItem>

              <VListItem>
                <template #prepend>
                  <VAvatar color="#00876c" size="32" class="mr-3">
                    <span class="text-white font-weight-bold">2</span>
                  </VAvatar>
                </template>
                <VListItemTitle class="text-body-1">
                  <strong>Calibration</strong> - Record your brain's resting baseline
                </VListItemTitle>
              </VListItem>

              <VListItem>
                <template #prepend>
                  <VAvatar color="#00876c" size="32" class="mr-3">
                    <span class="text-white font-weight-bold">3</span>
                  </VAvatar>
                </template>
                <VListItemTitle class="text-body-1">
                  <strong>Play!</strong> - Control a game using your focus
                </VListItemTitle>
              </VListItem>
            </VList>

            <VDivider class="my-3" />

            <p class="text-body-2 text-grey-darken-1">
              <strong>How it works:</strong> When you listen to a sound modulated at a specific frequency,
              neurons in your auditory cortex respond at that frequency. We detect this response
              and use it to control the game.
            </p>
          </VCardText>
        </VCard>

        <VCard class="requirements-card mb-8 pa-4" max-width="600" variant="tonal" color="#00876c">
          <VCardText class="pa-0">
            <p class="text-body-2 mb-0" style="color: #000">
              <strong>Requirements:</strong> EEG headset and headphones (or headphones with built-in EEG) • Quiet environment
            </p>
          </VCardText>
        </VCard>

        <div class="dolphin-hint d-flex align-center mb-6" style="max-width: 600px;">
          <img :src="dolphinSvg" style="width: 36px; height: 36px;" class="mr-3" alt="" />
          <p class="text-body-2 text-grey-darken-1 mb-0">
            <strong>Tip:</strong> Look for the dolphin in the top-right corner.
            Click it anytime to learn more about what's happening.
          </p>
        </div>

        <VBtn
          :append-icon="PhArrowRight"
          @click="emit('continue')"
        >
          Start Demo
        </VBtn>
      </div>
    </Transition>
  </VCol>
</template>

<style scoped>
.welcome-screen {
  min-height: calc(100vh - 140px);
}

.splash-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: calc(100vh - 140px);
  animation: fadeIn 0.5s ease-out;
}

.dolphin-container {
  width: 300px;
  height: 300px;
  margin-bottom: 32px;
  animation: float 3s ease-in-out infinite;
  filter: drop-shadow(0 4px 12px rgba(0, 135, 108, 0.2));
}

.dolphin-container :deep(svg) {
  width: 100%;
  height: 100%;
}

/* Headphones: Gentle pulse with subtle glow */
.dolphin-container :deep(.headphones-group) {
  transform-origin: center;
  animation: headphonePulse 2s ease-in-out infinite;
  filter: drop-shadow(0 0 8px rgba(119, 202, 245, 0.3));
}

/* Dolphin body: Subtle breathing effect */
.dolphin-container :deep(.dolphin-group) {
  transform-origin: center;
  animation: dolphinBreathe 3.5s ease-in-out infinite;
}

/* Controller: Gentle wiggle */
.dolphin-container :deep(.controller-group) {
  transform-origin: center;
  animation: controllerWiggle 2.5s ease-in-out infinite;
}

@keyframes float {
  0%, 100% {
    transform: translateY(0px);
  }
  50% {
    transform: translateY(-20px);
  }
}

@keyframes headphonePulse {
  0%, 100% {
    transform: scale(1) rotate(0deg);
  }
  50% {
    transform: scale(1.08) rotate(2deg);
  }
}

@keyframes dolphinBreathe {
  0%, 100% {
    transform: scale(1);
    opacity: 0.95;
  }
  50% {
    transform: scale(1.03);
    opacity: 1;
  }
}

@keyframes controllerWiggle {
  0%, 100% {
    transform: rotate(0deg) translateX(0px);
  }
  25% {
    transform: rotate(-3deg) translateX(-2px);
  }
  75% {
    transform: rotate(3deg) translateX(2px);
  }
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: scale(0.9);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

.splash-title {
  font-size: 2.5rem;
  font-weight: bold;
  color: #00876c;
  margin-bottom: 8px;
  text-align: center;
  animation: slideUp 0.8s ease-out 0.3s both;
}

.splash-subtitle {
  font-size: 1.25rem;
  color: #78909c;
  text-align: center;
  animation: slideUp 0.8s ease-out 0.5s both;
}

@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.splash-fade-enter-active,
.splash-fade-leave-active {
  transition: all 0.5s ease;
}

.splash-fade-enter-from {
  opacity: 0;
  transform: scale(0.95);
}

.splash-fade-leave-to {
  opacity: 0;
  transform: scale(1.05);
}

.welcome-content {
  animation: slideIn 0.5s ease-out;
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
}

@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateX(30px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

/* Header dolphin - smaller with subtle animation */
.header-dolphin-container {
  display: inline-block;
}

.header-dolphin {
  width: 100px;
  height: 100px;
  filter: drop-shadow(0 2px 8px rgba(0, 135, 108, 0.15));
  animation: headerBob 4s ease-in-out infinite;
}

@keyframes headerBob {
  0%, 100% {
    transform: translateY(0px) rotate(0deg);
  }
  50% {
    transform: translateY(-8px) rotate(2deg);
  }
}

.welcome-card {
  border-color: #e0e0e0;
  border-radius: 12px;
}

.requirements-card {
  border-radius: 12px;
}
</style>
