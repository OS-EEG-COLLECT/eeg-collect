/**
 * Audio Engine Composable for EEG Demo Sandbox
 *
 * Generates AM-modulated audio using Web Audio API.
 * Supports two source types: carrier tone or white noise.
 * Supports stereo output with independent per-ear configuration.
 *
 * Default: 1000Hz carrier modulated at 40Hz (ASSR stimulus).
 */

import { ref, computed, readonly, onUnmounted } from 'vue';

export type AudioSourceType = 'carrier' | 'whiteNoise';
export type EarMode = 'unified' | 'independent';

export interface EarConfig {
  sourceType: AudioSourceType;
  carrierFrequency: number;     // Hz, used when sourceType is 'carrier'
  modulationFrequency: number;  // Hz, default 40Hz for ASSR
  modulationDepth: number;      // 0-1, default 0.5 (50% modulation)
  volume: number;               // 0-1, default 0.3
}

export interface AudioEngineConfig {
  earMode: EarMode;
  left: EarConfig;
  right: EarConfig;
}

export interface AudioEngineState {
  isPlaying: boolean;
  isInitialized: boolean;
  earMode: EarMode;
  left: EarConfig;
  right: EarConfig;
}

const DEFAULT_EAR_CONFIG: EarConfig = {
  sourceType: 'carrier',
  carrierFrequency: 1000,
  modulationFrequency: 40,
  modulationDepth: 0.5,
  volume: 0.3,
};

const DEFAULT_CONFIG: AudioEngineConfig = {
  earMode: 'unified',
  left: { ...DEFAULT_EAR_CONFIG },
  right: { ...DEFAULT_EAR_CONFIG },
};

interface EarAudioNodes {
  sourceNode: OscillatorNode | AudioBufferSourceNode | null;
  modulatorOscillator: OscillatorNode | null;
  modulationGainNode: GainNode | null;
  volumeGainNode: GainNode | null;
  panNode: StereoPannerNode | null;
}

export function useAudioEngine(initialConfig?: Partial<AudioEngineConfig>) {
  const config = ref<AudioEngineConfig>(mergeConfig(DEFAULT_CONFIG, initialConfig));
  const isPlaying = ref(false);
  const isInitialized = ref(false);
  const isTransitioning = ref(false);

  // Kept outside reactive for performance
  let audioContext: AudioContext | null = null;
  let leftNodes: EarAudioNodes = createEmptyNodes();
  let rightNodes: EarAudioNodes = createEmptyNodes();
  let masterGainNode: GainNode | null = null;

  const state = computed<AudioEngineState>(() => ({
    isPlaying: isPlaying.value,
    isInitialized: isInitialized.value,
    earMode: config.value.earMode,
    left: { ...config.value.left },
    right: { ...config.value.right },
  }));

  function createEmptyNodes(): EarAudioNodes {
    return {
      sourceNode: null,
      modulatorOscillator: null,
      modulationGainNode: null,
      volumeGainNode: null,
      panNode: null,
    };
  }

  function mergeConfig(base: AudioEngineConfig, partial?: Partial<AudioEngineConfig>): AudioEngineConfig {
    if (!partial) return { ...base, left: { ...base.left }, right: { ...base.right } };
    return {
      earMode: partial.earMode ?? base.earMode,
      left: { ...base.left, ...partial.left },
      right: { ...base.right, ...partial.right },
    };
  }

  /**
   * Create a white noise buffer
   */
  function createWhiteNoiseBuffer(ctx: AudioContext, durationSec: number = 10): AudioBuffer {
    const sampleRate = ctx.sampleRate;
    const bufferSize = sampleRate * durationSec;
    const buffer = ctx.createBuffer(1, bufferSize, sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    return buffer;
  }

  /**
   * Create audio nodes for one ear
   */
  function createEarNodes(ctx: AudioContext, earConfig: EarConfig, pan: number): EarAudioNodes {
    const nodes: EarAudioNodes = createEmptyNodes();

    // Create source based on type
    if (earConfig.sourceType === 'carrier') {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = earConfig.carrierFrequency;
      nodes.sourceNode = osc;
    } else {
      const noiseBuffer = createWhiteNoiseBuffer(ctx);
      const bufferSource = ctx.createBufferSource();
      bufferSource.buffer = noiseBuffer;
      bufferSource.loop = true;
      nodes.sourceNode = bufferSource;
    }

    // Create modulator oscillator
    nodes.modulatorOscillator = ctx.createOscillator();
    nodes.modulatorOscillator.type = 'sine';
    nodes.modulatorOscillator.frequency.value = earConfig.modulationFrequency;

    // Modulation gain node (amplitude modulation)
    nodes.modulationGainNode = ctx.createGain();
    nodes.modulationGainNode.gain.value = 1.0;

    // Modulation depth scaler
    const depthNode = ctx.createGain();
    depthNode.gain.value = earConfig.modulationDepth;

    // Volume control
    nodes.volumeGainNode = ctx.createGain();
    nodes.volumeGainNode.gain.value = earConfig.volume;

    // Stereo panner
    nodes.panNode = ctx.createStereoPanner();
    nodes.panNode.pan.value = pan;

    // Connect modulation chain:
    // Modulator -> DepthScaler -> ModulationGain.gain (AudioParam)
    nodes.modulatorOscillator.connect(depthNode);
    depthNode.connect(nodes.modulationGainNode.gain);

    // Connect audio chain:
    // Source -> ModulationGain -> VolumeGain -> Panner
    nodes.sourceNode.connect(nodes.modulationGainNode);
    nodes.modulationGainNode.connect(nodes.volumeGainNode);
    nodes.volumeGainNode.connect(nodes.panNode);

    return nodes;
  }

  /**
   * Stop and disconnect nodes for one ear
   */
  function stopEarNodes(nodes: EarAudioNodes): void {
    try {
      if (nodes.sourceNode) {
        if ('stop' in nodes.sourceNode) {
          nodes.sourceNode.stop();
        }
        nodes.sourceNode.disconnect();
      }
      if (nodes.modulatorOscillator) {
        nodes.modulatorOscillator.stop();
        nodes.modulatorOscillator.disconnect();
      }
      if (nodes.modulationGainNode) {
        nodes.modulationGainNode.disconnect();
      }
      if (nodes.volumeGainNode) {
        nodes.volumeGainNode.disconnect();
      }
      if (nodes.panNode) {
        nodes.panNode.disconnect();
      }
    } catch (err) {
      console.warn('[AudioEngine] Error stopping ear nodes:', err);
    }
  }

  /**
   * Initialize AudioContext (must be called after user gesture)
   */
  async function initialize(): Promise<void> {
    if (audioContext) {
      if (audioContext.state === 'suspended') {
        await audioContext.resume();
      }
      isInitialized.value = true;
      return;
    }

    audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();

    if (audioContext.state === 'suspended') {
      await audioContext.resume();
    }

    // Create master gain
    masterGainNode = audioContext.createGain();
    masterGainNode.gain.value = 1.0;
    masterGainNode.connect(audioContext.destination);

    isInitialized.value = true;
    console.log('[AudioEngine] Initialized, sample rate:', audioContext.sampleRate);
  }

  /**
   * Start playing audio
   */
  async function start(): Promise<void> {
    if (isPlaying.value) {
      console.warn('[AudioEngine] start() called but already playing');
      return;
    }

    if (isTransitioning.value) {
      console.warn('[AudioEngine] start() called but operation in progress, ignoring');
      return;
    }

    isTransitioning.value = true;

    try {
      await initialize();

      if (!audioContext || !masterGainNode) {
        throw new Error('AudioContext not initialized');
      }

      const cfg = config.value;

      // In unified mode, both ears use left config
      const leftConfig = cfg.left;
      const rightConfig = cfg.earMode === 'unified' ? cfg.left : cfg.right;

      // Create left ear nodes (pan = -1)
      leftNodes = createEarNodes(audioContext, leftConfig, -1);
      leftNodes.panNode!.connect(masterGainNode);

      // Create right ear nodes (pan = +1)
      rightNodes = createEarNodes(audioContext, rightConfig, 1);
      rightNodes.panNode!.connect(masterGainNode);

      // Start all oscillators and sources
      if (leftNodes.sourceNode) {
        leftNodes.sourceNode.start();
      }
      if (leftNodes.modulatorOscillator) {
        leftNodes.modulatorOscillator.start();
      }
      if (rightNodes.sourceNode) {
        rightNodes.sourceNode.start();
      }
      if (rightNodes.modulatorOscillator) {
        rightNodes.modulatorOscillator.start();
      }

      isPlaying.value = true;
      console.log('[AudioEngine] Started playing:', cfg.earMode, 'mode');
    } finally {
      isTransitioning.value = false;
    }
  }

  /**
   * Stop playing audio
   */
  function stop(): void {
    if (!isPlaying.value) {
      console.warn('[AudioEngine] stop() called but not playing');
      return;
    }

    if (isTransitioning.value) {
      console.warn('[AudioEngine] stop() called but operation in progress, ignoring');
      return;
    }

    isTransitioning.value = true;

    try {
      stopEarNodes(leftNodes);
      stopEarNodes(rightNodes);
      leftNodes = createEmptyNodes();
      rightNodes = createEmptyNodes();

      isPlaying.value = false;
      console.log('[AudioEngine] Stopped');
    } finally {
      isTransitioning.value = false;
    }
  }

  /**
   * Toggle play/stop
   */
  async function toggle(): Promise<void> {
    if (isPlaying.value) {
      stop();
    } else {
      await start();
    }
  }

  /**
   * Update full configuration (restarts audio if playing)
   */
  async function updateConfig(newConfig: Partial<AudioEngineConfig>): Promise<void> {
    const wasPlaying = isPlaying.value;
    if (wasPlaying) {
      stop();
    }

    config.value = mergeConfig(config.value, newConfig);

    if (wasPlaying) {
      await start();
    }
  }

  /**
   * Set ear mode (unified or independent)
   */
  function setEarMode(mode: EarMode): void {
    if (config.value.earMode === mode) return;
    updateConfig({ earMode: mode });
  }

  /**
   * Set source type for specified ear(s)
   */
  async function setSourceType(ear: 'left' | 'right' | 'both', sourceType: AudioSourceType): Promise<void> {
    const wasPlaying = isPlaying.value;
    if (wasPlaying) stop();

    if (ear === 'left' || ear === 'both') {
      config.value.left.sourceType = sourceType;
    }
    if (ear === 'right' || ear === 'both') {
      config.value.right.sourceType = sourceType;
    }

    if (wasPlaying) await start();
  }

  /**
   * Set carrier frequency for specified ear(s) - live update if playing
   */
  function setCarrierFrequency(ear: 'left' | 'right' | 'both', frequency: number): void {
    const freq = Math.max(100, Math.min(4000, frequency));

    if (ear === 'left' || ear === 'both') {
      config.value.left.carrierFrequency = freq;
      if (leftNodes.sourceNode && leftNodes.sourceNode instanceof OscillatorNode && audioContext) {
        leftNodes.sourceNode.frequency.linearRampToValueAtTime(freq, audioContext.currentTime + 0.02);
      }
    }
    if (ear === 'right' || ear === 'both') {
      config.value.right.carrierFrequency = freq;
      if (rightNodes.sourceNode && rightNodes.sourceNode instanceof OscillatorNode && audioContext) {
        rightNodes.sourceNode.frequency.linearRampToValueAtTime(freq, audioContext.currentTime + 0.02);
      }
    }
  }

  /**
   * Set modulation frequency for specified ear(s) - live update if playing
   */
  function setModulationFrequency(ear: 'left' | 'right' | 'both', frequency: number): void {
    const freq = Math.max(1, Math.min(100, frequency));

    if (ear === 'left' || ear === 'both') {
      config.value.left.modulationFrequency = freq;
      if (leftNodes.modulatorOscillator && audioContext) {
        leftNodes.modulatorOscillator.frequency.linearRampToValueAtTime(freq, audioContext.currentTime + 0.02);
      }
    }
    if (ear === 'right' || ear === 'both') {
      config.value.right.modulationFrequency = freq;
      if (rightNodes.modulatorOscillator && audioContext) {
        rightNodes.modulatorOscillator.frequency.linearRampToValueAtTime(freq, audioContext.currentTime + 0.02);
      }
    }
  }

  /**
   * Set volume for specified ear(s) - live update if playing
   */
  function setVolume(ear: 'left' | 'right' | 'both', volume: number): void {
    const vol = Math.max(0, Math.min(1, volume));

    if (ear === 'left' || ear === 'both') {
      config.value.left.volume = vol;
      if (leftNodes.volumeGainNode && audioContext) {
        leftNodes.volumeGainNode.gain.linearRampToValueAtTime(vol, audioContext.currentTime + 0.05);
      }
    }
    if (ear === 'right' || ear === 'both') {
      config.value.right.volume = vol;
      if (rightNodes.volumeGainNode && audioContext) {
        rightNodes.volumeGainNode.gain.linearRampToValueAtTime(vol, audioContext.currentTime + 0.05);
      }
    }
  }

  /** Note: Requires restart to take effect */
  function setModulationDepth(ear: 'left' | 'right' | 'both', depth: number): void {
    const d = Math.max(0, Math.min(1, depth));

    if (ear === 'left' || ear === 'both') {
      config.value.left.modulationDepth = d;
    }
    if (ear === 'right' || ear === 'both') {
      config.value.right.modulationDepth = d;
    }
  }

  /**
   * Cleanup resources
   */
  function dispose(): void {
    stop();

    if (masterGainNode) {
      masterGainNode.disconnect();
      masterGainNode = null;
    }

    if (audioContext) {
      audioContext.close();
      audioContext = null;
    }

    isInitialized.value = false;
  }

  // Cleanup on component unmount
  onUnmounted(() => {
    dispose();
  });

  return {
    state: readonly(state),
    isPlaying: readonly(isPlaying),
    isInitialized: readonly(isInitialized),
    isTransitioning: readonly(isTransitioning),
    config: readonly(config),

    // Control methods
    initialize,
    start,
    stop,
    toggle,
    dispose,
    updateConfig,

    // Configuration setters
    setEarMode,
    setSourceType,
    setCarrierFrequency,
    setModulationFrequency,
    setVolume,
    setModulationDepth,
  };
}
