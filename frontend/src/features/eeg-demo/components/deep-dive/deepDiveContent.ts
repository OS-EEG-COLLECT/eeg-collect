/**
 * Deep-dive explainer content keyed by demo step.
 * Displayed in the DeepDiveExplainer panel when the user clicks the dolphin.
 */

export interface DeepDiveContent {
  title: string;
  paragraphs: string[];
}

type DemoStep = 'welcome' | 'impedance' | 'visualization' | 'calibration' | 'gallery' | 'controller';

export const deepDiveContent: Record<DemoStep, DeepDiveContent> = {
  welcome: {
    title: 'How Brain-Controlled Gaming Works',
    paragraphs: [
      'When you listen to a 40 Hz amplitude-modulated sound, neurons in your auditory cortex synchronize at that frequency. This produces a measurable 40 Hz signal in the EEG called the Auditory Steady-State Response (ASSR).',
      'By comparing 40 Hz power against surrounding background activity — a metric called Signal-to-Noise Ratio (SNR) — the system estimates whether you are attending to the stimulus.',
      'That estimate becomes the control signal for a game: focus on the sound to trigger an action, relax to stop.',
      'The ASSR was first described by Galambos et al. (1981) and has since been well-characterized as a robust marker of auditory attention (Picton et al., 2003).',
    ],
  },

  impedance: {
    title: 'Why Signal Quality Matters',
    paragraphs: [
      'EEG measures microvolt-range voltages on the scalp — typically between 10 and 100 \u00B5V. That is roughly ten to a hundred times smaller than a typical ECG heart signal.',
      'Impedance measures how much the electrode-skin interface resists the flow of the EEG signal. High impedance means more noise and a weaker signal, making it harder to detect the ASSR.',
      'The target is below about 20 k\u03A9 per channel. Pressing electrodes gently against the skin or adjusting headset fit usually brings impedance down.',
      'The audio baseline check verifies that the headset can already pick up your auditory response before you move on to the later steps.',
    ],
  },

  visualization: {
    title: 'Reading Your Brain Signals',
    paragraphs: [
      'The left panel shows EEG after filtering: a high-pass at 1 Hz removes slow drift, a low-pass at 45 Hz removes muscle artifacts and high-frequency noise, and a notch at 50 Hz removes power-line interference.',
      'The right panel shows the frequency spectrum computed via FFT (Fast Fourier Transform). This decomposes the signal into its component frequencies — a peak near 40 Hz during stimulation indicates ASSR.',
      'Multiple channels are displayed because electrodes sit at different scalp locations. The ASSR is typically strongest over temporal and frontal regions, so not every channel will show the same peak.',
    ],
  },

  calibration: {
    title: 'Establishing a Baseline',
    paragraphs: [
      'Before the system can detect focus, it needs a reference point. The calibration records 10 seconds of resting EEG with no stimulus to measure background noise near 40 Hz — your personal noise floor.',
      'During gameplay, current 40 Hz power is compared to this baseline via SNR. If the signal-to-noise ratio exceeds a threshold (typically 3\u20135\u00D7 baseline power), the system considers you focused and triggers the game action.',
      'More recording time produces a more stable baseline, but 10 seconds is a practical trade-off between accuracy and user patience.',
    ],
  },

  gallery: {
    title: 'About the Games',
    paragraphs: [
      'Most games use a single binary control \u2014 ASSR detected or not \u2014 though some (like Balloons) use two independent frequencies for richer interaction.',
      'Games differ in their timing requirements. Some need sustained focus over several seconds, while others respond to brief bursts of attention. Choose one that matches the control style you find comfortable.',
      'Any browser game that accepts keyboard input can be adapted to brain control by mapping ASSR detection to a keystroke.',
    ],
  },

  controller: {
    title: 'Brain-to-Key Mapping',
    paragraphs: [
      'When ASSR detection fires, the system programmatically presses the selected keyboard key as if you had typed it.',
      'The cooldown sets the minimum time between consecutive key presses. A shorter cooldown makes control more responsive, but increases the chance of false triggers from signal fluctuations. A longer cooldown is more conservative.',
      'The mapping is flexible because different games use different keys — Space for jump, arrows for movement, and so on.',
    ],
  },
};
