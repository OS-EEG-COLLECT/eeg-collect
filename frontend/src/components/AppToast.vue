<script setup lang="ts">
import { computed } from "vue";
import { PhCheckCircle, PhWarningCircle, PhX } from "@phosphor-icons/vue";
import { useToast } from "@/utils/toast";

const { toasts, dismissToast } = useToast();

// Screen reader text lives in two regions that are always in the DOM,
// otherwise some screen readers miss messages that appear together with their container.
const latestSuccess = computed(
  () => [...toasts.value].reverse().find((toast) => toast.type === "success")?.message ?? "",
);
const latestError = computed(
  () => [...toasts.value].reverse().find((toast) => toast.type === "error")?.message ?? "",
);
</script>

<template>
  <div class="toast-sr-only" aria-live="polite" role="status">{{ latestSuccess }}</div>
  <div class="toast-sr-only" aria-live="assertive" role="alert">{{ latestError }}</div>

  <!-- Visual toasts (aria-hidden, the regions above do the announcing) -->
  <TransitionGroup tag="div" name="toast" class="toast-stack" aria-hidden="true">
    <div
      v-for="toast in toasts"
      :key="toast.id"
      class="toast"
      :class="`toast--${toast.type}`"
    >
      <PhWarningCircle v-if="toast.type === 'error'" :size="20" weight="fill" />
      <PhCheckCircle v-else :size="20" weight="fill" />
      <span class="toast-message">{{ toast.message }}</span>
      <button
        type="button"
        class="toast-close"
        @click="dismissToast(toast.id)"
      >
        <PhX :size="14" />
      </button>
    </div>
  </TransitionGroup>
</template>

<style scoped>
.toast-stack {
  position: fixed;
  right: 24px;
  bottom: 24px;
  z-index: 6000;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 8px;
  pointer-events: none;
}

.toast {
  pointer-events: auto;
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 240px;
  max-width: 380px;
  padding: 12px 14px;
  border-radius: 10px;
  font-size: 14px;
  font-weight: 500;
  color: #ffffff;
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.18);
}

/* both backgrounds have > 7:1 contrast with white text */
.toast--success {
  background-color: #1f2a37;
}
.toast--error {
  background-color: #b42318;
}

.toast-message {
  flex: 1;
}

.toast-close {
  display: flex;
  background: none;
  border: none;
  color: inherit;
  opacity: 0.8;
  cursor: pointer;
  padding: 2px;
}
.toast-close:hover {
  opacity: 1;
}

.toast-enter-active,
.toast-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}
.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateY(8px);
}

.toast-sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
</style>
