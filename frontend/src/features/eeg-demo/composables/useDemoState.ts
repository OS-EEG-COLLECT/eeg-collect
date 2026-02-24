/**
 * Demo State Types
 */

export type DemoStep =
  | 'welcome'
  | 'impedance-check'
  | 'calibration'
  | 'game-controller'
  | 'game-stage';

export interface CalibrationResult {
  baselineNoisePower: number;
  threshold: number;
}
