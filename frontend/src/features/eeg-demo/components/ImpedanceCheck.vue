<script setup lang="ts">
/**
 * ImpedanceCheck Component
 * 
 * Wrapper for impedance check that integrates with the demo flow.
 * Reuses the existing Audio and Impedance panel components from the main app.
 */

import { ref, computed, defineEmits } from 'vue';
import { PhArrowRight, PhSkipForward, PhWaveform, PhSpeakerHigh, PhCheckCircle, PhUserCheck } from '@phosphor-icons/vue';
import { useOpenBCIUtils } from '@/utils/hooks';

// Import the existing panel components from main app
import OptimizeSignalAudioAndImpedancePanelAudioPanel from '@/components/audioAndImpedancePanel/components/OptimizeSignalAudioAndImpedancePanelAudioPanel.vue';
import OptimizeSignalAudioAndImpedancePanelImpedancePanel from '@/components/audioAndImpedancePanel/components/OptimizeSignalAudioAndImpedancePanelImpedancePanel.vue';

const emit = defineEmits(['continue', 'skip', 'impedance-running-change']);

const {
  runImpedanceCheck: baseRunImpedanceCheck,
  startSignalQualityCheck,
  isImpedanceCheckRunning, 
  impedanceCheckChannel,
  resumeRecordingAfterImpedance
} = useOpenBCIUtils();

const impedanceRunning = ref(false);

// Wrap runImpedanceCheck to ensure the data stream loop is running.
// In the main app, startRecording() starts this loop, but we don't call that here.
const runImpedanceCheck = async () => {
  impedanceRunning.value = true;
  emit('impedance-running-change', true);
  await startSignalQualityCheck();
  try {
    await baseRunImpedanceCheck();
  } finally {
    impedanceRunning.value = false;
    emit('impedance-running-change', false);
  }
};

const currentStep = ref<'intro' | 'audio' | 'impedance' | 'complete'>('intro');

// Handle navigation ourselves instead of routing
const handleImpedanceComplete = async () => {
  await handleResumeRecording();
  currentStep.value = 'complete';
};

const handleResumeRecording = async () => {
  await resumeRecordingAfterImpedance();
};

const handleAudioClose = () => {
  currentStep.value = 'impedance';
};

const handleStart = () => {
  currentStep.value = 'audio';
};

const handleContinue = () => {
  emit('continue');
};

const handleSkip = () => {
  emit('skip');
};

const stepNumber = computed(() => {
  switch (currentStep.value) {
    case 'intro': return 0;
    case 'audio': return 1;
    case 'impedance': return 2;
    case 'complete': return 3;
    default: return 0;
  }
});
</script>

<template>
  <div class="impedance-check pa-4">
    <div class="text-center mb-6">
      <div class="d-flex justify-center align-center mb-4">
        <PhWaveform :size="48" color="#00876c" />
      </div>
      <h3 class="text-h5 font-weight-bold mb-2">Signal Check</h3>
      <p class="text-body-1 text-grey-darken-1">
        Let's verify your EEG headset is working properly
      </p>
    </div>

    <div class="step-indicator d-flex justify-center mb-6">
      <div 
        v-for="(step, index) in ['Intro', 'Audio', 'Impedance', 'Done']" 
        :key="step"
        class="step-item d-flex align-center"
      >
        <v-avatar 
          :color="index <= stepNumber ? '#00876c' : 'grey-lighten-2'" 
          size="28"
        >
          <span class="text-white text-caption font-weight-bold">{{ index + 1 }}</span>
        </v-avatar>
        <span 
          class="step-label ml-1 mr-4 text-caption"
          :class="index <= stepNumber ? 'text-grey-darken-2' : 'text-grey'"
        >
          {{ step }}
        </span>
      </div>
    </div>

    <v-card class="content-card mb-6" variant="outlined">
      <!-- Intro Step -->
      <div v-if="currentStep === 'intro'" class="pa-8 text-center d-flex flex-column align-center">
        <div class="mb-4">
          <PhUserCheck :size="64" color="#00876c" />
        </div>
        
        <h3 class="text-h5 font-weight-bold mb-2">Ready to Check Your Signal?</h3>
        
        <p class="text-body-1 text-grey-darken-1 mb-6" style="max-width: 500px;">
          This process includes two steps:
        </p>
        
        <v-list density="compact" class="bg-transparent mb-6 text-left" style="max-width: 400px; width: 100%;">
          <v-list-item>
            <template #prepend>
              <PhSpeakerHigh :size="24" color="#00876c" class="mr-3" />
            </template>
            <v-list-item-title class="text-body-2">
              <strong>Audio Baseline</strong> - 60 seconds of relaxed listening
            </v-list-item-title>
          </v-list-item>
          
          <v-list-item>
            <template #prepend>
              <PhWaveform :size="24" color="#00876c" class="mr-3" />
            </template>
            <v-list-item-title class="text-body-2">
              <strong>Impedance Check</strong> - Verify electrode connections
            </v-list-item-title>
          </v-list-item>
        </v-list>

        <v-btn class="mb-8"
          :append-icon="PhArrowRight"
          @click="handleStart"
        >
          Begin Signal Check
        </v-btn>

        <v-card
          v-if="currentStep === 'intro'" 
          class="tip-card" 
          max-width="600" 
          variant="tonal" 
          color="info"
          style="margin: 0 auto;"
        >
          <v-card-text class="pa-4">
            <div class="d-flex align-start">
              <v-icon class="mr-3" color="info">mdi-lightbulb-outline</v-icon>
              <p class="text-body-2 mb-0">
                <strong>Tip:</strong> Make sure the electrodes have good contact with your scalp. 
                Part your hair if needed and ensure the headset fits snugly.
              </p>
            </div>
          </v-card-text>
        </v-card>
      </div>

      <!-- Audio Panel Step -->
      <div v-else-if="currentStep === 'audio'" class="panel-container">
        <OptimizeSignalAudioAndImpedancePanelAudioPanel
          @close="handleAudioClose"
        />
      </div>

      <!-- Impedance Panel Step -->
      <div v-else-if="currentStep === 'impedance'" class="panel-container">
        <OptimizeSignalAudioAndImpedancePanelImpedancePanel
          :is-impedance-check-running="impedanceRunning || isImpedanceCheckRunning"
          :impedance-check-channel="impedanceCheckChannel"
          :run-impedance-check="runImpedanceCheck"
          :stop-recording="handleResumeRecording"
          next-route=""
          description="Measuring electrode impedance.<br />This ensures optimal signal quality for the demo."
          @close="handleImpedanceComplete"
        />
      </div>

      <!-- Complete Step -->
      <div v-else-if="currentStep === 'complete'" class="pa-8 text-center d-flex flex-column align-center">
        <div class="mb-4">
          <PhCheckCircle :size="64" color="#00876c" weight="fill" />
        </div>
        
        <h3 class="text-h5 font-weight-bold mb-2">Signal Check Complete!</h3>
        
        <p class="text-body-1 text-grey-darken-1 mb-6" style="max-width: 500px;">
          Your EEG headset is ready. You can now proceed to signal visualization.
        </p>

        <v-btn
          :append-icon="PhArrowRight"
          @click="handleContinue"
        >
          Continue to Visualization
        </v-btn>
      </div>
    </v-card>

    <!-- Skip Button (only visible if neither the audio check nor the impedance check is running) -->
    <div v-if="currentStep === 'intro'" class="d-flex justify-center">
      <v-btn
        variant="text"
        color="grey"
        :prepend-icon="PhSkipForward"
        @click="handleSkip"
      >
        Skip for now
      </v-btn>
    </div>
  </div>
</template>

<style scoped>
.impedance-check {
  max-width: 900px;
  margin: 0 auto;
}

.content-card {
  border-radius: 12px;
  overflow: hidden;
  min-height: 500px;
}

.panel-container {
  position: relative;
  min-height: 500px;
  display: flex;
  flex-direction: column;
}

/* Override panel styles to remove modal behavior */
.panel-container :deep(.flex-grow-1) {
  position: relative !important;
  width: 100% !important;
  height: auto !important;
  min-height: 100% !important;
  overflow: visible !important;
  padding-top: 12px !important;
}

/* Override panel typography to match demo theme */
.panel-container :deep(h1) {
  font-size: 1.5rem !important;
  font-weight: 700 !important;
  color: rgba(0, 0, 0, 0.87) !important;
  margin-bottom: 8px !important;
}

.panel-container :deep(p) {
  font-size: 1rem !important;
  color: rgba(0, 0, 0, 0.6) !important;
  line-height: 1.5 !important;
}

/* Adjust spacing in panels */
.panel-container :deep(.mb-8) {
  margin-bottom: 16px !important;
}

/* Remove shadows from panel controls */
.panel-container :deep(.v-row) {
  box-shadow: none !important;
  background: transparent !important;
  backdrop-filter: none !important;
  -webkit-backdrop-filter: none !important;
}

.panel-container :deep(.v-progress-linear) {
  margin-left: 82px !important;
}

.step-indicator {
  flex-wrap: wrap;
  gap: 4px;
}

.step-item {
  opacity: 0.9;
}

.tip-card {
  border-radius: 12px;
}
</style>
