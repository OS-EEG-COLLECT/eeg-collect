<script setup lang="ts">
/**
 * DemoContainer Component
 * 
 * Main wrapper component that manages the demo flow between steps.
 */

import { ref, provide, onMounted, onUnmounted, computed, defineEmits, defineProps } from 'vue';
import { PhArrowLeft, PhX, PhArrowsIn, PhArrowsOut } from '@phosphor-icons/vue';
import { useFullscreen } from '../composables';
import { useASSRDetection } from '../composables/useASSRDetection';
import { useAudioEngine } from '../composables/useAudioEngine';

import WelcomeScreen from './WelcomeScreen.vue';
import ImpedanceCheck from './ImpedanceCheck.vue';
import SignalVisualization from './SignalVisualization.vue';
import CalibrationWizard from './CalibrationWizard.vue';
import GameGallery from './GameGallery.vue';
import GameController from './GameController.vue';
import GameStage from './GameStage.vue';
import DeepDiveExplainer from './deep-dive/DeepDiveExplainer.vue';

import { resetKeyboardDriver } from '../services';
import type { CalibrationResult } from '../composables';

const props = defineProps({
  channelIndex: {
    type: Number,
    required: false,
    default: 0,
  },
});

const emit = defineEmits(['exit']);

type DemoStep = 'welcome' | 'impedance' | 'visualization' | 'calibration' | 'gallery' | 'controller' | 'game';

const currentStep = ref<DemoStep>('welcome');
const calibrationResult = ref<CalibrationResult | null>(null);
const selectedGameId = ref<string>('flappy-brain');
const impedanceCheckRunning = ref(false); // To track impedance check state to disable back button

// Track welcome splash state and calibration recording for hiding dolphin button
const welcomeSplashActive = ref(true);
const calibrationRecording = ref(false);
const hideDeepDive = computed(() => {
  // Hide during welcome splash
  if (currentStep.value === 'welcome' && welcomeSplashActive.value) return true;
  // Hide during active calibration recording (not before or after)
  if (currentStep.value === 'calibration' && calibrationRecording.value) return true;
  return false;
});

const stepConfig = {
  welcome: { title: 'Welcome', showBack: false },
  impedance: { title: 'Signal Check', showBack: true },
  visualization: { title: 'Signal Visualization', showBack: true },
  calibration: { title: 'Calibration', showBack: true },
  gallery: { title: 'Choose a Game', showBack: true },
  controller: { title: 'Game Settings', showBack: true },
  game: { title: 'Play', showBack: false },
};

const goToStep = (step: DemoStep) => {
  currentStep.value = step;
};

const handleBack = () => {
  if (isBackDisabled.value) return;
  const stepOrder: DemoStep[] = ['welcome', 'impedance', 'visualization', 'calibration', 'gallery', 'controller', 'game'];
  const currentIndex = stepOrder.indexOf(currentStep.value);
  if (currentIndex > 0) {
    currentStep.value = stepOrder[currentIndex - 1];
  }
};

const isBackDisabled = computed(
  () => currentStep.value === 'impedance' && impedanceCheckRunning.value,
);

const handleWelcomeSplashEnd = () => {
  welcomeSplashActive.value = false;
};

const handleCalibrationRecordingState = (isRecording: boolean) => {
  calibrationRecording.value = isRecording;
};

const handleWelcomeContinue = () => {
  goToStep('impedance');
};

const handleImpedanceContinue = () => {
  goToStep('visualization');
};

const handleImpedanceSkip = () => {
  goToStep('visualization');
};

const handleImpedanceRunningChange = (running: boolean) => {
  impedanceCheckRunning.value = running;
};

const handleVisualizationContinue = () => {
  goToStep('calibration');
};

const handleVisualizationSkip = () => {
  goToStep('calibration');
};

const handleCalibrationComplete = (result: CalibrationResult) => {
  calibrationResult.value = result;
  goToStep('gallery');
};

const handleCalibrationCancel = () => {
  goToStep('visualization');
};

const handleCalibrationSkip = () => {
  goToStep('gallery');
};

const handleGallerySelect = (gameId: string) => {
  selectedGameId.value = gameId;
  goToStep('controller');
};

const handleGalleryBack = () => {
  goToStep('calibration');
};

const handleControllerContinue = () => {
  goToStep('game');
};

const handleControllerBack = () => {
  goToStep('gallery');
};

const handleGameBack = () => {
  goToStep('controller');
};

const handleGameRestart = () => {
  goToStep('calibration');
};

const handleGamePickGame = () => {
  goToStep('gallery');
};

const handleExit = () => {
  cleanup();
  emit('exit');
};

const cleanup = () => {
  assrDetection.stop();
  audioEngine.dispose();
  resetKeyboardDriver();
};

onUnmounted(() => {
  cleanup();
});

provide('channelIndex', props.channelIndex ?? 0);

const assrDetection = useASSRDetection();
const audioEngine = useAudioEngine();
provide('assrDetection', assrDetection);
provide('audioEngine', audioEngine);

onMounted(() => {
  assrDetection.start();
});

const { isFullscreen, enterFullscreen, exitFullscreen } = useFullscreen();

const isInFullscreen = computed(() => isFullscreen.value);

const handleEnterFullscreen = async () => {
  await enterFullscreen();
};

const handleExitFullscreen = async () => {
  await exitFullscreen();
};
</script>

<template>
  <div class="demo-container" :class="{ 'demo-container-fullscreen': isInFullscreen }">
    <div class="demo-header d-flex align-center px-4 py-2" :class="{ 'demo-header-compact': isInFullscreen }">
      <VBtn
        v-if="stepConfig[currentStep].showBack"
        icon
        variant="text"
        size="x-small"
        color="grey-darken-1"
        @click="handleBack"
        class="mr-2"
        :disabled="isBackDisabled"
      >
        <PhArrowLeft :size="18" />
      </VBtn>
      
      <h2 class="text-h6 font-weight-bold flex-grow-1">
        {{ stepConfig[currentStep].title }}
      </h2>
      
      <div class="step-indicator d-flex align-center mr-4" :class="{ 'step-indicator-compact': isInFullscreen }">
        <div 
          v-for="(step, index) in ['welcome', 'impedance', 'visualization', 'calibration', 'gallery', 'controller', 'game']" 
          :key="step"
          class="step-dot"
          :class="{ 
            active: step === currentStep,
            completed: ['welcome', 'impedance', 'visualization', 'calibration', 'gallery', 'controller', 'game'].indexOf(currentStep) > index
          }"
        />
      </div>
      
      <VBtn
        v-if="isInFullscreen"
        icon
        variant="text"
        size="x-small"
        color="grey-darken-1"
        @click="handleExitFullscreen"
        title="Exit Fullscreen (Esc)"
        class="mr-1"
      >
        <PhArrowsIn :size="18" />
      </VBtn>
      <VBtn
        v-else
        icon
        variant="text"
        size="x-small"
        color="grey-darken-1"
        @click="handleEnterFullscreen"
        title="Enter Fullscreen"
        class="mr-1"
      >
        <PhArrowsOut :size="18" />
      </VBtn>

      <VBtn
        icon
        variant="text"
        size="x-small"
        color="grey-darken-1"
        @click="handleExit"
      >
        <PhX :size="18" />
      </VBtn>
    </div>

    <DeepDiveExplainer
      :step="currentStep"
      :visible="currentStep !== 'game'"
      :fullscreen="isInFullscreen"
      :hide="hideDeepDive"
    />

    <div class="demo-content">
      <Transition name="slide-fade" mode="out-in">
        <WelcomeScreen
          v-if="currentStep === 'welcome'"
          @continue="handleWelcomeContinue"
          @splash-end="handleWelcomeSplashEnd"
        />
        <ImpedanceCheck
          v-else-if="currentStep === 'impedance'"
          @continue="handleImpedanceContinue"
          @skip="handleImpedanceSkip"
          @impedance-running-change="handleImpedanceRunningChange"
        />
        <SignalVisualization
          v-else-if="currentStep === 'visualization'"
          @continue="handleVisualizationContinue"
          @skip="handleVisualizationSkip"
        />
        <CalibrationWizard
          v-else-if="currentStep === 'calibration'"
          @complete="handleCalibrationComplete"
          @cancel="handleCalibrationCancel"
          @skip="handleCalibrationSkip"
          @recording-state="handleCalibrationRecordingState"
        />
        <GameGallery
          v-else-if="currentStep === 'gallery'"
          @select="handleGallerySelect"
          @back="handleGalleryBack"
        />
        <GameController
          v-else-if="currentStep === 'controller'"
          :game-id="selectedGameId"
          @continue="handleControllerContinue"
          @back="handleControllerBack"
        />
        <GameStage
          v-else-if="currentStep === 'game'"
          :channel-index="props.channelIndex"
          :game-id="selectedGameId"
          @back="handleGameBack"
          @restart="handleGameRestart"
          @pick-game="handleGamePickGame"
          @exit="handleExit"
        />
      </Transition>
    </div>
  </div>
</template>

<style scoped>
.demo-container {
  height: calc(100vh - 70px);
  background: #fafafa;
  display: flex;
  flex-direction: column;
}

.demo-container-fullscreen {
  height: 100vh;
}

.demo-header {
  background: #fff;
  border-bottom: 1px solid #e0e0e0;
  position: sticky;
  top: 70px;
  z-index: 100;
  transition: top 0.3s ease, padding 0.3s ease;
}

.demo-header-compact {
  top: 0;
  padding-top: 4px !important;
  padding-bottom: 4px !important;
}

.demo-content {
  flex: 1;
  overflow-y: auto;
}

.step-indicator {
  gap: 8px;
}

.step-indicator-compact {
  gap: 6px;
}

.step-indicator-compact .step-dot {
  width: 6px;
  height: 6px;
}

.step-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #e0e0e0;
  transition: all 0.3s ease;
}

.step-dot.active {
  background: #00876c;
  transform: scale(1.25);
}

.step-dot.completed {
  background: #00876c;
}

.slide-fade-enter-active {
  transition: all 0.3s ease-out;
}

.slide-fade-leave-active {
  transition: all 0.2s ease-in;
}

.slide-fade-enter-from {
  opacity: 0;
  transform: translateX(20px);
}

.slide-fade-leave-to {
  opacity: 0;
  transform: translateX(-20px);
}
</style>
