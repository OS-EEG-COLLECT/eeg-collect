<script setup lang="ts">
import { onMounted, ref, watch } from "vue";

import BasePage from "@/components/BasePage.vue";
import {
  useConfigureParticipantId,
  useOpenBCIUtils,
  useWebsocketConnection,
} from "@/utils/hooks";
import { PhArrowRight } from "@phosphor-icons/vue";
import { ROUTES } from "@/utils/routes";
import OptimizeSignalAudioAndImpedancePanel from "@/components/audioAndImpedancePanel/OptimizeSignalAudioAndImpedancePanel.vue";

// ---- STATE ----
useConfigureParticipantId();
useWebsocketConnection();
const {
  startRecording,
  stopRecording,
  isImpedanceCheckRunning,
  runImpedanceCheck,
  impedanceCheckChannel,
} = useOpenBCIUtils();

const progressValue = ref(0);
const bufferValue = ref(20);
const interval = ref(0);

const isAudioAndImpedancePanelOpen = ref(false);

// ---- CALLBACKS ----

const handleStopRecording = () => {
  isAudioAndImpedancePanelOpen.value = true;
};

const startBuffer = () => {
  clearInterval(interval.value);

  // Reset progress values
  progressValue.value = 0;
  bufferValue.value = 0;

  // Calculate the total time and interval duration
  const totalTime = 6000; // 5 seconds in milliseconds
  const steps = 100; // Number of steps to complete progress
  const intervalDuration = totalTime / steps;

  // Start the interval to update progress
  interval.value = setInterval(() => {
    // Increment progress values
    progressValue.value += 100 / steps;
    bufferValue.value += 100 / steps;

    // Check if progress has reached 100%
    if (progressValue.value >= 100) {
      // Ensure the progress bar is exactly at 100%
      progressValue.value = 100;
      bufferValue.value = 100;
      // Stop the interval after the delay
      clearInterval(interval.value);
    }
  }, intervalDuration);
};

// ---- LIFECYCLE HOOKS ----

onMounted(() => {
  setTimeout(() => {
    // Start the recording after a delay of 1 second
    startRecording();
  }, 1000);
});

watch(
  () => isImpedanceCheckRunning.value,
  (newValue) => {
    if (newValue) {
      startBuffer();
    }
  },
);
</script>

<template>
  <BasePage heading="Recording">
    <VCol class="flex-grow-0" style="position: relative">
      <!--      <div-->
      <!--        style="-->
      <!--          position: absolute;-->
      <!--          top: -25px;-->
      <!--          left: 50%;-->
      <!--          transform: translateX(-50%);-->
      <!--          width: 300px;-->
      <!--          height: 150px;-->
      <!--        "-->
      <!--      >-->
      <!--        <div-->
      <!--          style="-->
      <!--            position: absolute;-->
      <!--            width: 500px;-->
      <!--            height: 200px;-->
      <!--            border-radius: 50%;-->
      <!--            background: #83b6dd;-->
      <!--            transform-origin: center;-->
      <!--            top: 0px;-->
      <!--            left: 50%;-->
      <!--            transform: translateX(-50%);-->
      <!--            filter: blur(125px);-->
      <!--          "-->
      <!--        />-->

      <!--        <div-->
      <!--          class="greencircle"-->
      <!--          style="-->
      <!--            position: absolute;-->
      <!--            width: 150px;-->
      <!--            height: 150px;-->
      <!--            border-radius: 50%;-->
      <!--            background: #14bfb2;-->
      <!--            transform-origin: bottom left;-->
      <!--            animation: 5000ms linear 0s infinite normal none running spin;-->
      <!--            animation-duration: 9000ms;-->
      <!--            top: -100px;-->
      <!--            filter: blur(90px);-->
      <!--          "-->
      <!--        />-->

      <!--        <div-->
      <!--          class="bluecircle"-->
      <!--          style="-->
      <!--            position: absolute;-->
      <!--            width: 150px;-->
      <!--            height: 150px;-->
      <!--            border-radius: 50%;-->
      <!--            background: rgb(79, 149, 255);-->
      <!--            transform-origin: top;-->
      <!--            animation: 5000ms linear 0s infinite normal none running spin;-->
      <!--            animation-duration: 6000ms;-->
      <!--            animation-direction: reverse;-->
      <!--            right: 20px;-->
      <!--            top: 0px;-->
      <!--            filter: blur(90px);-->
      <!--          "-->
      <!--        />-->

      <!--        <div-->
      <!--          class="purplecircle"-->
      <!--          style="-->
      <!--            position: absolute;-->
      <!--            width: 150px;-->
      <!--            height: 150px;-->
      <!--            border-radius: 50%;-->
      <!--            background: #a44acf;-->
      <!--            transform-origin: right;-->
      <!--            animation: 5000ms linear 0s infinite normal none running spin;-->
      <!--            animation-duration: 6000ms;-->
      <!--            right: -80px;-->
      <!--            filter: blur(90px);-->
      <!--          "-->
      <!--        />-->
      <!--      </div>-->

      <VCol style="z-index: 1">
        <p
          class="mb-5"
          style="
            color: #737373;
            text-align: center;
            font-weight: 500;
            font-size: 18px;
          "
        >
          Recording in progress. You can now return to the experiment Tab.<br />
        </p>

        <v-btn
          @click="handleStopRecording"
          class="mx-auto"
          :append-icon="PhArrowRight"
        >
          Stop Recording
        </v-btn>
      </VCol>
    </VCol>

    <OptimizeSignalAudioAndImpedancePanel
      v-if="isAudioAndImpedancePanelOpen"
      :next-route="ROUTES.FINISH"
      :impedance-check-channel="impedanceCheckChannel"
      :is-impedance-check-running="isImpedanceCheckRunning"
      :run-impedance-check="() => runImpedanceCheck('end')"
      :stop-recording="stopRecording"
      :impedance-panel-description="`Resistance measurements for each electrode.<br />The recording will stop after this step.`"
    />
  </BasePage>
</template>

<style>
@keyframes spin {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}

.purplecircle::before {
  content: "";
  display: block;
  position: absolute;
  width: 100px;
  height: 100px;
  border-radius: 50%;
  transform-origin: center bottom;
  background: rgb(109, 157, 239);
  top: 70%;
  left: auto;
  right: 50%;
}
.purplecircle::after {
  content: "";
  display: block;
  position: absolute;
  width: 130px;
  height: 130px;
  border-radius: 50%;
  transform-origin: center bottom;
  background: rgb(68, 206, 227);
  top: 50%;
  left: 50%;
}
.bluecircle::after {
  content: "";
  display: block;
  position: absolute;
  width: 120px;
  height: 120px;
  border-radius: 50%;
  transform-origin: center bottom;
  background: rgb(70, 170, 152);
  top: 50%;
  left: 50%;
}
.bluecircle::before {
  content: "";
  display: block;
  position: absolute;
  width: 100px;
  height: 100px;
  border-radius: 50%;
  transform-origin: center bottom;
  background: rgb(242, 101, 253);
  top: 50%;
  left: auto;
  right: 50%;
}

.greencircle::before {
  content: "";
  display: block;
  position: absolute;
  width: 120px;
  height: 120px;
  border-radius: 50%;
  transform-origin: center bottom;
  background: rgb(242, 80, 246);
  top: -30%;
  left: -50%;
}

.greencircle::after {
  content: "";
  display: block;
  position: absolute;
  width: 100px;
  height: 100px;
  border-radius: 50%;
  transform-origin: center bottom;
  background: rgb(53, 129, 255);
  top: 50%;
  left: auto;
  right: 100%;
}
</style>
