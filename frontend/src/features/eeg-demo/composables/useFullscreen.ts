/**
 * useFullscreen Composable
 *
 * Manages fullscreen state using the browser Fullscreen API.
 * Provides reactive state and methods to enter/exit fullscreen mode.
 */

import { ref, readonly, onMounted, onUnmounted } from 'vue';

const isFullscreen = ref(false);
const isSupported = ref(false);

export function useFullscreen() {
  const handleFullscreenChange = () => {
    isFullscreen.value = !!document.fullscreenElement;
  };

  async function enterFullscreen(): Promise<boolean> {
    if (!isSupported.value) return false;
    try {
      await document.documentElement.requestFullscreen();
      return true;
    } catch (err) {
      console.warn('[Fullscreen] Failed to enter:', err);
      return false;
    }
  }

  async function exitFullscreen(): Promise<boolean> {
    if (!document.fullscreenElement) return true;
    try {
      await document.exitFullscreen();
      return true;
    } catch (err) {
      console.warn('[Fullscreen] Failed to exit:', err);
      return false;
    }
  }

  onMounted(() => {
    isSupported.value = !!document.fullscreenEnabled;
    handleFullscreenChange();
    document.addEventListener('fullscreenchange', handleFullscreenChange);
  });

  onUnmounted(() => {
    document.removeEventListener('fullscreenchange', handleFullscreenChange);
  });

  return {
    isFullscreen: readonly(isFullscreen),
    isSupported: readonly(isSupported),
    enterFullscreen,
    exitFullscreen,
  };
}
