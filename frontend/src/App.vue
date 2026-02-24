<script setup lang="ts">
import { onMounted, ref } from "vue";

import LogoIcon from "@/assets/LogoIcon.vue";
import { getIsPassphraseValid } from "@/utils/helpers";
import ParticipantIdModal from "@/components/ParticipantIdModal.vue";

// ---- STATE ----
const isPassphraseValid = ref(false);

// ---- LIFECYCLE HOOKS ----

onMounted(async () => {
  isPassphraseValid.value = await getIsPassphraseValid();
});
</script>

<template>
  <div id="app">
    <!-- Application Header with Menu Button -->
    <header style="z-index: 5000">
      <LogoIcon style="width: 60px; height: 60px" />
      <!-- <h1 class="app-title">EEG Aufnahme</h1> -->
      <h1 class="app-title">EEG Recording</h1>
    </header>

    <!-- Content Area with left margin -->
    <div
      v-if="isPassphraseValid"
      class="content"
      style="display: block; width: 100vw; height: calc(100vh - 70px)"
    >
      <router-view></router-view>
    </div>
    <div v-else class="forbidden">403 Forbidden</div>

    <!-- ---- Global Modals ---- -->
    <ParticipantIdModal />
  </div>
</template>

<style>
* {
  box-sizing: border-box;
  padding: 0;
  margin: 0;
}

body {
  box-sizing: border-box !important;
  height: 100vh;
  width: 100%;
  max-width: 100%;
  display: flex;
}

/* Add this style for the forbidden message */
.forbidden {
  margin-top: 57px; /* Same as the top value of the menu */
  padding: 20px; /* Add some padding for better readability */
  text-align: center;
  font-size: 24px;
  color: red;
}
#app {
  font-family: "ui-sans-serif", "system-ui", "Open Sans", "Arial", sans-serif;
  overflow-x: hidden; /* Hide horizontal scrollbar when content overflows */
  width: 100vw;
  height: 100vh;
  display: flex;
}

/* Application Header Styles */
header {
  background-color: #00876c;
  color: #fff;
  display: flex;
  align-items: center;
  padding: 10px 30px;
  width: 100%;
  position: fixed;
  top: 0;
  left: 0;
  z-index: 1; /* Ensure the header is above the menu */
  height: 70px;
}

.app-title {
  font-size: 24px;
  font-weight: 600;
}

/* Content Area Styles */
.content {
  margin-top: 70px;
  width: 100%;
  height: calc(100% - 70px);
}
</style>
