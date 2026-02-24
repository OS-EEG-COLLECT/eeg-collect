/**
 * Virtual Keyboard Driver for EEG Demo
 *
 * Dispatches native KeyboardEvents when brainwave detection threshold is crossed.
 * Allows EEG-controlled interaction with web games.
 *
 * Uses named bindings to support multi-action games (e.g., left/right balloon inflation).
 * Each binding has its own key mapping, cooldown, and trigger tracking.
 */

export type KeyCode = 'Space' | 'Enter' | 'ArrowUp' | 'ArrowDown' | 'ArrowLeft' | 'ArrowRight' | 'KeyA' | 'KeyD' | 'KeyW' | 'KeyS';

export interface KeyboardDriverConfig {
  defaultCooldownMs?: number;
  targetElement?: HTMLElement | Window;
}

export interface KeyMappingDisplay {
  code: KeyCode;
  label: string;
  description: string;
}

interface KeyBinding {
  keyCode: KeyCode;
  lastTriggerTime: number;
  triggerCount: number;
  cooldownMs: number;
}

const KEY_MAPPINGS: Record<KeyCode, { key: string; keyCode: number; label: string }> = {
  'Space': { key: ' ', keyCode: 32, label: 'Spacebar' },
  'Enter': { key: 'Enter', keyCode: 13, label: 'Enter' },
  'ArrowUp': { key: 'ArrowUp', keyCode: 38, label: '↑ Arrow Up' },
  'ArrowDown': { key: 'ArrowDown', keyCode: 40, label: '↓ Arrow Down' },
  'ArrowLeft': { key: 'ArrowLeft', keyCode: 37, label: '← Arrow Left' },
  'ArrowRight': { key: 'ArrowRight', keyCode: 39, label: '→ Arrow Right' },
  'KeyA': { key: 'a', keyCode: 65, label: 'A' },
  'KeyD': { key: 'd', keyCode: 68, label: 'D' },
  'KeyW': { key: 'w', keyCode: 87, label: 'W' },
  'KeyS': { key: 's', keyCode: 83, label: 'S' },
};

class KeyboardDriver {
  private config: Required<KeyboardDriverConfig>;
  private isEnabled: boolean = false;
  private bindings: Map<string, KeyBinding> = new Map();

  constructor(config?: KeyboardDriverConfig) {
    this.config = {
      defaultCooldownMs: config?.defaultCooldownMs ?? 300,
      targetElement: config?.targetElement ?? window,
    };
  }

  enable(): void {
    this.isEnabled = true;
  }

  disable(): void {
    this.isEnabled = false;
  }

  getCurrentKey(name: string): KeyCode {
    const binding = this.bindings.get(name);
    if (!binding) {
      console.warn(`[KeyboardDriver] Binding '${name}' not found`);
      return 'Space';
    }
    return binding.keyCode;
  }

  setKey(keyCode: KeyCode, name: string): void {
    let binding = this.bindings.get(name);
    if (!binding) {
      // Create new binding
      binding = {
        keyCode,
        lastTriggerTime: 0,
        triggerCount: 0,
        cooldownMs: this.config.defaultCooldownMs,
      };
      this.bindings.set(name, binding);
    } else {
      // Update existing binding
      binding.keyCode = keyCode;
    }
  }

  getAvailableKeys(): KeyMappingDisplay[] {
    return Object.entries(KEY_MAPPINGS).map(([code, info]) => ({
      code: code as KeyCode,
      label: info.label,
      description: `Simulates pressing ${info.label}`,
    }));
  }

  getKeyLabel(keyCode: KeyCode): string {
    return KEY_MAPPINGS[keyCode]?.label ?? keyCode;
  }

  getDefaultCooldown(): number {
    return this.config.defaultCooldownMs;
  }

  setCooldown(ms: number, name: string): void {
    const binding = this.bindings.get(name);
    if (!binding) {
      console.warn(`[KeyboardDriver] Cannot set cooldown - binding '${name}' not found`);
      return;
    }
    binding.cooldownMs = Math.max(0, ms);
  }

  private isCooldownComplete(binding: KeyBinding): boolean {
    const now = Date.now();
    return (now - binding.lastTriggerTime) >= binding.cooldownMs;
  }

  private dispatchKeyDown(keyCode: KeyCode): void {
    const mapping = KEY_MAPPINGS[keyCode];
    if (!mapping) {
      console.warn(`[KeyboardDriver] Unknown key code: ${keyCode}`);
      return;
    }

    const event = new KeyboardEvent('keydown', {
      key: mapping.key,
      code: keyCode,
      keyCode: mapping.keyCode,
      which: mapping.keyCode,
      bubbles: true,
      cancelable: true,
    });

    this.config.targetElement.dispatchEvent(event);
  }

  private dispatchKeyUp(keyCode: KeyCode): void {
    const mapping = KEY_MAPPINGS[keyCode];
    if (!mapping) {
      return;
    }

    const event = new KeyboardEvent('keyup', {
      key: mapping.key,
      code: keyCode,
      keyCode: mapping.keyCode,
      which: mapping.keyCode,
      bubbles: true,
      cancelable: true,
    });

    this.config.targetElement.dispatchEvent(event);
  }

  simulateKeyPress(name: string): boolean {
    const binding = this.bindings.get(name);
    if (!binding) {
      console.warn(`[KeyboardDriver] Cannot simulate key press - binding '${name}' not found`);
      return false;
    }

    if (!this.isEnabled) {
      return false;
    }

    if (!this.isCooldownComplete(binding)) {
      return false;
    }

    binding.lastTriggerTime = Date.now();
    binding.triggerCount++;

    this.dispatchKeyDown(binding.keyCode);

    // Simulate key release after 50ms
    setTimeout(() => {
      this.dispatchKeyUp(binding.keyCode);
    }, 50);

    return true;
  }

  /** Returns true if key was triggered. */
  triggerOnDetection(isDetected: boolean, name: string): boolean {
    if (!isDetected) {
      return false;
    }

    return this.simulateKeyPress(name);
  }

  getTriggerCount(name: string): number {
    const binding = this.bindings.get(name);
    return binding?.triggerCount ?? 0;
  }

  resetTriggerCount(name: string): void {
    const binding = this.bindings.get(name);
    if (binding) {
      binding.triggerCount = 0;
    }
  }

  clearBindings(): void {
    this.bindings.clear();
  }
}

let keyboardDriverInstance: KeyboardDriver | null = null;

export const getKeyboardDriver = (config?: KeyboardDriverConfig): KeyboardDriver => {
  if (!keyboardDriverInstance) {
    keyboardDriverInstance = new KeyboardDriver(config);
  }
  return keyboardDriverInstance;
};

export const resetKeyboardDriver = (): void => {
  if (keyboardDriverInstance) {
    keyboardDriverInstance.disable();
    keyboardDriverInstance = null;
  }
};

export default KeyboardDriver;
