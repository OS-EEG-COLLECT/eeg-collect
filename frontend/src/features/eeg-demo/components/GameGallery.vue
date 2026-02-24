<script setup lang="ts">
/**
 * GameGallery Component
 * 
 * Displays a gallery of available games for the user to select.
 * Matches the styling of WelcomeScreen and SignalVisualization.
 */

import { ref } from 'vue';
import { PhArrowRight, PhGameController } from '@phosphor-icons/vue';
import { GAME_REGISTRY, type GameConfig } from '../games';

const emit = defineEmits(['select', 'back']);

const selectedGame = ref<GameConfig | null>(null);

// Handle game selection (toggle for flip animation)
const handleGameSelect = (game: GameConfig) => {
  if (selectedGame.value?.id === game.id) {
    selectedGame.value = null; // Flip back
  } else {
    selectedGame.value = game; // Flip to instructions
  }
};

const handleContinue = () => {
  if (selectedGame.value) {
    emit('select', selectedGame.value.id);
  }
};

const getDifficultyColor = (difficulty: string) => {
  switch (difficulty) {
    case 'easy': return 'success';
    case 'medium': return 'warning';
    case 'hard': return 'error';
    default: return 'grey';
  }
};
</script>

<template>
  <div class="game-gallery pa-4">
    <div class="text-center mb-6">
      <div class="d-flex justify-center align-center mb-4">
        <PhGameController :size="48" color="#00876c" />
      </div>
      <h3 class="text-h5 font-weight-bold mb-2">Choose Your Game</h3>
      <p class="text-body-1 text-grey-darken-1">
        Select a game to play with your brain signals
      </p>
    </div>

    <v-row class="game-grid mb-6" justify="center">
      <v-col
        v-for="game in GAME_REGISTRY"
        :key="game.id"
        cols="12"
        sm="6"
        md="4"
        class="pa-2"
      >
        <div
          class="flip-card-container"
          :class="{ 'unavailable': !game.available }"
        >
          <div
            class="flip-card-inner"
            :class="{ 'flipped': selectedGame?.id === game.id }"
          >
            <!-- FRONT FACE - Game Preview -->
            <div class="flip-card-front">
              <v-card
                class="game-card h-100 px-2"
                variant="outlined"
                @click="game.available && handleGameSelect(game)"
              >
                <v-card-text class="text-center">
                  <div class="game-thumbnail mb-3">
                    <span class="game-emoji">{{ game.thumbnail }}</span>

                    <v-chip
                      v-if="!game.available"
                      class="coming-soon-badge"
                      color="grey"
                      size="x-small"
                      variant="flat"
                    >
                      Coming Soon
                    </v-chip>
                  </div>

                  <h4 class="text-subtitle-1 font-weight-bold mb-1">
                    {{ game.name }}
                  </h4>

                  <div class="d-flex justify-center align-center mb-2">
                    <v-chip
                      :color="getDifficultyColor(game.difficulty)"
                      size="x-small"
                      variant="tonal"
                      class="mr-2"
                    >
                      {{ game.difficulty }}
                    </v-chip>
                    <span class="text-caption text-grey">{{ game.category }}</span>
                  </div>

                  <p class="text-body-2 text-grey-darken-1 mb-3">
                    {{ game.description }}
                  </p>

                  <div class="actions-preview">
                    <p class="text-caption text-grey mb-1">Brain Controls:</p>
                    <div class="d-flex flex-wrap justify-center">
                      <v-chip
                        v-for="action in game.actions"
                        :key="action.id"
                        size="x-small"
                        variant="outlined"
                        class="ma-1"
                      >
                        {{ action.label }}
                      </v-chip>
                    </div>
                  </div>
                </v-card-text>
              </v-card>
            </div>

            <!-- BACK FACE - Instructions -->
            <div class="flip-card-back">
              <v-card
                class="game-card instructions-card h-100 px-2"
                variant="outlined"
                color="#00876c"
                @click="handleGameSelect(game)"
              >
                <div class="instructions-content">
                  <div class="d-flex mb-4">
                    <span class="game-emoji-small mr-3">{{ game.thumbnail }}</span>
                    <div class="d-flex flex-column">
                      <h5 class="text-subtitle-2 font-weight-bold text-grey-darken-1">
                        How to Play
                      </h5>
                      <h4 class="text-subtitle-1 font-weight-bold">
                        {{ game.name }}
                      </h4>
                    </div>
                  </div>

                  <div class="instructions-scroll">
                    <ol class="instructions-list">
                      <li
                        v-for="(instruction, index) in game.instructions"
                        :key="index"
                        class="text-body-2"
                      >
                        {{ instruction }}
                      </li>
                    </ol>
                  </div>
                </div>
              </v-card>
            </div>
          </div>
        </div>
      </v-col>
    </v-row>

    <div class="d-flex justify-center">
      <v-btn
        variant="text"
        color="grey"
        @click="emit('back')"
        class="mr-4"
      >
        Back to Calibration
      </v-btn>

      <v-btn
        :append-icon="PhArrowRight"
        :disabled="!selectedGame"
        @click="handleContinue"
      >
        Configure Controls
      </v-btn>
    </div>
  </div>
</template>

<style scoped>
.game-gallery {
  max-width: 900px;
  margin: 0 auto;
}

/* 3D Flip Card Container */
.flip-card-container {
  perspective: 1000px;
  height: 100%;
  min-height: 350px;
}

.flip-card-container.unavailable {
  opacity: 0.6;
  cursor: not-allowed;
}

.flip-card-inner {
  position: relative;
  width: 100%;
  height: 100%;
  transition: transform 0.6s;
  transform-style: preserve-3d;
}

.flip-card-inner.flipped {
  transform: rotateY(180deg);
}

.flip-card-front,
.flip-card-back {
  position: absolute;
  width: 100%;
  height: 100%;
  backface-visibility: hidden;
  -webkit-backface-visibility: hidden;
}

.flip-card-back {
  /* Back face is rotated 180deg to start */
  transform: rotateY(180deg);
}

.game-card {
  border-radius: 12px;
  cursor: pointer;
  transition: box-shadow 0.2s ease;
  height: 100%;
}

.flip-card-front .game-card:hover {
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
}

.flip-card-container.unavailable .game-card {
  cursor: not-allowed;
}

/* Instructions Card (Back Face) */
.instructions-card {
  border-color: #00876c !important;
  border-width: 2px;
  background: linear-gradient(135deg, rgba(0, 135, 108, 0.02) 0%, rgba(0, 135, 108, 0.05) 100%);
  overflow: hidden;
}

.instructions-content {
  height: 100%;
  padding: 16px 0;
  display: flex;
  flex-direction: column;
}

.instructions-scroll {
  position: relative;
  overflow-y: auto;
  flex: 1;
  margin: 0 8px;
  padding: 12px;
  background: rgba(0, 135, 108, 0.03);
  border-radius: 8px;
  border: 1px solid rgba(0, 135, 108, 0.15);

  /* Custom scrollbar styling - always visible */
  scrollbar-width: thin;
  scrollbar-color: rgba(0, 135, 108, 0.4) rgba(0, 135, 108, 0.1);
}

/* Gradient fade at bottom to indicate scrollable content */
.instructions-scroll::after {
  content: '';
  position: sticky;
  bottom: 0;
  left: 0;
  right: 0;
  height: 20px;
  background: linear-gradient(to bottom, transparent, rgba(0, 135, 108, 0.08));
  pointer-events: none;
  border-radius: 0 0 8px 8px;
}

.instructions-scroll::-webkit-scrollbar {
  width: 8px;
}

.instructions-scroll::-webkit-scrollbar-track {
  background: rgba(0, 135, 108, 0.1);
  border-radius: 4px;
}

.instructions-scroll::-webkit-scrollbar-thumb {
  background-color: rgba(0, 135, 108, 0.4);
  border-radius: 4px;
}

.instructions-scroll::-webkit-scrollbar-thumb:hover {
  background-color: rgba(0, 135, 108, 0.6);
}

.game-thumbnail {
  position: relative;
  display: inline-block;
}

.game-emoji {
  font-size: 48px;
  line-height: 1;
}

.game-emoji-small {
  font-size: 40px;
  line-height: 1;
}

.coming-soon-badge {
  position: absolute;
  bottom: -8px;
  left: 50%;
  transform: translateX(-50%);
}

.actions-preview {
  min-height: 48px;
}

.instructions-list {
  margin: 0;
  padding-left: 16px;
  line-height: 1.6;
}

.instructions-list li {
  margin-bottom: 4px;
}

/* Responsive adjustments */
@media (max-width: 600px) {
  .flip-card-container {
    min-height: 320px;
  }

  .game-emoji-small {
    font-size: 28px;
  }
}
</style>
