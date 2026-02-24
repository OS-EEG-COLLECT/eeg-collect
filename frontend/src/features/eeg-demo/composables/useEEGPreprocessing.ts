/**
 * EEG Preprocessing Composable
 *
 * Provides unified filtering and single FFT computation for all consumers.
 * Layer 2 in the processing pipeline:
 *
 * hooks.ts (Platform) -> useEEGAcquisition -> useEEGPreprocessing -> useASSRDetection
 *
 * Filter Chain:
 * 1. Bandpass 1-45Hz (2nd-order HP + LP cascade = 4th-order Butterworth)
 * 2. Notch 50Hz (if enabled)
 * 3. Notch 60Hz (if enabled)
 * 4. Hamming window + FFT (1024-point)
 *
 * Key Features:
 * - Streaming filter mode: only new samples are filtered each cycle
 * - Filter state persists across cycles (no cold-start transient after initial warmup)
 * - Single FFT computation for all downstream consumers (no duplicate processing)
 * - Configurable filter chain
 * - 50ms update cycle matching acquisition
 */

import { ref, computed, watch, onUnmounted, markRaw, type ComputedRef, type Ref } from 'vue';
import {
  useEEGAcquisition,
  type ChannelInfo,
} from './useEEGAcquisition';
import { getEEGFilterService } from '../services/eegFilterService';
import { complexArray, fft, fftFreq, spectrumMag, window as dspWindow, windowHamming } from '@thi.ng/dsp';

const SAMPLE_RATE = 250;
const FFT_SIZE = 1024;
const BUFFER_SIZE = SAMPLE_RATE * 4; // 1000 samples, must match acquisition

export interface PreprocessingConfig {
  /** Enable/disable all preprocessing */
  enabled: boolean;
  /** Bandpass filter low cutoff (Hz) */
  bandpassLow: number;
  /** Bandpass filter high cutoff (Hz) */
  bandpassHigh: number;
  /** Enable 50Hz notch filter */
  notch50Enabled: boolean;
  /** Enable 60Hz notch filter */
  notch60Enabled: boolean;
  /** Notch filter bandwidth (Hz) */
  notchBandwidth: number;
}

export const DEFAULT_PREPROCESSING_CONFIG: PreprocessingConfig = {
  enabled: true,
  bandpassLow: 1,
  bandpassHigh: 45,
  notch50Enabled: true, // Europe default
  notch60Enabled: false,
  notchBandwidth: 4,
};

export interface FFTOutput {
  /** Frequency bins (Hz) */
  frequencies: Float64Array;
  /** Magnitude at each frequency bin */
  magnitudes: Float64Array;
}

export interface ChannelFFTResult {
  /** Channel identifier (electrode label) */
  channelLabel: string;
  /** Hardware channel name (A1-A16) */
  hardwareName: string;
  /** FFT output for this channel */
  fft: FFTOutput;
}

export interface UseEEGPreprocessingReturn {
  /** Filtered buffers per channel */
  filteredBuffers: ComputedRef<Record<string, Float32Array>>;
  /** FFT output per channel */
  fftOutput: Ref<Record<string, ChannelFFTResult>>;
  /** Average FFT across all channels */
  averageFFT: ComputedRef<FFTOutput | null>;
  /** Current preprocessing config */
  config: Ref<PreprocessingConfig>;
  /** Active channels from acquisition layer */
  activeChannels: ComputedRef<ChannelInfo[]>;
  /** Whether preprocessing is running */
  isRunning: Ref<boolean>;
  /** Whether data is ready for processing */
  isReady: ComputedRef<boolean>;
  /** Version counter - increments on each processing cycle. Watch this for reliable updates. */
  processingVersion: Ref<number>;
  /** Start preprocessing */
  start: () => void;
  /** Stop preprocessing */
  stop: () => void;
  /** Update configuration */
  updateConfig: (newConfig: Partial<PreprocessingConfig>) => void;
}

/**
 * Pad or truncate signal into a pre-allocated output buffer of `targetSize`.
 * If signal is shorter, zero-pads at the beginning (most-recent samples at end).
 * If signal is longer, takes the most-recent `targetSize` samples.
 */
function padToSize(signal: Float32Array, out: Float64Array): void {
  const targetSize = out.length;

  if (signal.length >= targetSize) {
    // Take the most recent samples
    const offset = signal.length - targetSize;
    out.set(signal.subarray(offset, offset + targetSize));
  } else {
    // Zero-pad at the beginning
    const offset = targetSize - signal.length;
    out.fill(0, 0, offset);
    out.set(signal, offset);
  }
}

/**
 * Unwrap a circular buffer to a linear array (oldest to newest).
 */
function unwrapCircularBuffer(
  buffer: Float32Array,
  writeIdx: number,
  count: number,
  bufferSize: number,
): Float32Array {
  const output = new Float32Array(count);

  if (count < bufferSize) {
    // Buffer not full yet, simple copy
    for (let i = 0; i < count; i++) {
      output[i] = buffer[i];
    }
  } else {
    // Buffer is full, unwrap from write position (oldest sample)
    const startIdx = writeIdx % bufferSize;
    for (let i = 0; i < bufferSize; i++) {
      output[i] = buffer[(startIdx + i) % bufferSize];
    }
  }

  return output;
}

/**
 * Composable for EEG preprocessing with filtering and FFT
 */
export function useEEGPreprocessing(
  initialConfig?: Partial<PreprocessingConfig>
): UseEEGPreprocessingReturn {
  const acquisition = useEEGAcquisition();

  const config = ref<PreprocessingConfig>({
    ...DEFAULT_PREPROCESSING_CONFIG,
    ...initialConfig,
  });

  const filterService = getEEGFilterService({
    sampleRate: SAMPLE_RATE,
    bandPassEnabled: config.value.enabled,
    bandPassLow: config.value.bandpassLow,
    bandPassHigh: config.value.bandpassHigh,
    notch50Enabled: config.value.notch50Enabled,
    notch60Enabled: config.value.notch60Enabled,
    notchBandwidth: config.value.notchBandwidth,
  });

  // Pre-compute Hamming window (thi.ng exact coefficients: a = 0.53836)
  const hammingWindow = dspWindow(windowHamming, FFT_SIZE);

  const frequencyBins = fftFreq(FFT_SIZE, SAMPLE_RATE);

  // Pre-allocated work buffers — reused every processing cycle.
  // ComplexArray [real, imag] is passed to fft() which operates in-place.
  const _fftComplex = complexArray(FFT_SIZE) as [Float64Array, Float64Array];

  // Reusable scratch buffer for new samples (avoids allocation per cycle)
  let _scratchIn = new Float32Array(64);
  let _scratchOut = new Float32Array(64);

  const isRunning = ref(false);
  const fftOutput = ref<Record<string, ChannelFFTResult>>({});
  const filteredBuffersCache = ref<Record<string, Float32Array>>({});

  // Version counter for external reactivity (incremented on each processing cycle)
  const processingVersion = ref(0);

  // --- Streaming filter state ---
  // Filtered circular buffers per channel (mirrors raw circular buffers)
  const filteredCircularBuffers: Record<string, Float32Array> = {};
  const filteredWriteIndices: Record<string, number> = {};
  const filteredSampleCounts: Record<string, number> = {};
  // Last raw writeIndex we processed per channel (tracks how far we've consumed)
  const lastProcessedWriteIndex: Record<string, number> = {};

  /**
   * Initialize filtered buffers for all active channels.
   * Called on start and when channels change.
   */
  function initFilteredBuffers(): void {
    const channels = acquisition.activeChannels.value;
    for (const channel of channels) {
      const label = channel.electrodeLabel;
      filteredCircularBuffers[label] = new Float32Array(BUFFER_SIZE);
      filteredWriteIndices[label] = 0;
      filteredSampleCounts[label] = 0;
      lastProcessedWriteIndex[label] = 0;
      // Reset filter state for this channel so it starts fresh
      filterService.resetChain(label);
    }
  }

  /**
   * Process all channels: incrementally filter new samples and compute FFT.
   *
   * Instead of re-filtering the entire 1000-sample buffer every cycle,
   * we only filter the NEW samples that arrived since the last cycle.
   * Filter state persists across cycles, eliminating cold-start transients.
   */
  function processAllChannels(): void {
    const channels = acquisition.activeChannels.value;
    if (channels.length === 0) return;

    const rawBuffers = acquisition.rawCircularBuffers.value;
    const rawIndices = acquisition.rawWriteIndices.value;
    const rawCounts = acquisition.rawSampleCounts.value;

    const newFilteredOutputs: Record<string, Float32Array> = {};
    const newFFTOutput: Record<string, ChannelFFTResult> = {};

    for (const channel of channels) {
      const label = channel.electrodeLabel;
      const rawBuffer = rawBuffers[label];
      const rawWriteIdx = rawIndices[label] ?? 0;
      const rawCount = rawCounts[label] ?? 0;

      if (!rawBuffer || rawCount === 0) continue;

      // Ensure filtered buffer exists for this channel
      if (!filteredCircularBuffers[label]) {
        filteredCircularBuffers[label] = new Float32Array(BUFFER_SIZE);
        filteredWriteIndices[label] = 0;
        filteredSampleCounts[label] = 0;
        lastProcessedWriteIndex[label] = 0;
        filterService.resetChain(label);
      }

      const lastIdx = lastProcessedWriteIndex[label];

      // Calculate how many new samples arrived
      let newSampleCount = rawWriteIdx - lastIdx;

      // Guard: if the acquisition was reset or we somehow fell behind by more
      // than BUFFER_SIZE, we can only process what's in the buffer
      if (newSampleCount < 0 || newSampleCount > BUFFER_SIZE) {
        // Acquisition was reset — re-init this channel
        filteredCircularBuffers[label].fill(0);
        filteredWriteIndices[label] = 0;
        filteredSampleCounts[label] = 0;
        filterService.resetChain(label);
        newSampleCount = rawCount; // Process all available samples
        // The oldest sample in the raw buffer starts at rawWriteIdx - rawCount
        lastProcessedWriteIndex[label] = rawWriteIdx - rawCount;
      }

      if (newSampleCount > 0) {
        // Ensure scratch buffers are large enough
        if (_scratchIn.length < newSampleCount) {
          _scratchIn = new Float32Array(newSampleCount);
          _scratchOut = new Float32Array(newSampleCount);
        }

        // Read new samples from raw circular buffer
        const startReadIdx = lastProcessedWriteIndex[label];
        for (let i = 0; i < newSampleCount; i++) {
          _scratchIn[i] = rawBuffer[(startReadIdx + i) % BUFFER_SIZE];
        }

        const inSlice = _scratchIn.subarray(0, newSampleCount);
        const outSlice = _scratchOut.subarray(0, newSampleCount);

        // Filter only the new samples (streaming mode — state persists)
        if (config.value.enabled) {
          filterService.filterSamples(label, inSlice, outSlice);
        } else {
          outSlice.set(inSlice);
        }

        // Write filtered samples into filtered circular buffer
        const filtBuf = filteredCircularBuffers[label];
        let fWriteIdx = filteredWriteIndices[label];
        for (let i = 0; i < newSampleCount; i++) {
          filtBuf[fWriteIdx % BUFFER_SIZE] = outSlice[i];
          fWriteIdx++;
        }
        filteredWriteIndices[label] = fWriteIdx;
        filteredSampleCounts[label] = Math.min(
          filteredSampleCounts[label] + newSampleCount,
          BUFFER_SIZE,
        );

        // Update tracking
        lastProcessedWriteIndex[label] = rawWriteIdx;
      }

      // Unwrap filtered circular buffer for chart display and FFT
      const filteredLinear = unwrapCircularBuffer(
        filteredCircularBuffers[label],
        filteredWriteIndices[label],
        filteredSampleCounts[label],
        BUFFER_SIZE,
      );

      newFilteredOutputs[label] = filteredLinear;

      // Pad/truncate into real part of complex buffer, zero imag, run FFT
      padToSize(filteredLinear, _fftComplex[0]);
      _fftComplex[1].fill(0);
      fft(_fftComplex, hammingWindow);

      // Extract magnitudes (up to Nyquist) into a fresh buffer for this channel
      const magnitudes = new Float64Array(FFT_SIZE / 2);
      spectrumMag(_fftComplex, FFT_SIZE / 2, magnitudes);

      newFFTOutput[label] = {
        channelLabel: label,
        hardwareName: channel.hardwareName,
        fft: {
          frequencies: frequencyBins,
          magnitudes: magnitudes,
        },
      };
    }

    // Use markRaw to prevent Vue from making large typed arrays reactive (performance optimization).
    // Reactivity is maintained via processingVersion counter - computed properties watch the counter,
    // not the data itself. This avoids creating Proxy wrappers for thousands of array elements.
    filteredBuffersCache.value = markRaw(newFilteredOutputs);
    fftOutput.value = markRaw(newFFTOutput);
    processingVersion.value++; // Increment to trigger reactive updates
  }

  const filteredBuffers = computed<Record<string, Float32Array>>(() => {
    void processingVersion.value;
    return filteredBuffersCache.value;
  });

  const averageFFT = computed<FFTOutput | null>(() => {
    void processingVersion.value;
    const results = Object.values(fftOutput.value);

    if (results.length === 0) return null;

    const avgMagnitudes = new Float64Array(FFT_SIZE / 2);

    for (const result of results) {
      const mags = result.fft.magnitudes;
      for (let i = 0; i < mags.length; i++) {
        avgMagnitudes[i] += mags[i];
      }
    }

    for (let i = 0; i < avgMagnitudes.length; i++) {
      avgMagnitudes[i] /= results.length;
    }

    return {
      frequencies: frequencyBins,
      magnitudes: avgMagnitudes,
    };
  });

  const isReady = computed(() => acquisition.isBufferReady.value);

  function start(): void {
    if (isRunning.value) return;

    console.log('[useEEGPreprocessing] Starting preprocessing');
    isRunning.value = true;
    initFilteredBuffers();

    // Ensure acquisition is running
    acquisition.start();
  }

  function stop(): void {
    if (!isRunning.value) return;

    console.log('[useEEGPreprocessing] Stopping preprocessing');
    isRunning.value = false;
  }

  function updateConfig(newConfig: Partial<PreprocessingConfig>): void {
    config.value = { ...config.value, ...newConfig };

    filterService.updateConfig({
      bandPassEnabled: config.value.enabled,
      bandPassLow: config.value.bandpassLow,
      bandPassHigh: config.value.bandpassHigh,
      notch50Enabled: config.value.notch50Enabled,
      notch60Enabled: config.value.notch60Enabled,
      notchBandwidth: config.value.notchBandwidth,
    });

    // Re-initialize filtered buffers since filter config changed
    // (filter chains were cleared by updateConfig, so state must restart)
    initFilteredBuffers();
  }

  watch(
    () => acquisition.bufferVersion.value,
    () => {
      if (isRunning.value && acquisition.isBufferReady.value) {
        processAllChannels();
      }
    },
  );

  // Auto-start when acquisition has data
  watch(
    () => acquisition.isBufferReady.value,
    (ready) => {
      if (ready && !isRunning.value) {
        start();
      }
    }
  );

  onUnmounted(() => {
    stop();
  });

  return {
    filteredBuffers,
    fftOutput,
    averageFFT,
    config,
    activeChannels: acquisition.activeChannels,
    isRunning,
    isReady,
    processingVersion,
    start,
    stop,
    updateConfig,
  };
}
