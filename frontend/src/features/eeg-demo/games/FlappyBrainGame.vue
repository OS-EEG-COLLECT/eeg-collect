<script setup lang="ts">
/**
 * FlappyBrainGame Component
 * 
 * A Flappy Bird-style game controlled by brain signals.
 * Extracted from GameStage to support dynamic game loading.
 */

import { ref, computed, inject, onMounted, onUnmounted, defineEmits, defineProps, defineExpose } from 'vue';
import { getKeyboardDriver } from '../services';
import type { UseASSRDetectionReturn } from '../composables/useASSRDetection';
import { useAudioEngine } from '../composables/useAudioEngine';
import { getGameById, type FrequencyStat } from './index';

const emit = defineEmits(['score-update', 'game-over', 'game-start']);

defineProps({
  channelIndex: {
    type: Number,
    default: 0,
  },
  isActive: {
    type: Boolean,
    default: false,
  },
});

// Game configuration
const gameConfig = getGameById('flappy-brain')!;

// Injected pipeline
const assrDetection = inject<UseASSRDetectionReturn>('assrDetection')!;
const audioEngine = inject<ReturnType<typeof useAudioEngine>>('audioEngine')!;
const keyboardDriver = getKeyboardDriver();

// Game state
const isPlaying = ref(false);
const isPaused = ref(false);
const score = ref(0);
const gameOver = ref(false);

// Bird/player state
const birdY = ref(200);
const birdVelocity = ref(0);
const gravity = 0.5;
const jumpStrength = -8;

// Game configuration
const GAME_DETECTION_THRESHOLD = 2.0;  // Lower threshold = easier game

// Obstacles
const obstacles = ref<Array<{ x: number; gapY: number; passed: boolean }>>([]);
const obstacleWidth = 60;
const gapHeight = 150;
const obstacleSpeed = 3;

// Canvas ref
const canvasRef = ref<HTMLCanvasElement | null>(null);
let animationFrame: number | null = null;
let obstacleTimer: number | null = null;

// Canvas dimensions (responsive)
const canvasWidth = ref(800);
const canvasHeight = ref(600);

// SNR value (updated by game loop, consumed by UI)
const snr40Ref = ref(0);

// Detection state (updated by game loop, consumed by UI and rendering)
const isDetectingRef = ref(false);

// Frequency stats for GameStage display (reads from ref updated by game loop)
const frequencyStats = computed<FrequencyStat[]>(() => [
  {
    frequency: 40,
    label: '40 Hz',
    snr: snr40Ref.value,
    snrFormatted: snr40Ref.value.toFixed(2),
    isActive: isDetectingRef.value,
    triggerCount: keyboardDriver.getTriggerCount('jump'),
  },
]);

// Handle jump action (from keyboard or brain)
const handleJump = () => {
  if (!isPlaying.value || isPaused.value || gameOver.value) return;
  birdVelocity.value = jumpStrength;
};

// Keyboard listener
const handleKeyDown = (event: KeyboardEvent) => {
  const jumpKey = keyboardDriver.getCurrentKey('jump');
  if (event.code === jumpKey) {
    event.preventDefault();
    handleJump();
  }
};

// Start the game
const startGame = async () => {
  // Reset state
  birdY.value = 200;
  birdVelocity.value = 0;
  obstacles.value = [];
  score.value = 0;
  gameOver.value = false;
  isPlaying.value = true;
  isPaused.value = false;

  // Configure ASSR detection threshold for this game
  assrDetection.updateConfig({
    detectionThreshold: GAME_DETECTION_THRESHOLD,
  });

  // Enable keyboard driver
  keyboardDriver.enable();
  keyboardDriver.resetTriggerCount('jump');

  // Start audio (guarded toggle)
  if (!audioEngine.isPlaying.value) {
    await audioEngine.toggle();
  }

  // Emit game start event
  emit('game-start');

  // Start game loop
  gameLoop();

  // Start spawning obstacles
  spawnObstacle();
  obstacleTimer = window.setInterval(spawnObstacle, 2000);
};

// Pause/Resume
const togglePause = async () => {
  isPaused.value = !isPaused.value;

  if (isPaused.value) {
    if (audioEngine.isPlaying.value) {
      await audioEngine.toggle();
    }
  } else {
    if (!audioEngine.isPlaying.value) {
      await audioEngine.toggle();
    }
    gameLoop();
  }
};

// Stop the game
const stopGame = async () => {
  isPlaying.value = false;
  isPaused.value = false;

  if (animationFrame) {
    cancelAnimationFrame(animationFrame);
    animationFrame = null;
  }

  if (obstacleTimer) {
    clearInterval(obstacleTimer);
    obstacleTimer = null;
  }

  keyboardDriver.disable();
  if (audioEngine.isPlaying.value) {
    await audioEngine.toggle();
  }
};

// Game loop
const gameLoop = () => {
  if (!isPlaying.value || isPaused.value) return;
  
  update();
  render();
  
  animationFrame = requestAnimationFrame(gameLoop);
};

// Update game state
const update = () => {
  if (gameOver.value) return;

  // Compute SNR once per frame (source of truth for both game logic and UI)
  snr40Ref.value = assrDetection.computeSNRAtFrequency(40);

  // Compute detection state (game loop only, stored in ref for rendering)
  const threshold = assrDetection.config.value.detectionThreshold;
  isDetectingRef.value = snr40Ref.value > threshold;

  // Apply gravity
  birdVelocity.value += gravity;
  birdY.value += birdVelocity.value;

  // Check bounds
  if (birdY.value < 0) {
    birdY.value = 0;
    birdVelocity.value = 0;
  }
  if (birdY.value > canvasHeight.value - 20) {
    endGame();
    return;
  }

  // Move obstacles
  for (const obstacle of obstacles.value) {
    obstacle.x -= obstacleSpeed;

    // Check collision
    if (checkCollision(obstacle)) {
      endGame();
      return;
    }

    // Score point
    if (!obstacle.passed && obstacle.x < 50) {
      obstacle.passed = true;
      score.value++;
      emit('score-update', score.value);
    }
  }

  // Remove off-screen obstacles
  obstacles.value = obstacles.value.filter(o => o.x > -obstacleWidth);

  // Check for brain-triggered jumps (use our computed detection state)
  if (isDetectingRef.value) {
    keyboardDriver.triggerOnDetection(true, 'jump');
  }
};

// Render the game
const render = () => {
  const canvas = canvasRef.value;
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const w = canvasWidth.value;
  const h = canvasHeight.value;

  // Clear
  ctx.fillStyle = '#87CEEB';
  ctx.fillRect(0, 0, w, h);

  // Draw obstacles
  ctx.fillStyle = '#228B22';
  for (const obstacle of obstacles.value) {
    // Top pipe
    ctx.fillRect(obstacle.x, 0, obstacleWidth, obstacle.gapY);
    // Bottom pipe
    ctx.fillRect(obstacle.x, obstacle.gapY + gapHeight, obstacleWidth, h - obstacle.gapY - gapHeight);
  }

  // Draw bird
  ctx.fillStyle = isDetectingRef.value ? '#FFD700' : '#FF6347';
  ctx.beginPath();
  ctx.arc(80, birdY.value, 15, 0, Math.PI * 2);
  ctx.fill();

  // Draw score
  ctx.fillStyle = '#000';
  ctx.font = 'bold 24px Arial';
  ctx.textAlign = 'center';
  ctx.fillText(`Score: ${score.value}`, w / 2, 40);

  // Draw detection indicator
  if (isDetectingRef.value) {
    ctx.fillStyle = 'rgba(0, 255, 0, 0.3)';
    ctx.fillRect(0, 0, w, h);
  }

  // Game over overlay
  if (gameOver.value) {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = '#FFF';
    ctx.font = 'bold 48px Arial';
    ctx.fillText('Game Over', w / 2, h / 2 - 40);
    ctx.font = '24px Arial';
    ctx.fillText(`Final Score: ${score.value}`, w / 2, h / 2 + 10);
    ctx.fillText('Click "Try Again" to restart', w / 2, h / 2 + 50);
  }
};

// Spawn obstacle
const spawnObstacle = () => {
  if (!isPlaying.value || isPaused.value || gameOver.value) return;

  const maxGapY = canvasHeight.value - gapHeight - 100;
  const gapY = Math.random() * (maxGapY - 50) + 50;
  obstacles.value.push({
    x: canvasWidth.value + 20,
    gapY,
    passed: false,
  });
};

// Check collision
const checkCollision = (obstacle: { x: number; gapY: number }): boolean => {
  const birdLeft = 65;
  const birdRight = 95;
  const birdTop = birdY.value - 15;
  const birdBottom = birdY.value + 15;
  
  if (birdRight > obstacle.x && birdLeft < obstacle.x + obstacleWidth) {
    if (birdTop < obstacle.gapY || birdBottom > obstacle.gapY + gapHeight) {
      return true;
    }
  }
  
  return false;
};

// End game
const endGame = async () => {
  gameOver.value = true;
  if (audioEngine.isPlaying.value) {
    await audioEngine.toggle();
  }
  keyboardDriver.disable();
  emit('game-over', score.value);
};

// Resize canvas to fit screen
const resizeCanvas = () => {
  if (!canvasRef.value) return;
  const container = canvasRef.value.parentElement;
  if (!container) return;

  canvasWidth.value = container.clientWidth;
  canvasHeight.value = container.clientHeight;

  // Update canvas element size
  canvasRef.value.width = canvasWidth.value;
  canvasRef.value.height = canvasHeight.value;
};

// Lifecycle
onMounted(() => {
  window.addEventListener('keydown', handleKeyDown);
  window.addEventListener('resize', resizeCanvas);

  // Initial resize
  setTimeout(resizeCanvas, 0);
});

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyDown);
  window.removeEventListener('resize', resizeCanvas);
  stopGame();
});

// Expose methods for parent component
defineExpose({
  startGame,
  stopGame,
  togglePause,
  isPlaying,
  isPaused,
  gameOver,
  score,
  frequencyStats,
});
</script>

<template>
  <div class="flappy-brain-game">
    <!-- Game canvas -->
    <canvas
      ref="canvasRef"
      :width="canvasWidth"
      :height="canvasHeight"
      class="game-canvas"
      :class="{ 'game-active': isPlaying }"
    />

    <!-- Pre-game overlay -->
    <div
      v-if="!isPlaying"
      class="start-overlay d-flex flex-column align-center justify-center"
    >
      <span class="game-emoji mb-4">🐦</span>
      <h2 class="text-h4 font-weight-bold mb-2 text-white">Ready to Play?</h2>
      <p class="text-body-1 text-grey-lighten-1 mb-4">
        Focus on the sound to control the bird
      </p>

      <!-- Instructions Section -->
      <h3 class="text-subtitle-1 font-weight-bold text-white mt-4 mb-2">
        How to Play:
      </h3>
      <ol class="instructions-list text-body-2 text-grey-lighten-1">
        <li v-for="(instruction, index) in gameConfig.instructions" :key="index">
          {{ instruction }}
        </li>
      </ol>

      <VBtn color="success" size="large" @click="startGame">
        Start Game
      </VBtn>
    </div>

    <!-- Pause overlay -->
    <div
      v-if="isPaused && isPlaying"
      class="pause-overlay d-flex flex-column align-center justify-center"
    >
      <h2 class="text-h3 font-weight-bold mb-4 text-white">Paused</h2>
      <VBtn color="white" variant="outlined" @click="togglePause">
        Resume
      </VBtn>
    </div>
  </div>
</template>

<style scoped>
.flappy-brain-game {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
}

.game-canvas {
  display: block;
  width: 100%;
  height: 100%;
}

.game-canvas.game-active {
  cursor: pointer;
}

.start-overlay,
.pause-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 10;
}

.start-overlay {
  background: rgba(10, 10, 20, 0.85);
  backdrop-filter: blur(10px);
}

.pause-overlay {
  background: rgba(0, 0, 0, 0.85);
  backdrop-filter: blur(10px);
}

.game-emoji {
  font-size: 72px;
  animation: float 3s ease-in-out infinite;
}

@keyframes float {
  0%, 100% {
    transform: translateY(0px);
  }
  50% {
    transform: translateY(-20px);
  }
}

/* Instructions List */
.instructions-list {
  text-align: left;
  max-width: 500px;
  padding-left: 20px;
  margin: 0 auto 24px;
  line-height: 1.5;
}

.instructions-list li {
  margin-bottom: 6px;
}
</style>
