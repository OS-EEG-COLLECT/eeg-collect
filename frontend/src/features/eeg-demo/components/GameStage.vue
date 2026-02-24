<script setup lang="ts">
/**
 * GameStage Component
 *
 * Immersive fullscreen game experience with floating UI controls.
 * Game fills entire viewport with stats panel sliding in on demand.
 */

import { ref, computed, inject, onUnmounted, onMounted, defineEmits, defineProps, watch, shallowRef } from 'vue';
import { PhPause, PhPlay, PhArrowCounterClockwise, PhGear, PhSquaresFour, PhX, PhBrain } from '@phosphor-icons/vue';
import { getKeyboardDriver } from '../services';
import { getGameById, type GameConfig, type FrequencyStat } from '../games';
import type { UseASSRDetectionReturn } from '../composables/useASSRDetection';

const emit = defineEmits(['back', 'restart', 'pick-game', 'exit']);

const props = defineProps({
  channelIndex: {
    type: Number,
    required: false,
    default: 0,
  },
  gameId: {
    type: String,
    default: 'flappy-brain',
  },
});

const assrDetection = inject<UseASSRDetectionReturn>('assrDetection')!;
const keyboardDriver = getKeyboardDriver();

const gameConfig = computed<GameConfig | undefined>(() => getGameById(props.gameId));

// All games must expose `frequencyStats` computed property.
const frequencyStats = computed<FrequencyStat[]>(() => {
  return gameRef.value?.frequencyStats ?? [];
});

const GameComponent = shallowRef<any>(null);

// Load game component when gameId changes
watch(() => props.gameId, async (newGameId) => {
  const config = getGameById(newGameId);
  if (config) {
    try {
      const module = await config.component();
      GameComponent.value = module.default;
    } catch (e) {
      console.error('Failed to load game component:', e);
      GameComponent.value = null;
    }
  }
}, { immediate: true });

const gameRef = ref<any>(null);

const isPlaying = computed(() => gameRef.value?.isPlaying ?? false);
const isPaused = computed(() => gameRef.value?.isPaused ?? false);
const gameOver = computed(() => gameRef.value?.gameOver ?? false);

const isDetecting = computed(() => assrDetection.isFocused.value);

const showStats = ref(false);
const statsPanelRef = ref<HTMLElement | null>(null);

const toggleStats = () => {
  showStats.value = !showStats.value;
};

// Close stats panel when clicking outside
const handleClickOutside = (event: MouseEvent) => {
  if (showStats.value && statsPanelRef.value) {
    const target = event.target as HTMLElement;
    // Close if clicking on the overlay backdrop (not the panel itself)
    if (target.classList.contains('stats-panel-overlay')) {
      showStats.value = false;
    }
  }
};

const startGame = async () => {
  // Call game's start method (game handles its own keyboard setup)
  if (gameRef.value?.startGame) {
    await gameRef.value.startGame();
  }
};

const togglePause = async () => {
  if (gameRef.value?.togglePause) {
    await gameRef.value.togglePause();
  }
};

const stopGame = async () => {
  if (gameRef.value?.stopGame) {
    await gameRef.value.stopGame();
  }
  keyboardDriver.disable();
};

onMounted(() => {
  document.addEventListener('click', handleClickOutside);
});

onUnmounted(() => {
  stopGame();
  document.removeEventListener('click', handleClickOutside);
});
</script>

<template>
  <div class="game-stage-fullscreen">
    <component
      v-if="GameComponent"
      :is="GameComponent"
      ref="gameRef"
      :channel-index="channelIndex"
      :is-detecting="isDetecting"
      class="game-component-fullscreen"
      @start="startGame"
    />

    <div
      v-else
      class="loading-overlay"
    >
      <VProgressCircular indeterminate color="#00876c" size="48" class="mb-4" />
      <p class="text-body-2 text-white">Loading game...</p>
    </div>

    <VCard class="floating-header">
      <div class="floating-header-content">
        <span v-if="gameConfig" class="game-emoji mr-2">{{ gameConfig.thumbnail }}</span>
        <span class="text-body-1 font-weight-medium text-white">
          {{ gameConfig?.name ?? 'Brain-Controlled Game' }}
        </span>
      </div>
    </VCard>

    <VTooltip location="left">
      <template v-slot:activator="{ props: tooltipProps }">
        <VBtn
          v-bind="tooltipProps"
          icon
          class="stats-toggle-btn"
          @click="toggleStats"
        >
          <PhBrain :size="24" color="white" />
        </VBtn>
      </template>
      <span>Brain Activity Stats</span>
    </VTooltip>

    <div class="floating-controls">
      <div class="controls-inner">
        <VBtn
          v-if="isPlaying && !gameOver"
          :color="isPaused ? 'success' : 'warning'"
          variant="flat"
          size="small"
          :prepend-icon="isPaused ? PhPlay : PhPause"
          @click="togglePause"
        >
          {{ isPaused ? 'Resume' : 'Pause' }}
        </VBtn>

        <VBtn
          v-if="gameOver"
          color="primary"
          variant="flat"
          size="small"
          :prepend-icon="PhArrowCounterClockwise"
          @click="startGame"
        >
          Try Again
        </VBtn>

        <VBtn
          variant="flat"
          color="grey-darken-1"
          size="small"
          :prepend-icon="PhGear"
          @click="emit('back')"
        >
          Settings
        </VBtn>

        <VBtn
          v-if="gameOver || isPaused"
          variant="text"
          color="white"
          size="small"
          :prepend-icon="PhSquaresFour"
          @click="emit('pick-game')"
        >
          Pick Game
        </VBtn>

        <VBtn
          v-if="gameOver || isPaused"
          variant="text"
          color="error"
          size="small"
          :prepend-icon="PhX"
          @click="emit('exit')"
        >
          End
        </VBtn>
      </div>
    </div>

    <Transition name="slide-in">
      <div
        v-if="showStats"
        class="stats-panel-overlay"
        @click="handleClickOutside"
      >
        <VCard ref="statsPanelRef" class="stats-panel pt-4 px-4">
          <VBtn
            icon
            variant="text"
            size="small"
            class="stats-close-btn"
            @click="showStats = false"
          >
            <PhX :size="20" color="white" />
          </VBtn>

          <VCardTitle class="text-subtitle-1 font-weight-bold text-white">
            Brain Activity
          </VCardTitle>

          <VCardText class="stats-content">
            <!-- Game Status (only shown when game is started) -->
            <div v-if="isPlaying" class="stat-item mb-4">
              <div class="d-flex align-center justify-space-between">
                <span class="text-body-2 text-grey-lighten-1">Game Status</span>
                <VChip
                  :color="gameOver ? 'error' : isPaused ? 'warning' : 'success'"
                  size="small"
                  variant="flat"
                >
                  {{ gameOver ? 'Ended' : isPaused ? 'Paused' : 'Running' }}
                </VChip>
              </div>
            </div>

            <div class="stat-item mb-4">
              <div class="d-flex align-center justify-space-between">
                <span class="text-body-2 text-grey-lighten-1">Detection Threshold</span>
                <span class="text-body-2 font-weight-bold text-white">
                  {{ assrDetection.config.value.detectionThreshold.toFixed(2) }}
                </span>
              </div>
            </div>

            <!-- Message when game not running -->
            <div v-if="!isPlaying || gameOver" class="stat-item mb-4">
              <div class="text-center pa-4">
                <span class="text-body-2 text-grey-lighten-1">
                  {{ !isPlaying ? 'Start the game to see brain activity stats' : 'Game ended - Restart the game to see brain activity stats' }}
                </span>
              </div>
            </div>

            <!-- Frequency Power (Multi-frequency support) - only when game is running -->
            <template v-if="isPlaying && !gameOver">
              <div
                v-for="stat in frequencyStats"
                :key="stat.frequency"
                class="stat-item mb-4"
              >
                <div class="d-flex align-center justify-space-between mb-1">
                  <div class="d-flex align-center">
                    <span class="text-body-2 text-grey-lighten-1">{{ stat.label }}</span>
                    <VChip
                      :color="stat.isActive ? 'success' : 'grey-darken-2'"
                      size="x-small"
                      variant="flat"
                      class="ml-3"
                    >
                      Detected
                    </VChip>
                  </div>
                  <span class="text-body-2 font-weight-bold text-white">{{ stat.snrFormatted }}</span>
                </div>
                <VProgressLinear
                  :model-value="Math.min(100, parseFloat(stat.snrFormatted) * 50)"
                  :color="stat.isActive ? 'success' : 'primary'"
                  height="8"
                  rounded
                />
                <div class="text-caption text-grey-lighten-1 mt-1">
                  Triggers: {{ stat.triggerCount }}
                </div>
              </div>

              <VDivider class="mb-4" style="opacity: 0.2" />

              <div class="stat-item mb-4">
                <div class="d-flex align-center justify-space-between">
                  <span class="text-body-2 text-grey-lighten-1">Total Brain Triggers</span>
                  <span class="text-h6 font-weight-bold text-primary">
                    {{ frequencyStats.reduce((sum, stat) => sum + stat.triggerCount, 0) }}
                  </span>
                </div>
              </div>
            </template>

            <VDivider class="mb-4" style="opacity: 0.2" />

            <div class="instructions" v-if="gameConfig?.instructions">
              <h4 class="text-subtitle-2 font-weight-bold mb-2 text-white">How to Play:</h4>
              <ol class="text-body-2 text-grey-lighten-1 pl-4">
                <li
                  v-for="(instruction, i) in gameConfig.instructions"
                  :key="i"
                  class="mb-1"
                >
                  {{ instruction }}
                </li>
              </ol>
            </div>

            <VDivider class="my-4" style="opacity: 0.2" />

            <p class="text-caption text-grey text-center">
              You can also use keyboard controls manually
            </p>
          </VCardText>
        </VCard>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.game-stage-fullscreen {
  position: relative;
  height: 100%;
  width: 100%;
  background: #0a0a0a;
  overflow: hidden;
}

.game-component-fullscreen {
  width: 100%;
  height: 100%;
  position: absolute;
  top: 0;
  left: 0;
}

.loading-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: #0a0a0a;
}

.floating-header {
  position: absolute;
  top: 16px;
  left: 16px;
  height: 48px;
  background: rgba(30, 30, 40, 0.9) !important;
  backdrop-filter: blur(16px);
  border-radius: 24px;
  z-index: 100;
  box-shadow: 0 2px 16px rgba(0, 0, 0, 0.5);
  border: 1px solid rgba(255, 255, 255, 0.15);
}

.floating-header-content {
  height: 100%;
  padding: 0 16px;
  display: flex;
  align-items: center;
}

.game-emoji {
  font-size: 18px;
  line-height: 1;
}

.floating-controls {
  position: absolute;
  bottom: 16px;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(40, 40, 50, 0.95) !important;
  backdrop-filter: blur(16px);
  border-radius: 12px;
  padding: 8px 12px;
  z-index: 100;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.6);
  border: 1px solid rgba(255, 255, 255, 0.15);
}

.controls-inner {
  display: flex;
  align-items: center;
  gap: 8px;
}

.stats-toggle-btn {
  position: absolute;
  top: 16px;
  right: 16px;
  width: 48px;
  height: 48px;
  background: rgba(20, 20, 30, 0.75) !important;
  backdrop-filter: blur(12px);
  border-radius: 50%;
  z-index: 101;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.stats-toggle-btn:hover {
  background: rgba(30, 30, 40, 0.85) !important;
}

.stats-panel-overlay {
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 200;
  backdrop-filter: blur(2px);
}

.stats-panel {
  position: absolute;
  right: 0;
  top: 0;
  bottom: 0;
  width: 320px;
  max-width: 100vw;
  background: rgba(40, 40, 50, 0.95) !important;
  backdrop-filter: blur(20px);
  overflow-y: auto;
  box-shadow: -4px 0 24px rgba(0, 0, 0, 0.5);
  border-left: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 0;
}

.stats-close-btn {
  position: absolute;
  top: 8px;
  right: 8px;
  z-index: 1;
}

.stats-content {
  padding: 24px;
}

.stat-item {
  padding: 8px 0;
}

.instructions ol {
  margin: 0;
}

.slide-in-enter-active,
.slide-in-leave-active {
  transition: all 300ms ease-in-out;
}

.slide-in-enter-active .stats-panel,
.slide-in-leave-active .stats-panel {
  transition: transform 300ms ease-in-out;
}

.slide-in-enter-from,
.slide-in-leave-to {
  opacity: 0;
}

.slide-in-enter-from .stats-panel {
  transform: translateX(100%);
}

.slide-in-leave-to .stats-panel {
  transform: translateX(100%);
}

/* Responsive: Mobile */
@media (max-width: 960px) {
  .stats-panel {
    width: 100vw;
  }

  .floating-header {
    max-width: calc(100vw - 80px);
  }

  .floating-controls {
    max-width: calc(100vw - 32px);
  }

  .controls-inner {
    flex-wrap: wrap;
    justify-content: center;
  }

  .stats-toggle-btn {
    top: 12px;
    right: 12px;
  }
}

/* Responsive: Small Mobile */
@media (max-width: 600px) {
  .floating-header {
    top: 8px;
    font-size: 0.9rem;
  }

  .game-emoji {
    font-size: 16px;
  }

  .floating-controls {
    bottom: 12px;
    padding: 6px 10px;
  }

  .controls-inner {
    gap: 6px;
  }
}
</style>
