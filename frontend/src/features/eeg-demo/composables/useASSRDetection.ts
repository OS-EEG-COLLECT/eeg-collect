/**
 * ASSR Detection Composable
 *
 * Provides SNR-based focus detection for Auditory Steady-State Response (ASSR).
 * Layer 3 in the processing pipeline:
 *
 * hooks.ts (Platform) -> useEEGAcquisition -> useEEGPreprocessing -> useASSRDetection
 */

import { ref, computed, watch, onUnmounted, type ComputedRef, type Ref } from 'vue';
import {
  useEEGPreprocessing,
  type UseEEGPreprocessingReturn,
  type ChannelFFTResult,
} from './useEEGPreprocessing';

const SAMPLE_RATE = 250;
const FFT_SIZE = 1024;
const BIN_WIDTH = SAMPLE_RATE / FFT_SIZE;
const DEFAULT_NEIGHBOR_OFFSET_HZ = 5; // Hz offset for noise estimation
const DEFAULT_MAX_HISTORY = 100;

export interface ASSRConfig {
  /** Target frequency for ASSR detection (Hz) */
  targetFrequency: number;
  /** Offset in Hz for neighboring bins used in noise estimation */
  neighborOffsetHz: number;
  /** Maximum SNR history length for smoothing */
  maxHistory: number;
  /** SNR threshold for focus detection */
  detectionThreshold: number;
}

export const DEFAULT_ASSR_CONFIG: ASSRConfig = {
  targetFrequency: 40,
  neighborOffsetHz: DEFAULT_NEIGHBOR_OFFSET_HZ,
  maxHistory: DEFAULT_MAX_HISTORY,
  detectionThreshold: 3.0,
};

export interface ChannelSNR {
  /** Channel electrode label */
  channelLabel: string;
  /** Hardware channel name (A1-A16) */
  hardwareName: string;
  /** SNR as linear ratio */
  snr: number;
  /** SNR in decibels */
  snrDb: number;
  /** Power at target frequency */
  targetPower: number;
  /** Average noise power from neighboring bins */
  noisePower: number;
}

export interface CalibrationState {
  /** Whether baseline recording is in progress */
  isRecordingBaseline: boolean;
  /** Progress percentage (0-100) */
  baselineProgress: number;
  /** Recorded baseline noise power (uV^2) */
  baselineNoisePower: number;
  /** Whether a valid baseline has been recorded */
  hasBaseline: boolean;
}

export interface UseASSRDetectionReturn {
  /** Per-channel SNR results */
  channelSNRs: ComputedRef<ChannelSNR[]>;
  /** Global average SNR (linear) */
  globalSNR: ComputedRef<number>;
  /** Global average SNR (dB) */
  globalSNRDb: ComputedRef<number>;
  /** Smoothed global SNR (5-sample average) */
  smoothedSNR: ComputedRef<number>;
  /** Average global SNR (10-sample average) */
  averageSNR: ComputedRef<number>;
  /** Whether focus is detected (SNR > threshold) */
  isFocused: ComputedRef<boolean>;
  /** Current configuration */
  config: Ref<ASSRConfig>;
  /** Calibration state */
  calibration: Ref<CalibrationState>;
  /** Whether baseline recording is in progress */
  isRecordingBaseline: ComputedRef<boolean>;
  /** SNR history for visualization */
  snrHistory: Ref<number[]>;
  /** Access to preprocessing layer */
  preprocessing: UseEEGPreprocessingReturn;
  /** Update configuration */
  updateConfig: (newConfig: Partial<ASSRConfig>) => void;
  /** Set target frequency */
  setTargetFrequency: (freq: number) => void;
  /** Record baseline noise floor */
  recordBaseline: (durationMs: number) => Promise<number>;
  /** Cancel ongoing baseline recording */
  cancelBaselineRecording: () => void;
  /** Compute SNR at an arbitrary frequency (for multi-frequency detection) */
  computeSNRAtFrequency: (freq: number) => number;
  /** Compute per-channel SNRs at an arbitrary frequency */
  computeChannelSNRsAtFrequency: (freq: number) => ChannelSNR[];
  /** Reset calibration and history */
  reset: () => void;
  /** Start detection (starts preprocessing) */
  start: () => void;
  /** Stop detection */
  stop: () => void;
}

/**
 * Calculate SNR for a single channel's FFT result.
 * With baselineNoisePower: SNR = targetPower / baselineNoisePower
 * Without: SNR = targetPower / mean(all noise bins in +/-offset band)
 */
function calculateChannelSNR(
  result: ChannelFFTResult,
  targetFreq: number,
  neighborOffsetHz: number,
  baselineNoisePower?: number
): ChannelSNR {
  const { magnitudes } = result.fft;
  const targetBin = Math.round(targetFreq / BIN_WIDTH);
  const lowerBin = Math.round((targetFreq - neighborOffsetHz) / BIN_WIDTH);
  const upperBin = Math.round((targetFreq + neighborOffsetHz) / BIN_WIDTH);

  // Power at target frequency
  const targetPower = targetBin >= 0 && targetBin < magnitudes.length
    ? magnitudes[targetBin] ** 2
    : 0;

  let noisePower: number;

  if (baselineNoisePower !== undefined && baselineNoisePower > 0) {
    // Use stored baseline noise power
    noisePower = baselineNoisePower;
  } else {
    // Fallback: average all bins in [lowerBin, upperBin] excluding target bin
    let noiseSum = 0;
    let noiseCount = 0;
    const minBin = Math.max(0, lowerBin);
    const maxBin = Math.min(magnitudes.length - 1, upperBin);

    for (let bin = minBin; bin <= maxBin; bin++) {
      if (bin !== targetBin) {
        noiseSum += magnitudes[bin] ** 2;
        noiseCount++;
      }
    }

    noisePower = noiseCount > 0 ? noiseSum / noiseCount : 1;
  }

  // Calculate SNR
  const snr = noisePower > 0 ? targetPower / noisePower : 0;
  const snrDb = noisePower > 0 ? 10 * Math.log10(targetPower / noisePower) : 0;

  return {
    channelLabel: result.channelLabel,
    hardwareName: result.hardwareName,
    snr,
    snrDb,
    targetPower,
    noisePower,
  };
}

/**
 * Compute snapshot noise power across all channels.
 * Averages noise power from all bins in +/-offset band (excluding target), across all channels.
 */
function computeSnapshotNoisePower(
  fftOutput: Record<string, ChannelFFTResult>,
  targetFreq: number,
  neighborOffsetHz: number
): number {
  const targetBin = Math.round(targetFreq / BIN_WIDTH);
  const lowerBin = Math.round((targetFreq - neighborOffsetHz) / BIN_WIDTH);
  const upperBin = Math.round((targetFreq + neighborOffsetHz) / BIN_WIDTH);

  let totalNoise = 0;
  let channelCount = 0;

  for (const result of Object.values(fftOutput)) {
    const { magnitudes } = result.fft;
    let noiseSum = 0;
    let noiseCount = 0;
    const minBin = Math.max(0, lowerBin);
    const maxBin = Math.min(magnitudes.length - 1, upperBin);

    for (let bin = minBin; bin <= maxBin; bin++) {
      if (bin !== targetBin) {
        noiseSum += magnitudes[bin] ** 2;
        noiseCount++;
      }
    }

    if (noiseCount > 0) {
      totalNoise += noiseSum / noiseCount;
      channelCount++;
    }
  }

  return channelCount > 0 ? totalNoise / channelCount : 0;
}

/**
 * Composable for ASSR-based focus detection
 */
export function useASSRDetection(
  initialConfig?: Partial<ASSRConfig>
): UseASSRDetectionReturn {
  // Get preprocessing layer
  const preprocessing = useEEGPreprocessing();

  // Configuration
  const config = ref<ASSRConfig>({
    ...DEFAULT_ASSR_CONFIG,
    ...initialConfig,
  });

  const snrHistory = ref<number[]>([]);

  const calibration = ref<CalibrationState>({
    isRecordingBaseline: false,
    baselineProgress: 0,
    baselineNoisePower: 0,
    hasBaseline: false,
  });

  let baselineReadings: number[] = [];
  let baselineTimer: number | null = null;
  let progressInterval: number | null = null;
  let baselineResolve: ((value: number) => void) | null = null;

  const channelSNRs = computed<ChannelSNR[]>(() => {
    const fftResults = preprocessing.fftOutput.value;
    const targetFreq = config.value.targetFrequency;
    const neighborOffset = config.value.neighborOffsetHz;
    const baseline = calibration.value.hasBaseline
      ? calibration.value.baselineNoisePower
      : undefined;

    const results: ChannelSNR[] = [];

    for (const result of Object.values(fftResults)) {
      results.push(calculateChannelSNR(result, targetFreq, neighborOffset, baseline));
    }

    return results;
  });

  const globalSNR = computed<number>(() => {
    const snrs = channelSNRs.value;
    if (snrs.length === 0) return 0;
    return snrs.reduce((sum, r) => sum + r.snr, 0) / snrs.length;
  });

  const globalSNRDb = computed<number>(() => {
    const snrs = channelSNRs.value;
    if (snrs.length === 0) return 0;
    return snrs.reduce((sum, r) => sum + r.snrDb, 0) / snrs.length;
  });

  watch(globalSNR, (newSNR) => {
    snrHistory.value.push(newSNR);
    if (snrHistory.value.length > config.value.maxHistory) {
      snrHistory.value.shift();
    }
  });

  /**
   * Smoothed SNR (5-sample moving average)
   */
  const smoothedSNR = computed<number>(() => {
    const recent = snrHistory.value.slice(-5);
    if (recent.length === 0) return 0;
    return recent.reduce((sum, v) => sum + v, 0) / recent.length;
  });

  /**
   * Average SNR (10-sample moving average)
   */
  const averageSNR = computed<number>(() => {
    const recent = snrHistory.value.slice(-10);
    if (recent.length === 0) return 0;
    return recent.reduce((sum, v) => sum + v, 0) / recent.length;
  });

  const isFocused = computed<boolean>(() => {
    return globalSNR.value > config.value.detectionThreshold;
  });

  const isRecordingBaseline = computed<boolean>(() => calibration.value.isRecordingBaseline);

  function updateConfig(newConfig: Partial<ASSRConfig>): void {
    config.value = { ...config.value, ...newConfig };
  }

  /**
   * Set target frequency (convenience method).
   * Clears the stored baseline since it may not be valid for a different frequency band.
   */
  function setTargetFrequency(freq: number): void {
    config.value.targetFrequency = freq;
    calibration.value.hasBaseline = false;
    calibration.value.baselineNoisePower = 0;
  }

  /**
   * Record baseline noise floor during silence.
   * Samples noise power at 100ms intervals, stores median as baseline.
   */
  function recordBaseline(durationMs: number): Promise<number> {
    return new Promise((resolve) => {
      baselineReadings = [];
      baselineResolve = resolve;
      calibration.value.isRecordingBaseline = true;
      calibration.value.baselineProgress = 0;

      const startTime = Date.now();

      // Collect readings at 100ms intervals
      progressInterval = window.setInterval(() => {
        const elapsed = Date.now() - startTime;
        calibration.value.baselineProgress = Math.min(100, (elapsed / durationMs) * 100);

        const snapshot = computeSnapshotNoisePower(
          preprocessing.fftOutput.value,
          config.value.targetFrequency,
          config.value.neighborOffsetHz
        );
        if (snapshot > 0) {
          baselineReadings.push(snapshot);
        }
      }, 100);

      // Complete after duration
      baselineTimer = window.setTimeout(() => {
        if (progressInterval) {
          clearInterval(progressInterval);
          progressInterval = null;
        }

        // Calculate median noise power
        let medianNoisePower = 0;
        if (baselineReadings.length > 0) {
          const sorted = [...baselineReadings].sort((a, b) => a - b);
          medianNoisePower = sorted[Math.floor(sorted.length / 2)];
        }

        calibration.value.baselineNoisePower = medianNoisePower;
        calibration.value.hasBaseline = medianNoisePower > 0;
        calibration.value.isRecordingBaseline = false;
        calibration.value.baselineProgress = 100;
        baselineTimer = null;

        if (baselineResolve) {
          baselineResolve(medianNoisePower);
          baselineResolve = null;
        }
      }, durationMs);
    });
  }

  /**
   * Cancel ongoing baseline recording
   */
  function cancelBaselineRecording(): void {
    if (baselineTimer) {
      clearTimeout(baselineTimer);
      baselineTimer = null;
    }
    if (progressInterval) {
      clearInterval(progressInterval);
      progressInterval = null;
    }
    calibration.value.isRecordingBaseline = false;
    calibration.value.baselineProgress = 0;

    if (baselineResolve) {
      baselineResolve(0);
      baselineResolve = null;
    }
  }

  /**
   * Compute SNR at an arbitrary frequency across all channels.
   * Returns global average SNR (linear ratio), same logic as globalSNR computed.
   */
  function computeSNRAtFrequency(freq: number): number {
    const fftResults = preprocessing.fftOutput.value;
    const neighborOffset = config.value.neighborOffsetHz;
    const baseline = calibration.value.hasBaseline
      ? calibration.value.baselineNoisePower
      : undefined;

    const results = Object.values(fftResults);
    if (results.length === 0) return 0;

    let sum = 0;
    for (const result of results) {
      sum += calculateChannelSNR(result, freq, neighborOffset, baseline).snr;
    }
    return sum / results.length;
  }

  /**
   * Compute per-channel SNRs at an arbitrary frequency.
   * Returns array of ChannelSNR objects, same format as channelSNRs computed.
   */
  function computeChannelSNRsAtFrequency(freq: number): ChannelSNR[] {
    const fftResults = preprocessing.fftOutput.value;
    const neighborOffset = config.value.neighborOffsetHz;
    const baseline = calibration.value.hasBaseline
      ? calibration.value.baselineNoisePower
      : undefined;

    const results: ChannelSNR[] = [];
    for (const result of Object.values(fftResults)) {
      results.push(calculateChannelSNR(result, freq, neighborOffset, baseline));
    }
    return results;
  }

  function reset(): void {
    cancelBaselineRecording();
    snrHistory.value = [];
    calibration.value = {
      isRecordingBaseline: false,
      baselineProgress: 0,
      baselineNoisePower: 0,
      hasBaseline: false,
    };
  }

  function start(): void {
    preprocessing.start();
  }

  function stop(): void {
    preprocessing.stop();
  }

  onUnmounted(() => {
    cancelBaselineRecording();
  });

  return {
    channelSNRs,
    globalSNR,
    globalSNRDb,
    smoothedSNR,
    averageSNR,
    isFocused,
    config,
    calibration,
    isRecordingBaseline,
    snrHistory,
    preprocessing,
    updateConfig,
    setTargetFrequency,
    computeSNRAtFrequency,
    computeChannelSNRsAtFrequency,
    recordBaseline,
    cancelBaselineRecording,
    reset,
    start,
    stop,
  };
}
