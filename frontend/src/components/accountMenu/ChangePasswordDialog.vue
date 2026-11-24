<script setup lang="ts">
import { ref, computed, watch, defineProps, defineEmits } from "vue";
import { PhEye, PhEyeSlash } from "@phosphor-icons/vue";
import { URLs } from "@/utils/helpers";
import { MIN_PASSWORD_LENGTH, getAuthHeaders } from "@/utils/auth";
import { useToast } from "@/utils/toast";

const props = defineProps<{ modelValue: boolean }>();
const emit = defineEmits(["update:modelValue"]);

const { showToast } = useToast();

const currentPassword = ref("");
const newPassword = ref("");
const confirmPassword = ref("");
// Eye button: shows all three fields as plain text
const showPasswords = ref(false);
const isSaving = ref(false);
// field errors are only shown after the first submit attempt (or from the server)
const hasTriedSubmit = ref(false);
const serverErrors = ref<{ currentPassword?: string; newPassword?: string }>({});
const generalError = ref("");

const currentPasswordError = computed(() => {
  if (serverErrors.value.currentPassword) return serverErrors.value.currentPassword;
  if (hasTriedSubmit.value && !currentPassword.value) {
    return "Please enter your current password.";
  }
  return "";
});

const newPasswordError = computed(() => {
  if (serverErrors.value.newPassword) return serverErrors.value.newPassword;
  if (
    (hasTriedSubmit.value || newPassword.value.length > 0) &&
    newPassword.value.length < MIN_PASSWORD_LENGTH
  ) {
    return `Use at least ${MIN_PASSWORD_LENGTH} characters.`;
  }
  return "";
});

const confirmPasswordError = computed(() => {
  if (
    (hasTriedSubmit.value || confirmPassword.value.length > 0) &&
    confirmPassword.value !== newPassword.value
  ) {
    return "Passwords do not match.";
  }
  return "";
});

const resetForm = () => {
  currentPassword.value = "";
  newPassword.value = "";
  confirmPassword.value = "";
  showPasswords.value = false;
  hasTriedSubmit.value = false;
  serverErrors.value = {};
  generalError.value = "";
};

// start empty every time the dialog opens
watch(
  () => props.modelValue,
  (isOpen) => {
    if (isOpen) resetForm();
  },
);

// a server error belongs to the value it was given for, so drop it once the user edits the field
watch(currentPassword, () => {
  serverErrors.value.currentPassword = undefined;
});
watch(newPassword, () => {
  serverErrors.value.newPassword = undefined;
});

const close = () => emit("update:modelValue", false);

const handleSubmit = async () => {
  hasTriedSubmit.value = true;
  generalError.value = "";
  if (currentPasswordError.value || newPasswordError.value || confirmPasswordError.value) {
    return;
  }

  isSaving.value = true;
  try {
    const response = await fetch(`${URLs.API_URL}/users/me/password`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...getAuthHeaders() },
      body: JSON.stringify({
        currentPassword: currentPassword.value,
        newPassword: newPassword.value,
      }),
    });

    if (response.ok) {
      close();
      showToast("Password changed");
      return;
    }

    const data = await response.json().catch(() => null);
    if (data?.field === "currentPassword" || data?.field === "newPassword") {
      serverErrors.value = { [data.field]: data.message };
    } else {
      generalError.value = data?.message || "Password could not be changed.";
    }
  } catch (error) {
    generalError.value = "Server is not reachable.";
  } finally {
    isSaving.value = false;
  }
};
</script>

<template>
  <v-dialog
    :model-value="props.modelValue"
    max-width="460px"
    @update:model-value="(value: boolean) => emit('update:modelValue', value)"
  >
    <v-card style="padding: 24px; border-radius: 12px;">
      <v-card-title class="px-0 pt-0 mb-2" style="font-weight: 600;">
        Change password
      </v-card-title>

      <form @submit.prevent="handleSubmit">
        <v-card-text class="px-0 py-2">
          <div class="d-flex align-start" style="gap: 8px;">
            <!-- all fields share one column, so they have the same width -->
            <div class="flex-grow-1" style="min-width: 0;">
              <v-text-field
                v-model="currentPassword"
                label="Current password"
                :type="showPasswords ? 'text' : 'password'"
                autocomplete="current-password"
                variant="outlined"
                density="comfortable"
                class="mb-3"
                hide-details="auto"
                :error-messages="currentPasswordError ? [currentPasswordError] : []"
              ></v-text-field>

              <v-text-field
                v-model="newPassword"
                label="New password"
                :type="showPasswords ? 'text' : 'password'"
                autocomplete="new-password"
                variant="outlined"
                density="comfortable"
                class="mb-3"
                :hint="`At least ${MIN_PASSWORD_LENGTH} characters`"
                persistent-hint
                hide-details="auto"
                :error-messages="newPasswordError ? [newPasswordError] : []"
              ></v-text-field>

              <v-text-field
                v-model="confirmPassword"
                label="Confirm new password"
                :type="showPasswords ? 'text' : 'password'"
                autocomplete="new-password"
                variant="outlined"
                density="comfortable"
                hide-details="auto"
                :error-messages="confirmPasswordError ? [confirmPasswordError] : []"
              ></v-text-field>
            </div>

            <VBtn
              class="flex-shrink-0"
              variant="text"
              color="#737373"
              icon
              :width="48"
              :height="48"
              :aria-label="showPasswords ? 'Hide passwords' : 'Show passwords'"
              @click="showPasswords = !showPasswords"
            >
              <PhEyeSlash v-if="showPasswords" :size="20" />
              <PhEye v-else :size="20" />
            </VBtn>
          </div>

          <p
            v-if="generalError"
            class="mt-3"
            role="alert"
            style="color: #b42318; font-size: 14px;"
          >
            {{ generalError }}
          </p>
        </v-card-text>

        <v-card-actions class="px-0 pb-0 mt-4" style="justify-content: end;">
          <VBtn variant="text" color="#737373" @click="close">Cancel</VBtn>
          <VBtn
            type="submit"
            color="#00594C"
            style="background-color: #00594C; color: white;"
            :loading="isSaving"
          >
            Change password
          </VBtn>
        </v-card-actions>
      </form>
    </v-card>
  </v-dialog>
</template>
