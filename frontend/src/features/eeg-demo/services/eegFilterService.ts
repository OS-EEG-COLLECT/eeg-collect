/**
 * EEG Filter Service — biquad filter chain via @thi.ng/dsp
 *
 * Each filter stage is a 2nd-order IIR biquad (Direct Form II Transposed).
 * State is managed per-channel; streaming mode maintains state across calls.
 *
 * Filter chain per channel:
 *   HP(bandPassLow) → LP(bandPassHigh) → [notch50] → [notch60]
 *
 * HP + LP cascade gives a 4th-order Butterworth bandpass over the
 * wide passband (1–45 Hz).  A single bandpass biquad would be a
 * narrow resonator — unsuitable here.
 */

import { biquadHP, biquadLP, biquadNotch, Biquad } from '@thi.ng/dsp';

class FilterChain {
  private readonly stages: Biquad[];

  constructor(stages: Biquad[]) {
    this.stages = stages;
  }

  processSample(x: number): number {
    let y = x;
    for (const stage of this.stages) {
      y = stage.next(y);
    }
    return y;
  }

  reset(): void {
    for (const stage of this.stages) {
      stage.reset();
    }
  }
}

export interface FilterConfig {
  sampleRate: number;
  bandPassEnabled: boolean;
  bandPassLow: number;
  bandPassHigh: number;
  notch50Enabled: boolean;
  notch60Enabled: boolean;
  notchBandwidth: number;
}

export const DEFAULT_FILTER_CONFIG: FilterConfig = {
  sampleRate: 250,
  bandPassEnabled: true,
  bandPassLow: 1,
  bandPassHigh: 45,
  notch50Enabled: true,
  notch60Enabled: false,
  notchBandwidth: 4,
};

class EEGFilterService {
  private config: FilterConfig;
  private chains: Map<string, FilterChain> = new Map();

  constructor(config: Partial<FilterConfig> = {}) {
    this.config = { ...DEFAULT_FILTER_CONFIG, ...config };
  }

  private createChain(): FilterChain {
    const { sampleRate, bandPassLow, bandPassHigh, notch50Enabled, notch60Enabled, notchBandwidth } =
      this.config;
    const stages: Biquad[] = [];

    if (this.config.bandPassEnabled) {
      // Q defaults to 1/√2 (Butterworth) — no explicit arg needed
      stages.push(biquadHP(bandPassLow / sampleRate));
      stages.push(biquadLP(bandPassHigh / sampleRate));
    }

    if (notch50Enabled) {
      stages.push(biquadNotch(50 / sampleRate, 50 / notchBandwidth));
    }

    if (notch60Enabled) {
      stages.push(biquadNotch(60 / sampleRate, 60 / notchBandwidth));
    }

    return new FilterChain(stages);
  }

  private getChain(channelId: string): FilterChain {
    let chain = this.chains.get(channelId);
    if (!chain) {
      chain = this.createChain();
      this.chains.set(channelId, chain);
    }
    return chain;
  }

  /**
   * Filter an array of samples in streaming mode (maintains filter state).
   *
   * This does NOT reset the filter chain — filter state carries over across
   * calls. Use this for incremental processing where only newly arrived
   * samples are filtered each cycle.
   *
   * Writes filtered output directly into `output` (same length as `input`).
   */
  filterSamples(channelId: string, input: Float32Array, output: Float32Array): void {
    const n = input.length;
    if (n === 0) return;

    const chain = this.getChain(channelId);

    for (let i = 0; i < n; i++) {
      output[i] = chain.processSample(input[i]);
    }
  }

  /**
   * Reset the filter chain for a specific channel.
   * Call this once at startup or when the config changes.
   */
  resetChain(channelId: string): void {
    const chain = this.chains.get(channelId);
    if (chain) {
      chain.reset();
    }
  }

  /**
   * Reconfigure and drop all existing chains.
   */
  updateConfig(newConfig: Partial<FilterConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.chains.clear();
  }

}

let serviceInstance: EEGFilterService | null = null;

export function getEEGFilterService(config?: Partial<FilterConfig>): EEGFilterService {
  if (!serviceInstance) {
    serviceInstance = new EEGFilterService(config);
  } else if (config) {
    serviceInstance.updateConfig(config);
  }
  return serviceInstance;
}

