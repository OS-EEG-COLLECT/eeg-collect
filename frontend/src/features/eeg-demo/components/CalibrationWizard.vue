<script setup lang="ts">
/**
 * CalibrationWizard Component
 *
 * Records a baseline noise floor during silence to establish
 * the SNR denominator for ASSR focus detection.
 */

import { ref, inject, computed, onUnmounted, watch } from 'vue';
import {
  PhArrowRight,
  PhX,
  PhBrain,
  PhCheckCircle,
  PhTarget,
  PhSkipForward
} from '@phosphor-icons/vue';
import type { CalibrationResult } from '../composables';
import type { UseASSRDetectionReturn } from '../composables/useASSRDetection';

const emit = defineEmits(['complete', 'cancel', 'skip', 'recording-state']);

// Inject pipeline from DemoContainer
const assrDetection = inject<UseASSRDetectionReturn>('assrDetection')!;

const hasStarted = ref(false);
const isComplete = ref(false);
const isRunning = ref(false);
const calibrationResult = ref<CalibrationResult | null>(null);

const progressPercent = computed(() => assrDetection.calibration.value.baselineProgress);

// Emit recording state changes so parent can hide dolphin button
watch(isRunning, (running) => {
  emit('recording-state', running);
});

const handleStart = async () => {
  if (isRunning.value) return;
  hasStarted.value = true;
  isRunning.value = true;

  try {
    const noisePower = await assrDetection.recordBaseline(10000);

    if (noisePower > 0) {
      calibrationResult.value = {
        baselineNoisePower: noisePower,
        threshold: assrDetection.config.value.detectionThreshold,
      };
      isComplete.value = true;
    }
  } finally {
    isRunning.value = false;
  }
};

const handleCancel = () => {
  assrDetection.cancelBaselineRecording();
  isRunning.value = false;
  emit('cancel');
};

const handleSkip = () => {
  emit('skip');
};

const handleContinue = () => {
  if (calibrationResult.value) {
    emit('complete', calibrationResult.value);
  }
};

onUnmounted(() => {
  if (isRunning.value) {
    assrDetection.cancelBaselineRecording();
  }
});
</script>

<template>
  <VCol class="calibration-wizard d-flex flex-column align-center justify-center pa-8">
    <!-- Pre-start State -->
    <template v-if="!hasStarted">
      <div class="text-center mb-8">
        <div class="d-flex justify-center align-center mb-4">
          <PhTarget :size="64" color="#00876c" />
        </div>
        <h1 class="text-h4 font-weight-bold mb-2">
          Baseline Calibration
        </h1>
        <p class="text-body-1 text-grey">
          We'll record your brain's resting noise floor
        </p>
      </div>

      <VCard class="instruction-card mb-8 px-4 py-6" max-width="600" variant="outlined">
        <VCardText class="pa-0">
          <h3 class="text-h6 mb-3">How it works:</h3>

          <div class="phase-explanation mb-4">
            <div class="d-flex align-center mb-4">
              <VAvatar color="grey-lighten-2" size="48" class="mr-4">
                <PhBrain :size="28" color="#78909c" />
              </VAvatar>
              <div>
                <strong>Resting Baseline</strong> (10 seconds)
                <p class="text-body-2 text-grey mb-0">
                  Close your eyes, relax, and stay still. We'll measure the
                  background noise level near the target frequency while you rest. No sound will play.
                </p>
              </div>
            </div>
          </div>

          <VDivider class="my-4" />

          <p class="text-body-2 text-grey">
            This single recording establishes a reference noise floor.
            Focus detection will then compare the signal power against this baseline.
          </p>
        </VCardText>
      </VCard>

      <VBtn class="mb-6"
        :append-icon="PhArrowRight"
        @click="handleStart"
      >
        Begin Recording
      </VBtn>

      <VBtn
        variant="text"
        color="grey"
        :prepend-icon="PhSkipForward"
        @click="handleSkip"
      >
        Skip for now
      </VBtn>
    </template>

    <!-- Running State -->
    <template v-else-if="!isComplete">
      <div class="calibration-display text-center">
        <div
          class="phase-circle mb-6"
          style="border-color: #78909c; background-color: rgba(120, 144, 156, 0.08)"
        >
          <PhBrain :size="64" color="#78909c" />
        </div>

        <h2 class="text-h4 font-weight-bold mb-2" style="color: #78909c">
          Recording baseline...
        </h2>

        <p class="text-h6 text-grey mb-6">
          Stay relaxed, eyes closed
        </p>

        <VProgressLinear
          :model-value="progressPercent"
          color="blue-grey"
          height="8"
          rounded
          class="mb-8"
          style="max-width: 400px; margin: 0 auto;"
        />

        <VBtn
          variant="outlined"
          color="error"
          :prepend-icon="PhX"
          @click="handleCancel"
        >
          Cancel
        </VBtn>
      </div>
    </template>

    <!-- Complete State -->
    <template v-else>
      <div class="text-center mb-8">
        <div class="d-flex justify-center align-center mb-4">
          <PhCheckCircle :size="80" color="#00876c" weight="fill" />
        </div>

        <h1 class="text-h4 font-weight-bold mb-2">
          Baseline Recorded!
        </h1>
        <p class="text-body-1 text-grey">
          Your baseline has been recorded and the system is ready
        </p>
      </div>

      <VCard class="results-card mb-8 px-4 py-6" max-width="500" v-if="calibrationResult" variant="outlined">
        <VCardText class="pa-0">
          <h3 class="text-h6 mb-3">Your Results</h3>

          <div class="result-stat text-center mb-4">
            <span class="text-h5 font-weight-bold" style="color: #78909c; font-family: 'Roboto Mono', monospace">
              {{ calibrationResult.baselineNoisePower.toExponential(2) }}
            </span>
            <p class="text-caption text-grey mb-0">Baseline Noise Power (µV²)</p>
          </div>

          <VDivider class="mb-4" />

          <div class="d-flex align-center justify-center">
            <PhTarget :size="24" color="#00876c" class="mr-2" />
            <span class="text-body-1">
              Detection threshold:
              <strong>{{ calibrationResult.threshold.toFixed(1) }}</strong> SNR
            </span>
          </div>
        </VCardText>
      </VCard>

      <VBtn
        :append-icon="PhArrowRight"
        @click="handleContinue"
      >
        Continue to Game Setup
      </VBtn>
    </template>
  </VCol>
</template>

<style scoped>
.calibration-wizard {
  min-height: calc(100vh - 140px);
}

.instruction-card {
  border-radius: 12px;
  border-color: #e0e0e0;
}

.phase-circle {
  width: 150px;
  height: 150px;
  border-radius: 50%;
  border: 4px solid;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto;
  transition: all 0.3s ease;
}

.calibration-display {
  animation: fadeIn 0.3s ease;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}

.results-card {
  border-radius: 12px;
  border-color: #e0e0e0;
}

.result-stat {
  text-align: center;
}
</style>
