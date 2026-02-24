<script setup lang="ts">
/**
 * BalloonsGame Component - Sketchbook Redesign
 *
 * Two balloons on screen — left inflates when 30Hz ASSR is detected (left ear),
 * right inflates when 40Hz ASSR is detected (right ear).
 * Audio stimulus is white noise with independent per-ear AM modulation.
 * Game ends when both balloons pop.
 */

import { ref, computed, inject, onMounted, onUnmounted, defineEmits, defineExpose } from 'vue';
import InlineSvg from 'vue-inline-svg';
import { getKeyboardDriver } from '../services';
import type { UseASSRDetectionReturn } from '../composables/useASSRDetection';
import { useAudioEngine } from '../composables/useAudioEngine';
import { getGameById, type FrequencyStat } from './index';

const emit = defineEmits(['score-update', 'game-over', 'game-start']);

// Game configuration
const gameConfig = getGameById('balloons')!;

// Injected pipeline
const assrDetection = inject<UseASSRDetectionReturn>('assrDetection')!;
const audioEngine = inject<ReturnType<typeof useAudioEngine>>('audioEngine')!;
const keyboardDriver = getKeyboardDriver();

// Game state
const isPlaying = ref(false);
const isPaused = ref(false);
const score = ref(0);
const gameOver = ref(false);

// Balloon state
const leftInflation = ref(0);
const rightInflation = ref(0);
const leftPopped = ref(false);
const rightPopped = ref(false);

// Key hold state
const leftKeyHeld = ref(false);
const rightKeyHeld = ref(false);

// Timing
let animationFrame: number | null = null;
let startTime = 0;
let pauseStartTime = 0;
let totalPausedTime = 0;
const currentTime = ref(Date.now()); // For reactive computed styles

// Particle system
interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
  size: number;
}
const leftParticles: Particle[] = [];
const rightParticles: Particle[] = [];

// Game configuration constants
const MAX_INFLATION = 100;
const INFLATE_RATE = 0.3;
const DEFLATE_RATE = 0.008;
const WIN_DELAY_MS = 1200;
const GAME_DETECTION_THRESHOLD = 2.5;

// Canvas dimensions (responsive)
const canvasWidth = ref(800);
const canvasHeight = ref(600);

// SNR values (updated by game loop, consumed by UI)
const snr30Ref = ref(0);
const snr40Ref = ref(0);

// Frequency stats for GameStage display (reads from refs updated by game loop)
const frequencyStats = computed<FrequencyStat[]>(() => {
  const threshold = assrDetection.config.value.detectionThreshold;
  return [
    {
      frequency: 30,
      label: 'Left Ear (30 Hz)',
      snr: snr30Ref.value,
      snrFormatted: snr30Ref.value.toFixed(2),
      isActive: snr30Ref.value > threshold,
      triggerCount: keyboardDriver.getTriggerCount('move_left'),
    },
    {
      frequency: 40,
      label: 'Right Ear (40 Hz)',
      snr: snr40Ref.value,
      snrFormatted: snr40Ref.value.toFixed(2),
      isActive: snr40Ref.value > threshold,
      triggerCount: keyboardDriver.getTriggerCount('move_right'),
    },
  ];
});

// Computed balloon positions (responsive)
const BALLOON_WIDTH = 173; // Width of balloon-wrapper
const leftBalloonX = computed(() => canvasWidth.value * 0.33 - BALLOON_WIDTH / 2);
const rightBalloonX = computed(() => canvasWidth.value * 0.67 - BALLOON_WIDTH / 2);
const balloonY = computed(() => canvasHeight.value * 0.25); // Position in upper sky region

// Canvas ref
const canvasRef = ref<HTMLCanvasElement | null>(null);

// Computed styles for SVG balloons
const leftBalloonStyle = computed(() => {
  const t = leftInflation.value / MAX_INFLATION;
  const scale = 0.7 + t * 0.3;
  const translateY = -t * 30;
  const wobble = Math.sin((currentTime.value / 1000) * 2) * 2;

  return {
    transform: `
      translate(${leftBalloonX.value}px, ${balloonY.value + translateY}px)
      scale(${scale})
      rotate(${wobble}deg)
    `,
    filter: leftKeyHeld.value
      ? `drop-shadow(0 0 20px rgba(99, 102, 241, 0.6))`
      : 'none',
    transition: 'filter 0.2s ease',
  };
});

const rightBalloonStyle = computed(() => {
  const t = rightInflation.value / MAX_INFLATION;
  const scale = 0.7 + t * 0.3;
  const translateY = -t * 30;
  const wobble = Math.sin((currentTime.value / 1000 + 1.5) * 2) * 2;

  return {
    transform: `
      translate(${rightBalloonX.value}px, ${balloonY.value + translateY}px)
      scale(${scale})
      rotate(${wobble}deg)
    `,
    filter: rightKeyHeld.value
      ? `drop-shadow(0 0 20px rgba(239, 68, 68, 0.6))`
      : 'none',
    transition: 'filter 0.2s ease',
  };
});

const PROGRESS_RADIUS = 138;
const PROGRESS_CIRCUMFERENCE = 2 * Math.PI * PROGRESS_RADIUS;

const leftProgressDash = computed(() => {
  const offset = PROGRESS_CIRCUMFERENCE * (1 - leftInflation.value / MAX_INFLATION);
  return `${PROGRESS_CIRCUMFERENCE - offset} ${PROGRESS_CIRCUMFERENCE}`;
});

const rightProgressDash = computed(() => {
  const offset = PROGRESS_CIRCUMFERENCE * (1 - rightInflation.value / MAX_INFLATION);
  return `${PROGRESS_CIRCUMFERENCE - offset} ${PROGRESS_CIRCUMFERENCE}`;
});

// Computed elapsed time that accounts for paused time
const elapsedTime = computed(() => {
  if (!isPlaying.value) return 0;
  const now = currentTime.value;
  const currentPauseDuration = isPaused.value && pauseStartTime > 0 ? now - pauseStartTime : 0;
  return (now - startTime - totalPausedTime - currentPauseDuration) / 1000;
});

// Keyboard listener
const handleKeyDown = (event: KeyboardEvent) => {
  if (!isPlaying.value || isPaused.value || gameOver.value) return;

  const leftKey = keyboardDriver.getCurrentKey('move_left');
  const rightKey = keyboardDriver.getCurrentKey('move_right');

  if (event.code === leftKey) {
    event.preventDefault();
    leftKeyHeld.value = true;
  }
  if (event.code === rightKey) {
    event.preventDefault();
    rightKeyHeld.value = true;
  }
};

const handleKeyUp = (event: KeyboardEvent) => {
  const leftKey = keyboardDriver.getCurrentKey('move_left');
  const rightKey = keyboardDriver.getCurrentKey('move_right');

  if (event.code === leftKey) {
    leftKeyHeld.value = false;
  }
  if (event.code === rightKey) {
    rightKeyHeld.value = false;
  }
};

// Spawn particles for a pop
function spawnParticles(particles: Particle[], cx: number, cy: number, color1: string, color2: string): void {
  const colors = [
    color1,           // Primary balloon color
    color2,           // Secondary balloon color
    '#ffffff',        // White
    '#fef08a',        // Light yellow (flashy)
    '#fbbf24',        // Gold
    '#fde047',        // Bright yellow
    '#fef3c7',        // Cream (light accent)
  ];
  for (let i = 0; i < 40; i++) {
    const angle = (Math.PI * 2 * i) / 40 + Math.random() * 0.4;
    const speed = 3 + Math.random() * 5;
    particles.push({
      x: cx,
      y: cy,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 3,
      life: 1.0,
      color: colors[Math.floor(Math.random() * colors.length)],
      size: 4 + Math.random() * 6,
    });
  }
}

// Update particles
function updateParticles(particles: Particle[]): void {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx;
    p.y += p.vy;
    p.vy += 0.15; // gravity
    p.life -= 0.02;
    if (p.life <= 0) {
      particles.splice(i, 1);
    }
  }
}

// Start the game
const startGame = async () => {
  // Reset state
  leftInflation.value = 0;
  rightInflation.value = 0;
  leftPopped.value = false;
  rightPopped.value = false;
  leftKeyHeld.value = false;
  rightKeyHeld.value = false;
  score.value = 0;
  gameOver.value = false;
  isPlaying.value = true;
  isPaused.value = false;
  leftParticles.length = 0;
  rightParticles.length = 0;
  startTime = Date.now();
  pauseStartTime = 0;
  totalPausedTime = 0;

  // Configure ASSR detection threshold for this game
  assrDetection.updateConfig({
    detectionThreshold: GAME_DETECTION_THRESHOLD,
  });

  // Configure audio: independent ear, white noise, 30Hz left / 40Hz right
  await audioEngine.updateConfig({
    earMode: 'independent',
    left: {
      sourceType: 'whiteNoise',
      carrierFrequency: 1000,
      modulationFrequency: 30,
      modulationDepth: 0.5,
      volume: 0.3,
    },
    right: {
      sourceType: 'whiteNoise',
      carrierFrequency: 1000,
      modulationFrequency: 40,
      modulationDepth: 0.5,
      volume: 0.3,
    },
  });

  // Set cooldowns for the bindings (keys already configured by GameController)
  keyboardDriver.setCooldown(50, 'move_left');
  keyboardDriver.setCooldown(50, 'move_right');
  keyboardDriver.enable();
  keyboardDriver.resetTriggerCount('move_left');
  keyboardDriver.resetTriggerCount('move_right');

  // Start audio (updateConfig already started if it was playing, so check first)
  if (!audioEngine.isPlaying.value) {
    await audioEngine.toggle();
  }

  emit('game-start');
  gameLoop();
};

// Pause/Resume
const togglePause = async () => {
  console.log('Toggling pause. Currently paused:', isPaused.value);
  isPaused.value = !isPaused.value;

  if (isPaused.value) {
    pauseStartTime = Date.now();
    if (audioEngine.isPlaying.value) {
      await audioEngine.toggle();
    }
  } else {
    // Add the pause duration to total paused time
    if (pauseStartTime > 0) {
      totalPausedTime += Date.now() - pauseStartTime;
      pauseStartTime = 0;
    }
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

  keyboardDriver.disable();
  keyboardDriver.clearBindings();
  if (audioEngine.isPlaying.value) {
    await audioEngine.toggle();
  }
};

// Game loop
const gameLoop = () => {
  if (!isPlaying.value || isPaused.value) return;

  currentTime.value = Date.now();
  update();
  renderParticles();

  animationFrame = requestAnimationFrame(gameLoop);
};
const renderParticles = () => {
  const canvas = canvasRef.value;
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  ctx.clearRect(0, 0, canvasWidth.value, canvasHeight.value);
  drawParticles(ctx, leftParticles);
  drawParticles(ctx, rightParticles);
};

// Update game state
const update = () => {
  if (gameOver.value) return;

  // Compute SNR once per frame (source of truth for both game logic and UI)
  snr30Ref.value = assrDetection.computeSNRAtFrequency(30);
  snr40Ref.value = assrDetection.computeSNRAtFrequency(40);

  // Compute detection state using ASSR threshold (consistent with UI)
  const threshold = assrDetection.config.value.detectionThreshold;
  const leftFocused = snr30Ref.value > threshold;
  const rightFocused = snr40Ref.value > threshold;

  keyboardDriver.triggerOnDetection(leftFocused, 'move_left');
  keyboardDriver.triggerOnDetection(rightFocused, 'move_right');

  // Inflate/deflate left balloon
  if (!leftPopped.value) {
    if (leftKeyHeld.value) {
      leftInflation.value = Math.min(MAX_INFLATION, leftInflation.value + INFLATE_RATE);
    } else {
      leftInflation.value = Math.max(0, leftInflation.value - DEFLATE_RATE);
    }
    if (leftInflation.value >= MAX_INFLATION) {
      leftPopped.value = true;
      spawnParticles(leftParticles, leftBalloonX.value, balloonY.value, '#6366f1', '#818cf8');
    }
  }

  // Inflate/deflate right balloon
  if (!rightPopped.value) {
    if (rightKeyHeld.value) {
      rightInflation.value = Math.min(MAX_INFLATION, rightInflation.value + INFLATE_RATE);
    } else {
      rightInflation.value = Math.max(0, rightInflation.value - DEFLATE_RATE);
    }
    if (rightInflation.value >= MAX_INFLATION) {
      rightPopped.value = true;
      spawnParticles(rightParticles, rightBalloonX.value, balloonY.value, '#ef4444', '#f97316');
    }
  }

  // Update particles
  updateParticles(leftParticles);
  updateParticles(rightParticles);

  // Check win condition
  if (leftPopped.value && rightPopped.value && !gameOver.value) {
    score.value = Math.round(elapsedTime.value * 10) / 10;
    emit('score-update', score.value);

    setTimeout(async () => {
      gameOver.value = true;
      if (audioEngine.isPlaying.value) {
        await audioEngine.toggle();
      }
      keyboardDriver.disable();
      emit('game-over', score.value);
    }, WIN_DELAY_MS);
  }
};

// Draw particles with glow effect
function drawParticles(ctx: CanvasRenderingContext2D, particles: Particle[]): void {
  ctx.save();
  for (const p of particles) {
    ctx.globalAlpha = p.life;

    // Glow effect
    ctx.shadowColor = p.color;
    ctx.shadowBlur = 10 * p.life;

    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

// Resize canvas to fit screen
const resizeCanvas = () => {
  if (!canvasRef.value) return;
  const container = canvasRef.value.parentElement;
  if (!container) return;

  canvasWidth.value = container.clientWidth;
  canvasHeight.value = container.clientHeight;
  canvasRef.value.width = canvasWidth.value;
  canvasRef.value.height = canvasHeight.value;
};

// Lifecycle
onMounted(() => {
  window.addEventListener('keydown', handleKeyDown);
  window.addEventListener('keyup', handleKeyUp);
  window.addEventListener('resize', resizeCanvas);
  setTimeout(resizeCanvas, 0);
});

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyDown);
  window.removeEventListener('keyup', handleKeyUp);
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
  <div class="balloons-game">
    <!-- Background -->
    <div class="sketchbook-background" />

    <!-- SVG Filter Definitions -->
    <svg style="position: absolute; width: 0; height: 0">
      <defs>
        <filter id="sketchy">
          <feTurbulence type="fractalNoise" baseFrequency="0.05" numOctaves="3" result="noise"/>
          <feDisplacementMap in="SourceGraphic" in2="noise" scale="1.5" xChannelSelector="R" yChannelSelector="G"/>
        </filter>
      </defs>
    </svg>

    <!-- Balloon Container -->
    <div class="balloons-container">
      <!-- Left Balloon (Blue, 30Hz) -->
      <div v-if="!leftPopped" class="balloon-wrapper" :style="leftBalloonStyle">
        <inline-svg :src="require('./assets/balloons_blue.svg')" class="balloon-svg" />
        <svg class="progress-ring" :class="{ focused: leftKeyHeld }">
          <circle class="progress-circle left-circle" :stroke-dasharray="leftProgressDash" stroke-dashoffset="0" r="138" cx="150" cy="150" />
        </svg>
        <div class="balloon-label">
          <div class="inflation-percent">{{ Math.round(leftInflation) }}%</div>
          <div class="frequency-label">30 Hz · Left Ear</div>
        </div>
      </div>

      <!-- Right Balloon (Orange, 40Hz) -->
      <div v-if="!rightPopped" class="balloon-wrapper" :style="rightBalloonStyle">
        <inline-svg :src="require('./assets/balloons_orange.svg')" class="balloon-svg" />
        <svg class="progress-ring" :class="{ focused: rightKeyHeld }">
          <circle class="progress-circle right-circle" :stroke-dasharray="rightProgressDash" stroke-dashoffset="0" r="138" cx="150" cy="150" />
        </svg>
        <div class="balloon-label">
          <div class="inflation-percent">{{ Math.round(rightInflation) }}%</div>
          <div class="frequency-label">40 Hz · Right Ear</div>
        </div>
      </div>
    </div>

    <!-- Canvas for Particles Only -->
    <canvas
      ref="canvasRef"
      class="particles-canvas"
      :width="canvasWidth"
      :height="canvasHeight"
    />

    <!-- Timer -->
    <div v-if="isPlaying && !gameOver" class="timer-card">
      {{ elapsedTime.toFixed(1) }}s
    </div>

    <!-- Start Screen -->
    <div v-if="!isPlaying" class="start-overlay">
      <div class="overlay-content">
        <div class="content-card">
          <span class="game-emoji">🎈</span>
          <h2>Ready to Play?</h2>
          <p>Focus on stereo sound to inflate balloons</p>

          <!-- Instructions Section -->
          <div class="instructions-section">
            <h3 class="instructions-heading">How to Play:</h3>
            <ol class="instructions-list">
              <li v-for="(instruction, index) in gameConfig.instructions" :key="index">
                {{ instruction }}
              </li>
            </ol>
          </div>

          <VBtn
            class="sketchy-button"
            size="large"
            @click="startGame"
          >
            Start Game
          </VBtn>
        </div>
      </div>
    </div>

    <!-- End Screen -->
    <div v-if="gameOver" class="game-over-overlay">
      <div class="overlay-content">
        <div class="content-card">
          <h2>Both Popped!</h2>
          <div class="score">Time: {{ score }}s</div>
        </div>
      </div>
    </div>

    <!-- Pause overlay -->
    <div v-if="isPaused && isPlaying" class="pause-overlay">
      <div class="overlay-content">
        <div class="content-card">
          <h2>Paused</h2>
          <VBtn
            class="sketchy-button"
            size="large"
            @click="togglePause"
          >
            Resume
          </VBtn>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Caveat:wght@400;700&display=swap');

.balloons-game {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  font-family: 'Caveat', cursive;
  overflow: hidden;
}

/* Background */
.sketchbook-background {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-image: url('./assets/sketchbook_scenic_background.webp');
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
}

/* Balloons */
.balloons-container {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
}

.balloon-wrapper {
  position: absolute;
  top: 0;
  left: 0;
  width: 173px;
  height: 460px;
  transform-origin: center center;
  will-change: transform;
  transition: transform 0.05s linear;
}

.balloon-svg {
  width: 100%;
  height: 100%;
  filter: drop-shadow(0 4px 10px rgba(0, 0, 0, 0.2));
}

/* Progress Ring */
.progress-ring {
  position: absolute;
  top: 23%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 300px;
  height: 300px;
  pointer-events: none;
}

.progress-circle {
  fill: none;
  stroke-width: 4;
  stroke-linecap: round;
  transform: rotate(-90deg);
  transform-origin: center;
  transition: stroke-dashoffset 0.1s ease;
  filter: url(#sketchy);
}

.progress-circle.left-circle {
  stroke: #6366f1;
}

.progress-circle.right-circle {
  stroke: #ef4444;
}

.progress-ring.focused .progress-circle {
  stroke-width: 6;
  filter: drop-shadow(0 0 10px currentColor) url(#sketchy);
}

/* Labels */
.balloon-label {
  position: absolute;
  bottom: -60px;
  left: 50%;
  transform: translateX(-50%);
  text-align: center;
  pointer-events: none;
  white-space: nowrap;
}

.inflation-percent {
  font-size: 28px;
  font-weight: 700;
  color: #333;
  margin-bottom: 4px;
  text-shadow: 1px 1px 0 rgba(255, 255, 255, 0.8);
}

.frequency-label {
  font-size: 20px;
  font-weight: 700;
  color: #333;
  background: rgba(255, 249, 230, 0.9);
  padding: 8px 16px;
  border-radius: 12px;
  border: 3px solid #333;
  box-shadow: 3px 3px 0 rgba(0, 0, 0, 0.2);
}

/* Particles Canvas */
.particles-canvas {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 10;
}

/* Timer */
.timer-card {
  position: absolute;
  top: 20px;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(255, 249, 230, 0.9);
  padding: 12px 24px;
  border-radius: 12px;
  border: 3px solid #333;
  font-size: 32px;
  font-weight: 700;
  color: #333;
  box-shadow: 3px 3px 0 rgba(0, 0, 0, 0.2);
  z-index: 5;
  min-width: 120px;
  text-align: center;
}

/* Overlays - Shared base styles */
.start-overlay,
.game-over-overlay,
.pause-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* Start/End overlay specific background */
.start-overlay,
.game-over-overlay {
  z-index: 20;
  background-image: url('./assets/sketchbook_scenic_background_bw.webp');
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
}

.overlay-content {
  position: relative;
  text-align: center;
  z-index: 1;
}

.content-card {
  background: rgba(255, 255, 255, 0.5);
  backdrop-filter: blur(8px);
  padding: 34px 45px;
  border-radius: 20px;
  border: 2px solid rgba(51, 51, 51, 0.3);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
  position: relative;
}

.game-emoji {
  font-size: 80px;
  display: block;
  margin-bottom: 20px;
  animation: bounce 2s ease-in-out infinite;
}

@keyframes bounce {
  0%, 100% { transform: translateY(0) scale(1); }
  50% { transform: translateY(-15px) scale(1.05); }
}

.overlay-content h2 {
  font-size: 48px;
  font-weight: 700;
  color: #333;
  margin-bottom: 12px;
  text-shadow: 1px 1px 2px rgba(255, 255, 255, 0.5);
}

.overlay-content p {
  font-size: 24px;
  color: #555;
  margin-bottom: 32px;
}

/* Instructions Section */
.instructions-section {
  text-align: left;
  margin-top: 20px;
  padding-top: 16px;
  border-top: 2px dashed rgba(51, 51, 51, 0.2);
}

.instructions-heading {
  font-size: 22px;
  font-weight: 700;
  color: #333;
  margin-bottom: 8px;
}

.instructions-list {
  font-size: 16px;
  color: #555;
  padding-left: 20px;
  margin: 0 0 24px 0;
  line-height: 1.4;
}

.instructions-list li {
  margin-bottom: 4px;
}

.score {
  font-size: 48px;
  font-weight: 700;
  color: #f59e0b;
  margin-top: 16px;
  text-shadow: 1px 1px 2px rgba(251, 191, 36, 0.3);
}

.sketchy-button {
  font-family: 'Caveat', cursive !important;
  font-size: 28px !important;
  font-weight: 700 !important;
  text-transform: none !important;
  background: rgba(255, 255, 255, 0.8) !important;
  color: #333 !important;
  border: 2px solid rgba(51, 51, 51, 0.4) !important;
  border-radius: 16px !important;
  padding: 12px 32px !important;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15) !important;
  transition: all 0.15s ease !important;
  min-width: 200px !important;
  display: inline-flex !important;
  align-items: center !important;
  justify-content: center !important;
  line-height: 1 !important;
}

.sketchy-button:hover {
  transform: translateY(-2px) !important;
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.2) !important;
  background: rgba(255, 255, 255, 0.95) !important;
  border-color: rgba(51, 51, 51, 0.5) !important;
}

.sketchy-button:active {
  transform: translateY(0) !important;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15) !important;
}

/* Pause overlay specific styles */
.pause-overlay {
  z-index: 25;
  background-image: url('./assets/sketchbook_scenic_background_bw.webp');
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
}

/* Responsive */
@media (max-width: 768px) {
  .balloon-wrapper {
    width: 138px;
    height: 368px;
  }

  .progress-ring {
    width: 253px;
    height: 253px;
  }

  .timer-card {
    font-size: 24px;
    padding: 8px 16px;
    min-width: 90px;
  }

  .content-card {
    padding: 24px 28px;
  }

  .overlay-content h2 {
    font-size: 36px;
  }

  .overlay-content p {
    font-size: 18px;
  }

  .game-emoji {
    font-size: 60px;
  }

  .score {
    font-size: 32px;
  }

  .sketchy-button {
    font-size: 22px !important;
    min-width: 160px !important;
  }

  .instructions-heading {
    font-size: 18px;
  }

  .instructions-list {
    font-size: 14px;
  }

  .inflation-percent {
    font-size: 22px;
  }

  .frequency-label {
    font-size: 16px;
  }
}
</style>
