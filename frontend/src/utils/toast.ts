import { ref } from "vue";

// Small app-wide toast store. Render <AppToast /> once (App.vue) and call
// useToast().showToast(...) from any component.

export type ToastType = "success" | "error";

export interface Toast {
  id: number;
  message: string;
  type: ToastType;
}

const TOAST_DURATION_MS = 3000;
// older toasts are dropped when more than this are visible at once
const MAX_VISIBLE_TOASTS = 3;

const toasts = ref<Toast[]>([]);
let nextToastId = 1;

const dismissToast = (id: number) => {
  toasts.value = toasts.value.filter((toast) => toast.id !== id);
};

const showToast = (message: string, type: ToastType = "success") => {
  const id = nextToastId++;
  toasts.value = [...toasts.value, { id, message, type }].slice(
    -MAX_VISIBLE_TOASTS,
  );
  setTimeout(() => dismissToast(id), TOAST_DURATION_MS);
};

export const useToast = () => ({
  toasts,
  showToast,
  showErrorToast: (message: string) => showToast(message, "error"),
  dismissToast,
});
