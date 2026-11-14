<script setup lang="ts">
import { ref } from "vue";
import { useRouter } from "vue-router";
import BasePage from "@/components/BasePage.vue";
import { PhSignIn, PhWarningCircle } from "@phosphor-icons/vue";

// ---- STATE ----
const username = ref("");
const password = ref("");
const isLoading = ref(false);

const errorModal = ref({
  isOpen: false,
  title: "",
  message: "",
});

const router = useRouter();

// ---- METHODS ----
const handleLogin = async () => {
  if (!username.value || !password.value) {
    errorModal.value = {
      isOpen: true,
      title: "Missing Input",
      message: "Please enter your username and password.",
    };
    return;
  }

  isLoading.value = true;

  try {
    const response = await fetch("http://localhost:3000/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: username.value,
        password: password.value,
      }),
    });

    const data = await response.json();

    if (response.ok) {
      // Store token & user information locally
      localStorage.setItem("user_token", data.token);
      localStorage.setItem("user_id", data.userId);
      localStorage.setItem("username", data.username);
      localStorage.setItem("is_admin", data.isAdmin);

      // Redirect to the protected dashboard
      router.push("/dashboard");
    } else {
      errorModal.value = {
        isOpen: true,
        title: "Login Failed",
        message: data.message || "Invalid login credentials. Please try again.",
      };
    }
  } catch (error) {
    errorModal.value = {
      isOpen: true,
      title: "Connection Error",
      message: "The server is currently unreachable.",
    };
  } finally {
    isLoading.value = false;
  }
};
</script>

<template>
  <BasePage heading="Researcher Login">
    <p
      class="mb-8"
      style="
        color: #737373;
        text-align: center;
        font-weight: 500;
        font-size: 18px;
      "
    >
      Please log in to get access to the study management and <br />
      the dashboard.
    </p>

    <!-- Login Form Container -->
    <div class="login-form-container">
      <form @submit.prevent="handleLogin">
        <v-text-field
          v-model="username"
          label="Username"
          variant="outlined"
          density="comfortable"
          class="mb-2"
          hide-details="auto"
        ></v-text-field>

        <v-text-field
          v-model="password"
          label="Password"
          type="password"
          variant="outlined"
          density="comfortable"
          class="mb-6"
          hide-details="auto"
        ></v-text-field>

        <VBtn
          type="submit"
          class="w-100"
          :append-icon="PhSignIn"
          :loading="isLoading"
        >
          Log In
        </VBtn>
      </form>
    </div>

    <p
      class="mt-4"
      style="
        font-size: 13px;
        color: #939393;
        text-align: center;
        max-width: 600px;
      "
    >
      Access only for authorized test administrators and researchers. <br />
      Participants do not need to log in and use their assigned link.
    </p>
  </BasePage>

  <!-- Loading Dialog -->
  <v-dialog v-model="isLoading" max-width="500px" persistent>
    <v-card style="padding: 40px; border-radius: 12px; align-items: center">
      <v-progress-circular
        indeterminate
        :size="41"
        :width="5"
        color="#00594C"
        style="margin-bottom: 8px"
      ></v-progress-circular>
      <v-card-text style="padding-bottom: 0">
        Checking login...
      </v-card-text>
    </v-card>
  </v-dialog>

  <!-- Error Modal -->
  <v-dialog v-model="errorModal.isOpen" max-width="500px">
    <v-card style="padding: 16px; border-radius: 12px">
      <div style="display: flex; flex-direction: row; align-items: center">
        <PhWarningCircle :size="24" color="red" />
        <v-card-title class="pb-0 pl-2" style="text-align: left">
          {{ errorModal.title }}
        </v-card-title>
      </div>

      <v-card-text class="px-8 mb-1" style="text-align: left">
        {{ errorModal.message }}
      </v-card-text>

      <v-card-actions class="pb-0" style="justify-content: end">
        <VBtn @click="errorModal.isOpen = false" rounded="lg">Close</VBtn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<style scoped>
.login-form-container {
  width: 100%;
  max-width: 420px;
  margin: 0 auto 24px auto;
}
</style>