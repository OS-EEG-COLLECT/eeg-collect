<script setup lang="ts">
/**
 * DeepDiveExplainer Component
 *
 * Fixed-position dolphin button + slide-in card that shows
 * scientifically grounded context about the current demo step.
 */

import { ref, watch, computed } from 'vue';
import { PhX } from '@phosphor-icons/vue';
import dolphinSvg from '../../assets/support_dolphin.svg';
import { deepDiveContent } from './deepDiveContent';

type DemoStep = 'welcome' | 'impedance' | 'visualization' | 'calibration' | 'gallery' | 'controller' | 'game';

const props = defineProps<{
  step: DemoStep;
  visible: boolean;
  fullscreen: boolean;
  hide: boolean;
}>();

const isOpen = ref(false);
const isWiggling = ref(false);

const content = computed(() => {
  if (props.step === 'game') return null;
  return deepDiveContent[props.step] ?? null;
});

const topOffset = computed(() => {
  // Non-fullscreen: 70px app header + 48px demo header + 16px padding
  // Fullscreen: 48px demo header + 16px padding
  return props.fullscreen ? '64px' : '134px';
});

function open() {
  if (isWiggling.value) return;
  isWiggling.value = true;
  setTimeout(() => {
    isWiggling.value = false;
    isOpen.value = true;
  }, 400);
}

function close() {
  isOpen.value = false;
}

watch(() => props.step, () => {
  isOpen.value = false;
});

// Auto-close when step requests hiding (splash, calibration)
watch(() => props.hide, (shouldHide) => {
  if (shouldHide) {
    isOpen.value = false;
  }
});
</script>

<template>
  <div v-if="visible && content && !hide" class="deep-dive">
    <!-- Dolphin Button (hidden when card is open) -->
    <button
      v-if="!isOpen"
      class="dolphin-btn"
      :class="{ wiggle: isWiggling }"
      :style="{ top: topOffset }"
      @click="open"
      title="Learn more about this step"
    >
      <img :src="dolphinSvg" alt="Learn more" class="dolphin-icon" />
    </button>

    <!-- Desktop card (≥960px) -->
    <Transition name="slide-right">
      <div
        v-if="isOpen"
        class="explainer-card"
        :style="{ top: topOffset }"
      >
        <div class="explainer-header d-flex align-center mb-3">
          <img :src="dolphinSvg" alt="" class="explainer-dolphin mr-2" />
          <h3 class="text-subtitle-1 font-weight-bold flex-grow-1 mb-0">
            {{ content.title }}
          </h3>
          <button class="close-btn" @click="close" aria-label="Close">
            <PhX :size="18" />
          </button>
        </div>
        <div class="explainer-body">
          <p
            v-for="(paragraph, i) in content.paragraphs"
            :key="i"
            class="text-body-2 text-grey-darken-2"
            :class="{ 'mb-3': i < content.paragraphs.length - 1, 'mb-0': i === content.paragraphs.length - 1 }"
          >
            {{ paragraph }}
          </p>
        </div>
      </div>
    </Transition>

    <!-- Mobile bottom sheet (<960px) -->
    <Transition name="slide-up">
      <div
        v-if="isOpen"
        class="explainer-sheet"
      >
        <div class="sheet-handle" />
        <div class="explainer-header d-flex align-center mb-3">
          <img :src="dolphinSvg" alt="" class="explainer-dolphin mr-2" />
          <h3 class="text-subtitle-1 font-weight-bold flex-grow-1 mb-0">
            {{ content.title }}
          </h3>
          <button class="close-btn" @click="close" aria-label="Close">
            <PhX :size="18" />
          </button>
        </div>
        <div class="explainer-body">
          <p
            v-for="(paragraph, i) in content.paragraphs"
            :key="i"
            class="text-body-2 text-grey-darken-2"
            :class="{ 'mb-3': i < content.paragraphs.length - 1, 'mb-0': i === content.paragraphs.length - 1 }"
          >
            {{ paragraph }}
          </p>
        </div>
      </div>
    </Transition>

    <Transition name="fade">
      <div v-if="isOpen" class="sheet-backdrop" @click="close" />
    </Transition>
  </div>
</template>

<style scoped>
/* ── Dolphin button ── */
.dolphin-btn {
  position: fixed;
  right: 24px;
  z-index: 50;
  width: 48px;
  height: 48px;
  border-radius: 50%;
  border: 2px solid #e0e0e0;
  background: #fff;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  transition: box-shadow 0.2s ease, border-color 0.2s ease;
}

.dolphin-btn:hover {
  border-color: #00876c;
  box-shadow: 0 4px 12px rgba(0, 135, 108, 0.2);
}

.dolphin-icon {
  width: 32px;
  height: 32px;
}

/* Wiggle animation */
.dolphin-btn.wiggle {
  animation: wiggle 0.4s ease-in-out;
}

@keyframes wiggle {
  0% { transform: rotate(0deg); }
  20% { transform: rotate(8deg); }
  40% { transform: rotate(-8deg); }
  60% { transform: rotate(6deg); }
  80% { transform: rotate(-4deg); }
  100% { transform: rotate(0deg); }
}

/* ── Desktop card (shown ≥960px) ── */
.explainer-card {
  position: fixed;
  right: 24px;
  z-index: 50;
  width: 340px;
  max-height: calc(100vh - 200px);
  overflow-y: auto;
  background: #fff;
  border: 1px solid #e0e0e0;
  border-radius: 12px;
  padding: 20px;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.12);
}

@media (max-width: 959px) {
  .explainer-card {
    display: none;
  }
}

/* ── Mobile bottom sheet (shown <960px) ── */
.explainer-sheet {
  display: none;
}

@media (max-width: 959px) {
  .explainer-sheet {
    display: block;
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    z-index: 51;
    max-height: 60vh;
    overflow-y: auto;
    background: #fff;
    border-radius: 16px 16px 0 0;
    padding: 12px 20px 24px;
    box-shadow: 0 -4px 24px rgba(0, 0, 0, 0.15);
  }
}

.sheet-handle {
  width: 36px;
  height: 4px;
  border-radius: 2px;
  background: #ccc;
  margin: 0 auto 12px;
}

.sheet-backdrop {
  display: none;
}

@media (max-width: 959px) {
  .sheet-backdrop {
    display: block;
    position: fixed;
    inset: 0;
    z-index: 50;
    background: rgba(0, 0, 0, 0.3);
  }
}

/* ── Shared inner elements ── */
.explainer-dolphin {
  width: 28px;
  height: 28px;
}

.close-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  border: none;
  background: transparent;
  cursor: pointer;
  color: #757575;
  transition: background 0.15s ease;
}

.close-btn:hover {
  background: #f5f5f5;
}

.explainer-body {
  line-height: 1.6;
}

/* ── Transitions: desktop slide-right ── */
.slide-right-enter-active {
  transition: transform 0.3s ease-out, opacity 0.3s ease-out;
}

.slide-right-leave-active {
  transition: transform 0.2s ease-in, opacity 0.2s ease-in;
}

.slide-right-enter-from {
  opacity: 0;
  transform: translateX(40px);
}

.slide-right-leave-to {
  opacity: 0;
  transform: translateX(40px);
}

/* ── Transitions: mobile slide-up ── */
.slide-up-enter-active {
  transition: transform 0.3s ease-out;
}

.slide-up-leave-active {
  transition: transform 0.2s ease-in;
}

.slide-up-enter-from {
  transform: translateY(100%);
}

.slide-up-leave-to {
  transform: translateY(100%);
}

/* ── Backdrop fade ── */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
