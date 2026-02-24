/**
 * EEG Demo Composables Index
 *
 * - useEEGAcquisition: Direct, unthrottled access to EEG data
 * - useEEGPreprocessing: Filtering + single FFT computation
 * - useASSRDetection: SNR-based focus detection with calibration
 */

// ---- New Architecture (preferred) ----
export {
  useEEGAcquisition,
  ALL_CHANNEL_NAMES,
  type ChannelName,
  type ChannelInfo,
  type UseEEGAcquisitionReturn,
} from './useEEGAcquisition';

export {
  useEEGPreprocessing,
  DEFAULT_PREPROCESSING_CONFIG,
  type PreprocessingConfig,
  type FFTOutput,
  type ChannelFFTResult,
  type UseEEGPreprocessingReturn,
} from './useEEGPreprocessing';

export {
  useASSRDetection,
  DEFAULT_ASSR_CONFIG,
  type ASSRConfig,
  type ChannelSNR,
  type CalibrationState,
  type UseASSRDetectionReturn,
} from './useASSRDetection';

// ---- Shared Composables ----
export { type DemoStep, type CalibrationResult } from './useDemoState';
export {
  useAudioEngine,
  type AudioSourceType,
  type EarMode,
  type EarConfig,
  type AudioEngineConfig,
  type AudioEngineState,
} from './useAudioEngine';
export { useFullscreen } from './useFullscreen';

