/**
 * EEG Acquisition Composable
 *
 * Provides direct, unthrottled access to EEG data with proper buffer management.
 * Layer 1 in the processing pipeline:
 *
 * hooks.ts (Platform) -> useEEGAcquisition -> useEEGPreprocessing -> useASSRDetection
 *
 * - Direct access to unthrottledBufferRef from platform (no 500-1000ms delays)
 * - Circular buffer per channel (4 seconds = 1000 samples at 250Hz)
 * - Float32Array for memory efficiency
 * - 50ms update cycle (~20Hz refresh rate)
 * - Dynamic channel support based on URL config
 */

import { ref, computed, watch, onUnmounted, type ComputedRef, type Ref } from 'vue';
import { useRoute } from 'vue-router';
import { unthrottledBufferRef } from '@/utils/hooks';
import type { OpenBCISerialData } from '@/utils/openBCISerialTypes';
import channelAssignmentConfig from '@/config/channelAssignment.json';

const SAMPLE_RATE = 250; // Hz (OpenBCI Cyton)
const BUFFER_DURATION_SECONDS = 4; // 4 second window for FFT
const BUFFER_SIZE = SAMPLE_RATE * BUFFER_DURATION_SECONDS; // 1000 samples
const UPDATE_INTERVAL_MS = 50; // 20Hz update rate

// Analog channel names (A1-A16)
export const ALL_CHANNEL_NAMES = [
  'A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'A7', 'A8',
  'A9', 'A10', 'A11', 'A12', 'A13', 'A14', 'A15', 'A16',
] as const;

export type ChannelName = typeof ALL_CHANNEL_NAMES[number];

export type ChannelAssignmentConfig = typeof channelAssignmentConfig;
export type ConfigKey = keyof ChannelAssignmentConfig;

// Channel info with hardware name (A1-A16) and electrode label (L1, R2, etc.)
export interface ChannelInfo {
  hardwareName: ChannelName;
  electrodeLabel: string;
  color: string;
  index: number;
}

// Color palette for channels (distinct, colorblind-friendly where possible)
const COLOR_PALETTE = [
  '#e6194b', // Red
  '#3cb44b', // Green
  '#ffe119', // Yellow
  '#4363d8', // Blue
  '#f58231', // Orange
  '#911eb4', // Purple
  '#42d4f4', // Cyan
  '#f032e6', // Magenta
  '#bfef45', // Lime
  '#fabed4', // Pink
  '#469990', // Teal
  '#dcbeff', // Lavender
  '#9A6324', // Brown
  '#fffac8', // Beige
  '#800000', // Maroon
  '#aaffc3', // Mint
];

export interface UseEEGAcquisitionReturn {
  /** Raw circular buffers per channel */
  rawCircularBuffers: Ref<Record<string, Float32Array>>;
  /** Write indices per channel (monotonically increasing; modulo BUFFER_SIZE for position) */
  rawWriteIndices: Ref<Record<string, number>>;
  /** Sample counts per channel (clamped to BUFFER_SIZE) */
  rawSampleCounts: Ref<Record<string, number>>;
  /** Increments when new samples are written — watch this for reactive updates */
  bufferVersion: Ref<number>;
  /** List of active channels based on URL config */
  activeChannels: ComputedRef<ChannelInfo[]>;
  /** Current buffer length (samples per channel) */
  bufferLength: ComputedRef<number>;
  /** Whether buffer has enough data for processing (>= half full) */
  isBufferReady: ComputedRef<boolean>;
  /** Whether acquisition is running */
  isRunning: Ref<boolean>;
  /** Sample rate in Hz */
  sampleRate: number;
  /** Buffer size in samples */
  bufferSize: number;
  /** Start acquisition */
  start: () => void;
  /** Stop acquisition */
  stop: () => void;
  /** Clear all buffers */
  clear: () => void;
}

/**
 * Composable for EEG data acquisition with efficient circular buffer management
 */
export function useEEGAcquisition(): UseEEGAcquisitionReturn {
  const route = useRoute();
  const channelConfigKey = computed(() => {
    const configParam = route.query.wlmtdoqtqe as string | undefined;
    return (configParam || 'A') as ConfigKey;
  });

  const channelAssignment = computed(() => {
    const config = channelAssignmentConfig[channelConfigKey.value];
    return config || channelAssignmentConfig.A;
  });

  const activeChannels = computed<ChannelInfo[]>(() => {
    const assignment = channelAssignment.value;
    const entries = Object.entries(assignment) as [ChannelName, string][];

    return entries.map((entry, index) => ({
      hardwareName: entry[0] as ChannelName,
      electrodeLabel: entry[1],
      color: COLOR_PALETTE[index % COLOR_PALETTE.length],
      index,
    }));
  });

  // Internal circular buffers (Float32Array for efficiency)
  const internalBuffers = ref<Record<string, Float32Array>>({});
  const writeIndices = ref<Record<string, number>>({});
  const sampleCounts = ref<Record<string, number>>({});

  // Track last processed timestamp (platform buffer uses shift/push, so index tracking doesn't work)
  let lastProcessedTimestamp = 0;

  // Processing state
  const isRunning = ref(false);
  let updateInterval: number | null = null;

  // Version counter for reactivity (incremented on each update)
  const bufferVersion = ref(0);

  /**
   * Initialize buffers for all active channels
   */
  function initializeBuffers(): void {
    const channels = activeChannels.value;
    const newBuffers: Record<string, Float32Array> = {};
    const newIndices: Record<string, number> = {};
    const newCounts: Record<string, number> = {};

    for (const channel of channels) {
      newBuffers[channel.electrodeLabel] = new Float32Array(BUFFER_SIZE);
      newIndices[channel.electrodeLabel] = 0;
      newCounts[channel.electrodeLabel] = 0;
    }

    internalBuffers.value = newBuffers;
    writeIndices.value = newIndices;
    sampleCounts.value = newCounts;
    lastProcessedTimestamp = 0;
    bufferVersion.value++;
  }

  /**
   * Process new samples from the platform buffer
   * Uses timestamp tracking because platform buffer uses shift/push (index tracking fails)
   */
  function processNewSamples(): void {
    const platformBuffer = unthrottledBufferRef.value;
    if (!platformBuffer || platformBuffer.length === 0) {
      return;
    }

    const channels = activeChannels.value;
    const buffers = internalBuffers.value;
    const indices = writeIndices.value;
    const counts = sampleCounts.value;

    let newSamplesProcessed = 0;
    let newestTimestamp = lastProcessedTimestamp;

    // Process samples newer than last processed timestamp
    for (const sample of platformBuffer) {
      if (!sample || !sample.timestamp) continue;

      // Skip samples we've already processed
      if (sample.timestamp <= lastProcessedTimestamp) continue;

      if (sample.timestamp > newestTimestamp) {
        newestTimestamp = sample.timestamp;
      }

      for (const channel of channels) {
        const label = channel.electrodeLabel;
        const buffer = buffers[label];
        if (!buffer) continue;

        const value = sample[channel.hardwareName as keyof OpenBCISerialData];
        const numValue = typeof value === 'number' ? value : 0;

        // Circular write (index increments monotonically; modulo only for buffer position)
        buffer[indices[label] % BUFFER_SIZE] = numValue;
        indices[label]++;
        counts[label] = Math.min(counts[label] + 1, BUFFER_SIZE);
      }

      newSamplesProcessed++;
    }

    if (newestTimestamp > lastProcessedTimestamp) {
      lastProcessedTimestamp = newestTimestamp;
    }

    // Only increment version if we actually processed new samples
    if (newSamplesProcessed > 0) {
      bufferVersion.value++;
    }
  }

  const bufferLength = computed(() => {
    void bufferVersion.value;
    const counts = sampleCounts.value;
    const values = Object.values(counts);
    if (values.length === 0) return 0;
    return Math.min(...values);
  });

  /**
   * Whether buffer has enough data for processing
   */
  const isBufferReady = computed(() => {
    return bufferLength.value >= BUFFER_SIZE / 2;
  });

  function start(): void {
    if (isRunning.value) return;

    console.log('[useEEGAcquisition] Starting acquisition');
    initializeBuffers();
    isRunning.value = true;

    // Process at 20Hz (50ms interval)
    updateInterval = window.setInterval(() => {
      processNewSamples();
    }, UPDATE_INTERVAL_MS);
  }

  function stop(): void {
    if (!isRunning.value) return;

    console.log('[useEEGAcquisition] Stopping acquisition');
    isRunning.value = false;

    if (updateInterval !== null) {
      clearInterval(updateInterval);
      updateInterval = null;
    }
  }

  function clear(): void {
    initializeBuffers();
  }

  // Re-initialize buffers when active channels change
  watch(activeChannels, () => {
    if (isRunning.value) {
      initializeBuffers();
    }
  }, { deep: true });

  // Auto-start when platform buffer has data
  watch(
    () => unthrottledBufferRef.value.length,
    (length) => {
      if (length > 0 && !isRunning.value) {
        start();
      }
    }
  );

  onUnmounted(() => {
    stop();
  });

  return {
    rawCircularBuffers: internalBuffers,
    rawWriteIndices: writeIndices,
    rawSampleCounts: sampleCounts,
    bufferVersion,
    activeChannels,
    bufferLength,
    isBufferReady,
    isRunning,
    sampleRate: SAMPLE_RATE,
    bufferSize: BUFFER_SIZE,
    start,
    stop,
    clear,
  };
}
