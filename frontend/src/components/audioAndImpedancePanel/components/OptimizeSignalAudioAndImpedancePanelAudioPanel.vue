<script setup lang="ts">
import { computed, onUnmounted, ref, watch, defineEmits } from "vue";
import { PhArrowRight, PhSpeakerHigh } from "@phosphor-icons/vue";
import { LottieAnimation } from "lottie-web-vue";

import Breathing from "@/assets/Breathing.json";
// import DynamicGradient from "@/assets/DynamicGradient.json";
import audioFile from "@/assets/boot_assr_60s.mp3";
import { useOpenBCIUtils } from "@/utils/hooks";

const emit = defineEmits(["close"]);

// ---- STATE ----

const { sendAudioSignalStartMessage, sendAudioSignalEndMessage } =
  useOpenBCIUtils();

let anim = ref();
// let animBackground = ref();

const hasUserReadInstructions = ref(false);

let audio = new Audio(audioFile);
const isAudioPlaying = computed(
  () => hasUserReadInstructions.value && !isTimerFinished.value,
);

const progress = ref(0);
let timer: number | undefined;
const isTimerFinished = ref(false);

// ---- CALLBACKS ----

const handleContinue = async () => {
  emit("close");
};

// ---- LIFECYCLE HOOKS ----

watch(
  () => isAudioPlaying.value,
  () => {
    if (isAudioPlaying.value) {
      sendAudioSignalStartMessage();
      audio.play();
    } else {
      sendAudioSignalEndMessage();
      audio.pause();
    }
  },
);

watch(
  () => hasUserReadInstructions.value,
  () => {
    timer = setInterval(() => {
      if (progress.value < 100) {
        progress.value += 1.67; // 100 / 60 = 1.67 (approximately)
      } else {
        isTimerFinished.value = true;
        clearInterval(timer);
      }
    }, 1000);
  },
);

onUnmounted(() => {
  clearInterval(timer);
});
</script>

<template>
  <!-- Background Animation -->

  <!--  <VCol style="overflow: hidden; z-index: 2000">-->
  <!--    <LottieAnimation-->
  <!--      class="flex-grow-1"-->
  <!--      style="justify-content: center; align-items: center; z-index: 2100"-->
  <!--      ref="animBackground"-->
  <!--      :animation-data="DynamicGradient"-->
  <!--      :loop="true"-->
  <!--      :auto-play="true"-->
  <!--      :speed="1"-->
  <!--    />-->
  <!--  </VCol>-->

  <!-- Content -->

  <VCol
    class="flex-grow-1 d-flex h-100 pt-12"
    style="
      position: absolute;
      top: 0;
      left: 0;
      bottom: 0;
      width: 100%;
      height: 100%;
      overflow: hidden;
      z-index: 2100;
    "
  >
    <VCol
      class="position-absolute justify-center align-center"
      style="top: 25px; left: 25px; width: 40px; height: 40px; z-index: 2100"
    >
      <VCol
        class="position-absolute justify-center align-center rounded-circle border-sm"
        style="
          top: 0px;
          left: 0px;
          width: 40px;
          height: 40px;
          z-index: 2010;
          background: rgba(255, 255, 255, 0.3);
          border-color: rgba(124, 127, 122, 0.3) !important;
        "
      />

      <PhSpeakerHigh size="24" style="z-index: 2100" color="#1a2b5a" />
    </VCol>
    <VCol class="flex-grow-1 justify-space-between align-center">
      <h1 class="mb-3" style="font-size: 38px; color: #1a2b5a">Please Rest</h1>

      <p
        :class="!hasUserReadInstructions ? 'mb-4' : 'mb-1'"
        style="
          color: #737373;
          text-align: center;
          font-weight: 500;
          font-size: 18px;
          transition: margin-bottom 0.5s ease-in-out;
        "
      >
        Turn up your volume and listen to the audio. <br />
        After one minute, you can continue to the Impedance Check.
      </p>

      <p
        :class="{ deflate: hasUserReadInstructions }"
        :style="{
          color: '#737373',
          fontWeight: '500',
          fontSize: '18px',
          minHeight: !hasUserReadInstructions ? '150px' : '0px',
          opacity: !hasUserReadInstructions ? '100%' : '0',
          maxWidth: '500px',
          textAlign: 'justify',
        }"
      >
        Please breathe normally and keep your body relaxed. A baseline
        measurement will be recorded. After one minute, you can continue to the
        next step, which will be the impedance recording.
      </p>
      <p
        :class="{ deflate: hasUserReadInstructions }"
        :style="{
          color: '#737373',
          fontWeight: '500',
          fontSize: '15px',
          minHeight: !hasUserReadInstructions ? '30' : '0px',
          opacity: !hasUserReadInstructions ? '100%' : '0',
          width: '500px',
          textAlign: 'center',
        }"
      >
        If you are ready, click the continue button.
      </p>

      <VCol
        :style="{
          width: '180px',
          minHeight: hasUserReadInstructions ? '180px' : '0px',
        }"
        :class="{ expanded: hasUserReadInstructions }"
        class="mt-4 mb-8 d-flex justify-center align-center rounded-circle overflow-hidden position-relative"
      >
        <LottieAnimation
          style="
            width: 250px;
            justify-content: center;
            align-items: center;
            top: -20px;
            position: relative;
          "
          ref="anim"
          :animation-data="Breathing"
          :loop="true"
          :auto-play="true"
          :speed="1"
        />
      </VCol>

      <VRow
        class="ga-5 align-center justify-end position-relative w-100 px-8"
        style="
          min-height: 60px;
          background: rgba(255, 255, 255, 0.45);
          box-shadow: 0 8px 32px 0 rgba(31, 38, 135, 0.37);
          backdrop-filter: blur(10px);
          -webkit-backdrop-filter: blur(10px);
        "
      >
        <v-progress-linear
          v-if="hasUserReadInstructions"
          class="mr-auto position-absolute"
          style="width: 150px; height: 5px; left: 25px; top: 50%"
          :model-value="progress"
          rounded
          :color="!isTimerFinished ? '#000000' : '#05775e'"
        />

        <VRow class="align-start justify-center">
          <VBtn
            v-if="!hasUserReadInstructions"
            class="flex-grow-0 flex-shrink-1 d-flex"
            :append-icon="PhArrowRight"
            @click="hasUserReadInstructions = true"
            >Continue</VBtn
          >
          <VBtn
            v-else
            :disabled="!isTimerFinished"
            class="flex-grow-0 flex-shrink-1 d-flex"
            :append-icon="PhArrowRight"
            @click="handleContinue"
            >Continue</VBtn
          >
        </VRow>
      </VRow>
    </VCol>
  </VCol>
</template>

<style scoped>
.expanded {
  min-height: 300px;
  transition: min-height 1.5s ease-in-out;
}

.deflate {
  opacity: 0;
  min-height: 0;
  max-height: 0;
  transition:
    min-height 1s ease-in-out,
    opacity 0.6s ease-in-out,
    max-height 0.5s ease-out;
}
</style>
