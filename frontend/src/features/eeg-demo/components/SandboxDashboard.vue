<script setup lang="ts">
/**
 * SandboxDashboard Component
 *
 * Developer tool for calibrating DSP algorithms and verifying hardware.
 * Processes ALL active EEG channels for robust ASSR detection.
 *
 * Features:
 * - Multi-channel FFT/SNR calculation
 * - Global Average SNR for focus detection
 * - Per-channel spectrum visualization with average highlighted
 */

import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import {
  PhPlay,
  PhStop,
  PhSpeakerHigh,
  PhArrowCounterClockwise,
  PhGauge,
  PhWaveform,
  PhChartLine,
  PhCheck,
  PhX,
  PhInfo,
  PhCaretLeft,
  PhCaretRight
} from '@phosphor-icons/vue';

import { useASSRDetection } from '../composables/useASSRDetection';
import { useAudioEngine, type AudioSourceType, type EarMode } from '../composables/useAudioEngine';
import dolphinControllerSvg from '../assets/support_dolphin_controller.svg';
import CombinedTimeSeriesChart from './charts/CombinedTimeSeriesChart.vue';
import PerChannelTimeSeriesChart from './charts/PerChannelTimeSeriesChart.vue';
import FFTSpectrumChart from './charts/FFTSpectrumChart.vue';

defineProps({
  channelIndex: {
    type: Number,
    default: 0
  }
});

const assrDetection = useASSRDetection();
const {
  channelSNRs,
  globalSNR,
  globalSNRDb,
  smoothedSNR: smoothedGlobalSNR,
  averageSNR: averageGlobalSNR,
  isFocused,
  calibration,
  isRecordingBaseline,
  preprocessing,
  setTargetFrequency,
  recordBaseline,
  cancelBaselineRecording,
  reset: resetASSR,
  start: startDetection,
} = assrDetection;

const {
  filteredBuffers,
  fftOutput,
  averageFFT,
  activeChannels,
  isRunning: isEEGProcessing,
  processingVersion,
} = preprocessing;

const bufferLength = computed(() => {
  const buffers = filteredBuffers.value;
  const keys = Object.keys(buffers);
  if (keys.length === 0) return 0;
  return buffers[keys[0]]?.length || 0;
});

const audioEngine = useAudioEngine();

const sourceType = ref<AudioSourceType>(audioEngine.config.value.left.sourceType);
const earMode = ref<EarMode>(audioEngine.config.value.earMode);

// Unified mode controls (or left ear in independent mode)
const carrierFreq = ref(audioEngine.config.value.left.carrierFrequency);
const modulationFreq = ref(audioEngine.config.value.left.modulationFrequency);
const volume = ref(audioEngine.config.value.left.volume);

// Right ear controls (only used in independent mode)
const rightSourceType = ref<AudioSourceType>(audioEngine.config.value.right.sourceType);
const rightCarrierFreq = ref(audioEngine.config.value.right.carrierFrequency);
const rightModulationFreq = ref(audioEngine.config.value.right.modulationFrequency);
const rightVolume = ref(audioEngine.config.value.right.volume);

watch(sourceType, (val) => {
  if (earMode.value === 'unified') {
    audioEngine.setSourceType('both', val);
  } else {
    audioEngine.setSourceType('left', val);
  }
});

watch(earMode, (val) => {
  audioEngine.setEarMode(val);
  // When switching to unified, sync right to left values
  if (val === 'unified') {
    rightSourceType.value = sourceType.value;
    rightCarrierFreq.value = carrierFreq.value;
    rightModulationFreq.value = modulationFreq.value;
    rightVolume.value = volume.value;
  }
});

watch(carrierFreq, (val) => {
  if (earMode.value === 'unified') {
    audioEngine.setCarrierFrequency('both', val);
  } else {
    audioEngine.setCarrierFrequency('left', val);
  }
});

watch(modulationFreq, (val) => {
  if (earMode.value === 'unified') {
    audioEngine.setModulationFrequency('both', val);
  } else {
    audioEngine.setModulationFrequency('left', val);
  }
  setTargetFrequency(val); // Sync ASSR target frequency
});

watch(volume, (val) => {
  if (earMode.value === 'unified') {
    audioEngine.setVolume('both', val);
  } else {
    audioEngine.setVolume('left', val);
  }
});

// Right ear watchers (only effective in independent mode)
watch(rightSourceType, (val) => {
  if (earMode.value === 'independent') {
    audioEngine.setSourceType('right', val);
  }
});

watch(rightCarrierFreq, (val) => {
  if (earMode.value === 'independent') {
    audioEngine.setCarrierFrequency('right', val);
  }
});

watch(rightModulationFreq, (val) => {
  if (earMode.value === 'independent') {
    audioEngine.setModulationFrequency('right', val);
  }
});

watch(rightVolume, (val) => {
  if (earMode.value === 'independent') {
    audioEngine.setVolume('right', val);
  }
});

const calibrationDuration = ref(10); // seconds
const detectionThreshold = ref(3.0);

watch(detectionThreshold, (val) => {
  assrDetection.updateConfig({ detectionThreshold: val });
});

const rawSignalView = ref<'combined' | 'per-channel'>('combined');

function toggleRawSignalView() {
  rawSignalView.value = rawSignalView.value === 'combined' ? 'per-channel' : 'combined';
}

onMounted(async () => {
  console.log('[SandboxDashboard] Mounted, starting ASSR detection');
  startDetection();
});

onUnmounted(() => {
  console.log('[SandboxDashboard] Unmounting, cleaning up');
  audioEngine.dispose();
});

async function handleToggleAudio() {
  await audioEngine.toggle();
}

async function handleRecordBaseline() {
  const durationMs = calibrationDuration.value * 1000;
  const result = await recordBaseline(durationMs);
  console.log('[SandboxDashboard] Baseline recorded, noise power:', result.toExponential(2));
}

function handleCancelBaselineRecording() {
  cancelBaselineRecording();
}

function handleReset() {
  resetASSR();
}

const globalSNRDisplay = computed(() => {
  return globalSNR.value.toFixed(2);
});

const globalSNRDbDisplay = computed(() => {
  return globalSNRDb.value.toFixed(1);
});

const channelCountDisplay = computed(() => {
  return activeChannels.value.length;
});

const focusStatusClass = computed(() => {
  return isFocused.value ? 'focus-detected' : 'focus-not-detected';
});

const calibrationStatusDisplay = computed(() => {
  const cal = calibration.value;
  if (cal.isRecordingBaseline) return 'Recording Baseline...';
  if (cal.hasBaseline) return 'Baseline Recorded';
  return 'No Baseline';
});

const perChannelSNR = computed(() => {
  return channelSNRs.value.map(r => ({
    label: r.channelLabel,
    snr: r.snr.toFixed(2),
    snrDb: r.snrDb.toFixed(1),
  }));
});

// Target frequencies for FFT chart (deduplicated for independent mode)
const targetFrequencies = computed(() => {
  if (earMode.value === 'unified') {
    return [modulationFreq.value];
  }
  // Independent mode: show both, deduplicated if identical
  if (modulationFreq.value === rightModulationFreq.value) {
    return [modulationFreq.value];
  }
  return [modulationFreq.value, rightModulationFreq.value];
});

// ---- Independent Mode: Right Ear SNR Detection ----

// Per-channel SNR for right ear frequency (using composable method)
// This is the source of truth - global SNR is derived from this
const rightChannelSNRs = computed(() => {
  // Touch processingVersion to trigger reactivity
  void processingVersion.value;
  return assrDetection.computeChannelSNRsAtFrequency(rightModulationFreq.value);
});

// Derive global SNR from per-channel results (avoids double calculation)
const rightGlobalSNR = computed(() => {
  const snrs = rightChannelSNRs.value;
  if (snrs.length === 0) return 0;
  return snrs.reduce((sum, r) => sum + r.snr, 0) / snrs.length;
});

const rightGlobalSNRDb = computed(() => {
  const snrs = rightChannelSNRs.value;
  if (snrs.length === 0) return 0;
  return snrs.reduce((sum, r) => sum + r.snrDb, 0) / snrs.length;
});

const rightIsFocused = computed(() => {
  return rightGlobalSNR.value > detectionThreshold.value;
});

const rightGlobalSNRDisplay = computed(() => {
  return rightGlobalSNR.value.toFixed(2);
});

const rightGlobalSNRDbDisplay = computed(() => {
  return rightGlobalSNRDb.value.toFixed(1);
});

const rightFocusStatusClass = computed(() => {
  return rightIsFocused.value ? 'focus-detected' : 'focus-not-detected';
});

const rightPerChannelSNR = computed(() => {
  return rightChannelSNRs.value.map(r => ({
    label: r.channelLabel,
    snr: r.snr.toFixed(2),
    snrDb: r.snrDb.toFixed(1),
  }));
});
</script>

<template>
  <div class="sandbox-dashboard">
    <div class="sandbox-header">
      <div class="header-content">
        <img :src="dolphinControllerSvg" alt="Dolphin mascot" class="header-dolphin" />
        <div>
          <h1 class="text-h5 font-weight-bold">EEG Sandbox Dashboard</h1>
          <p class="text-caption text-grey">Developer tool for ASSR signal calibration and hardware verification</p>
        </div>
      </div>
      <div class="header-status">
        <v-chip
          :color="isEEGProcessing ? 'success' : 'error'"
          size="small"
          variant="flat"
        >
          <template #prepend>
            <span class="status-dot" :class="isEEGProcessing ? 'active' : ''"></span>
          </template>
          {{ isEEGProcessing ? 'EEG Connected' : 'No Signal' }}
        </v-chip>
        <v-chip
          size="small"
          variant="outlined"
          color="grey"
        >
          Buffer: {{ bufferLength }} samples
        </v-chip>
      </div>
    </div>

    <v-divider class="my-4" />

    <div class="dashboard-grid">

      <div class="controls-column">

        <!-- Audio Controls -->
        <v-card class="panel" elevation="2">
          <v-card-title class="panel-title">
            <PhSpeakerHigh :size="20" />
            Audio Stimulus
          </v-card-title>
          <v-card-text class="panel-body">
            <v-btn
              :color="audioEngine.isPlaying.value ? 'error' : undefined"
              :class="audioEngine.isPlaying.value ? '' : 'audio-start-btn'"
              block
              class="mb-4"
              @click="handleToggleAudio"
            >
              <template #prepend>
                <PhPlay v-if="!audioEngine.isPlaying.value" :size="18" />
                <PhStop v-else :size="18" />
              </template>
              {{ audioEngine.isPlaying.value ? 'Stop Audio' : 'Start Audio' }}
            </v-btn>

            <!-- Ear Mode Selection -->
            <div class="toggle-group">
              <div class="toggle-label">Ear Configuration</div>
              <v-btn-toggle
                v-model="earMode"
                mandatory
                density="compact"
                class="audio-toggle"
                divided
              >
                <v-btn value="unified" size="small">
                  Unified
                </v-btn>
                <v-btn value="independent" size="small">
                  Independent
                </v-btn>
              </v-btn-toggle>
            </div>

            <!-- Source Type Selection (Unified Mode Only) -->
            <div v-if="earMode === 'unified'" class="toggle-group">
              <div class="toggle-label">Source Type</div>
              <v-btn-toggle
                v-model="sourceType"
                mandatory
                density="compact"
                class="audio-toggle"
                divided
              >
                <v-btn value="carrier" size="small">
                  Carrier Tone
                </v-btn>
                <v-btn value="whiteNoise" size="small">
                  White Noise
                </v-btn>
              </v-btn-toggle>
            </div>

            <v-divider class="my-4" />

            <!-- Unified Mode Controls -->
            <div v-if="earMode === 'unified'" class="ear-section">
              <!-- Carrier Frequency (only for carrier source) -->
              <div v-if="sourceType === 'carrier'" class="slider-group">
                <div class="slider-header">
                  <span>Carrier Frequency</span>
                  <span class="slider-value">{{ carrierFreq }} Hz</span>
                </div>
                <v-slider
                  v-model="carrierFreq"
                  :min="200"
                  :max="2000"
                  :step="50"
                  color="#00876c"
                  hide-details
                  thumb-label
                />
              </div>

              <!-- Modulation Frequency -->
              <div class="slider-group">
                <div class="slider-header">
                  <span>Modulation Frequency (Target)</span>
                  <span class="slider-value">{{ modulationFreq }} Hz</span>
                </div>
                <v-slider
                  v-model="modulationFreq"
                  :min="10"
                  :max="80"
                  :step="1"
                  color="#ffb300"
                  hide-details
                  thumb-label
                />
              </div>

              <!-- Volume -->
              <div class="slider-group">
                <div class="slider-header">
                  <span>Volume</span>
                  <span class="slider-value">{{ Math.round(volume * 100) }}%</span>
                </div>
                <v-slider
                  v-model="volume"
                  :min="0"
                  :max="1"
                  :step="0.05"
                  color="#607d8b"
                  hide-details
                  thumb-label
                />
              </div>
            </div>

            <!-- Independent Mode Controls -->
            <div v-if="earMode === 'independent'">
              <!-- Left Ear -->
              <div class="ear-section">
                <div class="ear-label">Left Ear</div>

                <!-- Left Source Type -->
                <div class="toggle-group">
                  <div class="toggle-label">Source Type</div>
                  <v-btn-toggle
                    v-model="sourceType"
                    mandatory
                    density="compact"
                    class="audio-toggle"
                    divided
                  >
                    <v-btn value="carrier" size="small">
                      Carrier Tone
                    </v-btn>
                    <v-btn value="whiteNoise" size="small">
                      White Noise
                    </v-btn>
                  </v-btn-toggle>
                </div>

                <!-- Left Carrier Frequency (only for carrier source) -->
                <div v-if="sourceType === 'carrier'" class="slider-group">
                  <div class="slider-header">
                    <span>Carrier Frequency</span>
                    <span class="slider-value">{{ carrierFreq }} Hz</span>
                  </div>
                  <v-slider
                    v-model="carrierFreq"
                    :min="200"
                    :max="2000"
                    :step="50"
                    color="#00876c"
                    hide-details
                    thumb-label
                  />
                </div>

                <!-- Left Modulation Frequency -->
                <div class="slider-group">
                  <div class="slider-header">
                    <span>Modulation Frequency</span>
                    <span class="slider-value">{{ modulationFreq }} Hz</span>
                  </div>
                  <v-slider
                    v-model="modulationFreq"
                    :min="10"
                    :max="80"
                    :step="1"
                    color="#ffb300"
                    hide-details
                    thumb-label
                  />
                </div>

                <!-- Left Volume -->
                <div class="slider-group">
                  <div class="slider-header">
                    <span>Volume</span>
                    <span class="slider-value">{{ Math.round(volume * 100) }}%</span>
                  </div>
                  <v-slider
                    v-model="volume"
                    :min="0"
                    :max="1"
                    :step="0.05"
                    color="#607d8b"
                    hide-details
                    thumb-label
                  />
                </div>
              </div>

              <!-- Right Ear -->
              <div class="ear-section ear-section-spacing">
                <v-divider class="mb-3" />
                <div class="ear-label">Right Ear</div>

                <!-- Right Source Type -->
                <div class="toggle-group">
                  <div class="toggle-label">Source Type</div>
                  <v-btn-toggle
                    v-model="rightSourceType"
                    mandatory
                    density="compact"
                    class="audio-toggle"
                    divided
                  >
                    <v-btn value="carrier" size="small">
                      Carrier Tone
                    </v-btn>
                    <v-btn value="whiteNoise" size="small">
                      White Noise
                    </v-btn>
                  </v-btn-toggle>
                </div>

                <!-- Right Carrier Frequency (only for carrier source) -->
                <div v-if="rightSourceType === 'carrier'" class="slider-group">
                  <div class="slider-header">
                    <span>Carrier Frequency</span>
                    <span class="slider-value">{{ rightCarrierFreq }} Hz</span>
                  </div>
                  <v-slider
                    v-model="rightCarrierFreq"
                    :min="200"
                    :max="2000"
                    :step="50"
                    color="#00876c"
                    hide-details
                    thumb-label
                  />
                </div>

                <!-- Right Modulation Frequency -->
                <div class="slider-group">
                  <div class="slider-header">
                    <span>Modulation Frequency</span>
                    <span class="slider-value">{{ rightModulationFreq }} Hz</span>
                  </div>
                  <v-slider
                    v-model="rightModulationFreq"
                    :min="10"
                    :max="80"
                    :step="1"
                    color="#7c4dff"
                    hide-details
                    thumb-label
                  />
                </div>

                <!-- Right Volume -->
                <div class="slider-group">
                  <div class="slider-header">
                    <span>Volume</span>
                    <span class="slider-value">{{ Math.round(rightVolume * 100) }}%</span>
                  </div>
                  <v-slider
                    v-model="rightVolume"
                    :min="0"
                    :max="1"
                    :step="0.05"
                    color="#607d8b"
                    hide-details
                    thumb-label
                  />
                </div>
              </div>
            </div>
          </v-card-text>
        </v-card>

        <!-- Calibration -->
        <v-card class="panel" elevation="2">
          <v-card-title class="panel-title">
            <PhGauge :size="20" />
            Calibration
          </v-card-title>
          <v-card-text class="panel-body">
            <!-- Calibration Status -->
            <div class="calibration-status mb-4">
              <span class="text-caption">{{ calibrationStatusDisplay }}</span>
              <v-progress-linear
                v-if="isRecordingBaseline"
                :model-value="calibration.baselineProgress"
                color="primary"
                height="8"
                rounded
              />
            </div>

            <!-- Duration Setting -->
            <div class="slider-group mb-4">
              <div class="slider-header">
                <span>Duration</span>
                <span class="slider-value">{{ calibrationDuration }}s</span>
              </div>
              <v-slider
                v-model="calibrationDuration"
                :min="5"
                :max="30"
                :step="5"
                :disabled="isRecordingBaseline"
                color="grey"
                hide-details
              />
            </div>

            <!-- Calibration Buttons -->
            <div class="calibration-buttons">
              <v-btn
                color="blue-grey"
                variant="outlined"
                size="small"
                :disabled="isRecordingBaseline"
                @click="handleRecordBaseline"
              >
                Record Baseline
              </v-btn>
              <v-btn
                v-if="isRecordingBaseline"
                color="error"
                variant="text"
                size="small"
                @click="handleCancelBaselineRecording"
              >
                Cancel
              </v-btn>
            </div>

            <v-divider class="my-4" />

            <!-- Detection Threshold -->
            <div class="slider-group">
              <div class="slider-header">
                <span>Detection Threshold</span>
                <span class="slider-value">{{ detectionThreshold.toFixed(1) }}</span>
              </div>
              <v-slider
                v-model="detectionThreshold"
                :min="1.0"
                :max="10.0"
                :step="0.1"
                color="warning"
                hide-details
              />
            </div>

            <!-- Calibration Results -->
            <div class="calibration-results mt-4">
              <div class="result-item">
                <span class="result-label">Baseline Noise Power:</span>
                <span class="result-value">{{ calibration.hasBaseline ? calibration.baselineNoisePower.toExponential(2) : '—' }}</span>
              </div>
              <div class="result-item">
                <span class="result-label">Has Baseline:</span>
                <span class="result-value">{{ calibration.hasBaseline ? 'Yes' : 'No' }}</span>
              </div>
              <div class="result-item highlight">
                <span class="result-label">Detection Threshold:</span>
                <span class="result-value">{{ detectionThreshold.toFixed(1) }}</span>
              </div>
            </div>
          </v-card-text>
        </v-card>

      </div>

      <!-- Center Column: Visualization -->
      <div class="visualization-column">

        <!-- Raw Signal Chart with Carousel -->
        <v-card class="panel chart-panel" elevation="2">
          <v-card-title class="panel-title compact">
            <div class="carousel-header">
              <div class="carousel-title">
                <PhWaveform :size="18" />
                Filtered Signal
                <span class="view-label">{{ rawSignalView === 'combined' ? '(Combined)' : '(Per-Channel)' }}</span>
              </div>
              <div class="carousel-controls">
                <button
                  class="carousel-btn"
                  @click="toggleRawSignalView"
                  :title="rawSignalView === 'combined' ? 'Switch to per-channel view' : 'Switch to combined view'"
                >
                  <PhCaretLeft v-if="rawSignalView === 'per-channel'" :size="16" />
                  <PhCaretRight v-else :size="16" />
                </button>
              </div>
            </div>
          </v-card-title>
          <v-card-text class="chart-container-wrapper">
            <!-- Combined View -->
            <div v-show="rawSignalView === 'combined'" class="carousel-slide">
              <CombinedTimeSeriesChart
                :filtered-buffers="filteredBuffers"
                :active-channels="activeChannels"
                :processing-version="processingVersion"
              />
            </div>

            <!-- Per-Channel View -->
            <div v-show="rawSignalView === 'per-channel'" class="carousel-slide per-channel-container">
              <PerChannelTimeSeriesChart
                v-for="ch in activeChannels"
                :key="ch.electrodeLabel"
                :channel="ch"
                :filtered-buffers="filteredBuffers"
                :processing-version="processingVersion"
              />
            </div>
          </v-card-text>
        </v-card>

        <!-- FFT Spectrum Chart -->
        <v-card class="panel chart-panel" elevation="2">
          <v-card-title class="panel-title compact">
            <PhChartLine :size="18" />
            Frequency Spectrum
          </v-card-title>
          <v-card-text class="chart-container">
            <FFTSpectrumChart
              :fft-output="fftOutput"
              :average-fft="averageFFT"
              :active-channels="activeChannels"
              :processing-version="processingVersion"
              :target-frequencies="targetFrequencies"
            />
          </v-card-text>
        </v-card>

      </div>

      <!-- Right Column: Metrics -->
      <div class="metrics-column">

        <!-- Focus Detection Panel - Unified Mode -->
        <v-card v-if="earMode === 'unified'" class="panel focus-panel" :class="focusStatusClass" elevation="2">
          <v-card-text class="focus-content">
            <div class="focus-indicator">
              <PhCheck v-if="isFocused" :size="48" class="focus-icon detected" />
              <PhX v-else :size="48" class="focus-icon not-detected" />
            </div>
            <div class="focus-label">
              {{ isFocused ? 'FOCUSED' : 'NOT FOCUSED' }}
            </div>
          </v-card-text>
        </v-card>

        <!-- Focus Detection Panel - Independent Mode (Dual Tiles) -->
        <div v-if="earMode === 'independent'" class="focus-row">
          <!-- Left Ear Focus -->
          <v-card class="panel focus-panel focus-panel-half" :class="focusStatusClass" elevation="2">
            <v-card-text class="focus-content focus-content-compact">
              <div class="focus-ear-label">Left Ear</div>
              <div class="focus-indicator">
                <PhCheck v-if="isFocused" :size="36" class="focus-icon detected" />
                <PhX v-else :size="36" class="focus-icon not-detected" />
              </div>
              <div class="focus-label focus-label-small">
                {{ isFocused ? 'FOCUSED' : 'NOT FOCUSED' }}
              </div>
              <div class="focus-freq left">{{ modulationFreq }} Hz</div>
            </v-card-text>
          </v-card>

          <!-- Right Ear Focus -->
          <v-card class="panel focus-panel focus-panel-half" :class="rightFocusStatusClass" elevation="2">
            <v-card-text class="focus-content focus-content-compact">
              <div class="focus-ear-label">Right Ear</div>
              <div class="focus-indicator">
                <PhCheck v-if="rightIsFocused" :size="36" class="focus-icon detected" />
                <PhX v-else :size="36" class="focus-icon not-detected" />
              </div>
              <div class="focus-label focus-label-small">
                {{ rightIsFocused ? 'FOCUSED' : 'NOT FOCUSED' }}
              </div>
              <div class="focus-freq right">{{ rightModulationFreq }} Hz</div>
            </v-card-text>
          </v-card>
        </div>

        <!-- SNR Metrics Panel -->
        <v-card class="panel metrics-panel" elevation="2">
          <v-card-title class="panel-title">
            <PhGauge :size="20" />
            Real-time Metrics ({{ channelCountDisplay }} Channels)
          </v-card-title>
          <v-card-text class="panel-body">
            <!-- Unified Mode Metrics -->
            <template v-if="earMode === 'unified'">
              <!-- Global Average SNR -->
              <div class="metric-item large">
                <span class="metric-label">Global Avg SNR</span>
                <span class="metric-value snr-value">{{ globalSNRDisplay }}</span>
              </div>

              <!-- SNR in dB -->
              <div class="metric-item">
                <span class="metric-label">SNR (dB)</span>
                <span class="metric-value">{{ globalSNRDbDisplay }} dB</span>
              </div>

              <v-divider class="my-3" />

              <!-- Average SNR (temporal) -->
              <div class="metric-item">
                <span class="metric-label">Avg SNR (10 samples)</span>
                <span class="metric-value">{{ averageGlobalSNR.toFixed(2) }}</span>
              </div>

              <!-- Smoothed SNR -->
              <div class="metric-item">
                <span class="metric-label">Smoothed SNR (5 samples)</span>
                <span class="metric-value">{{ smoothedGlobalSNR.toFixed(2) }}</span>
              </div>

              <v-divider class="my-3" />

              <!-- Per-Channel SNR Breakdown -->
              <div class="channel-breakdown">
                <div class="breakdown-header">Per-Channel SNR @ {{ modulationFreq }} Hz</div>
                <div class="channel-list">
                  <div
                    v-for="ch in perChannelSNR"
                    :key="ch.label"
                    class="channel-snr-item"
                  >
                    <span class="channel-label">{{ ch.label }}</span>
                    <span class="channel-snr">{{ ch.snr }}</span>
                  </div>
                </div>
              </div>
            </template>

            <!-- Independent Mode Metrics -->
            <template v-if="earMode === 'independent'">
              <!-- Left Ear Section -->
              <div class="ear-metrics-section">
                <div class="ear-metrics-header left-ear">Left Ear @ {{ modulationFreq }} Hz</div>

                <!-- Left Global Average SNR -->
                <div class="metric-item large">
                  <span class="metric-label">Global Avg SNR</span>
                  <span class="metric-value snr-value">{{ globalSNRDisplay }}</span>
                </div>

                <!-- Left SNR in dB -->
                <div class="metric-item">
                  <span class="metric-label">SNR (dB)</span>
                  <span class="metric-value">{{ globalSNRDbDisplay }} dB</span>
                </div>

                <!-- Left Average SNR (temporal) -->
                <div class="metric-item">
                  <span class="metric-label">Avg SNR (10 samples)</span>
                  <span class="metric-value">{{ averageGlobalSNR.toFixed(2) }}</span>
                </div>

                <!-- Left Smoothed SNR -->
                <div class="metric-item">
                  <span class="metric-label">Smoothed SNR (5 samples)</span>
                  <span class="metric-value">{{ smoothedGlobalSNR.toFixed(2) }}</span>
                </div>

                <!-- Left Per-Channel SNR Breakdown -->
                <div class="channel-breakdown">
                  <div class="breakdown-header">Per-Channel SNR</div>
                  <div class="channel-list">
                    <div
                      v-for="ch in perChannelSNR"
                      :key="'left-' + ch.label"
                      class="channel-snr-item"
                    >
                      <span class="channel-label">{{ ch.label }}</span>
                      <span class="channel-snr">{{ ch.snr }}</span>
                    </div>
                  </div>
                </div>
              </div>

              <v-divider class="my-4" />

<!-- Right Ear Section -->
              <div class="ear-metrics-section">
                <div class="ear-metrics-header right-ear">Right Ear @ {{ rightModulationFreq }} Hz</div>

                <!-- Right Global Average SNR -->
                <div class="metric-item large">
                  <span class="metric-label">Global Avg SNR</span>
                  <span class="metric-value snr-value">{{ rightGlobalSNRDisplay }}</span>
                </div>

                <!-- Right SNR in dB -->
                <div class="metric-item">
                  <span class="metric-label">SNR (dB)</span>
                  <span class="metric-value">{{ rightGlobalSNRDbDisplay }} dB</span>
                </div>

                <!-- Right Per-Channel SNR Breakdown -->
                <div class="channel-breakdown">
                  <div class="breakdown-header">Per-Channel SNR</div>
                  <div class="channel-list">
                    <div
                      v-for="ch in rightPerChannelSNR"
                      :key="'right-' + ch.label"
                      class="channel-snr-item"
                    >
                      <span class="channel-label">{{ ch.label }}</span>
                      <span class="channel-snr">{{ ch.snr }}</span>
                    </div>
                  </div>
                </div>
              </div>
            </template>
          </v-card-text>
        </v-card>

        <!-- Info Panel -->
        <v-card class="panel info-panel" elevation="2">
          <v-card-title class="panel-title compact">
            <PhInfo :size="18" />
            How It Works
          </v-card-title>
          <v-card-text class="info-content">
            <!-- Unified Mode Info -->
            <template v-if="earMode === 'unified'">
              <ol class="info-list">
                <li><strong>Start Audio:</strong> Plays {{ sourceType === 'carrier' ? `a ${carrierFreq} Hz tone` : 'white noise' }} modulated at {{ modulationFreq }} Hz</li>
                <li><strong>Focus:</strong> Concentrate on the pulsing sound</li>
                <li><strong>Detection:</strong> Your auditory cortex responds to the {{ modulationFreq }} Hz modulation</li>
                <li><strong>Multi-Channel:</strong> SNR computed for all {{ channelCountDisplay }} channels</li>
                <li><strong>Global SNR:</strong> Average of all channel SNRs for robust detection</li>
              </ol>
              <div class="formula mt-2">
                <code>Global SNR = Avg(SNR<sub>ch1</sub>, SNR<sub>ch2</sub>, ... SNR<sub>chN</sub>)</code>
              </div>
            </template>

            <!-- Independent Mode Info -->
            <template v-if="earMode === 'independent'">
              <ol class="info-list">
                <li><strong>Start Audio:</strong> Plays different stimuli to each ear</li>
                <li><strong>Left Ear:</strong> {{ sourceType === 'carrier' ? `${carrierFreq} Hz tone` : 'White noise' }} @ <span class="freq-highlight left">{{ modulationFreq }} Hz</span></li>
                <li><strong>Right Ear:</strong> {{ rightSourceType === 'carrier' ? `${rightCarrierFreq} Hz tone` : 'White noise' }} @ <span class="freq-highlight right">{{ rightModulationFreq }} Hz</span></li>
                <li><strong>Detection:</strong> Independent focus detection per ear frequency</li>
                <li><strong>Multi-Channel:</strong> SNR computed at both frequencies across {{ channelCountDisplay }} channels</li>
              </ol>
              <div class="formula mt-2">
                <code>Left SNR @ {{ modulationFreq }} Hz | Right SNR @ {{ rightModulationFreq }} Hz</code>
              </div>
            </template>
          </v-card-text>
        </v-card>

        <v-btn
          color="grey"
          variant="outlined"
          block
          class="mt-4"
          @click="handleReset"
        >
          <template #prepend>
            <PhArrowCounterClockwise :size="18" />
          </template>
          Reset Metrics
        </v-btn>

      </div>

    </div>
  </div>
</template>

<style scoped>
.sandbox-dashboard {
  padding: 24px;
  min-height: 100vh;
  color: #263238;
  background: transparent;
}

.sandbox-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 16px;
}

.header-content {
  display: flex;
  align-items: center;
  gap: 16px;
}

.header-dolphin {
  width: 40px;
  height: 40px;
  object-fit: contain;
  filter: drop-shadow(0 2px 6px rgba(0, 0, 0, 0.12));
}

.header-status {
  display: flex;
  gap: 8px;
  align-items: center;
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #b0bec5;
  margin-right: 4px;
}

.status-dot.active {
  background: #00876c;
  animation: pulse 1.5s infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.dashboard-grid {
  display: grid;
  grid-template-columns: 300px 1fr 320px;
  gap: 24px;
}

@media (max-width: 1400px) {
  .dashboard-grid {
    grid-template-columns: 280px 1fr 280px;
    gap: 16px;
  }
}

@media (max-width: 1100px) {
  .dashboard-grid {
    grid-template-columns: 1fr;
  }
}

.panel {
  background: #ffffff !important;
  border: 1px solid #e0e0e0;
  border-radius: 12px !important;
}

.panel-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px !important;
  padding: 12px 16px !important;
  border-bottom: 1px solid #eeeeee;
  color: #37474f;
}

.panel-title.compact {
  padding: 8px 12px !important;
  font-size: 13px !important;
}

.panel-body {
  padding: 16px !important;
}

.controls-column {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.slider-group {
  margin-bottom: 16px;
}

.slider-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 4px;
  font-size: 12px;
  color: #607d8b;
}

.slider-value {
  font-weight: 600;
  color: #00876c;
}

.calibration-status {
  text-align: center;
  padding: 8px;
  background: #f7f7f7;
  border-radius: 8px;
}

.calibration-buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.calibration-results {
  background: #f7f7f7;
  border-radius: 8px;
  padding: 12px;
}

.result-item {
  display: flex;
  justify-content: space-between;
  margin-bottom: 8px;
  font-size: 12px;
}

.result-item:last-child {
  margin-bottom: 0;
}

.result-item.highlight {
  color: #00876c;
  font-weight: 600;
}

.result-label {
  color: #607d8b;
}

.result-value {
  color: #263238;
}

.visualization-column {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.chart-panel {
  /* Removed flex: 1 to prevent height constraints */
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.chart-panel .v-card-text {
  flex: 0 1 auto;
  overflow: visible;
}

.chart-container {
  padding: 8px !important;
}

.chart-panel .chart-container-wrapper {
  padding: 8px 12px !important;
  /* Remove min-height and max-height constraints */
  /* Allow natural height with scrolling fallback */
  max-height: calc(100vh - 300px);
  overflow-y: auto;
  overflow-x: hidden;
  /* Ensure content is not clipped */
  display: block;
}

.chart-container-wrapper::-webkit-scrollbar {
  width: 10px;
}

.chart-container-wrapper::-webkit-scrollbar-track {
  background: #f1f1f1;
  border-radius: 5px;
  margin: 4px 0;
}

.chart-container-wrapper::-webkit-scrollbar-thumb {
  background: rgba(120, 144, 156, 0.4);
  border-radius: 5px;
  border: 2px solid transparent;
  background-clip: padding-box;
}

.chart-container-wrapper::-webkit-scrollbar-thumb:hover {
  background: rgba(120, 144, 156, 0.6);
  background-clip: padding-box;
}

.metrics-column {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.focus-panel {
  text-align: center;
  transition: all 0.3s ease;
}

.focus-panel.focus-detected {
  background: #f7f7f7 !important;
  border-color: #e0e0e0 !important;
}

.focus-panel.focus-not-detected {
  background: #f7f7f7 !important;
  border-color: #e0e0e0 !important;
}

.focus-content {
  padding: 24px 16px !important;
}

.focus-indicator {
  margin-bottom: 8px;
}

.focus-icon.detected {
  color: #2e7d32;
}

.focus-icon.not-detected {
  color: #c62828;
  opacity: 0.7;
}

.focus-label {
  font-size: 18px;
  font-weight: 700;
  letter-spacing: 2px;
}

.focus-detected .focus-label {
  color: #2e7d32;
}

.focus-not-detected .focus-label {
  color: #607d8b;
}

.metric-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
  font-size: 13px;
}

.metric-item.large {
  margin-bottom: 16px;
}

.metric-label {
  color: #607d8b;
}

.metric-value {
  font-weight: 600;
  color: #263238;
}

.metric-item.large .metric-value {
  font-size: 28px;
  color: #00876c;
}

.snr-value {
  font-family: 'Roboto Mono', monospace;
}

.info-content {
  padding: 12px !important;
}

.info-list {
  padding-left: 16px;
  margin: 0;
  font-size: 11px;
  color: #607d8b;
  line-height: 1.8;
}

.info-list strong {
  color: #263238;
}

.formula {
  font-size: 10px;
  background: #f1f1f1;
  padding: 8px;
  border-radius: 4px;
  overflow-x: auto;
}

.formula code {
  color: #00876c;
}

.channel-breakdown {
  background: #f7f7f7;
  border-radius: 8px;
  padding: 10px;
}

.breakdown-header {
  font-size: 11px;
  color: #607d8b;
  margin-bottom: 8px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.channel-list {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 4px;
}

.channel-snr-item {
  display: flex;
  justify-content: space-between;
  padding: 4px 8px;
  background: #f0f0f0;
  border-radius: 4px;
  font-size: 11px;
}

.channel-label {
  color: #607d8b;
}

.channel-snr {
  color: #00876c;
  font-weight: 600;
  font-family: 'Roboto Mono', monospace;
}

/* Carousel */
.carousel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
}

.carousel-title {
  display: flex;
  align-items: center;
  gap: 8px;
}

.view-label {
  font-size: 11px;
  color: #607d8b;
  font-weight: 400;
  margin-left: 4px;
}

.carousel-controls {
  display: flex;
  gap: 4px;
}

.carousel-btn {
  background: #f0f0f0;
  border: 1px solid #e0e0e0;
  border-radius: 4px;
  color: #00876c;
  padding: 4px 8px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
}

.carousel-btn:hover {
  background: #e6e6e6;
  border-color: #d5d5d5;
}

.carousel-btn:active {
  transform: scale(0.95);
}

.carousel-slide {
  width: 100%;
}

.per-channel-container {
  display: flex;
  flex-direction: column;
  gap: 4px;
  width: 100%;
  padding-bottom: 8px;
}

.toggle-group {
  margin-bottom: 16px;
}

.toggle-label {
  font-size: 12px;
  color: #607d8b;
  margin-bottom: 8px;
  font-weight: 500;
}

.audio-toggle {
  width: 100%;
  gap: 4px;
}

.audio-toggle .v-btn {
  flex: 1;
  border: 1px solid #e0e0e0;
  background: #fafafa;
  color: #607d8b;
}

.audio-toggle .v-btn--active,
.audio-start-btn {
  background: #00876c !important;
  color: white !important;
  border-color: #00876c !important;
}

.audio-toggle .v-btn:hover:not(.v-btn--active) {
  background: #f0f0f0;
}

.ear-section {
  padding: 0;
}

.ear-section-spacing {
  margin-top: 20px;
}

.ear-label {
  font-size: 13px;
  font-weight: 600;
  color: #00876c;
  margin-bottom: 14px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

/* Dual Focus Tiles - Independent Mode */
.focus-row {
  display: flex;
  gap: 12px;
}

.focus-panel-half {
  flex: 1;
  min-width: 0;
}

.focus-content-compact {
  padding: 16px 12px !important;
}

.focus-ear-label {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 1px;
  color: #607d8b;
  margin-bottom: 8px;
  font-weight: 600;
}

.focus-label-small {
  font-size: 13px;
  letter-spacing: 1px;
}

.focus-freq {
  font-size: 12px;
  color: #00876c;
  font-weight: 600;
  margin-top: 6px;
}

.focus-freq.left {
  color: #e6a200;
}

.focus-freq.right {
  color: #7c4dff;
}

/* Independent Mode Metrics Sections */
.ear-metrics-section {
  margin-bottom: 8px;
}

.ear-metrics-header {
  font-size: 12px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 12px;
  padding: 6px 10px;
  border-radius: 4px;
}

.ear-metrics-header.left-ear {
  background: rgba(255, 179, 0, 0.15);
  color: #e6a200;
}

.ear-metrics-header.right-ear {
  background: rgba(124, 77, 255, 0.1);
  color: #7c4dff;
}

/* Frequency Highlights in How It Works */
.freq-highlight {
  font-weight: 600;
  padding: 1px 4px;
  border-radius: 3px;
}

.freq-highlight.left {
  background: rgba(255, 179, 0, 0.2);
  color: #e6a200;
}

.freq-highlight.right {
  background: rgba(124, 77, 255, 0.15);
  color: #7c4dff;
}
</style>
