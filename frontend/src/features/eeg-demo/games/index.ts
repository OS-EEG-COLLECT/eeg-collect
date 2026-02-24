/**
 * Game Registry
 * 
 * Central configuration for all available games in the EEG Demo.
 * Each game defines its component, available actions, and metadata.
 */

export type GameActionType =
  | 'jump'
  | 'move_left'
  | 'move_right'
  | 'move_up'
  | 'move_down'
  | 'shoot'
  | 'select'
  | 'pause';

export interface GameAction {
  id: GameActionType;
  label: string;
  description: string;
  defaultKey: string;
  icon: string;
}

/**
 * Frequency statistics exposed by games for brain activity display.
 * All games must expose a `frequencyStats` computed property with this structure.
 */
export interface FrequencyStat {
  frequency: number;       // Frequency in Hz (e.g., 30, 40)
  label: string;           // Display label (e.g., "40 Hz", "Left Ear (30 Hz)")
  snr: number;             // Raw SNR value
  snrFormatted: string;    // Formatted SNR for display (e.g., "2.45")
  isActive: boolean;       // True when SNR > detection threshold
  triggerCount: number;    // Number of brain triggers for this frequency
}

export interface GameConfig {
  id: string;
  name: string;
  description: string;
  thumbnail: string;
  difficulty: 'easy' | 'medium' | 'hard';
  category: string;
  component: () => Promise<any>;
  available: boolean;
  actions: GameAction[];
  instructions: string[];
}

export const ALL_GAME_ACTIONS: GameAction[] = [
  { id: 'jump', label: 'Jump', description: 'Make character jump', defaultKey: 'Space', icon: 'mdi-arrow-up-bold' },
  { id: 'move_left', label: 'Move Left', description: 'Move character left', defaultKey: 'ArrowLeft', icon: 'mdi-arrow-left' },
  { id: 'move_right', label: 'Move Right', description: 'Move character right', defaultKey: 'ArrowRight', icon: 'mdi-arrow-right' },
  { id: 'move_up', label: 'Move Up', description: 'Move character up', defaultKey: 'ArrowUp', icon: 'mdi-arrow-up' },
  { id: 'move_down', label: 'Move Down', description: 'Move character down', defaultKey: 'ArrowDown', icon: 'mdi-arrow-down' },
  { id: 'shoot', label: 'Shoot', description: 'Fire projectile', defaultKey: 'Space', icon: 'mdi-target' },
  { id: 'select', label: 'Select', description: 'Confirm selection', defaultKey: 'Enter', icon: 'mdi-check' },
  { id: 'pause', label: 'Pause', description: 'Pause the game', defaultKey: 'Escape', icon: 'mdi-pause' },
];

export const GAME_REGISTRY: GameConfig[] = [
  {
    id: 'balloons',
    name: 'Balloons',
    description: 'Inflate two balloons using stereo ASSR. Left ear 30 Hz amplitude modulation inflates the left balloon, right ear 40 Hz inflates the right balloon.',
    thumbnail: '🎈',
    difficulty: 'easy',
    category: 'ASSR',
    component: () => import('./BalloonsGame.vue'),
    available: true,
    actions: [
      { id: 'move_left', label: 'Inflate Left', description: 'Inflate the left balloon', defaultKey: 'ArrowLeft', icon: 'mdi-arrow-left' },
      { id: 'move_right', label: 'Inflate Right', description: 'Inflate the right balloon', defaultKey: 'ArrowRight', icon: 'mdi-arrow-right' },
    ],
    instructions: [
      'White noise with stereo amplitude modulation (AM) at 30 Hz (left) and 40 Hz (right)',
      'Your EEG detects the Auditory Steady-State Response (ASSR) when you attend to each ear',
      'Focus attention on left ear → left balloon inflates',
      'Focus attention on right ear → right balloon inflates',
      'Note: ASSR strength varies between individuals and requires practice',
    ],
  },
  {
    id: 'flappy-brain',
    name: 'Flappy Brain',
    description: 'Slow-paced floating game using 40 Hz ASSR detection. Sustain attention on the auditory stimulus to rise, relax to descend.',
    thumbnail: '🐦',
    difficulty: 'medium',
    category: 'ASSR',
    component: () => import('./FlappyBrainGame.vue'),
    available: false,
    actions: [
      { id: 'move_up', label: 'Float', description: 'Sustain attention to rise slowly', defaultKey: 'Space', icon: 'mdi-arrow-up-bold' },
    ],
    instructions: [
      '40 Hz amplitude-modulated audio stimulus plays continuously',
      'Your EEG is analyzed for the Auditory Steady-State Response (ASSR)',
      'Sustained attention on the sound → bird rises gradually',
      'Relaxed attention → bird descends',
      'System latency: response time depends on signal strength and varies between individuals',
      'Game speed designed to accommodate brain-computer interface response characteristics',
    ],
  },
  {
    id: 'mind-balance',
    name: 'Mind Balance',
    description: 'Balance a ball using ASSR-based proportional control. Your 40 Hz ASSR amplitude maps directly to platform tilt angle.',
    thumbnail: '⚖️',
    difficulty: 'medium',
    category: 'ASSR',
    component: () => import('./ComingSoonGame.vue'),
    available: false,
    actions: [
      { id: 'move_up', label: 'Tilt Right', description: 'Increase ASSR to tilt right', defaultKey: 'ArrowRight', icon: 'mdi-arrow-right' },
      { id: 'move_down', label: 'Tilt Left', description: 'Decrease ASSR to tilt left', defaultKey: 'ArrowLeft', icon: 'mdi-arrow-left' },
    ],
    instructions: [
      '40 Hz AM audio stimulus plays continuously',
      'Real-time ASSR amplitude → platform tilt angle (proportional control)',
      'Higher ASSR = platform tilts right, lower ASSR = tilts left',
      'Keep the ball balanced in the center zone',
      'Note: Requires calibration to establish your baseline ASSR range',
    ],
  },
  {
    id: 'focus-garden',
    name: 'Focus Garden',
    description: 'Neurofeedback-style game using 40 Hz ASSR. Sustained attention makes plants grow; accumulative progress rewards learning.',
    thumbnail: '🌱',
    difficulty: 'easy',
    category: 'Neurofeedback',
    component: () => import('./ComingSoonGame.vue'),
    available: false,
    actions: [
      { id: 'select', label: 'Grow', description: 'Sustain attention to grow plants', defaultKey: 'Space', icon: 'mdi-flower' },
    ],
    instructions: [
      '40 Hz AM audio stimulus for ASSR induction',
      'Sustained attention detection → plants receive "growth signal"',
      'Accumulative system: progress is saved even if attention wavers',
      'Designed to teach and reinforce sustained attention skills',
      'Inspired by neurofeedback training principles',
    ],
  },
  {
    id: 'focus-charge',
    name: 'Focus Charge',
    description: 'Progressive ASSR training with target patterns. Sustain 40 Hz response to charge orbs; complexity increases with skill.',
    thumbnail: '⚡',
    difficulty: 'medium',
    category: 'Neurofeedback',
    component: () => import('./ComingSoonGame.vue'),
    available: false,
    actions: [
      { id: 'select', label: 'Charge', description: 'Sustain ASSR to charge target', defaultKey: 'Space', icon: 'mdi-lightning-bolt' },
    ],
    instructions: [
      '40 Hz AM auditory stimulus for ASSR generation',
      'ASSR detection → charge rate for current target orb',
      'Complete patterns by filling multiple orbs sequentially',
      'Difficulty adapts: longer durations, more targets, stricter thresholds',
      'Provides structured training for voluntary ASSR control',
    ],
  },
  {
    id: 'breath-pacer',
    name: 'Breath Pacer',
    description: 'Meditation training combining ASSR with breathing rhythm. Synchronize attention cycles with inhale/exhale patterns.',
    thumbnail: '🧘',
    difficulty: 'easy',
    category: 'Meditation',
    component: () => import('./ComingSoonGame.vue'),
    available: false,
    actions: [
      { id: 'select', label: 'Focus', description: 'Sustain attention during inhale', defaultKey: 'Space', icon: 'mdi-circle-expand' },
    ],
    instructions: [
      '40 Hz AM stimulus combined with visual breathing guide (4-6 sec cycles)',
      'Inhale phase: sustain attention on stimulus → ASSR detection',
      'Exhale phase: relax attention',
      'Slow rhythm (>4s per phase) allows reliable ASSR buildup and detection',
      'Teaches voluntary attention modulation in a calming context',
    ],
  },
];

export function getGameById(id: string): GameConfig | undefined {
  return GAME_REGISTRY.find(game => game.id === id);
}
