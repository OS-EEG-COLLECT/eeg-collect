<script setup lang="ts">
import { inject, computed, defineEmits, ref } from 'vue';
import { PhArrowRight, PhSkipForward, PhWaveform, PhCaretLeft, PhCaretRight, PhChartLine } from '@phosphor-icons/vue';
import type { UseASSRDetectionReturn } from '../composables/useASSRDetection';
import CombinedTimeSeriesChart from './charts/CombinedTimeSeriesChart.vue';
import PerChannelTimeSeriesChart from './charts/PerChannelTimeSeriesChart.vue';
import FFTSpectrumChart from './charts/FFTSpectrumChart.vue';

const emit = defineEmits(['continue', 'skip']);

const assrDetection = inject<UseASSRDetectionReturn>('assrDetection')!;

const { filteredBuffers, fftOutput, averageFFT, activeChannels, isReady, processingVersion } = assrDetection.preprocessing;

const debugInfo = computed(() => {
  const buffers = filteredBuffers.value;
  const keys = Object.keys(buffers);
  return {
    bufferLength: keys.length > 0 ? (buffers[keys[0]]?.length ?? 0) : 0,
    isReady: isReady.value,
    activeChannelCount: activeChannels.value.length,
  };
});

const rawSignalView = ref<'combined' | 'per-channel'>('per-channel');

function toggleRawSignalView() {
  rawSignalView.value = rawSignalView.value === 'combined' ? 'per-channel' : 'combined';
}

const handleContinue = () => emit('continue');
const handleSkip = () => emit('skip');
</script>

<template>
  <div class="signal-visualization pa-4">
    <div class="text-center mb-6">
      <h3 class="text-h5 font-weight-bold mb-2">Signal Visualization</h3>
      <p class="text-body-1 text-grey-darken-1">
        Preview your live EEG signals in real-time before calibration.
      </p>
    </div>

    <v-alert
      v-if="debugInfo.bufferLength === 0"
      type="warning"
      class="mb-4"
      variant="tonal"
    >
      Waiting for EEG data... Make sure the device is connected and streaming.
      <br />
      <small>
        Channels: {{ debugInfo.activeChannelCount }} |
        Buffer: {{ debugInfo.bufferLength }} samples |
        Ready: {{ debugInfo.isReady }}
      </small>
    </v-alert>

    <v-alert
      v-else-if="debugInfo.bufferLength > 0"
      type="success"
      class="mb-4"
      variant="tonal"
    >
      Connected: Receiving data from {{ debugInfo.activeChannelCount }} EEG channels
    </v-alert>

    <v-row>
      <v-col cols="12" md="6" class="pr-2">
        <v-card
          class="pa-0 d-flex flex-column"
          variant="outlined"
          :style="{ height: rawSignalView === 'combined' ? '400px' : '850px' }"
        >
          <div class="panel-header px-4 py-3 d-flex justify-space-between align-center border-b">
             <div class="text-subtitle-2 d-flex align-center font-weight-bold text-grey-darken-3">
                <PhWaveform :size="18" class="mr-2"/>
                Filtered Signal <span class="text-caption text-grey ml-1 font-weight-regular">{{ rawSignalView === 'combined' ? '(Combined)' : '(Per-Channel)' }}</span>
             </div>
             <button
                class="carousel-btn"
                @click="toggleRawSignalView"
                :title="rawSignalView === 'combined' ? 'Switch to per-channel view' : 'Switch to combined view'"
              >
                <PhCaretLeft v-if="rawSignalView === 'per-channel'" :size="16" />
                <PhCaretRight v-else :size="16" />
              </button>
          </div>

          <div class="chart-container-wrapper pa-2">
             <div v-show="rawSignalView === 'combined'" class="fill-height">
                <CombinedTimeSeriesChart
                  :filtered-buffers="filteredBuffers"
                  :active-channels="activeChannels"
                  :processing-version="processingVersion"
                />
             </div>
             <div v-show="rawSignalView === 'per-channel'" class="per-channel-container">
                <PerChannelTimeSeriesChart
                  v-for="ch in activeChannels"
                  :key="ch.electrodeLabel"
                  :channel="ch"
                  :filtered-buffers="filteredBuffers"
                  :processing-version="processingVersion"
                />
             </div>
          </div>
        </v-card>
      </v-col>
      <v-col cols="12" md="6" class="pl-2">
        <v-card class="pa-0 d-flex flex-column" variant="outlined" style="height: 400px">
          <div class="panel-header px-4 py-3 d-flex align-center border-b">
             <div class="text-subtitle-2 d-flex align-center font-weight-bold text-grey-darken-3">
                <PhChartLine :size="18" class="mr-2"/>
                Frequency Spectrum
             </div>
          </div>
          <div class="chart-container-wrapper pa-2">
            <FFTSpectrumChart
              :fft-output="fftOutput"
              :average-fft="averageFFT"
              :active-channels="activeChannels"
              :processing-version="processingVersion"
            />
          </div>
        </v-card>

        <div class="d-flex flex-column align-center mt-8">
          <v-btn
            class="px-8 mb-6"
            :append-icon="PhArrowRight"
            :disabled="!isReady"
            @click="handleContinue"
          >
            Continue to Calibration
          </v-btn>
          <v-btn
            variant="text"
            color="grey"
            :prepend-icon="PhSkipForward"
            @click="handleSkip"
          >
            Skip for now
          </v-btn>
        </div>
      </v-col>
    </v-row>
  </div>
</template>

<style scoped>
.signal-visualization {
  max-width: 1200px;
  margin: 0 auto;
}

/* eslint-disable-next-line */
/*noinspection CssUnusedSymbol*/
.v-alert {
  height: 36px;
  display: flex;
  align-items: center;
  padding-top: 0;
  padding-bottom: 0;
}

/* eslint-disable-next-line */
/*noinspection CssUnusedSymbol*/
.v-alert :deep(.v-alert__prepend) {
  align-self: center;
}

/* eslint-disable-next-line */
/*noinspection CssUnusedSymbol*/
.v-alert :deep(.v-icon) {
  font-size: 24px !important;
}

.panel-header {
  border-bottom: 1px solid rgba(0,0,0,0.12);
  background: #fff;
}

.border-b {
  border-bottom: 1px solid rgba(0,0,0,0.12);
}

.chart-container-wrapper {
  overflow-y: auto;
  flex: 1;
  /* Custom scrollbar for webkit */
  scrollbar-width: thin;
}

.chart-container-wrapper::-webkit-scrollbar {
  width: 6px;
}

.chart-container-wrapper::-webkit-scrollbar-thumb {
  background-color: #e0e0e0;
  border-radius: 3px;
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

.per-channel-container {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.fill-height {
  height: 100%;
}
</style>
