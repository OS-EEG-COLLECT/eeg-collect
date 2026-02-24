/**
 * EEG Demo Feature Module
 * 
 * Self-contained module for demonstrating Auditory Steady-State Response (ASSR).
 * 
 * Features:
 * - 40Hz modulated audio stimulus (Web Audio API)
 * - FFT-based 40Hz power detection
 * - Calibration wizard for personalized thresholds
 * - Virtual keyboard driver for game control
 * - Built-in demo game
 * - Developer Sandbox Dashboard for DSP calibration
 *
 * Usage:
 * Add the routes to your router configuration:
 *
 * import { DemoPage, SandboxPage } from '@/features/eeg-demo';
 *
 * // Main demo flow
 * { path: '/demo', component: DemoPage }
 *
 * // Developer sandbox for calibration
 * { path: '/sandbox', component: SandboxPage }
 */

// Pages
export { default as DemoPage } from './DemoPage.vue';
export { default as SandboxPage } from './SandboxPage.vue';

// Components
export * from './components';

// Services
export * from './services';

// Composables
export * from './composables';
